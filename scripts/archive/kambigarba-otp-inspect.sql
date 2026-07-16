select
  id,
  "emailTemplates"
from communication_configs
limit 3;

select
  email,
  phone,
  role,
  status,
  "phoneVerificationCode",
  "phoneVerificationSentAt",
  "emailVerified",
  "verificationRequired",
  "loginAttempts",
  "lockedUntil"
from users
where role <> 'STUDENT'
order by role, email;
