#!/usr/bin/env python3
"""
Automatically populate DynamoDB with test data
Shows risk probabilities without manual upload
"""

import json
import boto3
from decimal import Decimal
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('aegis-risk-profiles-dev')

def load_test_data():
    """Load expected risk scoring output"""
    with open('tests/fixtures/expected-risk-scoring-output.json', 'r') as f:
        data = json.load(f)
    return data['riskProfiles']

def convert_floats_to_decimal(obj):
    """Convert floats to Decimal for DynamoDB"""
    if isinstance(obj, list):
        return [convert_floats_to_decimal(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: convert_floats_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, float):
        return Decimal(str(obj))
    else:
        return obj

def populate_dynamodb():
    """Populate DynamoDB with test risk profiles"""
    print("=" * 60)
    print("  Populating DynamoDB with Test Data")
    print("=" * 60)
    print()
    
    risk_profiles = load_test_data()
    
    for profile in risk_profiles:
        entity_id = profile['entityId']
        entity_name = profile['entityName']
        risk_score = profile['riskScore']
        status = profile['status']
        risk_level = profile['riskLevel']
        
        # Prepare item for DynamoDB
        item = {
            'entityId': entity_id,
            'asOfTs': int(datetime.utcnow().timestamp()),
            'name': entity_name,
            'score': Decimal(str(risk_score)),
            'status': status,
            'riskLevel': risk_level,
            'confidence': Decimal(str(profile['confidence'])),
            'riskBreakdown': convert_floats_to_decimal(profile['riskBreakdown']),
            'evidence': convert_floats_to_decimal(profile['evidence']),
            'recommendations': profile['recommendations'],
            'processedAt': datetime.utcnow().isoformat(),
            'metadata': convert_floats_to_decimal(profile.get('metadata', {}))
        }
        
        # Add optional fields
        if 'caveats' in profile:
            item['caveats'] = profile['caveats']
        if 'pepDetails' in profile:
            item['pepDetails'] = convert_floats_to_decimal(profile['pepDetails'])
        
        # Write to DynamoDB
        table.put_item(Item=item)
        
        # Print summary
        color = '\033[91m' if risk_score >= 0.7 else '\033[93m' if risk_score >= 0.3 else '\033[92m'
        reset = '\033[0m'
        
        print(f"{color}✓ {entity_name}{reset}")
        print(f"  Entity ID: {entity_id}")
        print(f"  Risk Score: {risk_score:.2f} ({int(risk_score * 100)}%)")
        print(f"  Status: {status}")
        print(f"  Risk Level: {risk_level}")
        print(f"  Evidence: {len(profile['evidence'])} items")
        print()
    
    print("=" * 60)
    print(f"  ✓ Successfully inserted {len(risk_profiles)} risk profiles")
    print("=" * 60)
    print()
    
    print("View results:")
    print("1. DynamoDB Console:")
    print("   https://console.aws.amazon.com/dynamodbv2/home?region=us-east-1#item-explorer?table=aegis-risk-profiles-dev")
    print()
    print("2. Run API test:")
    print("   python test-api.py")
    print()

if __name__ == '__main__':
    try:
        populate_dynamodb()
    except Exception as e:
        print(f"\n✗ Error: {str(e)}")
        print("\nMake sure:")
        print("1. AWS credentials are configured")
        print("2. You're in the project root directory")
        print("3. DynamoDB table exists: aegis-risk-profiles-dev")
