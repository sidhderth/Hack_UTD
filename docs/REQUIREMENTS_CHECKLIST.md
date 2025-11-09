# Requirements Checklist

## ✅ Core Services & Networking

### API Gateway
- [x] REST API with single public ingress
- [x] Request validation with JSON Schema
- [x] WAF on edge (SQLi, XSS, SSRF, IP reputation)
- [x] Rate limiting (2000 req/sec per IP)
- [x] Cognito authorizer (JWT)
- [x] Usage plans with throttling & quotas per tenant

### Lambda
- [x] Python runtime
- [x] Deployed in private VPC subnets
- [x] No public IPs
- [x] VPC endpoints for AWS service access

### Step Functions
- [x] Orchestrates NLP pipeline: Ingest → Normalize → NLP → Persist
- [x] Error handling with catch/retry
- [x] CloudWatch logging enabled
- [x] Tracing enabled

### EventBridge
- [x] Domain events for risk updates
- [x] PII alerts from Macie
- [x] Webhook triggers
- [x] S3 PutObject event routing to Step Functions

### Fargate
- [x] Scraping/ingestion tasks
- [x] Headless browsing support (Selenium/Chrome)
- [x] Private VPC subnets only
- [x] Task role with write-only S3 access
- [x] Managed by ECS cluster

### SageMaker
- [x] NER (Named Entity Recognition)
- [x] Entity resolution (contextual disambiguation)
- [x] Financial-crime risk classification & scoring
- [x] Deployed in private VPC subnets
- [x] No public endpoint access
- [x] VPC endpoint for runtime API

## ✅ Data Stores & Schemas

### DynamoDB
- [x] Table: RiskProfiles
- [x] PK: entityId, SK: asOfTs
- [x] GSI: NameIndex (name + asOfTs)
- [x] GSI: CompanyIndex (company + asOfTs)
- [x] PITR enabled
- [x] KMS CMK encryption
- [x] Schema: { entityId, score (0..1), status (CLEAR|REVIEW_REQUIRED), evidence[] }

### S3
- [x] s3://aegis-raw-data for raw artifacts
- [x] s3://aegis-processed for standardized/derived JSON
- [x] Public access blocked
- [x] Object Ownership: Bucket Owner Enforced
- [x] KMS CMK encryption
- [x] Versioning enabled
- [x] Lifecycle policies

## ✅ Identity & Access Management

### Human Roles
- [x] AdminRole: Infrastructure/IaC management, MFA required
- [x] DeveloperRole: Deploy code only, no IAM edits (explicit deny)
- [x] SecurityAuditorRole: Read-only logs and security services

### Service Roles (Least Privilege)
- [x] ApiLambdaRole: Only dynamodb:Query on RiskProfiles, KMS decrypt scoped to table key
- [x] ScraperFargateRole: Only s3:PutObject to aegis-raw-data prefix, no read on processed buckets
- [x] SageMakerRole: VPC-only, read raw bucket, write processed bucket
- [x] RedactionLambdaRole: Read/write raw bucket for PII masking

### AuthN/AuthZ
- [x] Cognito User Pool with MFA required
- [x] JWT token validation at API Gateway
- [x] API keys + usage plans per tenant
- [x] Throttling & quotas at API Gateway

## ✅ API Endpoints

- [x] POST /v1/screen_entity - Validate payload → DynamoDB lookup → return { risk_score, status, evidence[] }
- [x] GET /v1/entities/{id}/risk - Fetch risk history (paginated)
- [x] POST /v1/admin/thresholds - Admin-only config, audited changes
- [x] Webhook sender for "risk change" events (HMAC signing per tenant, mTLS optional)

## ✅ Pipelines

### Ingestion Pipeline
- [x] Fargate tasks scrape 100+ sources
- [x] Retries supported
- [x] Proxy rotation capability
- [x] Normalized JSON → aegis-raw-data

### NLP Pipeline
- [x] S3 PutObject event → Step Functions
- [x] Step 1: SageMaker NER (Named Entity Recognition)
- [x] Step 2: Entity Resolution (disambiguation) - **Core KPI: False-positive reduction**
- [x] Step 3: Risk/Sentiment classification
- [x] Step 4: Score & status calculation
- [x] Step 5: Write to RiskProfiles DynamoDB
- [x] EventBridge event emission on completion

## ✅ Privacy & Compliance

### PII Protection
- [x] Amazon Macie continuous scans on aegis-raw-data
- [x] PII found → EventBridge → Redaction Lambda
- [x] Lambda masks PII (SSN, email, phone, credit card)
- [x] Re-writes sanitized object
- [x] Log evidence for audits

### Compliance Programs
- [x] SOC 2 Type 2 controls documented
- [x] 3rd-party penetration test scope defined (API Gateway & cloud infra)
- [x] Access review procedures
- [x] Change control with manual approvals

## ✅ Observability & Security Operations

### Logging & Monitoring
- [x] CloudTrail on all accounts
- [x] CloudWatch centralized logs
- [x] Structured, PII-safe logging
- [x] GuardDuty for threat intel
- [x] Alarms: root login, IAM policy changes, log deletions, error spikes

### Immutable Audit Trail
- [x] S3 bucket with Object Lock/legal hold
- [x] 7-year retention for compliance
- [x] Versioning enabled
- [x] Cross-region replication (prod)

## ✅ Hardening (Must Implement)

### Edge Security
- [x] WAF managed rules (SQLi/XSS/SSRF/IP reputation)
- [x] Geo-blocking capability
- [x] Rate limiting per IP

### Transport Security
- [x] TLS ≥1.2 enforced
- [x] HSTS headers
- [x] Perfect forward secrecy cipher suites

### Data Security
- [x] KMS CMKs per data domain
- [x] Key grants instead of broad kms:Decrypt
- [x] DynamoDB encryption + PITR
- [x] S3 encryption with KMS

### Secrets Management
- [x] AWS Secrets Manager with rotation
- [x] Never in environment variables
- [x] Webhook secrets stored securely

### Runtime Security
- [x] Fargate task roles (least privilege)
- [x] Lambda roles (least privilege)
- [x] No public container images
- [x] ECR image scanning capability
- [x] Read-only filesystems where possible

### Build Integrity
- [x] IaC (AWS CDK)
- [x] SCA/SAST/DAST gates documented
- [x] Break build on critical vulnerabilities
- [x] Dependency auditing (npm audit, pip-audit)

### Change Control
- [x] Manual approvals for prod deployments
- [x] Change sets recorded via CloudTrail
- [x] Periodic access reviews documented

## ✅ Environments & Deployment

### Multi-Account Strategy
- [x] dev, staging, prod accounts separated
- [x] Unique KMS keys per account
- [x] Isolated VPCs per environment
- [x] Independent IAM boundaries

### CI/CD
- [x] GitHub Actions example provided
- [x] Unit/integration tests
- [x] IaC validation
- [x] Security scans
- [x] Canary/blue-green deployment support for Lambda

### Disaster Recovery
- [x] Multi-AZ deployment
- [x] Defined RPO/RTO (1 hour / 4 hours)
- [x] Runbooks for failover
- [x] DynamoDB PITR
- [x] S3 versioning + cross-region replication

## ✅ Acceptance Criteria

1. **Network Isolation**
   - [x] Only API Gateway has public ingress
   - [x] All other services private with VPC endpoints
   - [x] Lambda in private subnets
   - [x] Fargate in private subnets
   - [x] SageMaker in private VPC
   - [x] DynamoDB accessed via VPC endpoint
   - [x] S3 accessed via VPC endpoint

2. **IAM Least Privilege**
   - [x] IAM passes least-privilege review
   - [x] SoD enforced (AdminRole, DeveloperRole, SecurityAuditorRole)
   - [x] Service roles scoped to specific resources
   - [x] Key grants instead of broad KMS policies

3. **Privacy & Compliance**
   - [x] Macie redaction operational
   - [x] Audit trails complete (CloudTrail + Object Lock)
   - [x] PII detection automated
   - [x] Sanitized objects created

4. **API Contracts**
   - [x] API responses match contracts
   - [x] Example CLEAR output: { riskScore: 0.25, status: "CLEAR", evidence: [] }
   - [x] Example REVIEW_REQUIRED output: { riskScore: 0.75, status: "REVIEW_REQUIRED", evidence: [...] }
   - [x] JSON Schema validation enforced

## 🎯 Core KPI: False-Positive Reduction

- [x] **Entity Resolution with Contextual Disambiguation** implemented in NLP pipeline
- [x] SageMaker used for disambiguation scoring
- [x] Canonical entity IDs to prevent duplicate alerts
- [x] Confidence scores tracked per entity match
- [x] Evidence array provides explainability
- [x] Metrics tracked: originalCount vs resolvedCount, avgDisambiguationScore

## Summary

**Total Requirements: 100+**  
**Implemented: 100+**  
**Coverage: 100%**

All requirements from the specification have been implemented with security-first design, least-privilege IAM, complete audit trails, and false-positive reduction as the core KPI through contextual entity disambiguation.
