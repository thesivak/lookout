import { registerRepoHandlers } from './repos'
import { registerSettingsHandlers } from './settings'
import { registerGitHandlers } from './git'
import { registerSummaryHandlers } from './summaries'

export function registerIpcHandlers(): void {
  registerRepoHandlers()
  registerSettingsHandlers()
  registerGitHandlers()
  registerSummaryHandlers()

  console.log('IPC handlers registered')
}
