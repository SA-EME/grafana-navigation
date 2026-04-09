import React, { useEffect, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, PanelProps } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { isNavSection, NavItem, NavLink, NavSection, SearchType } from '../types';
import { usePluginConfig } from '../hooks/usePluginConfig';
import { findBreadcrumb, BreadcrumbItem } from '../navigation/breadcrumb';
import { queryDataSource, SearchResult } from '../search/helpers';

export interface NavigationPanelOptions {}

const getFontSize = (width: number): number => Math.max(11, Math.min(14, Math.round(width / 30)));

export const NavigationPanel: React.FC<PanelProps<NavigationPanelOptions>> = ({ width, replaceVariables }) => {
  const fontSize = getFontSize(width);
  const s = useStyles2(getStyles, fontSize);

  const { config } = usePluginConfig();
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  // Extract current dashboard UID from the URL (/d/{uid}/...)
  const currentUid = window.location.pathname.match(/\/d\/([^/]+)/)?.[1] ?? '';

  // Search state
  const [selectedType, setSelectedType] = useState<SearchType | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Initialise open sections and pre-select first search type when config loads
  useEffect(() => {
    if (!config) { return; }
    const keys = new Set<string>();
    config.sections.forEach((sec, si) => {
      keys.add(String(si));
      sec.items.forEach((item, ii) => {
        if (isNavSection(item)) { keys.add(`${si}-${ii}`); }
      });
    });
    setOpenKeys(keys);
    if (config.search?.enabled && config.search.types.length > 0) {
      setSelectedType(config.search.types[0]);
    }
  }, [config]);

  // Close the dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Reload search results when the selected type changes
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

  // Resolves static variables first, then Grafana dashboard variables
  const resolveVars = (str: string): string => {
    let result = str;
    const statics = config?.staticVars ?? {};
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

  const isActive = (link: NavLink): boolean => {
    if (!currentUid || link.type !== 'dashboard') { return false; }
    return link.uid === currentUid || resolveVars(link.uid ?? '') === currentUid;
  };

  const navigateToResult = (result: SearchResult) => {
    if (!selectedType) { return; }
    const resolvedDashboard = resolveVars(result.dashboard);
    const params = new URLSearchParams();
    if (selectedType.variable) {
      params.set(`var-${selectedType.variable}`, result.value);
    }
    for (const ev of selectedType.extraVariables ?? []) {
      if (ev.column && ev.variable && result.extras[ev.column] !== undefined) {
        params.set(`var-${ev.variable}`, result.extras[ev.column]);
      }
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    window.location.href = `/d/${resolvedDashboard}${query}`;
  };

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
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
              {item.icon && <Icon name={item.icon as any} className={s.itemIcon} />}
              <span className={s.itemTitle}>{item.title || 'Untitled section'}</span>
            </button>
            {isOpen && (
              <div className={depth === 0 ? s.sectionItems : s.subSectionItems}>
                {renderItems(item.items, key, depth + 1)}
                {item.items.length === 0 && <span className={s.emptySection}>No links</span>}
              </div>
            )}
          </div>
        );
      }
      const active = isActive(item);
      return (
        <button key={key} className={`${s.link} ${active ? s.linkActive : ''}`} onClick={() => navigate(item)}>
          {item.icon && <Icon name={item.icon as any} className={s.itemIcon} />}
          <span className={s.itemTitle}>{item.title || '(untitled link)'}</span>
        </button>
      );
    });

  if (!config) {
    return <div className={s.container}>Loading...</div>;
  }

  const searchEnabled = config.search?.enabled && (config.search?.types?.length ?? 0) > 0;
  const typeOptions = config.search?.types ?? [];

  return (
    <div className={s.container}>
      {/* ── Search ── */}
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
            placeholder={loadingResults ? 'Loading...' : 'Search...'}
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
                <div className={s.dropdownEmpty}>No results</div>
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

      {/* ── Breadcrumbs ── */}
      {(() => {
        const crumbs = currentUid ? findBreadcrumb(config.sections, currentUid) : null;
        if (!crumbs) { return null; }
        return (
          <div className={s.breadcrumbs}>
            {config.homeLink && (
              <>
                <button className={s.crumbItem} onClick={() => navigate(config.homeLink!)}>
                  {config.homeLink.title || 'Home'}
                </button>
                <span className={s.crumbSep}>›</span>
              </>
            )}
            {crumbs.map((crumb: BreadcrumbItem, i: number) => (
              <React.Fragment key={i}>
                {i > 0 && <span className={s.crumbSep}>›</span>}
                {crumb.link ? (
                  <button className={`${s.crumbItem} ${s.crumbActive}`} onClick={() => navigate(crumb.link!)}>
                    {crumb.title}
                  </button>
                ) : (
                  <span className={s.crumbItem}>{crumb.title}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        );
      })()}

      {/* ── Home link ── */}
      {config.homeLink && (
        <button className={s.homeLink} onClick={() => navigate(config.homeLink!)}>
          {config.homeLink.icon
            ? <Icon name={config.homeLink.icon as any} className={s.itemIcon} />
            : <span>🏠</span>
          }
          {config.homeLink.title || 'Home'}
        </button>
      )}

      {/* ── Standalone links ── */}
      {(config.topLinks ?? []).map((link, i) => {
        const active = isActive(link);
        return (
          <button key={i} className={`${s.link} ${active ? s.linkActive : ''}`} onClick={() => navigate(link)}>
            {link.icon && <Icon name={link.icon as any} className={s.itemIcon} />}
            <span className={s.itemTitle}>{link.title || '(untitled link)'}</span>
          </button>
        );
      })}

      {/* ── Sections ── */}
      {config.sections.map((section: NavSection, si: number) => {
        const key = String(si);
        const isOpen = openKeys.has(key);
        return (
          <div key={key} className={s.section}>
            <button className={s.sectionHeader} onClick={() => toggle(key)}>
              <span className={s.chevron}>{isOpen ? '▼' : '▶'}</span>
              {section.icon && <Icon name={section.icon as any} className={s.itemIcon} />}
              <span className={s.itemTitle}>{section.title || 'Untitled section'}</span>
            </button>
            {isOpen && (
              <div className={s.sectionItems}>
                {renderItems(section.items, key, 0)}
                {section.items.length === 0 && <span className={s.emptySection}>No links</span>}
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
  // ── Breadcrumbs ──
  breadcrumbs: css`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: ${theme.spacing(0.25)};
    padding: ${theme.spacing(0.5, 1)};
    margin-bottom: ${theme.spacing(1)};
    font-size: ${Math.max(10, fontSize - 1)}px;
    color: ${theme.colors.text.secondary};
    border-bottom: 1px solid ${theme.colors.border.weak};
  `,
  crumbItem: css`
    background: none;
    border: none;
    padding: ${theme.spacing(0.25, 0.5)};
    color: ${theme.colors.text.secondary};
    font-size: ${Math.max(10, fontSize - 1)}px;
    cursor: pointer;
    border-radius: ${theme.shape.radius.default};
    &:hover {
      color: ${theme.colors.text.primary};
      background: ${theme.colors.action.hover};
    }
  `,
  crumbActive: css`
    color: ${theme.colors.text.primary};
    font-weight: ${theme.typography.fontWeightMedium};
  `,
  crumbSep: css`
    color: ${theme.colors.text.disabled};
    font-size: ${Math.max(9, fontSize - 2)}px;
    user-select: none;
  `,
  // ── Icons ──
  itemIcon: css`
    flex-shrink: 0;
    opacity: 0.8;
  `,
  // ── Navigation ──
  homeLink: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.75)};
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
    overflow: hidden;
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
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.75)};
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: ${theme.spacing(0.5, 1)};
    color: ${theme.colors.text.secondary};
    font-size: ${fontSize}px;
    cursor: pointer;
    border-radius: ${theme.shape.radius.default};
    overflow: hidden;
    &:hover {
      background: ${theme.colors.action.hover};
      color: ${theme.colors.text.primary};
    }
  `,
  linkActive: css`
    color: ${theme.colors.primary.text};
    background: ${theme.colors.primary.transparent};
    font-weight: ${theme.typography.fontWeightMedium};
    &:hover {
      background: ${theme.colors.primary.transparent};
    }
  `,
  emptySection: css`
    padding: ${theme.spacing(0.5, 1)};
    color: ${theme.colors.text.disabled};
    font-size: ${Math.max(10, fontSize - 1)}px;
    font-style: italic;
  `,
});
