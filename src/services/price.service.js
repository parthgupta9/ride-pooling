/**
 * Price Calculator Service
 * Implements dynamic pricing formula with surge pricing
 */

const BASE_FARE = 5.0;
const PER_KM_RATE = 0.5;
const PER_MINUTE_RATE = 0.25;
const PEAK_HOUR_MULTIPLIER = 1.5;
const WEEKEND_MULTIPLIER = 1.2;
const BAD_WEATHER_MULTIPLIER = 1.3;

// Peak hours: 9-11 AM, 5-7 PM
const PEAK_HOURS = [
  { start: 9, end: 11 },
  { start: 17, end: 19 }
];

/**
 * Check if current time is peak hour
 * @returns {Boolean}
 */
export function isPeakHour() {
  const now = new Date();
  const hour = now.getHours();
  return PEAK_HOURS.some(period => hour >= period.start && hour < period.end);
}

/**
 * Check if current day is weekend
 * @returns {Boolean}
 */
export function isWeekend() {
  const now = new Date();
  const day = now.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Calculate surge multiplier based on demand
 * @param {Number} queueSize - Number of pending requests
 * @returns {Number} Multiplier (1.0 to 2.0)
 */
export function calculateSurgeMultiplier(queueSize = 0) {
  if (queueSize < 5) return 1.0;
  if (queueSize < 10) return 1.1;
  if (queueSize < 20) return 1.25;
  if (queueSize < 50) return 1.5;
  return Math.min(2.0, 1.0 + (queueSize / 100));
}

/**
 * Calculate base fare without multipliers
 * @param {Number} distance - Distance in km
 * @param {Number} duration - Duration in minutes
 * @returns {Number} Base fare in USD
 */
export function calculateBaseFare(distance, duration) {
  return BASE_FARE + (distance * PER_KM_RATE) + (duration * PER_MINUTE_RATE);
}

/**
 * Get all applicable multipliers
 * @param {Number} queueSize - Current queue size for surge
 * @param {Boolean} isPool - Whether this is a pooled ride
 * @returns {Object} Multipliers breakdown
 */
export function getMultipliers(queueSize = 0, isPool = false) {
  const multipliers = {
    baseFare: 1.0,
    peakHour: isPeakHour() ? PEAK_HOUR_MULTIPLIER : 1.0,
    weekend: isWeekend() ? WEEKEND_MULTIPLIER : 1.0,
    surge: calculateSurgeMultiplier(queueSize),
    poolDiscount: isPool ? 0.75 : 1.0, // 25% discount for pooled rides
  };

  multipliers.total =
    multipliers.peakHour *
    multipliers.weekend *
    multipliers.surge *
    multipliers.poolDiscount;

  return multipliers;
}

/**
 * Calculate final price including all multipliers
 * @param {Number} distance - Distance in km
 * @param {Number} duration - Duration in minutes
 * @param {Object} options - {queueSize, isPool, weatherMultiplier}
 * @returns {Object} Price breakdown
 */
export function calculatePrice(distance, duration, options = {}) {
  const {
    queueSize = 0,
    isPool = false,
    weatherMultiplier = 1.0,
  } = options;

  // Base fare
  const baseFare = calculateBaseFare(distance, duration);

  // Get multipliers
  const multipliers = getMultipliers(queueSize, isPool);
  multipliers.weather = weatherMultiplier;
  multipliers.total *= weatherMultiplier;

  // Calculate final price
  const finalPrice = baseFare * multipliers.total;

  return {
    baseFare: round(baseFare),
    distance: round(distance, 1),
    duration: duration,
    multipliers: {
      peakHour: round(multipliers.peakHour, 2),
      weekend: round(multipliers.weekend, 2),
      surge: round(multipliers.surge, 2),
      poolDiscount: round(multipliers.poolDiscount, 2),
      weather: round(multipliers.weather, 2),
      total: round(multipliers.total, 2),
    },
    finalPrice: round(finalPrice),
    estimatedBreakdown: {
      baseFare: round(baseFare),
      surgeCharge: round(baseFare * (multipliers.surge - 1)),
      poolSavings: isPool ? round(baseFare * 0.25) : 0,
      weatherCharge: round(baseFare * (weatherMultiplier - 1)),
    },
  };
}

/**
 * Calculate price for pooled ride (distributed among passengers)
 * @param {Number} distance - Total route distance
 * @param {Number} duration - Total route duration
 * @param {Number} passengers - Number of passengers
 * @param {Object} options - Additional options
 * @returns {Object} Price per person and total
 */
export function calculatePoolPrice(distance, duration, passengers, options = {}) {
  const fullPrice = calculatePrice(distance, duration, { ...options, isPool: true });
  const pricePerPerson = round(fullPrice.finalPrice / passengers, 2);

  return {
    ...fullPrice,
    passengers,
    pricePerPerson,
    totalPoolPrice: fullPrice.finalPrice,
    breakdown: {
      total: round(fullPrice.finalPrice),
      perPerson: pricePerPerson,
      savings: round(fullPrice.finalPrice * 0.25 / passengers), // Savings per person
    },
  };
}

/**
 * Estimate price for a ride request
 * @param {Object} request - RideRequest object with locations
 * @param {Object} options - Additional options
 * @returns {Object} Price estimate
 */
export function estimatePrice(request, options = {}) {
  // This would normally use a routing service
  // For now, estimate based on coordinates
  const distance = estimateDistance(
    request.pickupLocation,
    request.dropoffLocation
  );
  const duration = Math.ceil((distance / 50) * 60); // 50 km/h avg

  const isPool = options.isPool !== undefined ? options.isPool : true;
  const passengers = request.passengers || 1;

  if (isPool && passengers > 1) {
    return calculatePoolPrice(distance, duration, passengers, options);
  } else {
    return calculatePrice(distance, duration, options);
  }
}

/**
 * Simple distance estimation using Haversine
 * @param {Object} coord1
 * @param {Object} coord2
 * @returns {Number} Distance in km
 */
function estimateDistance(coord1, coord2) {
  const R = 6371;
  const dLat = (coord2.latitude - coord1.latitude) * (Math.PI / 180);
  const dLng = (coord2.longitude - coord1.longitude) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.latitude * (Math.PI / 180)) *
    Math.cos(coord2.latitude * (Math.PI / 180)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.ceil(R * c * 10) / 10; // Round to 1 decimal
}

/**
 * Round number to specified decimals
 * @param {Number} value
 * @param {Number} decimals
 * @returns {Number}
 */
function round(value, decimals = 2) {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Get pricing history for analytics
 * @param {Array} rides - Array of completed rides
 * @returns {Object} Analytics
 */
export function getPricingAnalytics(rides) {
  if (rides.length === 0) {
    return {
      totalRevenue: 0,
      averagePrice: 0,
      averageDistance: 0,
      peakHourRevenue: 0,
      pooledRideRevenue: 0,
      surgeCount: 0,
    };
  }

  const totalRevenue = rides.reduce((sum, ride) => sum + (ride.price || 0), 0);
  const pooledRides = rides.filter(r => r.poolId);
  const peakHourRides = rides.filter(r => {
    const hour = new Date(r.createdAt).getHours();
    return (hour >= 9 && hour <= 11) || (hour >= 17 && hour <= 19);
  });

  return {
    totalRevenue: round(totalRevenue),
    averagePrice: round(totalRevenue / rides.length),
    averageDistance: round(
      rides.reduce((sum, r) => sum + (r.distance || 0), 0) / rides.length
    ),
    peakHourRevenue: round(
      peakHourRides.reduce((sum, r) => sum + (r.price || 0), 0)
    ),
    pooledRideRevenue: round(
      pooledRides.reduce((sum, r) => sum + (r.price || 0), 0)
    ),
    pooledRideCount: pooledRides.length,
    totalRides: rides.length,
  };
}

export default {
  isPeakHour,
  isWeekend,
  calculateSurgeMultiplier,
  calculateBaseFare,
  getMultipliers,
  calculatePrice,
  calculatePoolPrice,
  estimatePrice,
  getPricingAnalytics,
};
