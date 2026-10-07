import { App } from 'aws-cdk-lib';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CvStack } from '../lib/cv-stack';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const webDist = join(repoRoot, 'packages', 'web', 'dist');
if (!existsSync(join(webDist, 'index.html'))) {
  throw new Error('packages/web/dist がありません。先に npm run build を実行してください。');
}

const app = new App();
const context = (key: string): string | undefined => {
  const value: unknown = app.node.tryGetContext(key);
  return typeof value === 'string' && value !== '' ? value : undefined;
};
const number = (key: string): number | undefined => {
  const value = context(key);
  return value === undefined ? undefined : Number(value);
};

new CvStack(app, context('stackName') ?? 'CvStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: context('region') ?? process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
  repoRoot,
  webDist,
  domainName: context('domainName'),
  certificateArn: context('certificateArn'),
  adOrigin: context('adOrigin'),
  throttleRate: number('throttleRate'),
  throttleBurst: number('throttleBurst'),
  description: '履歴書データ化（cv）: CloudFront + S3 + API Gateway + Lambda。履歴書データは保存しない',
});
