import json, openpyxl
from pathlib import Path
plan = json.loads(Path('tmp-reconcile/fresh_term2_plan.json').read_text())
anoms = plan['anomalies']
print(json.dumps(anoms, indent=2))
wb=openpyxl.load_workbook(r'C:\Users\Ricos\Desktop\Fee Balances All Classes - Term 2  2026 (08-23-2026).xlsx', data_only=True, read_only=True)
ws=wb.active
wanted={'1376','1132','1439','341','573','574'}
for idx,row in enumerate(ws.iter_rows(min_row=1, values_only=True), start=1):
    adm='' if row[0] is None else str(row[0]).strip().replace('.0','')
    if adm in wanted:
        print('excel_row', idx, row)
