import openpyxl, json, collections, math
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
    if row[0] is None or str(row[0]).strip() == '':
        if row[1] not in (None, ''):
            blank_rows.append((idx, row[1]))
        continue
    adm = str(row[0]).strip()
    if adm.endswith('.0'):
        adm = adm[:-2]
    balances[adm] = float(row[1] or 0)
rows = json.loads(Path('tmp-reconcile/zawadi_term2_invoices.json').read_text().strip())
by_adm = {str(r['admissionNumber']).strip(): r for r in rows}
missing_bal = sorted([adm for adm in balances if adm not in by_adm])
missing_over = sorted([adm for adm in overpaid if adm not in by_adm])
overlap = sorted(set(balances) & set(overpaid))
plan=[]
skip=[]
for r in rows:
    adm = str(r['admissionNumber']).strip()
    current_balance = float(r['balance'] or 0) + float(r.get('transportBalance') or 0)
    total = float(r['totalAmount'] or 0) + float(r.get('transportBilled') or 0)
    paid = float(r['paidAmount'] or 0) + float(r.get('transportPaid') or 0)
    sponsor = float(r.get('sponsorBalance') or 0)
    if sponsor > 0.01:
        skip.append((adm, 'sponsor balance', sponsor))
        continue
    if adm in overpaid:
        target_balance = -float(overpaid[adm])
        target_status = 'OVERPAID'
        bucket = 'overpaid'
    elif adm in balances:
        target_balance = float(balances[adm])
        target_status = 'PARTIAL' if target_balance > 0 else 'PAID'
        bucket = 'balance_list'
    else:
        target_balance = 0.0
        target_status = 'PAID'
        bucket = 'paid_rest'
    payment_needed = round(current_balance - target_balance, 2)
    if abs(payment_needed) <= 0.01:
        payment_needed = 0.0
    if payment_needed < -0.01:
        skip.append((adm, 'current balance below target; would need reversal/adjustment', current_balance, target_balance))
        continue
    plan.append({
        'id': r['id'], 'adm': adm, 'name': f"{r['firstName']} {r['lastName']}", 'invoiceNumber': r['invoiceNumber'],
        'bucket': bucket, 'currentBalance': current_balance, 'targetBalance': target_balance,
        'paymentNeeded': payment_needed, 'targetStatus': target_status, 'currentStatus': r['status'],
        'total': total, 'paid': paid,
    })
summary = collections.Counter(p['bucket'] for p in plan)
pay_summary = {k: sum(p['paymentNeeded'] for p in plan if p['bucket']==k) for k in summary}
status_summary = collections.Counter(p['targetStatus'] for p in plan)
print('excel_valid_balance_rows', len(balances), 'excel_sum_balance', sum(balances.values()))
print('blank_excel_rows_with_balance', blank_rows)
print('overpaid_rows', len(overpaid), 'overpaid_sum', sum(overpaid.values()))
print('db_invoice_rows', len(rows))
print('missing_balance_admissions', missing_bal)
print('missing_overpaid_admissions', missing_over)
print('balance_overpaid_overlap', overlap)
print('skips_count', len(skip), skip[:20])
print('plan_count', len(plan))
print('bucket_counts', dict(summary))
print('payment_by_bucket', pay_summary)
print('target_status_counts', dict(status_summary))
print('payments_to_create', sum(1 for p in plan if p['paymentNeeded'] > 0), 'total_cash_payment', sum(p['paymentNeeded'] for p in plan))
print('target_total_balance', sum(p['targetBalance'] for p in plan))
print('sample_overpaid', [p for p in plan if p['bucket']=='overpaid'][:12])
print('sample_balance_payments', [p for p in plan if p['bucket']=='balance_list' and p['paymentNeeded']>0][:12])
Path('tmp-reconcile/zawadi_term2_plan.json').write_text(json.dumps({'plan': plan, 'skips': skip, 'balances': balances, 'overpaid': overpaid}, indent=2))
