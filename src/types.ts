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

export interface SearchType {
  id: string;        // identifiant = nom du frame dans la data source (Business Input) ou refId
  label: string;     // affiché dans le sélecteur de type
  variable: string;  // variable Grafana passée dans l'URL (?var-{variable}={value})
  query?: string;    // SQL query (pour SQL) ou JSON query object stringifié (pour autres)
}

export interface SearchConfig {
  enabled: boolean;
  dataSourceUid: string;
  dataSourceType: string;  // type Grafana de la data source (postgres, mysql, etc.)
  types: SearchType[];
}

// Data sources SQL supportées
export const SQL_DS_TYPES = ['postgres', 'mysql', 'mssql'];

export interface NavConfig {
  homeLink?: NavLink;
  sections: NavSection[];
  search?: SearchConfig;
}

export const isNavSection = (item: NavItem): item is NavSection => 'items' in item;
