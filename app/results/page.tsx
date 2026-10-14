'use client';

import PageLayout from '@/app/components/page-layout';
import Results from '@/app/components/results';

export default function ResultsPage() {
  return <PageLayout render={({ info, onUpdate }) => <Results info={info} onChange={onUpdate} />} />;
}
