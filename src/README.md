# Navigation Plugin — Provisioning

This directory contains the Grafana provisioning configuration for the **saeme-navigation-app** plugin.

---

## How the plugin works

The Navigation plugin provides a **centralized navigation panel** that can be added to any Grafana dashboard. The configuration is defined once and shared across all dashboards.

### Plugin configuration (`apps.yaml`)

The plugin is provisioned with a default configuration stored in `jsonData.navConfig`. This object has three sections:

#### `homeLink` *(optional)*
A single link displayed at the top of the panel.

```yaml
homeLink:
  title: "Home"
  type: "external"   # "dashboard" (Grafana UID) or "external" (URL)
  url: "/"
```

#### `sections`
A list of collapsible navigation sections. Each section contains `items`, which can be either links or sub-sections.

**Link item:**
```yaml
- title: "My Dashboard"
  type: "dashboard"   # navigates to /d/{uid}
  uid: "abc123"
```
```yaml
- title: "External site"
  type: "external"    # opens URL (absolute = new tab, relative = same tab)
  url: "https://example.com"
```

**Sub-section item:**
```yaml
- title: "Cloud"
  items:
    - title: "AWS"
      type: "dashboard"
      uid: "aws-uid"
```

#### `search` *(optional)*
An integrated search block displayed at the top of the panel.

```yaml
search:
  enabled: true
  dataSourceUid: "saeme-postgres"   # UID of a SQL data source
  dataSourceType: "postgres"        # postgres | mysql | mssql
  types:
    - id: "custom_ip"
      label: "IP Address"
      variable: "ip"                # appended as ?var-ip={value} on navigation
      query: "SELECT value, tag, dashboard FROM my_table"
```

The SQL query must return three columns:
| Column | Type | Description |
|--------|------|-------------|
| `value` | string | The searchable value (IP, hostname…) |
| `tag` | string | Optional label shown next to the result |
| `dashboard` | string | Target dashboard UID |

---

## Panel size recommendation

Add the **Navigation Config** panel to any dashboard. The panel adapts its font size based on its width.

Recommended width: **3 to 5 columns** on Grafana's dashboard grid.

---

## Data sources

The `provisioning/datasources/` directory provisions a **PostgreSQL** data source automatically:

| Setting | Value |
|---------|-------|
| Name | PostgreSQL |
| UID | `saeme-postgres` |
| Host | `postgres:5432` |
| Database | `grafana` |
| User | `grafana` |
| Password | `grafana` |

This data source is used by the search feature. The PostgreSQL service is started automatically via `docker-compose.yaml`.

---

## References

- [Provision Grafana](https://grafana.com/docs/grafana/latest/administration/provisioning/)
- [Provision a plugin](https://grafana.com/developers/plugin-tools/publish-a-plugin/provide-test-environment)
