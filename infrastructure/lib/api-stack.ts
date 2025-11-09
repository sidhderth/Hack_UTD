import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  environment: string;
  screenEntityFunction: lambda.Function;
  getRiskHistoryFunction: lambda.Function;
  adminThresholdsFunction: lambda.Function;
  userPool: cognito.UserPool;
  wafAcl: wafv2.CfnWebACL;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [props.userPool]
    });

    // API Gateway with request validation
    this.api = new apigateway.RestApi(this, 'AegisApi', {
      restApiName: `aegis-api-${props.environment}`,
      description: 'AEGIS Risk Intelligence API',
      deployOptions: {
        stageName: props.environment,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        tracingEnabled: true,
        metricsEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(
          new logs.LogGroup(this, 'ApiAccessLogs', {
            retention: logs.RetentionDays.THREE_MONTHS
          })
        ),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields()
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization']
      },
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL]
      }
    });

    // Associate WAF with API Gateway
    new wafv2.CfnWebACLAssociation(this, 'WafAssociation', {
      resourceArn: this.api.deploymentStage.stageArn,
      webAclArn: props.wafAcl.attrArn
    });

    // Request validator for JSON schema validation
    const requestValidator = new apigateway.RequestValidator(this, 'RequestValidator', {
      restApi: this.api,
      validateRequestBody: true,
      validateRequestParameters: true
    });

    // JSON Schema for screen_entity request
    const screenEntityModel = this.api.addModel('ScreenEntityModel', {
      contentType: 'application/json',
      modelName: 'ScreenEntityRequest',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['entityType', 'name'],
        properties: {
          entityType: { 
            type: apigateway.JsonSchemaType.STRING,
            enum: ['PERSON', 'COMPANY']
          },
          name: { type: apigateway.JsonSchemaType.STRING },
          dateOfBirth: { type: apigateway.JsonSchemaType.STRING },
          country: { type: apigateway.JsonSchemaType.STRING }
        }
      }
    });

    // /v1 resource
    const v1 = this.api.root.addResource('v1');

    // POST /v1/screen_entity
    const screenEntity = v1.addResource('screen_entity');
    screenEntity.addMethod('POST', new apigateway.LambdaIntegration(props.screenEntityFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator,
      requestModels: {
        'application/json': screenEntityModel
      }
    });

    // GET /v1/entities/{id}/risk
    const entities = v1.addResource('entities');
    const entityId = entities.addResource('{id}');
    const risk = entityId.addResource('risk');
    risk.addMethod('GET', new apigateway.LambdaIntegration(props.getRiskHistoryFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.path.id': true
      }
    });

    // POST /v1/admin/thresholds (admin-only)
    const admin = v1.addResource('admin');
    const thresholds = admin.addResource('thresholds');
    thresholds.addMethod('POST', new apigateway.LambdaIntegration(props.adminThresholdsFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator
    });

    // Usage plan with throttling
    const usagePlan = this.api.addUsagePlan('UsagePlan', {
      name: `aegis-usage-plan-${props.environment}`,
      throttle: {
        rateLimit: 1000,
        burstLimit: 2000
      },
      quota: {
        limit: 100000,
        period: apigateway.Period.DAY
      }
    });

    usagePlan.addApiStage({
      stage: this.api.deploymentStage
    });

    new cdk.CfnOutput(this, 'ApiUrl', { 
      value: this.api.url,
      description: 'API Gateway endpoint URL'
    });
    new cdk.CfnOutput(this, 'ApiId', { value: this.api.restApiId });
  }
}
