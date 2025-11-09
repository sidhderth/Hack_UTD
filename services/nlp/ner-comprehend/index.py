"""
NER using AWS Comprehend (no SageMaker needed!)
Cost: $0.0001 per unit (100 characters)
"""

import json
import os
import boto3
from datetime import datetime

s3 = boto3.client('s3')
comprehend = boto3.client('comprehend')

PROCESSED_BUCKET = os.environ['PROCESSED_BUCKET']

def handler(event, context):
    """
    Named Entity Recognition using AWS Comprehend
    """
    try:
        # Get S3 object details from event
        bucket = event['bucket']['name']
        key = event['object']['key']
        
        print(f"Processing NER for s3://{bucket}/{key}")
        
        # Download raw data
        response = s3.get_object(Bucket=bucket, Key=key)
        raw_data = json.loads(response['Body'].read().decode('utf-8'))
        
        # Extract text from records
        all_entities = []
        
        for record in raw_data.get('records', []):
            # Combine all text fields
            text = f"{record.get('name', '')} {json.dumps(record.get('metadata', {}))}"
            
            if len(text) < 10:
                continue
            
            # Call AWS Comprehend for entity detection
            comprehend_response = comprehend.detect_entities(
                Text=text[:5000],  # Comprehend limit
                LanguageCode='en'
            )
            
            # Convert Comprehend entities to our format
            for entity in comprehend_response['Entities']:
                all_entities.append({
                    'text': entity['Text'],
                    'type': entity['Type'],  # PERSON, ORGANIZATION, LOCATION, etc.
                    'score': entity['Score'],
                    'start': entity['BeginOffset'],
                    'end': entity['EndOffset']
                })
        
        # Write to processed bucket
        output_key = f"ner/{key.replace('raw/', '')}"
        output_data = {
            'sourceKey': key,
            'entities': all_entities,
            'processedAt': datetime.utcnow().isoformat(),
            'stage': 'ner',
            'engine': 'aws-comprehend'
        }
        
        s3.put_object(
            Bucket=PROCESSED_BUCKET,
            Key=output_key,
            Body=json.dumps(output_data).encode('utf-8'),
            ContentType='application/json',
            ServerSideEncryption='aws:kms'
        )
        
        print(f"✓ NER complete: {len(all_entities)} entities extracted")
        
        return {
            'statusCode': 200,
            'bucket': PROCESSED_BUCKET,
            'key': output_key,
            'entities': all_entities
        }
        
    except Exception as e:
        print(f"Error in NER: {str(e)}")
        raise
