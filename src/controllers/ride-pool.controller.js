import { RidePool } from "../models/RidePool.js";

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
