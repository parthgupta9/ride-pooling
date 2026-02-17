import { dequeueBatch } from "../queue/ride.queue.js";
import { RideRequest } from "../models/RideRequest.js";
import { RidePool } from "../models/RidePool.js";
import { notifyUser } from "../websocket/socket.js";

setInterval(async () => {
  try {
    const batch = await dequeueBatch(5);

    if (batch.length === 0) return;

    const pool = await RidePool.create({ status: "ASSIGNED" });

    for (const req of batch) {
      await RideRequest.updateOne(
        { _id: req._id },
        { status: "ASSIGNED", poolId: pool._id }
      );

      notifyUser(req.userId, {
        message: "Ride assigned",
        poolId: pool._id
      });
    }

    console.log(`Batch processed: ${pool._id}`);
  } catch (error) {
    console.error('Batch worker error:', error);
  }
}, 500);
