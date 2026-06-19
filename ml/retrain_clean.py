"""
Trains XGBoost vs Random Forest.

"""

import json, os, warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from datetime import datetime

from sklearn.ensemble        import RandomForestClassifier
from sklearn.model_selection import GroupKFold
from sklearn.metrics         import (
    classification_report, confusion_matrix,
    f1_score, roc_auc_score, accuracy_score,
    ConfusionMatrixDisplay
)
from sklearn.preprocessing   import LabelEncoder
from sklearn.utils           import resample
from xgboost                 import XGBClassifier
import joblib

warnings.filterwarnings("ignore")

MODEL_DIR    = "models"
RANDOM_STATE = 42
os.makedirs("comparison", exist_ok=True)
os.makedirs(MODEL_DIR,    exist_ok=True)

FEATURE_COLS = [
    "gross_margin", "operating_margin", "net_margin", "fcf_margin",
    "roe", "roa", "debt_to_equity", "current_ratio",
    "interest_coverage", "asset_turnover", "revenue_growth_yoy",
]
TARGET_COL = "risk_label"

# ── Load raw data ──────────────────────────────────────────────────
print("Loading raw data...")
df = pd.read_parquet("../data/training_features.parquet")
print(f"   Original shape : {df.shape}")
print(f"   Original labels: {df[TARGET_COL].value_counts().to_dict()}")

# ── Exclude primary company from training ───────────────────
print("\n── Excluding primary company from training set...")
before_rows = len(df)
df = df[df["ticker"] != "EPAM"].copy()
print(f"   Removed {before_rows - len(df)} rows (EPAM) — "
      f"{len(df)} rows remaining across "
      f"{df['ticker'].nunique()} companies")

# ── Fix 1: revenue_growth_yoy ──────────────────────────────────────
print("\n── Cleaning revenue_growth_yoy...")
before = df["revenue_growth_yoy"].isna().sum()
df["revenue_growth_yoy"] = df.groupby("ticker")["revenue_growth_yoy"].transform(
    lambda x: x.fillna(x.median())
)
df["revenue_growth_yoy"] = df.groupby("sector")["revenue_growth_yoy"].transform(
    lambda x: x.fillna(x.median())
)
df["revenue_growth_yoy"] = df["revenue_growth_yoy"].fillna(df["revenue_growth_yoy"].median())
print(f"   Missing: {before} → {df['revenue_growth_yoy'].isna().sum()}")

# ── Fix 2: interest_coverage ───────────────────────────────────────
print("\n── Fixing interest_coverage clipping...")
df["interest_coverage"] = df["interest_coverage"].clip(-20, 20)
print(f"   Clipped to [-20, 20]")

# ── Fix 3: debt_to_equity outliers ────────────────────────────────
print("\n── Fixing debt_to_equity outliers...")
p99 = df["debt_to_equity"].quantile(0.99)
df["debt_to_equity"] = df["debt_to_equity"].clip(0, p99)
print(f"   Clipped at 99th percentile: {p99:.2f}")

# ── Fix 4: remaining missing values ────────────────────────────────
print("\n── Filling remaining missing values...")
for col in FEATURE_COLS:
    n = df[col].isna().sum()
    if n > 0:
        df[col] = df.groupby("ticker")[col].transform(
            lambda x: x.fillna(x.median())
        )
        df[col] = df[col].fillna(df[col].median())
        print(f"   {col}: filled {n} missing values")

print(f"\n   Dataset after cleaning: {df.shape[0]} rows, "
      f"{df['ticker'].nunique()} companies")
print(f"   Label distribution: {df[TARGET_COL].value_counts().to_dict()}")

# ── Encode labels ──────────────────────────────────────────────────
le = LabelEncoder()
df["_label"] = le.fit_transform(df[TARGET_COL])
print(f"\n   Classes: {le.classes_}")

# ── GroupKFold cross-validation ────────────────────────────────────
print("\n── Cross-Validation (5-fold GroupKFold by ticker) ───────────")

groups = df["ticker"].values
X_full = df[FEATURE_COLS].values.astype(np.float32)
y_full = df["_label"].values

gkf = GroupKFold(n_splits=5)

models_cfg = {
    "XGBoost": XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=2,
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
        class_weight="balanced",
        random_state=RANDOM_STATE,
        n_jobs=-1,
    ),
}

results = {name: {"f1_scores": [], "acc_scores": []} for name in models_cfg}

# Accumulate OOF predictions for confusion matrices
oof_preds  = {name: np.full(len(y_full), -1, dtype=int) for name in models_cfg}
oof_proба  = {name: np.zeros((len(y_full), len(le.classes_)))  for name in models_cfg}


def balance_fold(X_tr, y_tr, random_state=RANDOM_STATE):
    """Oversample minority, undersample majority — on training fold only."""
    df_tr = pd.DataFrame(X_tr, columns=FEATURE_COLS)
    df_tr["_label"] = y_tr
    counts   = df_tr["_label"].value_counts()
    target_n = int(counts.median())
    parts    = []
    for cls, grp in df_tr.groupby("_label"):
        if len(grp) < target_n:
            grp = resample(grp, replace=True,  n_samples=target_n,    random_state=random_state)
        elif len(grp) > target_n * 2:
            grp = resample(grp, replace=False, n_samples=target_n * 2, random_state=random_state)
        parts.append(grp)
    df_bal = pd.concat(parts).sample(frac=1, random_state=random_state).reset_index(drop=True)
    return df_bal[FEATURE_COLS].values.astype(np.float32), df_bal["_label"].values


for fold_idx, (train_idx, val_idx) in enumerate(gkf.split(X_full, y_full, groups)):
    X_tr_raw, y_tr_raw = X_full[train_idx], y_full[train_idx]
    X_val,    y_val    = X_full[val_idx],   y_full[val_idx]
    X_tr, y_tr         = balance_fold(X_tr_raw, y_tr_raw)

    train_co = len(np.unique(groups[train_idx]))
    val_co   = len(np.unique(groups[val_idx]))
    print(f"\n   Fold {fold_idx + 1}: "
          f"train={train_co} companies ({len(X_tr)} rows after balance), "
          f"val={val_co} companies ({len(X_val)} rows)")

    for name, clf in models_cfg.items():
        clf_clone = clf.__class__(**clf.get_params())
        clf_clone.fit(X_tr, y_tr)
        y_pred = clf_clone.predict(X_val)
        y_prob = clf_clone.predict_proba(X_val)

        # Store OOF predictions
        oof_preds[name][val_idx] = y_pred
        oof_proба[name][val_idx] = y_prob

        f1  = f1_score(y_val, y_pred, average="weighted", zero_division=0)
        acc = accuracy_score(y_val, y_pred)
        results[name]["f1_scores"].append(f1)
        results[name]["acc_scores"].append(acc)
        print(f"      {name:<15} F1={f1:.4f}  Acc={acc:.4f}")

# Summarise CV results
print("\n── Cross-Validation Summary ──────────────────────────────────")
for name in models_cfg:
    f1_arr  = np.array(results[name]["f1_scores"])
    acc_arr = np.array(results[name]["acc_scores"])
    results[name]["f1_mean"]  = float(f1_arr.mean())
    results[name]["f1_std"]   = float(f1_arr.std())
    results[name]["acc_mean"] = float(acc_arr.mean())
    results[name]["acc_std"]  = float(acc_arr.std())

    # OOF AUC (honest — computed on held-out data)
    oof_auc = roc_auc_score(
        y_full, oof_proба[name], multi_class="ovr", average="weighted"
    )
    results[name]["oof_auc"] = float(oof_auc)

    print(f"\n   {name}")
    print(f"   F1  (weighted): {f1_arr.mean():.4f} ± {f1_arr.std():.4f}")
    print(f"   Accuracy      : {acc_arr.mean():.4f} ± {acc_arr.std():.4f}")
    print(f"   OOF AUC       : {oof_auc:.4f}")
    print(f"\n   OOF Classification Report:")
    print(classification_report(y_full, oof_preds[name], target_names=le.classes_))

# ── Train final models on full balanced dataset ────────────────────
print("\n── Training final models on full dataset ─────────────────────")
X_bal, y_bal = balance_fold(X_full, y_full)
print(f"   Balanced dataset: {len(X_bal)} rows")

trained = {}
for name, clf in models_cfg.items():
    clf.fit(X_bal, y_bal)
    trained[name] = clf
    y_pred  = clf.predict(X_bal)
    y_proba = clf.predict_proba(X_bal)
    f1      = f1_score(y_bal, y_pred, average="weighted")
    acc     = accuracy_score(y_bal, y_pred)
    auc     = roc_auc_score(y_bal, y_proba, multi_class="ovr", average="weighted")
    results[name]["final_f1"]  = float(f1)
    results[name]["final_acc"] = float(acc)
    results[name]["final_auc"] = float(auc)
    print(f"\n   {name} — F1: {f1:.4f} | Acc: {acc:.4f} | AUC: {auc:.4f}")

# ── Save production XGBoost model ─────────────────────────────────
bundle = {
    "model":         trained["XGBoost"],
    "label_encoder": le,
    "features":      FEATURE_COLS,
    "classes":       le.classes_.tolist(),
}
joblib.dump(bundle, f"{MODEL_DIR}/risk_model.pkl")

total_val_rows = sum(
    len(y_full[val_idx])
    for _, val_idx in GroupKFold(n_splits=5).split(X_full, y_full, groups)
)
meta = {
    "trained_at":       datetime.now().isoformat(),
    "model_type":       "XGBoost",
    "n_companies":      int(df["ticker"].nunique()),
    "n_samples_raw":    int(len(df)),
    "excluded_tickers": ["EPAM"],
    "feature_cols":     FEATURE_COLS,
    "classes":          le.classes_.tolist(),
    "metrics": {
        "weighted_f1":  results["XGBoost"]["f1_mean"],
        "weighted_auc": results["XGBoost"]["oof_auc"],
        "test_rows":    total_val_rows,
    },
    "cv": {
        "strategy": "GroupKFold(n_splits=5, groups=ticker)",
        "f1_mean":  results["XGBoost"]["f1_mean"],
        "f1_std":   results["XGBoost"]["f1_std"],
        "acc_mean": results["XGBoost"]["acc_mean"],
    },
}
with open(f"{MODEL_DIR}/model_meta.json", "w") as f:
    json.dump(meta, f, indent=2)

print(f"\n   ✓ Saved {MODEL_DIR}/risk_model.pkl")
print(f"   ✓ Saved {MODEL_DIR}/model_meta.json")

# ── Summary table ──────────────────────────────────────────────────
print("\n── Summary Comparison ────────────────────────────────────────")
print(f"{'Metric':<22} {'XGBoost':>12} {'Random Forest':>14} {'Winner':>12}")
print("─" * 63)
for label, key, higher in [
    ("CV F1 (mean)",   "f1_mean",  True),
    ("CV F1 (std)",    "f1_std",   False),
    ("CV Accuracy",    "acc_mean", True),
    ("OOF AUC",        "oof_auc",  True),
]:
    xv = results["XGBoost"].get(key, 0)
    rv = results["Random Forest"].get(key, 0)
    w  = "XGBoost" if (xv >= rv) == higher else "Random Forest"
    print(f"  {label:<20} {xv:>12.4f} {rv:>14.4f} {w:>13}")

# ═══════════════════════════════════════════════════════════════════
# CHART 1 — CV F1 per fold (both models, side by side bars)
# ═══════════════════════════════════════════════════════════════════
fig1, ax1 = plt.subplots(figsize=(10, 5))
folds = [f"Fold {i+1}" for i in range(5)]
x     = np.arange(5)
w     = 0.35

bars1 = ax1.bar(x - w/2, results["XGBoost"]["f1_scores"],
                w, label="XGBoost", color="#2563eb", alpha=0.85)
bars2 = ax1.bar(x + w/2, results["Random Forest"]["f1_scores"],
                w, label="Random Forest", color="#d97706", alpha=0.85)

# Value labels on bars
for bar in bars1:
    ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.005,
             f"{bar.get_height():.3f}", ha="center", va="bottom", fontsize=9)
for bar in bars2:
    ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.005,
             f"{bar.get_height():.3f}", ha="center", va="bottom", fontsize=9)

ax1.axhline(results["XGBoost"]["f1_mean"],       color="#2563eb", linestyle="--",
            linewidth=1, alpha=0.6,
            label=f"XGBoost mean ({results['XGBoost']['f1_mean']:.3f})")
ax1.axhline(results["Random Forest"]["f1_mean"], color="#d97706", linestyle="--",
            linewidth=1, alpha=0.6,
            label=f"RF mean ({results['Random Forest']['f1_mean']:.3f})")

ax1.set_title("CV F1-Score par pli — XGBoost vs Random Forest\n(GroupKFold 5 plis, groupes = ticker)",
              fontsize=12, fontweight="bold")
ax1.set_ylabel("F1-Score pondéré")
ax1.set_xlabel("Pli de validation")
ax1.set_xticks(x)
ax1.set_xticklabels(folds)
ax1.set_ylim(0.75, 1.05)
ax1.legend(loc="lower right")
ax1.grid(axis="y", alpha=0.3)
plt.tight_layout()
plt.savefig("comparison/chart1_cv_f1_per_fold.png", dpi=150, bbox_inches="tight")
print("\n   ✓ Saved comparison/chart1_cv_f1_per_fold.png")
plt.close()

# ═══════════════════════════════════════════════════════════════════
# CHART 2 — OOF Confusion matrices side by side (honest evaluation)
# ═══════════════════════════════════════════════════════════════════
fig2, axes2 = plt.subplots(1, 2, figsize=(13, 5))
fig2.suptitle("Matrices de confusion OOF — XGBoost vs Random Forest\n"
              "(Out-of-Fold : évaluation sur données jamais vues à l'entraînement)",
              fontsize=12, fontweight="bold")

for ax, name in zip(axes2, ["XGBoost", "Random Forest"]):
    cm   = confusion_matrix(y_full, oof_preds[name])
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=le.classes_)
    disp.plot(ax=ax, colorbar=False, cmap="Blues")
    f1_mean = results[name]["f1_mean"]
    auc_val = results[name]["oof_auc"]
    ax.set_title(f"{name}\nCV F1 = {f1_mean:.3f}  |  OOF AUC = {auc_val:.3f}",
                 fontsize=11, fontweight="bold")
    ax.set_xlabel("Classe prédite")
    ax.set_ylabel("Classe réelle")
    ax.set_xticklabels(le.classes_, rotation=15, ha="right")

plt.tight_layout()
plt.savefig("comparison/chart2_confusion_matrices.png", dpi=150, bbox_inches="tight")
print("   ✓ Saved comparison/chart2_confusion_matrices.png")
plt.close()

# ═══════════════════════════════════════════════════════════════════
# CHART 3 — CV metrics comparison bar chart
# ═══════════════════════════════════════════════════════════════════
fig3, ax3 = plt.subplots(figsize=(9, 5))

metric_labels = ["CV F1\n(mean)", "CV Accuracy\n(mean)", "OOF AUC"]
xgb_vals = [
    results["XGBoost"]["f1_mean"],
    results["XGBoost"]["acc_mean"],
    results["XGBoost"]["oof_auc"],
]
rf_vals = [
    results["Random Forest"]["f1_mean"],
    results["Random Forest"]["acc_mean"],
    results["Random Forest"]["oof_auc"],
]

x3 = np.arange(len(metric_labels))
b1 = ax3.bar(x3 - w/2, xgb_vals, w, label="XGBoost",       color="#2563eb", alpha=0.85)
b2 = ax3.bar(x3 + w/2, rf_vals,  w, label="Random Forest", color="#d97706", alpha=0.85)

for bar in b1:
    ax3.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.003,
             f"{bar.get_height():.3f}", ha="center", va="bottom", fontsize=10,
             fontweight="bold", color="#2563eb")
for bar in b2:
    ax3.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.003,
             f"{bar.get_height():.3f}", ha="center", va="bottom", fontsize=10,
             fontweight="bold", color="#d97706")

ax3.set_title("Métriques CV honnêtes — XGBoost vs Random Forest\n"
              "(toutes métriques calculées sur données hors entraînement)",
              fontsize=12, fontweight="bold")
ax3.set_ylabel("Score")
ax3.set_xticks(x3)
ax3.set_xticklabels(metric_labels)
ax3.set_ylim(0.80, 1.02)
ax3.legend()
ax3.grid(axis="y", alpha=0.3)
plt.tight_layout()
plt.savefig("comparison/chart3_cv_metrics_comparison.png", dpi=150, bbox_inches="tight")
print("   ✓ Saved comparison/chart3_cv_metrics_comparison.png")
plt.close()

# ═══════════════════════════════════════════════════════════════════
# CHART 4 — Feature importance comparison side by side
# ═══════════════════════════════════════════════════════════════════
fig4, axes4 = plt.subplots(1, 2, figsize=(15, 6))
fig4.suptitle("Importance des variables — XGBoost vs Random Forest",
              fontsize=12, fontweight="bold")

colors = {"XGBoost": "#2563eb", "Random Forest": "#d97706"}
for ax, name in zip(axes4, ["XGBoost", "Random Forest"]):
    imp     = trained[name].feature_importances_
    indices = np.argsort(imp)
    labels  = [FEATURE_COLS[i].replace("_", " ").title() for i in indices]
    ax.barh(labels, imp[indices], color=colors[name], alpha=0.85)
    ax.set_title(name, fontsize=11, fontweight="bold")
    ax.set_xlabel("Importance")
    ax.grid(axis="x", alpha=0.3)
    for i, v in enumerate(imp[indices]):
        ax.text(v + 0.001, i, f"{v:.3f}", va="center", fontsize=9)

plt.tight_layout()
plt.savefig("comparison/chart4_feature_importance.png", dpi=150, bbox_inches="tight")
print("   ✓ Saved comparison/chart4_feature_importance.png")
plt.close()

# ── Save results JSON ──────────────────────────────────────────────
with open("comparison/comparison_clean_results.json", "w") as f:
    json.dump({
        "generated_at":     datetime.now().isoformat(),
        "cv_strategy":      "GroupKFold(n_splits=5, groups=ticker)",
        "samples_raw":      int(len(df)),
        "samples_balanced": int(len(X_bal)),
        "fixes_applied": [
            "EPAM excluded from training set",
            "GroupKFold by ticker — no company spans train and validation",
            "Balancing applied inside each fold (training split only)",
            "interest_coverage: clipped to [-20, 20]",
            "debt_to_equity: clipped at 99th percentile",
            "revenue_growth_yoy: filled with per-ticker then sector median",
        ],
        "models":  results,
        "winner":  "XGBoost",
    }, f, indent=2)
print("   ✓ Saved comparison/comparison_clean_results.json")

print("\n✅ Done — 4 charts saved to comparison/")
print("   chart1_cv_f1_per_fold.png       — F1 per fold, both models")
print("   chart2_confusion_matrices.png   — OOF confusion matrices side by side")
print("   chart3_cv_metrics_comparison.png — CV F1, Accuracy, OOF AUC comparison")
print("   chart4_feature_importance.png   — Feature importance side by side")