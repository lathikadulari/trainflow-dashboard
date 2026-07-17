require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const MLDataset = require('../models/MLDataset');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/trainflow');
        
        const data = await MLDataset.find().sort({ label: 1 }).lean();
        
        console.log('\n=============================================');
        console.log('   DATA STRUCTURE ANALYSIS (ML DATASET)      ');
        console.log('=============================================\n');

        let idleCount = 0;
        let approachCount = 0;

        for (const d of data) {
            const labelStr = d.label === 1 ? 'APPROACHING' : 'IDLE NOISE ';
            if (d.label === 1) approachCount++; else idleCount++;

            console.log(`[${labelStr}] Split: ${d.split.toUpperCase()} | Mean Energy: ${d.features.meanEnergy.toExponential(2)} | Slope: ${d.features.energySlope.toExponential(2)}`);
            
            // Generate ASCII Sparkline for the Envelope Structure
            if (d.envelopeData && d.envelopeData.length > 0) {
                const maxE = Math.max(...d.envelopeData.map(e => e.energy));
                const minE = Math.min(...d.envelopeData.map(e => e.energy));
                const range = maxE - minE || 1;
                
                let sparkline = '';
                const levels = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
                
                d.envelopeData.forEach(pt => {
                    const normalized = (pt.energy - minE) / range;
                    const levelIdx = Math.min(7, Math.floor(normalized * 8));
                    sparkline += levels[levelIdx];
                });
                
                console.log(`   Waveform Structure: |${sparkline}|`);
            }
            console.log('---------------------------------------------');
        }

        console.log(`\nTotal Samples: ${data.length} (Idle: ${idleCount}, Approaching: ${approachCount})`);

    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}
run();
