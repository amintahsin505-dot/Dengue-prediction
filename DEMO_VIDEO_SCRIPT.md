# DENGUARD AI — 3-Minute Uncut Video Demo Script (20/20 Points)

> **CRITICAL RULEBOOK REQUIREMENTS (Criterion 7):**
> 1. **Duration:** STRICTLY $\le$ 3:00 minutes (e.g. 2:45 to 2:55 is ideal).
> 2. **Format:** 100% uncut screen recording of live execution on `http://127.0.0.1:5000` (NO jump cuts, NO editing splices).
> 3. **Content:** Clear voiceover explaining inputs and predictions. **PRESENTATION SLIDES ARE STRICTLY PROHIBITED.**

---

## Pre-Recording Checklist
- [ ] Terminal window open showing `python backend/app.py` running cleanly.
- [ ] Browser window open at `http://127.0.0.1:5000` (full screen, clean tabs, zoom at 100%).
- [ ] Screen recorder (OBS Studio, Windows Game Bar `Win+G`, or Loom) configured to record fullscreen with clear microphone audio.
- [ ] Do a 30-second mic test before starting.

---

## Second-by-Second Walkthrough & Voiceover Script

### [0:00 – 0:30] Introduction & Local Reproducibility
* **Action on Screen:** Start recording showing the VS Code / terminal running `python backend/app.py` outputting `DENGUARD is ready! Open http://127.0.0.1:5000`, then switch smoothly to the browser tab.
* **Voiceover:**
  > *"Hello judges, welcome to DENGUARD AI, our urban dengue early-warning platform built for the EDU AI Engineering Hackathon 2026. The system is running completely live on localhost port 5000 with sub-50ms serialized model inference and zero external API dependencies."*
  > *"Across Bangladesh, dengue containment fails because municipal spraying happens reactively after hospital beds fill up. DENGUARD operationalizes the 2-to-4-week Vector Breeding Clock, giving public health officers a crucial predictive window to target high-risk wards before outbreaks peak."*

---

### [0:30 – 1:15] The 3-Zone City Risk Map & Ward Drilldown
* **Action on Screen:** 
  1. Point to the top bar showing the 3 zone pills (`High Risk Zone: 18`, `Medium Risk: 22`, `Low Risk: 20`).
  2. Click the `[Chattogram (10 Wards)]` city pill to fly to Chattogram.
  3. Click on **`CCC_Ward_08`** (Sholashahar / Nasirabad / Khulshi near East Delta University).
  4. Show the Ward Inspector drawer on the right updating live.
* **Voiceover:**
  > *"Here on our interactive 3-Zone City Map, all 60 urban wards across Bangladesh are classified into High, Medium, and Low Risk Zones. Let's zoom into Chattogram. Notice Ward 8 — Sholashahar and Nasirabad right here by East Delta University."*
  > *"When we click this ward, our Inspector reveals our 2-week forecast: 38.4 predicted cases with an empirical 95% confidence interval of 34.5 to 42.3 cases. Notice the driver breakdown: 35% of this risk is driven by 2-to-4-week accumulated rainfall trapped in local drainage bottlenecks. The system immediately outputs an actionable public health directive: deploy targeted larvicide in surface drains within 72 hours before adult mosquitoes emerge."*

---

### [1:15 – 1:45] Weather Lag Pipeline (Vector Breeding Clock Proof)
* **Action on Screen:** Click the **`🧪 Weather Lag Pipeline`** tab in the navigation bar. Scroll slightly to show the correlation chart and biological stepper.
* **Voiceover:**
  > *"Under the Weather Lag Pipeline, we provide mathematical proof of the vector breeding clock. Aedes aegypti eggs require 7 to 14 days to mature into adults, followed by viral incubation. Look at this Pearson correlation chart: same-day rainfall correlation with dengue cases is only r = 0.53, but cumulative 2-to-4-week rainfall surges to r = 0.813! This validates our grouped multi-week lag pipeline."*

---

### [1:45 – 2:15] Chronological Validation & Model Diagnostics
* **Action on Screen:** Click the **`🔬 Model & Diagnostics`** tab. Point to the MAE comparison table and chronological holdout chart.
* **Voiceover:**
  > *"In our Model Diagnostics, we enforce a strict 80/20 chronological date split with a December 2023 cutoff to prevent temporal leakage. On out-of-time future data from 2024 to 2025, our HistGradientBoosting model achieves an MAE of 1.025 — a 55% error reduction over the zero-baseline MAE of 2.273 — while maintaining a 78.8% outbreak recall."*

---

### [2:15 – 2:45] What-If Scenario Simulator (Early Action Decision Tool)
* **Action on Screen:** 
  1. Click the **`⚡ What-If Simulator`** tab.
  2. Move the `Added Monsoon Rainfall` slider to `+40 mm`.
  3. Click `⚡ Recalculate 60 Ward Outbreak Risks`.
  4. Show the cards and table updating instantly.
* **Voiceover:**
  > *"For proactive decision-making, our What-If Simulator lets public health officers simulate environmental shifts. If a monsoon depression adds 40 mm of rainfall next week, we click Recalculate: instantly, in under 40 milliseconds, our serialized models re-evaluate all 60 wards, showing exactly which wards flip from Medium to High Risk, allowing preventative biocide stocking before hospitals feel the surge."*

---

### [2:45 – 2:58] Conclusion & Submission
* **Action on Screen:** Switch back to the **`3-Zone City Map`**, toggle the **`Outbreak Heatmap`** radio button to show the heat gradient layer, then show the clean GitHub-ready interface.
* **Voiceover:**
  > *"With full 95% confidence intervals, interactive 3-zone mapping, and zero token costs, DENGUARD AI delivers a true production-grade early warning system for Bangladesh. Thank you!"*
* **Stop Recording:** Stop screen recording at ~2:55.
