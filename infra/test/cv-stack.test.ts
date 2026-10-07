import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CvStack, type CvStackProps } from '../lib/cv-stack';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function synth(props: Partial<CvStackProps> = {}) {
  const webDist = mkdtempSync(join(tmpdir(), 'cv-web-'));
  writeFileSync(join(webDist, 'index.html'), '<!doctype html><title>test</title>');
  const app = new App();
  const stack = new CvStack(app, 'TestStack', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
    repoRoot,
    webDist,
    ...props,
  });
  return Template.fromStack(stack);
}

type Resource = { Type: string; Properties?: Record<string, unknown> };

describe('CvStack', () => {
  const template = synth();
  const resources = template.toJSON().Resources as Record<string, Resource>;
  const json = JSON.stringify(template.toJSON());

  it('履歴書データを保存するデータベースやストレージを作らない', () => {
    const types = new Set(Object.values(resources).map((r) => r.Type));
    for (const type of types) {
      expect(type).not.toMatch(/DynamoDB|RDS|DocDB|ElastiCache|EFS|Neptune|Kinesis|SQS|SNS|Firehose|OpenSearch|Elasticsearch/);
    }
    // S3 バケットは画面のファイル用の1つだけ
    template.resourceCountIs('AWS::S3::Bucket', 1);
  });

  it('画面用の S3 バケットは非公開で、HTTPS 以外を拒否する', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Effect: 'Deny', Condition: { Bool: { 'aws:SecureTransport': 'false' } } }),
        ]),
      },
    });
  });

  it('PDF生成の Lambda はコンテナイメージで、Origin の許可リストを持つ', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      PackageType: 'Image',
      Architectures: ['x86_64'],
      Environment: { Variables: { ALLOWED_ORIGINS: Match.anyValue() } },
    });
  });

  it('PDF生成の Lambda の権限は、ログの書き込みだけ', () => {
    const [fnId] = Object.entries(resources).find(([, r]) => r.Type === 'AWS::Lambda::Function' && r.Properties?.PackageType === 'Image')!;
    const fn = resources[fnId]!;
    const roleId = ((fn.Properties!.Role as { 'Fn::GetAtt': string[] })['Fn::GetAtt'])[0]!;
    const role = resources[roleId]!;
    expect(JSON.stringify(role.Properties!.ManagedPolicyArns)).toContain('AWSLambdaBasicExecutionRole');
    expect((role.Properties!.ManagedPolicyArns as unknown[]).length).toBe(1);
    // ロールに付く追加のポリシー（あれば）も logs の操作だけ
    const policies = Object.values(resources).filter(
      (r) => r.Type === 'AWS::IAM::Policy' && JSON.stringify(r.Properties!.Roles).includes(roleId),
    );
    for (const policy of policies) {
      const statements = (policy.Properties!.PolicyDocument as { Statement: { Action: string | string[] }[] }).Statement;
      for (const s of statements) {
        for (const action of [s.Action].flat()) expect(action).toMatch(/^logs:/);
      }
    }
  });

  it('API に CORS を設定しない', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', { CorsConfiguration: Match.absent() });
    expect(json).not.toContain('AccessControlAllowOrigins');
    expect(json).not.toContain('Access-Control-Allow-Origin');
  });

  it('API はスロットリングし、アクセスログに送信元IPや本文を残さない', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 },
      AccessLogSettings: { Format: Match.stringLikeRegexp('requestId') },
    });
    const stage = Object.values(resources).find((r) => r.Type === 'AWS::ApiGatewayV2::Stage')!;
    const format = (stage.Properties!.AccessLogSettings as { Format: string }).Format;
    expect(format).not.toMatch(/sourceIp|userAgent|requestBody|body/i);
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: 'POST /api/pdf' });
  });

  it('CloudFront は HTTPS にそろえ、/api/* はキャッシュしない。アクセスログは記録しない', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
        CacheBehaviors: [
          Match.objectLike({
            PathPattern: '/api/*',
            ViewerProtocolPolicy: 'https-only',
            // CachingDisabled のマネージドポリシー
            CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
          }),
        ],
        Logging: Match.absent(),
      }),
    });
  });

  it('セキュリティヘッダーと CSP を付ける', () => {
    template.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: Match.objectLike({
        SecurityHeadersConfig: Match.objectLike({
          ContentSecurityPolicy: {
            ContentSecurityPolicy: Match.stringLikeRegexp("frame-ancestors 'none'"),
            Override: true,
          },
          StrictTransportSecurity: Match.objectLike({ AccessControlMaxAgeSec: 31536000 }),
          FrameOptions: { FrameOption: 'DENY', Override: true },
          ReferrerPolicy: { ReferrerPolicy: 'no-referrer', Override: true },
        }),
      }),
    });
    expect(json).toContain("frame-src 'none'");
    expect(json).toContain("script-src 'self'");
  });

  it('広告のオリジンを指定すると、CSP の frame-src に加える', () => {
    const t = JSON.stringify(synth({ adOrigin: 'https://ads.example.com' }).toJSON());
    expect(t).toContain('frame-src https://ads.example.com');
  });

  it('画面のURL（拡張子なし）は index.html を返し、ファイルはそのまま返す', () => {
    const fn = Object.values(resources).find((r) => r.Type === 'AWS::CloudFront::Function')!;
    const code = fn.Properties!.FunctionCode as string;
    const handler = new Function(`${code}; return handler;`)() as (e: { request: { uri: string } }) => { uri: string };
    expect(handler({ request: { uri: '/form' } }).uri).toBe('/index.html');
    expect(handler({ request: { uri: '/import' } }).uri).toBe('/index.html');
    expect(handler({ request: { uri: '/' } }).uri).toBe('/index.html');
    expect(handler({ request: { uri: '/assets/index-abc.js' } }).uri).toBe('/assets/index-abc.js');
  });

  it('独自ドメインを指定すると、Origin の許可リストにも加える', () => {
    const t = synth({ domainName: 'cv.example.jp', certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/abc' });
    t.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ Aliases: ['cv.example.jp'] }),
    });
    expect(JSON.stringify(t.toJSON())).toContain('https://cv.example.jp');
  });
});
