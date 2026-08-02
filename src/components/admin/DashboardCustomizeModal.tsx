import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-react'
import { WIDGET_CATALOG, DEFAULT_WIDGET_CONFIG, type WidgetConfig } from '@/types/dashboard'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: WidgetConfig[]
  onSave: (config: WidgetConfig[]) => void
}

export function DashboardCustomizeModal({ open, onOpenChange, config, onSave }: Props) {
  const [local, setLocal] = useState<WidgetConfig[]>([])

  useEffect(() => {
    if (open) setLocal([...config].sort((a, b) => a.order - b.order))
  }, [open, config])

  const toggle = (id: string) =>
    setLocal((prev) => prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)))

  const move = (idx: number, dir: 'up' | 'down') => {
    setLocal((prev) => {
      const next = [...prev]
      const target = dir === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next.map((w, i) => ({ ...w, order: i }))
    })
  }

  const reset = () => setLocal(DEFAULT_WIDGET_CONFIG.map((w) => ({ ...w })))

  const handleSave = () => {
    onSave(local)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-white rounded-xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1c2a3e]">
            Personalizar Dashboard
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
          {local.map((w, idx) => {
            const meta = WIDGET_CATALOG.find((m) => m.id === w.id)
            return (
              <div
                key={w.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:bg-slate-50 transition-colors"
              >
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={idx === 0}
                    onClick={() => move(idx, 'up')}
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={idx === local.length - 1}
                    onClick={() => move(idx, 'down')}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1c2a3e]">{meta?.name || w.id}</p>
                  <p className="text-xs text-gray-400">{meta?.description}</p>
                </div>
                <Switch checked={w.visible} onCheckedChange={() => toggle(w.id)} />
              </div>
            )
          })}
        </div>
        <DialogFooter className="border-t pt-3 gap-2">
          <Button variant="outline" onClick={reset} className="gap-1.5 text-xs">
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrão
          </Button>
          <Button onClick={handleSave} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
