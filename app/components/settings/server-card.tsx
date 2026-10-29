import { Server } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ServerInfo {
  dataFolderSizeinMB: string;
  numOfResults: number;
  resultsFolderSizeinMB: string;
  numOfReports: number;
  reportsFolderSizeinMB: string;
  availableSpace?: string;
}

interface EnvInfo {
  authRequired?: boolean;
  dataStorage?: string;
}

// Compact KPI tile: mono value, muted label, optional secondary line (disk size).
const StatTile: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode }> = ({
  label,
  value,
  sub,
}) => (
  <div className="flex flex-col gap-0.5 px-4 py-3">
    <span className="text-[10px] uppercase tracking-wide text-default-400">{label}</span>
    <span className="font-mono text-xl font-semibold leading-none tabular-nums">{value}</span>
    {sub != null && <span className="font-mono text-[11px] text-default-500">{sub}</span>}
  </div>
);

interface ServerCardProps {
  serverInfo: ServerInfo | null;
  envInfo: EnvInfo | null;
}

export function ServerCard({ serverInfo, envInfo }: Readonly<ServerCardProps>) {
  const t = useTranslations('settings.server');

  if (!serverInfo) return null;

  const tiles = [
    { label: t('reports'), value: serverInfo.numOfReports, sub: serverInfo.reportsFolderSizeinMB },
    { label: t('results'), value: serverInfo.numOfResults, sub: serverInfo.resultsFolderSizeinMB },
    { label: t('totalData'), value: serverInfo.dataFolderSizeinMB },
    ...(serverInfo.availableSpace ? [{ label: t('freeSpace'), value: serverInfo.availableSpace }] : []),
    ...(envInfo?.dataStorage ? [{ label: t('storage'), value: envInfo.dataStorage }] : []),
  ];

  const footerChips = [
    envInfo?.dataStorage && `storage: ${envInfo.dataStorage}`,
    `auth: ${envInfo?.authRequired ? 'required' : 'open'}`,
  ].filter(Boolean) as string[];

  return (
    <section className="scroll-mt-3 overflow-hidden rounded-xl border border-divider bg-content1" id="server">
      <div className="flex h-10 items-center gap-2 border-b border-divider px-4">
        <Server className="text-primary" size={15} />
        <span className="text-[13px] font-semibold">{t('title')}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile, i) => (
          <div key={tile.label} className={i > 0 ? 'border-l border-divider' : ''}>
            <StatTile label={tile.label} sub={'sub' in tile ? tile.sub : undefined} value={tile.value} />
          </div>
        ))}
      </div>

      {footerChips.length > 0 && (
        <div className="flex items-center gap-2 border-t border-divider bg-content2 px-4 py-2">
          {footerChips.map((chip) => (
            <span
              key={chip}
              className="rounded-md bg-default-100 px-1.5 py-0.5 font-mono text-[10.5px] text-default-600"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
