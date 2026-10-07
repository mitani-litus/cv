import { createEmptyEducation, EDUCATION_STATUSES, LIMITS, type EducationEntry } from '@cv/schema';
import { Entries } from '../components/Entries';
import { SelectField, TextField, YearMonthField } from '../components/Field';

export function EducationStep({ value, onChange }: { value: EducationEntry[]; onChange: (value: EducationEntry[]) => void }) {
  return (
    <Entries
      label="学歴"
      items={value}
      onChange={onChange}
      createEmpty={createEmptyEducation}
      hint="1つの学校につき1件入力します。履歴書には「入学」と「卒業」などの2行で記載されます。在学中の場合は、区分で「在学中」または「卒業見込」を選んでください。"
      renderItem={(item, i, update) => (
        <>
          <TextField path={`education.${i}.school`} label="学校名" maxLength={LIMITS.entryText} value={item.school} onChange={(school) => update({ school })} />
          <div className="app-row">
            <TextField path={`education.${i}.department`} label="学部・学科" optional maxLength={LIMITS.entryText} value={item.department} onChange={(department) => update({ department })} />
            <TextField
              path={`education.${i}.degree`}
              label="学位・課程"
              optional
              support="例：学士、修士、博士前期課程"
              maxLength={LIMITS.degree}
              value={item.degree}
              onChange={(degree) => update({ degree })}
            />
          </div>
          <div className="app-inline" style={{ gap: '8px 24px', alignItems: 'flex-start' }}>
            <YearMonthField path={`education.${i}.start`} legend="入学" name={`学歴 ${i + 1} の入学`} year={item.start.year} month={item.start.month} onChange={(year, month) => update({ start: { year, month } })} />
            <YearMonthField path={`education.${i}.end`} legend="卒業・修了" name={`学歴 ${i + 1} の卒業・修了`} year={item.end.year} month={item.end.month} onChange={(year, month) => update({ end: { year, month } })} />
            <SelectField path={`education.${i}.status`} label="区分" options={EDUCATION_STATUSES} value={item.status} onChange={(status) => update({ status })} />
          </div>
          <TextField path={`education.${i}.note`} label="備考" optional maxLength={LIMITS.note} value={item.note} onChange={(note) => update({ note })} />
        </>
      )}
    />
  );
}
