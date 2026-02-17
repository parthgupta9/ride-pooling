import 'dotenv/config';
import http from "http";
import app from "./app.js";
import { initWebSocket } from "./websocket/socket.js";
import { connectDB } from "./config/db.js";
import "./workers/batch.worker.js";

const server = http.createServer(app);
initWebSocket(server);

// Connect to MongoDB and start server
connectDB().then(() => {
  server.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
    console.log("MongoDB connected");
  });
}).catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
