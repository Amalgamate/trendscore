import json, re, uuid
from pathlib import Path
plan_doc=json.loads(Path('tmp-reconcile/final_term2_plan.json').read_text())
payments=plan_doc['payments']
setup=json.loads(Path('tmp-reconcile/accounting_setup.json').read_text())
recorder=json.loads(Path('tmp-reconcile/recorder_users.json').read_text())[0]['id']
cash_account=setup['cashAccount']; ar_account=setup['arAccount']; journal=setup['cashJournal']
max_receipt=setup.get('maxReceipt')
last_seq=0
if max_receipt:
    m=re.search(r'(\d+)$', max_receipt)
    last_seq=int(m.group(1)) if m else 0
payment_date='2026-06-24'
method='CASH'
reference='TERM2-RECON-2026-06-24'
notes='Term 2 2026 cash reconciliation from fee balance workbook; 1376 excluded for manual handling'
lines=[]
entry_lines=[]
for idx,p in enumerate(payments, start=1):
    pay_id=str(uuid.uuid4())
    entry_id=str(uuid.uuid4())
    debit_id=str(uuid.uuid4())
    credit_id=str(uuid.uuid4())
    receipt=f"RCP-2026-{last_seq+idx:06d}"
    amount=round(float(p['paymentNeeded']),2)
    safe_name=p['name'].replace("'", "''")
    label=f"Fee Payment Received: {receipt}".replace("'", "''")
    set_label=f"Settlement: {receipt}".replace("'", "''")
    lines.append(f"('{pay_id}', '{entry_id}', '{p['invoiceId']}', '{p['invoiceNumber'].replace("'", "''")}', '{p['adm'].replace("'", "''")}', '{receipt}', {amount:.2f}, {float(p['currentBalance']):.2f}, {float(p['targetBalance']):.2f}, '{p['targetStatus']}', '{safe_name}')")
    entry_lines.append((entry_id, debit_id, credit_id, receipt, amount, label, set_label))
values=',\n  '.join(lines)
entry_values=',\n  '.join([f"('{e}', '{r}', {a:.2f})" for e,_,_,r,a,_,_ in entry_lines])
item_values=[]
for e,d,c,r,a,label,set_label in entry_lines:
    item_values.append(f"('{d}', '{e}', '{cash_account}', {a:.2f}, 0.00, '{label}')")
    item_values.append(f"('{c}', '{e}', '{ar_account}', 0.00, {a:.2f}, '{set_label}')")
sql=f"""
BEGIN;
CREATE TEMP TABLE term2_reconcile_payments (
  payment_id uuid PRIMARY KEY,
  entry_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  invoice_number text NOT NULL,
  admission_number text NOT NULL,
  receipt_number text NOT NULL,
  amount numeric(15,2) NOT NULL,
  expected_current_balance numeric(15,2) NOT NULL,
  target_balance numeric(15,2) NOT NULL,
  target_status text NOT NULL,
  learner_name text NOT NULL
) ON COMMIT DROP;

INSERT INTO term2_reconcile_payments
(payment_id, entry_id, invoice_id, invoice_number, admission_number, receipt_number, amount, expected_current_balance, target_balance, target_status, learner_name)
VALUES
  {values};

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM term2_reconcile_payments) <> {len(payments)} THEN
    RAISE EXCEPTION 'Unexpected payment row count';
  END IF;

  IF EXISTS (
    SELECT 1 FROM fee_payments WHERE "referenceNumber" = '{reference}' AND archived = false
  ) THEN
    RAISE EXCEPTION 'Reconciliation payments with reference {reference} already exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM term2_reconcile_payments rp
    JOIN fee_invoices fi ON fi.id = rp.invoice_id
    WHERE fi.archived = true
       OR ABS((fi.balance + COALESCE(fi."transportBalance", 0)) - rp.expected_current_balance) > 0.01
  ) THEN
    RAISE EXCEPTION 'Invoice balances changed since dry-run';
  END IF;
END $$;

INSERT INTO fee_payments
(id, "receiptNumber", "invoiceId", amount, "paymentMethod", "paymentDate", "referenceNumber", "payerType", notes, "createdAt", "recordedBy", archived, "transportAmount")
SELECT payment_id, receipt_number, invoice_id, amount, '{method}', '{payment_date}'::timestamp, '{reference}', 'STUDENT', '{notes.replace("'", "''")}', NOW(), '{recorder}', false, 0.00
FROM term2_reconcile_payments
ORDER BY receipt_number;

UPDATE fee_invoices fi
SET
  "paidAmount" = fi."paidAmount" + rp.amount,
  balance = fi.balance - rp.amount,
  status = rp.target_status::"PaymentStatus",
  "updatedAt" = NOW()
FROM term2_reconcile_payments rp
WHERE fi.id = rp.invoice_id;

CREATE TEMP TABLE term2_reconcile_entries(entry_id uuid PRIMARY KEY, receipt_number text NOT NULL, amount numeric(15,2) NOT NULL) ON COMMIT DROP;
INSERT INTO term2_reconcile_entries(entry_id, receipt_number, amount)
VALUES
  {entry_values};

INSERT INTO journal_entries
(id, date, reference, "journalId", status, "createdAt", "updatedAt")
SELECT entry_id, '{payment_date}'::timestamp, receipt_number, '{journal}', 'POSTED', NOW(), NOW()
FROM term2_reconcile_entries
ORDER BY receipt_number;

INSERT INTO journal_items
(id, "entryId", "accountId", debit, credit, label)
VALUES
  {',\n  '.join(item_values)};

COMMIT;
"""
Path('tmp-reconcile/apply_term2_payments.sql').write_text(sql)
print(json.dumps({'payments':len(payments),'totalAmount':round(sum(float(p['paymentNeeded']) for p in payments),2),'firstReceipt':f"RCP-2026-{last_seq+1:06d}",'lastReceipt':f"RCP-2026-{last_seq+len(payments):06d}",'reference':reference,'recorder':recorder}, indent=2))
