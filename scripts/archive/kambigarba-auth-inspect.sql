select
  email,
  role,
  status,
  "emailVerified",
  "verificationRequired",
  "loginAttempts",
  "lockedUntil",
  ("passwordResetToken" is not null) as has_reset_token,
  length(password) as password_len,
  "lastLogin"
from users
order by role, email
limit 120;

select
  role,
  status,
  count(*) as users,
  count(*) filter (where "emailVerified" = true) as email_verified,
  count(*) filter (where "verificationRequired" = true) as verification_required,
  count(*) filter (where "passwordResetToken" is not null) as must_change_password
from users
group by role, status
order by role, status;
