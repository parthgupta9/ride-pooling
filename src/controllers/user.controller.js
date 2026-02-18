import { RideRequest } from "../models/RideRequest.js";

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
