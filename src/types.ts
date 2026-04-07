export interface NavLink {
  title: string;
  type: 'dashboard' | 'external';
  uid?: string;
  url?: string;
}

export type NavItem = NavLink | NavSection;

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface NavConfig {
  homeLink?: NavLink;
  sections: NavSection[];
}

export const isNavSection = (item: NavItem): item is NavSection => 'items' in item;
