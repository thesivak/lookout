import { BrowserWindow, Notification } from 'electron'
import { getDb } from './database'

let schedulerInterval: NodeJS.Timeout | null = null
let lastCheckDate: string | null = null

interface SchedulerConfig {
  enabled: boolean
  time: string
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

  const existing = db
    .prepare(
      `SELECT id FROM summaries
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
  schedulerInterval = setInterval(() => {
    const config = getSchedulerConfig()

    if (!config.enabled) {
      return
    }

    if (isTimeToRun(config.time) && shouldRunToday()) {
      console.log('Scheduler: Triggering daily summary generation')
      triggerScheduledGeneration(mainWindow)
    }
  }, 60000)

  console.log('Scheduler started')
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
  }
  console.log('Scheduler stopped')
}

function triggerScheduledGeneration(mainWindow: BrowserWindow): void {
  mainWindow.webContents.send('scheduled-generation')

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
