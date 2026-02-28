import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";
import http from "http";
import cors from "cors";
import Database from "better-sqlite3";
import nodemailer from "nodemailer";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, query, limitToLast, onValue, off } from "firebase/database";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- Firebase Setup ---
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  };

  let firebaseDb: any = null;
  let firebaseListenerRef: any = null;

  try {
    const firebaseApp = initializeApp(firebaseConfig);
    firebaseDb = getDatabase(firebaseApp);
    console.log("Firebase Realtime Database initialized successfully");
  } catch (err) {
    console.warn("Firebase initialization failed:", err);
  }

  // --- Database Setup ---
  const db = new Database("thermasense.db");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'Authority',
      status TEXT DEFAULT 'pending'
    )
  `);

  // --- Email Setup ---
  // To use this, user needs to set EMAIL_USER and EMAIL_PASS in .env
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER || "your-email@gmail.com",
      pass: process.env.EMAIL_PASS || "your-app-password",
    },
  });

  // --- Auth Endpoints ---
  app.post("/api/auth/signup", (req, res) => {
    const { name, email, password } = req.body;
    try {
      // Check if first user
      const { count } = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
      const role = count === 0 ? "Admin" : "Authority";
      const status = count === 0 ? "approved" : "pending";

      const stmt = db.prepare("INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)");
      stmt.run(name, email, password, role, status);
      
      res.json({ success: true, message: count === 0 ? "Admin created and approved." : "Signup successful. Waiting for Admin approval." });
    } catch (err: any) {
      if (err.message.includes("UNIQUE")) {
        res.status(400).json({ success: false, message: "Email already exists." });
      } else {
        res.status(500).json({ success: false, message: "Server error." });
      }
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password) as any;
    
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }
    if (user.status === "pending") {
      return res.status(403).json({ success: false, message: "Your account is pending Admin approval. Please wait." });
    }
    
    // In a real app, use JWT. For this demo, we just return the user object.
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });

  // --- Users Endpoints (Admin Only) ---
  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT id, name, email, role, status FROM users").all();
    res.json(users);
  });

  app.post("/api/users/:id/approve", (req, res) => {
    db.prepare("UPDATE users SET status = 'approved' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/users/:id", (req, res) => {
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // --- Telemetry & WebSocket ---
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/api/ws' });

  let currentData = {
    temp: 22.5,
    humidity: 44,
    timestamp: new Date().toISOString()
  };

  // --- Listen to Firebase Telemetry ---
  if (firebaseDb) {
    try {
      const telemetryRef = ref(firebaseDb, 'telemetry');
      const telemetryQuery = query(telemetryRef, limitToLast(1));
      
      firebaseListenerRef = onValue(telemetryQuery, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          // Firebase returns an object with auto-generated keys; extract the latest entry
          const entries = Object.values(data) as any[];
          if (entries.length > 0) {
            const latest = entries[entries.length - 1];
            if (latest.temp !== undefined && latest.humidity !== undefined) {
              currentData = {
                temp: Number(latest.temp),
                humidity: Number(latest.humidity),
                timestamp: new Date().toISOString()
              };
              console.log(`[Firebase TELEMETRY] Temp: ${currentData.temp}, Humidity: ${currentData.humidity}`);

              // Broadcast to all WebSocket clients
              const message = JSON.stringify({ type: 'TELEMETRY', data: currentData });
              wss.clients.forEach((client) => {
                if (client.readyState === 1) {
                  client.send(message);
                }
              });
            }
          }
        }
      }, (err) => {
        console.error("Firebase listener error:", err);
      });
      console.log("Firebase telemetry listener started");
    } catch (err) {
      console.warn("Could not set up Firebase listener:", err);
    }
  }

  let lastAlertTime = 0;
  const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes

  const computeHeatIndex = (t: number, h: number) => {
    if (isNaN(t) || isNaN(h)) return NaN;
    const T = (t * 9.0 / 5.0) + 32.0;
    const HI = -42.379 + 2.04901523 * T + 10.14333127 * h
               - 0.22475541 * T * h - 0.00683783 * T * T
               - 0.05481717 * h * h + 0.00122874 * T * T * h
               + 0.00085282 * T * h * h - 0.00000199 * T * T * h * h;
    return (HI - 32.0) * 5.0 / 9.0;
  };

  app.post("/api/telemetry", (req, res) => {
    const { temp, humidity } = req.body;
    console.log(`[TELEMETRY RECEIVED] Temp: ${temp}, Humidity: ${humidity}`);
    
    if (temp !== undefined && humidity !== undefined) {
      const t = Number(temp);
      const h = Number(humidity);
      
      currentData = {
        temp: t,
        humidity: h,
        timestamp: new Date().toISOString()
      };

      const hi = computeHeatIndex(t, h);

      // Broadcast to all connected WebSocket clients
      const message = JSON.stringify({ type: 'TELEMETRY', data: currentData });
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });

      // Check for DANGER (HI >= 40.0) and send email
      if (hi >= 40.0 && Date.now() - lastAlertTime > ALERT_COOLDOWN) {
        lastAlertTime = Date.now();
        
        // Get all approved Authorities and Admins
        const recipients = db.prepare("SELECT email FROM users WHERE status = 'approved'").all() as {email: string}[];
        const emails = recipients.map(r => r.email).join(",");

        if (emails && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: emails,
            subject: "🚨 THERMASENSE ALERT: EXTREME DANGER",
            text: `DANGER! Heat Index has reached ${hi.toFixed(1)}°C.\nTemperature: ${t.toFixed(1)}°C\nHumidity: ${h.toFixed(1)}%\n\nPlease check the dashboard immediately.`,
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error("Error sending alert email:", error);
            } else {
              console.log("Alert email sent:", info.response);
            }
          });
        } else {
          console.log("DANGER reached, but EMAIL_USER/EMAIL_PASS not configured or no approved users.");
        }
      }

      res.json({ success: true, message: "Data received" });
    } else {
      res.status(400).json({ success: false, message: "Missing temp or humidity" });
    }
  });

  app.get("/api/telemetry/current", (req, res) => {
    res.json(currentData);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown: clean up Firebase listener
  process.on('SIGINT', () => {
    if (firebaseListenerRef) {
      off(firebaseListenerRef);
      console.log("Firebase listener cleaned up");
    }
    process.exit(0);
  });
}

startServer();
