// @vitest-environment jsdom
import { createEmptyResume, type Resume } from '@cv/schema';
import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importResumeFromPdf, type ImportResult } from '../lib/pdfImport';
import { ImportPage } from './ImportPage';

// PDFからの取り出しそのものは、ビルドした画面をブラウザで動かして確かめる。
// ここでは、読み込みの終わる順番を自由に決められるようにする
vi.mock('../lib/pdfImport', () => ({ importResumeFromPdf: vi.fn() }));

function applicant(familyName: string, givenName: string): Resume {
  const r = createEmptyResume('2026-10-08');
  r.personal = { ...r.personal, familyName, givenName, givenNameKana: 'カナ', email: `${givenName}@example.jp` };
  return r;
}

/** 外から終わらせられる読み込み */
function deferred() {
  let resolve!: (r: ImportResult) => void;
  const promise = new Promise<ImportResult>((r) => (resolve = r));
  return { promise, resolve };
}

function pdf(name: string): File {
  return new File(['%PDF-1.7'], name, { type: 'application/pdf' });
}

const dropArea = () => document.querySelector<HTMLElement>('.app-drop')!;

/** PDFをドロップし、ブラウザの既定の動作（PDFをタブで開く）が止められたかを返す */
function drop(file: File): boolean {
  const event = createEvent.drop(dropArea(), { dataTransfer: { files: [file] } });
  fireEvent(dropArea(), event);
  return event.defaultPrevented;
}

beforeEach(() => {
  vi.mocked(importResumeFromPdf).mockReset();
});

afterEach(() => {
  cleanup();
});

describe('PDFの取り込み画面', () => {
  it('読み込み中は、次のPDFのドロップを受け付けない（ファイル名と内容が別の人にならない）', async () => {
    const yamada = deferred();
    vi.mocked(importResumeFromPdf).mockReturnValueOnce(yamada.promise);
    render(<ImportPage />);

    expect(drop(pdf('yamada.pdf'))).toBe(true);
    expect(screen.getByText('読み込んでいます…')).toBeTruthy();
    expect(dropArea().getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'PDFを選ぶ' }).hasAttribute('disabled')).toBe(true);

    // 読み込み中のドロップは無視する。ただし、ブラウザがPDFを開かないよう既定の動作は止める
    expect(drop(pdf('sato.pdf'))).toBe(true);
    expect(importResumeFromPdf).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('sato.pdf')).toBeNull();

    await act(async () => yamada.resolve({ ok: true, resume: applicant('山田', '太郎') }));
    expect(screen.getByText('yamada.pdf')).toBeTruthy();
    expect(screen.getByText(/山田 太郎/)).toBeTruthy();
    expect(screen.queryByText('読み込んでいます…')).toBeNull();
    expect(dropArea().getAttribute('aria-disabled')).toBeNull();
  });

  it('読み込みが終われば、次のPDFを読み込める', async () => {
    vi.mocked(importResumeFromPdf)
      .mockResolvedValueOnce({ ok: true, resume: applicant('山田', '太郎') })
      .mockResolvedValueOnce({ ok: true, resume: applicant('佐藤', '花子') });
    render(<ImportPage />);

    await act(async () => void drop(pdf('yamada.pdf')));
    expect(screen.getByText(/山田 太郎/)).toBeTruthy();

    await act(async () => void drop(pdf('sato.pdf')));
    expect(importResumeFromPdf).toHaveBeenCalledTimes(2);
    expect(screen.getByText('sato.pdf')).toBeTruthy();
    expect(screen.getByText(/佐藤 花子/)).toBeTruthy();
    expect(screen.queryByText(/山田 太郎/)).toBeNull();
  });

  it('読み込み中は、ファイルを選ぶ欄からの読み込みも受け付けない', async () => {
    const yamada = deferred();
    vi.mocked(importResumeFromPdf).mockReturnValueOnce(yamada.promise);
    render(<ImportPage />);

    drop(pdf('yamada.pdf'));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [pdf('sato.pdf')] } });
    expect(importResumeFromPdf).toHaveBeenCalledTimes(1);

    await act(async () => yamada.resolve({ ok: true, resume: applicant('山田', '太郎') }));
    expect(screen.getByText('yamada.pdf')).toBeTruthy();
  });

  it('読み込みに失敗しても、次のPDFを読み込める', async () => {
    vi.mocked(importResumeFromPdf)
      .mockRejectedValueOnce(new Error('broken'))
      .mockResolvedValueOnce({ ok: true, resume: applicant('佐藤', '花子') });
    render(<ImportPage />);

    await act(async () => void drop(pdf('broken.pdf')));
    expect(screen.getByRole('alert')).toBeTruthy();

    await act(async () => void drop(pdf('sato.pdf')));
    expect(screen.getByText(/佐藤 花子/)).toBeTruthy();
  });
});
