const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");

const SECRET = "SUPER_SECRET_KEY";
const PORT = process.env.PORT || 3000;


const app = express();
app.use(bodyParser.json());

// ✅ السطر المهم
app.use(express.static("public"));

/* ================= LOGIN API ================= */
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (username === "wolfshift" && password === "sunpower111soso111") {
    const token = jwt.sign({ user: username }, SECRET, { expiresIn: "1h" });
    return res.json({ access: token });
  }

  res.status(401).json({ error: "Invalid credentials" });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let browserClients = new Set();
let cameraSocket = null;

/* ================= WEBSOCKET ================= */
wss.on("connection", (ws, req) => {
  const params = new URLSearchParams(req.url.replace("/?", ""));
  const token = params.get("token");

  if (token) {
    try { jwt.verify(token, SECRET); }
    catch { ws.close(); return; }
  }

  ws.on("message", msg => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "browser") {
        browserClients.add(ws);
        ws.send(JSON.stringify({
          type: "connection_info",
          cameraConnected: !!cameraSocket
        }));
        return;
      }

      if (data.type === "camera") {
        cameraSocket = ws;
        broadcast({ type: "system", message: "Camera connected" });
        return;
      }

      if (data.cmd && cameraSocket) {
        cameraSocket.send(JSON.stringify(data));
      }

    } catch {
      broadcastBinary(msg);
    }
  });

  ws.on("close", () => {
    browserClients.delete(ws);
    if (ws === cameraSocket) {
      cameraSocket = null;
      broadcast({ type: "system", message: "Camera disconnected" });
    }
  });
});

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  browserClients.forEach(c => c.readyState === 1 && c.send(msg));
}
function broadcastBinary(buffer) {
  browserClients.forEach(c => c.readyState === 1 && c.send(buffer));
}

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
