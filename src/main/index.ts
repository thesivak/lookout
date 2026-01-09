import { app, BrowserWindow, shell, ipcMain, globalShortcut, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase, getDb } from './services/database'
import { registerIpcHandlers } from './ipc'
import { createTray, destroyTray, updateTrayMenu } from './tray'
import { startScheduler, stopScheduler } from './services/scheduler'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0D0D0D',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Hide to tray instead of closing on macOS
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !app.isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.lookout.app')

    // Default open or close DevTools by F12 in dev and ignore in production
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // Initialize database
    initDatabase()

    // Register IPC handlers
    registerIpcHandlers()

    // Create window
    createWindow()

    // Create application menu with shortcuts
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          {
            label: 'Settings',
            accelerator: 'Cmd+,',
            click: () => {
              mainWindow?.show()
              mainWindow?.webContents.send('navigate', 'settings')
            }
          },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Dashboard',
            accelerator: 'Cmd+1',
            click: () => {
              mainWindow?.show()
              mainWindow?.webContents.send('navigate', 'dashboard')
            }
          },
          {
            label: 'My Work',
            accelerator: 'Cmd+2',
            click: () => {
              mainWindow?.show()
              mainWindow?.webContents.send('navigate', 'my-work')
            }
          },
          {
            label: 'Team',
            accelerator: 'Cmd+3',
            click: () => {
              mainWindow?.show()
              mainWindow?.webContents.send('navigate', 'team')
            }
          },
          {
            label: 'Repositories',
            accelerator: 'Cmd+4',
            click: () => {
              mainWindow?.show()
              mainWindow?.webContents.send('navigate', 'repos')
            }
          },
          {
            label: 'History',
            accelerator: 'Cmd+5',
            click: () => {
              mainWindow?.show()
              mainWindow?.webContents.send('navigate', 'history')
            }
          },
          { type: 'separator' },
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Actions',
        submenu: [
          {
            label: 'Generate Summary',
            accelerator: 'Cmd+G',
            click: () => {
              mainWindow?.show()
              mainWindow?.webContents.send('navigate', 'my-work')
              mainWindow?.webContents.send('trigger-generate')
            }
          }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' }
        ]
      }
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)

    // Create system tray
    if (mainWindow) {
      createTray(mainWindow)

      // Update tray menu based on settings
      const db = getDb()
      const scheduledEnabled =
        (db.prepare('SELECT value FROM settings WHERE key = ?').get('scheduled_enabled') as { value: string } | undefined)
          ?.value === 'true'
      updateTrayMenu(mainWindow, scheduledEnabled)

      // Start scheduler
      startScheduler(mainWindow)
    }

    // Handle auto-launch setting
    ipcMain.handle('app:set-auto-launch', async (_, enabled: boolean) => {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true
      })
      return true
    })

    ipcMain.handle('app:get-auto-launch', async () => {
      const settings = app.getLoginItemSettings()
      return settings.openAtLogin
    })

    // Handle settings change to update tray
    ipcMain.on('settings:changed', (_, key: string, value: string) => {
      if (key === 'scheduled_enabled' && mainWindow) {
        updateTrayMenu(mainWindow, value === 'true')
      }
    })

    app.on('activate', () => {
      if (mainWindow) {
        mainWindow.show()
      } else if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })

  // Keep app running in tray (don't quit on window close on macOS)
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  // Clean up before quitting
  app.on('before-quit', () => {
    // @ts-expect-error - custom property
    app.isQuitting = true
    stopScheduler()
    destroyTray()
  })
}
