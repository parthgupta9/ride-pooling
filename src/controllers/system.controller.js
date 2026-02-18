import { RideRequest } from "../models/RideRequest.js";
import { RidePool } from "../models/RidePool.js";
import { redis } from "../config/redis.js";
import { getPricingAnalytics } from "../services/price.service.js";

/**
 * Get system health and metrics
 * GET /health
 */
export async function getHealth(req, res) {
  try {
    const queueSize = await redis.llen("ride:queue");
    const activePools = await RidePool.countDocuments({ status: "active" });
    const pendingRequests = await RideRequest.countDocuments({
      status: "pending",
    });
    const completedToday = await RideRequest.countDocuments({
      status: "completed",
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    });

    // Check Redis connection
    await redis.ping();

    res.json({
      status: "healthy",
      timestamp: new Date(),
      queue: {
        size: queueSize,
        estimatedProcessingTime: `${(queueSize * 0.1).toFixed(1)} seconds`,
      },
      pools: {
        active: activePools,
      },
      requests: {
        pending: pendingRequests,
        completedToday: completedToday,
      },
      services: {
        mongodb: "connected",
        redis: "connected",
      },
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
    });
  }
}

/**
 * Get system metrics and analytics
 * GET /metrics
 */
export async function getMetrics(req, res) {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const ridesInPeriod = await RideRequest.find({
      createdAt: { $gte: startDate },
    });

    const completedRides = ridesInPeriod.filter(r => r.status === "completed");
    const cancelledRides = ridesInPeriod.filter(r => r.status === "cancelled");
    const pooledRides = ridesInPeriod.filter(r => r.poolId);

    const analytics = getPricingAnalytics(completedRides);

    res.json({
      period: {
        days: parseInt(days),
        startDate,
        endDate: new Date(),
      },
      summary: {
        totalRequests: ridesInPeriod.length,
        completedRides: completedRides.length,
        cancelledRides: cancelledRides.length,
        pooledRides: pooledRides.length,
        completionRate: ridesInPeriod.length > 0
          ? ((completedRides.length / ridesInPeriod.length) * 100).toFixed(2)
          : 0,
      },
      financials: analytics,
      utilization: {
        avgPoolSize:
          pooledRides.length > 0
            ? (pooledRides.reduce((sum, r) => sum + (r.passengers || 1), 0) /
                pooledRides.length)
              .toFixed(2)
            : 0,
        totalPassengers: ridesInPeriod.reduce(
          (sum, r) => sum + (r.passengers || 1),
          0
        ),
      },
    });
  } catch (error) {
    console.error("Get metrics error:", error);
    res.status(500).json({
      error: "Failed to retrieve metrics",
      details: error.message,
    });
  }
}
