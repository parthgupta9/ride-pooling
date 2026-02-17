import express from "express";
import rideRoutes from "./routes/ride.route.js";

const app = express();
app.use(express.json());
app.use("/rides", rideRoutes);

export default app;
