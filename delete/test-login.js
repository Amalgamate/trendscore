const axios = require('axios');

async function testLogin() {
  try {
    console.log('🔐 Logging in...');
    const res = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@trendscore.app',
      password: 'Admin@123!'
    });

    console.log('Full response:', JSON.stringify(res.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testLogin();
