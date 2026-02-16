import { dequeueBatch } from "../queue/ride.queue.js";
import { prisma } from "../config/db.js";
import { notifyUser } from "../websocket/socket.js";

setInterval(async () => {
  const batch = await dequeueBatch(5);

  if (batch.length === 0) return;

  const pool = await prisma.ridePool.create({
    data: { status: "ASSIGNED" }
  });

  for (const req of batch) {
    await prisma.rideRequest.update({
      where: { id: req.id },
      data: { status: "ASSIGNED", poolId: pool.id }
    });

    notifyUser(req.userId, {
      message: "Ride assigned",
      poolId: pool.id
    });
  }

  console.log(`Batch processed: ${pool.id}`);
}, 500);
