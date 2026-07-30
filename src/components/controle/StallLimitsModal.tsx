import React, { useState, useEffect } from 'react'
import { COLUMNS } from '@/types/project'
import { StallLimits } from '@/types/controle'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface StallLimitsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  limits: StallLimits
  proximityDays: number
  onSave: (limits: StallLimits, proximityDays: number) => void
}

export const StallLimitsModal: React.FC<StallLimitsModalProps> = ({
  open,
  onOpenChange,
  limits,
  proximityDays,
  onSave,
}) => {
  const [localLimits, setLocalLimits] = useState<StallLimits>(limits)
  const [localProximity, setLocalProximity] = useState(proximityDays)

  useEffect(() => {
    if (open) {
      setLocalLimits(limits)
      setLocalProximity(proximityDays)
    }
  }, [open, limits, proximityDays])

  const handleSave = () => {
    onSave(localLimits, localProximity)
    toast.success('Limites atualizados com sucesso!')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1c2a3e]">
            Configurar Limites de Gargalo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-gray-500">
            Defina o limite máximo de dias que um card pode ficar parado em cada coluna antes de
            gerar alerta.
          </p>
          {COLUMNS.map((col) => (
            <div key={col} className="flex items-center justify-between gap-4">
              <Label className="text-sm text-gray-700 flex-1">{col}</Label>
              <Input
                type="number"
                min={1}
                value={localLimits[col]}
                onChange={(e) =>
                  setLocalLimits({ ...localLimits, [col]: Math.max(1, Number(e.target.value)) })
                }
                className="w-20 h-8 text-center"
              />
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 pt-2 border-t">
            <Label className="text-sm text-gray-700 flex-1 font-semibold">
              Proximidade de Prazo (dias)
            </Label>
            <Input
              type="number"
              min={1}
              value={localProximity}
              onChange={(e) => setLocalProximity(Math.max(1, Number(e.target.value)))}
              className="w-20 h-8 text-center"
            />
          </div>
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white" onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
