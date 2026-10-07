import type { Resume } from '@cv/schema';
import { useEffect, useRef } from 'react';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { downloadBlob, FILE_NAMES } from '../lib/download';
import { downloadCsv, downloadJson } from '../lib/files';

export function CompletePage({ resume, pdf }: { resume: Resume; pdf: Blob }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titleRef.current?.focus(), []);

  return (
    <Page>
      <div className="app-main" style={{ paddingTop: 64 }}>
        <div className="app-narrow">
          <div className="app-card" style={{ padding: '56px 40px 40px' }}>
            <div className="app-done">
              <div className="app-done__mark">
                <Icon name="check" label="作成済み" />
              </div>
              <h1 className="app-title" style={{ fontSize: '2.25rem', lineHeight: 1.4 }} tabIndex={-1} ref={titleRef}>
                履歴書を作成しました
              </h1>
              <p className="app-lead">
                入力した内容から、履歴書のPDFとCSVを作成しました。
                <br />
                下のボタンから、お使いの端末に保存してください。
              </p>
            </div>

            <div className="app-downloads">
              <button className="bb-button" data-type="solid-fill" data-size="lg" type="button" onClick={() => downloadBlob(pdf, FILE_NAMES.pdf)}>
                <Icon name="download" />
                PDFをダウンロード
              </button>
              <p className="app-dlnote">履歴書（PDF）— 採用担当者に送る・印刷する</p>
              <button className="bb-button" data-type="outline" data-size="lg" type="button" onClick={() => downloadCsv(resume)}>
                <Icon name="download" />
                CSVをダウンロード
              </button>
              <p className="app-dlnote">履歴書データ（CSV）— PDFと一緒に採用担当者に送る</p>
              <button className="bb-button" data-type="text" data-size="md" type="button" style={{ justifySelf: 'center' }} onClick={() => downloadJson(resume)}>
                JSONをダウンロード（入力データの保存用）
              </button>
            </div>

            <div className="app-actions" style={{ display: 'grid', gap: 24, justifyContent: 'stretch' }}>
              <h2 className="app-h3">次にすること</h2>
              <ol className="app-next">
                <li>
                  <span>PDFとCSVを、メールなどに添付して採用担当者に送ってください。このサービスから送信されることはありません。</span>
                </li>
                <li>
                  <span>JSONファイルを保存しておくと、次に履歴書を作るときに読み込んで、続きから編集できます。</span>
                </li>
                <li>
                  <span>保存が終わったら、このページを閉じて構いません。閉じると、入力した内容はこの端末からも消えます。</span>
                </li>
              </ol>
            </div>
          </div>

          <div className="app-local" style={{ justifyContent: 'flex-start' }}>
            <p className="app-local__text">
              <Icon name="shield" />
              <span>このサービスでは、履歴書情報を原則として保存していません。PDFの作成に必要な処理を行った後、入力データは保持しない設計になっています。</span>
            </p>
          </div>
        </div>
      </div>
    </Page>
  );
}
