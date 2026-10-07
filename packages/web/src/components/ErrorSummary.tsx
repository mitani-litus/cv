import type { FieldError } from '@cv/schema';
import { forwardRef } from 'react';
import { fieldId, STEPS, stepOfPath, type StepId } from '../lib/steps';
import { Icon } from './Icon';

interface Props {
  errors: FieldError[];
  current: StepId;
  /** ほかのステップのエラーを選んだとき（確認画面のみ） */
  onGoToStep: (step: StepId) => void;
}

/** エラーの一覧。各項目へのリンク付き。表示したらここにフォーカスを移す */
export const ErrorSummary = forwardRef<HTMLDivElement, Props>(function ErrorSummary({ errors, current, onGoToStep }, ref) {
  return (
    <div className="bb-banner" data-type="error" data-style="standard" role="alert" aria-labelledby="error-summary-title" tabIndex={-1} ref={ref} style={{ marginBottom: 40 }}>
      <Icon name="alert" label="エラー" className="bb-banner__icon" />
      <h2 className="bb-banner__title" id="error-summary-title">
        入力内容に{errors.length}件の誤りがあります
      </h2>
      <div className="bb-banner__body">
        <p style={{ marginBottom: 8 }}>次の項目を直してから、もう一度押してください。</p>
        <ul style={{ margin: 0, paddingLeft: '1.25em', display: 'grid', gap: 4 }}>
          {errors.map((e) => {
            const step = stepOfPath(e.path);
            const label = step === current ? e.message : `${STEPS.find((s) => s.id === step)?.label}：${e.message}`;
            return (
              <li key={e.path}>
                <a
                  className="bb-link"
                  href={`#${fieldId(e.path)}`}
                  onClick={(ev) => {
                    ev.preventDefault();
                    if (step !== current) {
                      onGoToStep(step);
                      return;
                    }
                    const el = document.getElementById(fieldId(e.path));
                    el?.focus();
                    el?.scrollIntoView({ block: 'center' });
                  }}
                >
                  {label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
});
