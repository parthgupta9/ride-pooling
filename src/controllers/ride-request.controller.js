import { RideRequest } from "../models/RideRequest.js";
import { redis } from "../config/redis.js";
import { estimatePrice } from "../services/price.service.js";

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
