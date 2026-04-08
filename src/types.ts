export interface NavLink {
  title: string;
  type: 'dashboard' | 'external';
  uid?: string;
  url?: string;
  icon?: string;
}

export type NavItem = NavLink | NavSection;

export interface NavSection {
  title: string;
  items: NavItem[];
  icon?: string;
}

export interface SearchTypeVariable {
  column: string;   // nom de la colonne dans le DataFrame
  variable: string; // nom de la variable Grafana (?var-{variable}={valeur})
}

export interface SearchType {
  id: string;        // identifiant = nom du frame dans la data source (Business Input) ou refId
  label: string;     // affiché dans le sélecteur de type
  variable: string;  // variable Grafana principale — mappe la colonne 'value' (?var-{variable}={value})
  extraVariables?: SearchTypeVariable[];  // variables additionnelles : colonne → variable Grafana
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
  topLinks?: NavLink[];   // liens hors section (affichés entre Home et les sections)
  sections: NavSection[];
  search?: SearchConfig;
  staticVars?: Record<string, string>;
}

export const isNavSection = (item: NavItem): item is NavSection => 'items' in item;
