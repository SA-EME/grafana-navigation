# Changelog

## 1.2.0 (Unreleased)

### Features

- feat: implement navigation panel

  - Centralized navigation panel with hierarchical section tree
  - Support for home link, standalone top-level links, and nested sections
  - Collapsible sections with active link highlighting and breadcrumb display
  - Dashboard links (via UID) and external URL links, each with optional icon
  - Integrated search system with SQL data source support (PostgreSQL, MySQL, MSSQL)
  - Multi-variable search: map multiple DataFrame columns to separate Grafana variables
  - Static variables support for passing fixed values to dashboards
  - Font size adapts automatically based on panel width
  - Link reordering (move up / move down) in sections and sub-sections

## 1.1.0 (Unreleased)

### Features

- Initial plugin scaffold with app plugin and panel plugin structure
- Plugin configuration page (AppConfig) wired to Grafana plugin settings API

## 1.0.0 (Unreleased)

Initial release.
