import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
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
  const user = await stmt.bind(username.toLowerCase()).first<{ favorites: string; portfolio: string }>();

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
  const user = await userStmt.bind(username.toLowerCase()).first<{ id: number }>();

  if (!user) return c.json({ error: 'User not found' }, 404);

  const stmt = c.env.DB.prepare('SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC');
  const alerts = await stmt.bind(user.id).all();
  return c.json(alerts.results);
});

app.post('/alerts', async (c) => {
  const { username, ticker, target_price, condition } = await c.req.json();
  const userStmt = c.env.DB.prepare('SELECT id FROM users WHERE username = ?');
  const user = await userStmt.bind(username.toLowerCase()).first<{ id: number }>();

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
  const user = await userStmt.bind(username.toLowerCase()).first<{ id: number }>();

  if (!user) return c.json({ error: 'User not found' }, 404);

  try {
    const stmt = c.env.DB.prepare('DELETE FROM alerts WHERE id = ? AND user_id = ?');
    await stmt.bind(id, user.id).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to delete alert' }, 500);
  }
});

// Push Subscription Endpoints
app.post('/push/subscribe', async (c) => {
  const { username, subscription } = await c.req.json();
  const userStmt = c.env.DB.prepare('SELECT id FROM users WHERE username = ?');
  const user = await userStmt.bind(username.toLowerCase()).first<{ id: number }>();

  if (!user) return c.json({ error: 'User not found' }, 404);

  try {
    const stmt = c.env.DB.prepare('INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)');
    await stmt.bind(user.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to save subscription' }, 500);
  }
});

app.post('/push/unsubscribe', async (c) => {
  const { endpoint } = await c.req.json();
  try {
    const stmt = c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?');
    await stmt.bind(endpoint).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to unsubscribe' }, 500);
  }
});

// --- Web Push Helper (Cloudflare Workers Web Crypto Implementation) ---
async function sendWebPush(endpoint: string, payloadData: any, p256dh: string, auth: string) {
  try {
    const pub = 'BF4IGtj7crhYY7soDeugjInerPdrAGUzUNiSXuNDSI_TW7C52PPOZKmRqt3UyatsFIkG2vK-8MI-aCuTAUIHH94';
    const priv = 'iBfKC94k67XIn0svr-7zAijB8TvLQGQ4sXnXf1XtZUU';
    
    // Decode base64url public key to extract X and Y coordinates for JWK
    const padding = '='.repeat((4 - (pub.length % 4)) % 4);
    const base64 = (pub + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const x = btoa(raw.substring(1, 33)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const y = btoa(raw.substring(33, 65)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    const jwk = { kty: 'EC', crv: 'P-256', d: priv, x, y, ext: true };
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    
    const url = new URL(endpoint);
    const aud = `${url.protocol}//${url.host}`;
    const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
    
    const header = { typ: 'JWT', alg: 'ES256' };
    const payload = { aud, exp, sub: 'mailto:admin@stocker.app' };
    
    const encodeBase64Url = (str: string) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const encodeBuffer = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    const unsignedToken = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(JSON.stringify(payload))}`;
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsignedToken));
    const jwt = `${unsignedToken}.${encodeBuffer(signature)}`;
    
    console.log(`Sending push to ${endpoint}...`);
    
    // We are sending a simple push without encryption for now, 
    // relying on the Service Worker to show a generic message if payload is missing.
    // Full ECE encryption in Cloudflare Workers requires a complex library.
    const pushResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${pub}`,
        'TTL': '43200'
      }
    });
    
    console.log(`Push response status: ${pushResponse.status}`);
    if (!pushResponse.ok) {
        const text = await pushResponse.text();
        console.error(`Push failed with body: ${text}`);
    }
  } catch (e) {
    console.error('Push failed:', e);
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
            const subs = await c.env.DB.prepare("SELECT * FROM push_subscriptions WHERE user_id = ?").bind(alert.user_id).all();
            
            for (const sub of subs.results) {
              await sendWebPush(
                sub.endpoint as string, 
                {
                  title: `${alert.ticker} Alert Triggered!`,
                  body: `Price crossed ${alert.target_price}. Current: ${currentPrice.toFixed(2)}`,
                  url: '/alerts'
                },
                sub.p256dh as string,
                sub.auth as string
              );
            }
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

// Admin Endpoints
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
