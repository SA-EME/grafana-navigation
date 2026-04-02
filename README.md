# Navigation Plugin for Grafana

## Overview

**Navigation** is a Grafana plugin designed to provide a **centralized and reusable navigation panel** across all dashboards.

It allows administrators to define a single navigation structure and search system from a dedicated configuration page, and reuse it everywhere without duplicating configuration.

---

## Goals

* Provide a **consistent navigation experience** across dashboards
* Avoid manual updates on multiple dashboards
* Improve **data accessibility and readability**
* Enable **fast navigation** between dashboards and external resources

---

## Key Features

### 1. Centralized Configuration

All navigation and search behavior is managed from a **single configuration page**.

Once configured, the panel can be added to any dashboard and will automatically reflect updates.

---

### 2. Reusable Navigation Panel

* Add the panel to any dashboard
* No per-dashboard configuration required
* Changes are applied globally

---

### 3. Integrated Search System

An optional search feature allows users to quickly navigate to dashboards or external resources.

#### Behavior

The search system is based on two inputs:

* **Type** → defines the search context
  (e.g. `dashboard`, `custom_ip`, `custom_host`)
* **Value** → the actual search input
  (e.g. hostname, IP, UID)

#### Example

```js
const type = $type

if ($type === 'custom_ip') {
  return [
    { value: '192.168.1.1', tag: 'PC', dashboard: 'aebbxmo4x47i8a' },
    { value: '192.168.1.2', tag: 'SWITCH', dashboard: 'fe1xiuv9vwn40f' }
  ]
} else {
  return [
    { value: 'Device01', tag: 'PC', dashboard: 'aebbxmo4x47i8a' },
    { value: 'Switch01', tag: 'SWITCH', dashboard: 'fe1xiuv9vwn40f' }
  ]
}
```

#### Data Structure

| Field       | Description                    |
| ----------- | ------------------------------ |
| `value`     | Searchable value (IP, name...) |
| `tag`       | Label/category (optional)      |
| `dashboard` | Target dashboard UID           |

---

### 4. Navigation Tree

The navigation is structured as a **hierarchical tree**.

#### Structure

* **Home Link** *(optional)*
* **Sections**
* **Links**

#### Example

```
Home
├── Infrastructure
│   ├── Servers
│   └── Network
└── Monitoring
    ├── Logs
    └── Metrics
```

#### Capabilities

* Nested sections (multi-level)
* Collapsible groups
* Dynamic or static links

---

### 5. Links

Each link supports:

* **Title**
* **Target**

  * Grafana dashboard (via UID)
  * External URL
* **Variables**

#### Variables

Links can include:

* **Dashboard variables** (e.g. `$host`)
* **Static variables** defined in plugin configuration

---

## Configuration

The plugin configuration is divided into two main sections:

### 1. Search *(optional)*

* Enable / disable search
* Define search types
* Configure data sources (recommended: Grafana Business Input plugin)

---

### 2. Navigation

* Define navigation tree
* Configure sections and links
* Set default home link

---

## Usage

1. Configure the plugin from the configuration page
2. Add the **Navigation panel** to any dashboard
3. The panel will automatically load the global configuration

---

## Current Limitations

* Navigation is currently **vertical only**
* Horizontal layout is not supported yet
* Behavior depends on Grafana routing (URL-based navigation)

---

## Recommended Integration

For advanced usage, it is recommended to use:

* Grafana **Business Input plugin** as a data source for dynamic search
* External data sources (PostgreSQL, APIs) for scalable search datasets

---

## Future Improvements

* Horizontal navigation support
* Favorites / recent dashboards
* Better variable management
* Enhanced search (multi-source aggregation)
* UI/UX improvements (icons, active state, breadcrumbs)