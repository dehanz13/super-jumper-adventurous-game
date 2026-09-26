import { describe, expect, it } from 'vitest';
import { App, assertions } from 'aws-cdk-lib';
import { StaticSiteStack } from '../infra/static-site-stack.js';

function template() {
  const app = new App();
  const stack = new StaticSiteStack(app, 'TestNovaStaticSite', {
    env: { account: '123456789012', region: 'us-east-1' },
  });
  return assertions.Template.fromStack(stack);
}

describe('standalone static hosting infrastructure', () => {
  it('keeps the versioned asset bucket private and retained', () => {
    const cfn = template();
    cfn.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: { ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }] },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true, BlockPublicPolicy: true,
        IgnorePublicAcls: true, RestrictPublicBuckets: true,
      },
      VersioningConfiguration: { Status: 'Enabled' },
      OwnershipControls: { Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }] },
    });
    const bucket = Object.values(cfn.findResources('AWS::S3::Bucket'))[0];
    expect(bucket).toMatchObject({ DeletionPolicy: 'Retain', UpdateReplacePolicy: 'Retain' });
    expect(JSON.stringify(bucket)).not.toContain('WebsiteConfiguration');
  });

  it('uses signed CloudFront origin access, HTTPS, and separate HTML and asset caching', () => {
    const cfn = template();
    cfn.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
      OriginAccessControlConfig: { OriginAccessControlOriginType: 's3', SigningBehavior: 'always' },
    });
    cfn.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultRootObject: 'index.html',
        DefaultCacheBehavior: {
          ViewerProtocolPolicy: 'redirect-to-https',
          CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
        },
        CacheBehaviors: [{
          PathPattern: 'assets/*',
          ViewerProtocolPolicy: 'redirect-to-https',
          CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
        }],
      },
    });
    const policy = JSON.stringify(cfn.findResources('AWS::S3::BucketPolicy'));
    expect(policy).toContain('cloudfront.amazonaws.com');
    expect(policy).toContain('AWS:SourceArn');
  });

  it('requires an exact HTTPS embed origin and omits a conflicting frame-options header', () => {
    const cfn = template().toJSON();
    expect(cfn.Parameters.HearsoEmbedOrigin.AllowedPattern).toBe('https://[A-Za-z0-9.-]+(:[0-9]+)?');
    const policy = Object.values(cfn.Resources).find((resource: any) => resource.Type === 'AWS::CloudFront::ResponseHeadersPolicy') as any;
    const headers = policy.Properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig;
    expect(JSON.stringify(headers.ContentSecurityPolicy.ContentSecurityPolicy)).toContain('frame-ancestors');
    expect(JSON.stringify(headers.ContentSecurityPolicy.ContentSecurityPolicy)).toContain('HearsoEmbedOrigin');
    expect(headers.FrameOptions).toBeUndefined();
    expect(headers.ContentTypeOptions.Override).toBe(true);
  });
});
