import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface ComputeStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
  riskTable: dynamodb.Table;
  rawBucket: s3.Bucket;
  processedBucket: s3.Bucket;
  kmsKey: kms.Key;
}

export class ComputeStack extends cdk.Stack {
  public readonly screenEntityFunction: lambda.Function;
  public readonly getRiskHistoryFunction: lambda.Function;
  public readonly adminThresholdsFunction: lambda.Function;
  public readonly redactionFunction: lambda.Function;
  public readonly fargateCluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // Lambda execution role for API handlers
    const apiLambdaRole = new iam.Role(this, 'ApiLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Least-privilege role for API Lambda functions',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
      ]
    });

    // Grant only Query on RiskProfiles table
    props.riskTable.grantReadData(apiLambdaRole);
    props.kmsKey.grantDecrypt(apiLambdaRole);

    // Lambda: Screen Entity
    this.screenEntityFunction = new lambda.Function(this, 'ScreenEntityFunction', {
      functionName: `aegis-screen-entity-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../services/api/screen-entity'),
      role: apiLambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.securityGroup],
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        RISK_TABLE_NAME: props.riskTable.tableName,
        ENVIRONMENT: props.environment
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // Lambda: Get Risk History
    this.getRiskHistoryFunction = new lambda.Function(this, 'GetRiskHistoryFunction', {
      functionName: `aegis-get-risk-history-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../services/api/get-risk-history'),
      role: apiLambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.securityGroup],
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        RISK_TABLE_NAME: props.riskTable.tableName
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // Lambda: Admin Thresholds (separate role with write access)
    const adminLambdaRole = new iam.Role(this, 'AdminLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
      ]
    });

    props.riskTable.grantReadWriteData(adminLambdaRole);
    props.kmsKey.grant(adminLambdaRole, 'kms:Decrypt', 'kms:Encrypt');

    this.adminThresholdsFunction = new lambda.Function(this, 'AdminThresholdsFunction', {
      functionName: `aegis-admin-thresholds-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../services/api/admin-thresholds'),
      role: adminLambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.securityGroup],
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        RISK_TABLE_NAME: props.riskTable.tableName
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // Lambda: PII Redaction (triggered by Macie findings)
    const redactionRole = new iam.Role(this, 'RedactionLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
      ]
    });

    props.rawBucket.grantReadWrite(redactionRole);
    props.kmsKey.grant(redactionRole, 'kms:Decrypt', 'kms:Encrypt', 'kms:GenerateDataKey');

    this.redactionFunction = new lambda.Function(this, 'RedactionFunction', {
      functionName: `aegis-pii-redaction-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../services/privacy/redaction'),
      role: redactionRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.securityGroup],
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        RAW_BUCKET: props.rawBucket.bucketName
      },
      logRetention: logs.RetentionDays.THREE_MONTHS
    });

    // Lambda Scraper (replaces Fargate - cost-effective)
    const scraperFunction = new lambda.Function(this, 'ScraperFunction', {
      functionName: `aegis-scraper-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../services/ingestion/scraper-lambda'),
      timeout: cdk.Duration.seconds(300), // 5 minutes
      memorySize: 512,
      environment: {
        RAW_BUCKET: props.rawBucket.bucketName,
        ENVIRONMENT: props.environment
      },
      logRetention: logs.RetentionDays.ONE_WEEK
    });

    props.rawBucket.grantPut(scraperFunction);
    props.kmsKey.grantEncrypt(scraperFunction);

    // Schedule scraper to run daily
    new events.Rule(this, 'DailyScraperSchedule', {
      schedule: events.Schedule.cron({ hour: '2', minute: '0' }),
      targets: [new targets.LambdaFunction(scraperFunction)]
    });

    // Keep Fargate cluster for reference (optional, can be removed)
    this.fargateCluster = new ecs.Cluster(this, 'ScraperCluster', {
      clusterName: `aegis-scraper-${props.environment}`,
      vpc: props.vpc,
      containerInsights: false // Disable to save costs
    });

    new cdk.CfnOutput(this, 'ScreenEntityFunctionArn', { 
      value: this.screenEntityFunction.functionArn 
    });
    new cdk.CfnOutput(this, 'FargateClusterName', { 
      value: this.fargateCluster.clusterName 
    });
  }
}
