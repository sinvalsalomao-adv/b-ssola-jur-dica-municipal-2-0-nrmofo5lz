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
import { Loader2, KeyRound } from 'lucide-react'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'
import type { GlobalUser, UserRole } from '@/types/superadmin'
import {
  PasswordStrengthIndicator,
  validatePasswordStrength,
} from '@/components/PasswordStrengthIndicator'
import { sanitizeInput } from '@/lib/sanitize'

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
  const [showPwd, setShowPwd] = useState(false)
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && user) {
      setName(user.name)
      setEmail(user.email)
      setRole(user.role)
      setStatus(user.status)
      setNewPwd('')
      setConfirmPwd('')
      setShowPwd(false)
      setErrors({})
    }
  }, [open, user])

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!user) return
    const e: FieldErrors = {}
    if (!name.trim()) e.name = 'Nome é obrigatório.'
    if (!email.trim()) e.email = 'Email é obrigatório.'
    if (showPwd) {
      if (!newPwd) {
        e.newPwd = 'Senha é obrigatória.'
      } else {
        const pwdVal = validatePasswordStrength(newPwd)
        if (!pwdVal.allValid) {
          e.newPwd = 'A senha não atende a todos os requisitos de segurança.'
        }
      }
      if (newPwd !== confirmPwd) e.confirmPwd = 'As senhas não coincidem.'
    }
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setSubmitting(true)
    try {
      const data: Record<string, any> = {
        name: sanitizeInput(name.trim()),
        email: sanitizeInput(email.trim()),
        role,
        status,
      }
      if (showPwd && newPwd) {
        data.password = newPwd
        data.passwordConfirm = confirmPwd
      }
      await pb.collection('users').update(user.id, data)
      toast.success('Usuário atualizado com sucesso!')
      onOpenChange(false)
      onSaved()
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) {
        setErrors(fe)
        toast.error(Object.values(fe).join(' '))
      } else {
        toast.error(getErrorMessage(err))
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
            <Label className="text-xs font-semibold text-gray-700">Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
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
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="flex items-center gap-2 text-sm font-medium text-[#3b82f6] hover:text-[#2563eb]"
            >
              <KeyRound className="w-4 h-4" />
              {showPwd ? 'Cancelar redefinição' : 'Redefinir Senha'}
            </button>
            {showPwd && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <Label className="text-xs font-semibold text-gray-700">Nova Senha</Label>
                  <Input
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    className="mt-1"
                  />
                  {errors.newPwd && <p className="text-xs text-red-500 mt-1">{errors.newPwd}</p>}
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-700">Confirmar</Label>
                  <Input
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    className="mt-1"
                  />
                  {errors.confirmPwd && (
                    <p className="text-xs text-red-500 mt-1">{errors.confirmPwd}</p>
                  )}
                </div>
                {newPwd && (
                  <div className="col-span-2">
                    <PasswordStrengthIndicator password={newPwd} />
                  </div>
                )}
              </div>
            )}
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
