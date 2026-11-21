from flask import Flask, jsonify, request, render_template, Response
from pathlib import Path
import numpy as np
import pandas as pd
import csv, io
from data_pipeline import prepare_runtime, FEATURES

ROOT = Path(__file__).resolve().parent
app = Flask(__name__, template_folder='frontend/templates', static_folder='frontend/static')
try:
    DF, FEATURED, BUNDLE = prepare_runtime()
    STARTUP_ERROR = None
except Exception as exc:
    DF = FEATURED = BUNDLE = None
    STARTUP_ERROR = str(exc)

CITY_COORDS = {
    'Chattogram': (22.3569, 91.7832), 'Dhaka North': (23.8103, 90.4125),
    'Dhaka South': (23.7104, 90.4074), 'Gazipur': (24.0023, 90.4264),
    'Narayanganj': (23.6238, 90.5000)
}


def ready():
    if STARTUP_ERROR or DF is None:
        return jsonify({'error': STARTUP_ERROR or 'Application is not ready'}), 503
    return None


def records(frame):
    out = frame.copy()
    if 'date' in out:
        out['date'] = out['date'].dt.strftime('%Y-%m-%d')
    return out.replace({np.nan: None}).to_dict(orient='records')


def risk_tier(rate, thresholds):
    a,b,c = thresholds
    if rate >= c: return 'Critical'
    if rate >= b: return 'High'
    if rate >= a: return 'Medium'
    return 'Low'


def get_predictions(horizon=2, city=None, as_of=None):
    model = BUNDLE['models'][str(horizon)]
    source = FEATURED
    if as_of:
        selected_date = pd.to_datetime(as_of, errors='coerce')
        if pd.isna(selected_date):
            raise ValueError('Invalid as_of date')
        source = source[source['date'] <= selected_date]
    latest = source.sort_values('date').groupby(['city','ward_id'], as_index=False).tail(1).copy()
    if city and city != 'All cities': latest = latest[latest.city == city]
    latest['predicted_cases'] = np.maximum(0, np.expm1(model.predict(latest[FEATURES])))
    latest['predicted_cases'] = latest['predicted_cases'].round(1)
    thresholds = BUNDLE['thresholds'][str(horizon)]
    latest['risk_level'] = latest['predicted_cases'].apply(lambda x: risk_tier(x, thresholds))
    latest['risk_score'] = (latest['predicted_cases'] / max(thresholds[2],0.01) * 100).clip(0,100).round().astype(int)
    latest['forecast_date'] = latest['date'] + pd.to_timedelta(horizon * 7, unit='D')
    latest['forecast_date'] = latest['forecast_date'].dt.strftime('%Y-%m-%d')
    latest['latest_date'] = latest['date'].dt.strftime('%Y-%m-%d')
    return latest


@app.get('/')
def home():
    return render_template('index.html')

@app.get('/api/health')
def health():
    return jsonify({'status':'ok' if STARTUP_ERROR is None else 'error','message':STARTUP_ERROR,'model_loaded':BUNDLE is not None})

@app.get('/api/meta')
def meta():
    err=ready()
    if err: return err
    return jsonify({'rows':int(len(DF)),'cities':sorted(DF.city.unique().tolist()),'wards':int(DF.ward_id.nunique()),
        'date_start':DF.date.min().strftime('%Y-%m-%d'),'date_end':DF.date.max().strftime('%Y-%m-%d'),
        'columns':DF.columns.tolist(),'metrics':BUNDLE['metrics'],'model':'HistGradientBoostingRegressor (log1p target)',
        'map_note':'Ward markers are approximate city-centre offsets, not official ward boundaries.'})

@app.get('/api/summary')
def summary():
    err=ready()
    if err: return err
    latest = DF[DF.date == DF.date.max()]
    pred = get_predictions(4)
    return jsonify({'total_cases':int(DF.dengue_cases.sum()),'latest_week_cases':int(latest.dengue_cases.sum()),
        'cities':int(DF.city.nunique()),'wards':int(DF.ward_id.nunique()),'records':int(len(DF)),
        'high_risk_wards':int(pred.risk_level.isin(['High','Critical']).sum()),
        'critical_wards':int((pred.risk_level=='Critical').sum()),
        'latest_date':DF.date.max().strftime('%Y-%m-%d'),'date_start':DF.date.min().strftime('%Y-%m-%d')})

@app.get('/api/filters')
def filters():
    err=ready()
    if err: return err
    city=request.args.get('city')
    f=DF if not city or city=='All cities' else DF[DF.city==city]
    return jsonify({'cities':sorted(DF.city.unique().tolist()),'wards':sorted(f.ward_id.unique().tolist()),
        'dates':{'min':f.date.min().strftime('%Y-%m-%d'),'max':f.date.max().strftime('%Y-%m-%d')}})

@app.get('/api/records')
def records_api():
    err=ready()
    if err: return err
    f=DF
    city=request.args.get('city'); ward=request.args.get('ward'); date=request.args.get('date')
    start=request.args.get('start'); end=request.args.get('end'); search=request.args.get('search','').strip()
    if city and city!='All cities': f=f[f.city==city]
    if ward and ward!='All wards': f=f[f.ward_id==ward]
    if date: f=f[f.date==pd.to_datetime(date,errors='coerce')]
    if start: f=f[f.date>=pd.to_datetime(start,errors='coerce')]
    if end: f=f[f.date<=pd.to_datetime(end,errors='coerce')]
    if search: f=f[f.city.str.contains(search,case=False,na=False)|f.ward_id.str.contains(search,case=False,na=False)]
    total=len(f); limit=min(max(int(request.args.get('limit',100)),1),500); offset=max(int(request.args.get('offset',0)),0)
    f=f.sort_values('date',ascending=False).iloc[offset:offset+limit]
    return jsonify({'total':int(total),'limit':limit,'offset':offset,'records':records(f)})

@app.get('/api/ward')
def ward_detail():
    err=ready()
    if err: return err
    city=request.args.get('city'); ward=request.args.get('ward')
    if not city or not ward: return jsonify({'error':'city and ward are required'}),400
    f=DF[(DF.city==city)&(DF.ward_id==ward)].sort_values('date')
    if f.empty: return jsonify({'error':'Ward not found'}),404
    return jsonify({'latest':records(f.tail(1))[0],'history':records(f.tail(104)),'total_cases':int(f.dengue_cases.sum()),'observations':len(f)})

@app.get('/api/trends')
def trends():
    err=ready()
    if err: return err
    f=DF
    city=request.args.get('city'); ward=request.args.get('ward')
    if city and city!='All cities': f=f[f.city==city]
    if ward and ward!='All wards': f=f[f.ward_id==ward]
    grouped=f.groupby('date',as_index=False).agg(dengue_cases=('dengue_cases','sum'),rainfall_mm=('rainfall_mm','mean'),avg_temp_c=('avg_temp_c','mean'),relative_humidity_pct=('relative_humidity_pct','mean')).sort_values('date').tail(104)
    return jsonify(records(grouped))

@app.get('/api/predictions')
def predictions():
    err=ready()
    if err: return err
    horizon=int(request.args.get('horizon',4))
    if horizon not in (2,4): return jsonify({'error':'horizon must be 2 or 4'}),400
    city=request.args.get('city'); as_of=request.args.get('as_of')
    try: p=get_predictions(horizon,city,as_of)
    except ValueError as exc: return jsonify({'error':str(exc)}),400
    p=p.sort_values(['risk_score','predicted_cases'],ascending=False)
    return jsonify({'horizon_weeks':horizon,'base_date':(p['latest_date'].max() if not p.empty else BUNDLE['data_end']),'forecast_note':'Model forecast from latest observed ward weather and historical lag features; future weather is not externally forecast.',
        'metrics':BUNDLE['metrics'][str(horizon)],'risk_thresholds_cases':BUNDLE['thresholds'][str(horizon)],'predictions':records(p)})

@app.get('/api/risk-map')
def risk_map():
    err=ready()
    if err: return err
    horizon=int(request.args.get('horizon',4)); city=request.args.get('city'); as_of=request.args.get('as_of')
    try: p=get_predictions(horizon,city,as_of)
    except ValueError as exc: return jsonify({'error':str(exc)}),400
    counts=p.risk_level.value_counts().to_dict()
    points=[]
    for _,r in p.iterrows():
        lat,lon=CITY_COORDS.get(r.city,(23.7,90.4))
        # Deterministic visual offset only: dataset contains no official ward coordinates.
        num=int(''.join(ch for ch in r.ward_id if ch.isdigit()) or 1)
        city_offset=sorted(CITY_COORDS).index(r.city) if r.city in CITY_COORDS else 0
        lat=lat+((num%7)-3)*0.006+city_offset*0.0007
        lon=lon+((num%9)-4)*0.006+city_offset*0.0007
        points.append({'city':r.city,'ward_id':r.ward_id,'lat':lat,'lon':lon,'risk_level':r.risk_level,'risk_score':int(r.risk_score),'predicted_cases':float(r.predicted_cases),'forecast_date':r.forecast_date})
    return jsonify({'points':points,'counts':counts,'horizon_weeks':horizon,'base_date':(p['latest_date'].max() if not p.empty else BUNDLE['data_end']),'note':'Approximate display markers only. Official ward GIS polygons/coordinates are not present in the supplied dataset.'})

@app.get('/api/export')
def export_csv():
    err=ready()
    if err: return err
    city=request.args.get('city'); ward=request.args.get('ward')
    f=DF
    if city and city!='All cities': f=f[f.city==city]
    if ward and ward!='All wards': f=f[f.ward_id==ward]
    date=request.args.get('date'); search=request.args.get('search','').strip()
    if date: f=f[f.date==pd.to_datetime(date,errors='coerce')]
    if search: f=f[f.city.str.contains(search,case=False,na=False)|f.ward_id.str.contains(search,case=False,na=False)]
    output=io.StringIO(); f.assign(date=f.date.dt.strftime('%Y-%m-%d')).to_csv(output,index=False)
    return Response(output.getvalue(),mimetype='text/csv',headers={'Content-Disposition':'attachment; filename=dengue_records.csv'})

if __name__ == '__main__':
    app.run(host='127.0.0.1',port=5000,debug=False)
