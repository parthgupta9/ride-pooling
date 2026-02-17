# Low-Level Design Document

## Class Diagram

```
┌─────────────────────────────────────┐
│         RideRequest                 │
├─────────────────────────────────────┤
│ - _id: ObjectId                     │
│ - userId: String                    │
│ - pickupLocation: Coordinates       │
│ - dropoffLocation: Coordinates      │
│ - passengers: Number (1-4)          │
│ - luggage: Number (0-10)            │
│ - maxDetour: Number (minutes)       │
│ - status: enum                      │
│ - poolId: ObjectId (ref RidePool)   │
│ - estimatedPickupTime: Date         │
│ - estimatedDropoffTime: Date        │
│ - rating: Number (1-5)              │
│ - feedback: String                  │
│ - createdAt: Date                   │
│ - updatedAt: Date                   │
├─────────────────────────────────────┤
│ + validate(): boolean               │
│ + calculateDuration(): Number       │
│ + isCompatibleWith(req): boolean    │
└─────────────────────────────────────┘
           │
           │ references
           ▼
┌─────────────────────────────────────┐
│         RidePool                    │
├─────────────────────────────────────┤
│ - _id: ObjectId                     │
│ - requests: [RideRequest]           │
│ - status: enum                      │
│ - driverId: ObjectId (ref Driver)   │
│ - pickupLocation: Coordinates       │
│ - dropoffLocation: Coordinates      │
│ - seats: Number (4)                 │
│ - baseFare: Number                  │
│ - totalFare: Number                 │
│ - costPerPerson: Number             │
│ - estimatedDuration: Number         │
│ - estimatedArrival: Date            │
│ - createdAt: Date                   │
├─────────────────────────────────────┤
│ + addRequest(req): boolean          │
│ + removeRequest(reqId): boolean     │
│ + calculateCost(): Number           │
│ + isValid(): boolean                │
│ + getOptimizedRoute(): Route        │
└─────────────────────────────────────┘
           │
           │ references
           ▼
┌─────────────────────────────────────┐
│         Driver                      │
├─────────────────────────────────────┤
│ - _id: ObjectId                     │
│ - name: String                      │
│ - phone: String                     │
│ - maxPassengers: Number (4)         │
│ - currentLocation: Coordinates      │
│ - isAvailable: Boolean              │
│ - totalRides: Number                │
│ - rating: Number (1-5)              │
│ - vehicleType: String               │
│ - createdAt: Date                   │
├─────────────────────────────────────┤
│ + updateLocation(coords): void      │
│ + setAvailability(bool): void       │
│ + getRating(): Number               │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      Matching Algorithm             │
├─────────────────────────────────────┤
│ - candidatePools: RidePool[]        │
│ - pendingRequests: RideRequest[]    │
├─────────────────────────────────────┤
│ + matchRequests(reqs[]): RidePool[] │
│ + findCompatible(req): RidePool[]   │
│ + isConstraintValid(r1, r2): bool  │
│ + calculateDeviation(path): Number  │
│ + optimizeRoute(pool): Route        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      Price Calculator               │
├─────────────────────────────────────┤
│ - baseFare: Number                  │
│ - kmRate: Number                    │
│ - surgeMultiplier: Number           │
├─────────────────────────────────────┤
│ + calculateFare(distance, time): N° │
│ + getSurgeMultiplier(): Number      │
│ + distribCost(pool): void           │
│ + isPeakHour(): Boolean             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      Queue Manager                  │
├─────────────────────────────────────┤
│ - redis: Redis                      │
│ - queueKey: String                  │
├─────────────────────────────────────┤
│ + enqueueRide(req): Promise<void>   │
│ + dequeueBatch(size): Promise<Req[]>│
│ + getQueueSize(): Promise<Number>   │
│ + clearQueue(): Promise<void>       │
└─────────────────────────────────────┘
```

## Design Patterns Used

### 1. Strategy Pattern
- **Matching Algorithm**: Different strategies for grouping
  - Nearest Neighbor (used)
  - K-means clustering (future)

### 2. Factory Pattern
- **RidePool Factory**: Creates pools based on request batch

### 3. Observer Pattern
- **WebSocket Notifications**: Observers notified of pool assignments

### 4. Singleton Pattern
- **Redis Client**: Single instance across app
- **Price Calculator**: Single instance for consistency

### 5. Builder Pattern
- **RidePool Builder**: Construct complex pool objects
- **RideRequest Builder**: Build request with validation

### 6. Repository Pattern
- **RideRepository**: Abstract database operations
- **PoolRepository**: Pool data access layer

## Key Algorithms

### Matching Algorithm (Nearest Neighbor)

```
Function: matchRequests(pendingRequests)
Input: Array of pending RideRequest objects
Output: Array of created RidePool objects

Algorithm:
1. Sort requests by pickup location (nearest first)
2. While pendingRequests NOT empty:
   a. Create new pool with first request
   b. For each remaining request:
      - If constraints satisfied (seats, luggage, detour):
        | - Calculate route deviation
        | - If deviation < maxDetour:
        |   Add request to pool
      - If pool full (4 passengers):
        | - Break inner loop
   c. Create RidePool and save
   d. Remove matched requests
3. Return created pools

Time Complexity: O(n²) where n = batch size
Space Complexity: O(n) for storing pools
```

### Constraint Validation

```
Function: isConstraintValid(req1, req2)
Input: Two RideRequest objects
Output: Boolean (compatible or not)

Checks:
1. Seat availability: pool.seats >= req2.passengers
2. Luggage space: sum(luggage) <= MAX_LUGGAGE * passengers
3. Detour tolerance:
   - Calculate detour distance between locations
   - Check if detour <= req2.maxDetour
4. Geographic proximity:
   - Distance between pickup points < PROXIMITY_THRESHOLD
5. Direction compatibility:
   - Both going same general direction

Return: true if all constraints satisfied, else false
```

### Price Calculation

```
Function: calculateFare(distance, time)
Input: distance (km), time (minutes)
Output: price (USD)

Formula:
baseFare = 5.00
perKm = 0.5
perMin = 0.25

fare = baseFare + (distance * perKm) + (time * perMin)
If isPeakHour():
    surge = 1.5
    fare *= surge

Return: ceil(fare * 100) / 100  // Round to 2 decimals
```

## Concurrency Strategy

### Problem: Race Conditions
- Multiple workers matching same request
- Concurrent ride cancellations
- Price updates during assignment

### Solutions

#### 1. Queue-Based Processing
```
- Single batch processor every 500ms
- Only one batch processed at a time
- Prevents duplicate matching
```

#### 2. Atomic Database Operations
```javascript
// MongoDB atomic update
await RideRequest.updateOne(
  { _id: requestId, status: "pending" },
  { 
    $set: { 
      status: "assigned",
      poolId: poolId,
      assignedAt: new Date()
    }
  }
);
// Update fails if status already changed
```

#### 3. Redis Locks
```javascript
// Lock before processing
const lockKey = `lock:pool:${poolId}`;
const acquired = await redis.set(
  lockKey,
  "1",
  "EX", 10,  // 10 second expiry
  "NX"       // Only if not exists
);

if (acquired) {
  // Process pool safely
} else {
  // Someone else has lock
}

// Release after
await redis.del(lockKey);
```

#### 4. Version Control
```javascript
// Add version field to detect conflicts
{
  _id: ObjectId,
  status: "assigned",
  __v: 1,  // Version number
}

// Update with version check
await RideRequest.updateOne(
  { _id: id, __v: currentVersion },
  { $set: { status: "confirmed" }, $inc: { __v: 1 } }
);
```

## Error Handling

```
RideErrors:
├── RequestValidationError (400)
│   ├── InvalidLocationError
│   ├── InvalidCapacityError
│   └── InvalidDetourError
├── NotFoundError (404)
│   ├── RequestNotFoundError
│   └── PoolNotFoundError
├── ConflictError (409)
│   ├── AlreadyAssignedError
│   └── AlreadyCancelledError
├── InternalError (500)
│   ├── DatabaseError
│   ├── RedisError
│   └── MatchingError
└── GatewayError (503)
    ├── ServiceUnavailableError
    └── DatabaseConnectionError
```

## Testing Strategy

```
Unit Tests:
- Constraint validation
- Price calculation
- Route optimization

Integration Tests:
- Request creation + queuing
- Matching algorithm
- Pool creation

Load Tests:
- 10,000 concurrent users
- 100 requests/second
- Latency < 300ms
```

## Future Enhancements

1. **Machine Learning**: Predict demand, optimize routes
2. **Surge Pricing**: Real-time demand-based pricing
3. **Driver Assignment**: Smart driver matching
4. **Analytics**: User behavior, profitability
5. **Mobile App**: Native mobile clients
6. **Metrics**: Prometheus + Grafana
7. **Distributed Tracing**: OpenTelemetry
8. **Microservices**: Scale individual services
