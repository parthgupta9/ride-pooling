# Smart Airport Ride Pooling Backend - System Architecture

## High-Level Architecture (HLA)

```
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                               │
│  (Express.js REST APIs + WebSocket for Real-time Updates)      │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼────────┐ ┌────▼──────────┐ ┌──▼─────────────┐
│  Request       │ │ Pool Manager  │ │ Pricing        │
│  Controller    │ │ Controller    │ │ Controller     │
└───────┬────────┘ └────┬──────────┘ └───┬────────────┘
        │                │                 │
        └────────────────┼─────────────────┘
                         │
        ┌────────────────▼────────────────┐
        │   Business Logic Layer          │
        │  ┌──────────────────────────┐  │
        │  │ Matching Algorithm       │  │
        │  │ - Nearest Neighbor       │  │
        │  │ - Constraint Checking    │  │
        │  │ - Deviation Minimization │  │
        │  └──────────────────────────┘  │
        │  ┌──────────────────────────┐  │
        │  │ Queue Manager            │  │
        │  │ - Redis Queuing          │  │
        │  │ - Batch Processing       │  │
        │  └──────────────────────────┘  │
        │  ┌──────────────────────────┐  │
        │  │ Pricing Engine           │  │
        │  │ - Dynamic Pricing        │  │
        │  │ - Surge Pricing          │  │
        │  └──────────────────────────┘  │
        └────────────────┬────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼────────┐ ┌────▼──────────┐ ┌──▼─────────────┐
│  MongoDB       │ │ Redis Cloud   │ │ WebSocket      │
│  (Persistence) │ │ (Queuing)     │ │ (Real-time)    │
└────────────────┘ └───────────────┘ └────────────────┘

```

## Data Flow

```
┌─────────────────┐
│ User Request    │
│ Ride Request    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Validate Request                │
│ - Check seats/luggage limits    │
│ - Check detour tolerance        │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Save to MongoDB                 │
│ Status: PENDING                 │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Enqueue to Redis                │
│ (ride:queue)                    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Batch Worker (500ms interval)   │
│ Process 5 requests at a time    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Matching Algorithm              │
│ - Group compatible requests     │
│ - Optimize routes               │
│ - Calculate pricing             │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Create RidePool                 │
│ Status: ASSIGNED                │
│ Assign to requests              │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Send WebSocket Notifications    │
│ to matched users                │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Driver Assignment               │
│ Calculate ETA & Final Price     │
└─────────────────────────────────┘
```

## Component Architecture

### 1. API Layer (Express.js)
- **Ride Controller**: Handle ride request/cancellation
- **Pool Controller**: Manage pool queries
- **Pricing Controller**: Get price estimates
- **History Controller**: Retrieve ride history

### 2. Business Logic Layer
- **Matching Service**: Core algorithm for grouping
- **Queue Manager**: Redis queue handling
- **Price Calculator**: Dynamic pricing logic
- **Notification Service**: WebSocket updates

### 3. Data Layer
- **MongoDB**: Persistent storage
  - RideRequest (indexed by userId, status, location)
  - RidePool (indexed by status, createdAt)
  - Driver (indexed by availability)
  - RideHistory (indexed by userId, createdAt)

- **Redis**: Real-time operations
  - ride:queue (pending requests)
  - ride:pool:POOL_ID (pool members)
  - user:USERID:socket (WebSocket connections)

### 4. Infrastructure
- **WebSocket Server**: Real-time notifications
- **Batch Worker**: Periodic matching (500ms)
- **Concurrency Handler**: Lock management

## Performance Optimization Strategies

### Database Indexing
```
RideRequest:
- userId, status (compound)
- status, createdAt (for batch queries)
- pickupLocation.latitude, pickupLocation.longitude (geo-spatial)
- poolId

RidePool:
- status, createdAt
- driverId
- estimatedArrival
```

### Caching Strategy
- Cache frequently accessed pools in Redis
- Cache pricing calculations (5-min TTL)
- Cache driver availability

### Concurrency
- Use MongoDB atomic operations for updates
- Queue-based processing (500ms batches)
- Redis locks for critical sections
- Connection pooling for DB

### Scalability
- Horizontal scaling: Multiple worker instances
- Load balancing: NGINX
- Database replication: MongoDB replica set
- Redis clustering: For distributed queuing

## Technology Stack

| Component | Technology | Reason |
|-----------|-----------|--------|
| Runtime | Node.js (v20) | Fast, event-driven |
| Framework | Express.js | Lightweight, flexible |
| Database | MongoDB | Flexible schema, geospatial support |
| Caching/Queue | Redis (ioredis) | Fast, reliable, cluster support |
| Validation | Mongoose Schema | Data consistency |
| Real-time | WebSocket (ws) | Bi-directional communication |
| Task Scheduler | Node setInterval | Simple batch processing |

## API Endpoints

```
POST   /rides/request              - Create ride request
GET    /rides/:requestId           - Get request details
POST   /rides/:requestId/cancel    - Cancel request
GET    /rides/pools                - List active pools
GET    /rides/pools/:poolId        - Get pool details
POST   /rides/:poolId/rate         - Rate completed ride
GET    /users/:userId/rides        - Get user's ride history
GET    /estimates/price            - Calculate fare estimate
GET    /health                     - System health check
GET    /metrics                    - Performance metrics
```

## Assumptions & Constraints

1. **Airport Context**: Single airport, fixed zones
2. **Seat Capacity**: 4 seats per cab (max 4 passengers)
3. **Luggage Limit**: 10 units per passenger
4. **Detour Tolerance**: 10 minutes default
5. **Batch Size**: 5 requests per batching cycle
6. **Processing Interval**: 500ms between batches
7. **Base Fare**: $5 per ride
8. **Per-KM Rate**: $0.5 per km
9. **Surge Multiplier**: 1.5x during peak hours (9-11 AM, 5-7 PM)
10. **Concurrent Users**: Queue-based, scales horizontally
