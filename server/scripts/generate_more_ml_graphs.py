import matplotlib.pyplot as plt
import numpy as np
from pymongo import MongoClient
import os
import sys
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_curve, auc, precision_recall_curve, average_precision_score, confusion_matrix, ConfusionMatrixDisplay

# Connect to MongoDB
client = MongoClient('mongodb://localhost:27017/')
db = client['trainflow']
dataset = list(db['mldatasets'].find({'sensorId': 'sensor2'}))

if len(dataset) == 0:
    print("No data found in mldatasets.")
    sys.exit(1)

artifact_dir = r"C:\Users\thusa\.gemini\antigravity-ide\brain\de60bb75-6cb8-454f-a773-231eccb3f9b1"

means = [d['features']['meanEnergy'] for d in dataset]
slopes = [d['features']['energySlope'] for d in dataset]
labels = [d['label'] for d in dataset]

meanMax = max(means) if max(means) > 0 else 1
slopeMax = max([abs(s) for s in slopes]) if max([abs(s) for s in slopes]) > 0 else 1

# Features: x1, x2, x1^2, x2^2, x1*x2
X = np.array([[m/meanMax, s/slopeMax, (m/meanMax)**2, (s/slopeMax)**2, (m/meanMax)*(s/slopeMax)] for m, s in zip(means, slopes)])
y = np.array(labels)

model = LogisticRegression(penalty=None, max_iter=10000)
model.fit(X, y)
y_probs = model.predict_proba(X)[:, 1]

# 5. ROC Curve
plt.figure(figsize=(8, 6))
plt.style.use('dark_background')
fpr, tpr, _ = roc_curve(y, y_probs)
roc_auc = auc(fpr, tpr)
plt.plot(fpr, tpr, color='darkorange', lw=2, label=f'ROC curve (AUC = {roc_auc:.2f})')
plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
plt.xlim([-0.05, 1.05])
plt.ylim([-0.05, 1.05])
plt.xlabel('False Positive Rate', fontsize=12)
plt.ylabel('True Positive Rate', fontsize=12)
plt.title('Receiver Operating Characteristic (ROC)', fontsize=14, color='white')
plt.legend(loc="lower right")
plt.grid(color='#333333', linestyle='--', linewidth=0.5)
plt.tight_layout()
plt.savefig(os.path.join(artifact_dir, 'roc_curve.png'), dpi=300)
plt.close()

# 6. Precision-Recall Curve
plt.figure(figsize=(8, 6))
plt.style.use('dark_background')
precision, recall, _ = precision_recall_curve(y, y_probs)
ap = average_precision_score(y, y_probs)
plt.plot(recall, precision, color='magenta', lw=2, label=f'PR curve (AP = {ap:.2f})')
plt.xlabel('Recall (Sensitivity)', fontsize=12)
plt.ylabel('Precision (Positive Predictive Value)', fontsize=12)
plt.title('Precision-Recall Curve', fontsize=14, color='white')
plt.legend(loc="lower left")
plt.grid(color='#333333', linestyle='--', linewidth=0.5)
plt.tight_layout()
plt.savefig(os.path.join(artifact_dir, 'precision_recall_curve.png'), dpi=300)
plt.close()

# 7. Feature Importance (Weights) Bar Chart
plt.figure(figsize=(9, 6))
plt.style.use('dark_background')
features = ['Mean Energy (x1)', 'Energy Slope (x2)', 'Mean Energy Squared (x1^2)', 'Slope Squared (x2^2)', 'Interaction (x1*x2)']
weights = model.coef_[0]
colors = ['springgreen' if w > 0 else 'lightcoral' for w in weights]
plt.barh(features, weights, color=colors)
plt.xlabel('Learned Weight Magnitude', fontsize=12)
plt.title('AI Feature Importance (What the AI cares about)', fontsize=14, color='white')
plt.axvline(x=0, color='white', linewidth=1)
plt.tight_layout()
plt.savefig(os.path.join(artifact_dir, 'feature_importance.png'), dpi=300)
plt.close()

# 8. Probability Distribution Histogram
plt.figure(figsize=(8, 6))
plt.style.use('dark_background')
plt.hist(y_probs[y==0], bins=10, color='cyan', alpha=0.7, label='Actual Idle', range=(0,1))
plt.hist(y_probs[y==1], bins=10, color='red', alpha=0.7, label='Actual Train', range=(0,1))
plt.axvline(x=0.5, color='white', linestyle='--', linewidth=2, label='Decision Threshold (50%)')
plt.xlabel('AI Confidence (Probability of Train)', fontsize=12)
plt.ylabel('Number of Samples', fontsize=12)
plt.title('Model Confidence Distribution', fontsize=14, color='white')
plt.legend()
plt.grid(color='#333333', linestyle='--', linewidth=0.5)
plt.tight_layout()
plt.savefig(os.path.join(artifact_dir, 'probability_distribution.png'), dpi=300)
plt.close()

# 9. 3D Loss Landscape
# To plot the loss landscape, we vary two weights while holding the others constant.
fig = plt.figure(figsize=(10, 8))
ax = fig.add_subplot(111, projection='3d')
plt.style.use('dark_background')

# Vary Mean Energy Weight (W0) and Energy Slope Weight (W1)
w0_opt = weights[0]
w1_opt = weights[1]

w0_vals = np.linspace(w0_opt - 30, w0_opt + 30, 40)
w1_vals = np.linspace(w1_opt - 30, w1_opt + 30, 40)
W0, W1 = np.meshgrid(w0_vals, w1_vals)
Loss = np.zeros_like(W0)

bias = model.intercept_[0]
w2_opt, w3_opt, w4_opt = weights[2], weights[3], weights[4]

def get_loss(w0, w1):
    z = X[:, 0]*w0 + X[:, 1]*w1 + X[:, 2]*w2_opt + X[:, 3]*w3_opt + X[:, 4]*w4_opt + bias
    z = np.clip(z, -250, 250)
    p = 1 / (1 + np.exp(-z))
    epsilon = 1e-9
    return -np.mean(y * np.log(p + epsilon) + (1 - y) * np.log(1 - p + epsilon))

for i in range(W0.shape[0]):
    for j in range(W0.shape[1]):
        Loss[i, j] = get_loss(W0[i, j], W1[i, j])

surf = ax.plot_surface(W0, W1, Loss, cmap='viridis', edgecolor='none', alpha=0.8)
# Plot the optimal point that gradient descent found
ax.scatter([w0_opt], [w1_opt], [get_loss(w0_opt, w1_opt)], color='red', s=100, label='Global Minimum Found')

ax.set_xlabel('Mean Energy Weight', color='white', fontsize=10)
ax.set_ylabel('Energy Slope Weight', color='white', fontsize=10)
ax.set_zlabel('Loss (Error)', color='white', fontsize=10)
plt.title('3D Gradient Descent Loss Landscape', fontsize=14, color='white')
ax.legend()
plt.tight_layout()
plt.savefig(os.path.join(artifact_dir, 'loss_landscape.png'), dpi=300)
plt.close()

# 10. Confusion Matrix
y_pred = model.predict(X)
cm = confusion_matrix(y, y_pred)
disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=['Idle', 'Train'])
fig, ax = plt.subplots(figsize=(8, 6))
plt.style.use('dark_background')
disp.plot(ax=ax, cmap='Blues', colorbar=False)
plt.title('Confusion Matrix', fontsize=14, color='white')
plt.tight_layout()
plt.savefig(os.path.join(artifact_dir, 'confusion_matrix.png'), dpi=300)
plt.close()

print("Remaining ML graphs successfully generated!")
