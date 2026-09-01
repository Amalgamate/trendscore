import json, openpyxl
from pathlib import Path
rows=json.loads(Path('tmp-reconcile/fresh_term2_invoices.json').read_text().strip())
for adm in ['1376','1378']:
    matches=[r for r in rows if str(r.get('admissionNumber')).strip()==adm]
    print(adm, 'db_matches', len(matches), matches[:3])
wb=openpyxl.load_workbook(r'C:\Users\Ricos\Desktop\Fee Balances All Classes - Term 2  2026 (08-23-2026).xlsx', data_only=True, read_only=True)
ws=wb.active
for idx,row in enumerate(ws.iter_rows(min_row=1, values_only=True), start=1):
    adm='' if row[0] is None else str(row[0]).strip().replace('.0','')
    if adm in {'1376','1378'}:
        print('excel_row', idx, row)
