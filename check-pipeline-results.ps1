# Check if the pipeline processed your uploaded data

Write-Host "🔍 Checking Pipeline Results..." -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Check S3 for uploaded file" -ForegroundColor Yellow
Write-Host "Go to: https://s3.console.aws.amazon.com/s3/buckets/aegis-raw-data-dev-968668792715?region=us-east-1&prefix=raw/2025-11-08/" -ForegroundColor Cyan
Write-Host "You should see: test-data-*.json" -ForegroundColor White
Write-Host ""

Write-Host "Step 2: Check CloudWatch Logs for Lambda execution" -ForegroundColor Yellow
Write-Host "NER Lambda logs:" -ForegroundColor White
Write-Host "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Faegis-ner-dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "Entity Resolution logs:" -ForegroundColor White
Write-Host "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Faegis-entity-resolution-dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "Risk Scoring logs:" -ForegroundColor White
Write-Host "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Faegis-risk-scoring-dev" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 3: Check Step Functions execution" -ForegroundColor Yellow
Write-Host "Go to: https://console.aws.amazon.com/states/home?region=us-east-1#/statemachines" -ForegroundColor Cyan
Write-Host "Look for: aegis-nlp-pipeline-dev" -ForegroundColor White
Write-Host "Check recent executions" -ForegroundColor White
Write-Host ""

Write-Host "Step 4: Check DynamoDB for results" -ForegroundColor Yellow
Write-Host "Go to: https://console.aws.amazon.com/dynamodbv2/home?region=us-east-1#item-explorer?table=aegis-risk-profiles-dev" -ForegroundColor Cyan
Write-Host "Click 'Scan' to see all items" -ForegroundColor White
Write-Host ""

Write-Host "Expected Results:" -ForegroundColor Yellow
Write-Host "• 5 entities from test data should be in DynamoDB" -ForegroundColor White
Write-Host "  - Viktor Bout (Critical Risk)" -ForegroundColor Red
Write-Host "  - Acme Trading Corp (High Risk)" -ForegroundColor Red
Write-Host "  - John Smith (Medium Risk)" -ForegroundColor Yellow
Write-Host "  - Maria Garcia (Medium Risk - PEP)" -ForegroundColor Yellow
Write-Host "  - Jane Doe (Medium Risk)" -ForegroundColor Yellow
Write-Host ""

Write-Host "If you don't see data:" -ForegroundColor Yellow
Write-Host "1. Check if Step Functions was triggered (might not be configured yet)" -ForegroundColor White
Write-Host "2. Check CloudWatch Logs for errors" -ForegroundColor White
Write-Host "3. The pipeline stack might not be fully deployed" -ForegroundColor White
