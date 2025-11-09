import json
import os
import boto3
from decimal import Decimal
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['RISK_TABLE_NAME'])

def handler(event, context):
    """
    Screen entity for risk - API endpoint handler
    Returns risk score, status, and evidence
    """
    try:
        body = json.loads(event['body'])
        entity_type = body['entityType']
        name = body['name']
        dob = body.get('dateOfBirth')
        country = body.get('country')
        
        # Generate entity ID (in production: use deterministic hash)
        entity_id = f"{entity_type}:{name.lower().replace(' ', '_')}"
        
        # Query DynamoDB for latest risk profile
        response = table.query(
            KeyConditionExpression='entityId = :eid',
            ExpressionAttributeValues={':eid': entity_id},
            ScanIndexForward=False,
            Limit=1
        )
        
        if response['Items']:
            item = response['Items'][0]
            risk_score = float(item['score'])
            status = item['status']
            evidence = item.get('evidence', [])
        else:
            # No existing profile - return default
            risk_score = 0.0
            status = 'CLEAR'
            evidence = []
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
            },
            'body': json.dumps({
                'entityId': entity_id,
                'riskScore': risk_score,
                'status': status,
                'evidence': evidence,
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    except Exception as e:
        print(f"Error screening entity: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Internal server error'})
        }
