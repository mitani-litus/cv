import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  aws_apigatewayv2 as apigw,
  aws_apigatewayv2_integrations as integrations,
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_ecr_assets as ecrAssets,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
} from 'aws-cdk-lib';
import type { Construct } from 'constructs';

export interface CvStackProps extends StackProps {
  /** リポジトリのルート（Lambda のコンテナイメージのビルドに使う） */
  repoRoot: string;
  /** ビルド済みの画面（packages/web/dist） */
  webDist: string;
  /** 独自ドメイン（任意）。指定する場合は us-east-1 の ACM 証明書も必要 */
  domainName?: string | undefined;
  certificateArn?: string | undefined;
  /** 広告ページのオリジン（任意、例: https://ads.example.com）。CSP の frame-src に加える */
  adOrigin?: string | undefined;
  /** API のスロットリング（1秒あたりのリクエスト数と、瞬間的な上限） */
  throttleRate?: number | undefined;
  throttleBurst?: number | undefined;
}

/** ログの保存期間。ログには個人情報を出さないが、長く残す必要もない */
const LOG_RETENTION = logs.RetentionDays.ONE_MONTH;

/**
 * 画面（S3）と PDF生成API（API Gateway → Lambda）を、同じ CloudFront の下に置く。
 * - 同一オリジンになるため CORS の設定は不要（Access-Control-Allow-Origin を返さない）
 * - 履歴書データを保存するデータベースやストレージは作らない
 */
export class CvStack extends Stack {
  constructor(scope: Construct, id: string, props: CvStackProps) {
    super(scope, id, props);

    // ---------- 画面の置き場所（非公開の S3。CloudFront からだけ読める） ----------
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      // 画面のファイルしか置かないが、誤って消さないよう残す（削除は手動）
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // ---------- PDF生成API（Lambda コンテナイメージ） ----------
    const apiLogGroup = new logs.LogGroup(this, 'PdfFunctionLogs', {
      retention: LOG_RETENTION,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const pdfFunction = new lambda.DockerImageFunction(this, 'PdfFunction', {
      code: lambda.DockerImageCode.fromImageAsset(props.repoRoot, {
        file: 'docker/api.Dockerfile',
        platform: ecrAssets.Platform.LINUX_AMD64,
      }),
      architecture: lambda.Architecture.X86_64,
      memorySize: 1024,
      timeout: Duration.seconds(15),
      logGroup: apiLogGroup,
      // 実行ロールは CloudWatch Logs への書き込みだけ（S3 や DB などの権限は付けない）
      description: 'Generates a resume PDF from JSON. Stores nothing.',
    });

    // ---------- API Gateway（HTTP API） ----------
    const accessLogs = new logs.LogGroup(this, 'ApiAccessLogs', {
      retention: LOG_RETENTION,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const httpApi = new apigw.HttpApi(this, 'HttpApi', {
      description: 'Resume PDF API (served through CloudFront)',
      createDefaultStage: false,
      // CORS は設定しない（同一オリジンから呼ぶため）
    });
    httpApi.addRoutes({
      path: '/api/pdf',
      methods: [apigw.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('PdfIntegration', pdfFunction, {
        payloadFormatVersion: apigw.PayloadFormatVersion.VERSION_2_0,
      }),
    });
    const stage = new apigw.HttpStage(this, 'DefaultStage', {
      httpApi,
      autoDeploy: true,
      throttle: {
        rateLimit: props.throttleRate ?? 5,
        burstLimit: props.throttleBurst ?? 10,
      },
    });
    // アクセスログ。HTTP API のアクセスログに本文（履歴書データ）は含まれない。
    // 送信元IPなども記録しない項目だけにする
    const cfnStage = stage.node.defaultChild as apigw.CfnStage;
    cfnStage.accessLogSettings = {
      destinationArn: accessLogs.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        requestTime: '$context.requestTime',
        routeKey: '$context.routeKey',
        status: '$context.status',
        responseLength: '$context.responseLength',
        integrationLatency: '$context.integrationLatency',
      }),
    };

    // ---------- CloudFront ----------
    const frameSrc = props.adOrigin ? props.adOrigin : "'none'";
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "worker-src 'self'",
      `frame-src ${frameSrc}`,
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; ');

    const securityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      comment: 'Security headers for the resume service',
      securityHeadersBehavior: {
        contentSecurityPolicy: { contentSecurityPolicy: csp, override: true },
        strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: true, override: true },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.NO_REFERRER, override: true },
      },
      customHeadersBehavior: {
        customHeaders: [
          { header: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()', override: true },
          { header: 'Cross-Origin-Opener-Policy', value: 'same-origin', override: true },
        ],
      },
    });

    // /form や /import などの画面のURLは index.html を返す（拡張子のないパスだけ）
    const spaRewrite = new cloudfront.Function(this, 'SpaRewrite', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  if (!request.uri.includes('.')) {
    request.uri = '/index.html';
  }
  return request;
}`),
    });

    const certificate = props.certificateArn
      ? acm.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn)
      : undefined;

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'Resume data service',
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // 独自ドメインのときは TLS 1.2 以上に限る（CloudFront 既定の証明書では設定できない）
      ...(props.domainName && certificate
        ? { domainNames: [props.domainName], certificate, minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021 }
        : {}),
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: securityHeaders,
        functionAssociations: [{ function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(`${httpApi.apiId}.execute-api.${this.region}.${this.urlSuffix}`, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          // PDF はリクエストごとに作り、どこにもキャッシュしない
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          // Origin と Content-Type を API に渡す（Host は API Gateway のものを使う）
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: securityHeaders,
        },
      },
      // アクセスログ（IPアドレスなど）は記録しない
      enableLogging: false,
    });

    // Lambda が受け付ける Origin（画面のURL）。
    // Lambda → Distribution → HttpApi の順に依存し、Distribution は Lambda に依存しないので循環しない
    const allowedOrigins = [`https://${distribution.distributionDomainName}`];
    if (props.domainName) allowedOrigins.push(`https://${props.domainName}`);
    pdfFunction.addEnvironment('ALLOWED_ORIGINS', allowedOrigins.join(','));

    // ---------- 画面のファイルを S3 に置き、CloudFront のキャッシュを消す ----------
    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [s3deploy.Source.asset(props.webDist)],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
      prune: true,
      memoryLimit: 512,
      logGroup: new logs.LogGroup(this, 'DeploySiteLogs', { retention: LOG_RETENTION, removalPolicy: RemovalPolicy.DESTROY }),
    });

    new CfnOutput(this, 'SiteUrl', {
      value: props.domainName ? `https://${props.domainName}` : `https://${distribution.distributionDomainName}`,
      description: 'Resume service URL',
    });
    new CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName });
  }
}
