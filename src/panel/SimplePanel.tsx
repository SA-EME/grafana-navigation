import React, { useEffect, useRef, useState } from 'react';
import { lastValueFrom } from 'rxjs';
import { css } from '@emotion/css';
import { GrafanaTheme2, PanelProps } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { isNavSection, NavConfig, NavItem, NavLink, SearchType } from '../types';

const PLUGIN_ID = 'saeme-navigation-app';

export interface SimplePanelOptions {}

const getFontSize = (width: number): number => Math.max(11, Math.min(14, Math.round(width / 30)));

// ── Data source query helpers ────────────────────────────────────────────────

interface SearchResult {
  value: string;
  tag?: string;
  dashboard: string;
}

function parseDataFrames(responseData: unknown): SearchResult[] {
  const results: SearchResult[] = [];
  try {
    const data = responseData as Record<string, unknown>;
    const queryResult = (data?.results as Record<string, unknown>)?.A as Record<string, unknown>;
    const frames = queryResult?.frames as Array<Record<string, unknown>>;

    if (!Array.isArray(frames)) {
      return results;
    }

    for (const frame of frames) {
      const schema = frame.schema as Record<string, unknown>;
      const fields = schema?.fields as Array<{ name: string }>;
      const values = (frame.data as Record<string, unknown>)?.values as unknown[][];
      if (!Array.isArray(fields) || !Array.isArray(values)) { continue; }

      const valueIdx = fields.findIndex((f) => f.name === 'value');
      const tagIdx = fields.findIndex((f) => f.name === 'tag');
      const dashboardIdx = fields.findIndex((f) => f.name === 'dashboard');

      if (valueIdx === -1 || dashboardIdx === -1) {
        continue;
      }

      const rowCount = (values[valueIdx] as unknown[])?.length ?? 0;
      for (let i = 0; i < rowCount; i++) {
        const value = String(values[valueIdx][i] ?? '');
        const dashboard = String(values[dashboardIdx][i] ?? '');
        const tag = tagIdx !== -1 ? String(values[tagIdx][i] ?? '') : undefined;
        if (value && dashboard) {
          results.push({ value, tag, dashboard });
        }
      }
    }
  } catch {
    // malformed response
  }
  return results;
}

function buildQuery(
  dataSourceUid: string,
  query?: string
): Record<string, unknown> {
  return {
    refId: 'A',
    datasource: { uid: dataSourceUid },
    rawSql: query ?? '',
    format: 'table',
  };
}

async function queryDataSource(dataSourceUid: string, query?: string): Promise<SearchResult[]> {
  const now = Date.now();
  const body = {
    queries: [buildQuery(dataSourceUid, query)],
    from: String(now - 3600000),
    to: String(now),
  };
  const response = await lastValueFrom(
    getBackendSrv().fetch<unknown>({ url: '/api/ds/query', method: 'POST', data: body })
  );
  return parseDataFrames(response?.data);
}

// ── Main component ───────────────────────────────────────────────────────────

export const SimplePanel: React.FC<PanelProps<SimplePanelOptions>> = ({ width, replaceVariables }) => {
  const fontSize = getFontSize(width);
  const s = useStyles2(getStyles, fontSize);

  const [config, setConfig] = useState<NavConfig | null>(null);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  // Search state
  const [selectedType, setSelectedType] = useState<SearchType | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getBackendSrv()
      .get(`/api/plugins/${PLUGIN_ID}/settings`)
      .then((res) => {
        const navConfig: NavConfig = res.jsonData?.navConfig ?? { sections: [] };
        setConfig(navConfig);
        const keys = new Set<string>();
        navConfig.sections.forEach((sec, si) => {
          keys.add(String(si));
          sec.items.forEach((item, ii) => {
            if (isNavSection(item)) { keys.add(`${si}-${ii}`); }
          });
        });
        setOpenKeys(keys);
        // Pré-sélectionner le premier type de recherche
        if (navConfig.search?.enabled && navConfig.search.types.length > 0) {
          setSelectedType(navConfig.search.types[0]);
        }
      })
      .catch(() => setConfig({ sections: [] }));
  }, []);

  // Fermer le dropdown si clic en dehors
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Charger les résultats quand le type change
  useEffect(() => {
    if (!selectedType || !config?.search?.dataSourceUid) { return; }
    setLoadingResults(true);
    setAllResults([]);
    setSearchInput('');
    queryDataSource(config.search.dataSourceUid, selectedType.query)
      .then(setAllResults)
      .catch(() => setAllResults([]))
      .finally(() => setLoadingResults(false));
  }, [selectedType, config?.search?.dataSourceUid]);

  const filteredResults = searchInput.trim()
    ? allResults.filter((r) =>
        r.value.toLowerCase().includes(searchInput.toLowerCase()) ||
        r.tag?.toLowerCase().includes(searchInput.toLowerCase())
      )
    : allResults;

  const navigateToResult = (result: SearchResult) => {
    if (!selectedType) { return; }
    const resolvedDashboard = resolveVars(result.dashboard);
    const varParam = selectedType.variable
      ? `?var-${encodeURIComponent(selectedType.variable)}=${encodeURIComponent(result.value)}`
      : '';
    window.location.href = `/d/${resolvedDashboard}${varParam}`;
  };

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  // Résout les variables statiques puis les variables Grafana dans une chaîne
  const resolveVars = (str: string): string => {
    let result = str;
    const statics = config?.staticVars ?? {};
    // Remplace ${ var } et $var (non suivi d'un caractère de mot)
    Object.entries(statics).forEach(([key, val]) => {
      result = result.replace(
        new RegExp(`\\$\\{${key}\\}|\\$${key}(?![a-zA-Z0-9_])`, 'g'),
        val
      );
    });
    return replaceVariables(result);
  };

  const navigate = (link: NavLink) => {
    if (link.type === 'dashboard' && link.uid) {
      window.location.href = `/d/${resolveVars(link.uid)}`;
    } else if (link.type === 'external' && link.url) {
      const resolved = resolveVars(link.url);
      if (resolved.startsWith('/')) {
        window.location.href = resolved;
      } else {
        window.open(resolved, '_blank');
      }
    }
  };

  const renderItems = (items: NavItem[], parentKey: string, depth: number): React.ReactNode =>
    items.map((item, ii) => {
      const key = `${parentKey}-${ii}`;
      if (isNavSection(item)) {
        const isOpen = openKeys.has(key);
        return (
          <div key={key} className={depth === 0 ? s.section : s.subSection}>
            <button
              className={depth === 0 ? s.sectionHeader : s.subSectionHeader}
              onClick={() => toggle(key)}
            >
              <span className={s.chevron}>{isOpen ? '▼' : '▶'}</span>
              <span className={s.itemTitle}>{item.title || 'Section sans titre'}</span>
            </button>
            {isOpen && (
              <div className={depth === 0 ? s.sectionItems : s.subSectionItems}>
                {renderItems(item.items, key, depth + 1)}
                {item.items.length === 0 && <span className={s.emptySection}>Aucun lien</span>}
              </div>
            )}
          </div>
        );
      }
      return (
        <button key={key} className={s.link} onClick={() => navigate(item)}>
          {item.title || '(lien sans titre)'}
        </button>
      );
    });

  if (!config) {
    return <div className={s.container}>Chargement...</div>;
  }

  const searchEnabled = config.search?.enabled && (config.search?.types?.length ?? 0) > 0;
  const typeOptions = config.search?.types ?? [];

  return (
    <div className={s.container}>
      {/* ── Recherche ── */}
      {searchEnabled && (
        <div className={s.searchBlock} ref={searchRef}>
          <select
            className={s.typeSelect}
            value={selectedType?.id ?? ''}
            onChange={(e) => {
              const found = typeOptions.find((t) => t.id === e.target.value) ?? null;
              setSelectedType(found);
              setShowDropdown(false);
            }}
          >
            {typeOptions.map((t) => (
              <option key={t.id} value={t.id}>{t.label || t.id}</option>
            ))}
          </select>
          <input
            className={s.searchInput}
            type="text"
            placeholder={loadingResults ? 'Chargement...' : 'Rechercher...'}
            value={searchInput}
            disabled={loadingResults}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
          />

          {showDropdown && searchInput.trim() !== '' && (
            <div className={s.dropdown}>
              {filteredResults.length === 0 ? (
                <div className={s.dropdownEmpty}>Aucun résultat</div>
              ) : (
                filteredResults.slice(0, 50).map((r, i) => (
                  <button
                    key={i}
                    className={s.dropdownItem}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      navigateToResult(r);
                    }}
                  >
                    <span className={s.resultValue}>{r.value}</span>
                    {r.tag && <span className={s.resultTag}>{r.tag}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Home link ── */}
      {config.homeLink && (
        <button className={s.homeLink} onClick={() => navigate(config.homeLink!)}>
          🏠 {config.homeLink.title || 'Home'}
        </button>
      )}

      {/* ── Sections ── */}
      {config.sections.map((section, si) => {
        const key = String(si);
        const isOpen = openKeys.has(key);
        return (
          <div key={key} className={s.section}>
            <button className={s.sectionHeader} onClick={() => toggle(key)}>
              <span className={s.chevron}>{isOpen ? '▼' : '▶'}</span>
              <span className={s.itemTitle}>{section.title || 'Section sans titre'}</span>
            </button>
            {isOpen && (
              <div className={s.sectionItems}>
                {renderItems(section.items, key, 0)}
                {section.items.length === 0 && <span className={s.emptySection}>Aucun lien</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, fontSize: number) => ({
  container: css`
    padding: ${theme.spacing(1)};
    overflow-y: auto;
    height: 100%;
    font-size: ${fontSize}px;
  `,
  // ── Search ──
  searchBlock: css`
    position: relative;
    margin-bottom: ${theme.spacing(1.5)};
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(0.75)};
  `,
  typeSelect: css`
    width: 100%;
    background: ${theme.colors.background.secondary};
    border: 1px solid ${theme.colors.border.medium};
    border-radius: ${theme.shape.radius.default};
    color: ${theme.colors.text.primary};
    font-size: ${fontSize}px;
    padding: ${theme.spacing(0.75, 1)};
    height: 32px;
    cursor: pointer;
    outline: none;
    &:focus {
      border-color: ${theme.colors.primary.border};
    }
  `,
  searchInput: css`
    width: 100%;
    box-sizing: border-box;
    background: ${theme.colors.background.secondary};
    border: 1px solid ${theme.colors.border.medium};
    border-radius: ${theme.shape.radius.default};
    color: ${theme.colors.text.primary};
    font-size: ${fontSize}px;
    padding: ${theme.spacing(0.75, 1)};
    height: 32px;
    outline: none;
    &:focus {
      border-color: ${theme.colors.primary.border};
    }
    &::placeholder {
      color: ${theme.colors.text.disabled};
    }
  `,
  dropdown: css`
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 100;
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.medium};
    border-radius: ${theme.shape.radius.default};
    box-shadow: ${theme.shadows.z2};
    max-height: 300px;
    overflow-y: auto;
    margin-top: 2px;
  `,
  dropdownEmpty: css`
    padding: ${theme.spacing(1.5)};
    color: ${theme.colors.text.secondary};
    font-size: ${fontSize}px;
    font-style: italic;
    text-align: center;
  `,
  dropdownItem: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: ${theme.spacing(1, 1.5)};
    cursor: pointer;
    font-size: ${fontSize}px;
    color: ${theme.colors.text.primary};
    &:hover {
      background: ${theme.colors.action.hover};
    }
  `,
  resultValue: css`
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  resultTag: css`
    flex-shrink: 0;
    font-size: ${Math.max(9, fontSize - 2)}px;
    color: ${theme.colors.text.secondary};
    background: ${theme.colors.background.secondary};
    border-radius: ${theme.shape.radius.pill};
    padding: ${theme.spacing(0.25, 0.75)};
  `,
  // ── Navigation ──
  homeLink: css`
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: ${theme.spacing(0.75, 1)};
    margin-bottom: ${theme.spacing(0.5)};
    color: ${theme.colors.text.link};
    font-size: ${fontSize}px;
    font-weight: ${theme.typography.fontWeightMedium};
    cursor: pointer;
    border-radius: ${theme.shape.radius.default};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    &:hover {
      background: ${theme.colors.action.hover};
    }
  `,
  section: css`
    margin-bottom: ${theme.spacing(0.5)};
  `,
  sectionHeader: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.75)};
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: ${theme.spacing(0.75, 1)};
    color: ${theme.colors.text.primary};
    font-size: ${fontSize}px;
    font-weight: ${theme.typography.fontWeightMedium};
    cursor: pointer;
    border-radius: ${theme.shape.radius.default};
    &:hover {
      background: ${theme.colors.action.hover};
    }
  `,
  sectionItems: css`
    padding-left: ${theme.spacing(2)};
  `,
  subSection: css`
    margin-bottom: ${theme.spacing(0.25)};
  `,
  subSectionHeader: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.75)};
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: ${theme.spacing(0.5, 1)};
    color: ${theme.colors.text.secondary};
    font-size: ${Math.max(10, fontSize - 1)}px;
    font-weight: ${theme.typography.fontWeightMedium};
    cursor: pointer;
    border-radius: ${theme.shape.radius.default};
    &:hover {
      background: ${theme.colors.action.hover};
      color: ${theme.colors.text.primary};
    }
  `,
  subSectionItems: css`
    padding-left: ${theme.spacing(2)};
  `,
  itemTitle: css`
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  `,
  chevron: css`
    font-size: ${Math.max(8, fontSize - 2)}px;
    color: ${theme.colors.text.secondary};
    flex-shrink: 0;
  `,
  link: css`
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: ${theme.spacing(0.5, 1)};
    color: ${theme.colors.text.secondary};
    font-size: ${fontSize}px;
    cursor: pointer;
    border-radius: ${theme.shape.radius.default};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    &:hover {
      background: ${theme.colors.action.hover};
      color: ${theme.colors.text.primary};
    }
  `,
  emptySection: css`
    padding: ${theme.spacing(0.5, 1)};
    color: ${theme.colors.text.disabled};
    font-size: ${Math.max(10, fontSize - 1)}px;
    font-style: italic;
  `,
});
