import { createEmptyEducation, EDUCATION_CATEGORIES, LIMITS, type EducationEntry } from '@cv/schema';
import { Entries } from '../components/Entries';
import { SelectField, TextField, YearMonthField } from '../components/Field';
import { setEducationCategory, setEducationText } from '../lib/pairing';

export function EducationStep({ value, onChange }: { value: EducationEntry[]; onChange: (value: EducationEntry[]) => void }) {
  return (
    <Entries
      label="学歴"
      items={value}
      onChange={onChange}
      createEmpty={createEmptyEducation}
      hint="区分で「入学」を選ぶと、「卒業」の行を自動で追加します。中途退学などの場合は、追加された行の区分を変えてください。"
      renderItem={(item, i, update) => (
        <>
          <div className="app-inline" style={{ gap: '8px 24px', alignItems: 'flex-start' }}>
            <YearMonthField path={`education.${i}`} legend="年月" name={`学歴 ${i + 1}`} year={item.year} month={item.month} onChange={(year, month) => update({ year, month })} />
            <SelectField path={`education.${i}.category`} label="区分" options={EDUCATION_CATEGORIES} value={item.category} onChange={(category) => onChange(setEducationCategory(value, i, category))} />
          </div>
          <TextField path={`education.${i}.school`} label="学校名" maxLength={LIMITS.entryText} value={item.school} onChange={(school) => onChange(setEducationText(value, i, { school }))} />
          <TextField path={`education.${i}.department`} label="学部・学科" optional maxLength={LIMITS.entryText} value={item.department} onChange={(department) => onChange(setEducationText(value, i, { department }))} />
          <TextField path={`education.${i}.note`} label="備考" optional maxLength={LIMITS.note} value={item.note} onChange={(note) => update({ note })} />
        </>
      )}
    />
  );
}
