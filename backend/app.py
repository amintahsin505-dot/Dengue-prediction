from __future__ import annotations
import csv
import io
import os
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
from engine import DenguardEngine, HORIZONS, CITY_CENTERS, WARD_COORDINATES

ROOT = Path(__file__).resolve().parents[1]
app = Flask(__name__, static_folder=str(ROOT / 'frontend'), static_url_path='')
CORS(app)

engine_instance: DenguardEngine | None = None


def get_engine() -> DenguardEngine:
    global engine_instance
    if engine_instance is None:
        engine_instance = DenguardEngine()
    return engine_instance


def parse_filter_params():
    city = request.args.get('city', 'All cities')
    start = request.args.get('start')
    end = request.args.get('end')
    return city, start, end


@app.get('/')
def index():
    return send_from_directory(ROOT / 'frontend', 'index.html')


@app.get('/api/health')
def health():
    try:
        e = get_engine()
        return jsonify({
            'status': 'healthy',
            'version': '2.1.0-hackathon-final',
            'dataset_end': e.data['date'].max().strftime('%Y-%m-%d'),
            'total_rows': len(e.data),
            'wards_tracked': int(e.data['ward_id'].nunique()),
            'cities': sorted(e.data['city'].unique().tolist())
        })
    except Exception as ex:
        return jsonify({'status': 'error', 'message': str(ex)}), 500


@app.get('/api/meta')
def meta():
    e = get_engine()
    return jsonify({
        'cities': sorted(e.data['city'].unique().tolist()),
        'horizons': list(HORIZONS),
        'coverage_start': e.data['date'].min().strftime('%Y-%m-%d'),
        'coverage_end': e.data['date'].max().strftime('%Y-%m-%d'),
        'total_wards': int(e.data['ward_id'].nunique()),
        'total_records': len(e.data),
        'city_centers': CITY_CENTERS,
        'ward_coordinates': WARD_COORDINATES
    })


@app.get('/api/summary')
def summary():
    e = get_engine()
    city, start, end = parse_filter_params()
    return jsonify(e.summary(city, start, end))


@app.get('/api/trends')
def trends():
    e = get_engine()
    city, start, end = parse_filter_params()
    return jsonify(e.trends(city, start, end))


@app.get('/api/forecasts')
def forecasts():
    e = get_engine()
    city = request.args.get('city', 'All cities')
    h = request.args.get('horizon', '2')
    try:
        return jsonify(e.api_payload(city, int(h)))
    except ValueError as ex:
        return jsonify({'error': str(ex)}), 400


@app.get('/api/city-summary')
def city_summary():
    e = get_engine()
    h = request.args.get('horizon', '2')
    try:
        h = int(h)
        assert h in HORIZONS
    except Exception:
        return jsonify({'error': 'horizon must be 2 or 4'}), 400

    f = e.forecasts.groupby('city').agg(
        wards=('ward_id', 'nunique'),
        predicted_cases=(f'predicted_{h}w', 'sum'),
        high_risk_wards=(f'tier_{h}w', lambda s: int((s == 'High').sum())),
        medium_risk_wards=(f'tier_{h}w', lambda s: int((s == 'Medium').sum())),
        low_risk_wards=(f'tier_{h}w', lambda s: int((s == 'Low').sum())),
        avg_risk_score=(f'score_{h}w', 'mean')
    ).reset_index()
    f['avg_risk_score'] = f['avg_risk_score'].round(1)
    
    hist = e.data.groupby('city')['dengue_cases'].sum().rename('historical_cases').reset_index()
    merged = f.merge(hist, on='city')
    return jsonify(e.frame(merged.sort_values('predicted_cases', ascending=False)))


@app.get('/api/ward/<path:ward_id>')
def ward_detail(ward_id: str):
    e = get_engine()
    city = request.args.get('city')
    d = e.data[e.data['ward_id'] == ward_id]
    if city and city != 'All cities':
        d = d[d['city'] == city]
    if d.empty:
        return jsonify({'error': f'Ward {ward_id} not found'}), 404

    ward_fc = e.forecasts[e.forecasts['ward_id'] == ward_id]
    meta_info = WARD_COORDINATES.get(ward_id, {})
    return jsonify({
        'ward_id': ward_id,
        'metadata': meta_info,
        'history': e.frame(d.sort_values('date').tail(104)),
        'forecast': e.frame(ward_fc)[0] if not ward_fc.empty else {}
    })


@app.get('/api/metrics')
def metrics():
    e = get_engine()
    return jsonify({
        'metrics': {str(k): v for k, v in e.metrics.items()},
        'importance': {str(k): v[:14] for k, v in e.importance.items()}
    })


@app.get('/api/validation-details')
def validation_details():
    """Returns chronological validation time series and residuals (Bonus Requirement 3)."""
    e = get_engine()
    h = int(request.args.get('horizon', '2'))
    if h not in HORIZONS:
        h = 2
    return jsonify({
        'horizon': h,
        'metrics': e.metrics[h],
        'series': e.validation_series.get(h, [])
    })


@app.get('/api/lag-analysis')
def lag_analysis():
    """Returns multi-week weather lag correlations proving the vector breeding clock."""
    e = get_engine()
    return jsonify(e.lag_analysis())


@app.route('/api/simulate', methods=['GET', 'POST'])
def simulate():
    """Interactive What-If public health intervention simulator."""
    e = get_engine()
    params = request.get_json(silent=True) or request.args
    try:
        rainfall_delta = float(params.get('rainfall_delta', 0.0))
        temp_delta = float(params.get('temp_delta', 0.0))
        sanitation_delta = float(params.get('sanitation_delta', 0.0))
        horizon = int(params.get('horizon', 2))
        results = e.simulate(rainfall_delta, temp_delta, sanitation_delta, horizon)
        return jsonify({
            'scenario': {
                'rainfall_delta': rainfall_delta,
                'temp_delta': temp_delta,
                'sanitation_delta': sanitation_delta,
                'horizon': horizon
            },
            'results': results
        })
    except Exception as ex:
        return jsonify({'error': str(ex)}), 400


@app.get('/api/environment')
def environment():
    e = get_engine()
    city, start, end = parse_filter_params()
    d = e.data
    if city != 'All cities':
        d = d[d['city'] == city]
    if start:
        d = d[d['date'] >= pd.Timestamp(start)]
    if end:
        d = d[d['date'] <= pd.Timestamp(end)]
    cols = [
        'date', 'city', 'ward_id', 'dengue_cases', 'rainfall_mm',
        'avg_temp_c', 'relative_humidity_pct', 'rainfall_accum_2_4w',
        'water_logging_risk_index', 'sanitation_score', 'population_density_sqkm'
    ]
    sample = d[cols].sample(n=min(2500, len(d)), random_state=42).copy() if len(d) > 2500 else d[cols].copy()
    sample['date'] = sample['date'].dt.strftime('%Y-%m-%d')
    return jsonify(e.frame(sample))


@app.get('/api/records')
def records():
    e = get_engine()
    city, start, end = parse_filter_params()
    d = e.data
    if city != 'All cities':
        d = d[d['city'] == city]
    if start:
        d = d[d['date'] >= pd.Timestamp(start)]
    if end:
        d = d[d['date'] <= pd.Timestamp(end)]
    limit = min(max(int(request.args.get('limit', '25')), 1), 250)
    cols = [
        'date', 'city', 'ward_id', 'dengue_cases', 'rainfall_mm',
        'avg_temp_c', 'relative_humidity_pct', 'rainfall_accum_2_4w',
        'water_logging_risk_index', 'sanitation_score'
    ]
    d = d.sort_values('date', ascending=False).head(limit).copy()
    d['date'] = d['date'].dt.strftime('%Y-%m-%d')
    return jsonify(e.frame(d[cols]))


@app.get('/api/export')
def export():
    e = get_engine()
    city = request.args.get('city', 'All cities')
    h = request.args.get('horizon', '2')
    try:
        rows = e.api_payload(city, int(h))
    except ValueError as ex:
        return jsonify({'error': str(ex)}), 400
    if not rows:
        return jsonify({'error': 'No records found for export'}), 404

    # Flatten drivers dict for clean CSV export
    export_rows = []
    for r in rows:
        item = dict(r)
        if 'drivers' in item and isinstance(item['drivers'], dict):
            for k, v in item['drivers'].items():
                item[f'driver_{k}'] = v
            del item['drivers']
        export_rows.append(item)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(export_rows[0].keys()))
    writer.writeheader()
    writer.writerows(export_rows)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename=denguard_dengue_forecast_{h}w.csv'}
    )


@app.errorhandler(Exception)
def handle_exception(ex):
    app.logger.exception('Unhandled backend error')
    return jsonify({
        'error': 'Server could not process request',
        'detail': str(ex)
    }), 500


if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', '5000'))
    print(f'=== DENGUARD Dengue Intelligence Platform ===')
    print(f'Starting local server on http://{host}:{port}')
    print(f'Checking pre-trained models and dataset...')
    get_engine()
    print(f'DENGUARD is ready! Open http://{host}:{port} in your browser.')
    app.run(host=host, port=port, debug=False)
