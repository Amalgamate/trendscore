insert into communication_configs (
  id,
  "smsProvider",
  "smsEnabled",
  "hasApiKey",
  "emailProvider",
  "emailEnabled",
  "mpesaProvider",
  "mpesaSandbox",
  "mpesaEnabled",
  "birthdayEnabled",
  "emailTemplates",
  "updatedAt"
)
select
  'kambigarba-auth-config',
  'mobilesasa',
  false,
  false,
  'resend',
  false,
  'intasend',
  false,
  false,
  false,
  '{"__security":{"otpEnabled":false}}'::jsonb,
  now()
where not exists (select 1 from communication_configs);

update communication_configs
set
  "emailTemplates" = jsonb_set(
    coalesce("emailTemplates", '{}'::jsonb),
    '{__security,otpEnabled}',
    'false'::jsonb,
    true
  ),
  "updatedAt" = now();

update users
set
  "loginAttempts" = 0,
  "lockedUntil" = null,
  "updatedAt" = now()
where role <> 'STUDENT';

select
  id,
  "smsEnabled",
  "emailTemplates"
from communication_configs;

select
  email,
  role,
  status,
  "loginAttempts",
  "lockedUntil"
from users
where role <> 'STUDENT'
order by role, email;
