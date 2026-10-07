import type { ReactNode } from 'react';
import { LIMITS } from '@cv/schema';
import { Icon } from './Icon';

interface EntriesProps<T> {
  /** 例: "学歴" */
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  createEmpty: () => T;
  renderItem: (item: T, index: number, update: (patch: Partial<T>) => void) => ReactNode;
  hint: string;
}

/** 学歴・職歴・資格の行カード（追加・削除つき） */
export function Entries<T>({ label, items, onChange, createEmpty, renderItem, hint }: EntriesProps<T>) {
  const update = (index: number) => (patch: Partial<T>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const add = () => {
    onChange([...items, createEmpty()]);
    // 追加した行の最初の入力欄へ移動する
    requestAnimationFrame(() => {
      const cards = document.querySelectorAll<HTMLElement>('.app-entry');
      cards[cards.length - 1]?.querySelector<HTMLInputElement>('input')?.focus();
    });
  };
  const full = items.length >= LIMITS.entries;

  return (
    <div className="app-entries">
      {items.map((item, index) => {
        const title = `${label} ${index + 1}`;
        const headingId = `entry-${label}-${index}`;
        return (
          <section className="app-entry" aria-labelledby={headingId} key={index}>
            <div className="app-entry__head">
              <h2 className="app-entry__title" id={headingId}>
                {title}
              </h2>
              <button className="bb-button" data-type="text" data-size="sm" type="button" aria-label={`${title} を削除`} onClick={() => remove(index)}>
                <Icon name="trash" />
                削除
              </button>
            </div>
            <div className="app-entry__body">{renderItem(item, index, update(index))}</div>
          </section>
        );
      })}

      <button className="bb-button app-add" data-type="outline" data-size="lg" type="button" onClick={add} disabled={full}>
        <Icon name="plus" />
        {label}を追加
      </button>
      <p className="app-hint">
        <Icon name="info" />
        <span>{full ? `${label}は${LIMITS.entries}件まで入力できます。` : hint}</span>
      </p>
    </div>
  );
}
