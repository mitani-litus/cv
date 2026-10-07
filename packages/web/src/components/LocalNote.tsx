import { Icon } from './Icon';

/** 入力内容が端末内だけにあることの説明と、途中保存ボタン */
export function LocalNote({ onSave }: { onSave: () => void }) {
  return (
    <div className="app-local">
      <p className="app-local__text">
        <Icon name="device" />
        <span>入力内容は、この端末のブラウザの中だけに保持されています。ページを閉じると消えるため、中断するときは保存してください。</span>
      </p>
      <button className="bb-button" data-type="text" data-size="sm" type="button" onClick={onSave}>
        <Icon name="download" />
        入力データを保存（JSON）
      </button>
    </div>
  );
}
