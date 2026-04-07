import React, { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, PanelProps } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { isNavSection, NavConfig, NavItem, NavLink } from '../types';

const PLUGIN_ID = 'saeme-navigation-app';

export interface SimplePanelOptions {}

const getFontSize = (width: number): number => Math.max(11, Math.min(14, Math.round(width / 30)));

export const SimplePanel: React.FC<PanelProps<SimplePanelOptions>> = ({ width }) => {
  const fontSize = getFontSize(width);
  const s = useStyles2(getStyles, fontSize);

  const [config, setConfig] = useState<NavConfig | null>(null);
  // Clé : "si" pour section top-level, "si-ii" pour sous-section
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    getBackendSrv()
      .get(`/api/plugins/${PLUGIN_ID}/settings`)
      .then((res) => {
        const navConfig: NavConfig = res.jsonData?.navConfig ?? { sections: [] };
        setConfig(navConfig);
        // Tout ouvert par défaut
        const keys = new Set<string>();
        navConfig.sections.forEach((sec, si) => {
          keys.add(String(si));
          sec.items.forEach((item, ii) => {
            if (isNavSection(item)) {
              keys.add(`${si}-${ii}`);
            }
          });
        });
        setOpenKeys(keys);
      })
      .catch(() => setConfig({ sections: [] }));
  }, []);

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const navigate = (link: NavLink) => {
    if (link.type === 'dashboard' && link.uid) {
      window.location.href = `/d/${link.uid}`;
    } else if (link.type === 'external' && link.url) {
      if (link.url.startsWith('/')) {
        window.location.href = link.url;
      } else {
        window.open(link.url, '_blank');
      }
    }
  };

  const renderItems = (items: NavItem[], parentKey: string, depth: number) =>
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

  if (!config.homeLink && config.sections.length === 0) {
    return <div className={s.empty}>Aucune navigation configurée.</div>;
  }

  return (
    <div className={s.container}>
      {config.homeLink && (
        <button className={s.homeLink} onClick={() => navigate(config.homeLink!)}>
          🏠 {config.homeLink.title || 'Home'}
        </button>
      )}
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
  empty: css`
    padding: ${theme.spacing(2)};
    color: ${theme.colors.text.secondary};
    font-style: italic;
    font-size: ${fontSize}px;
  `,
  homeLink: css`
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: ${theme.spacing(0.75, 1)};
    margin-bottom: ${theme.spacing(1)};
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
