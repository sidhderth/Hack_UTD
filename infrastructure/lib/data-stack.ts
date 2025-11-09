import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

interface DataStackProps extends cdk.StackProps {
  environment: string;
  kmsKey: kms.Key;
}

export class DataStack extends cdk.Stack {
  public readonly riskTable: dynamodb.Table;
  public readonly rawBucket: s3.Bucket;
  public readonly processedBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    // DynamoDB: RiskProfiles table
    this.riskTable = new dynamodb.Table(this, 'RiskProfiles', {
      tableName: `aegis-risk-profiles-${props.environment}`,
      partitionKey: { name: 'entityId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'asOfTs', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.kmsKey,
      pointInTimeRecovery: true,
      removalPolicy: props.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY
    });

    // GSI for name lookups
    this.riskTable.addGlobalSecondaryIndex({
      indexName: 'NameIndex',
      partitionKey: { name: 'name', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'asOfTs', type: dynamodb.AttributeType.NUMBER }
    });

    // GSI for company lookups
    this.riskTable.addGlobalSecondaryIndex({
      indexName: 'CompanyIndex',
      partitionKey: { name: 'company', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'asOfTs', type: dynamodb.AttributeType.NUMBER }
    });

    // S3: Raw data bucket
    this.rawBucket = new s3.Bucket(this, 'RawDataBucket', {
      bucketName: `aegis-raw-data-${props.environment}-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: true,
      lifecycleRules: [
        {
          id: 'ArchiveOldData',
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(90)
            }
          ]
        }
      ],
      removalPolicy: props.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environment !== 'prod'
    });

    // S3: Processed data bucket
    this.processedBucket = new s3.Bucket(this, 'ProcessedDataBucket', {
      bucketName: `aegis-processed-${props.environment}-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: true,
      removalPolicy: props.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environment !== 'prod'
    });

    new cdk.CfnOutput(this, 'RiskTableName', { value: this.riskTable.tableName });
    new cdk.CfnOutput(this, 'RawBucketName', { value: this.rawBucket.bucketName });
    new cdk.CfnOutput(this, 'ProcessedBucketName', { value: this.processedBucket.bucketName });
  }
}
