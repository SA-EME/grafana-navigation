import { PanelPlugin } from '@grafana/data'
import { NavigationPanel, NavigationPanelOptions } from './NavigationPanel'

export const plugin = new PanelPlugin<NavigationPanelOptions>(NavigationPanel)
