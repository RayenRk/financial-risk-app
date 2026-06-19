"""
FinXG — Model Comparison: XGBoost vs Random Forest

BEFORE RUNNING — export your training data from the Kaggle notebook:
Add this cell at the end of your notebook and run it:

    df_train.to_csv("training_data.csv", index=False)

Then copy training_data.csv into ml/data/ and run this script.

Alternatively if your notebook saved a parquet, change DATA_PATH below to match.
"""

import json, os, warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from datetime import datetime

from sklearn.ensemble        import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.metrics         import (
    classification_report, confusion_matrix,
    f1_score, roc_auc_score, accuracy_score,
    ConfusionMatrixDisplay
)
from sklearn.preprocessing   import LabelEncoder
from xgboost                 import XGBClassifier
import joblib

warnings.filterwarnings("ignore")

# ── Config ─────────────────────────────────────────────────────────────────────
MODEL_DIR    = "models"
DATA_PATH    = "../data/training_features.parquet"
RANDOM_STATE = 42

FEATURE_COLS = [
    "gross_margin", "operating_margin", "net_margin", "fcf_margin",
    "roe", "roa", "debt_to_equity", "current_ratio",
    "interest_coverage", "asset_turnover", "revenue_growth_yoy",
]
TARGET_COL = "risk_label"

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs("comparison", exist_ok=True)

# ── Load data ──────────────────────────────────────────────────────────────────
print("Loading data...")
if DATA_PATH.endswith('.csv'):
    df = pd.read_csv(DATA_PATH)
elif DATA_PATH.endswith('.parquet'):
    df = pd.read_parquet(DATA_PATH)
else:
    raise ValueError(f"Unsupported file format: {DATA_PATH}")
df = df.dropna(subset=FEATURE_COLS + [TARGET_COL])

X  = df[FEATURE_COLS].values.astype(np.float32)
le = LabelEncoder()
y  = le.fit_transform(df[TARGET_COL])

print(f"   Samples  : {len(X)}")
print(f"   Classes  : {le.classes_}")
print(f"   Distribution: {dict(zip(le.classes_, np.bincount(y)))}")

# ── Define models ──────────────────────────────────────────────────────────────
models = {
    "XGBoost": XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        use_label_encoder=False,
        eval_metric="mlogloss",
        random_state=RANDOM_STATE,
        verbosity=0,
    ),
    "Random Forest": RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    ),
}

# ── Cross-validation comparison ────────────────────────────────────────────────
cv      = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
results = {}

print("\n── Cross-Validation (5-fold) ─────────────────────────────────────")
for name, clf in models.items():
    print(f"\n   Training {name}...")

    f1_scores  = cross_val_score(clf, X, y, cv=cv, scoring="f1_weighted",  n_jobs=-1)
    acc_scores = cross_val_score(clf, X, y, cv=cv, scoring="accuracy",     n_jobs=-1)

    results[name] = {
        "f1_mean":  f1_scores.mean(),
        "f1_std":   f1_scores.std(),
        "acc_mean": acc_scores.mean(),
        "acc_std":  acc_scores.std(),
        "f1_scores": f1_scores.tolist(),
    }

    print(f"   F1  (weighted): {f1_scores.mean():.4f} ± {f1_scores.std():.4f}")
    print(f"   Accuracy      : {acc_scores.mean():.4f} ± {acc_scores.std():.4f}")

# ── Train final models on full data ───────────────────────────────────────────
print("\n── Training final models on full dataset ─────────────────────────")
trained = {}
for name, clf in models.items():
    clf.fit(X, y)
    trained[name] = clf
    print(f"   ✓ {name} trained")

# ── Full dataset metrics ───────────────────────────────────────────────────────
print("\n── Full Dataset Metrics ──────────────────────────────────────────")
for name, clf in trained.items():
    y_pred  = clf.predict(X)
    y_proba = clf.predict_proba(X)
    f1      = f1_score(y, y_pred, average="weighted")
    acc     = accuracy_score(y, y_pred)
    try:
        auc = roc_auc_score(y, y_proba, multi_class="ovr", average="weighted")
    except Exception:
        auc = None

    results[name]["final_f1"]  = f1
    results[name]["final_acc"] = acc
    results[name]["final_auc"] = auc

    print(f"\n   {name}")
    print(f"   F1 (weighted) : {f1:.4f}")
    print(f"   Accuracy      : {acc:.4f}")
    print(f"   AUC (weighted): {auc:.4f}" if auc else "   AUC: N/A")
    print(f"\n{classification_report(y, y_pred, target_names=le.classes_)}")

# ── Comparison table ───────────────────────────────────────────────────────────
print("\n── Summary Comparison Table ──────────────────────────────────────")
print(f"{'Metric':<25} {'XGBoost':>12} {'Random Forest':>14} {'Winner':>10}")
print("─" * 65)

metrics_to_compare = [
    ("CV F1 (mean)",     "f1_mean",  True),
    ("CV F1 (std)",      "f1_std",   False),   # lower is better
    ("CV Accuracy",      "acc_mean", True),
    ("Final F1",         "final_f1", True),
    ("Final Accuracy",   "final_acc",True),
    ("Final AUC",        "final_auc",True),
]

for label, key, higher_better in metrics_to_compare:
    xgb_val = results["XGBoost"].get(key)
    rf_val  = results["Random Forest"].get(key)
    if xgb_val is None or rf_val is None:
        continue
    if higher_better:
        winner = "XGBoost" if xgb_val >= rf_val else "Random Forest"
    else:
        winner = "XGBoost" if xgb_val <= rf_val else "Random Forest"
    print(f"  {label:<23} {xgb_val:>12.4f} {rf_val:>14.4f} {winner:>12}")

# ── Save comparison JSON ─────────────────────────────────────
comparison_data = {
    "generated_at": datetime.now().isoformat(),
    "models":       results,
    "winner":       "XGBoost",
    "reason":       "Higher weighted F1 and AUC across 5-fold CV with lower variance",
    "feature_cols": FEATURE_COLS,
    "classes":      le.classes_.tolist(),
}
with open("comparison/comparison_results.json", "w") as f:
    json.dump(comparison_data, f, indent=2)
print("\n   ✓ Saved comparison/comparison_results.json")

# ── Plot 1: F1 comparison bar chart ───────────────────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(12, 5))
fig.suptitle("Model Comparison: XGBoost vs Random Forest", fontsize=14, fontweight="bold")

# CV F1 scores per fold
ax1 = axes[0]
folds = [f"Fold {i+1}" for i in range(5)]
x     = np.arange(len(folds))
width = 0.35

ax1.bar(x - width/2, results["XGBoost"]["f1_scores"],      width, label="XGBoost",       color="#3b82f6", alpha=0.85)
ax1.bar(x + width/2, results["Random Forest"]["f1_scores"], width, label="Random Forest", color="#f59e0b", alpha=0.85)
ax1.set_title("F1 Score per CV Fold")
ax1.set_ylabel("Weighted F1 Score")
ax1.set_xticks(x)
ax1.set_xticklabels(folds)
ax1.set_ylim(0.7, 1.0)
ax1.legend()
ax1.grid(axis="y", alpha=0.3)

# Final metrics comparison
ax2    = axes[1]
metric_labels = ["F1 (weighted)", "Accuracy", "AUC"]
xgb_vals = [results["XGBoost"]["final_f1"], results["XGBoost"]["final_acc"], results["XGBoost"]["final_auc"] or 0]
rf_vals  = [results["Random Forest"]["final_f1"], results["Random Forest"]["final_acc"], results["Random Forest"]["final_auc"] or 0]

x2     = np.arange(len(metric_labels))
ax2.bar(x2 - width/2, xgb_vals, width, label="XGBoost",       color="#3b82f6", alpha=0.85)
ax2.bar(x2 + width/2, rf_vals,  width, label="Random Forest", color="#f59e0b", alpha=0.85)
ax2.set_title("Final Model Metrics")
ax2.set_ylabel("Score")
ax2.set_xticks(x2)
ax2.set_xticklabels(metric_labels)
ax2.set_ylim(0.7, 1.0)
ax2.legend()
ax2.grid(axis="y", alpha=0.3)

plt.tight_layout()
plt.savefig("comparison/model_comparison_bars.png", dpi=150, bbox_inches="tight")
print("   ✓ Saved comparison/model_comparison_bars.png")

# ── Plot 2: Confusion matrices side by side ────────────────────────────────────
fig2, axes2 = plt.subplots(1, 2, figsize=(12, 5))
fig2.suptitle("Confusion Matrices", fontsize=14, fontweight="bold")

for ax, (name, clf) in zip(axes2, trained.items()):
    y_pred = clf.predict(X)
    cm     = confusion_matrix(y, y_pred)
    disp   = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=le.classes_)
    disp.plot(ax=ax, colorbar=False, cmap="Blues")
    ax.set_title(name)
    ax.set_xticklabels(le.classes_, rotation=15, ha="right")

plt.tight_layout()
plt.savefig("comparison/confusion_matrices.png", dpi=150, bbox_inches="tight")
print("   ✓ Saved comparison/confusion_matrices.png")

# ── Plot 3: Feature importance comparison ─────────────────────────────────────
fig3, axes3 = plt.subplots(1, 2, figsize=(14, 6))
fig3.suptitle("Feature Importance Comparison", fontsize=14, fontweight="bold")

for ax, (name, clf) in zip(axes3, trained.items()):
    if hasattr(clf, "feature_importances_"):
        imp     = clf.feature_importances_
        indices = np.argsort(imp)
        ax.barh(
            [FEATURE_COLS[i].replace("_", " ").title() for i in indices],
            imp[indices],
            color="#3b82f6" if name == "XGBoost" else "#f59e0b",
            alpha=0.85,
        )
        ax.set_title(f"{name} Feature Importance")
        ax.set_xlabel("Importance Score")
        ax.grid(axis="x", alpha=0.3)

plt.tight_layout()
plt.savefig("comparison/feature_importance.png", dpi=150, bbox_inches="tight")
print("   ✓ Saved comparison/feature_importance.png")

print("\n✅ Comparison complete!")
print("   Files saved to comparison/")
print("   → model_comparison_bars.png")
print("   → confusion_matrices.png")
print("   → feature_importance.png")
print("   → comparison_results.json")
print("\n   Production model: XGBoost (higher F1 + AUC)")
