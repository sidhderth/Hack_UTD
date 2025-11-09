# NLP Pipeline Architecture

## Overview

The NLP pipeline is the core of AEGIS's false-positive reduction strategy. It uses SageMaker for contextual entity disambiguation, ensuring high-confidence risk assessments.

## Pipeline Flow

```
S3 Raw Bucket (PutObject Event)
    ↓
EventBridge Rule
    ↓
Step Functions State Machine
    ↓
┌─────────────────────────────────────────┐
│  Stage 1: Named Entity Recognition      │
│  - SageMaker endpoint (private VPC)     │
│  - Extract: persons, companies, locs    │
│  - Output: entities[] with scores       │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Stage 2: Entity Resolution             │
│  - Contextual disambiguation            │
│  - Canonical ID assignment              │
│  - Alias detection                      │
│  - FALSE-POSITIVE REDUCTION (Core KPI)  │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Stage 3: Risk Classification           │
│  - Financial crime scoring (0-1)        │
│  - Evidence collection                  │
│  - Status determination                 │
│  - Confidence scoring                   │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Stage 4: Persistence                   │
│  - Write to DynamoDB RiskProfiles       │
│  - Emit EventBridge "Risk Updated"      │
│  - Trigger webhooks                     │
└─────────────────────────────────────────┘
```

## Stage 1: Named Entity Recognition (NER)

**Lambda Function**: `aegis-ner-{env}`

**Input**: S3 event with raw data location
```json
{
  "bucket": { "name": "aegis-raw-data-prod-123456789012" },
  "object": { "key": "raw/2025/11/08/source_data.json" }
}
```

**SageMaker Task**: Extract entities from text
- Model: HuggingFace Transformers (NER pipeline)
- Instance: ml.m5.large (private VPC)
- Aggregation: Simple (merge subword tokens)

**Output**: Entities with confidence scores
```json
{
  "statusCode": 200,
  "bucket": "aegis-processed-prod-123456789012",
  "key": "ner/2025/11/08/source_data.json",
  "entities": [
    {
      "text": "John Smith",
      "type": "PERSON",
      "score": 0.95,
      "start": 0,
      "end": 10
    },
    {
      "text": "Acme Corp",
      "type": "ORGANIZATION",
      "score": 0.92,
      "start": 25,
      "end": 34
    }
  ]
}
```

## Stage 2: Entity Resolution (Disambiguation)

**Lambda Function**: `aegis-entity-resolution-{env}`

**Core KPI: False-Positive Reduction**

This stage is critical for reducing false positives by:
1. Resolving entities to canonical forms
2. Disambiguating similar names using context
3. Detecting aliases and variations
4. Assigning unique canonical IDs

**Input**: NER output with entities
```json
{
  "bucket": "aegis-processed-prod-123456789012",
  "key": "ner/2025/11/08/source_data.json",
  "entities": [...]
}
```

**SageMaker Task**: Contextual disambiguation
- Model: Custom entity resolution model
- Context: Source metadata, co-occurring entities
- Disambiguation: Confidence scoring per match

**Output**: Resolved entities with canonical IDs
```json
{
  "statusCode": 200,
  "bucket": "aegis-processed-prod-123456789012",
  "key": "resolved/2025/11/08/source_data.json",
  "resolvedEntities": [
    {
      "originalText": "John Smith",
      "canonicalId": "person:john_smith_1980_01_15",
      "canonicalName": "John Smith",
      "type": "PERSON",
      "disambiguationScore": 0.88,
      "aliases": ["J. Smith", "John A. Smith"],
      "metadata": {
        "dateOfBirth": "1980-01-15",
        "country": "US"
      }
    }
  ],
  "falsePositiveReduction": {
    "originalCount": 5,
    "resolvedCount": 3,
    "avgDisambiguationScore": 0.85
  }
}
```

**False-Positive Reduction Metrics**:
- **Deduplication**: Multiple mentions → single canonical entity
- **Disambiguation Score**: Confidence in entity identity (0-1)
- **Context Awareness**: Uses source metadata to distinguish similar names
- **Alias Detection**: Groups variations under canonical ID

## Stage 3: Risk Classification & Scoring

**Lambda Function**: `aegis-risk-scoring-{env}`

**Input**: Resolved entities
```json
{
  "bucket": "aegis-processed-prod-123456789012",
  "key": "resolved/2025/11/08/source_data.json",
  "resolvedEntities": [...]
}
```

**SageMaker Task**: Financial crime risk classification
- Model: Custom risk classification model
- Features: Entity type, aliases, metadata, source reputation
- Output: Risk score (0-1) + evidence

**Risk Score Calculation**:
```python
risk_score = weighted_sum([
    sanctions_match * 0.4,
    pep_match * 0.3,
    adverse_media * 0.2,
    jurisdiction_risk * 0.1
])

status = "REVIEW_REQUIRED" if risk_score >= 0.3 else "CLEAR"
```

**Output**: Risk profiles with evidence
```json
{
  "statusCode": 200,
  "riskProfiles": [
    {
      "entityId": "person:john_smith_1980_01_15",
      "riskScore": 0.75,
      "status": "REVIEW_REQUIRED"
    }
  ],
  "summary": {
    "total": 3,
    "clear": 1,
    "reviewRequired": 2
  }
}
```

## Stage 4: Persistence & Events

**Actions**:
1. Write to DynamoDB RiskProfiles table
2. Emit EventBridge "Risk Updated" event
3. Trigger webhook Lambda for tenant notifications

**DynamoDB Item**:
```json
{
  "entityId": "person:john_smith_1980_01_15",
  "asOfTs": 1699459200,
  "name": "John Smith",
  "score": 0.75,
  "status": "REVIEW_REQUIRED",
  "evidence": [
    {
      "source": "sanctions-list",
      "match": "partial",
      "confidence": 0.85,
      "description": "Name similarity to sanctioned individual"
    }
  ],
  "entityType": "PERSON",
  "aliases": ["J. Smith", "John A. Smith"],
  "processedAt": "2025-11-08T12:00:00Z",
  "sourceKey": "raw/2025/11/08/source_data.json"
}
```

**EventBridge Event**:
```json
{
  "source": "aegis.risk",
  "detail-type": "Risk Updated",
  "detail": {
    "entityId": "person:john_smith_1980_01_15",
    "entityName": "John Smith",
    "riskScore": 0.75,
    "status": "REVIEW_REQUIRED",
    "timestamp": "2025-11-08T12:00:00Z"
  }
}
```

## Error Handling

**Step Functions Retry Policy**:
- Max attempts: 3
- Backoff rate: 2.0
- Interval: 2 seconds

**Catch Blocks**:
- Lambda errors → Fail state with error details
- SageMaker throttling → Exponential backoff
- DynamoDB throttling → Retry with jitter

**Dead Letter Queue**:
- Failed executions → SQS DLQ
- Manual review and reprocessing

## Monitoring

**CloudWatch Metrics**:
- Pipeline execution duration
- Entity count per stage
- Disambiguation score distribution
- False-positive reduction rate
- SageMaker endpoint latency

**Alarms**:
- Pipeline failure rate > 5%
- Average disambiguation score < 0.7
- SageMaker endpoint errors

## Performance

**Latency Targets**:
- NER: < 2 seconds per document
- Entity Resolution: < 3 seconds per entity
- Risk Scoring: < 1 second per entity
- Total pipeline: < 10 seconds for typical document

**Throughput**:
- Concurrent executions: 100
- Documents per hour: 10,000+
- Entities per hour: 100,000+

## SageMaker Model Deployment

### Model Training (Separate Process)

```python
# Train NER model
from transformers import AutoModelForTokenClassification, Trainer

model = AutoModelForTokenClassification.from_pretrained(
    "dslim/bert-base-NER",
    num_labels=len(label_list)
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset
)

trainer.train()
model.save_pretrained("./ner-model")
```

### Model Packaging

```bash
# Create model.tar.gz
cd ner-model
tar -czf ../model.tar.gz *

# Upload to S3
aws s3 cp model.tar.gz s3://aegis-processed-prod-123456789012/models/ner-model.tar.gz
```

### Endpoint Deployment

Handled by CDK PipelineStack:
- Model: HuggingFace container image
- Instance: ml.m5.large (private VPC)
- Auto-scaling: 1-5 instances based on load
- Encryption: Data in transit (TLS 1.2)

## False-Positive Reduction Examples

### Example 1: Name Disambiguation

**Raw Input**: "John Smith" appears in 3 different sources

**Without Disambiguation**:
- 3 separate alerts
- Manual review required for each
- High false-positive rate

**With Disambiguation**:
- Context analysis (DOB, location, company)
- Canonical ID: `person:john_smith_1980_01_15`
- 1 consolidated alert
- **False-positive reduction: 67%**

### Example 2: Alias Detection

**Raw Input**: "J. Smith", "John Smith", "John A. Smith"

**Without Alias Detection**:
- 3 separate entities
- Duplicate risk assessments

**With Alias Detection**:
- All mapped to canonical ID
- Single risk profile
- **False-positive reduction: 67%**

### Example 3: Contextual Scoring

**Raw Input**: "John Smith" (common name)

**Without Context**:
- High match rate to sanctions lists
- Many false positives

**With Context**:
- DOB, nationality, company used for disambiguation
- Disambiguation score: 0.88 (high confidence)
- Only high-confidence matches flagged
- **False-positive reduction: 80%**

## Security Considerations

- All Lambda functions in private VPC subnets
- SageMaker endpoint in private VPC (no internet access)
- VPC endpoints for S3, DynamoDB, SageMaker Runtime
- KMS encryption for all data at rest
- TLS 1.2+ for all data in transit
- IAM roles with least privilege
- CloudTrail logging for all API calls
