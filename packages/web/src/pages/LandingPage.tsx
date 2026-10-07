import type { Resume } from '@cv/schema';
import { useRef, useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { Page } from '../components/Layout';
import { AD_URL } from '../config';
import { readDraftFile, today } from '../lib/draft';
import { Link, navigate } from '../router';

const FEATURES: { icon: IconName; kicker: string; title: string; text: string }[] = [
  { icon: 'form', kicker: 'かんたん', title: 'Webで入力', text: '画面の案内に沿って、項目を順番に入力するだけです。スマートフォンからも入力できます。' },
  { icon: 'download', kicker: 'すぐ使える', title: 'PDF・CSV出力', text: '履歴書の形式のPDFと、表計算ソフトで開けるCSVを、その場で作成します。' },
  {
    icon: 'shield',
    kicker: '安心',
    title: '原則データ保存なし',
    text: '入力した情報をデータベースに保存しません。PDFの作成後、サーバーでは入力データを保持しない設計です。',
  },
];

const POLICY = [
  '入力中のデータは、お使いのブラウザの中だけに保持されます。',
  'CSVとJSONは、お使いの端末の中で作成します。',
  'PDFを作成するときだけ入力内容をサーバーへ送り、作成後は保持しません。',
  '顔写真は扱いません。',
  '入力内容を広告に利用することはありません。',
  'ソースコードを公開しています（MITライセンス）。',
];

export function LandingPage({ onResume }: { onResume: (resume: Resume) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [resumeError, setResumeError] = useState(false);

  const resumeFromFile = async (file: File | undefined) => {
    if (!file) return;
    const draft = await readDraftFile(file, today());
    if (fileRef.current) fileRef.current.value = '';
    if (!draft) {
      setResumeError(true);
      return;
    }
    setResumeError(false);
    onResume(draft);
    navigate('/form');
  };

  return (
    <Page white>
      <div className="app-hero-band">
        <div className="app-hero">
          <div>
            <h1 className="app-display">
              履歴書を、
              <br />
              かんたんにデータ化。
            </h1>
            <p className="app-hero__sub">
              入力した履歴書から、PDFとCSVを作成できます。
              <br />
              入力した情報は、原則として保存されません。
            </p>
            <div className="app-cta-row">
              <Link className="bb-button" data-type="solid-fill" data-size="lg" href="/form">
                履歴書を入力する
                <Icon name="arrowRight" />
              </Link>
              <button className="bb-button" data-type="text" data-size="md" type="button" onClick={() => fileRef.current?.click()}>
                保存したデータ（JSON）から再開する
              </button>
              <input
                ref={fileRef}
                className="app-file-input"
                type="file"
                accept="application/json,.json"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => void resumeFromFile(e.target.files?.[0])}
              />
            </div>
            {resumeError && (
              <p className="app-error" role="alert" style={{ marginTop: 16 }}>
                <Icon name="alert" label="エラー" />
                <span>このファイルは読み込めませんでした。このサービスで保存したJSONファイルを選んでください。</span>
              </p>
            )}
            <div className="app-hero__meta">
              {['無料', '会員登録は不要です', '入力は6つのステップ'].map((t) => (
                <span key={t}>
                  <Icon name="check" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          <figure className="app-flow" style={{ margin: 0 }} aria-label="入力からPDF・CSV・JSONを作成する流れ">
            <div className="app-flow__form" aria-hidden="true">
              <span className="app-flow__label">Webフォームで入力</span>
              {[30, 22, 38].map((w) => (
                <div className="app-skel" key={w}>
                  <i style={{ width: `${w}%` }} />
                  <b />
                </div>
              ))}
            </div>
            <Icon name="arrowDown" className="ic--lg app-flow__arrow" />
            <div className="app-files">
              {[
                ['PDF', '履歴書として印刷・閲覧'],
                ['CSV', '表計算ソフトで開く・取り込む'],
                ['JSON', '入力データを保存・再利用'],
              ].map(([type, desc]) => (
                <div className="app-file" key={type}>
                  <span className="app-file__type">
                    <Icon name="file" />
                    {type}
                  </span>
                  <span className="app-file__desc">{desc}</span>
                </div>
              ))}
            </div>
          </figure>
        </div>
      </div>

      <section className="app-section" aria-labelledby="features-title">
        <div className="app-section__head">
          <h2 className="app-h2" id="features-title">
            このサービスの特長
          </h2>
        </div>
        <div className="app-features">
          {FEATURES.map((f) => (
            <div className="app-feature" key={f.kicker}>
              <div className="app-feature__icon">
                <Icon name={f.icon} className="ic--lg" />
              </div>
              <span className="app-feature__kicker">{f.kicker}</span>
              <h3 className="app-h3" style={{ fontSize: '1.5rem' }}>
                {f.title}
              </h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="app-section" id="how" aria-labelledby="how-title">
        <div className="app-section__head">
          <h2 className="app-h2" id="how-title">
            使い方
          </h2>
          <p>採用担当者から届いたURLを開いて、次の3つの手順で進めます。</p>
        </div>
        <ol className="app-howto">
          {[
            ['「履歴書を入力する」を押す', 'このページの「履歴書を入力する」から入力を始めます。'],
            ['案内に沿って入力し、確認する', '入力は6つのステップに分かれています。途中で中断するときは、入力データをファイルに保存できます。'],
            ['PDFとCSVを採用担当者に送る', '作成したファイルを、メールなどに添付してご自身で送ってください。このサービスから送信することはありません。'],
          ].map(([title, text], i) => (
            <li key={title}>
              <span className="app-howto__num" aria-hidden="true">
                {i + 1}
              </span>
              <div className="app-stack" style={{ gap: 8 }}>
                <h3 className="app-h3">{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="app-section" id="about" aria-labelledby="about-title">
        <div className="app-policy">
          <div className="app-stack" style={{ gap: 16 }}>
            <h2 className="app-h2" id="about-title">
              入力した情報の取り扱い
            </h2>
            <p className="app-strong" style={{ fontSize: '1.125rem' }}>
              入力した履歴書情報は、原則として保存されません。
            </p>
            <p>PDFやCSVの作成に必要な処理を行った後、入力データは保持しない設計になっています。</p>
          </div>
          <ul className="app-checks">
            {POLICY.map((text) => (
              <li key={text}>
                <Icon name="check" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="app-section" aria-labelledby="recruiter-title">
        <div className="app-callout">
          <div className="app-stack" style={{ gap: 8 }}>
            <span className="app-feature__kicker">採用担当者の方へ</span>
            <h2 className="app-h3" id="recruiter-title">
              PDFだけが届いた場合は、ここでCSVを作成できます。
            </h2>
            <p>このサービスで作成したPDFが対象です。ファイルはお使いの端末の中で読み込みます。</p>
          </div>
          <Link className="bb-button" data-type="outline" data-size="lg" href="/import">
            PDFからCSVを作成する
          </Link>
        </div>
      </section>

      {AD_URL && (
        <section className="app-section" aria-label="広告" style={{ paddingTop: 0 }}>
          {/* 広告は別オリジンのページを sandbox 付きで表示する。allow-same-origin は付けない */}
          <iframe
            className="app-ad"
            title="広告"
            src={AD_URL}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            loading="lazy"
            style={{ width: '100%', height: 120 }}
          />
        </section>
      )}
    </Page>
  );
}
