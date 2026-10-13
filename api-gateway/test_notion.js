require('dotenv').config();
const axios = require('axios');

async function checkNotion() {
  const apiKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_DATABASE_ID;

  console.log('--- Notion Configuration Check ---');
  console.log('API Key Prefix:', apiKey ? apiKey.substring(0, 10) + '...' : '(missing)');
  console.log('Database ID:', dbId || '(missing)');

  if (!apiKey || !dbId) {
    console.error('Error: NOTION_API_KEY or NOTION_DATABASE_ID is missing in .env');
    return;
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Notion-Version': '2022-06-28',
  };

  try {
    const res = await axios.get(`https://api.notion.com/v1/databases/${dbId}`, { headers });
    console.log('\n[SUCCESS 200 OK]: Database verified!');
    console.log('Database Title:', res.data.title?.[0]?.plain_text || '(No title)');
    console.log('Database URL:', res.data.url);
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message;
    console.log(`\n[Status ${status}]:`, message);

    if (status === 404) {
      console.log('\n--> Why this happened:');
      console.log('Your API Key is VALID, but Notion has not been granted access to this database.');
      console.log('To fix this:');
      console.log('1. Open your "MonoMelt Reports" database page in Notion.');
      console.log('2. Click the "..." button at the top right.');
      console.log('3. Click "Connect to" (or "Add connections").');
      console.log('4. Select "MonoMelt Export".');
    }
  }
}

checkNotion();
