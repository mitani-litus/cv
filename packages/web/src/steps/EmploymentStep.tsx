import { createEmptyEmployment, EMPLOYMENT_CATEGORIES, LIMITS, type EmploymentEntry } from '@cv/schema';
import { Entries } from '../components/Entries';
import { SelectField, TextField, YearMonthField } from '../components/Field';

export function EmploymentStep({ value, onChange }: { value: EmploymentEntry[]; onChange: (value: EmploymentEntry[]) => void }) {
  return (
    <Entries
      label="職歴"
      items={value}
      onChange={onChange}
      createEmpty={createEmptyEmployment}
      hint="現在も在籍している場合は、入社の行だけで構いません。職歴がない場合は、何も入力せずに次へ進めます。"
      renderItem={(item, i, update) => (
        <>
          <div className="app-inline" style={{ gap: '8px 24px', alignItems: 'flex-start' }}>
            <YearMonthField path={`employment.${i}`} legend="年月" name={`職歴 ${i + 1}`} year={item.year} month={item.month} onChange={(year, month) => update({ year, month })} />
            <SelectField path={`employment.${i}.category`} label="区分" options={EMPLOYMENT_CATEGORIES} value={item.category} onChange={(category) => update({ category })} />
          </div>
          <TextField path={`employment.${i}.company`} label="会社名" maxLength={LIMITS.entryText} value={item.company} onChange={(company) => update({ company })} />
          <div className="app-row">
            <TextField path={`employment.${i}.department`} label="部署" optional maxLength={LIMITS.entryText} value={item.department} onChange={(department) => update({ department })} />
            <TextField path={`employment.${i}.position`} label="役職" optional maxLength={LIMITS.entryText} value={item.position} onChange={(position) => update({ position })} />
          </div>
          <TextField
            path={`employment.${i}.note`}
            label="備考"
            optional
            support="業務内容などを短く書けます（例：法人営業を担当）"
            maxLength={LIMITS.note}
            value={item.note}
            onChange={(note) => update({ note })}
          />
        </>
      )}
    />
  );
}
