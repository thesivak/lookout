/**
 * OAuth IPC handlers for GitHub authentication
 */

import { ipcMain, BrowserWindow } from 'electron'
import {
  startDeviceFlow,
  openVerificationUrl,
  pollForToken,
  cancelPolling,
  completeOAuth,
  getCurrentUser,
  logout,
  isAuthenticated,
  initializeOAuth,
  fetchUserRepositories,
  type GitHubOAuthUser,
  type DeviceCodeResponse
} from '../services/oauth'

let mainWindow: BrowserWindow | null = null

export function setOAuthMainWindow(window: BrowserWindow): void {
  mainWindow = window
}

export function registerOAuthHandlers(): void {
  // Check if user is authenticated
  ipcMain.handle('oauth:check', async (): Promise<{
    authenticated: boolean
    user: GitHubOAuthUser | null
  }> => {
    try {
      const user = await initializeOAuth()
      return {
        authenticated: user !== null,
        user
      }
    } catch (error) {
      console.error('OAuth check failed:', error)
      return { authenticated: false, user: null }
    }
  })

  // Get current user
  ipcMain.handle('oauth:get-user', async (): Promise<GitHubOAuthUser | null> => {
    return getCurrentUser()
  })

  // Start device flow authentication
  ipcMain.handle('oauth:start-device-flow', async (): Promise<{
    success: boolean
    deviceCode?: DeviceCodeResponse
    error?: string
  }> => {
    try {
      const deviceCode = await startDeviceFlow()
      return { success: true, deviceCode }
    } catch (error) {
      console.error('Failed to start device flow:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start authentication'
      }
    }
  })

  // Open verification URL in browser
  ipcMain.handle('oauth:open-verification-url', async (_, url: string): Promise<void> => {
    openVerificationUrl(url)
  })

  // Poll for access token
  ipcMain.handle('oauth:poll-for-token', async (_, deviceCode: string, interval: number): Promise<{
    success: boolean
    user?: GitHubOAuthUser
    error?: string
  }> => {
    try {
      const tokenResponse = await pollForToken(deviceCode, interval, (status) => {
        // Send progress updates to renderer
        mainWindow?.webContents.send('oauth:polling-status', status)
      })

      const user = await completeOAuth(tokenResponse)
      return { success: true, user }
    } catch (error) {
      console.error('Failed to complete OAuth:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      }
    }
  })

  // Cancel polling
  ipcMain.handle('oauth:cancel-polling', async (): Promise<void> => {
    cancelPolling()
  })

  // Logout
  ipcMain.handle('oauth:logout', async (): Promise<{ success: boolean }> => {
    try {
      logout()
      return { success: true }
    } catch (error) {
      console.error('Logout failed:', error)
      return { success: false }
    }
  })

  // Fetch user's GitHub repositories
  ipcMain.handle('oauth:list-repos', async (_, options?: {
    perPage?: number
    page?: number
    sort?: 'created' | 'updated' | 'pushed' | 'full_name'
  }): Promise<{
    success: boolean
    repos?: Awaited<ReturnType<typeof fetchUserRepositories>>
    error?: string
  }> => {
    try {
      if (!isAuthenticated()) {
        return { success: false, error: 'Not authenticated' }
      }
      const repos = await fetchUserRepositories(options)
      return { success: true, repos }
    } catch (error) {
      console.error('Failed to fetch repos:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch repositories'
      }
    }
  })
}
