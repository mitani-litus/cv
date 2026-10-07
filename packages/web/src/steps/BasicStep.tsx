import { toHalfWidthDigits } from '@cv/core';
import { LIMITS, PREFECTURES, type Resume } from '@cv/schema';
import { CheckboxField, DateField, SelectField, TextField } from '../components/Field';
import { toKatakana } from '../lib/kana';

type Personal = Resume['personal'];
type Layout = Resume['layout'];
type Value = Pick<Resume, 'personal' | 'layout'>;

export function BasicStep({ value: { personal: value, layout }, onChange }: { value: Value; onChange: (value: Value) => void }) {
  const set = <K extends keyof Personal>(key: K, v: Personal[K]) => onChange({ layout, personal: { ...value, [key]: v } });
  const setAddress = <K extends keyof Personal['address']>(key: K, v: Personal['address'][K]) =>
    onChange({ layout, personal: { ...value, address: { ...value.address, [key]: v } } });
  const setLayout = <K extends keyof Layout>(key: K, v: Layout[K]) => {
    // 性別欄をやめたときは、入力した性別も消す（PDFやJSONに残さない）
    const personal = key === 'genderField' && !v ? { ...value, gender: '' } : value;
    onChange({ personal, layout: { ...layout, [key]: v } });
  };

  return (
    <div className="app-form">
      <fieldset className="app-fieldset">
        <legend>履歴書に設ける欄</legend>
        <CheckboxField
          path="layout.photoBox"
          label="写真をはる欄を設ける"
          support="PDFの氏名の右に、写真をはる欄（縦40mm×横30mm）を空欄で設けます。写真は印刷した履歴書にはってください（このサービスでは写真を扱いません）。"
          checked={layout.photoBox}
          onChange={(v) => setLayout('photoBox', v)}
        />
        <CheckboxField
          path="layout.genderField"
          label="性別欄を設ける"
          support="性別の記載は任意です。欄を設けて、空欄のままにすることもできます。"
          checked={layout.genderField}
          onChange={(v) => setLayout('genderField', v)}
        />
      </fieldset>

      <div className="app-row">
        <TextField path="personal.name" label="氏名" required autoComplete="name" maxLength={LIMITS.name} value={value.name} onChange={(v) => set('name', v)} />
        <TextField
          path="personal.nameKana"
          label="フリガナ"
          required
          support="カタカナで入力してください（ひらがなは自動でカタカナにします）"
          maxLength={LIMITS.nameKana}
          value={value.nameKana}
          onChange={(v) => set('nameKana', v)}
          normalize={toKatakana}
        />
      </div>

      <DateField
        path="personal.birthDate"
        legend="生年月日"
        value={value.birthDate}
        onChange={(v) => set('birthDate', v)}
        support="年は西暦で入力してください。年齢は、履歴書の日付をもとに自動で計算します。"
      />

      {layout.genderField && (
        <TextField
          path="personal.gender"
          label="性別"
          optional
          support="自由に記載できます。空欄のままでも構いません。"
          className="w-gender"
          maxLength={LIMITS.gender}
          value={value.gender}
          onChange={(v) => set('gender', v)}
          normalize={(v) => v.trim()}
        />
      )}

      <fieldset className="app-fieldset">
        <legend>住所</legend>
        <TextField
          path="personal.postalCode"
          label="郵便番号"
          support="ハイフンはなくても構いません（例：1000001）"
          className="w-postal"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={8}
          value={value.postalCode}
          onChange={(v) => set('postalCode', v)}
          normalize={(v) => toHalfWidthDigits(v).trim()}
        />
        <div className="app-row">
          <SelectField
            path="personal.address.prefecture"
            label="都道府県"
            plainLabel
            width="100%"
            autoComplete="address-level1"
            options={PREFECTURES}
            value={value.address.prefecture}
            onChange={(v) => setAddress('prefecture', v)}
          />
          <TextField path="personal.address.city" label="市区町村" autoComplete="address-level2" maxLength={LIMITS.city} value={value.address.city} onChange={(v) => setAddress('city', v)} />
        </div>
        <TextField path="personal.address.street" label="町名・番地" autoComplete="address-line1" maxLength={LIMITS.street} value={value.address.street} onChange={(v) => setAddress('street', v)} />
        <TextField path="personal.address.building" label="建物名・部屋番号" autoComplete="address-line2" maxLength={LIMITS.building} value={value.address.building} onChange={(v) => setAddress('building', v)} />
      </fieldset>

      <div className="app-row">
        <TextField
          path="personal.phone"
          label="電話番号"
          required
          support="日中に連絡がつく番号（例：090-1234-5678）"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={LIMITS.phone}
          value={value.phone}
          onChange={(v) => set('phone', v)}
          normalize={(v) => toHalfWidthDigits(v).trim()}
        />
        <TextField
          path="personal.email"
          label="メールアドレス"
          required
          support="例：taro@example.jp"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={LIMITS.email}
          value={value.email}
          onChange={(v) => set('email', v)}
          normalize={(v) => v.trim()}
        />
      </div>
    </div>
  );
}
