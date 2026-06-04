import 'dotenv/config';

const API_KEY = process.env.SHIPAWAY_API_KEY;
const PHONE = process.env.SHIPAWAY_PHONE || '0000000000';
const BASE_URL = 'https://shipaway.io';

if (!API_KEY) {
  console.error('ERROR: SHIPAWAY_API_KEY not set. Copy .env.example to .env and add your API key.');
  process.exit(1);
}

let sessionCookie = null;

async function getSession() {
  const res = await fetch(`${BASE_URL}/api/v1/user/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid: API_KEY }),
  });

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/session=([^;]+)/);
    if (match) {
      sessionCookie = match[1];
    }
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error('Failed to authenticate with ShipAway');
  }

  return data;
}

export async function createLabel(sender, recipient, pkg, orderRef, serviceSpeed) {
  // Ensure we have a session cookie
  if (!sessionCookie) {
    await getSession();
  }

  const body = {
    uuid: API_KEY,
    service_speed: serviceSpeed || 'USPS Priority (9488 Series)',
    sender: {
      name: sender.name,
      company: sender.company || '',
      address1: sender.address1 || sender.street,
      address2: sender.address2 || sender.street2 || '',
      city: sender.city,
      state: sender.state,
      postal_code: sender.postal_code || sender.zip,
      phone: sender.phone || PHONE,
    },
    recipient: {
      name: recipient.name,
      company: recipient.company || '',
      address1: recipient.address1 || recipient.street,
      address2: recipient.address2 || recipient.street2 || '',
      city: recipient.city,
      state: recipient.state,
      postal_code: recipient.postal_code || recipient.zip,
      phone: recipient.phone || '0000000000',
    },
    package: {
      length: pkg.length || 12,
      width: pkg.width || 10,
      height: pkg.height || 6,
      weight: pkg.weight || 2,
      description: pkg.description || 'Trading Cards',
      references: orderRef ? [orderRef] : [],
    },
  };

  const res = await fetch(`${BASE_URL}/api/v1/usps/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session=${sessionCookie}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`ShipAway API returned non-JSON: ${text.slice(0, 200)}`);
  }

  // If session expired, retry once with a fresh session
  if (!data.success && !data.data) {
    sessionCookie = null;
    await getSession();

    const retryRes = await fetch(`${BASE_URL}/api/v1/usps/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session=${sessionCookie}`,
      },
      body: JSON.stringify(body),
    });

    const retryText = await retryRes.text();
    try {
      data = JSON.parse(retryText);
    } catch {
      throw new Error(`ShipAway API returned non-JSON on retry: ${retryText.slice(0, 200)}`);
    }
  }

  if (!data.success) {
    throw new Error(data.message || 'ShipAway API error');
  }

  return data;
}

export async function listServices() {
  const res = await fetch(`${BASE_URL}/api/v1/usps/list`);
  return res.json();
}

export async function getUserInfo() {
  const data = await getSession();
  return data;
}
