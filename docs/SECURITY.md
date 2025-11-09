# Security Documentation

## Threat Model

### Assets
1. **Customer PII**: Names, DOB, addresses in DynamoDB/S3
2. **Risk Intelligence**: Proprietary scoring algorithms & data sources
3. **API Credentials**: Cognito tokens, API keys
4. **Infrastructure**: AWS account access, KMS keys

### Threats
1. **Data Breach**: Unauthorized access to PII
2. **API Abuse**: DDoS, credential stuffing, scraping
3. **Insider Threat**: Malicious admin/developer
4. **Supply Chain**: Compromised dependencies
5. **Compliance Violation**: GDPR, SOC 2 failures

## Security Controls

### 1. Network Security

#### Perimeter Defense
- **WAF Rules**: Block SQLi, XSS, SSRF attacks
- **Rate Limiting**: 2000 req/sec per IP
- **Geo-Blocking**: Optional country restrictions
- **DDoS Protection**: AWS Shield Standard (free tier)

#### Internal Segmentation
- **Private Subnets**: All compute isolated from internet
- **Security Groups**: Least-privilege ingress/egress
- **VPC Endpoints**: No traffic leaves AWS network
- **NAT Gateway**: Controlled egress for scraping only

### 2. Identity & Access

#### Authentication
- **Cognito MFA**: TOTP required for all users
- **Password Policy**: 12+ chars, complexity requirements
- **Session Management**: JWT tokens with 1-hour expiry
- **API Keys**: Per-tenant keys with usage quotas

#### Authorization
- **IAM Roles**: Separation of duties (Admin/Dev/Auditor)
- **Resource Policies**: Explicit deny for sensitive operations
- **Key Grants**: KMS access scoped to specific services
- **Least Privilege**: Each service role has minimal permissions

### 3. Data Protection

#### At Rest
- **KMS CMKs**: Separate keys per environment
- **Key Rotation**: Automatic annual rotation
- **DynamoDB Encryption**: Customer-managed keys
- **S3 Encryption**: SSE-KMS with bucket policies
- **Object Lock**: Immutable audit logs (WORM)

#### In Transit
- **TLS 1.2+**: Enforced on all endpoints
- **HSTS**: Strict-Transport-Security headers
- **Certificate Pinning**: Optional for mobile clients
- **Perfect Forward Secrecy**: ECDHE cipher suites

#### PII Handling
- **Macie Scanning**: Continuous PII detection
- **Automated Redaction**: Lambda masks sensitive data
- **Audit Trail**: All redactions logged
- **Data Minimization**: Collect only necessary fields

### 4. Application Security

#### Input Validation
- **JSON Schema**: Request validation at API Gateway
- **Parameterized Queries**: No SQL injection risk
- **Content-Type Checks**: Prevent MIME confusion
- **Size Limits**: Max 1MB request body

#### Output Encoding
- **JSON Responses**: Proper escaping
- **Error Messages**: No sensitive info leakage
- **Logging**: PII-safe structured logs

#### Secrets Management
- **Secrets Manager**: Automatic rotation
- **No Hardcoding**: Secrets injected at runtime
- **Encryption**: Secrets encrypted with KMS
- **Access Logging**: All secret retrievals audited

### 5. Monitoring & Response

#### Detection
- **CloudTrail**: All API calls logged
- **GuardDuty**: Threat intelligence
- **Macie**: PII exposure detection
- **CloudWatch Alarms**: Real-time alerts

#### Alerting
- **Root Login**: Immediate SNS notification
- **IAM Changes**: Security team alerted
- **Error Spikes**: On-call paged
- **GuardDuty Findings**: Automated ticket creation

#### Response
- **Runbooks**: Documented incident procedures
- **Automated Remediation**: Lambda for common issues
- **Forensics**: Immutable logs for investigation
- **Communication**: Stakeholder notification templates

## Compliance

### SOC 2 Type 2

#### Security Principles
- [x] Access controls (IAM, MFA)
- [x] Encryption (KMS, TLS)
- [x] Monitoring (CloudTrail, GuardDuty)
- [x] Change management (IaC, approvals)
- [x] Incident response (runbooks, alerts)

#### Evidence Collection
- CloudTrail logs (7-year retention)
- Access reviews (quarterly)
- Penetration test reports (annual)
- Vulnerability scans (monthly)

### GDPR

#### Data Subject Rights
- **Right to Access**: API endpoint for data export
- **Right to Erasure**: Automated deletion workflow
- **Right to Rectification**: Update API endpoints
- **Data Portability**: JSON export format

#### Privacy by Design
- **Data Minimization**: Only collect necessary fields
- **Purpose Limitation**: Clear data usage policies
- **Storage Limitation**: Automated retention policies
- **Pseudonymization**: Entity IDs instead of names

## Security Testing

### Automated Scans

#### SAST (Static Analysis)
```bash
# Dependency vulnerabilities
npm audit
pip-audit

# Code quality
bandit -r services/
semgrep --config=auto
```

#### DAST (Dynamic Analysis)
```bash
# API security testing
zap-cli quick-scan https://api.example.com

# Infrastructure scanning
checkov -d infrastructure/
```

### Manual Testing

#### Penetration Testing
- **Frequency**: Annual
- **Scope**: API Gateway, Lambda functions, S3 buckets
- **Methodology**: OWASP Top 10, SANS Top 25
- **Remediation**: 30-day SLA for critical findings

#### Security Reviews
- **Code Reviews**: All PRs require security approval
- **Architecture Reviews**: Quarterly threat modeling
- **Access Reviews**: Quarterly IAM audit
- **Vendor Assessments**: Annual third-party reviews

## Incident Response

### Severity Levels

#### P0 (Critical)
- Data breach, PII exposure
- Complete service outage
- Active exploitation

**Response**: Immediate page, war room, executive notification

#### P1 (High)
- Partial service degradation
- GuardDuty high-severity finding
- Failed compliance control

**Response**: 1-hour SLA, security team engaged

#### P2 (Medium)
- Performance issues
- Low-severity vulnerabilities
- Configuration drift

**Response**: 4-hour SLA, normal escalation

### Runbooks

#### Data Breach Response
1. Isolate affected resources (security group changes)
2. Preserve forensic evidence (snapshot volumes)
3. Notify stakeholders (legal, compliance, customers)
4. Investigate root cause (CloudTrail analysis)
5. Remediate vulnerability
6. Post-mortem & lessons learned

#### Credential Compromise
1. Rotate all secrets immediately
2. Revoke compromised tokens
3. Review access logs for unauthorized activity
4. Enable additional monitoring
5. Update security controls

## Security Contacts

- **Security Team**: security@example.com
- **On-Call**: PagerDuty integration
- **Compliance**: compliance@example.com
- **AWS Support**: Enterprise support plan
