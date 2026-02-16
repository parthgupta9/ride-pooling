import { prisma } from "../config/db.js";
import { enqueueRide } from "../queue/ride.queue.js";

export async function requestRide(req, res) {
  const ride = await prisma.rideRequest.create({
    data: {
      userId: req.body.userId,
      luggage: req.body.luggage,
      status: "QUEUED"
    }
  });

  await enqueueRide(ride);

  res.json({
    message: "Ride queued",
    requestId: ride.id
  });
}
