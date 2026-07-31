import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { createInternalNotification } from '@/services/admin-notifications'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  tenantId: string
}

const TYPES = [
  { value: 'Aviso Interno', label: 'Aviso Interno' },
  { value: 'Gargalo', label: 'Gargalo' },
  { value: 'Prazo Fatal', label: 'Prazo Fatal' },
]

export function NewNotificationModal({ open, onOpenChange, onCreated, tenantId }: Props) {
  const [assunto, setAssunto] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [tipo, setTipo] = useState('Aviso Interno')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setAssunto('')
      setMensagem('')
      setTipo('Aviso Interno')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assunto.trim() || !mensagem.trim() || !tenantId) return
    setSubmitting(true)
    try {
      await createInternalNotification({
        tenantId,
        subject: assunto.trim(),
        mensagem: mensagem.trim(),
        tipo,
      })
      toast.success('Notificação enviada com sucesso!')
      onOpenChange(false)
      onCreated()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] bg-white rounded-xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1c2a3e]">Nova Notificação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-1">
          <div>
            <Label className="text-xs font-semibold text-gray-700">Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-700">Assunto *</Label>
            <Input
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              className="mt-1"
              placeholder="Digite o assunto da notificação..."
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-700">Mensagem *</Label>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="mt-1 min-h-[100px]"
              placeholder="Digite a mensagem para os servidores..."
            />
          </div>
          <DialogFooter className="pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
