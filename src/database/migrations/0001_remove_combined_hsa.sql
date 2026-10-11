DELETE FROM balances
WHERE account_id IN (
  SELECT id FROM accounts
  WHERE connection_id = 'benepass'
    AND active = 0
    AND json_extract(payload, '$.name') = 'Benepass HSA'
    AND json_extract(payload, '$.provider_account_id') NOT LIKE '%/%'
);
--> statement-breakpoint
DELETE FROM holdings
WHERE account_id IN (
  SELECT id FROM accounts
  WHERE connection_id = 'benepass'
    AND active = 0
    AND json_extract(payload, '$.name') = 'Benepass HSA'
    AND json_extract(payload, '$.provider_account_id') NOT LIKE '%/%'
);
--> statement-breakpoint
DELETE FROM transactions
WHERE account_id IN (
  SELECT id FROM accounts
  WHERE connection_id = 'benepass'
    AND active = 0
    AND json_extract(payload, '$.name') = 'Benepass HSA'
    AND json_extract(payload, '$.provider_account_id') NOT LIKE '%/%'
);
--> statement-breakpoint
DELETE FROM preferences
WHERE account_id IN (
  SELECT id FROM accounts
  WHERE connection_id = 'benepass'
    AND active = 0
    AND json_extract(payload, '$.name') = 'Benepass HSA'
    AND json_extract(payload, '$.provider_account_id') NOT LIKE '%/%'
);
--> statement-breakpoint
DELETE FROM account_aliases
WHERE account_id IN (
  SELECT id FROM accounts
  WHERE connection_id = 'benepass'
    AND active = 0
    AND json_extract(payload, '$.name') = 'Benepass HSA'
    AND json_extract(payload, '$.provider_account_id') NOT LIKE '%/%'
);
--> statement-breakpoint
DELETE FROM accounts
WHERE connection_id = 'benepass'
  AND active = 0
  AND json_extract(payload, '$.name') = 'Benepass HSA'
  AND json_extract(payload, '$.provider_account_id') NOT LIKE '%/%';
