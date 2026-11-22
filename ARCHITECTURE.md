# DENGUARD AI — System Architecture & Engineering Specification

## 1. Executive Summary & Challenge Alignment
**DENGUARD AI** is an operational public-health intelligence and early-warning platform designed for the **EDU AI Engineering Hackathon 2026**. It solves the urban dengue containment dilemma in Bangladesh: when municipal spraying teams deploy larvicide reactively after hospital admissions spike, transmission chains are already weeks ahead. 

DENGUARD operationalizes the **2-to-4-week Vector Breeding Clock** by ingesting multi-week lagged rainfall, temperature, and humidity, intersecting them with hyper-local ward drainage and sanitation bottlenecks across **60 urban wards** in Chattogram, Dhaka North, Dhaka South, Gazipur, and Narayanganj.

---

## 2. End-to-End System Data Flow Architecture

```mermaid
flowchart TD
    subgraph Data Ingestion & Lag Pipeline
        CSV[bangladesh_dengue_dataset.csv\n31,320 Records · 60 Wards] --> Engine[DenguardEngine Ingestor]
        Engine --> Clean[Data Sanitization & Key Deduplication]
        Clean --> LagPipe[Grouped Multi-Week Lag Pipeline\nper City & Ward ID]
        LagPipe --> Features[Vector Feature Matrix\nLag 1w-4w Rain/Temp/RH + 2-4w Accum + Breeding Index]
    end

    subgraph Chronological Validation & Model Engine
        Features --> Split[Chronological 80/20 Date Split\nCutoff: Dec 2023 · Zero Temporal Leakage]
        Split --> TrainSet[Training Partition\n24,600 historical observations]
        Split --> ValidSet[Out-of-Time Validation Partition\n6,240 future observations]
        TrainSet --> HGB2[HistGradientBoosting 2W Model]
        TrainSet --> HGB4[HistGradientBoosting 4W Model]
        ValidSet --> Bench[Validation Benchmark Evaluation\nMAE, RMSE, Recall, Precision, R²]
        ValidSet --> CI[95% Confidence Interval Computation\nEmpirical Residual Standard Error]
        HGB2 --> Cache2[Joblib Cache: hgb_2w_*.joblib]
        HGB4 --> Cache4[Joblib Cache: hgb_4w_*.joblib]
    end

    subgraph Microservice API Layer
        Cache2 & Cache4 --> FlaskAPI[Flask REST API\nbackend/app.py]
        FlaskAPI --> Endpoints[/api/forecasts\n/api/validation-details\n/api/simulate\n/api/lag-analysis\n/api/export]
    end

    subgraph Interactive Frontend Dashboard
        Endpoints --> UI[Single-Page Web Application\nVanilla JS · Chart.js · Leaflet]
        UI --> MapView[3-Zone City Outbreak Map\nHigh/Medium/Low Catchments & Heatmap]
        UI --> PipeView[Vector Clock Lag Evidence\nr=0.813 Accumulation Peak]
        UI --> SimView[What-If Early Action Simulator\nDynamic Outbreak Recalculation]
        UI --> DiagView[Chronological Error Dashboard\nMAE/RMSE Benchmark Matrix]
    end
```

### ASCII Data Flow Architecture
```text
[Raw Dataset: 31,320 Rows] 
         │
         ▼
[Grouped Multi-Week Lag Pipeline] ───► Calculates: rain_lag_1..4w, rainfall_accum_2_4w, breeding_risk_index
         │
         ▼
[Chronological 80/20 Split] ────────► Train (< Dec 2023) | Validation (≥ Dec 2023) [Zero Temporal Leakage]
         │
         ▼
[HistGradientBoosting Regressors] ──► 2-Week & 4-Week Horizon Models + 95% Confidence Intervals
         │
         ▼
[Local Model Serialization] ────────► models/*.joblib (Sub-50ms cached inference, zero token cost)
         │
         ▼
[Flask REST Microservice] ──────────► JSON Endpoints: /api/forecasts, /api/simulate, /api/lag-analysis
         │
         ▼
[Modern Interactive Dashboard] ─────► 3-Zone City Map (High/Med/Low), Epidemic Heatmap, What-If Simulator
```

---

## 3. The Vector Breeding Clock: Biological Formulation

Traditional epidemic models fail in urban Bangladesh because they correlate same-day weather with hospital admissions. Entomological and clinical transmission of dengue requires a biological multi-step sequence:

$$\text{Total Transmission Delay} = \Delta t_{\text{breeding}} + \Delta t_{\text{EIP}} + \Delta t_{\text{intrinsic}} \approx 14 \text{ to } 28 \text{ days}$$

1. **Mosquito Maturation ($\Delta t_{\text{breeding}} = 7\text{--}14\text{ days}$):** Monsoon rainfall fills discarded plastic containers and clogged roadside drains. *Aedes aegypti* eggs hatch and progress through 4 larval instars and the pupal phase before emerging as adult biting females.
2. **Extrinsic Incubation Period ($\Delta t_{\text{EIP}} = 8\text{--}12\text{ days}$):** An adult female ingests blood from an infected human. The dengue virus must replicate within the mosquito gut and migrate to the salivary glands.
3. **Intrinsic Incubation & Symptoms ($\Delta t_{\text{intrinsic}} = 4\text{--}10\text{ days}$):** Following a bite from an infectious mosquito, human viremia develops, platelet counts decline, and patients present at hospital emergency wards.

### Mathematical Formulation of Pipeline Features:
- **Cumulative Breeding Rainfall:**
  $$\text{RainfallAccum}_{2\text{--}4\text{w}} = \text{Rainfall}_{t-2\text{w}} + \text{Rainfall}_{t-3\text{w}} + \text{Rainfall}_{t-4\text{w}}$$
- **Hyper-Local Breeding Risk Index:**
  $$\text{BreedingRiskIndex} = \left(\frac{\text{RainfallAccum}_{2\text{--}4\text{w}}}{100}\right) \times \text{WaterLoggingRiskIndex}$$
- **Vulnerability-Adjusted Risk Scoring:**
  $$\text{Score} = 100 \times \left( 0.70 \times \text{Percentile}(\widehat{Y}_{\text{pred}}) + 0.30 \times \overline{\text{Percentile}}(\text{Vulnerability}) \right)$$

---

## 4. Chronological Validation Split vs Random K-Fold

A fatal error in time-series epidemiology is using random k-fold cross-validation. Random shuffling leaks future weather observations and seasonal peaks into past predictions, producing artificially inflated metrics that fail in production.

DENGUARD enforces a strict **Chronological Holdout Split**:
- **Chronological Split Boundary:** December 2023 (80% historical origin dates).
- **Temporal Non-Leakage Rule:** Every training observation must satisfy both $\text{Date}_{\text{origin}} < \text{Split}$ and $\text{Date}_{\text{target}} < \text{Split}$.
- **Out-of-Time Validation Period:** 2024 to 2025 (6,240 completely unseen weekly observations).

### Validation Benchmarks against Zero-Prediction Baseline:
| Model Horizon | Validation MAE | Zero-Baseline MAE | MAE Error Reduction | RMSE | R² Score | Outbreak Recall ($\ge 1$) | Precision | 95% Confidence Interval |
|---|---|---|---|---|---|---|---|---|
| **2-Week Model** | **1.025** | 2.273 | **-54.9%** | 1.986 | **0.737** | **78.8%** | 94.5% | $\pm 3.89\text{ cases}$ |
| **4-Week Model** | **1.261** | 2.295 | **-45.1%** | 2.455 | **0.601** | **81.5%** | 90.2% | $\pm 4.81\text{ cases}$ |

---

## 5. Model Selection & Design Trade-offs

| Alternative Evaluated | Why It Was Considered | Why It Was Rejected / Trade-off |
|---|---|---|
| **Linear / Ridge Regression** | Fast, simple baseline | Incapable of learning non-linear mosquito survival thresholds (e.g. thermal inactivation above 34°C). |
| **ARIMA / SARIMAX** | Traditional econometric forecasting | Cannot handle high-dimensional spatial covariates (water logging, sanitation, density) across 60 disjoint wards simultaneously. |
| **Deep LSTM / Transformer** | Sequential modeling | Requires massive compute, prone to overfitting on weekly data, difficult to deploy locally, high inference latency. |
| **HistGradientBoosting (Selected)** | Native binned trees, robust to skew, handles non-linear vector interactions | **Chosen:** Sub-50ms inference, serialized via joblib to <150 KB, high recall (81.5%), zero API dependency. |

---

## 6. Compute & API Cost Efficiency (Criterion 6 Compliance)

Public health offices operate under strict resource and internet connectivity constraints. DENGUARD was engineered for maximum compute and financial efficiency:
1. **Zero External API Cost:** The system runs 100% locally. It does not depend on closed LLM APIs (OpenAI, Anthropic) for prediction, eliminating recurring token fees, subscription costs, and per-query charges.
2. **Fast Local Serialized Inference:** Models are fitted once and compiled to `models/hgb_{h}w_v2_vector_lag_{fingerprint}.joblib` (144 KB). Subsequent startups load in **< 3 seconds**, and inference across all 60 wards executes in **< 40 milliseconds**.
3. **Deterministic Content Generation:** Risk narratives, public health directives, and driver breakdowns are computed programmatically via deterministic feature attribution rather than generative LLM calls, guaranteeing 100% reproducibility and preventing epidemiological hallucinations.
4. **Lightweight Frontend Footprint:** Zero Node.js / webpack / Vite build pipeline required. The browser loads static HTML/CSS/JS served directly by Flask, rendering interactive maps via Leaflet and Chart.js.

---

## 7. Resilience & Network Fault Tolerance

- **Offline-First Resilience:** In the event of an internet outage during field operations, the core prediction engine, REST API, and data explorer remain 100% operational locally on `127.0.0.1:5000`.
- **Cached Asset Fallbacks:** CDN assets for Leaflet and Chart.js are cached by the browser; map tiles fallback gracefully if offline.
- **Graceful Error Trapping:** All Flask routes are wrapped in structured `@app.errorhandler` blocks returning standardized JSON `{ "error": ..., "detail": ... }` with HTTP 400/404/500 codes, preventing server crashes.
- **Data Integrity Auditing:** The `_load()` method verifies SHA-256 dataset integrity, strips whitespace, coerces dates, rejects negative case anomalies, and drops duplicate `(city, ward_id, date)` records.
