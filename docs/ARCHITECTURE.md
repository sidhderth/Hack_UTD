# AEGIS Architecture

## Security-First Design Principles

### 1. Network Isolation
- **Public Ingress**: Only API Gateway has public endpoint
- **Private Compute**: All Lambda, Fargate, SageMaker in private VPC subnets
- **VPC Endpoints**: AWS service communication via PrivateLink (no internet)
- **NAT Gateway**: Controlled egress for scraping tasks only

### 2. Data Protection

#### Encryption at Rest
- KMS CMKs per data domain (separate keys per environment)
- DynamoDB: Customer-managed encryption + PITR
- S3: KMS encryption + versioning + Object Lock for audit logs
- Secrets Manager: Automatic rotation for credentials

#### Encryption in Transit
- TLS ≥1.2 everywhere
- HSTS headers on API responses
- Perfect forward secrecy (PFS) cipher suites

### 3. Identity & Access Management

#### Human Roles (Separation of Duties)
- **AdminRole**: Infrastructure/IAM management (MFA required)
- **DeveloperRole**: Code deployment only (IAM deny policy)
- **SecurityAuditorRole**: Read-only logs/security services

#### Service Roles (Least Privilege)
- **ApiLambdaRole**: DynamoDB Query only, KMS decrypt scoped to table key
- **ScraperFargateRole**: S3 PutObject to raw bucket only
- **RedactionLambdaRole**: S3 read/write on raw bucket, KMS encrypt/decrypt

### 4. API Security

#### Edge Protection
- WAF with managed rules: SQLi, XSS, SSRF, IP reputation
- Rate limiting: 2000 req/sec per IP
- Request validation: JSON Schema enforcement

#### Authentication & Authorization
- Cognito User Pool with MFA required
- JWT token validation at API Gateway
- Usage plans with throttling & quotas per tenant

### 5. Privacy & Compliance

#### PII Detection & Redaction
1. Macie continuously scans S3 raw bucket
2. PII finding → EventBridge → Redaction Lambda
3. Lambda masks PII (SSN, email, phone, credit card)
4. Sanitized object written to `sanitized/` prefix
5. Audit trail logged to CloudWatch

#### Audit & Monitoring
- CloudTrail: All API calls logged to immutable S3 (Object Lock)
- CloudWatch: Structured JSON logs (PII-safe)
- GuardDuty: Threat detection
- Alarms: Root login, IAM changes, error spikes, throttling

## Data Flow

### Ingestion Pipeline
```
External Sources → Fargate Scraper → S3 Raw Bucket
                                    ↓
                            S3 Event Notification
                                    ↓
                            Step Functions Orchestration
                                    ↓
                    SageMaker (NER → Entity Resolution → Risk Scoring)
                                    ↓
                            DynamoDB RiskProfiles Table
```

### API Request Flow
```
Client → API Gateway (WAF) → Cognito Authorizer → Lambda (VPC)
                                                      ↓
                                              DynamoDB Query
                                                      ↓
                                              Response (JSON)
```

## Multi-Account Strategy

### Environment Separation
- **dev**: Development/testing (relaxed retention)
- **staging**: Pre-production validation
- **prod**: Production (manual approvals, extended retention)

### Per-Environment Resources
- Unique KMS keys
- Isolated VPCs
- Separate IAM boundaries
- Independent CloudTrail logs

## Disaster Recovery

### RPO/RTO Targets
- **RPO**: 1 hour (DynamoDB PITR, S3 versioning)
- **RTO**: 4 hours (multi-AZ, automated failover)

### Backup Strategy
- DynamoDB: Point-in-time recovery enabled
- S3: Versioning + cross-region replication (prod only)
- CloudTrail: Immutable logs with 7-year retention

## Security Hardening Checklist

- [x] No public IPs on compute resources
- [x] VPC Endpoints for all AWS services
- [x] KMS CMKs with key grants (not broad policies)
- [x] WAF with managed rules + rate limiting
- [x] TLS ≥1.2 with HSTS
- [x] Secrets Manager (no env vars)
- [x] IAM least privilege + SoD
- [x] Macie PII detection + automated redaction
- [x] CloudTrail + Object Lock
- [x] GuardDuty threat detection
- [x] CloudWatch alarms for security events
- [x] ECR image scanning
- [x] Read-only Lambda filesystems
- [x] MFA for admin operations
