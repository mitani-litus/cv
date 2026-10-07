import type { Resume } from '@cv/schema';
import { createEmptyResume } from '@cv/schema';
import { useState } from 'react';
import { today } from './lib/draft';
import { FormPage } from './pages/FormPage';
import { ImportPage } from './pages/ImportPage';
import { LandingPage } from './pages/LandingPage';
import { useRoute } from './router';

export function App() {
  // 入力内容はこのメモリ上にだけ置く。LocalStorage などには保存しない。
  const [resume, setResume] = useState<Resume>(() => createEmptyResume(today()));
  const route = useRoute();

  switch (route) {
    case '/form':
      return <FormPage resume={resume} onChange={setResume} />;
    case '/import':
      return <ImportPage />;
    default:
      return <LandingPage onResume={setResume} />;
  }
}
