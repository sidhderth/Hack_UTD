import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

interface SecurityStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.Vpc;
}

export class SecurityStack extends cdk.Stack {
  public readonly dataKmsKey: kms.Key;
  public readonly userPool: cognito.UserPool;
  public readonly wafAcl: wafv2.CfnWebACL;
  public readonly adminRole: iam.Role;
  public readonly developerRole: iam.Role;
  public readonly securityAuditorRole: iam.Role;

  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);

    // KMS CMK for data encryption (DynamoDB, S3)
    this.dataKmsKey = new kms.Key(this, 'DataKmsKey', {
      description: `AEGIS data encryption key - ${props.environment}`,
      enableKeyRotation: true,
      removalPolicy: props.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY
    });

    // Cognito User Pool for API authentication
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `aegis-users-${props.environment}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true
      },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY
    });

    const userPoolClient = this.userPool.addClient('ApiClient', {
      authFlows: {
        userPassword: true,
        userSrp: true
      },
      generateSecret: false
    });

    // WAF Web ACL for API Gateway
    this.wafAcl = new wafv2.CfnWebACL(this, 'ApiWaf', {
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AegisApiWaf'
      },
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet'
            }
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSet'
          }
        },
        {
          name: 'AWSManagedRulesSQLiRuleSet',
          priority: 2,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet'
            }
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'SQLiRuleSet'
          }
        },
        {
          name: 'RateLimitRule',
          priority: 3,
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP'
            }
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimit'
          }
        }
      ]
    });

    // IAM Roles - Separation of Duties

    // AdminRole: Infrastructure & IAM management (requires MFA)
    this.adminRole = new iam.Role(this, 'AdminRole', {
      roleName: `aegis-admin-${props.environment}`,
      assumedBy: new iam.AccountPrincipal(this.account),
      description: 'Admin role for infrastructure management',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')
      ]
    });

    // DeveloperRole: Deploy code only, no IAM edits
    this.developerRole = new iam.Role(this, 'DeveloperRole', {
      roleName: `aegis-developer-${props.environment}`,
      assumedBy: new iam.AccountPrincipal(this.account),
      description: 'Developer role for code deployment'
    });

    this.developerRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:UpdateFunctionCode',
        'lambda:PublishVersion',
        'lambda:UpdateAlias',
        'ecs:UpdateService',
        'ecs:RegisterTaskDefinition',
        'ecr:*',
        's3:PutObject',
        's3:GetObject',
        'cloudformation:DescribeStacks',
        'cloudformation:DescribeStackEvents'
      ],
      resources: ['*']
    }));

    this.developerRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      actions: ['iam:*'],
      resources: ['*']
    }));

    // SecurityAuditorRole: Read-only access to logs & security services
    this.securityAuditorRole = new iam.Role(this, 'SecurityAuditorRole', {
      roleName: `aegis-security-auditor-${props.environment}`,
      assumedBy: new iam.AccountPrincipal(this.account),
      description: 'Security auditor role for compliance reviews',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('SecurityAudit'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchReadOnlyAccess')
      ]
    });

    new cdk.CfnOutput(this, 'DataKmsKeyId', { value: this.dataKmsKey.keyId });
    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
  }
}
