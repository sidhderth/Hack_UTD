import json
import os
import boto3
from datetime import datetime
from decimal import Decimal

s3 = boto3.client('s3')
sagemaker_runtime = boto3.client('sagemaker-runtime')
dynamodb = boto3.resource('dynamodb')
events = boto3.client('events')

SAGEMAKER_ENDPOINT = os.environ['SAGEMAKER_ENDPOINT']
RISK_TABLE_NAME = os.environ['RISK_TABLE_NAME']

table = dynamodb.Table(RISK_TABLE_NAME)

def handler(event, context):
    """
    Financial Crime Risk Classification & Scoring using SageMaker
    Produces risk score (0-1) and status (CLEAR/REVIEW_REQUIRED)
    """
    try:
        # Get resolved entities
        bucket = event['bucket']
        key = event['key']
        resolved_entities = event['resolvedEntities']
        
        print(f"Scoring risk for {len(resolved_entities)} entities")
        
        # Download resolved entity data
        response = s3.get_object(Bucket=bucket, Key=key)
        resolved_data = json.loads(response['Body'].read().decode('utf-8'))
        
        risk_profiles = []
        
        for entity in resolved_entities:
            # Invoke SageMaker for risk classification
            sagemaker_response = sagemaker_runtime.invoke_endpoint(
                EndpointName=SAGEMAKER_ENDPOINT,
                ContentType='application/json',
                Body=json.dumps({
                    'entity': entity['canonicalName'],
                    'type': entity['type'],
                    'aliases': entity.get('aliases', []),
                    'metadata': entity.get('metadata', {}),
                    'task': 'risk_classification'
                })
            )
            
            result = json.loads(sagemaker_response['Body'].read().decode('utf-8'))
            
            # Calculate risk score (0-1)
            risk_score = result.get('risk_score', 0.0)
            risk_factors = result.get('risk_factors', [])
            
            # Determine status based on threshold
            status = 'REVIEW_REQUIRED' if risk_score >= 0.3 else 'CLEAR'
            
            # Build evidence array
            evidence = []
            for factor in risk_factors:
                evidence.append({
                    'source': factor.get('source', 'unknown'),
                    'match': factor.get('match_type', 'exact'),
                    'confidence': factor.get('confidence', 0.0),
                    'description': factor.get('description', '')
                })
            
            # Write to DynamoDB
            entity_id = entity['canonicalId']
            as_of_ts = int(datetime.utcnow().timestamp())
            
            item = {
                'entityId': entity_id,
                'asOfTs': as_of_ts,
                'name': entity['canonicalName'],
                'score': Decimal(str(risk_score)),
                'status': status,
                'evidence': evidence,
                'entityType': entity['type'],
                'aliases': entity.get('aliases', []),
                'processedAt': datetime.utcnow().isoformat(),
                'sourceKey': resolved_data['sourceKey']
            }
            
            # Add optional fields for GSI queries
            if entity['type'] == 'PERSON':
                item['company'] = entity.get('metadata', {}).get('company', 'UNKNOWN')
            
            table.put_item(Item=item)
            
            risk_profiles.append({
                'entityId': entity_id,
                'riskScore': risk_score,
                'status': status
            })
            
            # Emit EventBridge event for risk updates
            events.put_events(
                Entries=[{
                    'Source': 'aegis.risk',
                    'DetailType': 'Risk Updated',
                    'Detail': json.dumps({
                        'entityId': entity_id,
                        'entityName': entity['canonicalName'],
                        'riskScore': risk_score,
                        'status': status,
                        'timestamp': datetime.utcnow().isoformat()
                    })
                }]
            )
        
        print(f"Risk scoring complete: {len(risk_profiles)} profiles created")
        
        return {
            'statusCode': 200,
            'riskProfiles': risk_profiles,
            'summary': {
                'total': len(risk_profiles),
                'clear': sum(1 for p in risk_profiles if p['status'] == 'CLEAR'),
                'reviewRequired': sum(1 for p in risk_profiles if p['status'] == 'REVIEW_REQUIRED')
            }
        }
        
    except Exception as e:
        print(f"Error in risk scoring: {str(e)}")
        raise
