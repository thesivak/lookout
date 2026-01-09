import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

let tray: Tray | null = null

// Create a simple eye/lookout icon as base64 PNG (16x16 template)
const ICON_BASE64 = `iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADCSURBVDiNpdMxSkNBFAXQ80HQRki1A0vtLQJuILgE1+AGcgeWFm4hhaUgWFhYCIJgYaGNWIigBH/xwZB8k1ycYuDNnTtz5w3/hBPc4RkfWGnS1hPucYMH3OIZb1hP4C1c4wXvWMcWZuMIrOM46c/xhTXs4whH2M3gbbbCj7HAESYxxGEz8oJJW5xjD7uYZAY6OMAP9nGKSYwhYIpxHOMEY4zjHdO2gjU84BAb2MEYYwi4wC02sY0xxHCFS2xghTHE8A1QCCr+Bqz6VwAAAABJRU5ErkJggg==`

export function createTray(mainWindow: BrowserWindow): Tray {
  // Create tray icon - use template image for macOS
  const iconPath = join(__dirname, '../../resources/iconTemplate.png')

  // Create icon from base64 or file
  let icon: nativeImage
  if (existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath)
  } else {
    // Use embedded icon
    icon = nativeImage.createFromDataURL(`data:image/png;base64,${ICON_BASE64}`)
  }

  // For macOS, set as template image for proper menu bar appearance
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true)
  }

  tray = new Tray(icon)
  tray.setToolTip('Lookout - Git Work Summaries')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Lookout',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      label: 'Generate Summary',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('navigate', 'my-work')
        mainWindow.webContents.send('trigger-generate')
      }
    },
    { type: 'separator' },
    {
      label: 'Dashboard',
      click: () => {
        mainWindow.show()
        mainWindow.webContents.send('navigate', 'dashboard')
      }
    },
    {
      label: 'My Work',
      click: () => {
        mainWindow.show()
        mainWindow.webContents.send('navigate', 'my-work')
      }
    },
    {
      label: 'History',
      click: () => {
        mainWindow.show()
        mainWindow.webContents.send('navigate', 'history')
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        mainWindow.show()
        mainWindow.webContents.send('navigate', 'settings')
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Lookout',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // On macOS, clicking the tray icon shows the window
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  return tray
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

export function updateTrayMenu(mainWindow: BrowserWindow, scheduledEnabled: boolean): void {
  if (!tray) return

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Lookout',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      label: 'Generate Summary Now',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('navigate', 'my-work')
        mainWindow.webContents.send('trigger-generate')
      }
    },
    { type: 'separator' },
    {
      label: scheduledEnabled ? '✓ Scheduled Generation' : 'Scheduled Generation',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Dashboard',
      click: () => {
        mainWindow.show()
        mainWindow.webContents.send('navigate', 'dashboard')
      }
    },
    {
      label: 'My Work',
      click: () => {
        mainWindow.show()
        mainWindow.webContents.send('navigate', 'my-work')
      }
    },
    {
      label: 'History',
      click: () => {
        mainWindow.show()
        mainWindow.webContents.send('navigate', 'history')
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        mainWindow.show()
        mainWindow.webContents.send('navigate', 'settings')
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Lookout',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}
