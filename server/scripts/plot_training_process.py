import matplotlib.pyplot as plt
import numpy as np
from pymongo import MongoClient
import os
import sys

# Connect to MongoDB
client = MongoClient('mongodb://localhost:27017/')
db = client['trainflow']
dataset = list(db['mldatasets'].find({'sensorId': 'sensor2'}))

if len(dataset) == 0:
    print("No data found in mldatasets.")
    sys.exit(1)

artifact_dir = r"C:\Users\thusa\.gemini\antigravity-ide\brain\ec86cf87-1395-42e1-92a6-0e8d7e74b2e4"

means = [d['features']['meanEnergy'] for d in dataset]
slopes = [d['features']['energySlope'] for d in dataset]
labels = [d['label'] for d in dataset]

meanMax = max(means) if max(means) > 0 else 1
slopeMax = max([abs(s) for s in slopes]) if max([abs(s) for s in slopes]) > 0 else 1

X = np.array([[m/meanMax, s/slopeMax, (m/meanMax)**2, (s/slopeMax)**2, (m/meanMax)*(s/slopeMax)] for m, s in zip(means, slopes)])
y = np.array(labels)

# Manual Gradient Descent to track Loss and Accuracy History
iterations = 10000
learning_rate = 0.8
n_samples, n_features = X.shape
weights = np.zeros(n_features)
bias = 0

loss_history = []
acc_history = []

def sigmoid(z):
    return 1 / (1 + np.exp(-np.clip(z, -250, 250)))

for i in range(iterations):
    # Linear model
    linear_model = np.dot(X, weights) + bias
    # Predictions
    y_predicted = sigmoid(linear_model)
    
    # Track metrics every 100 iterations
    if i % 100 == 0 or i == iterations - 1:
        # Cross-Entropy Loss
        # add tiny epsilon to prevent log(0)
        epsilon = 1e-9
        loss = -np.mean(y * np.log(y_predicted + epsilon) + (1 - y) * np.log(1 - y_predicted + epsilon))
        loss_history.append(loss)
        
        # Accuracy
        preds_binary = [1 if p >= 0.5 else 0 for p in y_predicted]
        acc = np.mean(preds_binary == y)
        acc_history.append(acc * 100)
    
    # Gradients
    dw = (1 / n_samples) * np.dot(X.T, (y_predicted - y))
    db = (1 / n_samples) * np.sum(y_predicted - y)
    
    # Update parameters
    weights -= learning_rate * dw
    bias -= learning_rate * db


# Plot Training Process
plt.figure(figsize=(10, 6))
plt.style.use('dark_background')

iters_x = np.arange(0, iterations, 100)
if len(iters_x) < len(loss_history):
    iters_x = np.append(iters_x, iterations)

ax1 = plt.gca()
ax2 = ax1.twinx()

line1 = ax1.plot(iters_x, loss_history, color='cyan', label='Training Loss (Error)', linewidth=2.5)
line2 = ax2.plot(iters_x, acc_history, color='springgreen', label='Training Accuracy %', linewidth=2.5, linestyle='--')

ax1.set_xlabel('Training Iterations (Epochs)', fontsize=12)
ax1.set_ylabel('Cross-Entropy Loss (Lower is Better)', color='cyan', fontsize=12)
ax2.set_ylabel('Accuracy % (Higher is Better)', color='springgreen', fontsize=12)

ax1.tick_params(axis='y', colors='cyan')
ax2.tick_params(axis='y', colors='springgreen')
ax2.set_ylim(0, 105)

plt.title('AI Model Training Process (Gradient Descent)', fontsize=15, color='white')

# Combine legends
lines = line1 + line2
labels_lgd = [l.get_label() for l in lines]
ax1.legend(lines, labels_lgd, loc='center right')

plt.grid(color='#333333', linestyle='--', linewidth=0.5)
plt.tight_layout()
plt.savefig(os.path.join(artifact_dir, 'training_process.png'), dpi=300)
plt.close()

print("Training process graph successfully generated and saved to artifacts directory.")
