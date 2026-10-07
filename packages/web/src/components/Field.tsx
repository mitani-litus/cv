import { toHalfWidthDigits } from '@cv/core';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fieldId } from '../lib/steps';
import { Icon } from './Icon';

/** 項目の位置からエラー文を引く（エラーを表示しない間は常に undefined） */
export const ErrorContext = createContext<(path: string) => string | undefined>(() => undefined);

function useFieldError(path: string) {
  return useContext(ErrorContext)(path);
}

export function ErrorText({ id, message }: { id: string; message: string }) {
  return (
    <p className="bb-field__error app-error" id={id}>
      <Icon name="alert" label="エラー" />
      <span>{message}</span>
    </p>
  );
}

function Label({ htmlFor, label, required, optional }: { htmlFor: string; label: string; required?: boolean | undefined; optional?: boolean | undefined }) {
  return (
    <label className="bb-field__label" htmlFor={htmlFor}>
      {label}
      {required && <span className="bb-field__required">※必須</span>}
      {optional && <span className="app-optional">任意</span>}
    </label>
  );
}

function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  const list = ids.filter((v): v is string => typeof v === 'string');
  return list.length > 0 ? list.join(' ') : undefined;
}

interface TextFieldProps {
  path: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  optional?: boolean;
  support?: string;
  type?: 'text' | 'email' | 'tel';
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
  autoComplete?: string;
  className?: string;
  maxLength?: number;
  /** 入力欄を離れたときに値を整える（全角数字を半角にする、など） */
  normalize?: (value: string) => string;
}

export function TextField(props: TextFieldProps) {
  const { path, label, value, onChange, required, optional, support, normalize } = props;
  const id = fieldId(path);
  const error = useFieldError(path);
  const supportId = support ? `${id}-support` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="bb-field">
      <Label htmlFor={id} label={label} required={required} optional={optional} />
      {support && (
        <span className="bb-field__support" id={supportId}>
          {support}
        </span>
      )}
      <input
        className={`bb-input ${props.className ?? 'w-full'}`}
        data-size="md"
        id={id}
        type={props.type ?? 'text'}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete ?? 'off'}
        maxLength={props.maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={normalize ? (e) => onChange(normalize(e.target.value)) : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(supportId, errorId)}
        aria-required={required || undefined}
      />
      {error && errorId && <ErrorText id={errorId} message={error} />}
    </div>
  );
}

interface TextAreaProps {
  path: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  rows?: number;
  support?: string;
}

export function TextArea({ path, label, value, onChange, max, rows = 7, support }: TextAreaProps) {
  const id = fieldId(path);
  const error = useFieldError(path);
  const supportId = support ? `${id}-support` : undefined;
  const countId = `${id}-count`;
  const errorId = error ? `${id}-error` : undefined;
  const count = value.length;
  return (
    <div className="bb-field">
      <Label htmlFor={id} label={label} optional />
      {support && (
        <span className="bb-field__support" id={supportId}>
          {support}
        </span>
      )}
      <textarea
        className="bb-input"
        id={id}
        rows={rows}
        style={rows < 6 ? { minHeight: 140 } : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(supportId, countId, errorId)}
      />
      <div className="app-counter">
        <span />
        <span id={countId} style={count > max ? { color: 'var(--error)', fontWeight: 700 } : undefined}>
          {count} / {max}文字
        </span>
      </div>
      {error && errorId && <ErrorText id={errorId} message={error} />}
    </div>
  );
}

interface SelectFieldProps<T extends string> {
  path: string;
  label: string;
  value: T | '';
  options: readonly T[];
  onChange: (value: T | '') => void;
  placeholder?: string;
  width?: number | string;
  autoComplete?: string;
  plainLabel?: boolean;
}

export function SelectField<T extends string>(props: SelectFieldProps<T>) {
  const { path, label, value, options, onChange, placeholder = '選択してください', width = 160 } = props;
  const id = fieldId(path);
  const error = useFieldError(path);
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="bb-field">
      <label className="bb-field__label" htmlFor={id} style={props.plainLabel ? { fontWeight: 'normal' } : undefined}>
        {label}
      </label>
      <span className="app-select" style={{ width }}>
        <select
          className="bb-input w-full"
          data-size="md"
          id={id}
          value={value}
          autoComplete={props.autoComplete}
          onChange={(e) => onChange(e.target.value as T | '')}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" />
      </span>
      {error && errorId && <ErrorText id={errorId} message={error} />}
    </div>
  );
}

/** 数字だけを残す（全角数字は半角にする） */
export function digitsOnly(value: string, maxLength: number): string {
  return toHalfWidthDigits(value).replace(/\D/g, '').slice(0, maxLength);
}

function toNumber(value: string): number | null {
  return value === '' ? null : Number(value);
}

interface YearMonthFieldProps {
  /** エラーの位置（例: "education.0"）。year と month のエラーをここで表示する */
  path: string;
  legend: string;
  /** 読み上げ用の名前（例: "学歴 1"） */
  name: string;
  year: number | null;
  month: number | null;
  onChange: (year: number | null, month: number | null) => void;
}

export function YearMonthField({ path, legend, name, year, month, onChange }: YearMonthFieldProps) {
  const yearError = useFieldError(`${path}.year`);
  const monthError = useFieldError(`${path}.month`);
  const yearId = fieldId(`${path}.year`);
  const monthId = fieldId(`${path}.month`);
  return (
    <fieldset className="app-fieldset" style={{ gap: 8 }}>
      <legend>{legend}</legend>
      <div className="app-inline">
        <input
          className="bb-input w-year"
          data-size="md"
          id={yearId}
          type="text"
          inputMode="numeric"
          aria-label={`${name} の年（西暦）`}
          value={year === null ? '' : String(year)}
          onChange={(e) => onChange(toNumber(digitsOnly(e.target.value, 4)), month)}
          aria-invalid={yearError ? true : undefined}
          aria-describedby={yearError ? `${yearId}-error` : undefined}
        />
        <span className="app-unit">年</span>
        <input
          className="bb-input w-2"
          data-size="md"
          id={monthId}
          type="text"
          inputMode="numeric"
          aria-label={`${name} の月`}
          value={month === null ? '' : String(month)}
          onChange={(e) => onChange(year, toNumber(digitsOnly(e.target.value, 2)))}
          aria-invalid={monthError ? true : undefined}
          aria-describedby={monthError ? `${monthId}-error` : undefined}
        />
        <span className="app-unit">月</span>
      </div>
      {yearError && <ErrorText id={`${yearId}-error`} message={yearError} />}
      {monthError && <ErrorText id={`${monthId}-error`} message={monthError} />}
    </fieldset>
  );
}

function splitDate(iso: string): [string, string, string] {
  const m = /^(\d{0,4})-(\d{0,2})-(\d{0,2})$/.exec(iso);
  if (!m) return ['', '', ''];
  return [m[1] ?? '', String(Number(m[2]) || ''), String(Number(m[3]) || '')];
}

function joinDate(y: string, m: string, d: string): string {
  if (y === '' && m === '' && d === '') return '';
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

interface DateFieldProps {
  path: string;
  legend: ReactNode;
  value: string;
  onChange: (value: string) => void;
  support?: string;
  suffix?: string;
}

/** 年・月・日の3つの入力欄で "YYYY-MM-DD" を入力する */
export function DateField({ path, legend, value, onChange, support, suffix = '日' }: DateFieldProps) {
  const id = fieldId(path);
  const error = useFieldError(path);
  const [parts, setParts] = useState(() => splitDate(value));

  // JSONの読み込みなどで外から値が変わったときは、入力欄に反映する
  useEffect(() => {
    if (joinDate(...parts) !== value) setParts(splitDate(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const update = (index: 0 | 1 | 2, raw: string) => {
    const next: [string, string, string] = [...parts];
    next[index] = digitsOnly(raw, index === 0 ? 4 : 2);
    setParts(next);
    onChange(joinDate(...next));
  };

  const supportId = support ? `${id}-support` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const common = {
    className: 'bb-input',
    'data-size': 'md',
    type: 'text',
    inputMode: 'numeric' as const,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy(supportId, errorId),
  };
  return (
    <fieldset className="app-fieldset">
      <legend>{legend}</legend>
      <div className="app-inline">
        <input {...common} className="bb-input w-year" id={id} aria-label="年（西暦）" value={parts[0]} onChange={(e) => update(0, e.target.value)} />
        <span className="app-unit">年</span>
        <input {...common} className="bb-input w-2" aria-label="月" value={parts[1]} onChange={(e) => update(1, e.target.value)} />
        <span className="app-unit">月</span>
        <input {...common} className="bb-input w-2" aria-label="日" value={parts[2]} onChange={(e) => update(2, e.target.value)} />
        <span className="app-unit">{suffix}</span>
      </div>
      {support && (
        <span className="bb-field__support" id={supportId}>
          {support}
        </span>
      )}
      {error && errorId && <ErrorText id={errorId} message={error} />}
    </fieldset>
  );
}

/** チェックボックス（はい／いいえを選ぶ項目） */
export function CheckboxField({ path, label, support, checked, onChange }: { path: string; label: string; support?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = fieldId(path);
  const supportId = support ? `${id}-support` : undefined;
  return (
    <div className="app-check">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-describedby={supportId} />
      <div className="app-check__text">
        <label className="bb-field__label" htmlFor={id}>
          {label}
        </label>
        {support && (
          <span className="bb-field__support" id={supportId}>
            {support}
          </span>
        )}
      </div>
    </div>
  );
}
