# AEGIS - Serverless Risk Intelligence Backend

## Architecture Overview

**Security-First Design**: Single public ingress (API Gateway) → All compute in private VPC subnets with VPC Endpoints.

### Core Components

1. **API Layer**: API Gateway (REST) + WAF → Lambda (private subnets)
2. **Compute**: Lambda (orchestration), Fargate (ingestion), SageMaker (NLP/ML)
3. **Orchestration**: Step Functions (NLP pipeline), EventBridge (domain events)
4. **Storage**: DynamoDB (RiskProfiles), S3 (raw/processed data)
5. **Security**: Cognito, KMS CMKs, Macie, GuardDuty, CloudTrail

### NLP Pipeline (Core KPI: False-Positive Reduction)

**Step Functions Orchestration:**
1. **NER**: SageMaker extracts entities (persons, companies, locations)
2. **Entity Resolution**: Contextual disambiguation to reduce false positives
3. **Risk Scoring**: Financial-crime classification (0-1 score)
4. **Persistence**: Write to DynamoDB with status (CLEAR/REVIEW_REQUIRED)
5. **Events**: Emit EventBridge events for webhooks

### Key Security Controls

- ✅ No public IPs on Lambda/Fargate/SageMaker/DynamoDB/S3
- ✅ VPC Endpoints for all AWS service communication
- ✅ KMS CMKs per data domain with key grants
- ✅ WAF with managed rules (SQLi/XSS/SSRF)
- ✅ TLS ≥1.2 everywhere
- ✅ Separation of Duties (Admin/Developer/SecurityAuditor roles)
- ✅ Macie PII detection + automated redaction
- ✅ Immutable audit logs (CloudTrail + Object Lock)

## Environments

- **dev**: Development account
- **staging**: Pre-production testing
- **prod**: Production (manual approval gates)

Each environment has isolated KMS keys, VPCs, and IAM boundaries.

## Deployment

See `infrastructure/README.md` for IaC deployment instructions.

## API Endpoints

- `POST /v1/screen_entity` - Screen entity for risk
- `GET /v1/entities/{id}/risk` - Fetch risk history
- `POST /v1/admin/thresholds` - Admin configuration (audited)

## Monitoring & Alerts

- CloudWatch dashboards per service
- Alarms: root login, IAM changes, error spikes, GuardDuty findings
- Centralized logging with structured JSON (PII-safe)
