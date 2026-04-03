import { PanelPlugin } from '@grafana/data'
import { SimplePanel, SimplePanelOptions } from './SimplePanel'

export const panelPlugin = new PanelPlugin<SimplePanelOptions>(SimplePanel)
