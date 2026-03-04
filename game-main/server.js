import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 8080);
const MAX_HP = 100;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const indexFile = path.join(distDir, "index.html");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json"
};

const clients = new Map();
const players = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeVec3(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value) || value.length !== 3) return fallback;
  return value.map((n, i) => (Number.isFinite(n) ? Number(n) : fallback[i]));
}

function safeQuat(value, fallback = [0, 0, 0, 1]) {
  if (!Array.isArray(value) || value.length !== 4) return fallback;
  return value.map((n, i) => (Number.isFinite(n) ? Number(n) : fallback[i]));
}

function send(ws, payload) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function broadcast(payload, exceptId = null) {
  const raw = JSON.stringify(payload);
  for (const [id, client] of clients.entries()) {
    if (id === exceptId) continue;
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(raw);
  }
}

function toPublicPlayer(player) {
  return {
    id: player.id,
    hp: player.hp,
    position: player.position,
    quaternion: player.quaternion,
    speed: player.speed
  };
}

function createPlayer(id) {
  return {
    id,
    hp: MAX_HP,
    position: [0, 120, 180],
    quaternion: [0, 0, 0, 1],
    speed: 0
  };
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600"
  });
  createReadStream(filePath).pipe(res);
}

function resolveFilePath(requestPath) {
  if (!existsSync(indexFile)) return null;

  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const candidate = path.resolve(distDir, `.${normalizedPath}`);
  if (!candidate.startsWith(distDir)) return null;

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  if (!path.extname(normalizedPath)) {
    return indexFile;
  }

  return null;
}

const httpServer = createServer((req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/ws") {
      res.writeHead(426, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("WebSocket endpoint. Use ws://.../ws");
      return;
    }

    const filePath = resolveFilePath(url.pathname);
    if (!filePath) {
      if (!existsSync(indexFile)) {
        res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Build files not found. Run: npm run build");
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    serveFile(res, filePath);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Server error");
  }
});

const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req, socket, head) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname !== "/ws" && url.pathname !== "/") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } catch {
    socket.destroy();
  }
});

wss.on("connection", (ws) => {
  const id = randomUUID().slice(0, 8);
  const player = createPlayer(id);

  clients.set(id, ws);
  players.set(id, player);

  send(ws, {
    type: "welcome",
    id,
    maxHp: MAX_HP,
    players: [...players.values()].map(toPublicPlayer)
  });

  broadcast(
    {
      type: "player_join",
      player: toPublicPlayer(player)
    },
    id
  );

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    const current = players.get(id);
    if (!current || !msg || typeof msg !== "object") return;

    if (msg.type === "state") {
      current.position = safeVec3(msg.position, current.position);
      current.quaternion = safeQuat(msg.quaternion, current.quaternion);
      current.speed = Number.isFinite(msg.speed) ? Number(msg.speed) : current.speed;

      broadcast(
        {
          type: "state",
          id,
          position: current.position,
          quaternion: current.quaternion,
          speed: current.speed
        },
        id
      );
      return;
    }

    if (msg.type === "fire") {
      broadcast(
        {
          type: "fire",
          ownerId: id,
          missileId: typeof msg.missileId === "string" ? msg.missileId : `${id}-${Date.now()}`,
          position: safeVec3(msg.position),
          velocity: safeVec3(msg.velocity)
        },
        id
      );
      return;
    }

    if (msg.type === "damage") {
      const amount = clamp(Number(msg.amount) || 0, 0, 100);
      current.hp = clamp(current.hp - amount, 0, MAX_HP);
      broadcast({ type: "hp", id, hp: current.hp });
      return;
    }

    if (msg.type === "reset_hp") {
      current.hp = MAX_HP;
      broadcast({ type: "hp", id, hp: current.hp });
    }
  });

  ws.on("close", () => {
    clients.delete(id);
    players.delete(id);
    broadcast({ type: "player_leave", id });
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
  console.log(`[multiplayer] websocket on ws://localhost:${PORT}/ws`);
});
