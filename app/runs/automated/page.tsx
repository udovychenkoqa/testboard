import RunTests from '@/app/components/run-tests';

// Autotest triggering (Drone) — any signed-in user; /api/autotests/trigger is
// gated by the run:tests capability.
export default function AutomatedRunsPage() {
  return <RunTests embedded />;
}
