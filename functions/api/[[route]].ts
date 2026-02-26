import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { cors } from 'hono/cors';

type Bindings = {
  DB: any;
  ONESIGNAL_APP_ID: string;
  ONESIGNAL_API_KEY: string;
  ZERODHA_API_KEY: string;
  ZERODHA_API_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

// Enable CORS
app.use('*', cors());

// Health Check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy Endpoint for Yahoo Finance
app.get('/proxy', async (c) => {
  const targetUrl = c.req.query('url');
  if (!targetUrl) {
    return c.json({ error: 'Missing url parameter' }, 400);
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return c.json({ error: `Upstream error: ${response.statusText}` }, response.status as any);
    }

    const data = await response.json();
    return c.json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    return c.json({ error: 'Failed to fetch data' }, 500);
  }
});

// Auth Endpoints
app.post('/auth/register', async (c) => {
  const { username } = await c.req.json();
  if (!username || username.length < 3) {
    return c.json({ error: 'Invalid username' }, 400);
  }

  try {
    const stmt = c.env.DB.prepare('INSERT INTO users (username) VALUES (?)');
    const info = await stmt.bind(username.toLowerCase()).run();
    return c.json({ id: info.meta.last_row_id, username: username.toLowerCase() });
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Username already exists' }, 400);
    } else {
      return c.json({ error: 'Internal server error' }, 500);
    }
  }
});

app.post('/auth/login', async (c) => {
  const { username } = await c.req.json();
  const stmt = c.env.DB.prepare('SELECT * FROM users WHERE username = ?');
  const user = await stmt.bind(username.toLowerCase()).first();

  if (user) {
    return c.json(user);
  } else {
    return c.json({ error: 'User not found' }, 404);
  }
});

// Profile Endpoints
app.get('/user/profile', async (c) => {
  const username = c.req.query('username');
  if (!username) return c.json({ error: 'Missing username' }, 400);

  const stmt = c.env.DB.prepare('SELECT favorites, portfolio FROM users WHERE username = ?');
  const user = await stmt.bind(username.toLowerCase()).first() as { favorites: string; portfolio: string };

  if (user) {
    return c.json({
      favorites: JSON.parse(user.favorites),
      portfolio: JSON.parse(user.portfolio)
    });
  } else {
    return c.json({ error: 'User not found' }, 404);
  }
});

app.post('/user/profile', async (c) => {
  const { username, favorites, portfolio } = await c.req.json();
  
  try {
    const stmt = c.env.DB.prepare('UPDATE users SET favorites = ?, portfolio = ? WHERE username = ?');
    await stmt.bind(JSON.stringify(favorites), JSON.stringify(portfolio), username.toLowerCase()).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

// Alert Endpoints
app.get('/alerts', async (c) => {
  const username = c.req.query('username');
  if (!username) return c.json({ error: 'Missing username' }, 400);

  const userStmt = c.env.DB.prepare('SELECT id FROM users WHERE username = ?');
  const user = await userStmt.bind(username.toLowerCase()).first() as { id: number };

  if (!user) return c.json({ error: 'User not found' }, 404);

  const stmt = c.env.DB.prepare('SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC');
  const alerts = await stmt.bind(user.id).all();
  return c.json(alerts.results);
});

app.post('/alerts', async (c) => {
  const { username, ticker, target_price, condition } = await c.req.json();
  const userStmt = c.env.DB.prepare('SELECT id FROM users WHERE username = ?');
  const user = await userStmt.bind(username.toLowerCase()).first() as { id: number };

  if (!user) return c.json({ error: 'User not found' }, 404);

  try {
    const stmt = c.env.DB.prepare('INSERT INTO alerts (user_id, ticker, target_price, condition) VALUES (?, ?, ?, ?)');
    const info = await stmt.bind(user.id, ticker.toUpperCase(), target_price, condition).run();
    return c.json({ id: info.meta.last_row_id, success: true });
  } catch (err) {
    return c.json({ error: 'Failed to create alert' }, 500);
  }
});

app.delete('/alerts/:id', async (c) => {
  const id = c.req.param('id');
  const username = c.req.query('username');
  if (!username) return c.json({ error: 'Missing username' }, 400);
  
  const userStmt = c.env.DB.prepare('SELECT id FROM users WHERE username = ?');
  const user = await userStmt.bind(username.toLowerCase()).first() as { id: number };

  if (!user) return c.json({ error: 'User not found' }, 404);

  try {
    const stmt = c.env.DB.prepare('DELETE FROM alerts WHERE id = ? AND user_id = ?');
    await stmt.bind(id, user.id).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to delete alert' }, 500);
  }
});

// OneSignal handles subscriptions directly on the client and targets by external_id

// --- OneSignal Push Helper ---
async function sendOneSignalPush(username: string, ticker: string, targetPrice: number, currentPrice: number, env: Bindings) {
  const APP_ID = env.ONESIGNAL_APP_ID || "10b11bf1-fcf6-44a9-abc8-2ec961abdf40";
  const API_KEY = env.ONESIGNAL_API_KEY;

  if (!API_KEY) {
    console.error('OneSignal API Key is missing');
    return;
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${API_KEY}`
      },
      body: JSON.stringify({
        app_id: APP_ID,
        headings: { "en": `${ticker} Alert Triggered!` },
        contents: { "en": `Price crossed ${targetPrice}. Current: ${currentPrice.toFixed(2)}` },
        include_external_user_ids: [username],
        url: `https://stockprice-1mo.pages.dev/alerts`
      })
    });

    const result = await response.json();
    console.log('OneSignal response:', result);
  } catch (e) {
    console.error('OneSignal push failed:', e);
  }
}

// Cron Job Endpoint (Trigger this via external service like cron-job.org)
app.get('/cron/check', async (c) => {
  const secret = c.req.query('secret');
  if (secret !== 'stocker_cron_secret_2024') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const alerts = await c.env.DB.prepare("SELECT a.*, u.username FROM alerts a JOIN users u ON a.user_id = u.id WHERE a.status = 'active'").all();
    
    if (!alerts.results || alerts.results.length === 0) {
      return c.json({ status: 'no active alerts' });
    }

    let triggeredCount = 0;
    const tickers = [...new Set(alerts.results.map((a: any) => a.ticker))];
    
    for (const ticker of tickers) {
      try {
        const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
        const response = await fetch(yfUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = await response.json() as any;
        
        if (!data.chart || !data.chart.result || data.chart.result.length === 0) continue;
        const currentPrice = data.chart.result[0].meta.regularMarketPrice;

        const tickerAlerts = alerts.results.filter((a: any) => a.ticker === ticker);
        
        for (const alert of tickerAlerts) {
          let triggered = false;
          if (alert.condition === 'above' && currentPrice >= alert.target_price) triggered = true;
          if (alert.condition === 'below' && currentPrice <= alert.target_price) triggered = true;

          if (triggered) {
            await c.env.DB.prepare("UPDATE alerts SET status = 'triggered' WHERE id = ?").bind(alert.id).run();
            
            // Send OneSignal Push using the username (external_id)
            await sendOneSignalPush(alert.username, alert.ticker, alert.target_price, currentPrice, c.env);
            
            triggeredCount++;
          }
        }
      } catch (e) {
        console.error(`Failed to process ${ticker}:`, e);
      }
    }

    return c.json({ status: 'success', triggered: triggeredCount });
  } catch (err) {
    console.error('Cron error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Broker Endpoints (Zerodha)
app.get('/broker/zerodha/auth-url', async (c) => {
  const apiKey = c.env.ZERODHA_API_KEY;
  if (!apiKey) return c.json({ error: 'Zerodha API Key not configured' }, 500);
  
  const authUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${apiKey}`;
  return c.json({ url: authUrl });
});

app.get('/broker/zerodha/callback', async (c) => {
  const requestToken = c.req.query('request_token');
  
  if (!requestToken) {
    return c.text('Missing request_token');
  }

  return c.html(`
    <html>
      <body style="background: #000; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh;">
        <div style="text-align: center;">
          <h2 style="color: #10b981;">Authorizing...</h2>
          <p>Syncing with terminal...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'ZERODHA_REQUEST_TOKEN', requestToken: '${requestToken}' }, '*');
              // The main window will handle the exchange and close this popup
            } else {
              document.body.innerHTML = '<h2 style="color: #ef4444;">Error: Opener window not found</h2>';
            }
          </script>
        </div>
      </body>
    </html>
  `);
});

app.post('/broker/zerodha/exchange', async (c) => {
  const { username, requestToken } = await c.req.json();
  
  if (!username || !requestToken) {
    return c.json({ error: 'Missing username or requestToken' }, 400);
  }

  const apiKey = c.env.ZERODHA_API_KEY;
  const apiSecret = c.env.ZERODHA_API_SECRET;

  try {
    const sha256 = async (message: string) => {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const checksum = await sha256(apiKey + requestToken + apiSecret);
    
    const response = await fetch('https://api.kite.trade/session/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Kite-Version': '3'
      },
      body: new URLSearchParams({
        api_key: apiKey,
        request_token: requestToken,
        checksum: checksum
      })
    });

    const data = await response.json() as any;
    if (data.status === 'error') {
      return c.json({ error: `Zerodha Error: ${data.message}` }, 400);
    }

    const accessToken = data.data.access_token;
    const publicToken = data.data.public_token;

    const userStmt = c.env.DB.prepare('SELECT id FROM users WHERE username = ?');
    const user = await userStmt.bind(username.toLowerCase()).first() as { id: number };

    if (user) {
      await c.env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS broker_sessions (
          user_id INTEGER PRIMARY KEY,
          broker TEXT NOT NULL,
          access_token TEXT NOT NULL,
          public_token TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `).run();

      await c.env.DB.prepare('INSERT OR REPLACE INTO broker_sessions (user_id, broker, access_token, public_token) VALUES (?, ?, ?, ?)')
        .bind(user.id, 'zerodha', accessToken, publicToken).run();
      
      return c.json({ status: 'success' });
    } else {
      return c.json({ error: 'User not found' }, 404);
    }
  } catch (err: any) {
    return c.json({ error: `Exchange failed: ${err.message}` }, 500);
  }
});

app.get('/broker/zerodha/holdings', async (c) => {
  const username = c.req.query('username');
  if (!username) return c.json({ error: 'Missing username' }, 400);

  const userStmt = c.env.DB.prepare('SELECT id FROM users WHERE username = ?');
  const user = await userStmt.bind(username.toLowerCase()).first() as { id: number };
  if (!user) return c.json({ error: 'User not found' }, 404);

  const session = await c.env.DB.prepare('SELECT access_token FROM broker_sessions WHERE user_id = ? AND broker = ?')
    .bind(user.id, 'zerodha').first() as { access_token: string };

  if (!session) return c.json({ error: 'Broker not connected' }, 401);

  const response = await fetch('https://api.kite.trade/portfolio/holdings', {
    headers: {
      'X-Kite-Version': '3',
      'Authorization': `token ${c.env.ZERODHA_API_KEY}:${session.access_token}`
    }
  });

  const data = await response.json();
  return c.json(data);
});

app.get('/broker/zerodha/positions', async (c) => {
  const username = c.req.query('username');
  if (!username) return c.json({ error: 'Missing username' }, 400);

  const userStmt = c.env.DB.prepare('SELECT id FROM users WHERE username = ?');
  const user = await userStmt.bind(username.toLowerCase()).first() as { id: number };
  if (!user) return c.json({ error: 'User not found' }, 404);

  const session = await c.env.DB.prepare('SELECT access_token FROM broker_sessions WHERE user_id = ? AND broker = ?')
    .bind(user.id, 'zerodha').first() as { access_token: string };

  if (!session) return c.json({ error: 'Broker not connected' }, 401);

  const response = await fetch('https://api.kite.trade/portfolio/positions', {
    headers: {
      'X-Kite-Version': '3',
      'Authorization': `token ${c.env.ZERODHA_API_KEY}:${session.access_token}`
    }
  });

  const data = await response.json();
  return c.json(data);
});

app.post('/broker/zerodha/order', async (c) => {
  const { username, ticker, quantity, transaction_type, order_type, product, price } = await c.req.json();
  
  const userStmt = c.env.DB.prepare('SELECT id FROM users WHERE username = ?');
  const user = await userStmt.bind(username.toLowerCase()).first() as { id: number };
  if (!user) return c.json({ error: 'User not found' }, 404);

  const session = await c.env.DB.prepare('SELECT access_token FROM broker_sessions WHERE user_id = ? AND broker = ?')
    .bind(user.id, 'zerodha').first() as { access_token: string };

  if (!session) return c.json({ error: 'Broker not connected' }, 401);

  const response = await fetch('https://api.kite.trade/orders/regular', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Kite-Version': '3',
      'Authorization': `token ${c.env.ZERODHA_API_KEY}:${session.access_token}`
    },
    body: new URLSearchParams({
      tradingsymbol: ticker,
      exchange: 'NSE', // Default to NSE for simplicity
      transaction_type,
      order_type,
      quantity: quantity.toString(),
      product,
      price: price ? price.toString() : '0'
    })
  });

  const data = await response.json();
  return c.json(data);
});

app.get('/broker/status', async (c) => {
  const username = c.req.query('username');
  if (!username) return c.json({ connected: false });

  try {
    const userStmt = c.env.DB.prepare('SELECT id FROM users WHERE username = ?');
    const user = await userStmt.bind(username.toLowerCase()).first() as { id: number };
    if (!user) return c.json({ connected: false });

    // Try to fetch session, handle case where table might not exist yet
    try {
      const session = await c.env.DB.prepare('SELECT broker, updated_at FROM broker_sessions WHERE user_id = ?')
        .bind(user.id).first() as { broker: string; updated_at: string };

      if (session) {
        return c.json({ connected: true, broker: session.broker, last_sync: session.updated_at });
      }
    } catch (dbErr) {
      // Table likely doesn't exist yet, which is fine
      console.log('Broker sessions table not found or query failed');
    }
    
    return c.json({ connected: false });
  } catch (err) {
    console.error('Status check error:', err);
    return c.json({ connected: false, error: 'Database error' });
  }
});

app.post('/broker/disconnect', async (c) => {
  const { username } = await c.req.json();
  const userStmt = c.env.DB.prepare('SELECT id FROM users WHERE username = ?');
  const user = await userStmt.bind(username.toLowerCase()).first() as { id: number };
  if (!user) return c.json({ success: false });

  await c.env.DB.prepare('DELETE FROM broker_sessions WHERE user_id = ?').bind(user.id).run();
  return c.json({ success: true });
});
app.get('/admin/users', async (c) => {
  const requester = c.req.query('requester');
  if (requester?.toLowerCase() !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  try {
    const stmt = c.env.DB.prepare('SELECT id, username, favorites, portfolio FROM users');
    const users = await stmt.all();
    const processedUsers = users.results.map((u: any) => ({
      ...u,
      favorites: JSON.parse(u.favorites),
      portfolio: JSON.parse(u.portfolio)
    }));
    return c.json(processedUsers);
  } catch (err) {
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

export const onRequest = handle(app);
