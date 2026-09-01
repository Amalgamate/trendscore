import json, collections
from pathlib import Path
inputs = json.loads(Path('tmp-reconcile/term2_inputs.json').read_text())
balances = {str(k): float(v) for k, v in inputs['balances'].items()}
overpaid = {str(k): float(v) for k, v in inputs['overpaid'].items()}
rows = json.loads(Path('tmp-reconcile/fresh_term2_invoices.json').read_text().strip())
by_adm = {str(r['admissionNumber']).strip(): r for r in rows}
plan = []
anomalies = []
for adm in balances:
    if adm not in by_adm:
        anomalies.append({'type':'missing_balance_admission', 'adm': adm, 'targetBalance': balances[adm]})
for adm in overpaid:
    if adm not in by_adm:
        anomalies.append({'type':'missing_overpaid_admission', 'adm': adm, 'overpaid': overpaid[adm]})
for adm in sorted(set(balances) & set(overpaid)):
    anomalies.append({'type':'balance_and_overpaid_overlap', 'adm': adm})
for r in rows:
    adm = str(r['admissionNumber']).strip()
    fee_balance = float(r.get('balance') or 0)
    transport_balance = float(r.get('transportBalance') or 0)
    current_balance = round(fee_balance + transport_balance, 2)
    current_paid = round(float(r.get('paidAmount') or 0) + float(r.get('transportPaid') or 0), 2)
    billed = round(float(r.get('totalAmount') or 0) + float(r.get('transportBilled') or 0), 2)
    sponsor = float(r.get('sponsorBalance') or 0)
    if sponsor > 0.01:
        anomalies.append({'type':'sponsor_balance', 'adm': adm, 'invoiceNumber': r['invoiceNumber'], 'sponsorBalance': sponsor})
        continue
    if adm in overpaid:
        bucket = 'overpaid'
        target_balance = -overpaid[adm]
        target_status = 'OVERPAID'
    elif adm in balances:
        bucket = 'partial_balance'
        target_balance = balances[adm]
        target_status = 'PARTIAL' if target_balance > 0.01 else 'PAID'
    else:
        bucket = 'fully_paid'
        target_balance = 0.0
        target_status = 'PAID'
    payment_needed = round(current_balance - target_balance, 2)
    if payment_needed < -0.01:
        anomalies.append({'type':'negative_payment_needed', 'adm': adm, 'invoiceNumber': r['invoiceNumber'], 'currentBalance': current_balance, 'targetBalance': target_balance, 'paymentNeeded': payment_needed})
        continue
    if bucket == 'partial_balance' and billed <= 0.01:
        anomalies.append({'type':'partial_invoice_has_zero_billed_total', 'adm': adm, 'invoiceNumber': r['invoiceNumber'], 'currentBalance': current_balance, 'targetBalance': target_balance})
    if bucket != 'partial_balance' and billed <= 0.01 and payment_needed > 0.01:
        anomalies.append({'type':'paid_or_overpaid_invoice_has_zero_billed_total', 'adm': adm, 'invoiceNumber': r['invoiceNumber'], 'bucket': bucket, 'paymentNeeded': payment_needed})
    plan.append({
        'invoiceId': r['id'],
        'invoiceNumber': r['invoiceNumber'],
        'adm': adm,
        'name': f"{r['firstName']} {r['lastName']}",
        'grade': r.get('grade'),
        'bucket': bucket,
        'billed': billed,
        'currentPaid': current_paid,
        'currentBalance': current_balance,
        'targetBalance': round(target_balance, 2),
        'targetStatus': target_status,
        'paymentNeeded': payment_needed,
        'currentStatus': r['status'],
    })
summary = collections.Counter(p['bucket'] for p in plan)
status = collections.Counter(p['targetStatus'] for p in plan)
payments = [p for p in plan if p['paymentNeeded'] > 0.01]
report = {
    'invoiceRows': len(rows),
    'excelBalanceRows': len(balances),
    'excelBalanceSum': round(sum(balances.values()), 2),
    'overpaidRows': len(overpaid),
    'overpaidSum': round(sum(overpaid.values()), 2),
    'bucketCounts': dict(summary),
    'targetStatusCounts': dict(status),
    'paymentsToCreate': len(payments),
    'totalCashPaymentToRecord': round(sum(p['paymentNeeded'] for p in payments), 2),
    'targetBalancesPositive': round(sum(p['targetBalance'] for p in plan if p['targetBalance'] > 0), 2),
    'targetOverpaidCredit': round(-sum(p['targetBalance'] for p in plan if p['targetBalance'] < 0), 2),
    'anomalyCount': len(anomalies),
    'anomalies': anomalies[:50],
    'samplePartial': [p for p in plan if p['bucket']=='partial_balance'][:8],
    'sampleOverpaid': [p for p in plan if p['bucket']=='overpaid'][:9],
}
Path('tmp-reconcile/fresh_term2_plan.json').write_text(json.dumps({'report': report, 'plan': plan, 'payments': payments, 'anomalies': anomalies, 'inputs': inputs}, indent=2))
print(json.dumps(report, indent=2))
