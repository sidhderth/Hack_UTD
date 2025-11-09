# AEGIS Deployment Test Script
# Run this in PowerShell to test your deployment

Write-Host "🧪 Testing AEGIS Deployment..." -ForegroundColor Cyan
Write-Host ""

# Your API URL
$apiUrl = "https://0khhmki0e0.execute-api.us-east-1.amazonaws.com/dev"

# Test 1: Check if API is accessible
Write-Host "Test 1: Checking API Gateway..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$apiUrl/v1/screen_entity" -Method POST -ContentType "application/json" -Body '{"entityType":"PERSON","name":"Test"}' -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ API is accessible!" -ForegroundColor Green
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ API is working! (401 = needs authentication, which is correct)" -ForegroundColor Green
    } else {
        Write-Host "❌ API Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Test 2: Your API Endpoints" -ForegroundColor Yellow
Write-Host "  POST $apiUrl/v1/screen_entity" -ForegroundColor Cyan
Write-Host "  GET  $apiUrl/v1/entities/{id}/risk" -ForegroundColor Cyan
Write-Host "  POST $apiUrl/v1/admin/thresholds" -ForegroundColor Cyan

Write-Host ""
Write-Host "✅ Deployment Test Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Go to AWS Lambda Console to test functions directly" -ForegroundColor White
Write-Host "   https://console.aws.amazon.com/lambda/home?region=us-east-1" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Upload test data to S3 to trigger the pipeline" -ForegroundColor White
Write-Host "   Bucket: aegis-raw-data-dev-968668792715" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Check CloudWatch Logs for Lambda execution" -ForegroundColor White
Write-Host "   https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups" -ForegroundColor Cyan
