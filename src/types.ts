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
  column: string;   // DataFrame column name
  variable: string; // Grafana variable name (?var-{variable}={value})
}

export interface SearchType {
  id: string;               // unique identifier for this search type
  label: string;            // displayed in the type selector
  variable: string;         // primary Grafana variable — maps the 'value' column (?var-{variable}={value})
  extraVariables?: SearchTypeVariable[];  // additional column → Grafana variable mappings
  query?: string;           // SQL query used to fetch results
}

export interface SearchConfig {
  enabled: boolean;
  dataSourceUid: string;
  dataSourceType: string;   // Grafana data source type (e.g. postgres, grafana-postgresql-datasource)
  types: SearchType[];
}

// Supported SQL data source types (legacy names + official Grafana plugin IDs)
export const SQL_DS_TYPES = [
  'postgres', 'mysql', 'mssql',
  'grafana-postgresql-datasource',
  'grafana-mysql-datasource',
  'grafana-mssql-datasource',
];

export interface NavConfig {
  homeLink?: NavLink;
  topLinks?: NavLink[];   // standalone links shown between the home link and sections
  sections: NavSection[];
  search?: SearchConfig;
  staticVars?: Record<string, string>;
}

export const isNavSection = (item: NavItem): item is NavSection => 'items' in item;
