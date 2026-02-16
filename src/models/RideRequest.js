import mongoose from "mongoose";

const rideRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    luggage: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },
    status: {
      type: String,
      enum: ["pending", "matched", "confirmed", "in_transit", "completed", "cancelled"],
      default: "pending",
    },
    poolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RidePool",
      default: null,
    },
    pickupLocation: {
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
      address: String,
    },
    dropoffLocation: {
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
      address: String,
    },
    maxDetour: {
      type: Number,
      default: 10, // minutes
    },
    passengers: {
      type: Number,
      default: 1,
      min: 1,
      max: 4,
    },
    estimatedPickupTime: Date,
    estimatedDropoffTime: Date,
    actualPickupTime: Date,
    actualDropoffTime: Date,
    price: Number,
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: String,
  },
  {
    timestamps: true,
  }
);

// Create indexes for performance
rideRequestSchema.index({ userId: 1, status: 1 });
rideRequestSchema.index({ status: 1, createdAt: -1 });
rideRequestSchema.index({ poolId: 1 });
rideRequestSchema.index({
  "pickupLocation.latitude": 1,
  "pickupLocation.longitude": 1,
});
rideRequestSchema.index({
  "dropoffLocation.latitude": 1,
  "dropoffLocation.longitude": 1,
});

export const RideRequest = mongoose.model("RideRequest", rideRequestSchema);
