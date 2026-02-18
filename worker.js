/**
 * STOCKER - FULL ENGINE WORKER
 * Optimized for Cloudflare Workers with fixed type overloads.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, ""); 
    const userId = url.searchParams.get('userId') || request.headers.get('X-User-ID');

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-User-ID",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (!userId && path !== '/health') return Response.json({ error: "Missing UserID" }, { status: 400, headers: corsHeaders });

    try {
      if (path === '/health') return Response.json({ status: "ok" }, { headers: corsHeaders });

      // Get Alerts
      if ((path === '' || path === '/') && request.method === 'GET') {
        const { results } = await env.DB.prepare("SELECT * FROM alerts WHERE userId = ? ORDER BY created_at DESC").bind(userId).all();
        return Response.json(results || [], { headers: corsHeaders });
      }

      // Create Alert
      if ((path === '' || path === '/') && request.method === 'POST') {
        const alert = await request.json();
        const res = await env.DB.prepare(
          "INSERT INTO alerts (userId, ticker, target_price, condition, status) VALUES (?, ?, ?, ?, 'active')"
        ).bind(userId, alert.ticker, Number(alert.target_price), alert.condition).run();
        return Response.json({ success: true, id: res.meta.last_row_id }, { headers: corsHeaders });
      }

      // WebPush Subscriptions
      if (path === '/subscribe' && request.method === 'POST') {
        const sub = await request.json();
        await env.DB.prepare("INSERT OR REPLACE INTO subscriptions (userId, subscription_json) VALUES (?, ?)")
          .bind(userId, JSON.stringify(sub)).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path === '/unsubscribe' && request.method === 'POST') {
        await env.DB.prepare("DELETE FROM subscriptions WHERE userId = ?").bind(userId).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // Delete Alert
      if (request.method === 'DELETE') {
        const id = path.split('/').filter(Boolean).pop();
        if (!isNaN(Number(id))) {
          await env.DB.prepare("DELETE FROM alerts WHERE id = ? AND userId = ?").bind(Number(id), userId).run();
          return Response.json({ success: true }, { headers: corsHeaders });
        }
      }

      return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
    }
  },

  /**
   * Periodic check for triggered alerts
   */
  async scheduled(event, env) {
    const { results: alerts } = await env.DB.prepare("SELECT * FROM alerts WHERE status = 'active'").all();
    if (!alerts || alerts.length === 0) return;

    const uniqueTickers = [...new Set(alerts.map(a => a.ticker))];
    const priceMap = {};
    
    await Promise.all(uniqueTickers.map(async (ticker) => {
      const price = await fetchYahooPrice(ticker);
      if (price !== null) priceMap[ticker] = price;
    }));

    for (const alert of alerts) {
      const currentPrice = priceMap[alert.ticker];
      if (currentPrice === undefined) continue;

      const isHit = 
        (alert.condition === 'above' && currentPrice >= alert.target_price) ||
        (alert.condition === 'below' && currentPrice <= alert.target_price);

      if (isHit) {
        // Mark as triggered first to prevent double-sends
        const updateResult = await env.DB.prepare("UPDATE alerts SET status = 'triggered' WHERE id = ? AND status = 'active'")
          .bind(alert.id).run();

        if (updateResult.meta.changes > 0) {
          const payload = {
            title: `Target Hit: ${alert.ticker}`,
            body: `${alert.ticker} reached ${alert.target_price}. Current: ${currentPrice.toFixed(2)}`,
            url: '/alerts'
          };
          await sendEncryptedPush(env, alert.userId, payload);
        }
      }
    }
  }
};

async function fetchYahooPrice(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
  } catch (e) { return null; }
}

async function sendEncryptedPush(env, userId, payloadObj) {
  const subRow = await env.DB.prepare("SELECT subscription_json FROM subscriptions WHERE userId = ?").bind(userId).first();
  if (!subRow) return;

  const sub = JSON.parse(subRow.subscription_json);
  const payload = new TextEncoder().encode(JSON.stringify(payloadObj));

  const endpoint = new URL(sub.endpoint);
  const jwtHeader = b64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const jwtPayload = b64Url(JSON.stringify({
    aud: `${endpoint.protocol}//${endpoint.host}`,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: 'mailto:admin@stocker.app'
  }));
  
  const privateKeyRaw = env['VAPID_PRIVATE_KEY'];
  const signature = await signEcdsa(`${jwtHeader}.${jwtPayload}`, privateKeyRaw);
  const vapidToken = `${jwtHeader}.${jwtPayload}.${signature}`;

  const { encryptedPayload } = await encryptWebPush(sub, payload);

  await fetch(sub.endpoint, {
    method: 'POST',
    body: encryptedPayload,
    headers: {
      'TTL': '60',
      'Urgency': 'high',
      'Content-Encoding': 'aes128gcm',
      'Authorization': `WebPush ${vapidToken}`
    }
  });
}

/**
 * MANDATORY WEB PUSH ENCRYPTION (AES-128-GCM)
 */
async function encryptWebPush(subscription, payload) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Generate local key pair for the handshake
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, 
    true, 
    ['deriveBits']
  );
  
  const serverPubKey = await crypto.subtle.importKey(
    'raw', 
    b64ToUint8(subscription.keys.p256dh), 
    { name: 'ECDH', namedCurve: 'P-256' }, 
    true, 
    []
  );

  // Use 'any' cast for deriveBits to resolve union type issue in CF Editor
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: serverPubKey }, 
    keyPair.privateKey, 
    256
  );

  const exportedLocalPub = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const localPublicKeyRaw = new Uint8Array(/** @type {any} */ (exportedLocalPub));

  const prk = await hmacSha256(salt, new Uint8Array(/** @type {any} */ (sharedSecret)));
  
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");

  const cek = (await hmacSha256(prk, cekInfo)).slice(0, 16);
  const nonce = (await hmacSha256(prk, nonceInfo)).slice(0, 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  
  const padding = new Uint8Array([0, 0]); 
  const dataToEncrypt = new Uint8Array(padding.length + payload.length);
  dataToEncrypt.set(padding);
  dataToEncrypt.set(payload, padding.length);

  const ciphertextBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, dataToEncrypt);
  const ciphertext = new Uint8Array(/** @type {any} */ (ciphertextBuffer));

  // Construct final Web Push binary structure
  const final = new Uint8Array(16 + 4 + 1 + 65 + ciphertext.byteLength);
  final.set(salt, 0);
  final.set(new Uint8Array([0, 0, 16, 0]), 16); 
  final.set([65], 20); 
  final.set(localPublicKeyRaw, 21);
  final.set(ciphertext, 21 + 65);

  return { encryptedPayload: final };
}

async function hmacSha256(key, data) {
  const k = await crypto.subtle.importKey(
    'raw', 
    key, 
    { name: 'HMAC', hash: 'SHA-256' }, 
    false, 
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', k, data);
  return new Uint8Array(/** @type {any} */ (signature));
}

async function signEcdsa(data, privateKeyB64) {
  const binary = b64ToUint8(privateKeyB64.replace(/---.*---|\n/g, ''));
  const keyData = binary.length === 32 ? wrap32(binary) : binary;
  const key = await crypto.subtle.importKey(
    "pkcs8", 
    /** @type {any} */ (keyData), 
    { name: "ECDSA", namedCurve: "P-256" }, 
    false, 
    ["sign"]
  );
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(data));
  return b64Url(new Uint8Array(/** @type {any} */ (sig)));
}

function wrap32(bin) {
  const head = new Uint8Array([0x30,0x41,0x02,0x01,0x00,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,0x3d,0x02,0x01,0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,0x04,0x27,0x30,0x25,0x02,0x01,0x01,0x04,0x20]);
  const r = new Uint8Array(head.length + 32); r.set(head); r.set(bin, head.length); return r;
}

function b64ToUint8(b64) {
  return Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

function b64Url(input) {
  let b64 = typeof input === 'string' ? btoa(input) : btoa(String.fromCharCode(...input));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}