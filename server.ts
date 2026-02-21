import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import webpush from "web-push";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Starting Stocker Server...");

const db = new Database(path.join(__dirname, "stocker.db"));

// VAPID Keys
const VAPID_PUBLIC_KEY = "BF4IGtj7crhYY7soDeugjInerPdrAGUzUNiSXuNDSI_TW7C52PPOZKmRqt3UyatsFIkG2vK-8MI-aCuTAUIHH94";
const VAPID_PRIVATE_KEY = "iBfKC94k67XIn0svr-7zAijB8TvLQGQ4sXnXf1XtZUU";

try {
  webpush.setVapidDetails(
    "mailto:admin@stocker.app",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log("VAPID details set successfully");
} catch (err) {
  console.error("Failed to set VAPID details:", err);
}

// Initialize database
console.log("Initializing database...");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    favorites TEXT DEFAULT '[]',
    portfolio TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    target_price REAL NOT NULL,
    condition TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);
console.log("Database initialized");

async function startServer() {
  console.log("Configuring Express app...");
  const app = express();
  const PORT = 3000;

  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  }));
  app.use(express.json());
  
  // Add simple logging middleware
  app.use((req, res, next) => {
    console.log(`STKR_LOG: ${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth Endpoints
  app.post("/api/auth/register", (req, res) => {
    const { username } = req.body;
    if (!username || username.length < 3) {
      return res.status(400).json({ error: "Invalid username" });
    }

    try {
      const stmt = db.prepare("INSERT INTO users (username) VALUES (?)");
      const info = stmt.run(username.toLowerCase());
      res.json({ id: info.lastInsertRowid, username: username.toLowerCase() });
    } catch (err: any) {
      if (err.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { username } = req.body;
    const stmt = db.prepare("SELECT * FROM users WHERE username = ?");
    const user = stmt.get(username.toLowerCase());

    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  // Profile Endpoints
  app.get("/api/user/profile", (req, res) => {
    const username = req.query.username as string;
    const stmt = db.prepare("SELECT favorites, portfolio FROM users WHERE username = ?");
    const user = stmt.get(username.toLowerCase()) as { favorites: string; portfolio: string } | undefined;

    if (user) {
      res.json({
        favorites: JSON.parse(user.favorites),
        portfolio: JSON.parse(user.portfolio)
      });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  app.post("/api/user/profile", (req, res) => {
    const { username, favorites, portfolio } = req.body;
    
    try {
      const stmt = db.prepare("UPDATE users SET favorites = ?, portfolio = ? WHERE username = ?");
      stmt.run(JSON.stringify(favorites), JSON.stringify(portfolio), username.toLowerCase());
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Alert Endpoints
  app.get("/api/alerts", (req, res) => {
    const username = req.query.username as string;
    const userStmt = db.prepare("SELECT id FROM users WHERE username = ?");
    const user = userStmt.get(username.toLowerCase()) as { id: number } | undefined;

    if (!user) return res.status(404).json({ error: "User not found" });

    const stmt = db.prepare("SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC");
    const alerts = stmt.all(user.id);
    res.json(alerts);
  });

  app.post("/api/alerts", (req, res) => {
    const { username, ticker, target_price, condition } = req.body;
    const userStmt = db.prepare("SELECT id FROM users WHERE username = ?");
    const user = userStmt.get(username.toLowerCase()) as { id: number } | undefined;

    if (!user) return res.status(404).json({ error: "User not found" });

    try {
      const stmt = db.prepare("INSERT INTO alerts (user_id, ticker, target_price, condition) VALUES (?, ?, ?, ?)");
      const info = stmt.run(user.id, ticker.toUpperCase(), target_price, condition);
      res.json({ id: info.lastInsertRowid, success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create alert" });
    }
  });

  app.delete("/api/alerts/:id", (req, res) => {
    const { id } = req.params;
    const { username } = req.query;
    
    const userStmt = db.prepare("SELECT id FROM users WHERE username = ?");
    const user = userStmt.get((username as string).toLowerCase()) as { id: number } | undefined;

    if (!user) return res.status(404).json({ error: "User not found" });

    try {
      const stmt = db.prepare("DELETE FROM alerts WHERE id = ? AND user_id = ?");
      stmt.run(id, user.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete alert" });
    }
  });

  // Push Subscription Endpoints
  app.post("/api/push/subscribe", (req, res) => {
    const { username, subscription } = req.body;
    const userStmt = db.prepare("SELECT id FROM users WHERE username = ?");
    const user = userStmt.get(username.toLowerCase()) as { id: number } | undefined;

    if (!user) return res.status(404).json({ error: "User not found" });

    try {
      const stmt = db.prepare("INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)");
      stmt.run(user.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save subscription" });
    }
  });

  app.post("/api/push/unsubscribe", (req, res) => {
    const { endpoint } = req.body;
    try {
      const stmt = db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?");
      stmt.run(endpoint);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to unsubscribe" });
    }
  });

  // Catch-all for undefined API routes to prevent falling through to static server
  app.all("/api/*", (req, res) => {
    console.log(`STKR_LOG: Unhandled API route: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Admin Endpoints
  app.get("/api/admin/users", (req, res) => {
    const requester = req.query.requester as string;
    if (requester?.toLowerCase() !== 'admin') {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const stmt = db.prepare("SELECT id, username, favorites, portfolio FROM users");
      const users = stmt.all() as any[];
      const processedUsers = users.map(u => ({
        ...u,
        favorites: JSON.parse(u.favorites),
        portfolio: JSON.parse(u.portfolio)
      }));
      res.json(processedUsers);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Background Task: Price Checker & Push Sender
  setInterval(async () => {
    const activeAlerts = db.prepare("SELECT a.*, u.username FROM alerts a JOIN users u ON a.user_id = u.id WHERE a.status = 'active'").all() as any[];
    
    for (const alert of activeAlerts) {
      // Mock price fetching - in a real app, you'd call a stock API
      const mockPrice = 150 + (Math.random() * 100); 
      
      let triggered = false;
      if (alert.condition === 'above' && mockPrice >= alert.target_price) triggered = true;
      if (alert.condition === 'below' && mockPrice <= alert.target_price) triggered = true;

      if (triggered) {
        // Update alert status
        db.prepare("UPDATE alerts SET status = 'triggered' WHERE id = ?").run(alert.id);

        // Fetch user subscriptions
        const subs = db.prepare("SELECT * FROM push_subscriptions WHERE user_id = ?").all(alert.user_id) as any[];
        
        const payload = JSON.stringify({
          title: `STOCKER Alert: ${alert.ticker}`,
          body: `${alert.ticker} has hit your target of $${alert.target_price.toFixed(2)} (Current: $${mockPrice.toFixed(2)})`,
          icon: '/icon-192x192.png',
          data: { ticker: alert.ticker }
        });

        for (const sub of subs) {
          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            }, payload);
          } catch (err: any) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              // Subscription expired or invalid, remove it
              db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(sub.id);
            }
          }
        }
      }
    }
  }, 30000); // Check every 30 seconds

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`STKR_LOG: Server is officially listening on port ${PORT}`);
    console.log(`STKR_LOG: Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
