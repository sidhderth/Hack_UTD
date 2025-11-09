# View Risk Probabilities from API

Write-Host "Viewing Risk Probabilities..." -ForegroundColor Cyan
Write-Host ""

$apiUrl = "https://0khhmki0e0.execute-api.us-east-1.amazonaws.com/dev"

# Test entities
$testEntities = @(
    @{ name = "Viktor Bout"; dob = "1967-01-13"; type = "PERSON" },
    @{ name = "John Smith"; dob = "1980-05-15"; type = "PERSON" },
    @{ name = "Maria Garcia"; dob = "1975-08-22"; type = "PERSON" }
)

Write-Host "Testing API (will show 401 - need authentication):" -ForegroundColor Yellow
Write-Host ""

foreach ($entity in $testEntities) {
    Write-Host "Entity: $($entity.name)" -ForegroundColor Cyan
    
    $body = @{
        entityType = $entity.type
        name = $entity.name
        dateOfBirth = $entity.dob
    } | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest -Uri "$apiUrl/v1/screen_entity" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -UseBasicParsing `
            -ErrorAction Stop
        
        $result = $response.Content | ConvertFrom-Json
        
        Write-Host "  Risk Score: $($result.riskScore)" -ForegroundColor $(
            if ($result.riskScore -ge 0.7) { "Red" }
            elseif ($result.riskScore -ge 0.3) { "Yellow" }
            else { "Green" }
        )
        Write-Host "  Status: $($result.status)" -ForegroundColor White
        Write-Host "  Evidence: $($result.evidence.Count) items" -ForegroundColor White
        
    } catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-Host "  Status: 401 Unauthorized (need Cognito token)" -ForegroundColor Yellow
        } else {
            Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
}

Write-Host "To see actual probabilities:" -ForegroundColor Yellow
Write-Host "1. Check DynamoDB table directly (no auth needed)" -ForegroundColor White
Write-Host "   https://console.aws.amazon.com/dynamodbv2/home?region=us-east-1#item-explorer?table=aegis-risk-profiles-dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Create Cognito user and get JWT token" -ForegroundColor White
Write-Host "   Then use token in Authorization header" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test Lambda function directly (see below)" -ForegroundColor White
Write-Host ""
