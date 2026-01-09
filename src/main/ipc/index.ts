import { registerRepoHandlers } from './repos'
import { registerSettingsHandlers } from './settings'
import { registerGitHandlers } from './git'
import { registerSummaryHandlers } from './summaries'
import { registerContributorHandlers } from './contributors'

export function registerIpcHandlers(): void {
  registerRepoHandlers()
  registerSettingsHandlers()
  registerGitHandlers()
  registerSummaryHandlers()
  registerContributorHandlers()

  console.log('IPC handlers registered')
}
