# AEGIS Test Suite

## Overview

Comprehensive test fixtures and integration tests for the AEGIS risk intelligence backend.

## Test Fixtures

### 1. `sample-scraped-data.json`
**Purpose**: Simulates Fargate scraper output

**Contains**: 5 test entities across different risk levels:
- Viktor Bout (Critical Risk - Sanctions)
- Acme Trading Corporation (High Risk - Shell Company)
- John Smith (Medium Risk - Adverse Media)
- Maria Garcia (Medium Risk - PEP)
- Jane Doe (Medium Risk - Criminal Charges)

**Usage**: Upload to S3 raw bucket to trigger NLP pipeline

### 2. `expected-ner-output.json`
**Purpose**: Expected output from NER (Named Entity Recognition) stage

**Contains**: Extracted entities with:
- Entity text
- Entity type (PERSON, ORGANIZATION, LOCATION)
- Confidence score
- Position in text

### 3. `expected-entity-resolution-output.json`
**Purpose**: Expected output from Entity Resolution stage

**Contains**: Resolved entities with:
- Canonical IDs
- Disambiguation scores
- Aliases
- Confidence breakdown
- False-positive reduction metrics

**Key Metrics**:
- Original count: 11 entities
- Resolved count: 5 entities (55% deduplication)
- Average disambiguation score: 0.83

### 4. `expected-risk-scoring-output.json`
**Purpose**: Expected output from Risk Scoring stage

**Contains**: Detailed risk profiles with:
- Overall risk score (0-1)
- Risk level (CRITICAL, HIGH, MEDIUM, LOW)
- Confidence score
- Risk breakdown by category
- Evidence with sources
- Recommendations
- Caveats

**Risk Breakdown Categories**:
- Sanctions Risk
- PEP Risk
- Adverse Media Risk
- Criminal Record Risk
- Jurisdiction Risk
- Association Risk

### 5. `api-test-requests.json`
**Purpose**: API endpoint test cases

**Contains**: 6 test scenarios:
1. High Risk - Sanctioned Individual
2. High Risk - Sanctioned Company
3. Medium Risk - Adverse Media
4. Medium Risk - PEP
5. Low Risk - Clean Record
6. False Positive Test - Common Name

## Integration Test

### `test_full_pipeline.py`

**Purpose**: End-to-end integration test

**Test Flow**:
```
1. Upload scraped data to S3
   ↓
2. Verify Step Functions triggered
   ↓
3. Wait for pipeline completion
   ↓
4. Verify DynamoDB records
   ↓
5. Test API endpoints
   ↓
6. Verify detailed probability breakdown
```

**Prerequisites**:
- AWS credentials configured
- Infrastructure deployed
- Cognito user created

**Run Test**:
```bash
cd tests/integration
python test_full_pipeline.py
```

## Detailed Probability Breakdown

### Example: Viktor Bout (Critical Risk)

```json
{
  "entityId": "person:viktor_bout_1967_01_13",
  "riskScore": 0.98,
  "status": "REVIEW_REQUIRED",
  "riskLevel": "CRITICAL",
  "confidence": 0.95,
  
  "riskBreakdown": {
    "sanctionsRisk": 1.0,
    "pepRisk": 0.0,
    "adverseMediaRisk": 0.95,
    "criminalRecordRisk": 1.0,
    "jurisdictionRisk": 0.85,
    "associationRisk": 0.90
  },
  
  "evidence": [
    {
      "source": "OFAC SDN List",
      "match": "exact",
      "confidence": 1.0,
      "severity": "critical",
      "description": "Listed on OFAC Specially Designated Nationals list"
    }
  ],
  
  "recommendations": [
    "REJECT - Do not onboard or transact",
    "Report to compliance officer immediately"
  ]
}
```

### Example: Maria Garcia (Medium Risk - PEP)

```json
{
  "entityId": "person:maria_garcia_1975_08_22_mx_pep",
  "riskScore": 0.45,
  "status": "REVIEW_REQUIRED",
  "riskLevel": "MEDIUM",
  "confidence": 0.91,
  
  "riskBreakdown": {
    "sanctionsRisk": 0.0,
    "pepRisk": 0.95,
    "adverseMediaRisk": 0.15,
    "criminalRecordRisk": 0.0,
    "jurisdictionRisk": 0.30,
    "associationRisk": 0.20
  },
  
  "pepDetails": {
    "riskRating": "Medium",
    "mitigatingFactors": [
      "No adverse media",
      "No corruption allegations"
    ],
    "aggravatingFactors": [
      "Control over government finances",
      "Spouse's business interests"
    ]
  },
  
  "recommendations": [
    "ENHANCED DUE DILIGENCE - PEP procedures required",
    "Source of wealth verification",
    "Senior management approval needed"
  ]
}
```

### Example: John Smith (Medium Risk - Common Name)

```json
{
  "entityId": "person:john_smith_1980_05_15_us",
  "riskScore": 0.62,
  "status": "REVIEW_REQUIRED",
  "riskLevel": "MEDIUM",
  "confidence": 0.72,
  
  "riskBreakdown": {
    "sanctionsRisk": 0.0,
    "pepRisk": 0.0,
    "adverseMediaRisk": 0.85,
    "criminalRecordRisk": 0.60,
    "jurisdictionRisk": 0.10,
    "associationRisk": 0.0
  },
  
  "caveats": [
    "Allegations only - no conviction",
    "Common name - disambiguation confidence 72%",
    "Presumption of innocence applies"
  ],
  
  "recommendations": [
    "ENHANCED DUE DILIGENCE - Monitor closely",
    "Await outcome of investigation"
  ]
}
```

## False-Positive Reduction

### Disambiguation Example

**Scenario**: Two "John Smith" entities in scraped data

**Without Disambiguation**:
- 2 separate alerts
- Manual review required for both
- High false-positive rate

**With Disambiguation**:
```json
{
  "originalCount": 2,
  "resolvedCount": 1,
  "deduplicationRate": 0.50,
  
  "entity1": {
    "name": "John Smith",
    "dob": "1980-05-15",
    "location": "New York",
    "canonicalId": "person:john_smith_1980_05_15_us",
    "disambiguationScore": 0.72,
    "riskScore": 0.62
  },
  
  "entity2": {
    "name": "John Smith",
    "dob": "1995-12-01",
    "location": "London",
    "canonicalId": "person:john_smith_1995_12_01_uk",
    "disambiguationScore": 0.85,
    "riskScore": 0.08,
    "note": "Different person - no match to adverse media"
  }
}
```

**Result**: False-positive reduction of 50% through contextual disambiguation

## Running Tests

### Unit Tests
```bash
cd services/api/screen-entity
python -m pytest tests/
```

### Integration Tests
```bash
cd tests/integration
python test_full_pipeline.py
```

### Load Tests
```bash
cd tests/load
locust -f locustfile.py --host=https://api.example.com
```

## Expected Results

### Pipeline Performance
- NER: < 2 seconds per document
- Entity Resolution: < 3 seconds per entity
- Risk Scoring: < 1 second per entity
- Total pipeline: < 10 seconds

### Accuracy Metrics
- Disambiguation accuracy: > 85%
- False-positive reduction: > 50%
- Risk classification accuracy: > 90%

### API Performance
- p50 latency: < 150ms
- p95 latency: < 300ms
- p99 latency: < 500ms
