"""Dataset preparation and chronological ML training for Dengue Watch BD."""
from pathlib import Path
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / 'data' / 'bangladesh_dengue.csv'
MODEL_PATH = ROOT / 'models' / 'dengue_models.joblib'
REQUIRED = [
    'date','city','ward_id','population_density_sqkm','water_logging_risk_index',
    'sanitation_score','avg_temp_c','max_temp_c','min_temp_c','rainfall_mm',
    'relative_humidity_pct','dengue_cases'
]
FEATURES = [
    'population_density_sqkm','water_logging_risk_index','sanitation_score',
    'avg_temp_c','max_temp_c','min_temp_c','rainfall_mm','relative_humidity_pct',
    'rainfall_lag_1w','rainfall_lag_2w','rainfall_lag_3w','rainfall_lag_4w',
    'rainfall_sum_2w','rainfall_sum_4w','avg_temp_mean_2w','avg_temp_mean_4w',
    'humidity_mean_2w','humidity_mean_4w',
    'cases_lag_1w','cases_lag_2w','cases_lag_3w','cases_lag_4w','cases_mean_4w'
]


def load_dataset(path=DATA_PATH):
    if not Path(path).exists():
        raise FileNotFoundError(f'Dataset not found: {path}. Put bangladesh_dengue.csv in the data folder.')
    df = pd.read_csv(path)
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise ValueError('Dataset is missing required columns: ' + ', '.join(missing))
    df = df[REQUIRED].copy()
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    numeric = [c for c in REQUIRED if c not in ('date','city','ward_id')]
    for col in numeric:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df = df.dropna(subset=['date','city','ward_id'] + numeric)
    df['city'] = df['city'].astype(str).str.strip()
    df['ward_id'] = df['ward_id'].astype(str).str.strip()
    df = df.sort_values(['city','ward_id','date']).drop_duplicates(['city','ward_id','date'])
    return df.reset_index(drop=True)


def add_features(df):
    out = df.sort_values(['city','ward_id','date']).copy()
    group = out.groupby(['city','ward_id'], sort=False)
    for lag in range(1,5):
        out[f'rainfall_lag_{lag}w'] = group['rainfall_mm'].shift(lag)
        out[f'cases_lag_{lag}w'] = group['dengue_cases'].shift(lag)
    for window in (2,4):
        out[f'rainfall_sum_{window}w'] = group['rainfall_mm'].transform(lambda s: s.rolling(window, min_periods=1).sum())
        out[f'avg_temp_mean_{window}w'] = group['avg_temp_c'].transform(lambda s: s.rolling(window, min_periods=1).mean())
        out[f'humidity_mean_{window}w'] = group['relative_humidity_pct'].transform(lambda s: s.rolling(window, min_periods=1).mean())
    out['cases_mean_4w'] = group['dengue_cases'].transform(lambda s: s.rolling(4, min_periods=1).mean())
    return out


def train_models(df):
    featured = add_features(df)
    # Early rows without full lag history are retained with zero-filled lag values;
    # rolling windows are calculated only from observations available at that date.
    featured[FEATURES] = featured[FEATURES].replace([np.inf,-np.inf], np.nan).fillna(0)
    unique_dates = np.sort(featured['date'].unique())
    cutoff = unique_dates[max(1, int(len(unique_dates) * 0.80))]
    models, metrics, thresholds = {}, {}, {}
    for horizon in (2,4):
        target = featured.groupby(['city','ward_id'], sort=False)['dengue_cases'].shift(-horizon)
        valid = target.notna()
        target_date = featured.groupby(['city','ward_id'], sort=False)['date'].shift(-horizon)
        # Keep every training target strictly before the validation boundary.
        train_mask = valid & (featured['date'] < cutoff) & (target_date < cutoff)
        test_mask = valid & (featured['date'] >= cutoff)
        X_train = featured.loc[train_mask, FEATURES]
        y_train = target.loc[train_mask].clip(lower=0)
        X_test = featured.loc[test_mask, FEATURES]
        y_test = target.loc[test_mask].clip(lower=0)
        model = HistGradientBoostingRegressor(
            max_iter=140, learning_rate=0.07, max_leaf_nodes=17,
            l2_regularization=2.0, random_state=42, early_stopping=True
        )
        model.fit(X_train, np.log1p(y_train))
        pred = np.maximum(0, np.expm1(model.predict(X_test)))
        metrics[str(horizon)] = {
            'mae': round(float(mean_absolute_error(y_test, pred)), 3),
            'rmse': round(float(np.sqrt(mean_squared_error(y_test, pred))), 3),
            'train_rows': int(len(X_train)), 'test_rows': int(len(X_test)),
            'validation_start': pd.Timestamp(featured.loc[test_mask, 'date'].min()).strftime('%Y-%m-%d')
        }
        # Ward population counts/areas are not supplied, so risk tiers use predicted
        # weekly case counts (not a misleading per-capita rate).
        q = np.quantile(y_train.to_numpy(), [0.60,0.80,0.95])
        # Minimum spacing keeps tiers distinguishable in sparse periods.
        q = np.maximum.accumulate(np.maximum(q, [0.5,1.5,3.0]))
        thresholds[str(horizon)] = [float(x) for x in q]
        models[str(horizon)] = model
    bundle = {
        'models': models, 'features': FEATURES, 'metrics': metrics,
        'thresholds': thresholds, 'trained_at': pd.Timestamp.utcnow().isoformat(),
        'data_start': df['date'].min().strftime('%Y-%m-%d'),
        'data_end': df['date'].max().strftime('%Y-%m-%d'),
        'rows': int(len(df)), 'wards': int(df['ward_id'].nunique())
    }
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, MODEL_PATH, compress=3)
    return bundle


def prepare_runtime():
    df = load_dataset()
    featured = add_features(df)
    featured[FEATURES] = featured[FEATURES].replace([np.inf,-np.inf], np.nan).fillna(0)
    if MODEL_PATH.exists():
        try:
            bundle = joblib.load(MODEL_PATH)
            if bundle.get('rows') != len(df) or bundle.get('data_end') != df['date'].max().strftime('%Y-%m-%d'):
                bundle = train_models(df)
        except Exception:
            bundle = train_models(df)
    else:
        bundle = train_models(df)
    return df, featured, bundle
