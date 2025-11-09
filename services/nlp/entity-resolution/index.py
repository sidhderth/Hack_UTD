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
    Entity Resolution & Disambiguation using SageMaker
    Resolves entities to canonical forms and disambiguates similar names
    Core KPI: False-positive reduction through contextual disambiguation
    """
    try:
        # Get NER output
        bucket = event['bucket']
        key = event['key']
        entities = event['entities']
        
        print(f"Resolving {len(entities)} entities from {key}")
        
        # Download NER output for context
        response = s3.get_object(Bucket=bucket, Key=key)
        ner_data = json.loads(response['Body'].read().decode('utf-8'))
        
        resolved_entities = []
        
        for entity in entities:
            # Use SageMaker for contextual disambiguation
            # This reduces false positives by considering context
            sagemaker_response = sagemaker_runtime.invoke_endpoint(
                EndpointName=SAGEMAKER_ENDPOINT,
                ContentType='application/json',
                Body=json.dumps({
                    'entity': entity['text'],
                    'type': entity['type'],
                    'context': ner_data.get('sourceKey', ''),
                    'task': 'entity_resolution'
                })
            )
            
            result = json.loads(sagemaker_response['Body'].read().decode('utf-8'))
            
            # Canonical entity with disambiguation score
            resolved_entities.append({
                'originalText': entity['text'],
                'canonicalId': result.get('canonical_id', entity['text'].lower()),
                'canonicalName': result.get('canonical_name', entity['text']),
                'type': entity['type'],
                'disambiguationScore': result.get('confidence', entity['score']),
                'aliases': result.get('aliases', []),
                'metadata': result.get('metadata', {})
            })
        
        # Write resolved entities
        output_key = key.replace('ner/', 'resolved/')
        output_data = {
            'sourceKey': ner_data['sourceKey'],
            'resolvedEntities': resolved_entities,
            'processedAt': datetime.utcnow().isoformat(),
            'stage': 'entity_resolution',
            'falsePositiveReduction': {
                'originalCount': len(entities),
                'resolvedCount': len(resolved_entities),
                'avgDisambiguationScore': sum(e['disambiguationScore'] for e in resolved_entities) / len(resolved_entities) if resolved_entities else 0
            }
        }
        
        s3.put_object(
            Bucket=bucket,
            Key=output_key,
            Body=json.dumps(output_data).encode('utf-8'),
            ContentType='application/json',
            ServerSideEncryption='aws:kms'
        )
        
        print(f"Entity resolution complete: {len(resolved_entities)} entities resolved")
        
        return {
            'statusCode': 200,
            'bucket': bucket,
            'key': output_key,
            'resolvedEntities': resolved_entities
        }
        
    except Exception as e:
        print(f"Error in entity resolution: {str(e)}")
        raise
