#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { SecurityStack } from '../lib/security-stack';
import { DataStack } from '../lib/data-stack';
import { ComputeStack } from '../lib/compute-stack';
import { PipelineStackComprehend } from '../lib/pipeline-stack-comprehend';
import { ApiStack } from '../lib/api-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

const app = new cdk.App();
const env = app.node.tryGetContext('env') || 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

const stackProps = {
  env: { account, region },
  tags: {
    Environment: env,
    Project: 'AEGIS',
    ManagedBy: 'CDK'
  }
};

// 1. Network foundation
const networkStack = new NetworkStack(app, `Aegis-Network-${env}`, {
  ...stackProps,
  environment: env
});

// 2. Security primitives (KMS, IAM, Cognito, WAF)
const securityStack = new SecurityStack(app, `Aegis-Security-${env}`, {
  ...stackProps,
  environment: env,
  vpc: networkStack.vpc
});

// 3. Data layer (DynamoDB, S3)
const dataStack = new DataStack(app, `Aegis-Data-${env}`, {
  ...stackProps,
  environment: env,
  kmsKey: securityStack.dataKmsKey
});

// 4. Compute (Lambda, Fargate, SageMaker)
const computeStack = new ComputeStack(app, `Aegis-Compute-${env}`, {
  ...stackProps,
  environment: env,
  vpc: networkStack.vpc,
  securityGroup: networkStack.privateSecurityGroup,
  riskTable: dataStack.riskTable,
  rawBucket: dataStack.rawBucket,
  processedBucket: dataStack.processedBucket,
  kmsKey: securityStack.dataKmsKey
});

// 4b. NLP Pipeline (Step Functions + AWS Comprehend - no SageMaker quota needed!)
const pipelineStack = new PipelineStackComprehend(app, `Aegis-Pipeline-${env}`, {
  ...stackProps,
  environment: env,
  vpc: networkStack.vpc,
  securityGroup: networkStack.privateSecurityGroup,
  rawBucket: dataStack.rawBucket,
  processedBucket: dataStack.processedBucket,
  riskTable: dataStack.riskTable,
  kmsKey: securityStack.dataKmsKey
});

// 5. API Gateway
const apiStack = new ApiStack(app, `Aegis-Api-${env}`, {
  ...stackProps,
  environment: env,
  screenEntityFunction: computeStack.screenEntityFunction,
  getRiskHistoryFunction: computeStack.getRiskHistoryFunction,
  adminThresholdsFunction: computeStack.adminThresholdsFunction,
  userPool: securityStack.userPool,
  wafAcl: securityStack.wafAcl
});

// 6. Monitoring & compliance
const monitoringStack = new MonitoringStack(app, `Aegis-Monitoring-${env}`, {
  ...stackProps,
  environment: env,
  api: apiStack.api,
  riskTable: dataStack.riskTable,
  rawBucket: dataStack.rawBucket,
  processedBucket: dataStack.processedBucket
});

app.synth();
