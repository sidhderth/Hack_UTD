# Manually test the pipeline without SageMaker
# This will directly write test data to DynamoDB

Write-Host "Manual Pipeline Test (Without SageMaker)" -ForegroundColor Cyan
Write-Host ""

Write-Host "Since SageMaker requires quota approval, let's manually insert test data" -ForegroundColor Yellow
Write-Host ""

Write-Host "Option 1: Insert Test Data Directly to DynamoDB" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run this AWS CLI command:" -ForegroundColor White
Write-Host ""

$testData = @'
aws dynamodb put-item --table-name aegis-risk-profiles-dev --item '{
  "entityId": {"S": "person:viktor_bout_1967_01_13"},
  "asOfTs": {"N": "1699459200"},
  "name": {"S": "Viktor Anatolyevich Bout"},
  "score": {"N": "0.98"},
  "status": {"S": "REVIEW_REQUIRED"},
  "evidence": {"L": [
    {"M": {
      "source": {"S": "OFAC SDN List"},
      "confidence": {"N": "1.0"},
      "severity": {"S": "critical"}
    }}
  ]},
  "processedAt": {"S": "2025-11-09T05:00:00Z"}
}'
'@

Write-Host $testData -ForegroundColor Gray
Write-Host ""

Write-Host "Option 2: Test Lambda Function Directly" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to Lambda Console:" -ForegroundColor White
Write-Host "   https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions/aegis-screen-entity-dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Click 'Test' tab" -ForegroundColor White
Write-Host ""
Write-Host "3. Create test event with:" -ForegroundColor White
Write-Host @'
{
  "body": "{\"entityType\":\"PERSON\",\"name\":\"Viktor Bout\",\"dateOfBirth\":\"1967-01-13\"}"
}
'@ -ForegroundColor Gray
Write-Host ""
Write-Host "4. Click 'Test' button" -ForegroundColor White
Write-Host ""

Write-Host "Option 3: Request SageMaker Quota Increase" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to Service Quotas:" -ForegroundColor White
Write-Host "   https://console.aws.amazon.com/servicequotas/home/services/sagemaker/quotas" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Search for: 'ml.m5.large for endpoint usage'" -ForegroundColor White
Write-Host "3. Click 'Request quota increase'" -ForegroundColor White
Write-Host "4. Request: 1 instance" -ForegroundColor White
Write-Host "5. Wait 1-2 business days for approval" -ForegroundColor White
Write-Host ""

Write-Host "Recommended: Use Option 1 to insert test data now!" -ForegroundColor Green
