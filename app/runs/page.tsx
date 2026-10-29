import { redirect } from 'next/navigation';

export default function RunsIndex() {
  redirect('/runs/manual');
}
