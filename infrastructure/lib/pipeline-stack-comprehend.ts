import * as cdk from 'aws-cdk-lib';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface PipelineStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
  rawBucket: s3.Bucket;
  processedBucket: s3.Bucket;
  riskTable: dynamodb.Table;
  kmsKey: kms.Key;
}

export class PipelineStackComprehend extends cdk.Stack {
  public readonly nlpStateMachine: stepfunctions.StateMachine;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // Lambda: NER using AWS Comprehend (no SageMaker needed!)
    const nerFunction = new lambda.Function(this, 'NerFunction', {
      functionName: `aegis-ner-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../services/nlp/ner-comprehend'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        PROCESSED_BUCKET: props.processedBucket.bucketName
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    props.rawBucket.grantRead(nerFunction);
    props.processedBucket.grantWrite(nerFunction);
    props.kmsKey.grantDecrypt(nerFunction);
    props.kmsKey.grantEncrypt(nerFunction);

    // Grant Comprehend permissions
    nerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'comprehend:DetectEntities',
        'comprehend:DetectSentiment',
        'comprehend:DetectKeyPhrases'
      ],
      resources: ['*']
    }));

    // Lambda: Entity Resolution
    const entityResolutionFunction = new lambda.Function(this, 'EntityResolutionFunction', {
      functionName: `aegis-entity-resolution-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../services/nlp/entity-resolution'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        PROCESSED_BUCKET: props.processedBucket.bucketName
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    props.processedBucket.grantReadWrite(entityResolutionFunction);
    props.kmsKey.grantDecrypt(entityResolutionFunction);
    props.kmsKey.grantEncrypt(entityResolutionFunction);

    // Lambda: Risk Scoring
    const riskScoringFunction = new lambda.Function(this, 'RiskScoringFunction', {
      functionName: `aegis-risk-scoring-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../services/nlp/risk-scoring'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        RISK_TABLE_NAME: props.riskTable.tableName
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    props.processedBucket.grantRead(riskScoringFunction);
    props.riskTable.grantWriteData(riskScoringFunction);
    props.kmsKey.grant(riskScoringFunction, 'kms:Decrypt', 'kms:Encrypt', 'kms:GenerateDataKey');

    // EventBridge permissions
    riskScoringFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['events:PutEvents'],
      resources: ['*']
    }));

    // Step Functions State Machine
    const nerTask = new tasks.LambdaInvoke(this, 'NER Task', {
      lambdaFunction: nerFunction,
      outputPath: '$.Payload'
    });

    const entityResolutionTask = new tasks.LambdaInvoke(this, 'Entity Resolution Task', {
      lambdaFunction: entityResolutionFunction,
      outputPath: '$.Payload'
    });

    const riskScoringTask = new tasks.LambdaInvoke(this, 'Risk Scoring Task', {
      lambdaFunction: riskScoringFunction,
      outputPath: '$.Payload'
    });

    const successState = new stepfunctions.Succeed(this, 'Pipeline Success');

    const definition = nerTask
      .next(entityResolutionTask)
      .next(riskScoringTask)
      .next(successState);

    this.nlpStateMachine = new stepfunctions.StateMachine(this, 'NlpPipeline', {
      stateMachineName: `aegis-nlp-pipeline-${props.environment}`,
      definitionBody: stepfunctions.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(15),
      tracingEnabled: true,
      logs: {
        destination: new logs.LogGroup(this, 'NlpPipelineLogGroup', {
          retention: logs.RetentionDays.ONE_MONTH
        }),
        level: stepfunctions.LogLevel.ALL
      }
    });

    // EventBridge Rule: S3 PutObject → Step Functions
    const s3PutObjectRule = new events.Rule(this, 'S3PutObjectRule', {
      ruleName: `aegis-s3-put-object-${props.environment}`,
      description: 'Trigger NLP pipeline on S3 PutObject to raw bucket',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [props.rawBucket.bucketName]
          }
        }
      }
    });

    s3PutObjectRule.addTarget(new targets.SfnStateMachine(this.nlpStateMachine, {
      input: events.RuleTargetInput.fromEventPath('$.detail')
    }));

    // Lambda: Webhook Sender
    const webhookFunction = new lambda.Function(this, 'WebhookFunction', {
      functionName: `aegis-webhook-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../services/webhooks'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ENVIRONMENT: props.environment
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // EventBridge Rule: Risk Updates → Webhook
    const riskUpdateRule = new events.Rule(this, 'RiskUpdateRule', {
      ruleName: `aegis-risk-update-${props.environment}`,
      description: 'Send webhook on risk score changes',
      eventPattern: {
        source: ['aegis.risk'],
        detailType: ['Risk Updated']
      }
    });

    riskUpdateRule.addTarget(new targets.LambdaFunction(webhookFunction));

    new cdk.CfnOutput(this, 'NlpStateMachineArn', { 
      value: this.nlpStateMachine.stateMachineArn 
    });
  }
}
