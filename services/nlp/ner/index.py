import json
import os
import boto3
from datetime import datetime

s3 = boto3.client('s3')
sagemaker_runtime = boto3.client('sagemaker-runtime')

SAGEMAKER_ENDPOINT = os.environ['SAGEMAKER_ENDPOINT']
PROCESSED_BUCKET = os.environ['PROCESSED_BUCKET']

def handler(event, context):
    """
    Named Entity Recognition using SageMaker
    Extracts entities (persons, organizations, locations) from raw text
    """
    try:
        # Get S3 object details from event
        bucket = event['bucket']['name']
        key = event['object']['key']
        
        print(f"Processing NER for s3://{bucket}/{key}")
        
        # Download raw data
        response = s3.get_object(Bucket=bucket, Key=key)
        raw_data = json.loads(response['Body'].read().decode('utf-8'))
        
        text = raw_data.get('content', '')
        
        # Invoke SageMaker endpoint for NER
        sagemaker_response = sagemaker_runtime.invoke_endpoint(
            EndpointName=SAGEMAKER_ENDPOINT,
            ContentType='application/json',
            Body=json.dumps({
                'inputs': text,
                'parameters': {
                    'task': 'ner',
                    'aggregation_strategy': 'simple'
                }
            })
        )
        
        result = json.loads(sagemaker_response['Body'].read().decode('utf-8'))
        
        # Extract entities
        entities = []
        for entity in result:
            entities.append({
                'text': entity['word'],
                'type': entity['entity_group'],
                'score': entity['score'],
                'start': entity['start'],
                'end': entity['end']
            })
        
        # Write to processed bucket
        output_key = f"ner/{key.replace('raw/', '')}"
        output_data = {
            'sourceKey': key,
            'entities': entities,
            'processedAt': datetime.utcnow().isoformat(),
            'stage': 'ner'
        }
        
        s3.put_object(
            Bucket=PROCESSED_BUCKET,
            Key=output_key,
            Body=json.dumps(output_data).encode('utf-8'),
            ContentType='application/json',
            ServerSideEncryption='aws:kms'
        )
        
        print(f"NER complete: {len(entities)} entities extracted")
        
        return {
            'statusCode': 200,
            'bucket': PROCESSED_BUCKET,
            'key': output_key,
            'entities': entities
        }
        
    except Exception as e:
        print(f"Error in NER: {str(e)}")
        raise
