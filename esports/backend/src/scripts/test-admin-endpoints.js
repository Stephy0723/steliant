import axios from 'axios'

async function run() {
  const loginUrl = 'http://localhost:4000/api/auth/login';
  console.log(`Logging in to ${loginUrl}...`);
  
  const loginRes = await axios.post(loginUrl, {
    identifier: 'admin@gg.gg',
    password: 'Seed1234!'
  });
  
  console.log('Login successful! Headers:', loginRes.headers);
  const setCookie = loginRes.headers['set-cookie'];
  if (!setCookie) {
    console.error('No Set-Cookie header found in login response!');
    return;
  }
  
  // Extract token cookie value
  const cookieStr = setCookie.map(c => c.split(';')[0]).join('; ');
  console.log('Extracted cookie string:', cookieStr);
  
  const headers = { Cookie: cookieStr };
  
  try {
    const invRes = await axios.get('http://localhost:4000/api/brands/admin/invoices?status=all', { headers });
    console.log('GET /brands/admin/invoices?status=all successful!', invRes.data.length, 'invoices returned.');
    console.log('First invoice:', JSON.stringify(invRes.data[0], null, 2));
  } catch (e) {
    console.error('GET /brands/admin/invoices failed:', e.response?.status, e.response?.data || e.message);
  }
  
  try {
    const tckRes = await axios.get('http://localhost:4000/api/brands/admin/tickets?status=all', { headers });
    console.log('GET /brands/admin/tickets?status=all successful!', tckRes.data.length, 'tickets returned.');
    console.log('First ticket:', JSON.stringify(tckRes.data[0], null, 2));
  } catch (e) {
    console.error('GET /brands/admin/tickets failed:', e.response?.status, e.response?.data || e.message);
  }
}

run().catch(console.error);
