import {
  CfnOutput, CfnParameter, Duration, RemovalPolicy, Stack, type StackProps,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import type { Construct } from 'constructs';

export class StaticSiteStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const embedOrigin = new CfnParameter(this, 'HearsoEmbedOrigin', {
      type: 'String',
      description: 'Exact HTTPS Hearso origin allowed to embed the game, with no path or trailing slash',
      allowedPattern: 'https://[A-Za-z0-9.-]+(:[0-9]+)?',
    });

    const bucket = new s3.Bucket(this, 'GameAssets', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const headers = new cloudfront.ResponseHeadersPolicy(this, 'GameHeaders', {
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        contentSecurityPolicy: {
          contentSecurityPolicy: `frame-ancestors 'self' ${embedOrigin.valueAsString}; object-src 'none'; base-uri 'self'`,
          override: true,
        },
      },
    });

    const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);
    const distribution = new cloudfront.Distribution(this, 'GameDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        responseHeadersPolicy: headers,
      },
      additionalBehaviors: {
        'assets/*': {
          origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          responseHeadersPolicy: headers,
        },
      },
    });

    new CfnOutput(this, 'AssetBucketName', { value: bucket.bucketName });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'GameUrl', { value: `https://${distribution.distributionDomainName}` });
  }
}
