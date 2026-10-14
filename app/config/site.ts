interface NavItem {
  label: string;
  href: string;
}

export type HeaderLinks = Record<string, string>;

interface SiteConfig {
  name: string;
  description: string;
  navItems: NavItem[];
  navMenuItems: NavItem[];
  links: HeaderLinks;
}

export const defaultLinks: HeaderLinks = {};

export const siteConfig: SiteConfig = {
  name: 'Testboard',
  description: 'Playwright test reports dashboard',
  navItems: [
    { label: 'Reports', href: '/reports' },
    { label: 'Results', href: '/results' },
    { label: 'Trends', href: '/trends' },
    { label: 'Run Tests', href: '/run-tests' },
  ],
  navMenuItems: [
    { label: 'Reports', href: '/reports' },
    { label: 'Results', href: '/results' },
    { label: 'Trends', href: '/trends' },
    { label: 'Run Tests', href: '/run-tests' },
  ],
  links: defaultLinks,
};
