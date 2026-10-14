import RunTests from '@/app/components/run-tests';

// Running autotests is allowed for any signed-in user (viewer + admin) — the
// /api/autotests/trigger endpoint is gated by the run:tests capability, which
// viewers have. No role redirect here.
export default function RunTestsPage() {
  return <RunTests />;
}
