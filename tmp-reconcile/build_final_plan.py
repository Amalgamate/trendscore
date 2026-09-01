import json, collections
from pathlib import Path
inputs = json.loads(Path('tmp-reconcile/term2_inputs.json').read_text())
balances = {str(k): float(v) for k, v in inputs['balances'].items() if str(k) != '1376'}
overpaid = {str(k): float(v) for k, v in inputs['overpaid'].items()}
rows = json.loads(Path('tmp-reconcile/fresh_term2_invoices_after_bf.json').read_text().strip())
by_adm = {str(r['admissionNumber']).strip(): r for r in rows}
plan=[]; anomalies=[]
for adm in balances:
    if adm not in by_adm:
        anomalies.append({'type':'missing_balance_admission','adm':adm,'targetBalance':balances[adm]})
for adm in overpaid:
    if adm not in by_adm:
        anomalies.append({'type':'missing_overpaid_admission','adm':adm,'overpaid':overpaid[adm]})
for adm in sorted(set(balances) & set(overpaid)):
    anomalies.append({'type':'balance_and_overpaid_overlap','adm':adm})
for r in rows:
    adm=str(r['admissionNumber']).strip()
    current_balance=round(float(r.get('balance') or 0)+float(r.get('transportBalance') or 0),2)
    current_paid=round(float(r.get('paidAmount') or 0)+float(r.get('transportPaid') or 0),2)
    billed=round(float(r.get('totalAmount') or 0)+float(r.get('transportBilled') or 0),2)
    sponsor=float(r.get('sponsorBalance') or 0)
    if sponsor > 0.01:
        anomalies.append({'type':'sponsor_balance','adm':adm,'invoiceNumber':r['invoiceNumber'],'sponsorBalance':sponsor})
        continue
    if adm in overpaid:
        bucket='overpaid'; target_balance=-overpaid[adm]
    elif adm in balances:
        bucket='partial_balance'; target_balance=balances[adm]
    else:
        bucket='fully_paid'; target_balance=0.0
    payment_needed=round(current_balance-target_balance,2)
    if payment_needed < -0.01:
        anomalies.append({'type':'negative_payment_needed','adm':adm,'invoiceNumber':r['invoiceNumber'],'currentBalance':current_balance,'targetBalance':target_balance,'paymentNeeded':payment_needed})
        continue
    target_paid=round(current_paid + max(0,payment_needed),2)
    if target_paid > billed + 0.01:
        target_status='OVERPAID'
    elif target_balance <= 0.01:
        target_status='PAID'
    elif target_paid > 0.01:
        target_status='PARTIAL'
    else:
        target_status='PENDING'
    plan.append({'invoiceId':r['id'],'invoiceNumber':r['invoiceNumber'],'adm':adm,'name':f"{r['firstName']} {r['lastName']}",'grade':r.get('grade'),'bucket':bucket,'billed':billed,'currentPaid':current_paid,'currentBalance':current_balance,'targetBalance':round(target_balance,2),'targetStatus':target_status,'paymentNeeded':payment_needed,'currentStatus':r['status']})
summary=collections.Counter(p['bucket'] for p in plan); status=collections.Counter(p['targetStatus'] for p in plan); payments=[p for p in plan if p['paymentNeeded']>0.01]
report={'invoiceRows':len(rows),'ignoredAdmissions':['1376'],'excelBalanceRowsUsed':len(balances),'excelBalanceSumUsed':round(sum(balances.values()),2),'overpaidRows':len(overpaid),'overpaidSum':round(sum(overpaid.values()),2),'bucketCounts':dict(summary),'targetStatusCounts':dict(status),'paymentsToCreate':len(payments),'totalCashPaymentToRecord':round(sum(p['paymentNeeded'] for p in payments),2),'targetBalancesPositive':round(sum(p['targetBalance'] for p in plan if p['targetBalance']>0),2),'targetOverpaidCredit':round(-sum(p['targetBalance'] for p in plan if p['targetBalance']<0),2),'anomalyCount':len(anomalies),'anomalies':anomalies[:50],'bfOnlyPending':[p for p in plan if p['bucket']=='partial_balance' and p['paymentNeeded']<=0.01]}
Path('tmp-reconcile/final_term2_plan.json').write_text(json.dumps({'report':report,'plan':plan,'payments':payments,'anomalies':anomalies,'inputs':inputs}, indent=2))
print(json.dumps(report, indent=2))
