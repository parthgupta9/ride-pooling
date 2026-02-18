import { redis } from "../config/redis.js";
import { estimatePrice } from "../services/price.service.js";

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
