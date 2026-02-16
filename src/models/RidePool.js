import mongoose from "mongoose";

const ridePoolSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "active", "completed", "cancelled"],
      default: "pending",
    },
    requests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RideRequest",
      },
    ],
    pickupLocation: {
      latitude: Number,
      longitude: Number,
    },
    dropoffLocation: {
      latitude: Number,
      longitude: Number,
    },
    totalCapacity: {
      type: Number,
      default: 4,
    },
    occupiedSeats: {
      type: Number,
      default: 0,
    },
    totalLuggage: {
      type: Number,
      default: 0,
    },
    maxLuggage: {
      type: Number,
      default: 10,
    },
    estimatedCost: Number,
    actualCost: Number,
    driverId: String,
    vehicleId: String,
  },
  {
    timestamps: true,
  }
);

// Create indexes for performance
ridePoolSchema.index({ status: 1, createdAt: -1 });
ridePoolSchema.index({ "pickupLocation.latitude": 1, "pickupLocation.longitude": 1 });
ridePoolSchema.index({ driverId: 1 });

export const RidePool = mongoose.model("RidePool", ridePoolSchema);
