import { toHalfWidthDigits } from '@cv/core';
import { LIMITS, PREFECTURES, type Resume } from '@cv/schema';
import { DateField, SelectField, TextField } from '../components/Field';
import { toKatakana } from '../lib/kana';

type Personal = Resume['personal'];

export function BasicStep({ value, onChange }: { value: Personal; onChange: (value: Personal) => void }) {
  const set = <K extends keyof Personal>(key: K, v: Personal[K]) => onChange({ ...value, [key]: v });
  const setAddress = <K extends keyof Personal['address']>(key: K, v: Personal['address'][K]) =>
    onChange({ ...value, address: { ...value.address, [key]: v } });

  return (
    <div className="app-form">
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
