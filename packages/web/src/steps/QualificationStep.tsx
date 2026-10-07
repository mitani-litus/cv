import { createEmptyQualification, LIMITS, type QualificationEntry } from '@cv/schema';
import { Entries } from '../components/Entries';
import { TextField, YearMonthField } from '../components/Field';

export function QualificationStep({ value, onChange }: { value: QualificationEntry[]; onChange: (value: QualificationEntry[]) => void }) {
  return (
    <Entries
      label="資格・免許"
      items={value}
      onChange={onChange}
      createEmpty={createEmptyQualification}
      hint="何も入力していない行は、履歴書に含まれません。"
      renderItem={(item, i, update) => (
        <>
          <YearMonthField path={`qualifications.${i}`} legend="取得年月" name={`資格・免許 ${i + 1}`} year={item.year} month={item.month} onChange={(year, month) => update({ year, month })} />
          <TextField path={`qualifications.${i}.name`} label="資格・免許名" support="正式な名称で入力してください" maxLength={LIMITS.entryText} value={item.name} onChange={(name) => update({ name })} />
          <TextField path={`qualifications.${i}.note`} label="備考" optional maxLength={LIMITS.note} value={item.note} onChange={(note) => update({ note })} />
        </>
      )}
    />
  );
}
