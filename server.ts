import express from "express";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Starting Stocker Server v1.0.1 (Production Mode)...");

process.on('uncaughtException', (err) => {
  console.error('STKR_LOG: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('STKR_LOG: Unhandled Rejection at:', promise, 'reason:', reason);
});

const db = new Database(path.join(__dirname, "stocker.db"));

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

  CREATE TABLE IF NOT EXISTS broker_sessions (
    user_id INTEGER PRIMARY KEY,
    broker TEXT NOT NULL,
    access_token TEXT NOT NULL,
    public_token TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
  
  // Connectivity test
  app.get("/ping", (req, res) => res.send("pong"));
  
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
    res.json({ status: "ok", version: "1.0.2", timestamp: new Date().toISOString() });
  });

  // --- Broker Endpoints (Zerodha) ---
  app.get("/api/broker/status", (req, res) => {
    const { username } = req.query;
    console.log(`STKR_LOG: [v1.0.2] Broker status check for ${username}`);
    res.json({
      connected: true,
      broker: 'zerodha',
      version: '1.0.2',
      last_sync: new Date().toISOString()
    });
  });

  app.get(["/api/broker/zerodha/margins", "/api/broker/zerodha/margins/"], (req, res) => {
    console.log(`STKR_LOG: [v1.0.4] Fetching Zerodha margins for ${req.query.username}`);
    res.json({
      status: 'success',
      data: {
        equity: {
          enabled: true,
          net: 45230.50,
          available: { cash: 45230.50, adhoc_margin: 0, collateral: 0, intraday_payin: 0 },
          utilised: { debits: 0, exposure: 0, m2m_unrealised: 0, m2m_realised: 0, option_premium: 0, payout: 0, span: 0, holding_sales: 0, turnover: 0, liquid_collateral: 0, stock_collateral: 0, var: 0 }
        },
        commodity: {
          enabled: false,
          net: 0,
          available: { cash: 0, adhoc_margin: 0, collateral: 0, intraday_payin: 0 },
          utilised: { debits: 0, exposure: 0, m2m_unrealised: 0, m2m_realised: 0, option_premium: 0, payout: 0, span: 0, holding_sales: 0, turnover: 0, liquid_collateral: 0, stock_collateral: 0, var: 0 }
        }
      }
    });
  });

  app.get(["/api/broker/zerodha/holdings", "/api/broker/zerodha/holdings/"], (req, res) => {
    console.log(`STKR_LOG: [v1.0.2] Fetching Zerodha holdings for ${req.query.username}`);
    res.json({
      status: 'success',
      data: [
        { tradingsymbol: "RELIANCE", exchange: "NSE", isin: "INE002A01018", quantity: 10, t1_quantity: 0, realised_quantity: 10, authorised_quantity: 10, average_price: 2450.50, last_price: 2910.20, pnl: 4597.00 },
        { tradingsymbol: "TCS", exchange: "NSE", isin: "INE467B01029", quantity: 5, t1_quantity: 0, realised_quantity: 5, authorised_quantity: 5, average_price: 3200.00, last_price: 3855.40, pnl: 3277.00 }
      ]
    });
  });

  app.get(["/api/broker/zerodha/positions", "/api/broker/zerodha/positions/"], (req, res) => {
    console.log(`STKR_LOG: [v1.0.2] Fetching Zerodha positions for ${req.query.username}`);
    res.json({
      status: 'success',
      data: {
        net: [
          { tradingsymbol: "NIFTY24FEB22000CE", exchange: "NFO", instrument_token: 12345, product: "NRML", quantity: 50, over_night_quantity: 50, multiplier: 1, average_price: 120.50, last_price: 145.20, pnl: 1235.00, realised: 0, unrealised: 1235.00, buy_quantity: 50, buy_price: 120.50, buy_value: 6025, sell_quantity: 0, sell_price: 0, sell_value: 0 }
        ],
        day: []
      }
    });
  });

  app.get(["/api/broker/zerodha/orders", "/api/broker/zerodha/orders/"], (req, res) => {
    console.log(`STKR_LOG: [v1.0.2] Fetching Zerodha orders for ${req.query.username}`);
    res.json({ status: 'success', data: [] });
  });

  app.get("/api/broker/zerodha/auth-url", (req, res) => {
    console.log("STKR_LOG: Generating Zerodha auth URL");
    const mockUrl = `${req.protocol}://${req.get('host')}/?status=success&request_token=MOCK_TOKEN_123`;
    res.json({ url: mockUrl });
  });

  app.post("/api/broker/zerodha/exchange", (req, res) => {
    const { username, requestToken } = req.body;
    console.log(`STKR_LOG: Zerodha token exchange for ${username}`);
    res.json({ status: 'success', message: 'Token exchanged successfully' });
  });

  app.post("/api/broker/disconnect", (req, res) => {
    const { username } = req.body;
    console.log(`STKR_LOG: Disconnecting broker for ${username}`);
    res.json({ status: 'success', message: 'Broker disconnected' });
  });

  // Proxy Endpoint for Yahoo Finance
  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    try {
      // We use a custom User-Agent to avoid being blocked by Yahoo
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `Upstream error: ${response.statusText}` });
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error("Proxy error:", err);
      res.status(500).json({ error: "Failed to fetch data" });
    }
  });

  // Auth Endpoints
  app.post("/api/auth/register", (req, res) => {
    console.log(`STKR_LOG: Register attempt for username: ${req.body.username}`);
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
    console.log(`STKR_LOG: Login attempt for username: ${req.body.username}`);
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

  // Broker Endpoints (Mock Zerodha)
  let mockOrders = [
    {
      order_id: "24010100000001",
      tradingsymbol: "RELIANCE",
      exchange: "NSE",
      transaction_type: "BUY",
      order_type: "LIMIT",
      quantity: 10,
      filled_quantity: 0,
      price: 2900.50,
      average_price: 0,
      status: "OPEN",
      order_timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      product: "CNC"
    },
    {
      order_id: "24010100000002",
      tradingsymbol: "TCS",
      exchange: "NSE",
      transaction_type: "SELL",
      order_type: "MARKET",
      quantity: 5,
      filled_quantity: 5,
      price: 0,
      average_price: 3850.25,
      status: "COMPLETE",
      order_timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      product: "MIS"
    },
    {
      order_id: "24010100000003",
      tradingsymbol: "HDFCBANK",
      exchange: "NSE",
      transaction_type: "BUY",
      order_type: "LIMIT",
      quantity: 20,
      filled_quantity: 0,
      price: 1400.00,
      average_price: 0,
      status: "REJECTED",
      order_timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      product: "CNC"
    }
  ];

  app.post("/api/broker/zerodha/order", (req, res) => {
    const { username, ticker, quantity, transaction_type, order_type, product, price } = req.body;
    
    console.log(`STKR_LOG: Zerodha order attempt by ${username} for ${quantity} ${ticker}`);
    
    // Simulate realistic Zerodha margin check
    // If quantity is too high, simulate insufficient funds
    const estimatedValue = quantity * (price || 150); // Mock price if market order
    
    setTimeout(() => {
      if (estimatedValue > 50000) {
        return res.status(400).json({
          status: 'error',
          error: 'MarginException',
          message: `Insufficient funds for this order. Required margin: ₹${estimatedValue.toFixed(2)}. Available: ₹45,230.50`
        });
      }
      
      // Success case
      const orderId = `240${Math.floor(Math.random() * 1000000000)}`;
      const newOrder = {
        order_id: orderId,
        tradingsymbol: ticker,
        exchange: "NSE",
        transaction_type,
        order_type,
        quantity,
        filled_quantity: 0,
        price: price || 0,
        average_price: 0,
        status: "OPEN",
        order_timestamp: new Date().toISOString(),
        product
      };
      mockOrders.unshift(newOrder);

      res.json({
        status: 'success',
        data: {
          order_id: orderId,
          status: 'OPEN',
          message: 'Order placed successfully'
        }
      });
    }, 600); // Add realistic network delay
  });

  // Catch-all for undefined API routes
  app.use("/api", (req, res) => {
    console.log(`STKR_LOG: Unhandled API route: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

// --- OneSignal Push Helper ---
async function sendOneSignalPush(username: string, ticker: string, targetPrice: number, currentPrice: number) {
  const APP_ID = process.env.ONESIGNAL_APP_ID || "10b11bf1-fcf6-44a9-abc8-2ec961abdf40";
  const API_KEY = process.env.ONESIGNAL_API_KEY;

  if (!API_KEY) {
    console.error('STKR_LOG: OneSignal API Key is missing');
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
        contents: { "en": `${ticker} has hit your target of $${targetPrice.toFixed(2)} (Current: $${currentPrice.toFixed(2)})` },
        include_external_user_ids: [username],
        url: `https://stockprice-1mo.pages.dev/alerts`
      })
    });

    const result = await response.json();
    console.log('STKR_LOG: OneSignal response:', result);
  } catch (e) {
    console.error('STKR_LOG: OneSignal push failed:', e);
  }
}

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

        // Send OneSignal Push using the username (external_id)
        await sendOneSignalPush(alert.username, alert.ticker, alert.target_price, mockPrice);
      }
    }
  }, 30000); // Check every 30 seconds

  // Serve static files from the dist directory
  app.use(express.static(path.join(__dirname, "dist")));

  // Handle SPA routing: serve index.html for all non-API routes
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("STKR_LOG: Global Error Handler caught:", err);
    res.status(500).send(`
      <html>
        <body>
          <h1>Internal Server Error</h1>
          <pre>${err.stack || err.message || err}</pre>
        </body>
      </html>
    `);
  });

  // Start Server
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`STKR_LOG: Server started and listening on port ${PORT}`);
  });
}

startServer();
