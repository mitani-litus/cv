import { createEmptyEducation, EDUCATION_CATEGORIES, LIMITS, type EducationEntry } from '@cv/schema';
import { Entries } from '../components/Entries';
import { SelectField, TextField, YearMonthField } from '../components/Field';

export function EducationStep({ value, onChange }: { value: EducationEntry[]; onChange: (value: EducationEntry[]) => void }) {
  return (
    <Entries
      label="学歴"
      items={value}
      onChange={onChange}
      createEmpty={createEmptyEducation}
      hint="学歴がない場合や、記載したくない場合は、何も入力せずに次へ進めます。"
      renderItem={(item, i, update) => (
        <>
          <div className="app-inline" style={{ gap: '8px 24px', alignItems: 'flex-start' }}>
            <YearMonthField path={`education.${i}`} legend="年月" name={`学歴 ${i + 1}`} year={item.year} month={item.month} onChange={(year, month) => update({ year, month })} />
            <SelectField path={`education.${i}.category`} label="区分" options={EDUCATION_CATEGORIES} value={item.category} onChange={(category) => update({ category })} />
          </div>
          <TextField path={`education.${i}.school`} label="学校名" maxLength={LIMITS.entryText} value={item.school} onChange={(school) => update({ school })} />
          <TextField path={`education.${i}.department`} label="学部・学科" optional maxLength={LIMITS.entryText} value={item.department} onChange={(department) => update({ department })} />
          <TextField path={`education.${i}.note`} label="備考" optional maxLength={LIMITS.note} value={item.note} onChange={(note) => update({ note })} />
        </>
      )}
    />
  );
}
