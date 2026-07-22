import React, { useState, useEffect, useMemo } from 'react';
import Header from '@/components/dashboard/Header';
import { 
  Database, Table as TableIcon, Search, RefreshCw, 
  Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  Columns, FileJson, FileSpreadsheet, X, Check, Copy, HardDrive, Layers,
  ArrowUp, ArrowDown, ArrowUpDown, Calendar, Clock, ArrowUpDown as SortIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, 
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface CollectionInfo {
  name: string;
  count: number;
  columnsCount: number;
  sampleKeys: string[];
}

interface ColumnSchema {
  key: string;
  type: string;
}

interface PaginationInfo {
  totalDocs: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const DatabaseViewer: React.FC = () => {
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [dbName, setDbName] = useState<string>('trainflow');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  
  const [columns, setColumns] = useState<ColumnSchema[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    totalDocs: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 25,
    hasNextPage: false,
    hasPrevPage: false
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('_id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({});
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch Collections List
  const fetchCollections = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/database/collections`);
      const json = await res.json();
      if (json.success) {
        setCollections(json.collections);
        setDbName(json.database || 'trainflow');
        if (json.collections.length > 0 && !selectedCollection) {
          const firstNonEmpty = json.collections.find((c: CollectionInfo) => c.count > 0) || json.collections[0];
          setSelectedCollection(firstNonEmpty.name);
        }
      } else {
        toast.error('Failed to load database collections');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to connect to backend database API');
    } finally {
      setLoading(false);
    }
  };

  // Determine smart default sort column for collection
  const getSmartDefaultSort = (colName: string, availableCols: ColumnSchema[]) => {
    const colKeys = availableCols.map(c => c.key);

    if (colName === 'vibrationrecords' && colKeys.includes('sample_index')) {
      return { key: 'sample_index', order: 'asc' as const };
    }
    if (colKeys.includes('receivedAt')) return { key: 'receivedAt', order: 'desc' as const };
    if (colKeys.includes('createdAt')) return { key: 'createdAt', order: 'desc' as const };
    if (colKeys.includes('startTime')) return { key: 'startTime', order: 'desc' as const };
    if (colKeys.includes('timestamp')) return { key: 'timestamp', order: 'desc' as const };
    if (colKeys.includes('sample_index')) return { key: 'sample_index', order: 'asc' as const };
    
    return { key: '_id', order: 'desc' as const };
  };

  // Fetch Data for Selected Collection
  const fetchCollectionData = async (
    colName: string, 
    page: number = 1, 
    limit: number = 25, 
    search: string = searchQuery,
    sortField: string = sortBy,
    sortDir: 'asc' | 'desc' = sortOrder
  ) => {
    if (!colName) return;
    setDataLoading(true);
    try {
      const params = new URLSearchParams({
        collection: colName,
        page: page.toString(),
        limit: limit.toString(),
        search: search,
        sortBy: sortField,
        sortOrder: sortDir
      });

      const res = await fetch(`${API_BASE_URL}/database/data?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        let rawData = json.data || [];
        let rawCols: ColumnSchema[] = json.columns || [];

        if (colName === 'vibrationrecords') {
          // Frontend UI Presentation Transformation ONLY (MongoDB database remains untouched)
          rawData = rawData.map((doc: any) => {
            const transformedDoc = { ...doc };
            
            // Move s1_x_g values to s1_y_g and s2_x_g values to s2_y_g
            transformedDoc.s1_y_g = doc.s1_x_g !== undefined ? doc.s1_x_g : doc.s1_y_g;
            transformedDoc.s2_y_g = doc.s2_x_g !== undefined ? doc.s2_x_g : doc.s2_y_g;
            
            // Omit s1_x_g, s2_x_g, s1_x_v, s2_x_v, s1_y_v, s1_z_v, s2_y_v, s2_z_v from presentation view
            delete transformedDoc.s1_x_g;
            delete transformedDoc.s2_x_g;
            delete transformedDoc.s1_x_v;
            delete transformedDoc.s2_x_v;
            delete transformedDoc.s1_y_v;
            delete transformedDoc.s1_z_v;
            delete transformedDoc.s2_y_v;
            delete transformedDoc.s2_z_v;

            return transformedDoc;
          });

          const excludedKeys = ['s1_x_g', 's2_x_g', 's1_x_v', 's2_x_v', 's1_y_v', 's1_z_v', 's2_y_v', 's2_z_v'];
          rawCols = rawCols.filter(col => !excludedKeys.includes(col.key));
        }

        setColumns(rawCols);
        setDocuments(rawData);
        setPagination(json.pagination);

        // Initialize column visibility map
        setVisibleColumns(prev => {
          const newMap: Record<string, boolean> = {};
          rawCols.forEach((col: ColumnSchema) => {
            newMap[col.key] = prev[col.key] !== undefined ? prev[col.key] : true;
          });
          return newMap;
        });
      } else {
        toast.error(json.error || 'Failed to fetch collection data');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error loading table data');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  // When collection changes, apply smart default sort and load
  useEffect(() => {
    if (selectedCollection) {
      // Find default sort key
      let defaultSortKey = '_id';
      let defaultSortDir: 'asc' | 'desc' = 'desc';

      if (selectedCollection === 'vibrationrecords') {
        defaultSortKey = 'sample_index';
        defaultSortDir = 'asc';
      } else if (selectedCollection === 'mqttrecords') {
        defaultSortKey = 'receivedAt';
        defaultSortDir = 'desc';
      } else if (selectedCollection === 'trainevents') {
        defaultSortKey = 'startTime';
        defaultSortDir = 'desc';
      } else if (selectedCollection === 'users') {
        defaultSortKey = 'createdAt';
        defaultSortDir = 'desc';
      }

      setSortBy(defaultSortKey);
      setSortOrder(defaultSortDir);
      fetchCollectionData(selectedCollection, 1, pagination.limit, searchQuery, defaultSortKey, defaultSortDir);
    }
  }, [selectedCollection]);

  // Handle Header Column Sort Click
  const handleSortColumn = (colKey: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (sortBy === colKey) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      // Default to desc for dates/timestamps/objectids, asc for index/numbers
      if (['receivedAt', 'createdAt', 'timestamp', 'startTime', 'endTime', 'updatedAt', '_id'].includes(colKey)) {
        newOrder = 'desc';
      } else {
        newOrder = 'asc';
      }
    }

    setSortBy(colKey);
    setSortOrder(newOrder);
    toast.info(`Sorted by ${colKey} (${newOrder === 'asc' ? 'Ascending' : 'Descending'})`);
    fetchCollectionData(selectedCollection, 1, pagination.limit, searchQuery, colKey, newOrder);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCollectionData(selectedCollection, 1, pagination.limit, searchQuery, sortBy, sortOrder);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchCollectionData(selectedCollection, newPage, pagination.limit, searchQuery, sortBy, sortOrder);
    }
  };

  const handleLimitChange = (newLimit: number) => {
    fetchCollectionData(selectedCollection, 1, newLimit, searchQuery, sortBy, sortOrder);
  };

  const handleExport = (format: 'csv' | 'json') => {
    window.open(`${API_BASE_URL}/database/export?collection=${selectedCollection}&format=${format}`, '_blank');
    toast.success(`Exporting ${selectedCollection} as ${format.toUpperCase()}...`);
  };

  const copyDocJSON = () => {
    if (selectedDoc) {
      navigator.clipboard.writeText(JSON.stringify(selectedDoc, null, 2));
      setCopied(true);
      toast.success('Document JSON copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'ObjectID': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'Number': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'String': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Date': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Boolean': return 'bg-pink-500/10 text-pink-400 border-pink-500/30';
      case 'Object': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'Array': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const renderCellContent = (value: any, type: string) => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground/40 italic">null</span>;
    }
    if (typeof value === 'boolean') {
      return (
        <Badge variant={value ? 'default' : 'secondary'} className={value ? 'bg-success/20 text-success border-success/30' : ''}>
          {value ? 'true' : 'false'}
        </Badge>
      );
    }
    if (typeof value === 'object') {
      const isArray = Array.isArray(value);
      const label = isArray ? `Array(${value.length})` : 'Object';
      return (
        <Badge variant="outline" className="font-mono text-[11px] cursor-pointer hover:bg-muted/80 transition-colors">
          {label}
        </Badge>
      );
    }
    if (type === 'Date' || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/))) {
      return (
        <span className="font-mono text-xs text-amber-300/90 whitespace-nowrap">
          {new Date(value).toLocaleString()}
        </span>
      );
    }
    return <span className="font-mono text-xs truncate max-w-[240px] inline-block">{String(value)}</span>;
  };

  const activeColumnsList = useMemo(() => {
    if (selectedCollection === 'vibrationrecords') {
      const customOrder = ['sample_index', 's1_y_g', 's1_z_g', 's2_y_g', 's2_z_g', 'collectedAt', 'station', '_id'];
      const reordered: ColumnSchema[] = [];
      customOrder.forEach(key => {
        const found = columns.find(c => c.key === key);
        if (found) reordered.push(found);
      });
      columns.forEach(col => {
        if (!reordered.some(r => r.key === col.key)) {
          reordered.push(col);
        }
      });
      return reordered.filter(col => visibleColumns[col.key] !== false);
    }

    // Priority reordering for other collections
    const priorityKeys = ['_id', 'sample_index', 'collectedAt', 'receivedAt', 'createdAt', 'timestamp', 'startTime', 'station'];
    const reordered: ColumnSchema[] = [];
    priorityKeys.forEach(pKey => {
      const found = columns.find(c => c.key === pKey);
      if (found) reordered.push(found);
    });

    columns.forEach(col => {
      if (!reordered.some(r => r.key === col.key)) {
        reordered.push(col);
      }
    });

    return reordered.filter(col => visibleColumns[col.key] !== false);
  }, [columns, visibleColumns, selectedCollection]);

  // Discover Date/Time or Index sort fields in current columns
  const sortFieldsList = useMemo(() => {
    return columns.map(c => c.key);
  }, [columns]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/50">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary glow-primary">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Database Explorer</h1>
                <p className="text-xs text-muted-foreground">
                  Browse collections, sort data by Date/Time or Index, and inspect live MongoDB records in <span className="text-primary font-semibold">{dbName}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                fetchCollections();
                if (selectedCollection) fetchCollectionData(selectedCollection, pagination.currentPage, pagination.limit, searchQuery, sortBy, sortOrder);
              }}
              disabled={loading || dataLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${(loading || dataLoading) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-400" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
              <FileJson className="w-4 h-4 mr-2 text-cyan-400" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Collection Selector Tabs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" /> Collections ({collections.length})
            </h2>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {collections.map(col => {
              const isSelected = selectedCollection === col.name;
              return (
                <button
                  key={col.name}
                  onClick={() => setSelectedCollection(col.name)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 border whitespace-nowrap cursor-pointer ${
                    isSelected 
                      ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-[1.02]' 
                      : 'bg-card/60 hover:bg-card border-border/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>{col.name}</span>
                  <Badge 
                    variant={isSelected ? 'outline' : 'secondary'} 
                    className={`text-[10px] px-1.5 py-0 ${isSelected ? 'border-primary-foreground/40 text-primary-foreground' : ''}`}
                  >
                    {col.count.toLocaleString()}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats & Search Bar */}
        <Card className="glass border-border/50">
          <CardContent className="p-4 space-y-4">
            
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-3 border-b border-border/40">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/80">
                  <HardDrive className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Active Collection</p>
                  <p className="text-sm font-bold">{selectedCollection || 'None'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/80">
                  <Layers className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Total Documents</p>
                  <p className="text-sm font-bold">{pagination.totalDocs.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/80">
                  <Columns className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Discovered Fields</p>
                  <p className="text-sm font-bold">{columns.length} columns</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/80">
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Current Sort</p>
                  <p className="text-xs font-mono font-semibold text-primary truncate max-w-[150px]">
                    {sortBy} ({sortOrder.toUpperCase()})
                  </p>
                </div>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              
              {/* Search Form */}
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder={`Search in ${selectedCollection}...`}
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="pl-9 bg-secondary/50 text-xs h-9"
                  />
                  {searchQuery && (
                    <button 
                      type="button" 
                      onClick={() => { 
                        setSearchQuery(''); 
                        fetchCollectionData(selectedCollection, 1, pagination.limit, '', sortBy, sortOrder); 
                      }}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <Button type="submit" size="sm" className="h-9 text-xs">
                  Search
                </Button>
              </form>

              {/* Sort By Dropdown & Column Toggles */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                
                {/* Sort By Dropdown */}
                <div className="flex items-center gap-1.5 bg-secondary/50 border border-input rounded-md px-2.5 py-1">
                  <SortIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] text-muted-foreground">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      const newSortKey = e.target.value;
                      setSortBy(newSortKey);
                      fetchCollectionData(selectedCollection, 1, pagination.limit, searchQuery, newSortKey, sortOrder);
                    }}
                    className="bg-transparent text-xs font-mono text-foreground outline-none cursor-pointer border-none"
                  >
                    {sortFieldsList.map(field => (
                      <option key={field} value={field} className="bg-popover text-foreground">
                        {field}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                      setSortOrder(newOrder);
                      fetchCollectionData(selectedCollection, 1, pagination.limit, searchQuery, sortBy, newOrder);
                    }}
                    className="ml-1 p-1 hover:bg-background/80 rounded transition-colors text-primary font-bold text-xs flex items-center gap-1"
                    title="Toggle Sort Order"
                  >
                    {sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-400" />}
                    <span className="text-[10px] uppercase font-mono">{sortOrder}</span>
                  </button>
                </div>

                {/* Column Toggle Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 text-xs">
                      <Columns className="w-3.5 h-3.5 mr-2" />
                      Columns ({activeColumnsList.length}/{columns.length})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto">
                    <DropdownMenuLabel className="text-xs">Toggle Columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {columns.map(col => (
                      <DropdownMenuCheckboxItem
                        key={col.key}
                        checked={visibleColumns[col.key] !== false}
                        onCheckedChange={(checked) => {
                          setVisibleColumns(prev => ({ ...prev, [col.key]: checked }));
                        }}
                        className="text-xs font-mono"
                      >
                        {col.key}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Limit Dropdown */}
                <select
                  value={pagination.limit}
                  onChange={(e) => handleLimitChange(Number(e.target.value))}
                  className="h-9 bg-secondary/50 text-xs px-2.5 rounded-md border border-input text-foreground outline-none cursor-pointer"
                >
                  <option value={10}>10 rows</option>
                  <option value={25}>25 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                </select>
              </div>

            </div>

          </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="glass border-border/50 overflow-hidden">
          <div className="relative overflow-x-auto max-h-[600px] scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-secondary/80 sticky top-0 z-10 backdrop-blur border-b border-border/60 select-none">
                <tr>
                  <th className="p-3 font-semibold text-muted-foreground w-12 text-center border-r border-border/30">
                    #
                  </th>
                  {activeColumnsList.map(col => {
                    const isCurrentSort = sortBy === col.key;
                    return (
                      <th 
                        key={col.key} 
                        onClick={() => handleSortColumn(col.key)}
                        className={`p-3 font-semibold border-r border-border/30 whitespace-nowrap min-w-[140px] cursor-pointer transition-colors ${
                          isCurrentSort ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-secondary'
                        }`}
                        title={`Click to sort by ${col.key}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <span>{col.key}</span>
                            {isCurrentSort ? (
                              sortOrder === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-emerald-400 font-bold" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-amber-400 font-bold" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100" />
                            )}
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono uppercase ${getTypeBadgeClass(col.type)}`}>
                            {col.type}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="p-3 font-semibold text-muted-foreground text-center min-w-[80px]">
                    Inspect
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border/30">
                {dataLoading ? (
                  <tr>
                    <td colSpan={activeColumnsList.length + 2} className="py-16 text-center text-muted-foreground">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      Loading records sorted by <span className="text-primary font-mono font-semibold">{sortBy}</span>...
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={activeColumnsList.length + 2} className="py-16 text-center text-muted-foreground">
                      <TableIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No documents found in <span className="font-semibold">{selectedCollection}</span>.
                    </td>
                  </tr>
                ) : (
                  documents.map((doc, idx) => {
                    const rowNum = (pagination.currentPage - 1) * pagination.limit + idx + 1;
                    return (
                      <tr 
                        key={doc._id || idx} 
                        className="hover:bg-muted/40 transition-colors group cursor-pointer"
                        onClick={() => setSelectedDoc(doc)}
                      >
                        <td className="p-3 text-center text-muted-foreground font-mono text-[11px] border-r border-border/20">
                          {rowNum}
                        </td>

                        {activeColumnsList.map(col => (
                          <td 
                            key={col.key} 
                            className={`p-3 border-r border-border/20 max-w-[300px] truncate ${
                              sortBy === col.key ? 'bg-primary/5' : ''
                            }`}
                          >
                            {renderCellContent(doc[col.key], col.type)}
                          </td>
                        ))}

                        <td className="p-3 text-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-muted-foreground hover:text-primary opacity-70 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDoc(doc);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer & Pagination */}
          <div className="p-4 bg-card/60 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{documents.length > 0 ? (pagination.currentPage - 1) * pagination.limit + 1 : 0}</span> to{' '}
              <span className="font-semibold text-foreground">
                {Math.min(pagination.currentPage * pagination.limit, pagination.totalDocs)}
              </span>{' '}
              of <span className="font-semibold text-foreground">{pagination.totalDocs.toLocaleString()}</span> records
            </p>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handlePageChange(1)}
                disabled={!pagination.hasPrevPage}
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={!pagination.hasPrevPage}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <span className="px-3 text-xs font-mono">
                Page {pagination.currentPage} / {pagination.totalPages}
              </span>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={!pagination.hasNextPage}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={!pagination.hasNextPage}
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

      </main>

      {/* JSON Document Inspection Modal */}
      <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col glass border-border/60">
          <DialogHeader className="border-b border-border/50 pb-3">
            <DialogTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-primary" />
                <span>Document Inspector — <span className="font-mono text-primary">{selectedCollection}</span></span>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Full BSON / JSON representation of selected database document.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto my-2 p-4 bg-secondary/80 rounded-lg border border-border/50 font-mono text-xs text-foreground scrollbar-thin">
            <pre className="whitespace-pre-wrap break-all">
              {selectedDoc ? JSON.stringify(selectedDoc, null, 2) : ''}
            </pre>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-[11px] text-muted-foreground font-mono">
              ID: {selectedDoc?._id ? String(selectedDoc._id) : 'N/A'}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={copyDocJSON}>
                {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-success" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                {copied ? 'Copied!' : 'Copy JSON'}
              </Button>
              <Button size="sm" variant="default" onClick={() => setSelectedDoc(null)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default DatabaseViewer;
