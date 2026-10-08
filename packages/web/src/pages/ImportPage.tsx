import { formatDateJa, formatName, formatNameKana } from '@cv/core';
import type { Resume } from '@cv/schema';
import { useRef, useState, type DragEvent } from 'react';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { downloadCsv, downloadJson } from '../lib/files';
import { importResumeFromPdf, type ImportResult } from '../lib/pdfImport';

const FAILURES: Record<Extract<ImportResult, { ok: false }>['reason'], string> = {
  'not-pdf': 'PDFファイルとして読み込めませんでした。ファイルを確認してください。',
  'too-large': 'ファイルが大きすぎます（10MBまで）。このサービスで作成したPDFか確認してください。',
  'no-data': 'このサービスで作成したPDFか確認してください。応募者にCSVの送付を依頼する方法もあります。',
  invalid: '履歴書データの形式が正しくありません。応募者にCSVの送付を依頼してください。',
  outdated: 'このサービスが更新されたため、読み込めませんでした。ページを再読み込みしてから、もう一度PDFを選んでください。',
};

function count(resume: Resume): string {
  const n = (items: unknown[]) => `${items.length}件`;
  return `学歴 ${n(resume.education)}／職歴 ${n(resume.employment)}／資格・免許 ${n(resume.qualifications)}`;
}

export function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  // 読み込み中かどうか。state の busy は画面を描き直すまで変わらないため、
  // 続けて届いたドロップを確実に止められるよう ref でも持つ
  const busyRef = useRef(false);
  // 読み込みごとの番号。最新の読み込みの結果だけを画面に反映する
  const loadId = useRef(0);

  // 画面のファイル名・プレビュー・保存するCSVが、別のPDFの内容にならないよう、
  // 読み込み中は次のファイルを受け付けない
  const load = async (file: File | undefined) => {
    if (!file || busyRef.current) return;
    busyRef.current = true;
    const id = ++loadId.current;
    setFileName(file.name);
    setBusy(true);
    setResult(null);
    let next: ImportResult;
    try {
      next = await importResumeFromPdf(file);
    } catch {
      next = { ok: false, reason: 'not-pdf' };
    }
    if (id !== loadId.current) return;
    setResult(next);
    busyRef.current = false;
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (e: DragEvent) => {
    // 読み込み中でも既定の動作は止める（止めないと、ブラウザがPDFをこのタブで開いてしまう）
    e.preventDefault();
    void load(e.dataTransfer.files[0]);
  };

  return (
    <Page>
      <div className="app-main">
        <div className="app-narrow">
          <div className="app-card">
            <div className="app-card__head">
              <span className="app-progress__count">採用担当者の方へ</span>
              <h1 className="app-title">PDFからCSVを作成する</h1>
              <p className="app-lead">このサービスで作成した履歴書PDFを選ぶと、同じ内容のCSVを作成できます。</p>
            </div>

            <div className="app-stack" style={{ gap: 32 }}>
              <div className="app-drop" aria-disabled={busy || undefined} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
                <div className="app-drop__icon">
                  <Icon name="upload" className="ic--lg" />
                </div>
                <p className="app-strong">ここにPDFをドラッグするか、ファイルを選んでください</p>
                <button className="bb-button" data-type="outline" data-size="md" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
                  PDFを選ぶ
                </button>
                <input
                  ref={inputRef}
                  className="app-file-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => void load(e.target.files?.[0])}
                />
                <p className="app-muted">ファイルはお使いの端末の中で読み込みます。サーバーへは送信しません。</p>
              </div>

              {fileName && (
                <div className="app-filechip">
                  <span className="app-inline" style={{ gap: 12 }}>
                    <Icon name="file" />
                    <span className="app-strong">{fileName}</span>
                  </span>
                  {busy && (
                    <span className="app-muted" role="status">
                      読み込んでいます…
                    </span>
                  )}
                </div>
              )}

              {result && !result.ok && (
                <div className="bb-banner" data-type="error" data-style="standard" role="alert">
                  <Icon name="alert" label="エラー" className="bb-banner__icon" />
                  <h2 className="bb-banner__title">このPDFは読み込めませんでした</h2>
                  <p className="bb-banner__body">{FAILURES[result.reason]}</p>
                </div>
              )}

              {result?.ok && (
                <>
                  <div className="bb-banner" data-type="success" data-style="standard" role="status">
                    <Icon name="success" label="成功" className="bb-banner__icon" />
                    <h2 className="bb-banner__title">履歴書データを読み込みました</h2>
                    <p className="bb-banner__body">内容をPDFの記載と見比べて確認してから、CSVを保存してください。</p>
                  </div>

                  <section className="app-review__section" aria-labelledby="preview-title">
                    <div className="app-entry__head">
                      <h2 className="app-entry__title" id="preview-title">
                        読み込んだ内容
                      </h2>
                    </div>
                    <dl className="app-dl">
                      <div className="app-dl__row">
                        <dt>氏名</dt>
                        <dd>
                          {formatName(result.resume.personal)}（{formatNameKana(result.resume.personal)}）
                        </dd>
                      </div>
                      <div className="app-dl__row">
                        <dt>応募者ID</dt>
                        <dd>{result.resume.id}</dd>
                      </div>
                      <div className="app-dl__row">
                        <dt>履歴書の日付</dt>
                        <dd>{formatDateJa(result.resume.createdAt)}</dd>
                      </div>
                      <div className="app-dl__row">
                        <dt>メールアドレス</dt>
                        <dd>{result.resume.personal.email}</dd>
                      </div>
                      <div className="app-dl__row">
                        <dt>電話番号</dt>
                        <dd>{result.resume.personal.phone}</dd>
                      </div>
                      <div className="app-dl__row">
                        <dt>学歴・職歴・資格</dt>
                        <dd>{count(result.resume)}</dd>
                      </div>
                    </dl>
                  </section>

                  <div className="app-inline" style={{ gap: '16px 24px' }}>
                    <button className="bb-button" data-type="solid-fill" data-size="lg" type="button" onClick={() => downloadCsv(result.resume)}>
                      <Icon name="download" />
                      CSVをダウンロード
                    </button>
                    <button className="bb-button" data-type="text" data-size="md" type="button" onClick={() => downloadJson(result.resume)}>
                      JSONをダウンロード
                    </button>
                  </div>
                  <p className="app-dlnote" style={{ textAlign: 'left' }}>
                    CSVは、基本情報（resume.csv）・学歴（education.csv）・職歴（work.csv）の3つのファイルを1つのZIPにまとめています。3つのファイルは、先頭列の「応募者ID」で紐づきます。
                  </p>
                </>
              )}

              <p className="app-hint">
                <Icon name="info" />
                <span>
                  対象は、このサービスで作成したPDFだけです。手書きの履歴書や、ほかのサービスで作成したPDFは読み込めません。PDFに埋め込まれたデータは作成後に書き換えることもできるため、内容はPDFの記載と見比べてください。
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
