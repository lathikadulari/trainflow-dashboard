require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const TrainEvent = require('../models/TrainEvent');
const MLDataset = require('../models/MLDataset');

// Re-using the exact Logistic Regression logic from the API
class LogisticRegression {
    constructor(lr = 0.5, iters = 2000) {
        this.lr = lr;
        this.iters = iters;
        this.weights = [];
        this.bias = 0;
    }
    sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
    
    fit(X, y) {
        const n_samples = X.length;
        const n_features = X[0].length;
        this.weights = new Array(n_features).fill(0);
        this.bias = 0;

        for (let epoch = 1; epoch <= this.iters; epoch++) {
            let dw = new Array(n_features).fill(0);
            let db = 0;
            let totalLoss = 0;
            let correct = 0;

            for (let j = 0; j < n_samples; j++) {
                let z = this.bias;
                for (let k = 0; k < n_features; k++) z += this.weights[k] * X[j][k];
                const y_pred = this.sigmoid(z);
                
                // Cross-entropy loss (clipped to avoid log(0))
                const eps = 1e-15;
                const clippedPred = Math.max(eps, Math.min(1 - eps, y_pred));
                totalLoss += -(y[j] * Math.log(clippedPred) + (1 - y[j]) * Math.log(1 - clippedPred));
                
                const predictedLabel = y_pred >= 0.5 ? 1 : 0;
                if (predictedLabel === y[j]) {
                    correct++;
                }

                const dz = y_pred - y[j];
                db += dz;
                for (let k = 0; k < n_features; k++) dw[k] += dz * X[j][k];
            }

            this.bias -= this.lr * (db / n_samples);
            for (let k = 0; k < n_features; k++) this.weights[k] -= this.lr * (dw[k] / n_samples);

            // Log progress every 10% of iterations (or first and last epoch)
            const printInterval = Math.max(1, Math.floor(this.iters / 10));
            if (epoch === 1 || epoch % printInterval === 0 || epoch === this.iters) {
                const loss = totalLoss / n_samples;
                const acc = (correct / n_samples) * 100;
                console.log(`Epoch ${String(epoch).padStart(String(this.iters).length)}/${this.iters} - Loss: ${loss.toFixed(6)} - Accuracy: ${acc.toFixed(2)}%`);
            }
        }
    }
    
    predict(x) {
        let z = this.bias;
        for (let k = 0; k < x.length; k++) z += this.weights[k] * x[k];
        return this.sigmoid(z) >= 0.5 ? 1 : 0;
    }
}

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/trainflow');
        console.log("Connected to MongoDB for ML Training...\n");

        const dataset = await MLDataset.find({ sensorId: 'sensor2' }).lean();
        if (dataset.length === 0) {
            console.log("No dataset found. Please run Generation first.");
            return;
        }

        const allMeans = dataset.map(d => d.features.meanEnergy);
        const allSlopes = dataset.map(d => d.features.energySlope);
        const meanMax = Math.max(...allMeans);
        const slopeMax = Math.max(...allSlopes.map(Math.abs));

        const getX = (d) => {
            const x1 = d.features.meanEnergy / (meanMax || 1);
            const x2 = d.features.energySlope / (slopeMax || 1);
            // Add non-linear features (x1^2, x2^2, x1*x2) to allow curved decision boundaries!
            return [x1, x2, x1*x1, x2*x2, x1*x2];
        };

        const trainData = dataset.filter(d => d.split === 'train');
        const testData = dataset.filter(d => d.split === 'test');

        console.log(`Dataset Split: ${trainData.length} Training Samples, ${testData.length} Validation Samples\n`);

        const X_train = trainData.map(getX);
        const y_train = trainData.map(d => d.label);

        console.log("Training Advanced Logistic Regression Model (Non-Linear Features, 10000 iterations)...");
        const model = new LogisticRegression(0.8, 10000);
        model.fit(X_train, y_train);
        console.log("Training Complete!\n");

        console.log("======================================");
        console.log("       AI MODEL WEIGHTS               ");
        console.log("======================================");
        console.log(`Bias (Base Threshold): ${model.bias.toFixed(4)}`);
        console.log(`Weight 1 (Mean Energy): ${model.weights[0].toFixed(4)}`);
        console.log(`Weight 2 (Energy Slope): ${model.weights[1].toFixed(4)}\n`);

        const evaluate = (data) => {
            let tp = 0, fp = 0, tn = 0, fn = 0;
            data.forEach(d => {
                const pred = model.predict(getX(d));
                if (d.label === 1 && pred === 1) tp++;
                if (d.label === 0 && pred === 1) fp++;
                if (d.label === 0 && pred === 0) tn++;
                if (d.label === 1 && pred === 0) fn++;
            });
            const acc = (tp + tn) / data.length || 0;
            return { acc, tp, fp, tn, fn };
        };

        const trainRes = evaluate(trainData);
        console.log("======================================");
        console.log("       TRAINING RESULTS (80%)         ");
        console.log("======================================");
        console.log(`Accuracy: ${(trainRes.acc * 100).toFixed(1)}%`);
        console.log(`True Positives (Detected Trains): ${trainRes.tp}`);
        console.log(`True Negatives (Ignored Noise): ${trainRes.tn}`);
        console.log(`False Positives (False Alarms): ${trainRes.fp}`);
        console.log(`False Negatives (Missed Trains): ${trainRes.fn}\n`);

        if (testData.length > 0) {
            const testRes = evaluate(testData);
            console.log("======================================");
            console.log("       VALIDATION RESULTS (20%)       ");
            console.log("======================================");
            console.log(`Accuracy: ${(testRes.acc * 100).toFixed(1)}%`);
            console.log(`True Positives (Detected Trains): ${testRes.tp}`);
            console.log(`True Negatives (Ignored Noise): ${testRes.tn}`);
            console.log(`False Positives (False Alarms): ${testRes.fp}`);
            console.log(`False Negatives (Missed Trains): ${testRes.fn}\n`);
        } else {
            console.log("Not enough data points to run validation tests.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}
run();
