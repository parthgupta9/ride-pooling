import { RideRequest } from "../models/RideRequest.js";
import { RidePool } from "../models/RidePool.js";
import { redis } from "../config/redis.js";
import { estimatePrice, getPricingAnalytics } from "../services/price.service.js";

/**
 * Create a new ride request
 * POST /rides/request
 */
export async function createRideRequest(req, res) {
  try {
    const {
      userId,
      pickupLocation,
      dropoffLocation,
      passengers = 1,
      luggage = 0,
      maxDetour = 10,
    } = req.body;

    // Validation
    if (!userId || !pickupLocation || !dropoffLocation) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["userId", "pickupLocation", "dropoffLocation"],
      });
    }

    if (passengers < 1 || passengers > 4) {
      return res.status(400).json({
        error: "Passengers must be between 1 and 4",
      });
    }

    if (luggage < 0 || luggage > 10) {
      return res.status(400).json({
        error: "Luggage must be between 0 and 10 units",
      });
    }

    // Create ride request
    const rideRequest = await RideRequest.create({
      userId,
      pickupLocation,
      dropoffLocation,
      passengers,
      luggage,
      maxDetour,
      status: "pending",
    });

    // Enqueue to Redis
    await redis.rpush("ride:queue", JSON.stringify(rideRequest.toObject()));

    // Get price estimate
    const priceEstimate = estimatePrice(rideRequest, { isPool: true });
    const queueSize = await redis.llen("ride:queue");

    res.status(201).json({
      message: "Ride request created successfully",
      requestId: rideRequest._id,
      status: rideRequest.status,
      estimatedPrice: priceEstimate.finalPrice,
      priceBreakdown: priceEstimate,
      queuePosition: queueSize,
    });
  } catch (error) {
    console.error("Create ride request error:", error);
    res.status(500).json({
      error: "Failed to create ride request",
      details: error.message,
    });
  }
}

/**
 * Get ride request details
 * GET /rides/:requestId
 */
export async function getRideRequest(req, res) {
  try {
    const { requestId } = req.params;

    const rideRequest = await RideRequest.findById(requestId).populate("poolId");

    if (!rideRequest) {
      return res.status(404).json({
        error: "Ride request not found",
      });
    }

    res.json(rideRequest);
  } catch (error) {
    console.error("Get ride request error:", error);
    res.status(500).json({
      error: "Failed to retrieve ride request",
      details: error.message,
    });
  }
}

/**
 * Cancel a ride request
 * POST /rides/:requestId/cancel
 */
export async function cancelRideRequest(req, res) {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    const rideRequest = await RideRequest.findById(requestId);

    if (!rideRequest) {
      return res.status(404).json({
        error: "Ride request not found",
      });
    }

    if (["assigned", "completed", "cancelled"].includes(rideRequest.status)) {
      return res.status(409).json({
        error: `Cannot cancel ride with status: ${rideRequest.status}`,
      });
    }

    // Update status
    rideRequest.status = "cancelled";
    await rideRequest.save();

    // Remove from RSS queue if not yet processed
    const queueItems = await redis.lrange("ride:queue", 0, -1);
    for (let i = 0; i < queueItems.length; i++) {
      const item = JSON.parse(queueItems[i]);
      if (item._id === requestId) {
        await redis.lrem("ride:queue", 0, queueItems[i]);
        break;
      }
    }

    res.json({
      message: "Ride request cancelled successfully",
      requestId: rideRequest._id,
      reason: reason || null,
      cancellationTime: new Date(),
    });
  } catch (error) {
    console.error("Cancel ride request error:", error);
    res.status(500).json({
      error: "Failed to cancel ride request",
      details: error.message,
    });
  }
}

/**
 * Get all active ride pools
 * GET /rides/pools
 */
export async function getActivePools(req, res) {
  try {
    const { status = "active", limit = 10, offset = 0 } = req.query;

    const pools = await RidePool.find({ status })
      .populate("requests")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await RidePool.countDocuments({ status });

    res.json({
      pools,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error("Get pools error:", error);
    res.status(500).json({
      error: "Failed to retrieve pools",
      details: error.message,
    });
  }
}

/**
 * Get specific pool details
 * GET /rides/pools/:poolId
 */
export async function getPoolDetails(req, res) {
  try {
    const { poolId } = req.params;

    const pool = await RidePool.findById(poolId)
      .populate("requests");

    if (!pool) {
      return res.status(404).json({
        error: "Pool not found",
      });
    }

    res.json(pool);
  } catch (error) {
    console.error("Get pool details error:", error);
    res.status(500).json({
      error: "Failed to retrieve pool details",
      details: error.message,
    });
  }
}

/**
 * Rate a completed ride
 * POST /rides/:poolId/rate
 */
export async function rateRide(req, res) {
  try {
    const { poolId } = req.params;
    const { userId, rating, feedback } = req.body;

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        error: "Rating must be between 1 and 5",
      });
    }

    const rideRequest = await RideRequest.findOneAndUpdate(
      { poolId, userId },
      { rating, feedback },
      { new: true }
    );

    if (!rideRequest) {
      return res.status(404).json({
        error: "Ride not found for this user",
      });
    }

    res.json({
      message: "Ride rated successfully",
      rating,
      feedback,
      rideId: rideRequest._id,
    });
  } catch (error) {
    console.error("Rate ride error:", error);
    res.status(500).json({
      error: "Failed to rate ride",
      details: error.message,
    });
  }
}

/**
 * Get user's ride history
 * GET /users/:userId/rides
 */
export async function getUserRideHistory(req, res) {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0, status } = req.query;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const rides = await RideRequest.find(query)
      .populate("poolId")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await RideRequest.countDocuments(query);

    // Calculate statistics
    const completedRides = rides.filter(r => r.status === "completed");
    const avgRating =
      completedRides.length > 0
        ? completedRides.reduce((sum, r) => sum + (r.rating || 0), 0) /
          completedRides.length
        : 0;

    res.json({
      userId,
      rides,
      statistics: {
        totalRides: total,
        completedRides: completedRides.length,
        averageRating: avgRating.toFixed(2),
      },
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error("Get user history error:", error);
    res.status(500).json({
      error: "Failed to retrieve user ride history",
      details: error.message,
    });
  }
}

/**
 * Get price estimate
 * GET /estimates/price
 */
export async function getPriceEstimate(req, res) {
  try {
    const {
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude,
      passengers = 1,
      isPool = true,
    } = req.query;

    if (
      !pickupLatitude ||
      !pickupLongitude ||
      !dropoffLatitude ||
      !dropoffLongitude
    ) {
      return res.status(400).json({
        error: "Missing location parameters",
        required: [
          "pickupLatitude",
          "pickupLongitude",
          "dropoffLatitude",
          "dropoffLongitude",
        ],
      });
    }

    const mockRequest = {
      pickupLocation: {
        latitude: parseFloat(pickupLatitude),
        longitude: parseFloat(pickupLongitude),
      },
      dropoffLocation: {
        latitude: parseFloat(dropoffLatitude),
        longitude: parseFloat(dropoffLongitude),
      },
      passengers: parseInt(passengers),
    };

    const estimate = estimatePrice(mockRequest, {
      isPool: isPool === "true",
      queueSize: await redis.llen("ride:queue"),
    });

    const queueSize = await redis.llen("ride:queue");

    res.json({
      estimate,
      queueInfo: {
        currentQueueSize: queueSize,
        estimatedWaitTime: `${Math.ceil(queueSize * 0.1)} seconds`,
      },
    });
  } catch (error) {
    console.error("Get price estimate error:", error);
    res.status(500).json({
      error: "Failed to estimate price",
      details: error.message,
    });
  }
}

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
