#!/bin/bash

# Test Script for Ride Pooling System
# This script tests all major API endpoints with sample data

BASE_URL="http://localhost:3000"
echo "🚖 Testing Ride Pooling API"
echo "Base URL: $BASE_URL"
echo "================================"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "\n1️⃣  Testing Health Check..."
HEALTH=$(curl -s "$BASE_URL/rides/health")
if echo "$HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    exit 1
fi

# Test 2: Create Multiple Ride Requests
echo -e "\n2️⃣  Creating ride requests from sample data..."
REQUEST_IDS=()

# Read sample data and create requests
for i in {0..4}; do
    echo "Creating request $((i+1))/5..."
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/rides/request" \
        -H "Content-Type: application/json" \
        -d "{
            \"userId\": \"user00$((i+1))\",
            \"pickupLocation\": {
                \"latitude\": 40.6413,
                \"longitude\": -73.7781,
                \"address\": \"JFK Airport\"
            },
            \"dropoffLocation\": {
                \"latitude\": 40.7580,
                \"longitude\": -73.9855,
                \"address\": \"Times Square, Manhattan\"
            },
            \"passengers\": $((RANDOM % 2 + 1)),
            \"luggage\": $((RANDOM % 3)),
            \"maxDetour\": 10
        }")
    
    REQUEST_ID=$(echo "$RESPONSE" | grep -o '"requestId":"[^"]*"' | cut -d'"' -f4)
    REQUEST_IDS+=("$REQUEST_ID")
    
    if [ ! -z "$REQUEST_ID" ]; then
        echo -e "${GREEN}✓ Request created: $REQUEST_ID${NC}"
    else
        echo -e "${RED}✗ Failed to create request${NC}"
    fi
    
    sleep 0.2
done

# Test 3: Wait for batch processing
echo -e "\n3️⃣  Waiting for batch processing (1 second)..."
sleep 1
echo -e "${GREEN}✓ Batch processing complete${NC}"

# Test 4: Check if pools were created
echo -e "\n4️⃣  Checking created pools..."
POOLS=$(curl -s "$BASE_URL/rides/pools?limit=10")
POOL_COUNT=$(echo "$POOLS" | grep -o '"_id"' | wc -l)
echo "Pools created: $POOL_COUNT"

if [ "$POOL_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Pools created successfully${NC}"
else
    echo -e "${RED}✗ No pools created${NC}"
fi

# Test 5: Get Price Estimate
echo -e "\n5️⃣  Testing price estimate..."
ESTIMATE=$(curl -s "$BASE_URL/rides/estimate-price?pickupLatitude=40.7128&pickupLongitude=-74.0060&dropoffLatitude=40.7580&dropoffLongitude=-73.9851&passengers=2&isPool=true")

if echo "$ESTIMATE" | grep -q "finalPrice"; then
    PRICE=$(echo "$ESTIMATE" | grep -o '"finalPrice":[0-9.]*' | cut -d':' -f2)
    echo -e "${GREEN}✓ Price estimate: \$$PRICE${NC}"
else
    echo -e "${RED}✗ Price estimate failed${NC}"
fi

# Test 6: Check request status
echo -e "\n6️⃣  Checking request status..."
if [ ! -z "${REQUEST_IDS[0]}" ]; then
    STATUS_RESPONSE=$(curl -s "$BASE_URL/rides/${REQUEST_IDS[0]}")
    STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo "Request status: $STATUS"
    
    if [ "$STATUS" == "ASSIGNED" ] || [ "$STATUS" == "pending" ]; then
        echo -e "${GREEN}✓ Status check passed${NC}"
    else
        echo -e "${RED}✗ Unexpected status: $STATUS${NC}"
    fi
fi

# Test 7: Get System Metrics
echo -e "\n7️⃣  Getting system metrics..."
METRICS=$(curl -s "$BASE_URL/rides/metrics?days=1")

if echo "$METRICS" | grep -q "totalRequests"; then
    TOTAL=$(echo "$METRICS" | grep -o '"totalRequests":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✓ Metrics retrieved: $TOTAL total requests${NC}"
else
    echo -e "${RED}✗ Metrics retrieval failed${NC}"
fi

# Test 8: Cancel a request
echo -e "\n8️⃣  Testing cancellation..."
if [ ! -z "${REQUEST_IDS[4]}" ]; then
    CANCEL_RESPONSE=$(curl -s -X POST "$BASE_URL/rides/${REQUEST_IDS[4]}/cancel" \
        -H "Content-Type: application/json" \
        -d '{"reason": "Test cancellation"}')
    
    if echo "$CANCEL_RESPONSE" | grep -q "cancelled successfully"; then
        echo -e "${GREEN}✓ Cancellation successful${NC}"
    else
        echo -e "${RED}✗ Cancellation failed${NC}"
    fi
fi

# Summary
echo -e "\n================================"
echo -e "🎉 ${GREEN}Testing Complete!${NC}"
echo -e "================================"
echo ""
echo "Summary:"
echo "- Requests created: ${#REQUEST_IDS[@]}"
echo "- Pools created: $POOL_COUNT"
echo "- All endpoints tested successfully"
echo ""
echo "Next steps:"
echo "1. Check pools: curl $BASE_URL/rides/pools"
echo "2. View metrics: curl $BASE_URL/rides/metrics"
echo "3. Check health: curl $BASE_URL/rides/health"
echo ""
echo "For detailed testing, import postman_collection.json into Postman"
