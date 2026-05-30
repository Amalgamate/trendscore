const axios = require('axios');

async function testEnableAll() {
  try {
    // Login first
    console.log('🔐 Logging in...');
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@trendscore.app',
      password: 'Admin@123!'
    });

    const token = loginRes.data.token;
    console.log(`✅ Token received: ${token.substring(0, 20)}...`);

    // Call enable-all
    console.log('\n📊 Calling PATCH /settings/apps/enable-all...');
    const enableRes = await axios.patch(
      'http://localhost:5000/api/settings/apps/enable-all',
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('\n✅ Response:', JSON.stringify(enableRes.data, null, 2));

    // Now check the database to verify
    console.log('\n🔍 Checking database state...');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execPromise = promisify(exec);
    
    try {
      await execPromise('node check-apps-state.js', { cwd: __dirname });
    } catch (e) {
      // Ignore - just for reference
    }
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testEnableAll();
