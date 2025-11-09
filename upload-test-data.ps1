# Upload test data to S3 to trigger the pipeline
# This tests the full end-to-end flow

Write-Host "🚀 Uploading test data to S3..." -ForegroundColor Cyan

# Your S3 bucket name (from the deployment)
$bucketName = "aegis-raw-data-dev-968668792715"
$testFile = "tests/fixtures/sample-scraped-data.json"
$s3Key = "raw/2025-11-08/test-data-$(Get-Date -Format 'HHmmss').json"

# Check if test file exists
if (-not (Test-Path $testFile)) {
    Write-Host "❌ Test file not found: $testFile" -ForegroundColor Red
    Write-Host "Make sure you're in the project root directory" -ForegroundColor Yellow
    exit 1
}

Write-Host "📁 Test file: $testFile" -ForegroundColor White
Write-Host "🪣 S3 Bucket: $bucketName" -ForegroundColor White
Write-Host "🔑 S3 Key: $s3Key" -ForegroundColor White
Write-Host ""

# Upload using AWS CLI (if available)
try {
    Write-Host "Uploading..." -ForegroundColor Yellow
    
    # Try AWS CLI
    $output = aws s3 cp $testFile "s3://$bucketName/$s3Key" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Upload successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "What happens next:" -ForegroundColor Yellow
        Write-Host "1. S3 PutObject event triggers EventBridge" -ForegroundColor White
        Write-Host "2. EventBridge triggers Step Functions NLP pipeline" -ForegroundColor White
        Write-Host "3. Pipeline runs: NER → Entity Resolution → Risk Scoring" -ForegroundColor White
        Write-Host "4. Results written to DynamoDB" -ForegroundColor White
        Write-Host ""
        Write-Host "Check progress:" -ForegroundColor Yellow
        Write-Host "• CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups" -ForegroundColor Cyan
        Write-Host "• DynamoDB Table: https://console.aws.amazon.com/dynamodbv2/home?region=us-east-1#item-explorer?table=aegis-risk-profiles-dev" -ForegroundColor Cyan
    } else {
        throw "AWS CLI upload failed"
    }
} catch {
    Write-Host "⚠️  AWS CLI not available or failed" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Manual upload instructions:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://console.aws.amazon.com/s3/buckets/aegis-raw-data-dev-968668792715?region=us-east-1" -ForegroundColor Cyan
    Write-Host "2. Click 'Upload'" -ForegroundColor White
    Write-Host "3. Upload file: $testFile" -ForegroundColor White
    Write-Host "4. Upload to folder: raw/2025-11-08/" -ForegroundColor White
}
