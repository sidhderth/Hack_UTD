# Testing Guide

## Test Strategy

### Unit Tests
- Lambda function logic
- Data validation
- Error handling

### Integration Tests
- API Gateway → Lambda → DynamoDB
- S3 events → Step Functions
- Macie → EventBridge → Redaction Lambda

### Security Tests
- IAM policy validation
- Encryption verification
- WAF rule effectiveness
- Penetration testing

## Running Tests

### Unit Tests

```bash
# Lambda functions
cd services/api/screen-entity
python -m pytest tests/

# Infrastructure
cd infrastructure
npm test
```

### Integration Tests

```bash
# Deploy to dev environment first
cd infrastructure
cdk deploy --all --profile dev --context env=dev

# Run integration tests
cd ../tests
python -m pytest integration/ --env=dev
```

### Security Validation

```bash
# IAM policy checks
cd infrastructure
npm run validate-iam

# Dependency scanning
npm audit
pip-audit

# Infrastructure scanning
checkov -d infrastructure/
```

## Test Cases

### API Endpoint Tests

#### POST /v1/screen_entity

```python
import requests

def test_screen_entity_success():
    response = requests.post(
        f"{API_URL}/v1/screen_entity",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={
            "entityType": "PERSON",
            "name": "John Doe"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "riskScore" in data
    assert "status" in data
    assert data["status"] in ["CLEAR", "REVIEW_REQUIRED"]

def test_screen_entity_invalid_type():
    response = requests.post(
        f"{API_URL}/v1/screen_entity",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={
            "entityType": "INVALID",
            "name": "John Doe"
        }
    )
    assert response.status_code == 400

def test_screen_entity_unauthorized():
    response = requests.post(
        f"{API_URL}/v1/screen_entity",
        json={"entityType": "PERSON", "name": "John Doe"}
    )
    assert response.status_code == 401

def test_screen_entity_rate_limit():
    for _ in range(2100):
        response = requests.post(
            f"{API_URL}/v1/screen_entity",
            headers={"Authorization": f"Bearer {TOKEN}"},
            json={"entityType": "PERSON", "name": "Test"}
        )
    assert response.status_code == 429
```

### Security Tests

#### Encryption Verification

```python
import boto3

def test_dynamodb_encryption():
    dynamodb = boto3.client('dynamodb')
    response = dynamodb.describe_table(TableName='aegis-risk-profiles-dev')
    assert response['Table']['SSEDescription']['Status'] == 'ENABLED'
    assert response['Table']['SSEDescription']['SSEType'] == 'KMS'

def test_s3_encryption():
    s3 = boto3.client('s3')
    response = s3.get_bucket_encryption(Bucket='aegis-raw-data-dev-123456789012')
    rules = response['ServerSideEncryptionConfiguration']['Rules']
    assert rules[0]['ApplyServerSideEncryptionByDefault']['SSEAlgorithm'] == 'aws:kms'

def test_s3_public_access_blocked():
    s3 = boto3.client('s3')
    response = s3.get_public_access_block(Bucket='aegis-raw-data-dev-123456789012')
    config = response['PublicAccessBlockConfiguration']
    assert config['BlockPublicAcls'] == True
    assert config['BlockPublicPolicy'] == True
    assert config['IgnorePublicAcls'] == True
    assert config['RestrictPublicBuckets'] == True
```

#### IAM Least Privilege

```python
def test_api_lambda_role_permissions():
    iam = boto3.client('iam')
    role_name = 'aegis-api-lambda-role-dev'
    
    # Get attached policies
    response = iam.list_attached_role_policies(RoleName=role_name)
    policies = response['AttachedPolicies']
    
    # Should only have VPC execution role
    assert len(policies) == 1
    assert 'AWSLambdaVPCAccessExecutionRole' in policies[0]['PolicyName']
    
    # Check inline policies
    response = iam.list_role_policies(RoleName=role_name)
    inline_policies = response['PolicyNames']
    
    for policy_name in inline_policies:
        policy = iam.get_role_policy(RoleName=role_name, PolicyName=policy_name)
        document = policy['PolicyDocument']
        
        # Verify no wildcard resources
        for statement in document['Statement']:
            if statement['Effect'] == 'Allow':
                assert '*' not in statement.get('Resource', [])

def test_scraper_role_write_only():
    iam = boto3.client('iam')
    role_name = 'aegis-scraper-task-role-dev'
    
    response = iam.list_role_policies(RoleName=role_name)
    for policy_name in response['PolicyNames']:
        policy = iam.get_role_policy(RoleName=role_name, PolicyName=policy_name)
        document = policy['PolicyDocument']
        
        for statement in document['Statement']:
            if statement['Effect'] == 'Allow':
                actions = statement.get('Action', [])
                # Should only have PutObject, not GetObject
                assert 's3:PutObject' in actions
                assert 's3:GetObject' not in actions
```

### PII Redaction Tests

```python
def test_pii_redaction():
    from services.privacy.redaction.index import redact_pii
    
    text = "Contact John at john@example.com or 555-123-4567. SSN: 123-45-6789"
    redacted, redactions = redact_pii(text)
    
    assert '[REDACTED_EMAIL]' in redacted
    assert '[REDACTED_PHONE]' in redacted
    assert '[REDACTED_SSN]' in redacted
    assert 'john@example.com' not in redacted
    assert '555-123-4567' not in redacted
    assert '123-45-6789' not in redacted
    assert len(redactions) == 3
```

## Performance Tests

### Load Testing

```bash
# Using Apache Bench
ab -n 10000 -c 100 -H "Authorization: Bearer $TOKEN" \
   -p payload.json -T application/json \
   https://api.example.com/prod/v1/screen_entity

# Using Locust
locust -f tests/load/locustfile.py --host=https://api.example.com
```

### Latency Benchmarks

| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| POST /v1/screen_entity | 150ms | 300ms | 500ms |
| GET /v1/entities/{id}/risk | 100ms | 200ms | 350ms |
| POST /v1/admin/thresholds | 120ms | 250ms | 400ms |

## Compliance Tests

### SOC 2 Controls

```python
def test_cloudtrail_enabled():
    cloudtrail = boto3.client('cloudtrail')
    response = cloudtrail.describe_trails()
    assert len(response['trailList']) > 0
    
    trail = response['trailList'][0]
    status = cloudtrail.get_trail_status(Name=trail['TrailARN'])
    assert status['IsLogging'] == True

def test_guardduty_enabled():
    guardduty = boto3.client('guardduty')
    response = guardduty.list_detectors()
    assert len(response['DetectorIds']) > 0

def test_macie_enabled():
    macie = boto3.client('macie2')
    response = macie.get_macie_session()
    assert response['status'] == 'ENABLED'
```

## Continuous Testing

### GitHub Actions Workflow

```yaml
name: Security Tests

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'  # Daily

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Dependency Audit
        run: |
          cd infrastructure
          npm audit --audit-level=high
      
      - name: SAST Scan
        run: |
          pip install bandit
          bandit -r services/ -f json -o bandit-report.json
      
      - name: Infrastructure Scan
        run: |
          pip install checkov
          checkov -d infrastructure/ --framework cloudformation
      
      - name: Upload Results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: bandit-report.json
```

## Manual Testing Checklist

### Pre-Deployment
- [ ] All unit tests pass
- [ ] Integration tests pass in staging
- [ ] Security scans show no critical issues
- [ ] IAM policies reviewed
- [ ] Secrets rotated

### Post-Deployment
- [ ] API endpoints respond correctly
- [ ] CloudWatch logs flowing
- [ ] CloudTrail events recorded
- [ ] Alarms configured and tested
- [ ] WAF rules blocking attacks
- [ ] Macie scanning S3 buckets
- [ ] GuardDuty findings reviewed

### Quarterly Reviews
- [ ] Penetration test completed
- [ ] Access reviews conducted
- [ ] Compliance audit passed
- [ ] Disaster recovery tested
- [ ] Runbooks updated
