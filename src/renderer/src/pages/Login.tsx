import { useState, useEffect } from 'react'
import { Github, Copy, Check, ExternalLink, Loader2, AlertCircle, Eye, GitCommit, BarChart3, Users } from 'lucide-react'
import Button from '../components/ui/Button'

interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

interface LoginProps {
  onLoginSuccess: () => void
}

export default function Login({ onLoginSuccess }: LoginProps): JSX.Element {
  const [step, setStep] = useState<'initial' | 'device-code' | 'polling' | 'error'>('initial')
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pollingStatus, setPollingStatus] = useState('Waiting for authorization...')

  useEffect(() => {
    const unsubscribe = window.api.oauth.onPollingStatus((status) => {
      setPollingStatus(status)
    })
    return () => unsubscribe()
  }, [])

  const handleStartLogin = async () => {
    try {
      setError(null)
      setStep('device-code')

      const result = await window.api.oauth.startDeviceFlow()

      if (!result.success || !result.deviceCode) {
        setError(result.error || 'Failed to start authentication')
        setStep('error')
        return
      }

      setDeviceCode(result.deviceCode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start authentication')
      setStep('error')
    }
  }

  const handleOpenGitHub = async () => {
    if (!deviceCode) return

    await window.api.oauth.openVerificationUrl(deviceCode.verification_uri)
    setStep('polling')

    // Start polling for token
    try {
      const result = await window.api.oauth.pollForToken(
        deviceCode.device_code,
        deviceCode.interval
      )

      if (result.success && result.user) {
        onLoginSuccess()
      } else {
        setError(result.error || 'Authentication failed')
        setStep('error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
      setStep('error')
    }
  }

  const handleCopyCode = async () => {
    if (!deviceCode) return
    await navigator.clipboard.writeText(deviceCode.user_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCancel = async () => {
    await window.api.oauth.cancelPolling()
    setStep('initial')
    setDeviceCode(null)
    setError(null)
  }

  const handleRetry = () => {
    setStep('initial')
    setDeviceCode(null)
    setError(null)
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left side - Branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-accent/20 via-background to-background p-12 lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
              <Eye className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold">Lookout</span>
          </div>
        </div>

        <div className="space-y-8">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            AI-powered insights<br />
            for your Git activity
          </h1>
          <p className="text-lg text-muted-foreground">
            Generate intelligent summaries of your commits, track team velocity,
            and gain insights from your GitHub repositories.
          </p>

          <div className="grid gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
                <GitCommit className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="font-medium">Smart Summaries</p>
                <p className="text-sm text-muted-foreground">AI-generated commit summaries</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
                <BarChart3 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-medium">Team Velocity</p>
                <p className="text-sm text-muted-foreground">Track productivity over time</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="font-medium">Collaboration Insights</p>
                <p className="text-sm text-muted-foreground">PR reviews and team metrics</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Built with Claude by Anthropic
        </p>
      </div>

      {/* Right side - Login */}
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
              <Eye className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold">Lookout</span>
          </div>

          {/* Initial state - Sign in button */}
          {step === 'initial' && (
            <div className="space-y-6 text-center">
              <div>
                <h2 className="text-2xl font-semibold">Welcome to Lookout</h2>
                <p className="mt-2 text-muted-foreground">
                  Connect your GitHub account to get started
                </p>
              </div>

              <Button
                onClick={handleStartLogin}
                className="h-12 w-full gap-2 text-[15px]"
              >
                <Github className="h-5 w-5" />
                Continue with GitHub
              </Button>

              <p className="text-xs text-muted-foreground">
                By continuing, you agree to grant Lookout access to your GitHub
                repositories, commits, and pull requests.
              </p>
            </div>
          )}

          {/* Device code state - Show code to copy */}
          {step === 'device-code' && deviceCode && (
            <div className="space-y-6 text-center">
              <div>
                <h2 className="text-2xl font-semibold">Enter your code</h2>
                <p className="mt-2 text-muted-foreground">
                  Copy this code and enter it on GitHub
                </p>
              </div>

              {/* Code display */}
              <div className="relative">
                <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-accent bg-accent/5 p-6">
                  <span className="font-mono text-3xl font-bold tracking-widest">
                    {deviceCode.user_code}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="absolute right-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {copied ? (
                      <Check className="h-5 w-5 text-success" />
                    ) : (
                      <Copy className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {copied && (
                  <p className="mt-2 text-sm text-success">Copied to clipboard!</p>
                )}
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleOpenGitHub}
                  className="h-12 w-full gap-2 text-[15px]"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open GitHub
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Code expires in {Math.floor(deviceCode.expires_in / 60)} minutes
              </p>
            </div>
          )}

          {/* Polling state - Waiting for authorization */}
          {step === 'polling' && (
            <div className="space-y-6 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                  <Loader2 className="h-8 w-8 animate-spin text-accent" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">Waiting for authorization</h2>
                  <p className="mt-2 text-muted-foreground">
                    {pollingStatus}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4 text-left">
                <p className="text-sm text-muted-foreground">
                  Complete the authorization in your browser. Once you&apos;ve entered the code
                  and authorized Lookout, this page will update automatically.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={handleCancel}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Error state */}
          {step === 'error' && (
            <div className="space-y-6 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">Authentication failed</h2>
                  <p className="mt-2 text-muted-foreground">
                    {error || 'Something went wrong. Please try again.'}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleRetry}
                className="h-12 w-full gap-2 text-[15px]"
              >
                <Github className="h-5 w-5" />
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
