import express from "express";
import {
  createRideRequest,
  getRideRequest,
  cancelRideRequest,
} from "../controllers/ride-request.controller.js";
import {
  getActivePools,
  getPoolDetails,
} from "../controllers/ride-pool.controller.js";
import {
  rateRide,
  getUserRideHistory,
} from "../controllers/user.controller.js";
import { getPriceEstimate } from "../controllers/estimate.controller.js";
import { getHealth, getMetrics } from "../controllers/system.controller.js";

const router = express.Router();

// Static routes first (to avoid being matched by :requestId)
router.post("/request", createRideRequest);
router.get("/pools", getActivePools);
router.get("/estimate-price", getPriceEstimate);
router.get("/health", getHealth);
router.get("/metrics", getMetrics);

// User history route
router.get("/user/:userId/history", getUserRideHistory);

// Dynamic routes
router.get("/:requestId", getRideRequest);
router.post("/:requestId/cancel", cancelRideRequest);

// Pool specific routes
router.get("/pools/:poolId", getPoolDetails);
router.post("/:poolId/rate", rateRide);

export default router;
