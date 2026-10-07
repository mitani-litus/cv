import { STEPS, type StepId } from '../lib/steps';
import { Icon } from './Icon';

export function Stepper({ current }: { current: StepId }) {
  const index = STEPS.findIndex((s) => s.id === current);
  const next = STEPS[index + 1];
  return (
    <nav className="app-progress" aria-label="入力の進み具合">
      <ol className="app-steps">
        {STEPS.map((step, i) => {
          const state = i < index ? 'done' : i === index ? 'current' : 'todo';
          return (
            <li key={step.id} className="app-step" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="app-step__dot">{state === 'done' ? <Icon name="check" /> : i + 1}</span>
              <span>
                {step.label}
                {state === 'done' && <span className="app-sr">（入力済み）</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {/* スマートフォンでは簡略版を表示する（CSSで切り替え） */}
      <div className="app-mstep" aria-hidden="true">
        <div className="app-mstep__row">
          <span className="app-mstep__title">{STEPS[index]?.label}</span>
          <span className="app-mstep__count">
            ステップ {index + 1} / {STEPS.length}
          </span>
        </div>
        <div className="app-mstep__bar">
          {STEPS.map((s, i) => (
            <span key={s.id} data-on={i <= index ? 'true' : undefined} />
          ))}
        </div>
        <span className="app-mstep__next">{next ? `次は「${next.label}」です` : '最後のステップです'}</span>
      </div>
    </nav>
  );
}
