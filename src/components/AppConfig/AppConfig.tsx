import React, { FormEvent, useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { AppPluginMeta, GrafanaTheme2, PluginConfigPageProps } from '@grafana/data';
import { Button, Combobox, ComboboxOption, Field, FieldSet, IconButton, Input, Switch, useStyles2 } from '@grafana/ui';
import { testIds } from '../testIds';
import {
  isNavSection,
  NavConfig,
  NavItem,
  NavLink,
  NavSection,
  SearchConfig,
  SearchType,
  SearchTypeVariable,
  SQL_DS_TYPES,
} from '../../types';
import { replaceItem, removeItem, swapItems } from '../../utils/array';
import { ICON_OPTIONS, emptyLink, emptySubSection, emptySearchType, emptyExtraVar } from '../../navigation/constants';
import {
  AppPluginSettings,
  DashboardOption,
  DataSourceOption,
  fetchDashboards,
  fetchDataSources,
  updatePluginAndReload,
} from '../../api/plugin';
import { LinkRow } from './LinkRow';

export type AppConfigStyles = ReturnType<typeof getStyles>;

export interface AppConfigProps extends PluginConfigPageProps<AppPluginMeta<AppPluginSettings>> {}

const ICON_COMBOBOX_OPTIONS: Array<ComboboxOption<string>> = ICON_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  icon: o.value as any,
}));

const defaultSearchConfig = (): SearchConfig => ({
  enabled: false,
  dataSourceUid: '',
  dataSourceType: '',
  types: [],
});

const AppConfig = ({ plugin }: AppConfigProps) => {
  const s = useStyles2(getStyles);
  const { enabled, pinned, jsonData } = plugin.meta;

  const savedConfig: NavConfig = jsonData?.navConfig ?? { sections: [] };

  const [homeLinkEnabled, setHomeLinkEnabled] = useState<boolean>(!!savedConfig.homeLink);
  const [homeLink, setHomeLink] = useState<NavLink>(
    savedConfig.homeLink ?? { title: 'Home', type: 'dashboard', uid: '' }
  );
  const [topLinks, setTopLinks] = useState<NavLink[]>(savedConfig.topLinks ?? []);
  const [sections, setSections] = useState<NavSection[]>(savedConfig.sections);
  const [staticVars, setStaticVars] = useState<Array<{ key: string; value: string }>>(
    Object.entries(savedConfig.staticVars ?? {}).map(([key, value]) => ({ key, value }))
  );
  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    ...defaultSearchConfig(),
    ...(savedConfig.search ?? {}),
  });

  const [dashboardOptions, setDashboardOptions] = useState<DashboardOption[]>([]);
  const [loadingDashboards, setLoadingDashboards] = useState(true);
  const [dataSourceOptions, setDataSourceOptions] = useState<DataSourceOption[]>([]);
  const [dsTypeMap, setDsTypeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchDashboards()
      .then(setDashboardOptions)
      .catch(() => {})
      .finally(() => setLoadingDashboards(false));

    fetchDataSources()
      .then(({ options, typeMap }) => {
        setDataSourceOptions(options);
        setDsTypeMap(typeMap);
      })
      .catch(() => {});
  }, []);

  // ── Search helpers ────────────────────────────────────────────────

  const updateSearchConfig = (patch: Partial<SearchConfig>) =>
    setSearchConfig((prev) => ({ ...prev, ...patch }));

  const addSearchType = () =>
    updateSearchConfig({ types: [...searchConfig.types, emptySearchType()] });

  const removeSearchType = (i: number) =>
    updateSearchConfig({ types: removeItem(searchConfig.types, i) });

  const moveSearchTypeUp = (i: number) =>
    updateSearchConfig({ types: swapItems(searchConfig.types, i - 1, i) });

  const moveSearchTypeDown = (i: number) =>
    updateSearchConfig({ types: swapItems(searchConfig.types, i, i + 1) });

  const updateSearchType = (i: number, patch: Partial<SearchType>) =>
    updateSearchConfig({
      types: replaceItem(searchConfig.types, i, { ...searchConfig.types[i], ...patch }),
    });

  // ── Top links helpers ─────────────────────────────────────────────

  const addTopLink = () => setTopLinks((prev) => [...prev, emptyLink()]);
  const removeTopLink = (i: number) => setTopLinks((prev) => removeItem(prev, i));
  const updateTopLink = (i: number, patch: Partial<NavLink>) =>
    setTopLinks((prev) => replaceItem(prev, i, { ...prev[i], ...patch }));
  const moveTopLinkUp = (i: number) => setTopLinks((prev) => swapItems(prev, i - 1, i));
  const moveTopLinkDown = (i: number) => setTopLinks((prev) => swapItems(prev, i, i + 1));

  // ── Section helpers ───────────────────────────────────────────────

  const updateSection = (si: number, updated: NavSection) =>
    setSections((prev) => replaceItem(prev, si, updated));

  const addSection = () => setSections((prev) => [...prev, { title: '', items: [] }]);
  const removeSection = (si: number) => setSections((prev) => removeItem(prev, si));
  const moveSectionUp = (si: number) => setSections((prev) => swapItems(prev, si - 1, si));
  const moveSectionDown = (si: number) => setSections((prev) => swapItems(prev, si, si + 1));

  const addLinkToSection = (si: number) =>
    updateSection(si, { ...sections[si], items: [...sections[si].items, emptyLink()] });

  const addSubSectionToSection = (si: number) =>
    updateSection(si, { ...sections[si], items: [...sections[si].items, emptySubSection()] });

  const removeItemFromSection = (si: number, ii: number) =>
    updateSection(si, { ...sections[si], items: removeItem(sections[si].items, ii) });

  const updateItemInSection = (si: number, ii: number, updated: NavItem) =>
    updateSection(si, { ...sections[si], items: replaceItem(sections[si].items, ii, updated) });

  const moveItemInSection = (si: number, ii: number, dir: -1 | 1) =>
    updateSection(si, { ...sections[si], items: swapItems(sections[si].items, ii, ii + dir) });

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

  const moveItemInSubSection = (si: number, ii: number, li: number, dir: -1 | 1) => {
    const sub = sections[si].items[ii] as NavSection;
    updateItemInSection(si, ii, { ...sub, items: swapItems(sub.items, li, li + dir) });
  };

  // ── Extra variables helpers (per search type) ─────────────────────

  const addExtraVar = (ti: number) =>
    updateSearchType(ti, { extraVariables: [...(searchConfig.types[ti].extraVariables ?? []), emptyExtraVar()] });

  const removeExtraVar = (ti: number, vi: number) =>
    updateSearchType(ti, { extraVariables: removeItem(searchConfig.types[ti].extraVariables ?? [], vi) });

  const updateExtraVar = (ti: number, vi: number, patch: Partial<SearchTypeVariable>) => {
    const vars = searchConfig.types[ti].extraVariables ?? [];
    updateSearchType(ti, { extraVariables: replaceItem(vars, vi, { ...vars[vi], ...patch }) });
  };

  // ── Static vars helpers ───────────────────────────────────────────

  const addStaticVar = () => setStaticVars((prev) => [...prev, { key: '', value: '' }]);
  const removeStaticVar = (i: number) => setStaticVars((prev) => removeItem(prev, i));
  const updateStaticVar = (i: number, patch: Partial<{ key: string; value: string }>) =>
    setStaticVars((prev) => replaceItem(prev, i, { ...prev[i], ...patch }));

  // ── Submit ────────────────────────────────────────────────────────

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const staticVarsRecord: Record<string, string> = {};
    staticVars.forEach(({ key, value }) => {
      if (key.trim()) { staticVarsRecord[key.trim()] = value; }
    });
    const navConfig: NavConfig = {
      homeLink: homeLinkEnabled ? homeLink : undefined,
      topLinks: topLinks.length > 0 ? topLinks : undefined,
      sections,
      search: searchConfig.enabled ? searchConfig : undefined,
      staticVars: Object.keys(staticVarsRecord).length > 0 ? staticVarsRecord : undefined,
    };
    updatePluginAndReload(plugin.meta.id, { enabled, pinned, jsonData: { navConfig } });
  };

  const linkRowProps = { dashboardOptions, loadingDashboards, styles: s };

  return (
    <form onSubmit={onSubmit}>
      {/* ── Home link ── */}
      <FieldSet label="Home link">
        <Field label="Enable home link">
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
              onClick={() => setHomeLink({ title: 'Home', type: 'external', url: '/' })}
              className={s.grafanaHomeBtn}
            >
              Use Grafana home page (/)
            </Button>
          </>
        )}
      </FieldSet>

      {/* ── Top-level links ── */}
      <FieldSet label="Standalone links">
        <p className={s.varsDescription}>
          Links displayed directly below the home link, outside any section.
        </p>
        {topLinks.map((link, i) => (
          <div key={i} className={s.topLinkRow}>
            <LinkRow
              link={link}
              onUpdate={(patch) => updateTopLink(i, patch)}
              onRemove={() => removeTopLink(i)}
              onMoveUp={i > 0 ? () => moveTopLinkUp(i) : null}
              onMoveDown={i < topLinks.length - 1 ? () => moveTopLinkDown(i) : null}
              {...linkRowProps}
            />
          </div>
        ))}
        <Button variant="secondary" size="sm" icon="plus" type="button" onClick={addTopLink} className={s.addLinkBtn}>
          Add link
        </Button>
      </FieldSet>

      {/* ── Navigation sections ── */}
      <FieldSet label="Navigation sections">
        {sections.map((section, si) => (
          <div key={si} className={s.sectionBlock}>
            <div className={s.sectionHeader}>
              <div className={s.iconSelectSmall}>
                <Combobox
                  options={ICON_COMBOBOX_OPTIONS}
                  value={section.icon ?? null}
                  placeholder="—"
                  onChange={(v) => updateSection(si, { ...section, icon: v?.value ?? undefined })}
                  isClearable
                />
              </div>
              <Input
                className={s.sectionTitle}
                value={section.title}
                placeholder="Section title"
                onChange={(e) => updateSection(si, { ...section, title: e.currentTarget.value })}
              />
              <IconButton name="arrow-up" tooltip="Move up" onClick={() => moveSectionUp(si)} disabled={si === 0} />
              <IconButton name="arrow-down" tooltip="Move down" onClick={() => moveSectionDown(si)} disabled={si === sections.length - 1} />
              <IconButton name="trash-alt" tooltip="Remove section" onClick={() => removeSection(si)} />
            </div>

            {section.items.map((item, ii) =>
              isNavSection(item) ? (
                <div key={ii} className={s.subSectionBlock}>
                  <div className={s.sectionHeader}>
                    <div className={s.iconSelectSmall}>
                      <Combobox
                        options={ICON_COMBOBOX_OPTIONS}
                        value={item.icon ?? null}
                        placeholder="—"
                        onChange={(v) => updateItemInSection(si, ii, { ...item, icon: v?.value ?? undefined })}
                        isClearable
                      />
                    </div>
                    <Input
                      className={s.sectionTitle}
                      value={item.title}
                      placeholder="Sub-section title"
                      onChange={(e) => updateItemInSection(si, ii, { ...item, title: e.currentTarget.value })}
                    />
                    <IconButton
                      name="trash-alt"
                      tooltip="Remove sub-section"
                      onClick={() => removeItemFromSection(si, ii)}
                    />
                  </div>
                  {item.items.map((subItem, li) => (
                    <LinkRow
                      key={li}
                      link={subItem as NavLink}
                      onUpdate={(patch) => updateLinkInSubSection(si, ii, li, patch)}
                      onRemove={() => removeItemFromSubSection(si, ii, li)}
                      onMoveUp={li > 0 ? () => moveItemInSubSection(si, ii, li, -1) : null}
                      onMoveDown={li < item.items.length - 1 ? () => moveItemInSubSection(si, ii, li, 1) : null}
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
                    Add link
                  </Button>
                </div>
              ) : (
                <LinkRow
                  key={ii}
                  link={item}
                  onUpdate={(patch) => updateItemInSection(si, ii, { ...item, ...patch } as NavLink)}
                  onRemove={() => removeItemFromSection(si, ii)}
                  onMoveUp={ii > 0 ? () => moveItemInSection(si, ii, -1) : null}
                  onMoveDown={ii < section.items.length - 1 ? () => moveItemInSection(si, ii, 1) : null}
                  {...linkRowProps}
                />
              )
            )}

            <div className={s.sectionActions}>
              <Button variant="secondary" size="sm" icon="plus" type="button" onClick={() => addLinkToSection(si)}>
                Add link
              </Button>
              <Button variant="secondary" size="sm" icon="folder-plus" type="button" onClick={() => addSubSectionToSection(si)}>
                Add sub-section
              </Button>
            </div>
          </div>
        ))}

        <Button variant="secondary" icon="plus" type="button" onClick={addSection} className={s.marginTop}>
          Add section
        </Button>
      </FieldSet>

      {/* ── Search ── */}
      <FieldSet label="Search">
        <Field label="Enable search">
          <Switch
            value={searchConfig.enabled}
            onChange={(e) => updateSearchConfig({ enabled: e.currentTarget.checked })}
          />
        </Field>

        {searchConfig.enabled && (
          <>
            <Field label="Data source">
              <Combobox
                options={dataSourceOptions.map((o) => ({ value: o.value ?? '', label: o.label ?? o.value ?? '' }))}
                value={searchConfig.dataSourceUid || null}
                placeholder="Select a data source..."
                onChange={(v) => {
                  const uid = v?.value ?? '';
                  updateSearchConfig({ dataSourceUid: uid, dataSourceType: dsTypeMap[uid] ?? '' });
                }}
                isClearable
                width={40}
              />
            </Field>

            {searchConfig.dataSourceUid && !SQL_DS_TYPES.includes(searchConfig.dataSourceType) && (
              <div className={s.dsTypeHint}>
                {`⚠️ Data source type "${searchConfig.dataSourceType}" is not supported. Only SQL data sources are supported (PostgreSQL, MySQL, MSSQL).`}
              </div>
            )}

            <div className={s.searchTypesLabel}>Search types</div>

            {searchConfig.types.map((type, i) => (
              <div key={i} className={s.searchTypeBlock}>
                <div className={s.searchTypeRow}>
                  <Field label="ID" className={s.fieldGrow}>
                    <Input
                      value={type.id}
                      placeholder="e.g. custom_ip"
                      onChange={(e) => updateSearchType(i, { id: e.currentTarget.value })}
                    />
                  </Field>
                  <Field label="Display label" className={s.fieldGrow}>
                    <Input
                      value={type.label}
                      placeholder="e.g. IP Address"
                      onChange={(e) => updateSearchType(i, { label: e.currentTarget.value })}
                    />
                  </Field>
                  <Field label="Grafana variable" className={s.fieldGrow}>
                    <Input
                      value={type.variable}
                      placeholder="e.g. host"
                      onChange={(e) => updateSearchType(i, { variable: e.currentTarget.value })}
                    />
                  </Field>
                  <div className={s.removeLink}>
                    <IconButton name="arrow-up" tooltip="Move up" onClick={() => moveSearchTypeUp(i)} disabled={i === 0} />
                    <IconButton name="arrow-down" tooltip="Move down" onClick={() => moveSearchTypeDown(i)} disabled={i === searchConfig.types.length - 1} />
                    <IconButton name="trash-alt" tooltip="Remove type" onClick={() => removeSearchType(i)} />
                  </div>
                </div>

                {searchConfig.dataSourceUid && (
                  <Field
                    label="SQL query"
                    description="Must return columns: value, tag (optional), dashboard, and any extra columns"
                  >
                    <textarea
                      className={s.queryTextarea}
                      value={type.query ?? ''}
                      placeholder="SELECT value, tag, dashboard FROM my_table"
                      onChange={(e) => updateSearchType(i, { query: e.currentTarget.value })}
                      rows={3}
                      spellCheck={false}
                    />
                  </Field>
                )}

                <div className={s.extraVarsLabel}>Additional variables</div>
                <p className={s.extraVarsDesc}>
                  Declare extra columns to pass as Grafana variables when navigating to a result.
                </p>
                {(type.extraVariables ?? []).map((ev, vi) => (
                  <div key={vi} className={s.searchTypeRow}>
                    <Field label="Column" className={s.fieldGrow}>
                      <Input
                        value={ev.column}
                        placeholder="e.g. hostid"
                        onChange={(e) => updateExtraVar(i, vi, { column: e.currentTarget.value })}
                      />
                    </Field>
                    <Field label="Grafana variable" className={s.fieldGrow}>
                      <Input
                        value={ev.variable}
                        placeholder="e.g. hostid"
                        onChange={(e) => updateExtraVar(i, vi, { variable: e.currentTarget.value })}
                      />
                    </Field>
                    <div className={s.removeLink}>
                      <IconButton name="trash-alt" tooltip="Remove" onClick={() => removeExtraVar(i, vi)} />
                    </div>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  type="button"
                  onClick={() => addExtraVar(i)}
                  className={s.addLinkBtn}
                >
                  Add variable
                </Button>
              </div>
            ))}

            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              type="button"
              onClick={addSearchType}
              className={s.addLinkBtn}
            >
              Add type
            </Button>
          </>
        )}
      </FieldSet>

      {/* ── Static variables ── */}
      <FieldSet label="Static variables">
        <p className={s.varsDescription}>
          Define fixed values reusable in your links with the syntax{' '}
          <code>$name</code> or <code>${'{name}'}</code>.
        </p>

        {staticVars.map((v, i) => (
          <div key={i} className={s.staticVarRow}>
            <Field label="Name" className={s.fieldFixed}>
              <Input
                value={v.key}
                placeholder="e.g. env"
                onChange={(e) => updateStaticVar(i, { key: e.currentTarget.value })}
              />
            </Field>
            <Field label="Value" className={s.fieldGrow}>
              <Input
                value={v.value}
                placeholder="e.g. production"
                onChange={(e) => updateStaticVar(i, { value: e.currentTarget.value })}
              />
            </Field>
            <div className={s.removeLink}>
              <IconButton name="trash-alt" tooltip="Remove" onClick={() => removeStaticVar(i)} />
            </div>
          </div>
        ))}

        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          type="button"
          onClick={addStaticVar}
          className={s.addLinkBtn}
        >
          Add variable
        </Button>
      </FieldSet>

      <Button type="submit" data-testid={testIds.appConfig.submit}>
        Save navigation
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
  topLinkRow: css`
    display: flex;
    align-items: flex-end;
    gap: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(0.5)};
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
  fieldIcon: css`
    width: 140px;
    flex-shrink: 0;
    margin-bottom: 0;
  `,
  iconSelectSmall: css`
    width: 130px;
    flex-shrink: 0;
  `,
  removeLink: css`
    padding-bottom: ${theme.spacing(0.5)};
  `,
  addLinkBtn: css`
    margin-top: ${theme.spacing(1)};
  `,
  dsTypeHint: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(1)};
    padding: ${theme.spacing(0.75, 1)};
    background: ${theme.colors.background.secondary};
    border-radius: ${theme.shape.radius.default};
  `,
  searchTypesLabel: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(1)};
    margin-top: ${theme.spacing(1)};
  `,
  searchTypeBlock: css`
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    padding: ${theme.spacing(1.5)};
    margin-bottom: ${theme.spacing(1.5)};
  `,
  searchTypeRow: css`
    display: flex;
    align-items: flex-end;
    gap: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(0.5)};
  `,
  extraVarsLabel: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
    color: ${theme.colors.text.secondary};
    margin-top: ${theme.spacing(1.5)};
    margin-bottom: ${theme.spacing(0.25)};
  `,
  extraVarsDesc: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(1)};
  `,
  varsDescription: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(1.5)};
    code {
      background: ${theme.colors.background.canvas};
      border-radius: ${theme.shape.radius.default};
      padding: ${theme.spacing(0.25, 0.5)};
      font-family: ${theme.typography.fontFamilyMonospace};
    }
  `,
  staticVarRow: css`
    display: flex;
    align-items: flex-end;
    gap: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(1)};
  `,
  queryTextarea: css`
    width: 100%;
    box-sizing: border-box;
    background: ${theme.colors.background.canvas};
    border: 1px solid ${theme.colors.border.medium};
    border-radius: ${theme.shape.radius.default};
    color: ${theme.colors.text.primary};
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: ${theme.typography.bodySmall.fontSize};
    padding: ${theme.spacing(1)};
    resize: vertical;
    outline: none;
    &:focus {
      border-color: ${theme.colors.primary.border};
    }
  `,
});
