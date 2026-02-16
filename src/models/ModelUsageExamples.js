/**
 * Mongoose Models Usage Guide
 * 
 * This file demonstrates how to use the Mongoose models in your controllers and services
 */

import { RidePool } from "../models/RidePool.js";
import { RideRequest } from "../models/RideRequest.js";

// ==================== CREATE OPERATIONS ====================

// Create a new ride request
export async function createRideRequest(data) {
  try {
    const rideRequest = new RideRequest({
      userId: data.userId,
      luggage: data.luggage,
      pickupLocation: {
        latitude: data.pickupLat,
        longitude: data.pickupLng,
        address: data.pickupAddress,
      },
      dropoffLocation: {
        latitude: data.dropoffLat,
        longitude: data.dropoffLng,
        address: data.dropoffAddress,
      },
      passengers: data.passengers || 1,
      maxDetour: data.maxDetour || 10,
    });
    return await rideRequest.save();
  } catch (error) {
    throw new Error(`Failed to create ride request: ${error.message}`);
  }
}

// Create a new ride pool
export async function createRidePool(data) {
  try {
    const ridePool = new RidePool({
      status: "pending",
      pickupLocation: {
        latitude: data.pickupLat,
        longitude: data.pickupLng,
      },
      dropoffLocation: {
        latitude: data.dropoffLat,
        longitude: data.dropoffLng,
      },
      totalCapacity: data.totalCapacity || 4,
      maxLuggage: data.maxLuggage || 10,
    });
    return await ridePool.save();
  } catch (error) {
    throw new Error(`Failed to create ride pool: ${error.message}`);
  }
}

// ==================== READ OPERATIONS ====================

// Get pending ride requests for matching
export async function getPendingRideRequests() {
  try {
    return await RideRequest.find({ status: "pending" })
      .sort({ createdAt: 1 })
      .lean();
  } catch (error) {
    throw new Error(`Failed to get pending requests: ${error.message}`);
  }
}

// Get ride request by ID with pool details
export async function getRideRequestById(requestId) {
  try {
    return await RideRequest.findById(requestId).populate("poolId");
  } catch (error) {
    throw new Error(`Failed to get ride request: ${error.message}`);
  }
}

// Get all ride requests for a user
export async function getUserRideRequests(userId) {
  try {
    return await RideRequest.find({ userId })
      .sort({ createdAt: -1 })
      .populate("poolId");
  } catch (error) {
    throw new Error(`Failed to get user requests: ${error.message}`);
  }
}

// Get active ride pools
export async function getActiveRidePools() {
  try {
    return await RidePool.find({ status: { $in: ["pending", "active"] } })
      .populate("requests")
      .lean();
  } catch (error) {
    throw new Error(`Failed to get active pools: ${error.message}`);
  }
}

// Get ride pool with all request details
export async function getRidePoolWithRequests(poolId) {
  try {
    return await RidePool.findById(poolId).populate({
      path: "requests",
      model: "RideRequest",
    });
  } catch (error) {
    throw new Error(`Failed to get ride pool: ${error.message}`);
  }
}

// Find nearby rides using geospatial query
export async function findNearbyRideRequests(latitude, longitude, maxDistance = 5) {
  try {
    // Note: You'll need to create a geospatial index first:
    // RideRequest collection -> pickupLocation: "2dsphere"
    return await RideRequest.find({
      "pickupLocation": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: maxDistance * 1000, // Convert km to meters
        },
      },
      status: "pending",
    }).lean();
  } catch (error) {
    throw new Error(`Failed to find nearby requests: ${error.message}`);
  }
}

// ==================== UPDATE OPERATIONS ====================

// Update ride request status
export async function updateRideRequestStatus(requestId, status, poolId = null) {
  try {
    const updateData = { status };
    if (poolId) {
      updateData.poolId = poolId;
    }
    return await RideRequest.findByIdAndUpdate(requestId, updateData, {
      new: true,
    });
  } catch (error) {
    throw new Error(`Failed to update request: ${error.message}`);
  }
}

// Add request to a pool
export async function addRequestToPool(poolId, requestId) {
  try {
    const pool = await RidePool.findById(poolId);
    if (!pool.requests.includes(requestId)) {
      pool.requests.push(requestId);
      pool.occupiedSeats = pool.requests.length;
    }
    return await pool.save();
  } catch (error) {
    throw new Error(`Failed to add request to pool: ${error.message}`);
  }
}

// Update ride pool status
export async function updateRidePoolStatus(poolId, status) {
  try {
    return await RidePool.findByIdAndUpdate(poolId, { status }, { new: true });
  } catch (error) {
    throw new Error(`Failed to update pool status: ${error.message}`);
  }
}

// Update ride pool pricing
export async function updateRidePoolPricing(poolId, estimatedCost, actualCost = null) {
  try {
    const updateData = { estimatedCost };
    if (actualCost !== null) {
      updateData.actualCost = actualCost;
    }
    return await RidePool.findByIdAndUpdate(poolId, updateData, { new: true });
  } catch (error) {
    throw new Error(`Failed to update pricing: ${error.message}`);
  }
}

// Update request pricing and status
export async function updateRequestPricing(requestId, price, paymentStatus) {
  try {
    return await RideRequest.findByIdAndUpdate(
      requestId,
      { price, paymentStatus },
      { new: true }
    );
  } catch (error) {
    throw new Error(`Failed to update request pricing: ${error.message}`);
  }
}

// ==================== DELETE OPERATIONS ====================

// Cancel a ride request
export async function cancelRideRequest(requestId) {
  try {
    const request = await RideRequest.findByIdAndUpdate(
      requestId,
      { status: "cancelled" },
      { new: true }
    );

    // Remove from pool if assigned
    if (request.poolId) {
      await RidePool.findByIdAndUpdate(
        request.poolId,
        {
          $pull: { requests: requestId },
          occupiedSeats: { $inc: -1 },
        },
        { new: true }
      );
    }

    return request;
  } catch (error) {
    throw new Error(`Failed to cancel request: ${error.message}`);
  }
}

// ==================== ANALYTICS OPERATIONS ====================

// Get ride statistics
export async function getRideStatistics(timeframe = "day") {
  try {
    const now = new Date();
    let startDate;

    switch (timeframe) {
      case "hour":
        startDate = new Date(now - 60 * 60 * 1000);
        break;
      case "day":
        startDate = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case "week":
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now - 24 * 60 * 60 * 1000);
    }

    const requestStats = await RideRequest.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgPrice: { $avg: "$price" },
          totalPrice: { $sum: "$price" },
        },
      },
    ]);

    const poolStats = await RidePool.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgCost: { $avg: "$actualCost" },
          totalCost: { $sum: "$actualCost" },
        },
      },
    ]);

    return {
      requests: requestStats,
      pools: poolStats,
      timeframe,
      startDate,
      endDate: now,
    };
  } catch (error) {
    throw new Error(`Failed to get statistics: ${error.message}`);
  }
}

// Get user ride history
export async function getUserRideHistory(userId) {
  try {
    return await RideRequest.find({
      userId,
      status: { $in: ["completed", "cancelled"] },
    })
      .sort({ createdAt: -1 })
      .populate("poolId");
  } catch (error) {
    throw new Error(`Failed to get ride history: ${error.message}`);
  }
}
