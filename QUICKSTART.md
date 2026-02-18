# Quick Start Guide

## For Evaluators and Testers

This guide will help you quickly set up and test the Ride Pooling System.

---

## Option 1: Using Provided Test Credentials (Fastest)

If test credentials are provided, skip to step 3.

---

## Option 2: Set Up From Scratch (15 minutes)

### Step 1: Prerequisites Check

```bash
# Check Node.js version (should be v20+)
node --version

# Check npm version (should be v10+)
npm --version

# If not installed, download from: https://nodejs.org/
```

### Step 2: Clone and Install

```bash
# Navigate to project
cd ride-pooling

# Install dependencies
npm install
```

### Step 3: Database Setup

#### MongoDB Atlas (Recommended - Free)

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Create free account
3. Create a free cluster (M0 - Free tier)
4. Create database user:
   - Click "Database Access" → "Add New Database User"
   - Username: `ridepool`
   - Password: Generate secure password
5. Whitelist IP:
   - Click "Network Access" → "Add IP Address"
   - For testing: Click "Allow Access from Anywhere" (0.0.0.0/0)
6. Get connection string:
   - Click "Database" → "Connect" → "Connect your application"
   - Copy connection string
   - Replace `<password>` with your password

#### Redis Cloud (Recommended - Free)

1. Go to https://redis.com/try-free/
2. Create free account
3. Create free database
4. Get credentials from dashboard:
   - Host
   - Port
   - Password

### Step 4: Configure Environment

```bash
# Create .env file
cp .env.example .env

# Edit .env with your credentials
# (Use any text editor)
```

Example `.env`:
```env
DATABASE_URL=mongodb+srv://ridepool:yourpassword@cluster0.xxxxx.mongodb.net/ridepooling?retryWrites=true&w=majority
REDIS_HOST=redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com
REDIS_PORT=12345
REDIS_USERNAME=default
REDIS_PASSWORD=your_redis_password
PORT=3000
NODE_ENV=development
```

### Step 5: Start the Server

```bash
npm start
```

Expected output:
```
✓ Redis connected
MongoDB connected successfully
Server running on port 3000
```

---

## Testing the API

### 1. Health Check (Verify Server is Running)

```bash
curl http://localhost:3000/rides/health
```

Expected: `"status": "healthy"`

### 2. Create a Ride Request

```bash
curl -X POST http://localhost:3000/rides/request \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "testuser001",
    "pickupLocation": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "address": "JFK Airport"
    },
    "dropoffLocation": {
      "latitude": 40.7580,
      "longitude": -73.9855,
      "address": "Times Square"
    },
    "passengers": 2,
    "luggage": 1,
    "maxDetour": 10
  }'
```

Save the `requestId` from response!

### 3. Get Price Estimate

```bash
curl "http://localhost:3000/rides/estimate-price?pickupLatitude=40.7128&pickupLongitude=-74.0060&dropoffLatitude=40.7580&dropoffLongitude=-73.9855&passengers=2&isPool=true"
```

### 4. Create Multiple Requests (Test Batch Processing)

```bash
# Run this 5 times to trigger batch processing
for i in {1..5}; do
  curl -X POST http://localhost:3000/rides/request \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"user00$i\",
      \"pickupLocation\": {\"latitude\": 40.7128, \"longitude\": -74.0060},
      \"dropoffLocation\": {\"latitude\": 40.7580, \"longitude\": -73.9855},
      \"passengers\": 1,
      \"luggage\": 0,
      \"maxDetour\": 10
    }"
  sleep 0.1
done
```

Wait 1 second, then check pools:

```bash
curl http://localhost:3000/rides/pools
```

### 5. Check Request Status

```bash
# Replace with your requestId
curl http://localhost:3000/rides/YOUR_REQUEST_ID
```

Status should change from `pending` to `ASSIGNED`.

### 6. Get User History

```bash
curl "http://localhost:3000/rides/user/testuser001/history?limit=10"
```

### 7. Check System Metrics

```bash
curl "http://localhost:3000/rides/metrics?days=1"
```

---

## Using Postman (Recommended)

### Import Collection

1. Open Postman
2. Click "Import"
3. Select `postman_collection.json`
4. All endpoints ready to test!

### Set Environment Variable

1. Click gear icon (top right)
2. Add variable: `base_url = http://localhost:3000`
3. Save

Now you can test all endpoints with one click!

---

## Testing WebSocket (Real-time Notifications)

### Option 1: Using Browser Console

```javascript
// Open browser console (F12)
const ws = new WebSocket('ws://localhost:3000?userId=testuser001');

ws.onopen = () => console.log('Connected!');
ws.onmessage = (event) => {
  console.log('Notification:', JSON.parse(event.data));
};

// Keep browser tab open, then create a ride request
// You'll see real-time notification when matched!
```

### Option 2: Using Node.js Script

Create `test-websocket.js`:

```javascript
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3000?userId=testuser001');

ws.on('open', () => {
  console.log('✓ WebSocket connected');
  console.log('Waiting for notifications...');
});

ws.on('message', (data) => {
  const notification = JSON.parse(data);
  console.log('📢 Notification received:', notification);
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

// Keep connection alive
setTimeout(() => {
  console.log('Still listening...');
}, 60000);
```

Run: `node test-websocket.js`

---

## Testing Batch Processing

### Watch the Magic Happen!

1. Start server: `npm start`
2. Open 2 terminals

**Terminal 1:** Monitor logs
```bash
# Watch server output
tail -f logs.txt  # Or just watch server terminal
```

**Terminal 2:** Create requests
```bash
# Create 5 requests quickly
bash
for i in {1..5}; do
  curl -X POST http://localhost:3000/rides/request \
    -H "Content-Type: application/json" \
    -d "{\"userId\": \"user$i\", \"pickupLocation\": {\"latitude\": 40.71, \"longitude\": -74.00}, \"dropoffLocation\": {\"latitude\": 40.75, \"longitude\": -73.98}, \"passengers\": 1}"
done
```

**Watch:** Within 500ms, batch worker will process and create pools!

---

## Expected Results

### After Creating 5 Requests:

1. **Requests Created:** Status = `pending`
2. **Queue Size:** 5 items
3. **Wait:** ~500ms
4. **Batch Worker Runs:** Processes 5 requests
5. **Pool Created:** 1 pool with all compatible requests
6. **Status Updated:** `pending` → `ASSIGNED`
7. **WebSocket Notification:** Users notified
8. **Queue Size:** 0

---

## Troubleshooting

### Server won't start

```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux

# Use different port
PORT=8080 npm start
```

### MongoDB connection error

```bash
# Check connection string format
mongodb+srv://username:password@cluster.mongodb.net/database

# Common issues:
# - Wrong password (URL encode special characters)
# - IP not whitelisted
# - Network firewall blocking
```

### Redis connection error

```bash
# Check credentials
# Make sure host, port, password are correct in .env

# Test Redis connection
redis-cli -h your-host -p your-port -a your-password ping
# Should return: PONG
```

### No batch processing happening

```bash
# Check batch worker started
# Should see in logs: "Batch processed: ..."

# Check queue has items
curl http://localhost:3000/rides/health
# Check "queue.size" in response
```

---

## Sample Test Scenarios

### Scenario 1: Basic Request Flow
1. Create request
2. Get estimate
3. Check status
4. Wait for matching
5. Verify pool created

### Scenario 2: Cancellation
1. Create request
2. Cancel immediately
3. Verify removed from queue
4. Status = cancelled

### Scenario 3: Batch Matching
1. Create 5 similar requests (same area)
2. Wait 500ms
3. Verify single pool created
4. All requests in same pool

### Scenario 4: No Matching
1. Create 2 requests far apart
2. Wait for batch processing
3. Verify 2 separate pools (no matching)

### Scenario 5: Peak Hour Pricing
1. Create request during 9-11 AM or 5-7 PM
2. Check price estimate
3. Verify 1.5x multiplier applied

---

## Performance Testing

### Load Test with curl

```bash
# Create 100 requests
for i in {1..100}; do
  curl -X POST http://localhost:3000/rides/request \
    -H "Content-Type: application/json" \
    -d "{\"userId\": \"load$i\", \"pickupLocation\": {\"latitude\": 40.71, \"longitude\": -74.00}, \"dropoffLocation\": {\"latitude\": 40.75, \"longitude\": -73.98}, \"passengers\": 1}" &
done
wait

# Check metrics
curl http://localhost:3000/rides/metrics
```

Expected: All processed within a few seconds.

---

## What to Look For (Evaluation Criteria)

✅ **Functionality**
- [ ] Requests created and saved
- [ ] Batch processing works
- [ ] Matching algorithm groups compatible requests
- [ ] Price calculation includes all multipliers
- [ ] WebSocket notifications sent
- [ ] Cancellation works

✅ **Performance**
- [ ] Response time < 100ms
- [ ] Batch processing < 500ms
- [ ] Can handle 100+ requests
- [ ] No memory leaks

✅ **Code Quality**
- [ ] Clean, organized structure
- [ ] Proper error handling
- [ ] Comprehensive documentation
- [ ] Algorithm complexity documented

✅ **API Design**
- [ ] RESTful endpoints
- [ ] Clear request/response format
- [ ] Proper HTTP status codes
- [ ] Pagination where needed

---

## Next Steps

1. ✅ Server running
2. ✅ API tested with Postman
3. ✅ Batch processing verified
4. ✅ WebSocket working
5. 📝 Read ARCHITECTURE.md for design details
6. 📝 Read COMPLEXITY.md for algorithm analysis
7. 🚀 Deploy to cloud (optional)

---

**Need Help?** Check the main README.md or create an issue on GitHub.

**Happy Testing! 🚀**
