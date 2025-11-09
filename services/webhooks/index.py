import json
import os
import boto3
import hmac
import hashlib
import requests
from datetime import datetime

secrets_manager = boto3.client('secretsmanager')

def get_webhook_config(tenant_id):
    """
    Retrieve webhook configuration from Secrets Manager
    Includes URL, HMAC secret, and optional mTLS certificates
    """
    try:
        secret_name = f"aegis/webhooks/{tenant_id}"
        response = secrets_manager.get_secret_value(SecretId=secret_name)
        return json.loads(response['SecretString'])
    except Exception as e:
        print(f"Error retrieving webhook config for {tenant_id}: {str(e)}")
        return None

def generate_signature(payload, secret):
    """
    Generate HMAC-SHA256 signature for webhook payload
    """
    return hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

def handler(event, context):
    """
    Webhook sender for risk change events
    Supports HMAC signing and optional mTLS
    """
    try:
        detail = event['detail']
        
        # Extract event data
        entity_id = detail['entityId']
        entity_name = detail['entityName']
        risk_score = detail['riskScore']
        status = detail['status']
        timestamp = detail['timestamp']
        
        # Build webhook payload
        payload = {
            'event': 'RISK_UPDATED',
            'entityId': entity_id,
            'entityName': entity_name,
            'riskScore': risk_score,
            'status': status,
            'timestamp': timestamp
        }
        
        payload_json = json.dumps(payload)
        
        # Get tenant ID (from entity metadata or configuration)
        # For now, using a default tenant
        tenant_id = 'default'
        
        webhook_config = get_webhook_config(tenant_id)
        
        if not webhook_config:
            print(f"No webhook configured for tenant {tenant_id}")
            return {'statusCode': 200, 'body': 'No webhook configured'}
        
        webhook_url = webhook_config['url']
        hmac_secret = webhook_config['hmac_secret']
        
        # Generate signature
        signature = generate_signature(payload_json, hmac_secret)
        
        # Send webhook
        headers = {
            'Content-Type': 'application/json',
            'X-Aegis-Signature': f'sha256={signature}',
            'X-Aegis-Timestamp': timestamp
        }
        
        # Optional mTLS
        cert = None
        if 'mtls_cert' in webhook_config and 'mtls_key' in webhook_config:
            cert = (webhook_config['mtls_cert'], webhook_config['mtls_key'])
        
        response = requests.post(
            webhook_url,
            data=payload_json,
            headers=headers,
            cert=cert,
            timeout=10
        )
        
        response.raise_for_status()
        
        print(f"Webhook sent successfully to {webhook_url}: {response.status_code}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Webhook sent',
                'entityId': entity_id,
                'webhookUrl': webhook_url,
                'responseStatus': response.status_code
            })
        }
        
    except Exception as e:
        print(f"Error sending webhook: {str(e)}")
        # Don't fail the entire pipeline on webhook errors
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
