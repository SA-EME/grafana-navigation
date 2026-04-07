import React, { FormEvent, useEffect, useState } from 'react';
import { lastValueFrom } from 'rxjs';
import { css } from '@emotion/css';
import { AppPluginMeta, GrafanaTheme2, PluginConfigPageProps, PluginMeta, SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Field, FieldSet, IconButton, Input, Select, Switch, useStyles2 } from '@grafana/ui';
import { testIds } from '../testIds';
import { isNavSection, NavConfig, NavItem, NavLink, NavSection } from '../../types';

type AppPluginSettings = {
  navConfig?: NavConfig;
};

export interface AppConfigProps extends PluginConfigPageProps<AppPluginMeta<AppPluginSettings>> {}

type DashboardOption = SelectableValue<string>;

const LINK_TYPE_OPTIONS = [
  { label: 'Dashboard', value: 'dashboard' as const },
  { label: 'Externe', value: 'external' as const },
];

const emptyLink = (): NavLink => ({ title: '', type: 'dashboard', uid: '' });
const emptySubSection = (): NavSection => ({ title: '', items: [] });

// ── Immuable helpers ─────────────────────────────────────────────────────────

function replaceItem<T>(arr: T[], index: number, item: T): T[] {
  return arr.map((x, i) => (i === index ? item : x));
}

function removeItem<T>(arr: T[], index: number): T[] {
  return arr.filter((_, i) => i !== index);
}

function swapItems<T>(arr: T[], a: number, b: number): T[] {
  const next = [...arr];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface LinkRowProps {
  link: NavLink;
  dashboardOptions: DashboardOption[];
  loadingDashboards: boolean;
  onUpdate: (patch: Partial<NavLink>) => void;
  onRemove: () => void;
  styles: ReturnType<typeof getStyles>;
}

const LinkRow = ({ link, dashboardOptions, loadingDashboards, onUpdate, onRemove, styles: s }: LinkRowProps) => (
  <div className={s.linkRow}>
    <Field label="Titre" className={s.fieldGrow}>
      <Input
        value={link.title}
        placeholder="Titre du lien"
        onChange={(e) => onUpdate({ title: e.currentTarget.value })}
      />
    </Field>
    <Field label="Type" className={s.fieldFixed}>
      <Select
        options={LINK_TYPE_OPTIONS}
        value={link.type}
        onChange={(v) => onUpdate({ type: v.value, uid: '', url: '' })}
      />
    </Field>
    {link.type === 'dashboard' ? (
      <Field label="Dashboard" className={s.fieldGrow}>
        <Select
          options={dashboardOptions}
          value={link.uid || null}
          isLoading={loadingDashboards}
          placeholder="Sélectionner un dashboard..."
          onChange={(v: DashboardOption) => onUpdate({ uid: v.value ?? '' })}
          isClearable
        />
      </Field>
    ) : (
      <Field label="URL" className={s.fieldGrow}>
        <Input
          value={link.url ?? ''}
          placeholder="https://... ou /"
          onChange={(e) => onUpdate({ url: e.currentTarget.value })}
        />
      </Field>
    )}
    <div className={s.removeLink}>
      <IconButton name="trash-alt" tooltip="Supprimer le lien" onClick={onRemove} />
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const AppConfig = ({ plugin }: AppConfigProps) => {
  const s = useStyles2(getStyles);
  const { enabled, pinned, jsonData } = plugin.meta;

  const savedConfig: NavConfig = jsonData?.navConfig ?? { sections: [] };

  const [homeLinkEnabled, setHomeLinkEnabled] = useState<boolean>(!!savedConfig.homeLink);
  const [homeLink, setHomeLink] = useState<NavLink>(
    savedConfig.homeLink ?? { title: 'Home', type: 'dashboard', uid: '' }
  );
  const [sections, setSections] = useState<NavSection[]>(savedConfig.sections);
  const [dashboardOptions, setDashboardOptions] = useState<DashboardOption[]>([]);
  const [loadingDashboards, setLoadingDashboards] = useState(true);

  useEffect(() => {
    getBackendSrv()
      .get('/api/search?type=dash-db&limit=5000')
      .then((results: Array<{ uid: string; title: string }>) => {
        setDashboardOptions(results.map((d) => ({ label: d.title, value: d.uid })));
      })
      .catch(() => {})
      .finally(() => setLoadingDashboards(false));
  }, []);

  // ── Section-level helpers ─────────────────────────────────────────

  const updateSection = (si: number, updated: NavSection) =>
    setSections((prev) => replaceItem(prev, si, updated));

  const addSection = () =>
    setSections((prev) => [...prev, { title: '', items: [] }]);

  const removeSection = (si: number) =>
    setSections((prev) => removeItem(prev, si));

  const moveSectionUp = (si: number) =>
    setSections((prev) => swapItems(prev, si - 1, si));

  const moveSectionDown = (si: number) =>
    setSections((prev) => swapItems(prev, si, si + 1));

  // ── Item helpers inside a section (top level) ─────────────────────

  const addLinkToSection = (si: number) =>
    updateSection(si, { ...sections[si], items: [...sections[si].items, emptyLink()] });

  const addSubSectionToSection = (si: number) =>
    updateSection(si, { ...sections[si], items: [...sections[si].items, emptySubSection()] });

  const removeItemFromSection = (si: number, ii: number) =>
    updateSection(si, { ...sections[si], items: removeItem(sections[si].items, ii) });

  const updateItemInSection = (si: number, ii: number, updated: NavItem) =>
    updateSection(si, { ...sections[si], items: replaceItem(sections[si].items, ii, updated) });

  // ── Item helpers inside a sub-section ────────────────────────────

  const addLinkToSubSection = (si: number, ii: number) => {
    const sub = sections[si].items[ii] as NavSection;
    updateItemInSection(si, ii, { ...sub, items: [...sub.items, emptyLink()] });
  };

  const removeItemFromSubSection = (si: number, ii: number, li: number) => {
    const sub = sections[si].items[ii] as NavSection;
    updateItemInSection(si, ii, { ...sub, items: removeItem(sub.items, li) });
  };

  const updateLinkInSubSection = (si: number, ii: number, li: number, patch: Partial<NavLink>) => {
    const sub = sections[si].items[ii] as NavSection;
    const updatedLink: NavLink = { ...(sub.items[li] as NavLink), ...patch };
    updateItemInSection(si, ii, { ...sub, items: replaceItem(sub.items, li, updatedLink) });
  };

  // ── Submit ────────────────────────────────────────────────────────

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const navConfig: NavConfig = {
      homeLink: homeLinkEnabled ? homeLink : undefined,
      sections,
    };
    updatePluginAndReload(plugin.meta.id, { enabled, pinned, jsonData: { navConfig } });
  };

  const linkRowProps = { dashboardOptions, loadingDashboards, styles: s };

  return (
    <form onSubmit={onSubmit}>
      {/* ── Home Link ── */}
      <FieldSet label="Lien Home">
        <Field label="Activer un lien Home">
          <Switch
            value={homeLinkEnabled}
            onChange={(e) => setHomeLinkEnabled(e.currentTarget.checked)}
          />
        </Field>
        {homeLinkEnabled && (
          <>
            <LinkRow
              link={homeLink}
              onUpdate={(patch) => setHomeLink((prev) => ({ ...prev, ...patch }))}
              onRemove={() => setHomeLinkEnabled(false)}
              {...linkRowProps}
            />
            <Button
              variant="secondary"
              size="sm"
              icon="home-alt"
              type="button"
              onClick={() => setHomeLink({ title: 'Accueil', type: 'external', url: '/' })}
              className={s.grafanaHomeBtn}
            >
              Utiliser la page d&apos;accueil Grafana (/)
            </Button>
          </>
        )}
      </FieldSet>

      {/* ── Sections ── */}
      <FieldSet label="Sections de navigation">
        {sections.map((section, si) => (
          <div key={si} className={s.sectionBlock}>
            {/* Section header */}
            <div className={s.sectionHeader}>
              <Input
                className={s.sectionTitle}
                value={section.title}
                placeholder="Titre de la section"
                onChange={(e) => updateSection(si, { ...section, title: e.currentTarget.value })}
              />
              <IconButton name="arrow-up" tooltip="Monter" onClick={() => moveSectionUp(si)} disabled={si === 0} />
              <IconButton name="arrow-down" tooltip="Descendre" onClick={() => moveSectionDown(si)} disabled={si === sections.length - 1} />
              <IconButton name="trash-alt" tooltip="Supprimer la section" onClick={() => removeSection(si)} />
            </div>

            {/* Section items */}
            {section.items.map((item, ii) =>
              isNavSection(item) ? (
                /* Sub-section */
                <div key={ii} className={s.subSectionBlock}>
                  <div className={s.sectionHeader}>
                    <Input
                      className={s.sectionTitle}
                      value={item.title}
                      placeholder="Titre de la sous-section"
                      onChange={(e) =>
                        updateItemInSection(si, ii, { ...item, title: e.currentTarget.value })
                      }
                    />
                    <IconButton
                      name="trash-alt"
                      tooltip="Supprimer la sous-section"
                      onClick={() => removeItemFromSection(si, ii)}
                    />
                  </div>
                  {item.items.map((subItem, li) => (
                    <LinkRow
                      key={li}
                      link={subItem as NavLink}
                      onUpdate={(patch) => updateLinkInSubSection(si, ii, li, patch)}
                      onRemove={() => removeItemFromSubSection(si, ii, li)}
                      {...linkRowProps}
                    />
                  ))}
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="plus"
                    type="button"
                    onClick={() => addLinkToSubSection(si, ii)}
                    className={s.addLinkBtn}
                  >
                    Ajouter un lien
                  </Button>
                </div>
              ) : (
                /* Link */
                <LinkRow
                  key={ii}
                  link={item}
                  onUpdate={(patch) =>
                    updateItemInSection(si, ii, { ...item, ...patch } as NavLink)
                  }
                  onRemove={() => removeItemFromSection(si, ii)}
                  {...linkRowProps}
                />
              )
            )}

            <div className={s.sectionActions}>
              <Button variant="secondary" size="sm" icon="plus" type="button" onClick={() => addLinkToSection(si)}>
                Ajouter un lien
              </Button>
              <Button variant="secondary" size="sm" icon="folder-plus" type="button" onClick={() => addSubSectionToSection(si)}>
                Ajouter une sous-section
              </Button>
            </div>
          </div>
        ))}

        <Button variant="secondary" icon="plus" type="button" onClick={addSection} className={s.marginTop}>
          Ajouter une section
        </Button>
      </FieldSet>

      <Button type="submit" data-testid={testIds.appConfig.submit}>
        Sauvegarder la navigation
      </Button>
    </form>
  );
};

export default AppConfig;

const getStyles = (theme: GrafanaTheme2) => ({
  marginTop: css`
    margin-top: ${theme.spacing(2)};
  `,
  grafanaHomeBtn: css`
    margin-top: ${theme.spacing(1)};
  `,
  sectionBlock: css`
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    padding: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(2)};
  `,
  subSectionBlock: css`
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    padding: ${theme.spacing(1.5)};
    margin-bottom: ${theme.spacing(1)};
    margin-left: ${theme.spacing(2)};
    background: ${theme.colors.background.secondary};
  `,
  sectionHeader: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(1.5)};
  `,
  sectionTitle: css`
    flex: 1;
  `,
  sectionActions: css`
    display: flex;
    gap: ${theme.spacing(1)};
    margin-top: ${theme.spacing(1)};
  `,
  linkRow: css`
    display: flex;
    align-items: flex-end;
    gap: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(1)};
  `,
  fieldGrow: css`
    flex: 1;
    margin-bottom: 0;
  `,
  fieldFixed: css`
    width: 130px;
    flex-shrink: 0;
    margin-bottom: 0;
  `,
  removeLink: css`
    padding-bottom: ${theme.spacing(0.5)};
  `,
  addLinkBtn: css`
    margin-top: ${theme.spacing(1)};
  `,
});

const updatePluginAndReload = async (pluginId: string, data: Partial<PluginMeta<AppPluginSettings>>) => {
  try {
    await updatePlugin(pluginId, data);
    window.location.reload();
  } catch (e) {
    console.error('Error while updating the plugin', e);
  }
};

const updatePlugin = async (pluginId: string, data: Partial<PluginMeta>) => {
  const response = await getBackendSrv().fetch({
    url: `/api/plugins/${pluginId}/settings`,
    method: 'POST',
    data,
  });
  return lastValueFrom(response);
};
