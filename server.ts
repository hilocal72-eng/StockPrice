import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("stocker.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    favorites TEXT DEFAULT '[]',
    portfolio TEXT DEFAULT '[]'
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
