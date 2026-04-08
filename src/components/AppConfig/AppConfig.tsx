import React, { FormEvent, useEffect, useState } from 'react';
import { lastValueFrom } from 'rxjs';
import { css } from '@emotion/css';
import { AppPluginMeta, GrafanaTheme2, PluginConfigPageProps, PluginMeta, SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Field, FieldSet, Icon, IconButton, Input, Select, Switch, useStyles2 } from '@grafana/ui';
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

type AppPluginSettings = {
  navConfig?: NavConfig;
};

export interface AppConfigProps extends PluginConfigPageProps<AppPluginMeta<AppPluginSettings>> {}

type DashboardOption = SelectableValue<string>;
type DataSourceOption = SelectableValue<string>;

const LINK_TYPE_OPTIONS = [
  { label: 'Dashboard', value: 'dashboard' as const },
  { label: 'Externe', value: 'external' as const },
];

const ICON_OPTIONS = [
  'folder', 'folder-open', 'sitemap', 'apps', 'dashboard', 'dashboards',
  'server', 'database', 'cloud', 'globe', 'external-link-alt',
  'chart-line', 'signal', 'bell', 'cog', 'wrench', 'home-alt',
  'link', 'star', 'fire', 'bolt', 'heart', 'eye', 'shield',
  'lock', 'users-alt', 'info-circle', 'exclamation-triangle',
].map((name) => ({ label: name, value: name }));

const emptyLink = (): NavLink => ({ title: '', type: 'dashboard', uid: '' });
const emptySubSection = (): NavSection => ({ title: '', items: [] });
const emptySearchType = (): SearchType => ({ id: '', label: '', variable: '' });
const emptyExtraVar = (): SearchTypeVariable => ({ column: '', variable: '' });

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

// ── LinkRow sub-component ────────────────────────────────────────────────────

interface LinkRowProps {
  link: NavLink;
  dashboardOptions: DashboardOption[];
  loadingDashboards: boolean;
  onUpdate: (patch: Partial<NavLink>) => void;
  onRemove: () => void;
  onMoveUp?: (() => void) | null;
  onMoveDown?: (() => void) | null;
  styles: ReturnType<typeof getStyles>;
}

const LinkRow = ({ link, dashboardOptions, loadingDashboards, onUpdate, onRemove, onMoveUp, onMoveDown, styles: s }: LinkRowProps) => (
  <div className={s.linkRow}>
    <Field label="Icône" className={s.fieldIcon}>
      <Select
        options={ICON_OPTIONS}
        value={link.icon || null}
        placeholder="—"
        onChange={(v: SelectableValue<string>) => onUpdate({ icon: v?.value ?? undefined })}
        isClearable
        allowCustomValue
        prefix={link.icon ? <Icon name={link.icon as any} /> : undefined}
      />
    </Field>
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
          placeholder="Dashboard..."
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
      {onMoveUp !== undefined && (
        <IconButton name="arrow-up" tooltip="Monter" onClick={onMoveUp ?? undefined} disabled={onMoveUp === null} />
      )}
      {onMoveDown !== undefined && (
        <IconButton name="arrow-down" tooltip="Descendre" onClick={onMoveDown ?? undefined} disabled={onMoveDown === null} />
      )}
      <IconButton name="trash-alt" tooltip="Supprimer le lien" onClick={onRemove} />
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

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
  const [sections, setSections] = useState<NavSection[]>(savedConfig.sections);
  const [topLinks, setTopLinks] = useState<NavLink[]>(savedConfig.topLinks ?? []);
  // staticVars stocké comme tableau de paires pour l'édition, puis converti en Record au save
  const [staticVars, setStaticVars] = useState<Array<{ key: string; value: string }>>(
    Object.entries(savedConfig.staticVars ?? {}).map(([key, value]) => ({ key, value }))
  );
  // Merge avec les defaults pour gérer les champs ajoutés après une sauvegarde existante
  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    ...defaultSearchConfig(),
    ...(savedConfig.search ?? {}),
  });

  const [dashboardOptions, setDashboardOptions] = useState<DashboardOption[]>([]);
  const [loadingDashboards, setLoadingDashboards] = useState(true);
  const [dataSourceOptions, setDataSourceOptions] = useState<DataSourceOption[]>([]);
  // uid → type (ex: "postgres", "mysql"…)
  const [dsTypeMap, setDsTypeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    getBackendSrv()
      .get('/api/search?type=dash-db&limit=5000')
      .then((results: Array<{ uid: string; title: string; folderTitle?: string }>) => {
        setDashboardOptions(
          results.map((d) => ({
            label: d.folderTitle ? `${d.folderTitle} / ${d.title}` : d.title,
            value: d.uid,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoadingDashboards(false));

    getBackendSrv()
      .get('/api/datasources')
      .then((results: Array<{ uid: string; name: string; type: string }>) => {
        setDataSourceOptions(
          results.map((d) => ({ label: `${d.name} (${d.type})`, value: d.uid }))
        );
        const typeMap: Record<string, string> = {};
        results.forEach((d) => { typeMap[d.uid] = d.type; });
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

  const moveItemInSubSection = (si: number, ii: number, li: number, dir: -1 | 1) => {
    const sub = sections[si].items[ii] as NavSection;
    updateItemInSection(si, ii, { ...sub, items: swapItems(sub.items, li, li + dir) });
  };

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

  // ── Top links helpers ─────────────────────────────────────────────

  const addTopLink = () => setTopLinks((prev) => [...prev, emptyLink()]);
  const removeTopLink = (i: number) => setTopLinks((prev) => removeItem(prev, i));
  const updateTopLink = (i: number, patch: Partial<NavLink>) =>
    setTopLinks((prev) => replaceItem(prev, i, { ...prev[i], ...patch }));
  const moveTopLinkUp = (i: number) => setTopLinks((prev) => swapItems(prev, i - 1, i));
  const moveTopLinkDown = (i: number) => setTopLinks((prev) => swapItems(prev, i, i + 1));

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

      {/* ── Top-level links ── */}
      <FieldSet label="Liens hors section">
        <p className={s.varsDescription}>
          Liens affichés directement sous le lien Home, en dehors de toute section.
        </p>
        {topLinks.map((link, i) => (
          <div key={i} className={s.topLinkRow}>
            <LinkRow
              link={link}
              onUpdate={(patch) => updateTopLink(i, patch)}
              onRemove={() => removeTopLink(i)}
              {...linkRowProps}
            />
            <div className={s.topLinkOrder}>
              <IconButton name="arrow-up" tooltip="Monter" onClick={() => moveTopLinkUp(i)} disabled={i === 0} />
              <IconButton name="arrow-down" tooltip="Descendre" onClick={() => moveTopLinkDown(i)} disabled={i === topLinks.length - 1} />
            </div>
          </div>
        ))}
        <Button variant="secondary" size="sm" icon="plus" type="button" onClick={addTopLink} className={s.addLinkBtn}>
          Ajouter un lien
        </Button>
      </FieldSet>

      {/* ── Sections ── */}
      <FieldSet label="Sections de navigation">
        {sections.map((section, si) => (
          <div key={si} className={s.sectionBlock}>
            <div className={s.sectionHeader}>
              <div className={s.iconSelectSmall}>
                <Select
                  options={ICON_OPTIONS}
                  value={section.icon || null}
                  placeholder="—"
                  onChange={(v: SelectableValue<string>) => updateSection(si, { ...section, icon: v?.value ?? undefined })}
                  isClearable
                  allowCustomValue
                  prefix={section.icon ? <Icon name={section.icon as any} /> : undefined}
                />
              </div>
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

            {section.items.map((item, ii) =>
              isNavSection(item) ? (
                <div key={ii} className={s.subSectionBlock}>
                  <div className={s.sectionHeader}>
                    <div className={s.iconSelectSmall}>
                      <Select
                        options={ICON_OPTIONS}
                        value={item.icon || null}
                        placeholder="—"
                        onChange={(v: SelectableValue<string>) => updateItemInSection(si, ii, { ...item, icon: v?.value ?? undefined })}
                        isClearable
                        allowCustomValue
                        prefix={item.icon ? <Icon name={item.icon as any} /> : undefined}
                      />
                    </div>
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
                    Ajouter un lien
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

      {/* ── Recherche ── */}
      <FieldSet label="Recherche">
        <Field label="Activer la recherche">
          <Switch
            value={searchConfig.enabled}
            onChange={(e) => updateSearchConfig({ enabled: e.currentTarget.checked })}
          />
        </Field>

        {searchConfig.enabled && (
          <>
            <Field label="Data source">
              <Select
                options={dataSourceOptions}
                value={searchConfig.dataSourceUid || null}
                placeholder="Sélectionner une data source..."
                onChange={(v: DataSourceOption) => {
                  const uid = v.value ?? '';
                  updateSearchConfig({ dataSourceUid: uid, dataSourceType: dsTypeMap[uid] ?? '' });
                }}
                isClearable
                width={40}
              />
            </Field>

            {searchConfig.dataSourceUid && !SQL_DS_TYPES.includes(searchConfig.dataSourceType) && (
              <div className={s.dsTypeHint}>
                {`⚠️ Type de data source "${searchConfig.dataSourceType}" non supporté. Seules les data sources SQL sont supportées (PostgreSQL, MySQL, MSSQL).`}
              </div>
            )}

            <div className={s.searchTypesLabel}>Types de recherche</div>

            {searchConfig.types.map((type, i) => (
              <div key={i} className={s.searchTypeBlock}>
                <div className={s.searchTypeRow}>
                  <Field label="ID" className={s.fieldGrow}>
                    <Input
                      value={type.id}
                      placeholder="ex: custom_ip"
                      onChange={(e) => updateSearchType(i, { id: e.currentTarget.value })}
                    />
                  </Field>
                  <Field label="Label affiché" className={s.fieldGrow}>
                    <Input
                      value={type.label}
                      placeholder="ex: Adresse IP"
                      onChange={(e) => updateSearchType(i, { label: e.currentTarget.value })}
                    />
                  </Field>
                  <Field label="Variable Grafana" className={s.fieldGrow}>
                    <Input
                      value={type.variable}
                      placeholder="ex: host"
                      onChange={(e) => updateSearchType(i, { variable: e.currentTarget.value })}
                    />
                  </Field>
                  <div className={s.removeLink}>
                    <IconButton name="arrow-up" tooltip="Monter" onClick={() => moveSearchTypeUp(i)} disabled={i === 0} />
                    <IconButton name="arrow-down" tooltip="Descendre" onClick={() => moveSearchTypeDown(i)} disabled={i === searchConfig.types.length - 1} />
                    <IconButton name="trash-alt" tooltip="Supprimer ce type" onClick={() => removeSearchType(i)} />
                  </div>
                </div>
                {/* Champ query selon le type de data source */}
                {searchConfig.dataSourceUid && (
                  <Field
                    label="Requête SQL"
                    description="Doit retourner les colonnes : value, tag (optionnel), dashboard, + toute colonne additionnelle"
                  >
                    <textarea
                      className={s.queryTextarea}
                      value={type.query ?? ''}
                      placeholder="SELECT value, tag, dashboard FROM ma_table"
                      onChange={(e) => updateSearchType(i, { query: e.currentTarget.value })}
                      rows={3}
                      spellCheck={false}
                    />
                  </Field>
                )}
                {/* Variables additionnelles */}
                <div className={s.extraVarsLabel}>Variables additionnelles</div>
                <p className={s.extraVarsDesc}>
                  Déclarez les colonnes supplémentaires à passer comme variables Grafana lors de la navigation.
                </p>
                {(type.extraVariables ?? []).map((ev, vi) => (
                  <div key={vi} className={s.searchTypeRow}>
                    <Field label="Colonne" className={s.fieldGrow}>
                      <Input
                        value={ev.column}
                        placeholder="ex: hostid"
                        onChange={(e) => updateExtraVar(i, vi, { column: e.currentTarget.value })}
                      />
                    </Field>
                    <Field label="Variable Grafana" className={s.fieldGrow}>
                      <Input
                        value={ev.variable}
                        placeholder="ex: hostid"
                        onChange={(e) => updateExtraVar(i, vi, { variable: e.currentTarget.value })}
                      />
                    </Field>
                    <div className={s.removeLink}>
                      <IconButton name="trash-alt" tooltip="Supprimer" onClick={() => removeExtraVar(i, vi)} />
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
                  Ajouter une variable
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
              Ajouter un type
            </Button>
          </>
        )}
      </FieldSet>

      {/* ── Variables statiques ── */}
      <FieldSet label="Variables statiques">
        <p className={s.varsDescription}>
          Définissez des valeurs fixes réutilisables dans vos liens avec la syntaxe{' '}
          <code>$nom</code> ou <code>${'{nom}'}</code>.
        </p>

        {staticVars.map((v, i) => (
          <div key={i} className={s.staticVarRow}>
            <Field label="Nom" className={s.fieldFixed}>
              <Input
                value={v.key}
                placeholder="ex: env"
                onChange={(e) => updateStaticVar(i, { key: e.currentTarget.value })}
              />
            </Field>
            <Field label="Valeur" className={s.fieldGrow}>
              <Input
                value={v.value}
                placeholder="ex: production"
                onChange={(e) => updateStaticVar(i, { value: e.currentTarget.value })}
              />
            </Field>
            <div className={s.removeLink}>
              <IconButton name="trash-alt" tooltip="Supprimer" onClick={() => removeStaticVar(i)} />
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
          Ajouter une variable
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
  topLinkRow: css`
    display: flex;
    align-items: flex-end;
    gap: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(0.5)};
  `,
  topLinkOrder: css`
    display: flex;
    gap: ${theme.spacing(0.5)};
    padding-bottom: ${theme.spacing(0.5)};
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
