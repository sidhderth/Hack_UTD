# Manual Upload to Trigger Pipeline

## Step-by-Step Instructions

### 1. Go to S3 Console
```
https://console.aws.amazon.com/s3/buckets/aegis-raw-data-dev-968668792715?region=us-east-1&prefix=raw/
```

### 2. Create Folder Structure
- Click "Create folder"
- Name: `raw` (if it doesn't exist)
- Inside `raw`, create: `2025-11-09`

### 3. Upload Test File
- Navigate to: `raw/2025-11-09/`
- Click "Upload" button
- Click "Add files"
- Select: `tests/fixtures/sample-scraped-data.json`
- Click "Upload"

### 4. Wait 30 Seconds
The pipeline will automatically trigger!

### 5. Check Results in DynamoDB
```
https://console.aws.amazon.com/dynamodbv2/home?region=us-east-1#item-explorer?table=aegis-risk-profiles-dev
```
- Click "Scan"
- You should see 5 entities with risk scores!

### 6. Check CloudWatch Logs
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups
```
Look for:
- `/aws/lambda/aegis-ner-dev`
- `/aws/lambda/aegis-entity-resolution-dev`
- `/aws/lambda/aegis-risk-scoring-dev`

## Expected Results

After upload, you should see in DynamoDB:

| Entity | Risk Score | Status |
|--------|-----------|--------|
| Viktor Bout | 0.98 (98%) | REVIEW_REQUIRED |
| Acme Trading Corp | 0.85 (85%) | REVIEW_REQUIRED |
| John Smith | 0.62 (62%) | REVIEW_REQUIRED |
| Maria Garcia | 0.45 (45%) | REVIEW_REQUIRED |
| Jane Doe | 0.55 (55%) | REVIEW_REQUIRED |

## Troubleshooting

### If no data appears in DynamoDB after 2 minutes:

1. Check Step Functions execution:
   ```
   https://console.aws.amazon.com/states/home?region=us-east-1#/statemachines
   ```
   - Click on: `aegis-nlp-pipeline-dev`
   - Check recent executions

2. Check CloudWatch Logs for errors

3. Verify S3 event notification is configured
