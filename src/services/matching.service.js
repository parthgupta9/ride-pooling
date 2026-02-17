/**
 * Matching Algorithm Service
 * Implements nearest-neighbor algorithm for ride pooling
 * 
 * Algorithm Complexity:
 * Time: O(n²) where n = batch size
 * Space: O(n) for storing pools
 */

const MAX_PASSENGERS_PER_POOL = 4;
const MAX_LUGGAGE_PER_PERSON = 10;
const MAX_DETOUR_MINUTES = 10;
const PROXIMITY_THRESHOLD_KM = 2; // km

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @param {Object} coord1 - {latitude, longitude}
 * @param {Object} coord2 - {latitude, longitude}
 * @returns {Number} Distance in kilometers
 */
export function calculateDistance(coord1, coord2) {
  const R = 6371; // Earth radius in km
  const dLat = (coord2.latitude - coord1.latitude) * (Math.PI / 180);
  const dLng = (coord2.longitude - coord1.longitude) * (Math.PI / 180);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.latitude * (Math.PI / 180)) *
    Math.cos(coord2.latitude * (Math.PI / 180)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate estimated travel time between coordinates
 * Simplified: 50 km/h average speed
 * @param {Number} distance - in km
 * @returns {Number} Time in minutes
 */
export function calculateEstimatedTime(distance) {
  const avgSpeedKmph = 50;
  return Math.ceil((distance / avgSpeedKmph) * 60);
}

/**
 * Check if two requests can be pooled together
 * @param {Object} req1 - First request
 * @param {Object} req2 - Second request
 * @param {Number} currentPoolSeats - Remaining seats in pool
 * @returns {Boolean} true if compatible
 */
export function areRequestsCompatible(req1, req2, currentPoolSeats = MAX_PASSENGERS_PER_POOL) {
  // Check 1: Seat availability
  if (req2.passengers > currentPoolSeats) {
    return false;
  }

  // Check 2: Luggage space
  const totalLuggage = (req1.luggage || 0) + (req2.luggage || 0);
  const totalPassengers = (req1.passengers || 1) + (req2.passengers || 1);
  if (totalLuggage > totalPassengers * MAX_LUGGAGE_PER_PERSON) {
    return false;
  }

  // Check 3: Detour tolerance
  const pickupDistance = calculateDistance(
    req1.pickupLocation,
    req2.pickupLocation
  );
  const dropoffDistance = calculateDistance(
    req1.dropoffLocation,
    req2.dropoffLocation
  );
  
  const detourDistance = pickupDistance + dropoffDistance;
  const detourMinutes = calculateEstimatedTime(detourDistance);
  
  if (detourMinutes > (req2.maxDetour || MAX_DETOUR_MINUTES)) {
    return false;
  }

  // Check 4: Geographic proximity (both requests nearby)
  const directDistance = calculateDistance(
    req1.pickupLocation,
    req2.pickupLocation
  );
  if (directDistance > PROXIMITY_THRESHOLD_KM) {
    return false;
  }

  return true;
}

/**
 * Calculate total route distance for a pool
 * Uses nearest neighbor approach to visit all pickup/dropoff points
 * @param {Array} requests - Array of RideRequest objects
 * @returns {Number} Total distance in km
 */
export function calculatePoolRouteDistance(requests) {
  if (requests.length === 0) return 0;
  if (requests.length === 1) {
    return calculateDistance(
      requests[0].pickupLocation,
      requests[0].dropoffLocation
    );
  }

  // Simplified: sum of all individual distances
  let totalDistance = 0;
  
  for (const request of requests) {
    totalDistance += calculateDistance(
      request.pickupLocation,
      request.dropoffLocation
    );
  }
  
  // Add inter-request distances
  for (let i = 0; i < requests.length - 1; i++) {
    totalDistance += calculateDistance(
      requests[i].dropoffLocation,
      requests[i + 1].pickupLocation
    );
  }

  return totalDistance;
}

/**
 * Main matching algorithm - Nearest Neighbor approach
 * Groups compatible requests into pools
 * 
 * @param {Array} requests - Array of pending RideRequest objects
 * @returns {Array} Array of created pool objects with request assignments
 */
export function matchRequests(requests) {
  if (!requests || requests.length === 0) {
    return [];
  }

  const pools = [];
  const matched = new Set();

  // Sort requests by pickup location (nearest origin first)
  const sorted = [...requests].sort((a, b) => {
    const distA = Math.abs(a.pickupLocation.latitude) + Math.abs(a.pickupLocation.longitude);
    const distB = Math.abs(b.pickupLocation.latitude) + Math.abs(b.pickupLocation.longitude);
    return distA - distB;
  });

  // Greedy approach: match requests sequentially
  for (let i = 0; i < sorted.length; i++) {
    if (matched.has(i)) continue;

    const poolRequests = [sorted[i]];
    matched.add(i);
    let availableSeats = MAX_PASSENGERS_PER_POOL - (sorted[i].passengers || 1);

    // Try to add other requests to this pool
    for (let j = i + 1; j < sorted.length; j++) {
      if (matched.has(j)) continue;

      const currentReq = sorted[j];
      
      // Check compatibility with ALL requests in pool
      const isCompatibleWithAll = poolRequests.every(req =>
        areRequestsCompatible(req, currentReq, availableSeats)
      );

      if (isCompatibleWithAll && currentReq.passengers <= availableSeats) {
        poolRequests.push(currentReq);
        matched.add(j);
        availableSeats -= currentReq.passengers;

        // Pool is full
        if (availableSeats <= 0) break;
      }
    }

    // Create pool object
    const routeDistance = calculatePoolRouteDistance(poolRequests);
    const estimatedDuration = calculateEstimatedTime(routeDistance);

    const pool = {
      requests: poolRequests.map(r => r._id || r.id),
      totalPassengers: poolRequests.reduce((sum, r) => sum + (r.passengers || 1), 0),
      totalLuggage: poolRequests.reduce((sum, r) => sum + (r.luggage || 0), 0),
      estimatedDistance: routeDistance,
      estimatedDuration: estimatedDuration,
      pickupLocation: poolRequests[0].pickupLocation,
      dropoffLocation: poolRequests[poolRequests.length - 1].dropoffLocation,
      baseFare: calculatePoolFare(routeDistance, estimatedDuration),
      costPerPerson: Math.ceil(
        (calculatePoolFare(routeDistance, estimatedDuration) / 
         poolRequests.length) * 100
      ) / 100,
    };

    pools.push(pool);
  }

  return pools;
}

/**
 * Calculate base fare for a pool
 * @param {Number} distance - Distance in km
 * @param {Number} duration - Duration in minutes
 * @returns {Number} Fare in USD
 */
export function calculatePoolFare(distance, duration) {
  const BASE_FARE = 5.0;
  const PER_KM_RATE = 0.5;
  const PER_MINUTE_RATE = 0.25;

  let fare = BASE_FARE + (distance * PER_KM_RATE) + (duration * PER_MINUTE_RATE);
  
  // Apply surge pricing if peak hours
  const hour = new Date().getHours();
  const isPeakHour = (hour >= 9 && hour <= 11) || (hour >= 17 && hour <= 19);
  
  if (isPeakHour) {
    fare *= 1.5; // 50% surge
  }

  // Round to 2 decimals
  return Math.ceil(fare * 100) / 100;
}

/**
 * Get matching metrics for analysis
 * @param {Array} pools - Array of created pools
 * @param {Array} originalRequests - Original requests
 * @returns {Object} Metrics
 */
export function getMatchingMetrics(pools, originalRequests) {
  const totalRequests = originalRequests.length;
  const matchedRequests = pools.reduce((sum, p) => sum + p.requests.length, 0);
  const avgPoolSize = pools.length > 0 ? (matchedRequests / pools.length).toFixed(2) : 0;
  const totalDistance = pools.reduce((sum, p) => sum + p.estimatedDistance, 0);
  const avgDistance = pools.length > 0 ? (totalDistance / pools.length).toFixed(2) : 0;

  return {
    totalRequests,
    matchedRequests,
    unmatchedRequests: totalRequests - matchedRequests,
    totalPools: pools.length,
    avgPoolSize,
    avgDistance,
    avgFarePerRequest: pools.reduce((sum, p) => sum + p.baseFare, 0) / (matchedRequests || 1),
  };
}

/**
 * Complexity Analysis:
 * 
 * matchRequests(requests):
 * Time Complexity: O(n²)
 *   - Outer loop: O(n) through sorted requests
 *   - Inner loop: O(n) through remaining requests
 *   - areRequestsCompatible: O(1) - constant calculations
 *   - Overall: O(n) * O(n) = O(n²)
 * 
 * Space Complexity: O(n)
 *   - Sorted array: O(n)
 *   - Matched set: O(n)
 *   - Pools array: O(n)
 *   - Overall: O(n)
 * 
 * Optimization Notes:
 * - Could use KD-tree for geographic queries: O(n log n) + O(log n) queries
 * - Could use spatial indexing: MongoDB geospatial index
 * - Batch processing with limited batch size (5) keeps n small
 * - Better for real-time performance than global optimization
 */

export default {
  calculateDistance,
  calculateEstimatedTime,
  areRequestsCompatible,
  calculatePoolRouteDistance,
  matchRequests,
  calculatePoolFare,
  getMatchingMetrics,
};
