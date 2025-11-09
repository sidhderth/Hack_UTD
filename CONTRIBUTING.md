# Contributing to AEGIS

## Development Workflow

### 1. Setup Development Environment

```bash
# Clone repository
git clone https://github.com/example/aegis-backend.git
cd aegis-backend

# Install dependencies
cd infrastructure
npm install

# Configure AWS credentials
aws configure --profile dev
```

### 2. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 3. Make Changes

- Follow code style guidelines
- Add unit tests for new functionality
- Update documentation as needed
- Ensure security best practices

### 4. Test Locally

```bash
# Run unit tests
npm test

# Validate IaC
npm run validate

# Security scans
npm audit
```

### 5. Submit Pull Request

- Provide clear description of changes
- Reference related issues
- Ensure CI checks pass
- Request review from security team for sensitive changes

## Code Style

### Python
- Follow PEP 8
- Use type hints
- Maximum line length: 100 characters
- Use `black` for formatting

```bash
pip install black
black services/
```

### TypeScript
- Follow Airbnb style guide
- Use ESLint
- Prefer `const` over `let`

```bash
npm run lint
npm run format
```

## Security Guidelines

### Never Commit
- AWS credentials
- API keys or secrets
- PII or sensitive data
- Private keys

### Always
- Use Secrets Manager for credentials
- Validate all inputs
- Log security events
- Follow least privilege principle
- Encrypt sensitive data

## Testing Requirements

### Unit Tests
- Minimum 80% code coverage
- Test happy path and error cases
- Mock external dependencies

### Integration Tests
- Test against dev environment
- Verify end-to-end flows
- Check error handling

### Security Tests
- Validate IAM policies
- Test encryption
- Verify access controls

## Documentation

### Required Documentation
- API changes: Update `docs/API.md`
- Architecture changes: Update `docs/ARCHITECTURE.md`
- Security changes: Update `docs/SECURITY.md`
- Deployment changes: Update `docs/DEPLOYMENT.md`

### Code Comments
- Explain "why", not "what"
- Document security considerations
- Note any workarounds or limitations

## Review Process

### Code Review Checklist
- [ ] Code follows style guidelines
- [ ] Tests added and passing
- [ ] Documentation updated
- [ ] Security implications considered
- [ ] No secrets committed
- [ ] IAM policies follow least privilege
- [ ] Error handling implemented

### Security Review (Required for)
- IAM policy changes
- Encryption changes
- API endpoint additions
- Data handling modifications
- Third-party integrations

## Release Process

### Version Numbering
Follow Semantic Versioning (SemVer):
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

### Release Checklist
1. Update CHANGELOG.md
2. Tag release in Git
3. Deploy to staging
4. Run integration tests
5. Security scan
6. Deploy to production (with approval)
7. Monitor for issues

## Getting Help

- **Questions**: Open GitHub Discussion
- **Bugs**: Create GitHub Issue
- **Security Issues**: Email security@example.com (do not create public issue)
- **Documentation**: Check `docs/` directory

## License

By contributing, you agree that your contributions will be licensed under the project's license.
