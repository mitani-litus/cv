import {
  calcAge,
  describeEducation,
  describeEmployment,
  describeQualification,
  formatAddress,
  formatDateJa,
  formatYearMonthJa,
} from '@cv/core';
import type { Resume } from '@cv/schema';
import type { ReactNode } from 'react';
import { DateField } from '../components/Field';
import { Icon } from '../components/Icon';
import type { StepId } from '../lib/steps';

interface Props {
  resume: Resume;
  onChangeCreatedAt: (value: string) => void;
  onEdit: (step: StepId) => void;
}

function Section({ title, step, onEdit, children }: { title: string; step?: StepId; onEdit: (step: StepId) => void; children: ReactNode }) {
  const id = `review-${step ?? 'date'}`;
  return (
    <section className="app-review__section" aria-labelledby={id}>
      <div className="app-entry__head">
        <h2 className="app-entry__title" id={id}>
          {title}
        </h2>
        {step && (
          <button className="bb-button" data-type="outline" data-size="sm" type="button" aria-label={`${title}を編集する`} onClick={() => onEdit(step)}>
            <Icon name="pencil" />
            編集する
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-dl__row">
      <dt>{label}</dt>
      <dd style={value === '' ? { color: 'var(--text-muted)' } : undefined}>{value === '' ? '入力なし' : value}</dd>
    </div>
  );
}

function History({ items }: { items: { date: string; text: string }[] }) {
  const filled = items.filter((i) => i.date !== '' || i.text !== '');
  if (filled.length === 0) {
    return <p style={{ padding: '12px 24px', color: 'var(--text-muted)' }}>入力なし</p>;
  }
  return (
    <ul className="app-hist">
      {filled.map((item, i) => (
        <li key={i}>
          <span className="app-hist__date">{item.date}</span>
          <span className="app-hist__text">{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function ConfirmStep({ resume, onChangeCreatedAt, onEdit }: Props) {
  const p = resume.personal;
  const age = calcAge(p.birthDate, resume.createdAt);
  const birth = p.birthDate === '' ? '' : `${formatDateJa(p.birthDate)}${age === null ? '' : `（${age}歳）`}`;
  const address = [p.postalCode && `〒${p.postalCode}`, formatAddress(p.address)].filter(Boolean).join('\n');

  return (
    <div className="app-review">
      <Section title="履歴書の日付" onEdit={onEdit}>
        <div className="app-entry__body" style={{ gap: 8 }}>
          <DateField
            path="createdAt"
            legend={<span className="app-sr">履歴書の日付</span>}
            suffix="日 現在"
            value={resume.createdAt}
            onChange={onChangeCreatedAt}
            support="はじめは今日の日付です。提出日に合わせて変更できます。年齢はこの日付で計算します。"
          />
        </div>
      </Section>

      <Section title="基本情報" step="basic" onEdit={onEdit}>
        <dl className="app-dl">
          <Row label="氏名" value={p.nameKana ? `${p.name}（${p.nameKana}）` : p.name} />
          <Row label="生年月日" value={birth} />
          <Row label="住所" value={address} />
          <Row label="電話番号" value={p.phone} />
          <Row label="メールアドレス" value={p.email} />
        </dl>
      </Section>

      <Section title="学歴" step="education" onEdit={onEdit}>
        <History items={resume.education.map((e) => ({ date: formatYearMonthJa(e.year, e.month), text: describeEducation(e) }))} />
      </Section>

      <Section title="職歴" step="employment" onEdit={onEdit}>
        <History items={resume.employment.map((e) => ({ date: formatYearMonthJa(e.year, e.month), text: describeEmployment(e) }))} />
      </Section>

      <Section title="資格・免許" step="qualifications" onEdit={onEdit}>
        <History items={resume.qualifications.map((q) => ({ date: formatYearMonthJa(q.year, q.month), text: describeQualification(q) }))} />
      </Section>

      <Section title="志望動機・自己PR・本人希望" step="texts" onEdit={onEdit}>
        <dl className="app-dl">
          <Row label="志望動機" value={resume.motivation} />
          <Row label="自己PR" value={resume.selfIntroduction} />
          <Row label="本人希望" value={resume.preferences} />
        </dl>
      </Section>

      <div className="bb-banner" data-type="info-1" data-style="standard" role="note" aria-labelledby="send-title">
        <Icon name="info" label="お知らせ" className="bb-banner__icon" />
        <h2 className="bb-banner__title" id="send-title">
          作成するときの情報の扱い
        </h2>
        <p className="bb-banner__body">
          PDFを作成するために、入力内容をサーバーへ送信します。作成が終わると、サーバーでは入力内容を保持しません。CSVとJSONは、この端末の中で作成します。
        </p>
      </div>
    </div>
  );
}
