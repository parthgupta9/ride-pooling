import express from "express";
import {
  createRideRequest,
  getRideRequest,
  cancelRideRequest,
  getActivePools,
  getPoolDetails,
  rateRide,
  getUserRideHistory,
  getPriceEstimate,
  getHealth,
  getMetrics,
} from "../controllers/ride.controller.js";

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
