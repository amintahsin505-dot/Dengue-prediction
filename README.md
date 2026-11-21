# Dengue Watch BD

AI-assisted, ward-level dengue surveillance and early-warning prototype for the EDU AI Engineering Hackathon 2026.

## What is included

- Flask REST API and a responsive HTML/CSS/JavaScript dashboard.
- The complete supplied dataset converted from the supplied Google Sheets PDF export to `data/bangladesh_dengue.csv`.
- 31,320 data records (31,321 CSV lines including the header), 5 cities and 60 wards, dated 2016-01-04 through 2025-12-29.
- Multi-week rainfall lag and rolling weather features, ward-level vulnerability features and recent case-history features.
- Two separately trained HistGradientBoostingRegressor models predicting dengue cases 2 and 4 weekly observations ahead.
- Chronological 80/20 validation split, MAE/RMSE reporting, and joblib model serialization.
- Interactive Leaflet risk map, ward risk ranking, historical charts, raw data search and CSV export.


## Project structure

```text
dengue_watch_bd/
├── app.py                       # Flask app and REST API
├── data_pipeline.py             # Validation, lag features and ML training
├── requirements.txt             # Python dependencies
├── ARCHITECTURE.md              # System diagram, model and validation notes
├── README.md                    # Setup and submission guide
├── run.bat / run.sh             # Local launch helpers
├── data/
│   └── bangladesh_dengue.csv    # All 31,320 supplied records
├── models/                      # Model artifact is generated at first run
├── scripts/
│   └── convert_pdf_to_csv.py    # Optional PDF-to-CSV converter
└── frontend/
    ├── templates/index.html     # Dashboard structure
    └── static/
        ├── css/style.css        # UI styling
        └── js/app.js            # API calls, map, charts and filters
```

## 1. Requirements

- Windows 10/11, macOS or Linux
- Python 3.12 recommended (the pinned package versions are intended for Python 3.12). If you currently have Python 3.14.2, install Python 3.12 as well and use the `py -3.12` launcher.
- Internet connection for first-time package installation, OpenStreetMap tiles, Chart.js and map libraries loaded from CDN
- Git (for GitHub submission)

## 2. Run on Windows

1. Extract the ZIP file.
2. Open the extracted `dengue_watch_bd` folder in VS Code.
3. Open Terminal → New Terminal.
4. Run:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
```

5. Wait for the first run to finish training and saving the two models. This may take a little time.
6. Open **http://127.0.0.1:5000** in Chrome.
7. Keep the terminal open while using the website. Press `Ctrl + C` in the terminal to stop it.

Alternative: double-click `run.bat` (it creates the virtual environment, installs dependencies and launches the app).

## 3. Run on macOS/Linux

```bash
chmod +x run.sh
./run.sh
```

Then open http://127.0.0.1:5000.

## 4. Dataset

The supplied PDF is a print/export of a Google Sheet, not a machine-readable CSV. It has been parsed into `data/bangladesh_dengue.csv`. All original columns are retained:

- `date`, `city`, `ward_id`
- `population_density_sqkm`, `water_logging_risk_index`, `sanitation_score`
- `avg_temp_c`, `max_temp_c`, `min_temp_c`, `rainfall_mm`, `relative_humidity_pct`
- `dengue_cases`

The supplied PDF contains 31,320 data rows; the CSV has 31,321 lines when its header is counted. The app checks that all required columns exist before loading.

If you receive an updated CSV, replace `data/bangladesh_dengue.csv` (keep the same column names), stop the app, delete `models/dengue_models.joblib`, and restart `python app.py`. The models will retrain from the new dataset.

If you receive only a new PDF export, install Poppler so `pdftotext` is available, then run:

```bash
python scripts/convert_pdf_to_csv.py "path/to/new_dataset.pdf" data/bangladesh_dengue.csv
```

## 5. Prediction methodology

The dataset is weekly. For every city/ward time series the pipeline calculates:

- Rainfall lags at 1, 2, 3 and 4 weekly observations
- Rolling 2-week and 4-week rainfall totals
- Rolling average temperature and humidity
- Dengue case lags at 1–4 weeks and a 4-week case average
- Ward vulnerability: population density, water-logging risk and sanitation score

Separate HistGradientBoostingRegressor models learn to predict the observed case count two and four weekly observations after each feature row. The target is transformed with `log1p` during training and converted back with `expm1` during inference to handle skewed case counts. The final 20% of dates is held out chronologically for validation; earlier dates are used for training. MAE and RMSE are displayed in the interface.

Risk tiers (Low, Medium, High, Critical) are derived from training-period predicted ward-level weekly case counts using training-period quantiles, with minimum separation safeguards. The displayed risk score is a normalized 0–100 indicator relative to the Critical threshold; it is not a calibrated probability.

**Important interpretation:** the source dataset contains historical weather, not future weather forecasts. The 2- and 4-week model outputs are forecasts conditioned on the latest observed weather, rolling lags, ward vulnerability and case history. They are not a live meteorological forecast and should be treated as decision-support estimates, not official public-health alerts. New weather observations can be added to refresh the outlook.

## 6. Map limitation

The source dataset does not include ward latitude/longitude or official ward polygons. The map therefore uses approximate display markers offset around city centres so users can explore risk tiers. These are schematic markers, not surveyed ward locations or official boundaries. Replace them with authoritative GIS coordinates/polygons before operational use.

## 7. API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Server and model status |
| `GET /api/meta` | Dataset metadata, columns and model metrics |
| `GET /api/summary` | Dashboard KPI values |
| `GET /api/filters?city=...` | Available city/ward/date filters |
| `GET /api/records?city=...&ward=...&date=...&limit=100&offset=0` | Search and paginate raw rows |
| `GET /api/ward?city=...&ward=...` | Latest ward record and history |
| `GET /api/trends?city=...&ward=...` | Weekly historical trend data |
| `GET /api/predictions?horizon=2&as_of=2025-09-08` | Two-week ward-level inference from the selected historical observation date |
| `GET /api/predictions?horizon=4&city=...&as_of=...` | Four-week predictions, optional city and as-of date filters |
| `GET /api/risk-map?horizon=4&as_of=...` | Map markers and risk distribution for the selected date |
| `GET /api/export?city=...&ward=...` | Download matching raw rows as CSV |

## 8. GitHub submission

Create a new **public** GitHub repository. In VS Code terminal, from the project root:

```bash
git init
git add .
git commit -m "Build Dengue Watch BD early warning prototype"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/dengue-watch-bd.git
git push -u origin main
```

Replace the remote URL with your actual repository URL. Do not commit passwords, API keys or private credentials. Keep the dataset license/source attribution required by the organizer.

For the Git History & AI Disclosure criterion, team members should make genuine, meaningful commits as they contribute. Do not fabricate contributors or backdate commits. Add a clear disclosure of AI assistants and external libraries/APIs used to `README.md` before submission. This prototype was developed with assistance from OpenAI ChatGPT; it uses Flask, pandas, NumPy, scikit-learn, joblib, Leaflet, Chart.js and OpenStreetMap tiles.

## 9. Suggested 3-minute demo sequence

1. Start the server and open the dashboard.
2. Explain the 31,320 source records, date coverage, five cities and 60 wards.
3. Change the as-of date to a historical seasonal week (for example 2025-09-08), switch between 2- and 4-week forecasts, and explain the colour legend. The latest date can correctly show mostly Low risk if the supplied data records low cases then.
4. Open AI Prediction and explain the forecast, risk score, MAE/RMSE and risk drivers.
5. Search a city/ward/date in Dataset Explorer and show all 12 original fields.
6. Show historical dengue and weather trends and download a CSV.

## Disclaimer

This is a hackathon research prototype. It is not a clinically validated forecasting system. Validate the model with public-health experts and authoritative ward GIS data before operational decisions.
