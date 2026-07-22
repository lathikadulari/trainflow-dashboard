const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Helper to detect value type for column badges
function detectType(value) {
    if (value === null || value === undefined) return 'Null';
    if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)) && value.length > 18 && value.includes('T'))) return 'Date';
    if (Array.isArray(value)) return 'Array';
    if (typeof value === 'object') {
        if (value._bsontype === 'ObjectID' || value.toString().match(/^[0-9a-fA-F]{24}$/)) return 'ObjectID';
        return 'Object';
    }
    if (typeof value === 'number') return 'Number';
    if (typeof value === 'boolean') return 'Boolean';
    if (typeof value === 'string') {
        if (value.match(/^[0-9a-fA-F]{24}$/)) return 'ObjectID';
        return 'String';
    }
    return typeof value;
}

// GET /api/database/collections - List all collections with stats
router.get('/collections', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ success: false, error: 'Database not connected' });
        }

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        const collectionList = [];

        for (const col of collections) {
            const collectionName = col.name;
            if (collectionName.startsWith('system.')) continue;

            const collection = db.collection(collectionName);
            const count = await collection.countDocuments();
            
            // Sample sample doc to get schema preview
            const sampleDoc = await collection.findOne({});
            const keys = sampleDoc ? Object.keys(sampleDoc) : [];

            collectionList.push({
                name: collectionName,
                count: count,
                columnsCount: keys.length,
                sampleKeys: keys.slice(0, 6)
            });
        }

        // Sort by document count descending
        collectionList.sort((a, b) => b.count - a.count);

        res.json({
            success: true,
            database: db.databaseName,
            collections: collectionList
        });
    } catch (err) {
        console.error('Error fetching collections:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/database/data - Fetch paginated records & dynamic column schemas
router.get('/data', async (req, res) => {
    try {
        const { collection: colName, page = 1, limit = 20, search = '', sortBy = '_id', sortOrder = 'desc' } = req.query;

        if (!colName) {
            return res.status(400).json({ success: false, error: 'Collection name is required' });
        }

        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ success: false, error: 'Database not connected' });
        }

        const db = mongoose.connection.db;
        const collection = db.collection(colName);

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
        const skip = (pageNum - 1) * limitNum;

        // Build query
        let query = {};
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            
            // Get sample document to inspect queryable text/number keys
            const sample = await collection.findOne({});
            if (sample) {
                const searchConditions = [];
                for (const [key, val] of Object.entries(sample)) {
                    if (key === '_id' && search.trim().match(/^[0-9a-fA-F]{24}$/)) {
                        try {
                            searchConditions.push({ _id: new mongoose.Types.ObjectId(search.trim()) });
                        } catch (e) {}
                    } else if (typeof val === 'string') {
                        searchConditions.push({ [key]: searchRegex });
                    } else if (typeof val === 'number' && !isNaN(Number(search))) {
                        searchConditions.push({ [key]: Number(search) });
                    }
                }
                if (searchConditions.length > 0) {
                    query = { $or: searchConditions };
                }
            }
        }

        // Count total matching docs
        const totalDocs = await collection.countDocuments(query);
        const totalPages = Math.ceil(totalDocs / limitNum) || 1;

        // Sorting
        const sortOptions = {};
        if (sortBy) {
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
        }

        // Fetch documents
        const docs = await collection.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNum)
            .toArray();

        // Discover all unique column keys across fetched documents
        const columnsMap = new Map();
        
        // Put _id first if present
        columnsMap.set('_id', { key: '_id', type: 'ObjectID' });

        docs.forEach(doc => {
            Object.keys(doc).forEach(key => {
                if (!columnsMap.has(key)) {
                    columnsMap.set(key, {
                        key: key,
                        type: detectType(doc[key])
                    });
                } else if (columnsMap.get(key).type === 'Null' && doc[key] !== null) {
                    columnsMap.get(key).type = detectType(doc[key]);
                }
            });
        });

        const columns = Array.from(columnsMap.values());

        res.json({
            success: true,
            collection: colName,
            columns: columns,
            data: docs,
            pagination: {
                totalDocs,
                totalPages,
                currentPage: pageNum,
                limit: limitNum,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1
            }
        });

    } catch (err) {
        console.error('Error fetching database data:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/database/export - Export dataset as CSV or JSON
router.get('/export', async (req, res) => {
    try {
        const { collection: colName, format = 'json' } = req.query;
        if (!colName) {
            return res.status(400).json({ success: false, error: 'Collection name is required' });
        }

        const db = mongoose.connection.db;
        const collection = db.collection(colName);
        const docs = await collection.find({}).limit(5000).toArray();

        if (format === 'csv') {
            if (docs.length === 0) {
                res.setHeader('Content-Type', 'text/csv');
                return res.send('');
            }
            const allKeys = Array.from(new Set(docs.flatMap(d => Object.keys(d))));
            const csvRows = [allKeys.join(',')];

            docs.forEach(doc => {
                const values = allKeys.map(k => {
                    let val = doc[k];
                    if (val === undefined || val === null) return '""';
                    if (typeof val === 'object') val = JSON.stringify(val);
                    return `"${String(val).replace(/"/g, '""')}"`;
                });
                csvRows.push(values.join(','));
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${colName}.csv"`);
            return res.send(csvRows.join('\n'));
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${colName}.json"`);
        res.json(docs);
    } catch (err) {
        console.error('Error exporting collection:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
