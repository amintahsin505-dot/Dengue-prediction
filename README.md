# DENGUARD AI — Urban Dengue Outbreak Early Warning Platform

[![EDU AI Engineering Hackathon 2026](https://img.shields.io/badge/EDU%20AI%20Hackathon-2026%20Edition-0284c7.svg)](https://ai-engineering-hackathon-2026.vercel.app)
[![Phase 1 Qualifier](https://img.shields.io/badge/Phase%201-24h%20Remote%20Qualifier-emerald.svg)](#)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

An operational, reproducible, and resource-efficient public health intelligence platform engineered for the **EDU AI Engineering Hackathon 2026** (Challenge: *AI for Urban Dengue Outbreak*).

---

## 1. Challenge & Project Overview

### The Problem
Every year, dengue surges overwhelm hospital emergency wards in Dhaka, Chattogram, Gazipur, and Narayanganj. Traditional municipal vector control operates reactively: spraying teams and larvicide are dispatched only **after** hospital beds fill up with severe patients. By then, community transmission chains are already weeks ahead.

### The Solution: The Vector Breeding Clock
Dengue transmission is governed by a **2-to-4-week biological lag**:
1. Heavy rainfall creates stagnant pools in clogged urban drains and discarded containers.
2. *Aedes aegypti* eggs take **7 to 14 days** to mature through larval/pupal stages into biting adult mosquitoes.
3. The virus undergoes an **8 to 12-day extrinsic incubation period** inside the mosquito before human transmission occurs.

**DENGUARD AI** captures this multi-week vector clock by computing grouped rainfall lags (`rainfall_accum_2_4w`) and intersecting them with localized ward drainage bottlenecks (`water_logging_risk_index`), crowding, and sanitation deficits across **60 urban wards**. It provides public health officers with an actionable **2-to-4-week early-warning window** to target high-risk zones *before* outbreaks peak.

---

## 2. Team Information & Roles

- **Team Name:** Denguard Intelligence Team
- **Institution:** East Delta University (EDU), Chattogram
- **Competition:** EDU AI Engineering Hackathon 2026 (Presented by XPONENT & EDU Computer Club)

| Member Name | Student ID | Department | Primary Role |
|---|---|---|---|
| **[Team Leader Name]** | `[Your Student ID]` | Computer Science & Engineering | Team Leader · System Architecture & ML Pipeline |
| **[Member 2 Name]** | `[Member 2 ID]` | Computer Science & Engineering | Spatial Epidemiology & Interactive 3-Zone Mapping |
| **[Member 3 Name]** | `[Member 3 ID]` | Computer Science & Engineering | Frontend Design, Validation Diagnostics & Testing |

*(Please update the placeholder names and IDs with your exact team details before final submission)*

---

## 3. Technology Stack

- **Backend Microservice:** Python 3.10+, Flask 3.1, Flask-CORS
- **Machine Learning Engine:** scikit-learn (HistGradientBoostingRegressor), NumPy, pandas, joblib
- **Validation Design:** Chronological 80/20 out-of-time date split (Dec 2023 cutoff) preventing temporal data leakage
- **Spatial Mapping:** Leaflet 1.9, CartoDB Voyager tiles, Leaflet.heat
- **Data Visualisation:** Chart.js 4.4, responsive SVG indicators
- **Frontend Architecture:** Vanilla HTML5, CSS3, modern ES6 JavaScript (Zero heavy node_modules build pipeline required)

---

## 4. Setup & Launch Instructions (≤ 3 Minutes)

DENGUARD is designed to install and launch cleanly in **under 3 minutes** on any standard Windows, macOS, or Linux system.

### Option A: One-Click Launch (Windows)
Double-click `run_windows.bat` in the project root folder. The script will automatically:
1. Detect Python 3.10+ on your system.
2. Initialize a clean virtual environment (`.venv`).
3. Install required dependencies from `requirements.txt`.
4. Launch the local web server on port 5000.
5. Automatically open `http://127.0.0.1:5000` in your default browser.

*(PowerShell users can alternatively execute: `powershell -ExecutionPolicy Bypass -File .\run_windows.ps1`)*

### Option B: Manual Setup (Windows / macOS / Linux)

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/denguard-ai.git
cd denguard-ai

# 2. Create and activate Python virtual environment
# Windows (PowerShell):
python -m venv .venv
.\.venv\Scripts\activate

# macOS / Linux:
python3 -m venv .venv
source .venv/bin/activate

# 3. Upgrade pip and install pinned dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# 4. Launch the DENGUARD platform
python backend/app.py
```

Open your browser at **[http://127.0.0.1:5000](http://127.0.0.1:5000)**.

### Running Test Suite
Execute the automated test harness covering the lag pipeline, model inference, 95% confidence intervals, and 3-zone categorization:

```bash
python tests/test_engine.py
```

---

## 5. Mandatory AI Tools & External APIs Disclosure (Rule 9.2 Compliance)

In strict accordance with **Rule 9.2** and **Appendix B** of the EDU AI Engineering Hackathon 2026 Rulebook, we disclose all AI assistants and tools used during the development of this project:

| AI Assistant / Tool | Model Version / Endpoint | Exact Purpose & Scope of Use |
|---|---|---|
| **Google Antigravity** | Gemini 3.8 Flash | Code scaffolding assistance, CSS styling layout consultation, and initial markdown documentation drafting. |
| **OpenStreetMap & CartoDB** | Tile CDN endpoints | Open map tile layer rendering in Leaflet (No personal data or proprietary API tokens involved). |
| **External LLM APIs** | *None* | **Zero external LLM APIs are called at runtime.** All predictions, confidence intervals, and driver attributions run 100% locally on serialized scikit-learn models to ensure sub-50ms latency, zero token costs, and offline resilience. |

All core machine learning logic, grouped lag formulations, epidemiological feature engineering, chronological validation split, and interactive visual architecture were reviewed, verified, and understood by the team.

---

## 6. Project Architecture & Key Features

### 1. Interactive 3-Zone City Risk Map (Core Rubric & User Requirement)
- Categorizes all 60 urban wards into 3 distinct operational zones:
  - 🔴 **High Risk Zone:** Combined score $\ge 67\%$ · Larvicide spraying required within 72 hours.
  - 🟡 **Medium Risk Zone:** Combined score $34\text{--}66\%$ · Canal unblocking and container inspection.
  - 🟢 **Low Risk Zone:** Combined score $\le 33\%$ · Routine weekly surveillance.
- Interactive slide-over inspector displaying:
  - 95% Confidence Intervals for 2-week and 4-week forecasts.
  - Multi-week weather metrics and urban vulnerability scores.
  - Local driver attribution breakdown.
  - Specific municipal intervention directives.

### 2. Multi-Week Weather Lag Pipeline (Criterion 2 · 15 Points)
- Programmatically calculates grouped 1w, 2w, 3w, 4w lags for rainfall, temperature, and relative humidity grouped per `(city, ward_id)`.
- Empirically proves the Vector Breeding Clock: same-day rainfall correlation with dengue is only $r = 0.530$, while cumulative 2-4 week lag reaches **$r = 0.813$**.

### 3. Chronological Model Validation & Diagnostics (Criterion 5 · 10 Points)
- Strict 80/20 chronological date split (Dec 2023 cutoff) preventing future data leakage.
- Achieves **1.025 MAE** (54.9% error reduction vs 2.273 zero-baseline MAE) on the 2-week outlook and **1.261 MAE** on the 4-week outlook with **78.8% to 81.5% outbreak recall**.

### 4. Public Health "What-If" Scenario Simulator (Domain-Relevant Extension)
- Interactive sliders allowing health officers to simulate:
  - Monsoon rainfall surges ($+0\text{ to }+100\text{ mm}$)
  - Temperature anomalies ($-3^\circ\text{C to }+5^\circ\text{C}$)
  - Municipal sanitation clean-up drives ($+0.0\text{ to }+0.5\text{ score}$)
- Instant recalculation of ward risk tiers in $< 40$ milliseconds.

### 5. Bonus Criteria Implementation (+5 Bonus Points)
1. **Interactive Ward-Level Risk Heatmaps:** Seamless toggle between 3-zone catchment circles and continuous density heatmaps.
2. **Multi-Week Forecast Confidence Intervals:** 95% prediction intervals ($\pm 1.96 \times \text{RMSE}$) for all 60 wards.
3. **Chronological Error Dashboard:** Longitudinal holdout error analysis, actual vs predicted timeseries, and permutation feature importance charts.

---

## 7. Open-Source Attributions & Third-Party Libraries

- **scikit-learn** (BSD-3-Clause): Histogram-based gradient boosting implementation.
- **Flask** (BSD-3-Clause): WSGI web application framework.
- **pandas & NumPy** (BSD-3-Clause): Time-series indexing and array mathematics.
- **Leaflet.js** (BSD-2-Clause): Mobile-friendly interactive map rendering.
- **Chart.js** (MIT License): Epidemiological curve and feature importance charts.
- **Plus Jakarta Sans & JetBrains Mono** (SIL Open Font License): Open-source interface typography.

---

## 8. Video Demo & Submission Links

- **Uncut 3-Minute Video Demo:** `[Insert YouTube / Google Drive Video Link Here]` *(See `DEMO_VIDEO_SCRIPT.md` for complete recording script)*
- **Public GitHub Repository:** `[Insert Your GitHub Repository URL Here]`
- **Official Submission Tag:** `v-phase1-submission`
