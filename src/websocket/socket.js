import { WebSocketServer } from "ws";

const clients = new Map();

export function initWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const userId = new URL(req.url, "http://x").searchParams.get("userId");
    clients.set(userId, ws);

    ws.on("close", () => clients.delete(userId));
  });
}

export function notifyUser(userId, payload) {
  const ws = clients.get(userId);
  if (ws) ws.send(JSON.stringify(payload));
}
