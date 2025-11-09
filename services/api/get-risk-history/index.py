import json
import os
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['RISK_TABLE_NAME'])

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def handler(event, context):
    """
    Get risk history for an entity - paginated
    """
    try:
        entity_id = event['pathParameters']['id']
        limit = int(event.get('queryStringParameters', {}).get('limit', 20))
        
        # Query all risk profiles for this entity
        response = table.query(
            KeyConditionExpression='entityId = :eid',
            ExpressionAttributeValues={':eid': entity_id},
            ScanIndexForward=False,
            Limit=limit
        )
        
        items = response.get('Items', [])
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
            },
            'body': json.dumps({
                'entityId': entity_id,
                'history': items,
                'count': len(items)
            }, cls=DecimalEncoder)
        }
        
    except Exception as e:
        print(f"Error fetching risk history: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Internal server error'})
        }
