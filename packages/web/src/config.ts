/** サービス名（仮称）。変更する場合はここと index.html の <title> を書き換える */
export const SERVICE_NAME = '履歴書データ化';

/** 広告ページのURL（別オリジン）。未設定なら広告枠を表示しない */
export const AD_URL: string = import.meta.env.VITE_AD_URL ?? '';
