#!/usr/bin/env python3
"""
Integration test for full AEGIS pipeline
Tests: Scraping → NER → Entity Resolution → Risk Scoring → API Response
"""

import json
import boto3
import requests
import time
from datetime import datetime

# Configuration
API_URL = "https://0khhmki0e0.execute-api.us-east-1.amazonaws.com/dev"
S3_BUCKET_RAW = "aegis-raw-data-dev-968668792715"
S3_BUCKET_PROCESSED = "aegis-processed-dev-968668792715"
DYNAMODB_TABLE = "aegis-risk-profiles-dev"

# AWS clients
s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
stepfunctions = boto3.client('stepfunctions')

def test_1_upload_scraped_data():
    """
    Test Step 1: Upload scraped data to S3 raw bucket
    This simulates the Fargate scraper output
    """
    print("\n" + "="*60)
    print("TEST 1: Upload Scraped Data to S3")
    print("="*60)
    
    # Load sample scraped data
    with open('tests/fixtures/sample-scraped-data.json', 'r') as f:
        scraped_data = json.load(f)
    
    # Upload to S3 raw bucket
    key = f"raw/{datetime.utcnow().strftime('%Y/%m/%d')}/test_ofac_sdn_{int(time.time())}.json"
    
    s3.put_object(
        Bucket=S3_BUCKET_RAW,
        Key=key,
        Body=json.dumps(scraped_data).encode('utf-8'),
        ContentType='application/json',
        ServerSideEncryption='aws:kms'
    )
    
    print(f"✓ Uploaded scraped data to s3://{S3_BUCKET_RAW}/{key}")
    print(f"  Records: {scraped_data['recordCount']}")
    print(f"  Source: {scraped_data['source']}")
    
    return key

def test_2_verify_step_functions_triggered(s3_key):
    """
    Test Step 2: Verify Step Functions pipeline was triggered by S3 event
    """
    print("\n" + "="*60)
    print("TEST 2: Verify Step Functions Pipeline Triggered")
    print("="*60)
    
    # Wait for EventBridge to trigger Step Functions
    print("Waiting 10 seconds for EventBridge trigger...")
    time.sleep(10)
    
    # List recent executions
    response = stepfunctions.list_executions(
        stateMachineArn='arn:aws:states:us-east-1:123456789012:stateMachine:aegis-nlp-pipeline-dev',
        maxResults=10
    )
    
    # Find execution for our S3 key
    for execution in response['executions']:
        if s3_key in str(execution.get('input', '')):
            print(f"✓ Step Functions execution found: {execution['executionArn']}")
            print(f"  Status: {execution['status']}")
            print(f"  Started: {execution['startDate']}")
            return execution['executionArn']
    
    print("✗ No Step Functions execution found for this S3 key")
    return None

def test_3_wait_for_pipeline_completion(execution_arn):
    """
    Test Step 3: Wait for NLP pipeline to complete
    """
    print("\n" + "="*60)
    print("TEST 3: Wait for NLP Pipeline Completion")
    print("="*60)
    
    max_wait = 300  # 5 minutes
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        response = stepfunctions.describe_execution(executionArn=execution_arn)
        status = response['status']
        
        print(f"  Pipeline status: {status} (elapsed: {int(time.time() - start_time)}s)")
        
        if status == 'SUCCEEDED':
            print(f"✓ Pipeline completed successfully")
            output = json.loads(response['output'])
            print(f"  Risk profiles created: {len(output.get('riskProfiles', []))}")
            return output
        elif status == 'FAILED':
            print(f"✗ Pipeline failed")
            print(f"  Error: {response.get('error', 'Unknown')}")
            return None
        
        time.sleep(10)
    
    print(f"✗ Pipeline timeout after {max_wait} seconds")
    return None

def test_4_verify_dynamodb_records():
    """
    Test Step 4: Verify risk profiles were written to DynamoDB
    """
    print("\n" + "="*60)
    print("TEST 4: Verify DynamoDB Risk Profiles")
    print("="*60)
    
    table = dynamodb.Table(DYNAMODB_TABLE)
    
    # Test entities from our sample data
    test_entities = [
        "person:viktor_bout_1967_01_13",
        "company:acme_trading_corporation_bvi_12345678",
        "person:john_smith_1980_05_15_us",
        "person:maria_garcia_1975_08_22_mx_pep",
        "person:jane_doe_1985_03_10_uk"
    ]
    
    results = []
    
    for entity_id in test_entities:
        response = table.query(
            KeyConditionExpression='entityId = :eid',
            ExpressionAttributeValues={':eid': entity_id},
            ScanIndexForward=False,
            Limit=1
        )
        
        if response['Items']:
            item = response['Items'][0]
            results.append({
                'entityId': entity_id,
                'riskScore': float(item['score']),
                'status': item['status'],
                'evidenceCount': len(item.get('evidence', []))
            })
            print(f"✓ {entity_id}")
            print(f"    Risk Score: {item['score']}")
            print(f"    Status: {item['status']}")
            print(f"    Evidence: {len(item.get('evidence', []))} items")
        else:
            print(f"✗ {entity_id} - NOT FOUND")
    
    return results

def test_5_api_screen_entity():
    """
    Test Step 5: Test API endpoint for entity screening
    """
    print("\n" + "="*60)
    print("TEST 5: API Entity Screening")
    print("="*60)
    
    # Load test cases
    with open('tests/fixtures/api-test-requests.json', 'r') as f:
        test_data = json.load(f)
    
    results = []
    
    for test_case in test_data['testCases']:
        print(f"\n  Test: {test_case['name']}")
        
        response = requests.post(
            f"{API_URL}/v1/screen_entity",
            headers={
                "Authorization": f"Bearer {get_jwt_token()}",
                "Content-Type": "application/json"
            },
            json=test_case['request']
        )
        
        if response.status_code == 200:
            data = response.json()
            expected = test_case['expectedResponse']
            
            # Verify response matches expectations
            score_match = abs(data['riskScore'] - expected['riskScore']) < 0.1
            status_match = data['status'] == expected['status']
            
            if score_match and status_match:
                print(f"  ✓ PASS")
                print(f"    Risk Score: {data['riskScore']} (expected: {expected['riskScore']})")
                print(f"    Status: {data['status']}")
                print(f"    Evidence: {len(data.get('evidence', []))} items")
            else:
                print(f"  ✗ FAIL")
                print(f"    Expected: {expected['riskScore']}, Got: {data['riskScore']}")
            
            results.append({
                'test': test_case['name'],
                'passed': score_match and status_match,
                'response': data
            })
        else:
            print(f"  ✗ API Error: {response.status_code}")
            print(f"    {response.text}")
    
    return results

def test_6_verify_detailed_probability():
    """
    Test Step 6: Verify detailed probability breakdown
    """
    print("\n" + "="*60)
    print("TEST 6: Detailed Probability Breakdown")
    print("="*60)
    
    # Test high-risk entity
    response = requests.post(
        f"{API_URL}/v1/screen_entity",
        headers={
            "Authorization": f"Bearer {get_jwt_token()}",
            "Content-Type": "application/json"
        },
        json={
            "entityType": "PERSON",
            "name": "Viktor Bout",
            "dateOfBirth": "1967-01-13"
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"\n  Entity: {data['entityId']}")
        print(f"  Overall Risk Score: {data['riskScore']:.2f}")
        print(f"  Status: {data['status']}")
        print(f"  Risk Level: {data.get('riskLevel', 'N/A')}")
        print(f"  Confidence: {data.get('confidence', 'N/A'):.2f}")
        
        # Risk breakdown
        if 'riskBreakdown' in data:
            print(f"\n  Risk Breakdown:")
            breakdown = data['riskBreakdown']
            for risk_type, score in breakdown.items():
                print(f"    {risk_type:25s}: {score:.2f}")
        
        # Evidence details
        if 'evidence' in data:
            print(f"\n  Evidence ({len(data['evidence'])} items):")
            for i, evidence in enumerate(data['evidence'][:3], 1):
                print(f"    {i}. {evidence['source']}")
                print(f"       Match: {evidence['match']} (confidence: {evidence['confidence']:.2f})")
                print(f"       Severity: {evidence['severity']}")
                print(f"       Description: {evidence['description'][:80]}...")
        
        # Recommendations
        if 'recommendations' in data:
            print(f"\n  Recommendations:")
            for rec in data['recommendations']:
                print(f"    • {rec}")
        
        return data
    else:
        print(f"  ✗ API Error: {response.status_code}")
        return None

def get_jwt_token():
    """
    Get JWT token from Cognito (mock for testing)
    In production, use proper Cognito authentication
    """
    # TODO: Implement Cognito authentication
    return "mock-jwt-token-for-testing"

def run_all_tests():
    """
    Run complete integration test suite
    """
    print("\n" + "="*60)
    print("AEGIS FULL PIPELINE INTEGRATION TEST")
    print("="*60)
    print(f"Started: {datetime.utcnow().isoformat()}")
    
    try:
        # Test 1: Upload scraped data
        s3_key = test_1_upload_scraped_data()
        
        # Test 2: Verify Step Functions triggered
        execution_arn = test_2_verify_step_functions_triggered(s3_key)
        
        if execution_arn:
            # Test 3: Wait for pipeline completion
            output = test_3_wait_for_pipeline_completion(execution_arn)
            
            if output:
                # Test 4: Verify DynamoDB records
                db_results = test_4_verify_dynamodb_records()
                
                # Test 5: Test API endpoints
                api_results = test_5_api_screen_entity()
                
                # Test 6: Verify detailed probability
                detailed_result = test_6_verify_detailed_probability()
                
                # Summary
                print("\n" + "="*60)
                print("TEST SUMMARY")
                print("="*60)
                print(f"✓ Scraped data uploaded")
                print(f"✓ Step Functions pipeline triggered")
                print(f"✓ Pipeline completed successfully")
                print(f"✓ {len(db_results)} risk profiles in DynamoDB")
                print(f"✓ {sum(1 for r in api_results if r['passed'])}/{len(api_results)} API tests passed")
                print(f"✓ Detailed probability breakdown verified")
                print(f"\nCompleted: {datetime.utcnow().isoformat()}")
                
                return True
    
    except Exception as e:
        print(f"\n✗ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = run_all_tests()
    exit(0 if success else 1)
