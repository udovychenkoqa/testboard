import { readDeliveryLog } from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ entries: await readDeliveryLog() });
}
