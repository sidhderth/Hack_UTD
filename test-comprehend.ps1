# Test AWS Comprehend Access

Write-Host ""
Write-Host "Testing AWS Comprehend..." -ForegroundColor Cyan
Write-Host ""

# Check credentials
Write-Host "Checking AWS credentials..." -ForegroundColor Yellow
aws sts get-caller-identity

Write-Host ""
Write-Host "Testing Comprehend API..." -ForegroundColor Yellow
Write-Host ""

# Test Comprehend
aws comprehend detect-entities `
    --text "Amazon Web Services provides cloud computing." `
    --language-code en `
    --region us-east-1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS! Comprehend is working!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Comprehend needs activation:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://console.aws.amazon.com/comprehend" -ForegroundColor White
    Write-Host "2. Click 'Get Started'" -ForegroundColor White
    Write-Host "3. Accept terms" -ForegroundColor White
    Write-Host ""
    Write-Host "Opening console..." -ForegroundColor Yellow
    Start-Process "https://console.aws.amazon.com/comprehend/home?region=us-east-1"
}

Write-Host ""
