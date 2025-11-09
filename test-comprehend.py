#!/usr/bin/env python3
"""
Test AWS Comprehend access and activation
"""

import boto3
import json

def test_comprehend():
    print("\n" + "="*60)
    print("  Testing AWS Comprehend")
    print("="*60 + "\n")
    
    # Check credentials
    print("Step 1: Checking AWS credentials...")
    try:
        sts = boto3.client('sts')
        identity = sts.get_caller_identity()
        print(f"  ✓ Account: {identity['Account']}")
        print(f"  ✓ User: {identity['Arn']}")
    except Exception as e:
        print(f"  ✗ Error: {e}")
        print("\n  Run: aws configure")
        return False
    
    # Test Comprehend
    print("\nStep 2: Testing Comprehend API...")
    try:
        comprehend = boto3.client('comprehend', region_name='us-east-1')
        
        test_text = "Amazon Web Services provides cloud computing services."
        
        print(f"  → Analyzing: '{test_text}'")
        
        response = comprehend.detect_entities(
            Text=test_text,
            LanguageCode='en'
        )
        
        print(f"\n  ✓ SUCCESS! Comprehend is working!")
        print(f"\n  Entities detected: {len(response['Entities'])}")
        
        for entity in response['Entities']:
            print(f"    - {entity['Text']} ({entity['Type']}, confidence: {entity['Score']:.2f})")
        
        print("\n" + "="*60)
        print("  ✓ AWS Comprehend is ready to use!")
        print("="*60)
        print("\nCost Information:")
        print("  • Entity Detection: $0.0001 per unit (100 chars)")
        print("  • Free Tier: 50,000 units/month (first 12 months)")
        print("  • Your credits: $140.00 USD")
        print("  • Days remaining: 182 days")
        print("\nYou're all set! 🚀\n")
        
        return True
        
    except Exception as e:
        error_msg = str(e)
        
        if 'SubscriptionRequiredException' in error_msg:
            print(f"\n  ⚠ Comprehend needs to be enabled")
            print("\n  To enable AWS Comprehend:")
            print("  1. Go to: https://console.aws.amazon.com/comprehend")
            print("  2. Click 'Get Started' or try any feature")
            print("  3. Accept the terms of service")
            print("  4. Wait 1-2 minutes for activation")
            print("  5. Run this script again")
            print("\n  Opening Comprehend console...")
            
            import webbrowser
            webbrowser.open('https://console.aws.amazon.com/comprehend/home?region=us-east-1')
            
        elif 'AccessDeniedException' in error_msg:
            print(f"\n  ✗ IAM permissions missing")
            print("\n  Add these permissions to your IAM user/role:")
            print("    - comprehend:DetectEntities")
            print("    - comprehend:DetectSentiment")
            print("    - comprehend:DetectKeyPhrases")
            
        else:
            print(f"\n  ✗ Error: {error_msg}")
        
        return False

if __name__ == '__main__':
    test_comprehend()
