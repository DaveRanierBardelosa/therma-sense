import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";
import http from "http";
import cors from "cors";
import nodemailer from "nodemailer";
import fs from "fs"; // for simple JSON storage
import { initializeApp } from "firebase/app";
import { getDatabase, ref, query, limitToLast, onValue, off } from "firebase/database";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // --- Simple JSON database for users ---
  const usersFile = path.join(__dirname, "users.json");
  let users: any[] = [];
  if (fs.existsSync(usersFile)) {
    try {
      users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
    } catch {
      users = [];
    }
  }

  function saveUsers() {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  }

  // --- Email Setup ---
  // To use this, user needs to set EMAIL_USER and EMAIL_PASS in .env
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER || "your-email@gmail.com",
      pass: process.env.EMAIL_PASS || "your-app-password",
    },
  });

  // --- Admin configuration ---
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "bardelosaranierdave@gmail.com"; // Only this email can be admin

  // Helper to verify user is admin
  // since the file storage is ephemeral on Railway, we don't
  // want to rely on reading the users array to grant admin rights.
  // instead only the configured ADMIN_EMAIL is allowed to perform
  // privileged actions. this also avoids the "approve button not
  // working because user list reset" problem.
  const isAdmin = (email: string | undefined) => {
    return email === ADMIN_EMAIL;
  };

  // --- Auth Endpoints ---
  app.post("/api/auth/signup", (req, res) => {
    const { name, email, password } = req.body;
    // Check if email already exists
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ success: false, message: "Email already exists." });
    }
    // If ADMIN_EMAIL is set and matches, make them admin. Otherwise first user is admin.
    let role = "Authority";
    let status = "pending";
    
    if (ADMIN_EMAIL && email === ADMIN_EMAIL) {
      role = "Admin";
      status = "approved";
    } else if (users.length === 0 && !ADMIN_EMAIL) {
      // Only if no ADMIN_EMAIL env var is set, allow first signup to be admin
      role = "Admin";
      status = "approved";
    }
    
    const id = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
    const user = { id, name, email, password, role, status };
    users.push(user);
    saveUsers();
    res.json({ success: true, message: role === "Admin" ? "Admin created and approved." : "Signup successful. Waiting for Admin approval." });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }
    if (user.status === "pending") {
      return res.status(403).json({ success: false, message: "Your account is pending Admin approval. Please wait." });
    }
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });

  // --- Users Endpoints (Admin Only) ---
  app.get("/api/users", (req, res) => {
    const list = users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status }));
    res.json(list);
  });

  app.post("/api/users/:id/approve", (req, res) => {
    // Check if the requesting user is an admin
    const adminEmail = req.body.adminEmail;
    console.log("approve request from", adminEmail, "target id", req.params.id);
    if (!isAdmin(adminEmail)) {
      return res.status(403).json({ success: false, message: "Only admins can approve users." });
    }
    const u = users.find(u => u.id === Number(req.params.id));
    if (u) { u.status = 'approved'; saveUsers(); }
    res.json({ success: true });
  });

  app.delete("/api/users/:id", (req, res) => {
    // Check if the requesting user is an admin
    const adminEmail = req.body.adminEmail;
    if (!isAdmin(adminEmail)) {
      return res.status(403).json({ success: false, message: "Only admins can delete users." });
    }
    // Prevent deleting the last admin
    const userToDelete = users.find(u => u.id === Number(req.params.id));
    if (userToDelete && userToDelete.role === "Admin") {
      const adminCount = users.filter(u => u.role === "Admin").length;
      if (adminCount === 1) {
        return res.status(400).json({ success: false, message: "Cannot delete the last admin." });
      }
    }
    users = users.filter(u => u.id !== Number(req.params.id));
    saveUsers();
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
  let lastUpdateTime = Date.now(); // Track when last data update occurred

  // Telemetry history for analytics (keep last 10,000 readings = ~2.7 hours at 1 reading/sec)
  interface TelemetryPoint {
    temp: number;
    humidity: number;
    timestamp: number; // milliseconds
  }
  let telemetryHistory: TelemetryPoint[] = [];
  const MAX_HISTORY = 10000;

  // Helper to add telemetry reading to history
  const addToHistory = (temp: number, humidity: number) => {
    telemetryHistory.push({
      temp,
      humidity,
      timestamp: Date.now()
    });
    // Keep only last MAX_HISTORY readings
    if (telemetryHistory.length > MAX_HISTORY) {
      telemetryHistory = telemetryHistory.slice(-MAX_HISTORY);
    }
  };  // --- Listen to Firebase Telemetry ---
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
              lastUpdateTime = Date.now(); // Mark data as fresh
              addToHistory(Number(latest.temp), Number(latest.humidity)); // Track in history
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
      lastUpdateTime = Date.now(); // Mark data as fresh
      addToHistory(t, h); // Track in history

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
        
        // Get all approved authorities
        const approvedAuthorities = users.filter(u => u.status === 'approved');
        const authorityEmails = approvedAuthorities.map(u => u.email);

        if (authorityEmails.length > 0 && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
          authorityEmails.forEach((authorityEmail) => {
            const authorityName = approvedAuthorities.find(u => u.email === authorityEmail)?.name || 'Authority';
            const alertTime = new Date().toLocaleString();
            const emailBody = `Dear ${authorityName},

This is a formal notification that our real-time monitoring system has detected extreme temperature levels at ZONE A-1.

As of ${alertTime}, the recorded temperature has exceeded safety thresholds:
  • Temperature: ${t.toFixed(1)}°C
  • Humidity: ${h.toFixed(1)}%
  • Heat Index: ${hi.toFixed(1)}°C

This poses an immediate risk to students and personnel. We recommend an urgent inspection and the implementation of cooling protocols to mitigate potential damage or safety hazards.

Detailed telemetry data is available via the project dashboard at https://therma-sense-production.up.railway.app/dashboard for your review.

Sincerely,
RANIER DAVE B. BARDELOSA
ThermaSense System Administrator`;

            const mailOptions = {
              from: process.env.EMAIL_USER,
              to: authorityEmail,
              subject: "🚨 THERMASENSE ALERT: EXTREME DANGER - ZONE A-1",
              text: emailBody,
            };

            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.error(`Error sending alert email to ${authorityEmail}:`, error);
              } else {
                console.log(`Alert email sent to ${authorityEmail}:`, info.response);
              }
            });
          });
        } else {
          console.log("DANGER reached, but EMAIL_USER/EMAIL_PASS not configured or no approved authorities.");
        }
      }

      res.json({ success: true, message: "Data received" });
    } else {
      res.status(400).json({ success: false, message: "Missing temp or humidity" });
    }
  });

  app.get("/api/telemetry/current", (req, res) => {
    // Check if data is fresh (received within last 10 seconds)
    const isDataFresh = Date.now() - lastUpdateTime < 10000;
    res.json({ 
      ...currentData, 
      isConnected: isDataFresh 
    });
  });

  app.get("/api/telemetry/analytics", (req, res) => {
    const interval = (req.query.interval as string) || 'hour';
    
    if (telemetryHistory.length === 0) {
      return res.json([]);
    }

    // Determine interval in milliseconds
    let intervalMs = 60000; // default: 1 minute
    if (interval === 'minute') intervalMs = 60000;
    else if (interval === 'hour') intervalMs = 3600000;
    else if (interval === 'day') intervalMs = 86400000;
    else if (interval === 'week') intervalMs = 604800000;
    else if (interval === 'month') intervalMs = 2592000000; // 30 days

    // Group data by interval and calculate averages
    const now = Date.now();
    const groups: Record<number, { temps: number[], humidities: number[], timestamp: number }> = {};

    telemetryHistory.forEach(point => {
      const groupKey = Math.floor(point.timestamp / intervalMs);
      if (!groups[groupKey]) {
        groups[groupKey] = { temps: [], humidities: [], timestamp: groupKey * intervalMs };
      }
      groups[groupKey].temps.push(point.temp);
      groups[groupKey].humidities.push(point.humidity);
    });

    // Calculate averages and heat index
    const computeHI = (t: number, h: number) => {
      if (isNaN(t) || isNaN(h)) return NaN;
      const T = (t * 9.0 / 5.0) + 32.0;
      const HI = -42.379 + 2.04901523 * T + 10.14333127 * h
                 - 0.22475541 * T * h - 0.00683783 * T * T
                 - 0.05481717 * h * h + 0.00122874 * T * T * h
                 + 0.00085282 * T * h * h - 0.00000199 * T * T * h * h;
      return (HI - 32.0) * 5.0 / 9.0;
    };

    const result = Object.values(groups)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(group => {
        const avgTemp = group.temps.reduce((a, b) => a + b, 0) / group.temps.length;
        const avgHumidity = group.humidities.reduce((a, b) => a + b, 0) / group.humidities.length;
        const avgHI = computeHI(avgTemp, avgHumidity);
        
        const date = new Date(group.timestamp);
        let label = '';
        if (interval === 'minute') {
          label = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        } else if (interval === 'hour') {
          label = `${date.getHours().toString().padStart(2, '0')}:00`;
        } else {
          label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        return {
          time: label,
          temp: Number(avgTemp.toFixed(1)),
          humidity: Number(avgHumidity.toFixed(1)),
          heatIndex: Number(avgHI.toFixed(1)),
          timestamp: group.timestamp
        };
      });

    res.json(result);
  });


  // Serve static files in production
  if (process.env.NODE_ENV === "production") {
    app.use(express.static("dist"));
    // SPA fallback
    app.get("*", (req, res) => {
      res.sendFile(__dirname + "/dist/index.html");
    });
  } else {
    // Vite middleware for development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
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
