import json
import os
import boto3
import re
from datetime import datetime

s3 = boto3.client('s3')

# PII patterns for redaction
PII_PATTERNS = {
    'SSN': r'\b\d{3}-\d{2}-\d{4}\b',
    'EMAIL': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    'PHONE': r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
    'CREDIT_CARD': r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'
}

def redact_pii(text):
    """
    Redact PII from text using regex patterns
    """
    redacted = text
    redactions = []
    
    for pii_type, pattern in PII_PATTERNS.items():
        matches = re.finditer(pattern, redacted)
        for match in matches:
            redacted = redacted.replace(match.group(), f'[REDACTED_{pii_type}]')
            redactions.append({
                'type': pii_type,
                'position': match.start()
            })
    
    return redacted, redactions

def handler(event, context):
    """
    Lambda triggered by Macie findings via EventBridge
    Redacts PII from S3 objects and re-writes sanitized version
    """
    try:
        # Parse Macie finding from EventBridge
        detail = event.get('detail', {})
        
        if detail.get('type') == 'SensitiveData:S3Object/Personal':
            s3_object = detail['resourcesAffected']['s3Object']
            bucket = s3_object['bucketName']
            key = s3_object['key']
            
            print(f"PII detected in s3://{bucket}/{key}")
            
            # Download object
            response = s3.get_object(Bucket=bucket, Key=key)
            content = response['Body'].read().decode('utf-8')
            
            # Redact PII
            redacted_content, redactions = redact_pii(content)
            
            # Write sanitized version
            sanitized_key = f"sanitized/{key}"
            s3.put_object(
                Bucket=bucket,
                Key=sanitized_key,
                Body=redacted_content.encode('utf-8'),
                ServerSideEncryption='aws:kms',
                Metadata={
                    'original-key': key,
                    'redaction-timestamp': datetime.utcnow().isoformat(),
                    'redaction-count': str(len(redactions))
                }
            )
            
            # Log audit trail
            print(json.dumps({
                'event': 'PII_REDACTION',
                'bucket': bucket,
                'originalKey': key,
                'sanitizedKey': sanitized_key,
                'redactions': redactions,
                'timestamp': datetime.utcnow().isoformat()
            }))
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'PII redacted successfully',
                    'sanitizedKey': sanitized_key,
                    'redactionCount': len(redactions)
                })
            }
        
        return {'statusCode': 200, 'body': 'No action required'}
        
    except Exception as e:
        print(f"Error redacting PII: {str(e)}")
        raise
