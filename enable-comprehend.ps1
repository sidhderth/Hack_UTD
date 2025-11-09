# Enable AWS Comprehend Service
# This script helps activate Comprehend in your AWS account

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   AWS Comprehend Activation" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Checking AWS credentials..." -ForegroundColor Yellow
try {
    $identity = aws sts get-caller-identity | ConvertFrom-Json
    Write-Host "  ✓ Logged in as: $($identity.Arn)" -ForegroundColor Green
    Write-Host "  ✓ Account: $($identity.Account)" -ForegroundColor Green
} catch {
    Write-Host "  ✗ AWS credentials not configured" -ForegroundColor Red
    Write-Host "  Run: aws configure" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Step 2: Testing Comprehend access..." -ForegroundColor Yellow

# Try a simple Comprehend API call
$testText = "Amazon Web Services provides cloud computing services."

try {
    Write-Host "  → Calling Comprehend DetectEntities..." -ForegroundColor White
    
    $result = aws comprehend detect-entities `
        --text "$testText" `
        --language-code en `
        --region us-east-1 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Comprehend is working!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Sample result:" -ForegroundColor Cyan
        $result | ConvertFrom-Json | ConvertTo-Json -Depth 5
    } else {
        $errorMsg = $result | Out-String
        
        if ($errorMsg -match "SubscriptionRequiredException") {
            Write-Host "  ⚠ Comprehend needs to be enabled" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "To enable AWS Comprehend:" -ForegroundColor Cyan
            Write-Host "1. Go to: https://console.aws.amazon.com/comprehend/home?region=us-east-1" -ForegroundColor White
            Write-Host "2. Click 'Get Started' or 'Enable Service'" -ForegroundColor White
            Write-Host "3. Accept the terms of service" -ForegroundColor White
            Write-Host "4. Wait 1-2 minutes for activation" -ForegroundColor White
            Write-Host "5. Run this script again" -ForegroundColor White
            Write-Host ""
            Write-Host "Opening Comprehend console..." -ForegroundColor Yellow
            Start-Process "https://console.aws.amazon.com/comprehend/home?region=us-east-1"
        }
        elseif ($errorMsg -match "AccessDeniedException") {
            Write-Host "  ✗ IAM permissions missing" -ForegroundColor Red
            Write-Host ""
            Write-Host "Add this policy to your IAM user/role:" -ForegroundColor Yellow
            Write-Host "  comprehend:DetectEntities" -ForegroundColor White
            Write-Host "  comprehend:DetectSentiment" -ForegroundColor White
            Write-Host "  comprehend:DetectKeyPhrases" -ForegroundColor White
        }
        else {
            Write-Host "  ✗ Error: $errorMsg" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   Cost Information" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "AWS Comprehend Pricing:" -ForegroundColor White
Write-Host "  - Entity Detection: 0.0001 USD per unit (100 characters)" -ForegroundColor White
Write-Host "  - Sentiment Analysis: 0.0001 USD per unit" -ForegroundColor White
Write-Host "  - Key Phrase Extraction: 0.0001 USD per unit" -ForegroundColor White
Write-Host ""
Write-Host "Free Tier (First 12 months):" -ForegroundColor Green
Write-Host "  - 50,000 units per month FREE" -ForegroundColor Green
Write-Host "  - That's ~5 million characters/month" -ForegroundColor Green
Write-Host ""
Write-Host "Your Credits: 140.00 USD" -ForegroundColor Cyan
Write-Host "Days Remaining: 182 days" -ForegroundColor Cyan
Write-Host ""
Write-Host "Example costs:" -ForegroundColor White
Write-Host "  - 1,000 entities: ~0.10 USD" -ForegroundColor White
Write-Host "  - 10,000 entities: ~1.00 USD" -ForegroundColor White
Write-Host "  - 100,000 entities: ~10.00 USD" -ForegroundColor White
Write-Host ""
