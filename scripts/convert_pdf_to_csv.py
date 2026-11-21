"""Convert the supplied Google Sheets-exported dataset PDF to CSV.
Requires Poppler's pdftotext command to be installed and available on PATH.
Usage: python scripts/convert_pdf_to_csv.py input.pdf data/bangladesh_dengue.csv
"""
import csv, re, subprocess, sys
from pathlib import Path

HEADERS=['date','city','ward_id','population_density_sqkm','water_logging_risk_index','sanitation_score','avg_temp_c','max_temp_c','min_temp_c','rainfall_mm','relative_humidity_pct','dengue_cases']
def main():
    if len(sys.argv)<2: raise SystemExit('Usage: python scripts/convert_pdf_to_csv.py input.pdf [output.csv]')
    source=Path(sys.argv[1]); dest=Path(sys.argv[2]) if len(sys.argv)>2 else Path('data/bangladesh_dengue.csv')
    text=subprocess.check_output(['pdftotext','-layout',str(source),'-'],text=True)
    rows=[]
    for line in text.splitlines():
        s=line.strip()
        if not re.match(r'^\d{4}-\d{2}-\d{2}\s+',s): continue
        tokens=s.split()
        wi=next((i for i,t in enumerate(tokens) if re.fullmatch(r'[A-Z]+_Ward_\d+',t)),None)
        if wi is None: continue
        values=tokens[wi+1:]
        if len(values)!=9: continue
        rows.append([tokens[0],' '.join(tokens[1:wi]),tokens[wi]]+[float(x) for x in values])
    dest.parent.mkdir(parents=True,exist_ok=True)
    with dest.open('w',newline='',encoding='utf-8') as f:
        writer=csv.writer(f);writer.writerow(HEADERS);writer.writerows(rows)
    print(f'Converted {len(rows):,} records to {dest}')
if __name__=='__main__': main()
