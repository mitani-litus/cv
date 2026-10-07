import { createEmptyEmployment, LIMITS, type EmploymentEntry } from '@cv/schema';
import { Entries } from '../components/Entries';
import { TextField, YearMonthField } from '../components/Field';

export function EmploymentStep({ value, onChange }: { value: EmploymentEntry[]; onChange: (value: EmploymentEntry[]) => void }) {
  return (
    <Entries
      label="職歴"
      items={value}
      onChange={onChange}
      createEmpty={createEmptyEmployment}
      hint="1つの会社につき1件入力します。履歴書には「入社」と「退職」の2行で記載されます。現在も在職中の場合は、退職を空欄にしてください（履歴書には「現在に至る」と記載されます）。"
      renderItem={(item, i, update) => (
        <>
          <TextField path={`employment.${i}.company`} label="会社名" maxLength={LIMITS.entryText} value={item.company} onChange={(company) => update({ company })} />
          <div className="app-row">
            <TextField path={`employment.${i}.department`} label="部署" optional maxLength={LIMITS.entryText} value={item.department} onChange={(department) => update({ department })} />
            <TextField path={`employment.${i}.position`} label="役職・職種" optional maxLength={LIMITS.entryText} value={item.position} onChange={(position) => update({ position })} />
          </div>
          <div className="app-inline" style={{ gap: '8px 24px', alignItems: 'flex-start' }}>
            <YearMonthField path={`employment.${i}.start`} legend="入社" name={`職歴 ${i + 1} の入社`} year={item.start.year} month={item.start.month} onChange={(year, month) => update({ start: { year, month } })} />
            <YearMonthField
              path={`employment.${i}.end`}
              legend="退職（在職中は空欄）"
              name={`職歴 ${i + 1} の退職`}
              year={item.end.year}
              month={item.end.month}
              onChange={(year, month) => update({ end: { year, month } })}
            />
          </div>
          <TextField
            path={`employment.${i}.note`}
            label="業務内容"
            optional
            support="短く書けます（例：法人営業を担当）"
            maxLength={LIMITS.note}
            value={item.note}
            onChange={(note) => update({ note })}
          />
        </>
      )}
    />
  );
}
