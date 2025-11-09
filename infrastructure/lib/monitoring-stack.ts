import * as cdk from 'aws-cdk-lib';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as macie from 'aws-cdk-lib/aws-macie';
import * as guardduty from 'aws-cdk-lib/aws-guardduty';
import { Construct } from 'constructs';

interface MonitoringStackProps extends cdk.StackProps {
  environment: string;
  api: apigateway.RestApi;
  riskTable: dynamodb.Table;
  rawBucket: s3.Bucket;
  processedBucket: s3.Bucket;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // CloudTrail audit logs (immutable)
    const trailBucket = new s3.Bucket(this, 'CloudTrailBucket', {
      bucketName: `aegis-cloudtrail-${props.environment}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      objectLockEnabled: true,
      objectLockDefaultRetention: {
        mode: s3.ObjectLockRetentionMode.GOVERNANCE,
        duration: cdk.Duration.days(365)
      },
      lifecycleRules: [
        {
          id: 'ArchiveOldLogs',
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90)
            }
          ]
        }
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    const trail = new cloudtrail.Trail(this, 'AegisTrail', {
      trailName: `aegis-trail-${props.environment}`,
      bucket: trailBucket,
      includeGlobalServiceEvents: true,
      isMultiRegionTrail: true,
      enableFileValidation: true,
      sendToCloudWatchLogs: true
    });

    // SNS topic for security alerts
    const alertTopic = new sns.Topic(this, 'SecurityAlertTopic', {
      topicName: `aegis-security-alerts-${props.environment}`,
      displayName: 'AEGIS Security Alerts'
    });

    // CloudWatch Alarms

    // 1. Root account login
    const rootLoginMetric = new cloudwatch.Metric({
      namespace: 'CloudTrailMetrics',
      metricName: 'RootAccountLogin',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5)
    });

    new cloudwatch.Alarm(this, 'RootLoginAlarm', {
      alarmName: `aegis-root-login-${props.environment}`,
      metric: rootLoginMetric,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    }).addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));

    // 2. IAM policy changes
    const iamChangeMetric = new cloudwatch.Metric({
      namespace: 'CloudTrailMetrics',
      metricName: 'IAMPolicyChanges',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5)
    });

    new cloudwatch.Alarm(this, 'IAMChangeAlarm', {
      alarmName: `aegis-iam-changes-${props.environment}`,
      metric: iamChangeMetric,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
    }).addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));

    // 3. API Gateway 5xx errors
    const api5xxMetric = props.api.metricServerError({
      period: cdk.Duration.minutes(5),
      statistic: 'Sum'
    });

    new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      alarmName: `aegis-api-5xx-${props.environment}`,
      metric: api5xxMetric,
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
    }).addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));

    // 4. DynamoDB throttling
    const dynamoThrottleMetric = props.riskTable.metricUserErrors({
      period: cdk.Duration.minutes(5),
      statistic: 'Sum'
    });

    new cloudwatch.Alarm(this, 'DynamoThrottleAlarm', {
      alarmName: `aegis-dynamo-throttle-${props.environment}`,
      metric: dynamoThrottleMetric,
      threshold: 5,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
    }).addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));

    // GuardDuty (threat detection)
    new guardduty.CfnDetector(this, 'GuardDutyDetector', {
      enable: true,
      findingPublishingFrequency: 'FIFTEEN_MINUTES'
    });

    // Macie (PII detection on S3)
    const macieSession = new macie.CfnSession(this, 'MacieSession', {
      status: 'ENABLED',
      findingPublishingFrequency: 'FIFTEEN_MINUTES'
    });

    new cdk.CfnOutput(this, 'CloudTrailBucket', { value: trailBucket.bucketName });
    new cdk.CfnOutput(this, 'AlertTopicArn', { value: alertTopic.topicArn });
  }
}
