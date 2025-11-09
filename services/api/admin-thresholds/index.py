import json
import os
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['RISK_TABLE_NAME'])

def handler(event, context):
    """
    Admin endpoint to update risk thresholds
    All changes are audited via CloudTrail
    """
    try:
        # Extract admin user from Cognito claims
        claims = event['requestContext']['authorizer']['claims']
        admin_user = claims.get('email', 'unknown')
        
        body = json.loads(event['body'])
        threshold_type = body['thresholdType']
        threshold_value = body['value']
        
        # Store threshold configuration
        config_id = f"CONFIG:threshold:{threshold_type}"
        
        table.put_item(
            Item={
                'entityId': config_id,
                'asOfTs': int(datetime.utcnow().timestamp()),
                'value': threshold_value,
                'updatedBy': admin_user,
                'timestamp': datetime.utcnow().isoformat()
            }
        )
        
        # Log audit event
        print(json.dumps({
            'event': 'THRESHOLD_UPDATE',
            'admin': admin_user,
            'thresholdType': threshold_type,
            'value': threshold_value,
            'timestamp': datetime.utcnow().isoformat()
        }))
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
            },
            'body': json.dumps({
                'message': 'Threshold updated successfully',
                'thresholdType': threshold_type,
                'value': threshold_value
            })
        }
        
    except Exception as e:
        print(f"Error updating threshold: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Internal server error'})
        }
