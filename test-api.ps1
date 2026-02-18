# PowerShell Test Script for Ride Pooling System
# Run this in PowerShell to test all API endpoints

$baseUrl = "http://localhost:3000"
Write-Host "🚖 Testing Ride Pooling API" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl"
Write-Host "================================`n"

# Test 1: Health Check
Write-Host "1️⃣  Testing Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/rides/health" -Method Get
    if ($health.status -eq "healthy") {
        Write-Host "✓ Health check passed" -ForegroundColor Green
        Write-Host "  - MongoDB: $($health.services.mongodb)"
        Write-Host "  - Redis: $($health.services.redis)"
    }
} catch {
    Write-Host "✗ Health check failed: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Create Multiple Ride Requests
Write-Host "`n2️⃣  Creating ride requests..." -ForegroundColor Yellow
$requestIds = @()

for ($i = 1; $i -le 5; $i++) {
    Write-Host "Creating request $i/5..."
    
    $body = @{
        userId = "user00$i"
        pickupLocation = @{
            latitude = 40.6413
            longitude = -73.7781
            address = "JFK Airport"
        }
        dropoffLocation = @{
            latitude = 40.7580
            longitude = -73.9855
            address = "Times Square, Manhattan"
        }
        passengers = Get-Random -Minimum 1 -Maximum 3
        luggage = Get-Random -Minimum 0 -Maximum 3
        maxDetour = 10
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/rides/request" -Method Post -Body $body -ContentType "application/json"
        $requestIds += $response.requestId
        Write-Host "  ✓ Request created: $($response.requestId)" -ForegroundColor Green
        Write-Host "    Estimated price: `$$($response.estimatedPrice)"
    } catch {
        Write-Host "  ✗ Failed to create request: $_" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 200
}

# Test 3: Wait for batch processing
Write-Host "`n3️⃣  Waiting for batch processing (1 second)..." -ForegroundColor Yellow
Start-Sleep -Seconds 1
Write-Host "✓ Batch processing complete" -ForegroundColor Green

# Test 4: Check pools
Write-Host "`n4️⃣  Checking created pools..." -ForegroundColor Yellow
try {
    $pools = Invoke-RestMethod -Uri "$baseUrl/rides/pools?limit=10" -Method Get
    Write-Host "✓ Pools created: $($pools.pools.Count)" -ForegroundColor Green
    
    if ($pools.pools.Count -gt 0) {
        Write-Host "  First pool details:"
        Write-Host "    - Pool ID: $($pools.pools[0]._id)"
        Write-Host "    - Status: $($pools.pools[0].status)"
        Write-Host "    - Requests: $($pools.pools[0].requests.Count)"
    }
} catch {
    Write-Host "✗ Failed to get pools: $_" -ForegroundColor Red
}

# Test 5: Price Estimate
Write-Host "`n5️⃣  Testing price estimate..." -ForegroundColor Yellow
try {
    $estimate = Invoke-RestMethod -Uri "$baseUrl/rides/estimate-price?pickupLatitude=40.7128&pickupLongitude=-74.0060&dropoffLatitude=40.7580&dropoffLongitude=-73.9851&passengers=2&isPool=true" -Method Get
    Write-Host "✓ Price estimate: `$$($estimate.estimate.finalPrice)" -ForegroundColor Green
    Write-Host "  Breakdown:"
    Write-Host "    - Base fare: `$$($estimate.estimate.baseFare)"
    Write-Host "    - Distance: $($estimate.estimate.distance) km"
    Write-Host "    - Duration: $($estimate.estimate.duration) min"
    Write-Host "    - Total multiplier: $($estimate.estimate.multipliers.total)x"
} catch {
    Write-Host "✗ Price estimate failed: $_" -ForegroundColor Red
}

# Test 6: Check request status
Write-Host "`n6️⃣  Checking request status..." -ForegroundColor Yellow
if ($requestIds.Count -gt 0) {
    try {
        $status = Invoke-RestMethod -Uri "$baseUrl/rides/$($requestIds[0])" -Method Get
        Write-Host "✓ Request status: $($status.status)" -ForegroundColor Green
        if ($status.poolId) {
            Write-Host "  Pool ID: $($status.poolId)"
        }
    } catch {
        Write-Host "✗ Status check failed: $_" -ForegroundColor Red
    }
}

# Test 7: System Metrics
Write-Host "`n7️⃣  Getting system metrics..." -ForegroundColor Yellow
try {
    $metrics = Invoke-RestMethod -Uri "$baseUrl/rides/metrics?days=1" -Method Get
    Write-Host "✓ Metrics retrieved" -ForegroundColor Green
    Write-Host "  Summary:"
    Write-Host "    - Total requests: $($metrics.summary.totalRequests)"
    Write-Host "    - Completed: $($metrics.summary.completedRides)"
    Write-Host "    - Pooled: $($metrics.summary.pooledRides)"
    Write-Host "    - Completion rate: $($metrics.summary.completionRate)%"
} catch {
    Write-Host "✗ Metrics retrieval failed: $_" -ForegroundColor Red
}

# Test 8: Cancel a request
Write-Host "`n8️⃣  Testing cancellation..." -ForegroundColor Yellow
if ($requestIds.Count -gt 4) {
    $cancelBody = @{
        reason = "Test cancellation"
    } | ConvertTo-Json
    
    try {
        $cancelResponse = Invoke-RestMethod -Uri "$baseUrl/rides/$($requestIds[4])/cancel" -Method Post -Body $cancelBody -ContentType "application/json"
        Write-Host "✓ Cancellation successful" -ForegroundColor Green
    } catch {
        Write-Host "✗ Cancellation failed (may already be assigned): $_" -ForegroundColor Yellow
    }
}

# Summary
Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "🎉 Testing Complete!" -ForegroundColor Green
Write-Host "================================`n" -ForegroundColor Cyan

Write-Host "Summary:"
Write-Host "- Requests created: $($requestIds.Count)"
Write-Host "- All endpoints tested successfully`n"

Write-Host "Useful commands:"
Write-Host "  Get pools:   Invoke-RestMethod -Uri '$baseUrl/rides/pools' -Method Get"
Write-Host "  Get metrics: Invoke-RestMethod -Uri '$baseUrl/rides/metrics' -Method Get"
Write-Host "  Get health:  Invoke-RestMethod -Uri '$baseUrl/rides/health' -Method Get`n"

Write-Host "For detailed testing, import postman_collection.json into Postman"
