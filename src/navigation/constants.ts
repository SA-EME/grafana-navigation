import { NavLink, NavSection, SearchType, SearchTypeVariable } from '../types';

export const LINK_TYPE_OPTIONS = [
  { label: 'Dashboard', value: 'dashboard' as const },
  { label: 'Externe', value: 'external' as const },
];

export const ICON_OPTIONS = [
  'folder', 'folder-open', 'sitemap', 'apps', 'dashboard', 'dashboards',
  'server', 'database', 'cloud', 'globe', 'external-link-alt',
  'chart-line', 'signal', 'bell', 'cog', 'wrench', 'home-alt',
  'link', 'star', 'fire', 'bolt', 'heart', 'eye', 'shield',
  'lock', 'users-alt', 'info-circle', 'exclamation-triangle',
].map((name) => ({ label: name, value: name }));

export const emptyLink = (): NavLink => ({ title: '', type: 'dashboard', uid: '' });
export const emptySubSection = (): NavSection => ({ title: '', items: [] });
export const emptySearchType = (): SearchType => ({ id: '', label: '', variable: '' });
export const emptyExtraVar = (): SearchTypeVariable => ({ column: '', variable: '' });
