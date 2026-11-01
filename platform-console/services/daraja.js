'use strict';

function configuration() {
  const environment = String(process.env.MPESA_DARAJA_ENV || 'sandbox').toLowerCase();
  return {
    environment,
    consumerKey: process.env.MPESA_DARAJA_CONSUMER_KEY || '',
    consumerSecret: process.env.MPESA_DARAJA_CONSUMER_SECRET || '',
    shortcode: process.env.MPESA_DARAJA_SHORTCODE || '508885',
    initiatorName: process.env.MPESA_DARAJA_INITIATOR_NAME || '',
    securityCredential: process.env.MPESA_DARAJA_SECURITY_CREDENTIAL || '',
    callbackBaseUrl: String(process.env.MPESA_DARAJA_CALLBACK_BASE_URL || '').replace(/\/$/, ''),
    callbackToken: process.env.MPESA_DARAJA_CALLBACK_TOKEN || '',
    b2cEnabled: process.env.MPESA_B2C_ENABLED === 'true',
  };
}

function baseUrl(environment) {
  if (environment === 'production') return 'https://api.safaricom.co.ke';
  if (environment === 'sandbox') return 'https://sandbox.safaricom.co.ke';
  throw new Error('MPESA_DARAJA_ENV must be sandbox or production');
}

function configurationStatus() {
  const config = configuration();
  const core = Boolean(config.consumerKey && config.consumerSecret && config.shortcode);
  const callback = Boolean(config.callbackBaseUrl.startsWith('https://') && config.callbackToken);
  return {
    environment: config.environment,
    configured: core,
    c2bReady: core && callback,
    b2cReady: core && callback && Boolean(config.initiatorName && config.securityCredential),
    b2cEnabled: config.b2cEnabled,
    callbackBaseUrlConfigured: callback,
    shortcode: config.shortcode ? `${config.shortcode.slice(0, 2)}…${config.shortcode.slice(-2)}` : '',
  };
}

async function accessToken() {
  const config = configuration();
  if (!config.consumerKey || !config.consumerSecret) throw new Error('Set MPESA_DARAJA_CONSUMER_KEY and MPESA_DARAJA_CONSUMER_SECRET first');
  const response = await fetch(`${baseUrl(config.environment)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64')}` },
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(`Daraja authentication failed (HTTP ${response.status})`);
  return payload.access_token;
}

async function post(path, body) {
  const config = configuration();
  const token = await accessToken();
  const response = await fetch(`${baseUrl(config.environment)}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errorCode) {
    const reason = String(payload.errorMessage || payload.errorDescription || `HTTP ${response.status}`).slice(0, 300);
    throw new Error(`Daraja request failed: ${reason}`);
  }
  return payload;
}

async function registerC2BUrls() {
  const config = configuration();
  if (!configurationStatus().c2bReady) throw new Error('Configure Daraja credentials, an HTTPS callback base URL, and MPESA_DARAJA_CALLBACK_TOKEN first');
  const root = `${config.callbackBaseUrl}/api/mpesa/c2b/${encodeURIComponent(config.callbackToken)}`;
  return post('/mpesa/c2b/v1/registerurl', {
    ShortCode: config.shortcode,
    ResponseType: 'Completed',
    ConfirmationURL: `${root}/confirmation`,
    ValidationURL: `${root}/validation`,
  });
}

async function submitB2CPayout({ amount, phone, payoutId }) {
  const config = configuration();
  const status = configurationStatus();
  if (!status.b2cReady || !status.b2cEnabled) throw new Error('Daraja B2C is disabled or not configured; an operator must configure credentials and explicitly set MPESA_B2C_ENABLED=true');
  const root = `${config.callbackBaseUrl}/api/mpesa/b2c/${encodeURIComponent(config.callbackToken)}`;
  return post('/mpesa/b2c/v1/paymentrequest', {
    InitiatorName: config.initiatorName,
    SecurityCredential: config.securityCredential,
    CommandID: 'BusinessPayment',
    Amount: amount,
    PartyA: config.shortcode,
    PartyB: phone,
    Remarks: `TrendSCORE agent commission payout ${payoutId}`.slice(0, 100),
    QueueTimeOutURL: `${root}/timeout`,
    ResultURL: `${root}/result`,
    Occasion: payoutId.slice(0, 100),
  });
}

module.exports = { configurationStatus, registerC2BUrls, submitB2CPayout };
