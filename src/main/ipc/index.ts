import { registerRepoHandlers } from './repos'
import { registerSettingsHandlers } from './settings'
import { registerGitHandlers } from './git'
import { registerSummaryHandlers } from './summaries'
import { registerContributorHandlers } from './contributors'
import { registerGitHubHandlers } from './github'
import { registerCommitHandlers } from './commits'
import { registerPregenerationHandlers } from './pregeneration'
import { registerVelocityHandlers } from './velocity'
import { registerDangerZoneHandlers } from './dangerzone'
import { registerOAuthHandlers } from './oauth'

export function registerIpcHandlers(): void {
  registerOAuthHandlers()
  registerRepoHandlers()
  registerSettingsHandlers()
  registerGitHandlers()
  registerSummaryHandlers()
  registerContributorHandlers()
  registerGitHubHandlers()
  registerCommitHandlers()
  registerPregenerationHandlers()
  registerVelocityHandlers()
  registerDangerZoneHandlers()

  console.log('IPC handlers registered')
}
