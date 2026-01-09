import { BrowserWindow, Notification } from 'electron'
import { getDb } from './database'

let schedulerInterval: NodeJS.Timeout | null = null
let lastCheckDate: string | null = null

interface SchedulerConfig {
  enabled: boolean
  time: string // HH:mm format
}

function getSchedulerConfig(): SchedulerConfig {
  const db = getDb()

  const enabledRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('scheduled_enabled') as
    | { value: string }
    | undefined
  const timeRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('scheduled_time') as
    | { value: string }
    | undefined

  return {
    enabled: enabledRow?.value === 'true',
    time: timeRow?.value || '09:00'
  }
}

function shouldRunToday(): boolean {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]

  // Check if we already generated a scheduled summary today
  const existing = db
    .prepare(
      `SELECT id FROM summ

aries
     WHERE date(created_at) = date(?)
     AND is_scheduled = 1
     LIMIT 1`
    )
    .get(today) as { id: number } | undefined

  return !existing
}

function isTimeToRun(scheduledTime: string): boolean {
  const now = new Date()
  const [hours, minutes] = scheduledTime.split(':').map(Number)

  const currentHours = now.getHours()
  const currentMinutes = now.getMinutes()

  // Check if we're within the scheduled minute
  // Also check if we haven't already checked this minute
  const currentTimeStr = `${currentHours}:${currentMinutes}`

  if (currentTimeStr === lastCheckDate) {
    return false
  }

  if (currentHours === hours && currentMinutes === minutes) {
    lastCheckDate = currentTimeStr
    return true
  }

  return false
}

export function startScheduler(mainWindow: BrowserWindow): void {
  // Check every minute
  schedulerInterval = setInterval(() => {
    const config = getSchedulerConfig()

    if (!config.enabled) {
      return
    }

    if (isTimeToRun(config.time) && shouldRunToday()) {
      console.log('Scheduler: Triggering daily summary generation')
      triggerScheduledGeneration(mainWindow)
    }
  }, 60000) // Check every minute

  console.log('Scheduler started')
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
  }
  console.log('Scheduler stopped')
}

export function restartScheduler(mainWindow: BrowserWindow): void {
  stopScheduler()
  startScheduler(mainWindow)
}

function triggerScheduledGeneration(mainWindow: BrowserWindow): void {
  // Send event to renderer to trigger generation
  mainWindow.webContents.send('scheduled-generation')

  // Show notification
  showNotification(
    'Daily Summary',
    'Generating your daily work summary...',
    () => {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('navigate', 'my-work')
    }
  )
}

export function showNotification(
  title: string,
  body: string,
  onClick?: () => void
): void {
  if (!Notification.isSupported()) {
    console.log('Notifications not supported')
    return
  }

  const notification = new Notification({
    title,
    body,
    silent: false
  })

  if (onClick) {
    notification.on('click', onClick)
  }

  notification.show()
}

export function showSummaryCompleteNotification(
  mainWindow: BrowserWindow,
  commitCount: number
): void {
  showNotification(
    'Summary Ready',
    `Your work summary is ready! ${commitCount} commits analyzed.`,
    () => {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('navigate', 'my-work')
    }
  )
}
