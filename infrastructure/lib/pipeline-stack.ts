import * as cdk from 'aws-cdk-lib';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
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

export class PipelineStack extends cdk.Stack {
  public readonly nlpStateMachine: stepfunctions.StateMachine;
  public readonly sagemakerEndpoint: sagemaker.CfnEndpoint;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // SageMaker Execution Role (private VPC)
    const sagemakerRole = new iam.Role(this, 'SageMakerRole', {
      assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
      description: 'SageMaker role for NLP models'
    });

    props.rawBucket.grantRead(sagemakerRole);
    props.processedBucket.grantReadWrite(sagemakerRole);
    props.kmsKey.grantDecrypt(sagemakerRole);
    props.kmsKey.grantEncrypt(sagemakerRole);

    // SageMaker Model (placeholder - replace with actual model)
    const model = new sagemaker.CfnModel(this, 'NlpModel', {
      executionRoleArn: sagemakerRole.roleArn,
      primaryContainer: {
        image: '763104351884.dkr.ecr.us-east-1.amazonaws.com/huggingface-pytorch-inference:1.13.1-transformers4.26.0-cpu-py39-ubuntu20.04',
        modelDataUrl: `s3://${props.processedBucket.bucketName}/models/ner-model.tar.gz`,
        environment: {
          SAGEMAKER_PROGRAM: 'inference.py',
          SAGEMAKER_SUBMIT_DIRECTORY: '/opt/ml/model/code'
        }
      },
      vpcConfig: {
        subnets: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds,
        securityGroupIds: [props.securityGroup.securityGroupId]
      }
    });

    // SageMaker Endpoint Config (no public access)
    const endpointConfig = new sagemaker.CfnEndpointConfig(this, 'NlpEndpointConfig', {
      productionVariants: [{
        modelName: model.attrModelName,
        variantName: 'AllTraffic',
        initialInstanceCount: 1,
        instanceType: 'ml.m5.large',
        initialVariantWeight: 1.0
      }]
    });

    endpointConfig.addDependency(model);

    // SageMaker Endpoint
    this.sagemakerEndpoint = new sagemaker.CfnEndpoint(this, 'NlpEndpoint', {
      endpointConfigName: endpointConfig.attrEndpointConfigName,
      endpointName: `aegis-nlp-${props.environment}`
    });

    this.sagemakerEndpoint.addDependency(endpointConfig);

    // Lambda: NER (Named Entity Recognition)
    const nerFunction = new lambda.Function(this, 'NerFunction', {
      functionName: `aegis-ner-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../services/nlp/ner'),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.securityGroup],
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        SAGEMAKER_ENDPOINT: this.sagemakerEndpoint.endpointName!,
        PROCESSED_BUCKET: props.processedBucket.bucketName
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    props.rawBucket.grantRead(nerFunction);
    props.processedBucket.grantWrite(nerFunction);
    props.kmsKey.grantDecrypt(nerFunction);
    props.kmsKey.grantEncrypt(nerFunction);

    nerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sagemaker:InvokeEndpoint'],
      resources: [this.sagemakerEndpoint.ref]
    }));

    // Lambda: Entity Resolution (disambiguation)
    const entityResolutionFunction = new lambda.Function(this, 'EntityResolutionFunction', {
      functionName: `aegis-entity-resolution-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../services/nlp/entity-resolution'),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.securityGroup],
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        SAGEMAKER_ENDPOINT: this.sagemakerEndpoint.endpointName!,
        PROCESSED_BUCKET: props.processedBucket.bucketName
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    props.processedBucket.grantReadWrite(entityResolutionFunction);
    props.kmsKey.grantDecrypt(entityResolutionFunction);
    props.kmsKey.grantEncrypt(entityResolutionFunction);

    entityResolutionFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sagemaker:InvokeEndpoint'],
      resources: [this.sagemakerEndpoint.ref]
    }));

    // Lambda: Risk Scoring
    const riskScoringFunction = new lambda.Function(this, 'RiskScoringFunction', {
      functionName: `aegis-risk-scoring-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../services/nlp/risk-scoring'),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.securityGroup],
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        SAGEMAKER_ENDPOINT: this.sagemakerEndpoint.endpointName!,
        RISK_TABLE_NAME: props.riskTable.tableName
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    props.processedBucket.grantRead(riskScoringFunction);
    props.riskTable.grantWriteData(riskScoringFunction);
    props.kmsKey.grant(riskScoringFunction, 'kms:Decrypt', 'kms:Encrypt', 'kms:GenerateDataKey');

    riskScoringFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sagemaker:InvokeEndpoint'],
      resources: [this.sagemakerEndpoint.ref]
    }));

    // Step Functions State Machine: NLP Pipeline
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
    const failState = new stepfunctions.Fail(this, 'Pipeline Failed', {
      cause: 'NLP pipeline failed',
      error: 'PipelineError'
    });

    // Define pipeline: NER → Entity Resolution → Risk Scoring
    const definition = nerTask
      .next(entityResolutionTask)
      .next(riskScoringTask)
      .next(successState)
      .addCatch(failState, {
        resultPath: '$.error'
      });

    this.nlpStateMachine = new stepfunctions.StateMachine(this, 'NlpPipeline', {
      stateMachineName: `aegis-nlp-pipeline-${props.environment}`,
      definition,
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

    // EventBridge Rule: Risk Updates → Webhook
    const riskUpdateRule = new events.Rule(this, 'RiskUpdateRule', {
      ruleName: `aegis-risk-update-${props.environment}`,
      description: 'Send webhook on risk score changes',
      eventPattern: {
        source: ['aegis.risk'],
        detailType: ['Risk Updated']
      }
    });

    // Lambda: Webhook Sender
    const webhookFunction = new lambda.Function(this, 'WebhookFunction', {
      functionName: `aegis-webhook-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../services/webhooks'),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.securityGroup],
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ENVIRONMENT: props.environment
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    riskUpdateRule.addTarget(new targets.LambdaFunction(webhookFunction));

    new cdk.CfnOutput(this, 'NlpStateMachineArn', { 
      value: this.nlpStateMachine.stateMachineArn 
    });
    new cdk.CfnOutput(this, 'SageMakerEndpointName', { 
      value: this.sagemakerEndpoint.endpointName! 
    });
  }
}
