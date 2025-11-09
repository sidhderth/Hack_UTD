# Infrastructure as Code

## Technology: AWS CDK (TypeScript)

### Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 18+ and npm
- CDK CLI: `npm install -g aws-cdk`
- MFA enabled for admin operations

### Account Setup

```bash
# Bootstrap CDK in each account/region
cdk bootstrap aws://ACCOUNT-ID/us-east-1 --profile dev
cdk bootstrap aws://ACCOUNT-ID/us-east-1 --profile staging
cdk bootstrap aws://ACCOUNT-ID/us-east-1 --profile prod
```

### Deployment

```bash
cd infrastructure
npm install

# Deploy to dev
cdk deploy --all --profile dev --context env=dev

# Deploy to staging (requires approval)
cdk deploy --all --profile staging --context env=staging --require-approval always

# Deploy to prod (manual approval + change sets)
cdk deploy --all --profile prod --context env=prod --require-approval always
```

### Stack Organization

1. **NetworkStack**: VPC, subnets, VPC endpoints, NAT Gateway
2. **SecurityStack**: KMS keys, IAM roles, Cognito, WAF
3. **DataStack**: DynamoDB tables, S3 buckets with encryption
4. **ComputeStack**: Lambda functions, Fargate cluster, SageMaker
5. **ApiStack**: API Gateway, request validators, usage plans
6. **MonitoringStack**: CloudTrail, CloudWatch, GuardDuty, Macie

### Security Validations

- IAM policy least-privilege checks via `cdk diff`
- Automated security scanning in CI/CD
- No hardcoded secrets (Secrets Manager only)
