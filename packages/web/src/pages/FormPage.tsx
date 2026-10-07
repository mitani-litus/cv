import { validateResume, type Resume } from '@cv/schema';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorContext } from '../components/Field';
import { ErrorSummary } from '../components/ErrorSummary';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { LocalNote } from '../components/LocalNote';
import { Stepper } from '../components/Stepper';
import { PDF_IN_BROWSER } from '../config';
import { PdfRequestError } from '../lib/api';
import { createPdf } from '../lib/pdf';
import { hasInput } from '../lib/draft';
import { downloadJson } from '../lib/files';
import { errorsForStep, STEPS, type StepId } from '../lib/steps';
import { navigate } from '../router';
import { BasicStep } from '../steps/BasicStep';
import { ConfirmStep } from '../steps/ConfirmStep';
import { EducationStep } from '../steps/EducationStep';
import { EmploymentStep } from '../steps/EmploymentStep';
import { QualificationStep } from '../steps/QualificationStep';
import { TextStep } from '../steps/TextStep';
import { CompletePage } from './CompletePage';

const LEADS: Record<StepId, string> = {
  basic: '履歴書に記載する基本的な情報を入力してください。',
  education: '高校以降の学歴を、古い順に入力してください。入学と卒業は、それぞれ1行ずつ入力します。',
  employment: 'これまでの職歴を、古い順に入力してください。入社と退職は、それぞれ1行ずつ入力します。',
  qualifications: '取得した資格・免許を、取得した順に入力してください。',
  texts: 'いずれも任意です。入力した文章は、改行も含めてそのまま履歴書に記載されます。',
  confirm: 'この内容で履歴書を作成します。直したい項目は「編集する」から変更できます。',
};

const PDF_ERRORS: Record<PdfRequestError['kind'], string> = {
  invalid: '入力内容を確認できませんでした。各ステップの入力内容を確認してから、もう一度お試しください。',
  busy: '現在混み合っています。入力内容はこの画面に残っているので、少し待ってからもう一度「履歴書を作成する」を押してください。',
  failed: PDF_IN_BROWSER
    ? 'PDFの作成中に問題が起きました。入力内容はこの画面に残っているので、もう一度「履歴書を作成する」を押してください。'
    : '通信がうまくいかなかった可能性があります。入力内容はこの画面に残っているので、もう一度「履歴書を作成する」を押してください。',
  font: 'PDFの作成に必要なフォントを読み込めませんでした。通信の状態を確認してから、もう一度「履歴書を作成する」を押してください。入力内容はこの画面に残っています。',
};

interface Props {
  resume: Resume;
  onChange: (resume: Resume) => void;
}

export function FormPage({ resume, onChange }: Props) {
  const [step, setStep] = useState<StepId>('basic');
  /** そのステップで「次へ」を押したか（押すまではエラーを表示しない） */
  const [attempted, setAttempted] = useState<Partial<Record<StepId, boolean>>>({});
  const [generating, setGenerating] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<Blob | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const index = STEPS.findIndex((s) => s.id === step);
  const meta = STEPS[index]!;
  const validation = useMemo(() => validateResume(resume), [resume]);
  const allErrors = validation.ok ? [] : validation.errors;
  const stepErrors = attempted[step] ? errorsForStep(allErrors, step) : [];
  const errorOf = useMemo(() => {
    const map = new Map(stepErrors.map((e) => [e.path, e.message]));
    return (path: string) => map.get(path);
  }, [stepErrors]);

  // 入力途中でページを閉じようとしたら確認する（データは端末内にしかないため）
  useEffect(() => {
    if (pdf || !hasInput(resume)) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [resume, pdf]);

  const goTo = (next: StepId) => {
    setStep(next);
    setPdfError(null);
    window.scrollTo(0, 0);
    // 画面が切り替わったことを読み上げソフトに伝えるため、見出しへ移動する
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  const showErrors = () => {
    setAttempted((a) => ({ ...a, [step]: true }));
    requestAnimationFrame(() => summaryRef.current?.focus());
  };

  const next = () => {
    if (errorsForStep(allErrors, step).length > 0) return showErrors();
    const following = STEPS[index + 1];
    if (following) goTo(following.id);
  };

  /** 確認画面のエラー一覧から、該当するステップへ移動する（移動先でもエラーを表示する） */
  const fixInStep = (target: StepId) => {
    setAttempted((a) => ({ ...a, [target]: true }));
    goTo(target);
  };

  const back = () => {
    const previous = STEPS[index - 1];
    if (previous) goTo(previous.id);
    else navigate('/');
  };

  const create = async () => {
    if (!validation.ok) return showErrors();
    setGenerating(true);
    setPdfError(null);
    try {
      setPdf(await createPdf(validation.value));
      window.scrollTo(0, 0);
    } catch (e) {
      setPdfError(PDF_ERRORS[e instanceof PdfRequestError ? e.kind : 'failed']);
    } finally {
      setGenerating(false);
    }
  };

  if (pdf && validation.ok) return <CompletePage resume={validation.value} pdf={pdf} />;

  return (
    <Page footer={false}>
      <div className="app-main">
        <div className="app-narrow">
          <Stepper current={step} />

          <form
            className="app-card"
            aria-labelledby="page-title"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (step === 'confirm') void create();
              else next();
            }}
          >
            <div className="app-card__head">
              <span className="app-progress__count">
                ステップ {index + 1} / {STEPS.length}
              </span>
              <h1 className="app-title" id="page-title" tabIndex={-1} ref={titleRef}>
                {meta.title}
              </h1>
              <p className="app-lead">{LEADS[step]}</p>
            </div>

            {stepErrors.length > 0 && <ErrorSummary ref={summaryRef} errors={stepErrors} current={step} onGoToStep={fixInStep} />}

            <ErrorContext.Provider value={errorOf}>
              {step === 'basic' && <BasicStep value={resume.personal} onChange={(personal) => onChange({ ...resume, personal })} />}
              {step === 'education' && <EducationStep value={resume.education} onChange={(education) => onChange({ ...resume, education })} />}
              {step === 'employment' && <EmploymentStep value={resume.employment} onChange={(employment) => onChange({ ...resume, employment })} />}
              {step === 'qualifications' && (
                <QualificationStep value={resume.qualifications} onChange={(qualifications) => onChange({ ...resume, qualifications })} />
              )}
              {step === 'texts' && <TextStep value={resume} onChange={(texts) => onChange({ ...resume, ...texts })} />}
              {step === 'confirm' && <ConfirmStep resume={resume} onChangeCreatedAt={(createdAt) => onChange({ ...resume, createdAt })} onEdit={goTo} />}
            </ErrorContext.Provider>

            {pdfError && (
              <div className="bb-banner" data-type="error" data-style="standard" role="alert" style={{ marginTop: 32 }}>
                <Icon name="alert" label="エラー" className="bb-banner__icon" />
                <h2 className="bb-banner__title">PDFを作成できませんでした</h2>
                <p className="bb-banner__body">{pdfError}</p>
              </div>
            )}

            <div className="app-actions app-actions--sticky">
              <button className="bb-button" data-type="outline" data-size="md" type="button" onClick={back} disabled={generating}>
                <Icon name="arrowLeft" />
                戻る
              </button>
              {step === 'confirm' ? (
                <button className="bb-button" data-type="solid-fill" data-size="lg" type="submit" disabled={generating} aria-busy={generating || undefined}>
                  {generating ? (
                    <>
                      <Icon name="spinner" className="app-spin" />
                      履歴書を作成しています
                    </>
                  ) : (
                    '履歴書を作成する'
                  )}
                </button>
              ) : (
                <button className="bb-button" data-type="solid-fill" data-size="lg" type="submit">
                  次へ（{STEPS[index + 1]?.label}）
                  <Icon name="arrowRight" />
                </button>
              )}
            </div>
            {generating && (
              <p className="app-muted" role="status" style={{ marginTop: 16, textAlign: 'right' }}>
                {PDF_IN_BROWSER ? 'はじめて作成するときは、フォント（約3MB）を読み込むため少し時間がかかります。このままお待ちください。' : '数秒かかります。このままお待ちください。'}
              </p>
            )}
          </form>

          <LocalNote onSave={() => downloadJson(resume)} />
        </div>
      </div>
    </Page>
  );
}
