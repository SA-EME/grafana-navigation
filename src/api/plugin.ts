import { lastValueFrom } from 'rxjs';
import { PluginMeta, SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { NavConfig } from '../types';

export type AppPluginSettings = { navConfig?: NavConfig };
export type DashboardOption = SelectableValue<string>;
export type DataSourceOption = SelectableValue<string>;

export async function fetchPluginSettings(pluginId: string): Promise<NavConfig> {
  const res = await getBackendSrv().get(`/api/plugins/${pluginId}/settings`);
  return res.jsonData?.navConfig ?? { sections: [] };
}

export async function fetchDashboards(): Promise<DashboardOption[]> {
  const results: Array<{ uid: string; title: string; folderTitle?: string }> =
    await getBackendSrv().get('/api/search?type=dash-db&limit=5000');
  return results.map((d) => ({
    label: d.folderTitle ? `${d.folderTitle} / ${d.title}` : d.title,
    value: d.uid,
  }));
}

export async function fetchDataSources(): Promise<{
  options: DataSourceOption[];
  typeMap: Record<string, string>;
}> {
  const results: Array<{ uid: string; name: string; type: string }> =
    await getBackendSrv().get('/api/datasources');
  return {
    options: results.map((d) => ({ label: `${d.name} (${d.type})`, value: d.uid })),
    typeMap: Object.fromEntries(results.map((d) => [d.uid, d.type])),
  };
}

export async function updatePlugin(pluginId: string, data: Partial<PluginMeta>): Promise<unknown> {
  const response = getBackendSrv().fetch({
    url: `/api/plugins/${pluginId}/settings`,
    method: 'POST',
    data,
  });
  return lastValueFrom(response);
}

export async function updatePluginAndReload(
  pluginId: string,
  data: Partial<PluginMeta<AppPluginSettings>>
): Promise<void> {
  try {
    await updatePlugin(pluginId, data);
    window.location.reload();
  } catch (e) {
    console.error('Error while updating the plugin', e);
  }
}
