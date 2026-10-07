// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { PdfRequestError } from './lib/api';
import { createPdf } from './lib/pdf';

// PDFの作成処理そのものは lib/pdf.test.ts と packages/pdf で確かめる
vi.mock('./lib/pdf', () => ({ createPdf: vi.fn() }));

function start(path = '/form') {
  window.history.pushState(null, '', path);
  const user = userEvent.setup();
  render(<App />);
  return user;
}

const next = () => screen.getByRole('button', { name: /^次へ/ });

/** 次のステップへ進み、見出しにフォーカスが移るまで待つ（移る前に入力すると、入力の途中でフォーカスが外れる） */
async function goNext(user: ReturnType<typeof userEvent.setup>) {
  await user.click(next());
  await waitFor(() => expect(document.activeElement?.id).toBe('page-title'));
}

/** 行を追加し、追加した行の最初の入力欄にフォーカスが移るまで待つ */
async function addEntry(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name }));
  await waitFor(() => expect(document.activeElement?.tagName).toBe('INPUT'));
}

async function fillBasic(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^氏名/), '山田 太郎');
  await user.type(screen.getByLabelText(/^フリガナ/), 'やまだ たろう');
  await user.type(screen.getByLabelText(/^電話番号/), '０９０-１２３４-５６７８');
  await user.type(screen.getByLabelText(/^メールアドレス/), 'taro@example.jp');
  await user.tab();
}

beforeEach(() => {
  vi.mocked(createPdf).mockReset();
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('入力フォーム', () => {
  it('必須項目が空のまま「次へ」を押すと、エラー一覧と各項目のエラーを表示する', async () => {
    const user = start();
    // 押す前はエラーを表示しない
    expect(screen.queryByRole('alert')).toBeNull();

    await user.click(next());

    const summary = screen.getByRole('alert');
    expect(within(summary).getByText('入力内容に4件の誤りがあります')).toBeTruthy();
    expect(within(summary).getByRole('link', { name: '氏名を入力してください。' })).toBeTruthy();
    const name = screen.getByLabelText(/^氏名/);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toContain('f-personal-name-error');
    // ステップは進まない
    expect(screen.getByRole('heading', { level: 1, name: '基本情報' })).toBeTruthy();
  });

  it('入力を直すとエラーが消え、次のステップへ進める', async () => {
    const user = start();
    await user.click(next());
    await fillBasic(user);

    expect(screen.queryByRole('alert')).toBeNull();
    // 全角数字は半角に、ひらがなはカタカナにそろえる
    expect((screen.getByLabelText(/^電話番号/) as HTMLInputElement).value).toBe('090-1234-5678');
    expect((screen.getByLabelText(/^フリガナ/) as HTMLInputElement).value).toBe('ヤマダ タロウ');

    await user.click(next());
    expect(screen.getByRole('heading', { level: 1, name: '学歴' })).toBeTruthy();
  });

  it('学歴を追加・削除できる', async () => {
    const user = start();
    await fillBasic(user);
    await goNext(user);

    await addEntry(user, '学歴を追加');
    await addEntry(user, '学歴を追加');
    expect(screen.getByRole('heading', { name: '学歴 2' })).toBeTruthy();

    await user.type(screen.getByLabelText('学歴 1 の年（西暦）'), '２００１');
    await user.type(screen.getByLabelText('学歴 1 の月'), '4');
    expect((screen.getByLabelText('学歴 1 の年（西暦）') as HTMLInputElement).value).toBe('2001');

    await user.click(screen.getByRole('button', { name: '学歴 2 を削除' }));
    expect(screen.queryByRole('heading', { name: '学歴 2' })).toBeNull();
  });

  it('学歴で「入学」を選ぶと、学校名を写した「卒業」の行が追加される', async () => {
    const user = start();
    await fillBasic(user);
    await goNext(user);
    await addEntry(user, '学歴を追加');
    await user.type(screen.getByLabelText('学校名'), '○○高等学校');
    await user.selectOptions(screen.getByLabelText('区分'), '入学');

    expect(screen.getByRole('heading', { name: '学歴 2' })).toBeTruthy();
    const schools = screen.getAllByLabelText('学校名') as HTMLInputElement[];
    expect(schools.map((s) => s.value)).toEqual(['○○高等学校', '○○高等学校']);
    const categories = screen.getAllByLabelText('区分') as HTMLSelectElement[];
    expect(categories.map((c) => c.value)).toEqual(['入学', '卒業']);
  });

  it('職歴で「入社」を選ぶと「退職」の行が追加され、退職の行を消すと「現在に至る」になる', async () => {
    const user = start();
    await fillBasic(user);
    await user.click(next());
    await goNext(user);
    await addEntry(user, '職歴を追加');
    await user.type(screen.getByLabelText('会社名'), '株式会社○○');
    await user.selectOptions(screen.getByLabelText('区分'), '入社');
    expect((screen.getAllByLabelText('区分') as HTMLSelectElement[]).map((c) => c.value)).toEqual(['入社', '退職']);
    expect((screen.getAllByLabelText('会社名') as HTMLInputElement[])[1]!.value).toBe('株式会社○○');

    await user.click(screen.getByRole('button', { name: '職歴 2 を削除' }));
    for (let i = 0; i < 3; i++) await user.click(next());
    expect(screen.getByRole('heading', { level: 1, name: '入力内容を確認してください' })).toBeTruthy();
    expect(screen.getByText('現在に至る')).toBeTruthy();
  });

  it('月だけ入力した行はエラーにする', async () => {
    const user = start();
    await fillBasic(user);
    await goNext(user);
    await addEntry(user, '学歴を追加');
    await user.type(screen.getByLabelText('学歴 1 の月'), '4');
    await user.click(next());
    expect(within(screen.getByRole('alert')).getByText('月を入力した場合は、年も入力してください。')).toBeTruthy();
  });

  it('確認画面から「履歴書を作成する」でPDFを作成し、完了画面を表示する', async () => {
    vi.mocked(createPdf).mockResolvedValue(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));
    const user = start();
    await fillBasic(user);
    for (let i = 0; i < 5; i++) await user.click(next());
    expect(screen.getByRole('heading', { level: 1, name: '入力内容を確認してください' })).toBeTruthy();
    expect(screen.getByText('山田 太郎（ヤマダ タロウ）')).toBeTruthy();
    // 既定の構成（PDFもブラウザで作る）では、送信しないことを説明する
    expect(screen.getByText(/入力内容をサーバーへ送信することはありません/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '履歴書を作成する' }));

    expect(await screen.findByRole('heading', { level: 1, name: '履歴書を作成しました' })).toBeTruthy();
    expect(createPdf).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createPdf).mock.calls[0]![0].personal.phone).toBe('090-1234-5678');
    expect(screen.getByRole('button', { name: 'PDFをダウンロード' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'CSVをダウンロード' })).toBeTruthy();
  });

  it('PDFの作成に失敗したら、入力内容を残したままエラーを表示する', async () => {
    vi.mocked(createPdf).mockRejectedValue(new PdfRequestError('font'));
    const user = start();
    await fillBasic(user);
    for (let i = 0; i < 5; i++) await user.click(next());
    await user.click(screen.getByRole('button', { name: '履歴書を作成する' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('PDFを作成できませんでした')).toBeTruthy();
    expect(within(alert).getByText(/フォントを読み込めませんでした/)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '入力内容を確認してください' })).toBeTruthy();
  });

  it('入力内容を LocalStorage などに保存しない', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const user = start();
    await fillBasic(user);
    await user.click(next());
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    // URL にも個人情報を含めない
    expect(window.location.href).not.toContain('taro');
  });
});

describe('トップページ', () => {
  it('「履歴書を入力する」から入力フォームへ進む', async () => {
    const user = start('/');
    await user.click(screen.getByRole('link', { name: '履歴書を入力する' }));
    expect(window.location.pathname).toBe('/form');
    expect(screen.getByRole('heading', { level: 1, name: '基本情報' })).toBeTruthy();
  });

  it('保存したJSONから再開できる', async () => {
    const user = start('/');
    const file = new File([JSON.stringify({ version: '1.0', createdAt: '2026-01-05', personal: { name: '山田 花子' } })], 'r.json', {
      type: 'application/json',
    });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, file);
    expect(await screen.findByRole('heading', { level: 1, name: '基本情報' })).toBeTruthy();
    expect((screen.getByLabelText(/^氏名/) as HTMLInputElement).value).toBe('山田 花子');
  });
});
