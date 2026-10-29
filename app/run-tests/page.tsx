import { redirect } from 'next/navigation';

// Run Tests moved under Test Runs → Automated; keep old links working.
export default function RunTestsPage() {
  redirect('/runs/automated');
}
