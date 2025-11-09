# Test Lambda functions directly
# This tests individual Lambda functions without going through API Gateway

Write-Host "🧪 Testing Lambda Functions..." -ForegroundColor Cyan
Write-Host ""

# Test payloads from your test files
$scraperPayload = @{
    sources = @(
        @{
            name = "test"
            url = "https://example.com"
            type = "generic"
        }
    )
    scrapeMode = "incremental"
    lookbackDays = 7
} | ConvertTo-Json -Depth 10

$screenEntityPayload = @{
    body = (@{
        entityType = "PERSON"
        name = "Viktor Bout"
        dateOfBirth = "1967-01-13"
        nationality = "Russian"
    } | ConvertTo-Json)
} | ConvertTo-Json -Depth 10

Write-Host "Test 1: Scraper Lambda" -ForegroundColor Yellow
Write-Host "Function: aegis-scraper-dev" -ForegroundColor White
Write-Host "Payload: Test scraping from example.com" -ForegroundColor White
Write-Host ""
Write-Host "To test in AWS Console:" -ForegroundColor Cyan
Write-Host "1. Go to: https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions/aegis-scraper-dev" -ForegroundColor White
Write-Host "2. Click 'Test' tab" -ForegroundColor White
Write-Host "3. Create new test event with this JSON:" -ForegroundColor White
Write-Host $scraperPayload -ForegroundColor Gray
Write-Host ""

Write-Host "Test 2: Screen Entity Lambda" -ForegroundColor Yellow
Write-Host "Function: aegis-screen-entity-dev" -ForegroundColor White
Write-Host "Payload: Screen Viktor Bout (high-risk entity)" -ForegroundColor White
Write-Host ""
Write-Host "To test in AWS Console:" -ForegroundColor Cyan
Write-Host "1. Go to: https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions/aegis-screen-entity-dev" -ForegroundColor White
Write-Host "2. Click 'Test' tab" -ForegroundColor White
Write-Host "3. Create new test event with this JSON:" -ForegroundColor White
Write-Host $screenEntityPayload -ForegroundColor Gray
Write-Host ""

Write-Host "Test 3: Check CloudWatch Logs" -ForegroundColor Yellow
Write-Host "After running tests, check logs here:" -ForegroundColor White
Write-Host "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups" -ForegroundColor Cyan
Write-Host ""

Write-Host "Test 4: Check DynamoDB Data" -ForegroundColor Yellow
Write-Host "After pipeline runs, check data here:" -ForegroundColor White
Write-Host "https://console.aws.amazon.com/dynamodbv2/home?region=us-east-1#item-explorer?table=aegis-risk-profiles-dev" -ForegroundColor Cyan
Write-Host ""

# Try to invoke with AWS CLI if available
Write-Host "Attempting to invoke Lambda with AWS CLI..." -ForegroundColor Yellow
try {
    $scraperPayload | Out-File -FilePath "temp-payload.json" -Encoding UTF8
    
    aws lambda invoke `
        --function-name aegis-scraper-dev `
        --payload file://temp-payload.json `
        --cli-binary-format raw-in-base64-out `
        response.json 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Lambda invoked successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Response:" -ForegroundColor Yellow
        Get-Content response.json | Write-Host -ForegroundColor Gray
        
        Remove-Item temp-payload.json -ErrorAction SilentlyContinue
        Remove-Item response.json -ErrorAction SilentlyContinue
    } else {
        throw "Lambda invocation failed"
    }
} catch {
    Write-Host "⚠️  AWS CLI not available - use AWS Console instead" -ForegroundColor Yellow
}
