/**
 * STOCKER - FULL ENGINE WORKER (BATTLE-TESTED)
 * Features: API, Price Monitoring, and VAPID Handshake
 */

export default {
  // 1. API HANDLER (For the frontend app)
  async fetch(request, env) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || request.headers.get('X-User-ID');

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-User-ID",
    };

    // Handle Preflight
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // Validate User
    if (!userId && url.pathname !== '/health') {
      return Response.json({ error: "Missing UserID" }, { status: 400, headers: corsHeaders });
    }

    try {
      // HEALTH CHECK
      if (url.pathname === '/health') return Response.json({ status: "ok" }, { headers: corsHeaders });

      // GET ALERTS
      if (url.pathname === '/' && request.method === 'GET') {
        const { results } = await env.DB.prepare("SELECT * FROM alerts WHERE userId = ? ORDER BY created_at DESC")
          .bind(userId).all();
        return Response.json(results || [], { headers: corsHeaders });
      }

      // CREATE ALERT
      if (url.pathname === '/' && request.method === 'POST') {
        const alert = await request.json();
        const res = await env.DB.prepare(
          "INSERT INTO alerts (userId, ticker, target_price, condition, status) VALUES (?, ?, ?, ?, 'active')"
        ).bind(userId, alert.ticker, Number(alert.target_price), alert.condition).run();
        return Response.json({ success: true, id: res.meta.last_row_id }, { headers: corsHeaders });
      }

      // SUBSCRIBE (Save phone's push token)
      if (url.pathname === '/subscribe' && request.method === 'POST') {
        const sub = await request.json();
        await env.DB.prepare("INSERT OR REPLACE INTO subscriptions (userId, subscription_json) VALUES (?, ?)")
          .bind(userId, JSON.stringify(sub)).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // DELETE ALERT
      if (request.method === 'DELETE') {
        const id = url.pathname.split('/').filter(Boolean).pop();
        await env.DB.prepare("DELETE FROM alerts WHERE id = ? AND userId = ?").bind(Number(id), userId).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      return Response.json({ error: "Not Found" }, { status: 404, headers: corsHeaders });
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

    console.log(`Prices fetched for ${Object.keys(priceMap).length} tickers.`);

    // 3. Process Hits
    for (const alert of alerts) {
      const currentPrice = priceMap[alert.ticker];
      if (currentPrice === undefined) continue;

      const isHit = 
        (alert.condition === 'above' && currentPrice >= alert.target_price) ||
        (alert.condition === 'below' && currentPrice <= alert.target_price);

      if (isHit) {
        console.log(`TRIGGER: ${alert.ticker} hit ${currentPrice} (Target: ${alert.target_price})`);

        // UPDATE DB STATUS IMMEDIATELY (Atomic check)
        // This prevents the next minute's cron from triggering the same alert
        const updateResult = await env.DB.prepare("UPDATE alerts SET status = 'triggered' WHERE id = ? AND status = 'active'")
          .bind(alert.id)
          .run();

        // Only send push if we actually updated a row (prevents race conditions)
        if (updateResult.meta.changes > 0) {
          await sendAuthenticatedPush(env, alert.userId, alert.ticker, currentPrice, alert.target_price);
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
 * SEND AUTHENTICATED PUSH (VAPID)
 */
async function sendAuthenticatedPush(env, userId, ticker, price, target) {
  try {
    const subRow = await env.DB.prepare("SELECT subscription_json FROM subscriptions WHERE userId = ?")
      .bind(userId)
      .first();

    if (!subRow) {
      console.log(`No push subscription found for user: ${userId}`);
      return;
    }

    const sub = JSON.parse(subRow.subscription_json);
    const endpoint = new URL(sub.endpoint);

    // Generate VAPID JWT
    const jwtHeader = b64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
    const jwtPayload = b64Url(JSON.stringify({
      aud: `${endpoint.protocol}//${endpoint.host}`,
      exp: Math.floor(Date.now() / 1000) + 43200,
      sub: env.VAPID_SUBJECT
    }));

    const signature = await signEcdsa(`${jwtHeader}.${jwtPayload}`, env.VAPID_PRIVATE_KEY);
    const vapidToken = `${jwtHeader}.${jwtPayload}.${signature}`;

    // Notification Data
    const payload = JSON.stringify({
      title: `${ticker} Target Hit!`,
      body: `${ticker} is now ${price.toFixed(2)} (Goal: ${target})`,
      ticker: ticker,
      timestamp: Date.now()
    });

    const pushResponse = await fetch(sub.endpoint, {
      method: 'POST',
      body: payload,
      headers: {
        'TTL': '60',
        'Urgency': 'high',
        'Content-Type': 'application/json',
        'Authorization': `WebPush ${vapidToken}`,
        'Crypto-Key': `p256ecdsa=${env.VAPID_PUBLIC_KEY}`
      }
    });

    console.log(`Push Delivery Status: ${pushResponse.status} for ${ticker}`);
    
    // If 410 (Gone) or 404 (Not Found), the subscription is invalid/expired
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
  const binary = Uint8Array.from(atob(privateKeyB64), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", binary, 
    { name: "ECDSA", namedCurve: "P-256" }, 
    false, ["sign"]
  );
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