SELECT json_build_object(
  'maxReceipt', (SELECT MAX("receiptNumber") FROM fee_payments),
  'cashAccount', (SELECT id FROM accounts WHERE code = '1200' LIMIT 1),
  'arAccount', (SELECT id FROM accounts WHERE code = '1100' LIMIT 1),
  'cashJournal', (SELECT id FROM journals WHERE code = 'CSH1' LIMIT 1)
);
