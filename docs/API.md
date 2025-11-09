# API Documentation

## Base URL

```
https://<API_ID>.execute-api.us-east-1.amazonaws.com/<ENVIRONMENT>
```

## Authentication

All endpoints require Cognito JWT token in Authorization header:

```bash
Authorization: Bearer <JWT_TOKEN>
```

### Obtaining Token

```bash
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id <CLIENT_ID> \
  --auth-parameters USERNAME=user@example.com,PASSWORD=<PASSWORD>
```

## Endpoints

### POST /v1/screen_entity

Screen an entity for risk.

**Request**

```json
{
  "entityType": "PERSON",
  "name": "John Doe",
  "dateOfBirth": "1980-01-15",
  "country": "US"
}
```

**Response (200 OK)**

```json
{
  "entityId": "PERSON:john_doe",
  "riskScore": 0.75,
  "status": "REVIEW_REQUIRED",
  "evidence": [
    {
      "source": "sanctions-list",
      "match": "partial",
      "confidence": 0.85
    }
  ],
  "timestamp": "2025-11-08T12:00:00Z"
}
```

**Status Values**
- `CLEAR`: Risk score < 0.3
- `REVIEW_REQUIRED`: Risk score >= 0.3

**Error Responses**

```json
// 400 Bad Request
{
  "error": "Invalid request",
  "message": "entityType must be PERSON or COMPANY"
}

// 401 Unauthorized
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}

// 429 Too Many Requests
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}

// 500 Internal Server Error
{
  "error": "Internal server error"
}
```

### GET /v1/entities/{id}/risk

Fetch risk history for an entity.

**Parameters**
- `id` (path): Entity ID
- `limit` (query, optional): Max results (default: 20)

**Response (200 OK)**

```json
{
  "entityId": "PERSON:john_doe",
  "history": [
    {
      "entityId": "PERSON:john_doe",
      "asOfTs": 1699459200,
      "score": 0.75,
      "status": "REVIEW_REQUIRED",
      "evidence": [...]
    },
    {
      "entityId": "PERSON:john_doe",
      "asOfTs": 1699372800,
      "score": 0.25,
      "status": "CLEAR",
      "evidence": []
    }
  ],
  "count": 2
}
```

### POST /v1/admin/thresholds

Update risk thresholds (admin only).

**Request**

```json
{
  "thresholdType": "REVIEW_REQUIRED",
  "value": 0.3
}
```

**Response (200 OK)**

```json
{
  "message": "Threshold updated successfully",
  "thresholdType": "REVIEW_REQUIRED",
  "value": 0.3
}
```

**Authorization**

Requires admin role in Cognito user pool.

## Rate Limits

- **Per IP**: 2000 requests/second (burst: 2000)
- **Per API Key**: 100,000 requests/day
- **Throttling**: 429 response with Retry-After header

## Webhooks

Configure webhooks to receive risk change notifications.

**Webhook Payload**

```json
{
  "event": "RISK_UPDATED",
  "entityId": "PERSON:john_doe",
  "oldScore": 0.25,
  "newScore": 0.75,
  "status": "REVIEW_REQUIRED",
  "timestamp": "2025-11-08T12:00:00Z",
  "signature": "sha256=..."
}
```

**Signature Verification**

```python
import hmac
import hashlib

def verify_signature(payload, signature, secret):
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

## SDK Examples

### Python

```python
import requests

API_URL = "https://api.example.com/prod"
TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."

def screen_entity(name, entity_type="PERSON"):
    response = requests.post(
        f"{API_URL}/v1/screen_entity",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json"
        },
        json={
            "entityType": entity_type,
            "name": name
        }
    )
    response.raise_for_status()
    return response.json()

result = screen_entity("John Doe")
print(f"Risk Score: {result['riskScore']}")
print(f"Status: {result['status']}")
```

### JavaScript

```javascript
const axios = require('axios');

const API_URL = 'https://api.example.com/prod';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';

async function screenEntity(name, entityType = 'PERSON') {
  const response = await axios.post(
    `${API_URL}/v1/screen_entity`,
    {
      entityType,
      name
    },
    {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}

screenEntity('John Doe')
  .then(result => {
    console.log(`Risk Score: ${result.riskScore}`);
    console.log(`Status: ${result.status}`);
  });
```

## Error Handling

All errors follow RFC 7807 Problem Details format:

```json
{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "entityType must be PERSON or COMPANY",
  "instance": "/v1/screen_entity"
}
```
