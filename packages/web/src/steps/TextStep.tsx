import { LIMITS, type Resume } from '@cv/schema';
import { TextArea } from '../components/Field';

type Texts = Pick<Resume, 'motivation' | 'selfIntroduction' | 'preferences'>;

export function TextStep({ value, onChange }: { value: Texts; onChange: (value: Texts) => void }) {
  return (
    <div className="app-form" style={{ gap: 40 }}>
      <TextArea path="motivation" label="志望動機" max={LIMITS.motivation} value={value.motivation} onChange={(motivation) => onChange({ ...value, motivation })} />
      <TextArea path="selfIntroduction" label="自己PR" max={LIMITS.selfIntroduction} value={value.selfIntroduction} onChange={(selfIntroduction) => onChange({ ...value, selfIntroduction })} />
      <TextArea
        path="preferences"
        label="本人希望"
        rows={4}
        max={LIMITS.preferences}
        support="給料・職種・勤務時間・勤務地などの希望があれば書いてください。特にない場合は「貴社の規定に従います。」と書くのが一般的です。"
        value={value.preferences}
        onChange={(preferences) => onChange({ ...value, preferences })}
      />
    </div>
  );
}
