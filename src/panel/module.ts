import { PanelPlugin } from '@grafana/data'
import { SimplePanel, SimplePanelOptions } from './SimplePanel'

export const plugin = new PanelPlugin<SimplePanelOptions>(SimplePanel)
