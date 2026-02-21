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
