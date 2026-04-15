import { Component, type ErrorInfo, type ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  errorMessage: string | null
}

class AppErrorBoundaryInner extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled UI error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-8 space-y-4 text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">
                We hit an unexpected error while rendering this page.
              </p>
              {this.state.errorMessage && (
                <p className="text-xs text-destructive font-mono bg-destructive/10 rounded-md px-3 py-2 break-all">
                  {this.state.errorMessage}
                </p>
              )}
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => window.location.assign("/")}>
                  Back to home
                </Button>
                <Button onClick={() => window.location.reload()}>Reload page</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export function AppErrorBoundary({ children }: ErrorBoundaryProps) {
  const location = useLocation()
  return <AppErrorBoundaryInner key={location.pathname}>{children}</AppErrorBoundaryInner>
}
