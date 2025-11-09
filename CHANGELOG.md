# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-08

### Added
- Initial release of AEGIS serverless backend
- API Gateway with WAF protection
- Lambda functions for risk screening
- DynamoDB RiskProfiles table with GSIs
- S3 buckets for raw and processed data
- VPC with private subnets and VPC endpoints
- KMS CMKs for encryption at rest
- Cognito User Pool with MFA
- Fargate cluster for scraping tasks
- SageMaker integration for NLP/ML
- Macie PII detection and automated redaction
- CloudTrail audit logging with Object Lock
- GuardDuty threat detection
- CloudWatch alarms for security events
- IAM roles with separation of duties
- Comprehensive documentation

### Security
- No public IPs on compute resources
- TLS ≥1.2 with HSTS headers
- WAF managed rules (SQLi, XSS, SSRF)
- Rate limiting (2000 req/sec per IP)
- Least privilege IAM policies
- Secrets Manager integration
- Encrypted backups with PITR

### Documentation
- Architecture overview
- API documentation
- Security documentation
- Deployment guide
- Testing guide
- Contributing guidelines

## [Unreleased]

### Planned
- Multi-region deployment
- Enhanced NLP models
- Real-time risk scoring
- Advanced analytics dashboard
- Mobile SDK
- Webhook retry logic
- GraphQL API option
