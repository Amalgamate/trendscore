import axios from 'axios';

const API_URL = 'http://localhost:5000/api';
const DEMO_PASSWORD = 'Demo@2024';

const testAccounts = [
  'admin@cbc-demo.zawadi.co.ke',
  'admin@secondary-demo.zawadi.co.ke',
  'admin@tertiary-demo.zawadi.co.ke',
];

async function testLogin(email) {
  try {
    const res = await axios.post(`${API_URL}/auth/login`, {
      email,
      password: DEMO_PASSWORD,
    });
    console.log(`\nTesting: ${email}`);
    console.log(`  Success: ${res.data.success}`);
    console.log(`  User InstitutionType: ${res.data.user.institutionType}`);
    
    const token = res.data.token;
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    console.log(`  JWT InstitutionType: ${payload.institutionType}`);
    
    if (res.data.user.institutionType === payload.institutionType) {
      console.log('  ✅ MATCH');
    } else {
      console.log('  ❌ MISMATCH');
    }
  } catch (err) {
    console.error(`  ❌ FAILED: ${err.response?.data?.message || err.message}`);
  }
}

async function run() {
  console.log('🚀 Starting Phase 2 Auth Layer Verification...\n');
  for (const account of testAccounts) {
    await testLogin(account);
  }
}

run();
