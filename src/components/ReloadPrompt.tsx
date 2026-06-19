import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from "@/components/ui/button";

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setNeedRefresh(false)
  }

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] m-0 p-4 border border-border bg-card shadow-elevated rounded-2xl animate-in slide-in-from-bottom-8">
      <div className="mb-3 text-sm font-medium">
        <span>New app update available.</span>
      </div>
      <div className="flex gap-2">
        <Button variant="hero" size="sm" onClick={() => updateServiceWorker(true)}>
          Upgrade App 🚀
        </Button>
        <Button variant="outline" size="sm" onClick={() => close()}>
          Later
        </Button>
      </div>
    </div>
  )
}
