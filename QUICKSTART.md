# 🚀 AEGIS Quick Start Guide

## Step-by-Step Deployment to AWS (Free Tier)

### Prerequisites Check

Before starting, verify you have:
- [ ] AWS Account (free tier eligible)
- [ ] Credit card (required for AWS, but won't be charged if staying in free tier)
- [ ] Node.js 18+ installed
- [ ] Git installed

---

## 📋 Step 1: Install Required Tools

### 1.1 Check Node.js Version
```bash
node --version
```

**Expected Output:**
```
v18.17.0  # or higher
```

If not installed, download from: https://nodejs.org/

### 1.2 Install AWS CLI
```bash
# Windows (PowerShell as Administrator)
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi

# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

**Verify Installation:**
```bash
aws --version
```

**Expected Output:**
```
aws-cli/2.13.0 Python/3.11.4 Windows/10 exe/AMD64 prompt/off
```

### 1.3 Install AWS CDK
```bash
npm install -g aws-cdk
```

**Verify Installation:**
```bash
cdk --version
```

**Expected Output:**
```
2.100.0 (build 1234567)
```

---

## 🔑 Step 2: Configure AWS Credentials

### 2.1 Create AWS Account
1. Go to https://aws.amazon.com/
2. Click "Create an AWS Account"
3. Follow the signup process
4. **Important**: Choose "Free Tier" when prompted

### 2.2 Create IAM User
1. Log into AWS Console: https://console.aws.amazon.com/
2. Search for "IAM" in the top search bar
3. Click "Users" → "Create user"
4. Username: `aegis-deployer`
5. Check "Provide user access to AWS Management Console" (optional)
6. Click "Next"
7. Select "Attach policies directly"
8. Search and select: `AdministratorAccess` (for initial setup)
9. Click "Next" → "Create user"

### 2.3 Create Access Keys
1. Click on the user you just created
2. Go to "Security credentials" tab
3. Scroll to "Access keys"
4. Click "Create access key"
5. Select "Command Line Interface (CLI)"
6. Check the confirmation box
7. Click "Next" → "Create access key"
8. **IMPORTANT**: Copy both:
   - Access key ID
   - Secret access key

### 2.4 Configure AWS CLI
```bash
aws configure
```

**Prompts and Responses:**
```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: us-east-1
Default output format [None]: json
```

**Verify Configuration:**
```bash
aws sts get-caller-identity
```

**Expected Output:**
```json
{
    "UserId": "AIDACKCEVSQ6C2EXAMPLE",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/aegis-deployer"
}
```

✅ **Success!** AWS credentials are configured.

---

## 📦 Step 3: Prepare the Project

### 3.1 Navigate to Project Directory
```bash
cd aegis-backend
```

### 3.2 Install Infrastructure Dependencies
```bash
cd infrastructure
npm install
```

**Expected Output:**
```
added 245 packages, and audited 246 packages in 15s

42 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

### 3.3 Build TypeScript Lambda Functions
```bash
# Build scraper Lambda
cd ../services/ingestion/scraper-lambda
npm install
npm run build
```

**Expected Output:**
```
added 3 packages, and audited 4 packages in 2s

> aegis-scraper-lambda@1.0.0 build
> tsc

✓ TypeScript compilation successful
```

```bash
# Build simple NER Lambda
cd ../../nlp/simple-ner
npm install
npm run build
```

**Expected Output:**
```
added 2 packages, and audited 3 packages in 1s

> aegis-simple-ner@1.0.0 build
> tsc

✓ TypeScript compilation successful
```

---

## 🏗️ Step 4: Bootstrap CDK (One-Time Setup)

### 4.1 Bootstrap CDK in Your AWS Account
```bash
cd ../../../infrastructure
cdk bootstrap
```

**Expected Output:**
```
 ⏳  Bootstrapping environment aws://123456789012/us-east-1...
Trusted accounts for deployment: (none)
Trusted accounts for lookup: (none)
Using default execution policy of 'arn:aws:iam::aws:policy/AdministratorAccess'. Pass '--cloudformation-execution-policies' to customize.
CDKToolkit: creating CloudFormation changeset...
 ✅  Environment aws://123456789012/us-east-1 bootstrapped.
```

✅ **Success!** CDK is bootstrapped and ready to deploy.

---

## 🚀 Step 5: Deploy to AWS

### 5.1 Preview What Will Be Deployed
```bash
cdk synth
```

**Expected Output:**
```
Successfully synthesized to /path/to/aegis-backend/infrastructure/cdk.out
Supply a stack id (Aegis-Network-dev, Aegis-Security-dev, Aegis-Data-dev, Aegis-Compute-dev, Aegis-Api-dev, Aegis-Monitoring-dev) to display its template.
```

### 5.2 Check What Will Change
```bash
cdk diff
```

**Expected Output:**
```
Stack Aegis-Data-dev
IAM Statement Changes
┌───┬─────────────────┬────────┬─────────────────┬───────────────────┬───────────┐
│   │ Resource        │ Effect │ Action          │ Principal         │ Condition │
├───┼─────────────────┼────────┼─────────────────┼───────────────────┼───────────┤
│ + │ ${RiskProfiles} │ Allow  │ dynamodb:*      │ Service:lambda... │           │
└───┴─────────────────┴────────┴─────────────────┴───────────────────┴───────────┘
(NOTE: There may be security-related changes not in this list. See https://github.com/aws/aws-cdk/issues/1299)

Resources
[+] AWS::DynamoDB::Table RiskProfiles RiskProfiles12345678
[+] AWS::S3::Bucket RawDataBucket RawDataBucket12345678
[+] AWS::S3::Bucket ProcessedBucket ProcessedBucket12345678
```

### 5.3 Deploy All Stacks
```bash
cdk deploy --all --require-approval never
```

**Expected Output (This will take 5-10 minutes):**

```
✨  Synthesis time: 5.23s

Aegis-Data-dev: deploying...
[0%] start: Publishing 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:current_account-current_region
[100%] success: Published 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:current_account-current_region

Aegis-Data-dev: creating CloudFormation changeset...

 ✅  Aegis-Data-dev

✨  Deployment time: 45.67s

Outputs:
Aegis-Data-dev.RiskTableName = aegis-risk-profiles-dev
Aegis-Data-dev.RawBucketName = aegis-raw-data-dev-123456789012
Aegis-Data-dev.ProcessedBucketName = aegis-processed-dev-123456789012

Stack ARN:
arn:aws:cloudformation:us-east-1:123456789012:stack/Aegis-Data-dev/12345678-1234-1234-1234-123456789012

✨  Total time: 50.90s


Aegis-Compute-dev: deploying...
[0%] start: Publishing abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890:current_account-current_region
[100%] success: Published abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890:current_account-current_region

Aegis-Compute-dev: creating CloudFormation changeset...

 ✅  Aegis-Compute-dev

✨  Deployment time: 62.34s

Outputs:
Aegis-Compute-dev.ScreenEntityFunctionArn = arn:aws:lambda:us-east-1:123456789012:function:aegis-screen-entity-dev
Aegis-Compute-dev.ScraperFunctionArn = arn:aws:lambda:us-east-1:123456789012:function:aegis-scraper-dev

Stack ARN:
arn:aws:cloudformation:us-east-1:123456789012:stack/Aegis-Compute-dev/23456789-2345-2345-2345-234567890123

✨  Total time: 67.57s


Aegis-Api-dev: deploying...
[0%] start: Publishing fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321:current_account-current_region
[100%] success: Published fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321:current_account-current_region

Aegis-Api-dev: creating CloudFormation changeset...

 ✅  Aegis-Api-dev

✨  Deployment time: 78.12s

Outputs:
Aegis-Api-dev.ApiUrl = https://abc123def4.execute-api.us-east-1.amazonaws.com/dev/
Aegis-Api-dev.ApiId = abc123def4

Stack ARN:
arn:aws:cloudformation:us-east-1:123456789012:stack/Aegis-Api-dev/34567890-3456-3456-3456-345678901234

✨  Total time: 83.35s

✨  Total time: 201.82s (3 minutes 22 seconds)
```

✅ **Success!** All stacks deployed successfully!

---

## 🧪 Step 6: Test the Deployment

### 6.1 Get API URL
```bash
aws cloudformation describe-stacks \
  --stack-name Aegis-Api-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

**Expected Output:**
```
https://abc123def4.execute-api.us-east-1.amazonaws.com/dev/
```

### 6.2 Test Scraper Lambda
```bash
aws lambda invoke \
  --function-name aegis-scraper-dev \
  --payload '{"sources":[{"name":"test","url":"https://example.com","type":"generic"}]}' \
  --cli-binary-format raw-in-base64-out \
  response.json
```

**Expected Output:**
```json
{
    "StatusCode": 200,
    "ExecutedVersion": "$LATEST"
}
```

**Check Response:**
```bash
cat response.json
```

**Expected Output:**
```json
{
  "statusCode": 200,
  "body": "{\"message\":\"Scraping completed\",\"results\":[{\"source\":\"test\",\"status\":\"success\",\"recordCount\":1,\"s3Key\":\"raw/2025-11-08/test_1699459200000.json\"}]}"
}
```

### 6.3 Check S3 Bucket
```bash
aws s3 ls s3://aegis-raw-data-dev-123456789012/raw/ --recursive
```

**Expected Output:**
```
2025-11-08 12:00:00       1234 raw/2025-11-08/test_1699459200000.json
```

### 6.4 Upload Test Data
```bash
aws s3 cp tests/fixtures/sample-scraped-data.json \
  s3://aegis-raw-data-dev-123456789012/raw/2025-11-08/test-data.json
```

**Expected Output:**
```
upload: tests/fixtures/sample-scraped-data.json to s3://aegis-raw-data-dev-123456789012/raw/2025-11-08/test-data.json
```

### 6.5 Check DynamoDB Table
```bash
aws dynamodb scan \
  --table-name aegis-risk-profiles-dev \
  --limit 5
```

**Expected Output:**
```json
{
    "Items": [],
    "Count": 0,
    "ScannedCount": 0,
    "ConsumedCapacity": null
}
```

(Empty initially - will populate after NLP pipeline runs)

---

## 📊 Step 7: Monitor Your Deployment

### 7.1 View CloudWatch Logs
```bash
# Get latest log stream for scraper
aws logs tail /aws/lambda/aegis-scraper-dev --follow
```

**Expected Output:**
```
2025-11-08T12:00:00.000Z START RequestId: 12345678-1234-1234-1234-123456789012 Version: $LATEST
2025-11-08T12:00:00.123Z INFO Scraper Lambda triggered: {"sources":[...]}
2025-11-08T12:00:01.456Z INFO Scraping test...
2025-11-08T12:00:02.789Z INFO ✓ Uploaded to s3://aegis-raw-data-dev-123456789012/raw/2025-11-08/test_1699459200000.json
2025-11-08T12:00:02.890Z END RequestId: 12345678-1234-1234-1234-123456789012
2025-11-08T12:00:02.891Z REPORT RequestId: 12345678-1234-1234-1234-123456789012
Duration: 2890.12 ms
Billed Duration: 2891 ms
Memory Size: 512 MB
Max Memory Used: 128 MB
```

### 7.2 Check AWS Console

1. **Lambda Functions**: https://console.aws.amazon.com/lambda/
   - You should see: `aegis-scraper-dev`, `aegis-screen-entity-dev`, etc.

2. **DynamoDB Tables**: https://console.aws.amazon.com/dynamodb/
   - You should see: `aegis-risk-profiles-dev`

3. **S3 Buckets**: https://console.aws.amazon.com/s3/
   - You should see: `aegis-raw-data-dev-123456789012`, `aegis-processed-dev-123456789012`

4. **API Gateway**: https://console.aws.amazon.com/apigateway/
   - You should see: `aegis-api-dev`

---

## 💰 Step 8: Check Your Costs

### 8.1 View Cost Explorer
```bash
# Get current month costs
aws ce get-cost-and-usage \
  --time-period Start=2025-11-01,End=2025-11-30 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

**Expected Output:**
```json
{
    "ResultsByTime": [
        {
            "TimePeriod": {
                "Start": "2025-11-01",
                "End": "2025-11-30"
            },
            "Total": {
                "BlendedCost": {
                    "Amount": "0.00",
                    "Unit": "USD"
                }
            }
        }
    ]
}
```

### 8.2 Set Up Billing Alert
```bash
# Create SNS topic for billing alerts
aws sns create-topic --name billing-alerts

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:billing-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

**Expected Output:**
```json
{
    "SubscriptionArn": "pending confirmation"
}
```

Check your email and confirm the subscription.

---

## 🧹 Step 9: Clean Up (When Done Testing)

### 9.1 Delete All Stacks
```bash
cdk destroy --all
```

**Expected Output:**
```
Are you sure you want to delete: Aegis-Api-dev, Aegis-Compute-dev, Aegis-Data-dev (y/n)? y

Aegis-Api-dev: destroying...

 ✅  Aegis-Api-dev: destroyed

Aegis-Compute-dev: destroying...

 ✅  Aegis-Compute-dev: destroyed

Aegis-Data-dev: destroying...

 ✅  Aegis-Data-dev: destroyed
```

### 9.2 Verify Deletion
```bash
aws cloudformation list-stacks \
  --stack-status-filter DELETE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `Aegis`)].StackName'
```

**Expected Output:**
```json
[
    "Aegis-Api-dev",
    "Aegis-Compute-dev",
    "Aegis-Data-dev"
]
```

---

## 🎉 Success Checklist

- [x] AWS CLI installed and configured
- [x] CDK installed and bootstrapped
- [x] All stacks deployed successfully
- [x] Lambda functions working
- [x] S3 buckets created
- [x] DynamoDB table created
- [x] API Gateway endpoint accessible
- [x] Costs within free tier ($0)

---

## 🐛 Troubleshooting

### Issue: "Unable to locate credentials"
**Solution:**
```bash
aws configure
# Re-enter your access keys
```

### Issue: "Stack already exists"
**Solution:**
```bash
cdk destroy --all
# Wait for deletion to complete, then redeploy
```

### Issue: "Insufficient permissions"
**Solution:**
- Ensure your IAM user has `AdministratorAccess` policy
- Check in AWS Console → IAM → Users → your-user → Permissions

### Issue: "Rate exceeded"
**Solution:**
- Wait 1 minute and try again
- AWS has rate limits on API calls

### Issue: "Lambda timeout"
**Solution:**
- Check CloudWatch Logs for errors
- Increase timeout in `compute-stack.ts` if needed

---

## 📚 Next Steps

1. **Test the API**: See `tests/README.md`
2. **Add More Sources**: Edit `config/sources.example.json`
3. **Customize Risk Scoring**: Edit `services/nlp/risk-scoring/index.py`
4. **Set Up CI/CD**: See `docs/DEPLOYMENT.md`
5. **Monitor Costs**: Check AWS Cost Explorer daily

---

## 🆘 Need Help?

- **AWS Documentation**: https://docs.aws.amazon.com/
- **CDK Documentation**: https://docs.aws.amazon.com/cdk/
- **AWS Free Tier**: https://aws.amazon.com/free/
- **AWS Support**: https://console.aws.amazon.com/support/

---

## 💡 Pro Tips

1. **Always check costs**: Run `aws ce get-cost-and-usage` daily
2. **Use tags**: Tag all resources with `Project: AEGIS` for cost tracking
3. **Enable MFA**: Secure your AWS account with multi-factor authentication
4. **Backup important data**: Export DynamoDB tables regularly
5. **Monitor logs**: Set up CloudWatch alarms for errors

**Congratulations! 🎉 You've successfully deployed AEGIS to AWS!**
