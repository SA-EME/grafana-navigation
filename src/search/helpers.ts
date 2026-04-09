import { lastValueFrom } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';

export interface SearchResult {
  value: string;
  tag?: string;
  dashboard: string;
  extras: Record<string, string>;
}

export function parseDataFrames(responseData: unknown): SearchResult[] {
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
          const extras: Record<string, string> = {};
          fields.forEach((f, fi) => {
            if (fi !== valueIdx && fi !== tagIdx && fi !== dashboardIdx) {
              extras[f.name] = String((values[fi] as unknown[])?.[i] ?? '');
            }
          });
          results.push({ value, tag, dashboard, extras });
        }
      }
    }
  } catch {
    // malformed response
  }
  return results;
}

export function buildQuery(dataSourceUid: string, query?: string): Record<string, unknown> {
  return {
    refId: 'A',
    datasource: { uid: dataSourceUid },
    rawSql: query ?? '',
    format: 'table',
  };
}

export async function queryDataSource(dataSourceUid: string, query?: string): Promise<SearchResult[]> {
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
