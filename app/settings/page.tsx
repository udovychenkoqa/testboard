import { redirect } from 'next/navigation';

import SettingsForm from '@/app/components/settings/settings-page';
import { auth } from '@/app/auth';
import { AUTH_ENABLED } from '@/app/lib/authFlags';
import { isAdminRole } from '@/app/lib/access';
import { withBase } from '@/app/lib/url';

// Settings is admin-only. Open mode (no auth) = implicit admin, so it stays
// open there; otherwise a non-admin (viewer) is bounced to the reports home.
export default async function SettingsPage() {
  if (AUTH_ENABLED) {
    const session = await auth();

    if (!isAdminRole(session?.user?.role)) {
      redirect(withBase('/'));
    }
  }

  return <SettingsForm />;
}
