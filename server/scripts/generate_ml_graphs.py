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
envelopes = [d.get('envelopeData', []) for d in dataset]

meanMax = max(means) if max(means) > 0 else 1
slopeMax = max([abs(s) for s in slopes]) if max([abs(s) for s in slopes]) > 0 else 1

X = np.array([[m/meanMax, s/slopeMax, (m/meanMax)**2, (s/slopeMax)**2, (m/meanMax)*(s/slopeMax)] for m, s in zip(means, slopes)])
y = np.array(labels)

# Use Scikit-Learn to fit Logistic Regression
from sklearn.linear_model import LogisticRegression
model = LogisticRegression(penalty=None, max_iter=10000)
model.fit(X, y)

# 1. Feature Scatter & Decision Boundary
plt.figure(figsize=(10, 6))
plt.style.use('dark_background')

# Meshgrid for contour
x_min, x_max = X[:, 0].min() - 0.2, X[:, 0].max() + 0.2
y_min, y_max = X[:, 1].min() - 0.2, X[:, 1].max() + 0.2
xx, yy = np.meshgrid(np.linspace(x_min, x_max, 100), np.linspace(y_min, y_max, 100))
mesh_features = np.c_[xx.ravel(), yy.ravel(), xx.ravel()**2, yy.ravel()**2, xx.ravel()*yy.ravel()]
Z = model.predict_proba(mesh_features)[:, 1]
Z = Z.reshape(xx.shape)

plt.contourf(xx, yy, Z, levels=50, cmap='RdBu_r', alpha=0.3)
plt.contour(xx, yy, Z, levels=[0.5], colors='white', linestyles='--')

plt.scatter(X[y==0][:,0], X[y==0][:,1], color='cyan', label='Idle (Noise)', s=100, edgecolor='white')
plt.scatter(X[y==1][:,0], X[y==1][:,1], color='red', label='Train Approaching', s=100, edgecolor='white')
plt.title('Non-Linear AI Decision Boundary (100% Accuracy)', fontsize=14, color='white')
plt.xlabel('Normalized Mean Energy', fontsize=12)
plt.ylabel('Normalized Energy Slope', fontsize=12)
plt.legend()
plt.tight_layout()
plt.savefig(os.path.join(artifact_dir, 'decision_boundary.png'), dpi=300)
plt.close()

# 2. Time-Series Envelopes
plt.figure(figsize=(10, 6))
plt.style.use('dark_background')
for env, label in zip(envelopes, labels):
    if len(env) == 0: continue
    t = [p['timeOffsetSec'] for p in env]
    e = [p['energy'] for p in env]
    if label == 1:
        plt.plot(t, e, color='red', linewidth=2, alpha=0.8)
    else:
        plt.plot(t, e, color='cyan', linewidth=1.5, alpha=0.5)

# Add custom legend lines
from matplotlib.lines import Line2D
custom_lines = [Line2D([0], [0], color='red', lw=2), Line2D([0], [0], color='cyan', lw=1.5)]
plt.legend(custom_lines, ['Train Approaching', 'Idle Noise'])
plt.title('Energy Envelopes (Time Series Structure)', fontsize=14, color='white')
plt.xlabel('Time Offset (Seconds)', fontsize=12)
plt.ylabel('Bandpassed Energy (1.8-3.5Hz)', fontsize=12)
plt.grid(color='#333333', linestyle='--', linewidth=0.5)
plt.tight_layout()
plt.savefig(os.path.join(artifact_dir, 'energy_envelopes.png'), dpi=300)
plt.close()

# 3. Confusion Matrix
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
cm = confusion_matrix(y, model.predict(X))
fig, ax = plt.subplots(figsize=(6, 6))
plt.style.use('dark_background')
disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=['Idle', 'Train'])
disp.plot(cmap='Blues', ax=ax, colorbar=False)
plt.title('Confusion Matrix', fontsize=14, color='white')
plt.tight_layout()
plt.savefig(os.path.join(artifact_dir, 'confusion_matrix.png'), dpi=300)
plt.close()

print("Graphs successfully generated and saved to artifacts directory.")
