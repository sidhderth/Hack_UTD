# Deployment Guide

## Prerequisites

1. **AWS Accounts**: Separate accounts for dev/staging/prod
2. **AWS CLI**: Configured with appropriate profiles
3. **Node.js**: Version 18+ for CDK
4. **Docker**: For building Fargate images
5. **MFA**: Enabled for admin operations

## Initial Setup

### 1. Bootstrap CDK

```bash
# Dev account
cdk bootstrap aws://123456789012/us-east-1 --profile dev

# Staging account
cdk bootstrap aws://234567890123/us-east-1 --profile staging

# Prod account
cdk bootstrap aws://345678901234/us-east-1 --profile prod
```

### 2. Install Dependencies

```bash
cd infrastructure
npm install
```

### 3. Configure Environment Variables

Create `.env` files for each environment:

```bash
# .env.dev
AWS_PROFILE=dev
AWS_REGION=us-east-1
ENVIRONMENT=dev

# .env.staging
AWS_PROFILE=staging
AWS_REGION=us-east-1
ENVIRONMENT=staging

# .env.prod
AWS_PROFILE=prod
AWS_REGION=us-east-1
ENVIRONMENT=prod
```

## Deployment Process

### Development Environment

```bash
cd infrastructure

# Validate IaC
npm run validate

# Preview changes
cdk diff --all --profile dev --context env=dev

# Deploy all stacks
cdk deploy --all --profile dev --context env=dev
```

### Staging Environment

```bash
# Requires manual approval for each stack
cdk deploy --all --profile staging --context env=staging --require-approval always
```

### Production Environment

```bash
# Production deployment with change sets
cdk deploy --all --profile prod --context env=prod --require-approval always

# Review change sets in AWS Console before approving
```

## Post-Deployment Configuration

### 1. Create Cognito Users

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com \
  --temporary-password TempPass123! \
  --profile prod
```

### 2. Configure Macie

```bash
# Enable Macie classification job for raw bucket
aws macie2 create-classification-job \
  --job-type SCHEDULED \
  --s3-job-definition '{
    "bucketDefinitions": [{
      "accountId": "ACCOUNT_ID",
      "buckets": ["aegis-raw-data-prod-ACCOUNT_ID"]
    }]
  }' \
  --schedule-frequency '{
    "dailySchedule": {}
  }' \
  --name "aegis-pii-scan-prod" \
  --profile prod
```

### 3. Subscribe to Security Alerts

```bash
# Get SNS topic ARN from stack outputs
aws sns subscribe \
  --topic-arn <ALERT_TOPIC_ARN> \
  --protocol email \
  --notification-endpoint security@example.com \
  --profile prod
```

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy AEGIS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd infrastructure
          npm ci
      
      - name: Run security scans
        run: |
          npm audit
          # Add SAST/DAST tools here
      
      - name: CDK Synth
        run: |
          cd infrastructure
          npm run synth
      
      - name: Deploy to Staging
        if: github.ref == 'refs/heads/main'
        run: |
          cd infrastructure
          cdk deploy --all --context env=staging --require-approval never
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID_STAGING }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY_STAGING }}
      
      - name: Integration Tests
        run: |
          # Run API tests against staging
          npm run test:integration
      
      - name: Deploy to Prod (Manual Approval)
        if: github.event_name == 'workflow_dispatch'
        run: |
          cd infrastructure
          cdk deploy --all --context env=prod --require-approval never
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID_PROD }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY_PROD }}
```

## Rollback Procedure

### Lambda Functions

```bash
# Revert to previous version
aws lambda update-alias \
  --function-name aegis-screen-entity-prod \
  --name live \
  --function-version <PREVIOUS_VERSION> \
  --profile prod
```

### Infrastructure Changes

```bash
# Rollback via CDK
git revert <COMMIT_HASH>
cdk deploy --all --profile prod --context env=prod
```

## Monitoring Deployment Health

### Check Stack Status

```bash
aws cloudformation describe-stacks \
  --stack-name Aegis-Api-prod \
  --query 'Stacks[0].StackStatus' \
  --profile prod
```

### View Recent Alarms

```bash
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --profile prod
```

### Check API Health

```bash
curl -X POST https://<API_ID>.execute-api.us-east-1.amazonaws.com/prod/v1/screen_entity \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "PERSON",
    "name": "Test User"
  }'
```

## Troubleshooting

### Lambda in VPC Issues
- Verify VPC endpoints are created
- Check security group rules
- Ensure NAT Gateway is available for egress

### KMS Access Denied
- Verify key grants are properly configured
- Check IAM role has kms:Decrypt permission
- Ensure key policy allows service access

### API Gateway 403 Errors
- Verify Cognito token is valid
- Check WAF rules aren't blocking requests
- Validate request schema matches model
