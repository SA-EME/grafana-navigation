import React, { useEffect, useState } from 'react'
import { PanelProps } from '@grafana/data'
import { getBackendSrv } from '@grafana/runtime'

const PLUGIN_ID = 'saeme-navigation-app'

export interface SimplePanelOptions {}

export const SimplePanel: React.FC<PanelProps<SimplePanelOptions>> = () => {
  const [apiUrl, setApiUrl] = useState('loading...')

  useEffect(() => {
    async function load() {
      try {
        const res = await getBackendSrv().get(`/api/plugins/${PLUGIN_ID}/settings`)
        setApiUrl(res.jsonData?.apiUrl || 'no config')
      } catch (e) {
        setApiUrl('error')
      }
    }
    load()
  }, [])

  return <div style={{ padding: 12 }}>{apiUrl}</div>
}
