import { useEffect, useState } from 'react';
import { NavConfig } from '../types';
import { fetchPluginSettings } from '../api/plugin';

const PLUGIN_ID = 'saeme-navigation-app';

export function usePluginConfig(): { config: NavConfig | null } {
  const [config, setConfig] = useState<NavConfig | null>(null);

  useEffect(() => {
    fetchPluginSettings(PLUGIN_ID)
      .then(setConfig)
      .catch(() => setConfig({ sections: [] }));
  }, []);

  return { config };
}
