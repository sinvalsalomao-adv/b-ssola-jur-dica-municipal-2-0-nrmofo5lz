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
import { useAuth } from '@/context/AuthContext'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'
import type { UserRole } from '@/types/superadmin'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'servidor', label: 'Servidor' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'secretario', label: 'Secretário' },
  { value: 'procurador', label: 'Procurador' },
]

export function TenantUserCreateModal({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('servidor')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setEmail('')
      setRole('servidor')
      setPassword('')
      setConfirm('')
      setErrors({})
    }
  }, [open])

  const validate = () => {
    const e: FieldErrors = {}
    if (!name.trim()) e.name = 'Nome é obrigatório.'
    if (!email.trim()) e.email = 'Email é obrigatório.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email inválido.'
    if (!password) e.password = 'Senha é obrigatória.'
    else if (password.length < 8) e.password = 'Mínimo 8 caracteres.'
    if (password !== confirm) e.confirm = 'As senhas não coincidem.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate() || !user?.tenantId) return
    setSubmitting(true)
    try {
      await pb.collection('users').create({
        name: name.trim(),
        email: email.trim(),
        role,
        status: 'ativo',
        tenant: user.tenantId,
        password,
        passwordConfirm: confirm,
      })
      toast.success('Usuário criado com sucesso!')
      onOpenChange(false)
      onCreated()
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
          <DialogTitle className="text-lg font-bold text-[#1c2a3e]">Criar Usuário</DialogTitle>
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
          <div>
            <Label className="text-xs font-semibold text-gray-700">Papel *</Label>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Senha *</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Confirmar *</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1"
              />
              {errors.confirm && <p className="text-xs text-red-500 mt-1">{errors.confirm}</p>}
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
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
