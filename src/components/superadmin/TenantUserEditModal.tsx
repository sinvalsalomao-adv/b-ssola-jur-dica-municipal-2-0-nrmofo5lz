import { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import { toast } from 'sonner'
import type { GlobalUser, UserRole } from '@/types/superadmin'
import { sanitizeInput } from '@/lib/sanitize'
import { updateTenantUser } from '@/services/users'

interface Props {
  user: GlobalUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'servidor', label: 'Servidor' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'secretario', label: 'Secretário' },
  { value: 'procurador', label: 'Procurador' },
]

export function TenantUserEditModal({ user, open, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('servidor')
  const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && user) {
      setName(user.name)
      setEmail(user.email)
      setRole(user.role)
      setStatus(user.status)
      setErrors({})
    }
  }, [open, user])

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!user) return
    const e: FieldErrors = {}
    if (!name.trim()) e.name = 'Nome é obrigatório.'
    if (!email.trim()) e.email = 'Email é obrigatório.'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setSubmitting(true)
    try {
      const cleanName = sanitizeInput(name.trim())

      // Chamar endpoint backend seguro e transacional
      await updateTenantUser({
        userId: user.id,
        name: cleanName,
        role,
        status,
      })

      toast.success('Usuário atualizado com sucesso!')
      onOpenChange(false)
      onSaved()
    } catch (err: any) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) {
        setErrors(fe)
        toast.error(Object.values(fe).join(' '))
      } else {
        toast.error(getErrorMessage(err) || err?.message || 'Erro ao atualizar usuário.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1c2a3e]">Editar Usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-1">
          <div>
            <Label className="text-xs font-semibold text-gray-700">Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-700">Email</Label>
            <Input
              type="email"
              value={email}
              disabled
              className="mt-1 bg-slate-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-[11px] text-gray-400 mt-0.5">
              O e-mail é a identidade global da conta e não pode ser alterado diretamente.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'ativo' | 'inativo')}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
