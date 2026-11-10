import { avatarColor, projectInitials } from '@/app/lib/tm/avatar';
import { withBase } from '@/app/lib/url';

const SIZES = {
  sm: 'h-7 w-7 rounded-md text-[10px]',
  md: 'h-9 w-9 rounded-lg text-[11.5px]',
  lg: 'h-16 w-16 rounded-xl text-[17px]',
} as const;

export const projectLogoUrl = (key: string, logoUpdatedAt: string) =>
  withBase(`/api/tm/projects/${encodeURIComponent(key)}/logo?v=${encodeURIComponent(logoUpdatedAt)}`);

// The uploaded logo when there is one, otherwise initials on a colour from the project key.
export const ProjectAvatar: React.FC<{
  project: { key: string; name: string; code: string; logoUpdatedAt?: string | null };
  size?: keyof typeof SIZES;
}> = ({ project, size = 'md' }) =>
  project.logoUpdatedAt ? (
    <img
      alt=""
      className={`shrink-0 object-cover ${SIZES[size]}`}
      src={projectLogoUrl(project.key, project.logoUpdatedAt)}
    />
  ) : (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center font-semibold tracking-wide ${SIZES[size]} ${avatarColor(project.key)}`}
    >
      {projectInitials(project.name, project.code)}
    </span>
  );
