import openpyxl, json
from pathlib import Path
xlsx = r'C:\Users\Ricos\Desktop\Fee Balances All Classes - Term 2  2026 (08-23-2026).xlsx'
overpaid = {
    '1221': 11500,
    '417': 10000,
    '1354': 1500,
    '232': 11800,
    '1270': 20000,
    '1271': 20500,
    '1453': 750,
    '1456': 500,
    '1051': 7000,
}
wb = openpyxl.load_workbook(xlsx, data_only=True, read_only=True)
ws = wb.active
balances = {}
blank_rows = []
for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
    adm_raw, balance_raw = row[0], row[1]
    if adm_raw is None or str(adm_raw).strip() == '':
        if balance_raw not in (None, ''):
            blank_rows.append({'row': idx, 'value': float(balance_raw)})
        continue
    adm = str(adm_raw).strip()
    if adm.endswith('.0'):
        adm = adm[:-2]
    balances[adm] = float(balance_raw or 0)
Path('tmp-reconcile/term2_inputs.json').write_text(json.dumps({
    'balances': balances,
    'overpaid': overpaid,
    'blankRows': blank_rows,
    'paymentDate': '2026-06-24',
    'paymentMethod': 'CASH',
    'referenceNumber': 'TERM2-RECON-2026-06-24'
}, indent=2))
print(json.dumps({
    'balanceRows': len(balances),
    'balanceSum': sum(balances.values()),
    'overpaidRows': len(overpaid),
    'overpaidSum': sum(overpaid.values()),
    'blankRows': blank_rows
}, indent=2))
