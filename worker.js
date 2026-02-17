
/**
 * STOCKER - FULL ENGINE WORKER (ROBUST VERSION)
 * Features: API, Price Monitoring, and VAPID Handshake
 */

export default {
  // 1. API HANDLER (For the frontend app)
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, ""); // Normalize: remove trailing slash
    const userId = url.searchParams.get('userId') || request.headers.get('X-User-ID');

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-User-ID",
    };

    // Handle Preflight
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // Validate User (except for health check)
    if (!userId && path !== '/health') {
      return Response.json({ error: "Missing UserID" }, { status: 400, headers: corsHeaders });
    }

    try {
      // HEALTH CHECK
      if (path === '/health') return Response.json({ status: "ok" }, { headers: corsHeaders });

      // GET ALERTS
      if ((path === '' || path === '/') && request.method === 'GET') {
        const { results } = await env.DB.prepare("SELECT * FROM alerts WHERE userId = ? ORDER BY created_at DESC")
          .bind(userId).all();
        return Response.json(results || [], { headers: corsHeaders });
      }

      // GET LATEST TRIGGERED ALERT (For Poke-and-Fetch)
      if (path === '/latest' && request.method === 'GET') {
        const result = await env.DB.prepare("SELECT * FROM alerts WHERE userId = ? AND status = 'triggered' ORDER BY created_at DESC LIMIT 1")
          .bind(userId).first();
        return Response.json(result || { error: "No triggered alerts" }, { headers: corsHeaders });
      }

      // CREATE ALERT
      if ((path === '' || path === '/') && request.method === 'POST') {
        const alert = await request.json();
        const res = await env.DB.prepare(
          "INSERT INTO alerts (userId, ticker, target_price, condition, status) VALUES (?, ?, ?, ?, 'active')"
        ).bind(userId, alert.ticker, Number(alert.target_price), alert.condition).run();
        return Response.json({ success: true, id: res.meta.last_row_id }, { headers: corsHeaders });
      }

      // SUBSCRIBE (Save push token)
      if (path === '/subscribe' && request.method === 'POST') {
        const sub = await request.json();
        await env.DB.prepare("INSERT OR REPLACE INTO subscriptions (userId, subscription_json) VALUES (?, ?)")
          .bind(userId, JSON.stringify(sub)).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // UNSUBSCRIBE
      if (path === '/unsubscribe' && request.method === 'POST') {
        await env.DB.prepare("DELETE FROM subscriptions WHERE userId = ?").bind(userId).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // DELETE ALERT
      if (request.method === 'DELETE') {
        const id = path.split('/').filter(Boolean).pop();
        if (!isNaN(Number(id))) {
          await env.DB.prepare("DELETE FROM alerts WHERE id = ? AND userId = ?").bind(Number(id), userId).run();
          return Response.json({ success: true }, { headers: corsHeaders });
        }
      }

      return Response.json({ error: `Path not found: ${path}` }, { status: 404, headers: corsHeaders });
    } catch (e) {
      console.error("API Error:", e.message);
      return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
    }
  },

  // 2. CRON ENGINE (Runs every minute)
  async scheduled(event, env) {
    console.log("ENGINE: Starting scan...");
    
    // 1. Fetch all active alerts
    const { results: alerts } = await env.DB.prepare("SELECT * FROM alerts WHERE status = 'active'").all();
    
    if (!alerts || alerts.length === 0) {
      console.log("No active alerts to process.");
      return;
    }

    // 2. Efficiently fetch prices (Grouped by ticker)
    const uniqueTickers = [...new Set(alerts.map(a => a.ticker))];
    const priceMap = {};
    
    await Promise.all(uniqueTickers.map(async (ticker) => {
      const price = await fetchYahooPrice(ticker);
      if (price !== null) priceMap[ticker] = price;
    }));

    // 3. Process Hits
    for (const alert of alerts) {
      const currentPrice = priceMap[alert.ticker];
      if (currentPrice === undefined) continue;

      const isHit = 
        (alert.condition === 'above' && currentPrice >= alert.target_price) ||
        (alert.condition === 'below' && currentPrice <= alert.target_price);

      if (isHit) {
        // Atomic status update
        const updateResult = await env.DB.prepare("UPDATE alerts SET status = 'triggered' WHERE id = ? AND status = 'active'")
          .bind(alert.id)
          .run();

        if (updateResult.meta.changes > 0) {
          // Send "Poke" push (no body) to avoid encryption requirements
          await sendAuthenticatedPush(env, alert.userId);
        }
      }
    }
  }
};

/**
 * FETCH REAL-TIME PRICE FROM YAHOO
 */
async function fetchYahooPrice(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
  } catch (e) {
    return null;
  }
}

/**
 * SEND AUTHENTICATED PUSH (VAPID) - POKE METHOD
 */
async function sendAuthenticatedPush(env, userId) {
  try {
    const subRow = await env.DB.prepare("SELECT subscription_json FROM subscriptions WHERE userId = ?")
      .bind(userId)
      .first();

    if (!subRow) return;

    const sub = JSON.parse(subRow.subscription_json);
    const endpoint = new URL(sub.endpoint);

    // VAPID Auth Header
    const jwtHeader = b64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
    const jwtPayload = b64Url(JSON.stringify({
      aud: `${endpoint.protocol}//${endpoint.host}`,
      exp: Math.floor(Date.now() / 1000) + 43200,
      sub: env.VAPID_SUBJECT || 'mailto:admin@stocker.app'
    }));

    const signature = await signEcdsa(`${jwtHeader}.${jwtPayload}`, env.VAPID_PRIVATE_KEY);
    const vapidToken = `${jwtHeader}.${jwtPayload}.${signature}`;

    // SEND EMPTY BODY (Poke)
    // Browsers allow unencrypted empty bodies, but require encryption for any content.
    const pushResponse = await fetch(sub.endpoint, {
      method: 'POST',
      body: "", 
      headers: {
        'TTL': '60',
        'Urgency': 'high',
        'Authorization': `WebPush ${vapidToken}`,
        'Crypto-Key': `p256ecdsa=${env.VAPID_PUBLIC_KEY}`
      }
    });

    if (pushResponse.status === 410 || pushResponse.status === 404) {
       await env.DB.prepare("DELETE FROM subscriptions WHERE userId = ?").bind(userId).run();
    }
  } catch (e) {
    console.error("Push Error:", e.message);
  }
}

/**
 * CRYPTO HELPERS
 */
async function signEcdsa(data, privateKeyB64) {
  let cleanB64 = privateKeyB64
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/[\n\r\s]/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .trim();
    
  const paddedB64 = cleanB64.padEnd(cleanB64.length + (4 - cleanB64.length % 4) % 4, '=');
  const binary = Uint8Array.from(atob(paddedB64), c => c.charCodeAt(0));

  let key;
  try {
    key = await crypto.subtle.importKey(
      "pkcs8", binary, 
      { name: "ECDSA", namedCurve: "P-256" }, 
      false, ["sign"]
    );
  } catch (e) {
    if (binary.length === 32) {
      const pkcs8Header = new Uint8Array([
        0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
        0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01,
        0x01, 0x04, 0x20
      ]);
      const wrapped = new Uint8Array(pkcs8Header.length + binary.length);
      wrapped.set(pkcs8Header);
      wrapped.set(binary, pkcs8Header.length);
      
      key = await crypto.subtle.importKey(
        "pkcs8", wrapped,
        { name: "ECDSA", namedCurve: "P-256" },
        false, ["sign"]
      );
    } else {
      throw new Error(`Invalid Key Length. Check VAPID PRIVATE KEY.`);
    }
  }

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    key, new TextEncoder().encode(data)
  );
  return b64Url(new Uint8Array(sig));
}

function b64Url(input) {
  let b64 = typeof input === 'string' ? btoa(input) : btoa(String.fromCharCode(...input));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
