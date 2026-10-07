/** サービス名（仮称）。変更する場合はここと index.html の <title> を書き換える */
export const SERVICE_NAME = '履歴書データ化';

/** 広告ページのURL（別オリジン）。未設定なら広告枠を表示しない */
export const AD_URL: string = import.meta.env.VITE_AD_URL ?? '';

/**
 * PDF作成APIのURL。未設定なら、PDFもブラウザの中で作る（入力内容をどこにも送信しない）。
 * AWS（Lambda）でPDFを作る構成では "/api/pdf" を設定する（.env.aws）。
 */
export const PDF_API: string = import.meta.env.VITE_PDF_API ?? '';

/** PDFをブラウザの中で作るか（true なら、入力内容は端末の外に出ない） */
export const PDF_IN_BROWSER = PDF_API === '';
