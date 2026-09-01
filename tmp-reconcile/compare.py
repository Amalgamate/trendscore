import openpyxl, json, collections
from pathlib import Path
xlsx = r'C:\Users\Ricos\Desktop\Fee Balances All Classes - Term 2  2026 (08-23-2026).xlsx'
wb = openpyxl.load_workbook(xlsx, data_only=True, read_only=True)
ws = wb.active
balances=[]
for row in ws.iter_rows(min_row=2, values_only=True):
    if row[0] is None:
        continue
    adm=str(row[0]).strip()
    if adm.endswith('.0'):
        adm=adm[:-2]
    bal=float(row[1] or 0)
    balances.append((adm, bal))
print('excel_rows', len(balances), 'sum_balance', sum(b for _,b in balances))
print('excel_dupes', [x for x,c in collections.Counter(a for a,_ in balances).items() if c>1])
print('excel_contains_1001', [x for x in balances if x[0]=='1001'])
text=Path('tmp-reconcile/zawadi_term2_invoices.json').read_text().strip()
rows=json.loads(text)
print('db_rows', len(rows))
print('db_status_counts', dict(collections.Counter(r['status'] for r in rows)))
print('db_total', sum(float(r['totalAmount'] or 0) for r in rows), 'paid', sum(float(r['paidAmount'] or 0) for r in rows), 'balance', sum(float(r['balance'] or 0) for r in rows))
adms=[str(r['admissionNumber']).strip() for r in rows]
print('db_dupes', [x for x,c in collections.Counter(adms).items() if c>1])
missing=[a for a,_ in balances if a not in set(adms)]
print('excel_missing_exact_count', len(missing), missing[:30])
print('adm_prefixed', [r['admissionNumber'] for r in rows if str(r['admissionNumber']).startswith('ADM-')][:20])
