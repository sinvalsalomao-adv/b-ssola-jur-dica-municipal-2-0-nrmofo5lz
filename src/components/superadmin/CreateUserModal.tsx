import React, { useState, useEffect } from 'react'
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
import { toast } from 'sonner'
import { useSuperadmin } from '@/context/SuperadminContext'
import { UserRole, UserStatus } from '@/types/superadmin'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import {
  PasswordStrengthIndicator,
  validatePasswordStrength,
} from '@/components/PasswordStrengthIndicator'
import { sanitizeInput } from '@/lib/sanitize'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'superadmin', label: 'Superadmin' },
  { value: 'admin', label: 'Admin' },
  { value: 'servidor', label: 'Servidor' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'secretario', label: 'Secretário' },
  { value: 'procurador', label: 'Procurador' },
]

export const CreateUserModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const { addGlobalUser, prefeituras } = useSuperadmin()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('servidor')
  const [tenantId, setTenantId] = useState('')
  const [status, setStatus] = useState<UserStatus>('ativo')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setEmail('')
      setRole('servidor')
      setTenantId('')
      setStatus('ativo')
      setPassword('')
      setConfirmPassword('')
      setErrors({})
    }
  }, [open])

  const validate = (): boolean => {
    const errs: FieldErrors = {}
    if (!name.trim()) errs.name = 'Nome é obrigatório.'
    if (!email.trim()) errs.email = 'Email é obrigatório.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Email inválido.'
    if (!role) errs.role = 'Perfil é obrigatório.'
    if (role !== 'superadmin' && !tenantId)
      errs.tenant = 'Prefeitura é obrigatória para este perfil.'
    if (!password) {
      errs.password = 'Senha é obrigatória.'
    } else {
      const pwdVal = validatePasswordStrength(password)
      if (!pwdVal.allValid) {
        errs.password = 'A senha não atende a todos os requisitos de segurança.'
      }
    }
    if (password !== confirmPassword) errs.confirmPassword = 'As senhas não coincidem.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const tenant = prefeituras.find((p) => p.id === tenantId)
      await addGlobalUser({
        name: sanitizeInput(name.trim()),
        email: sanitizeInput(email.trim()),
        prefeituraName: tenant?.name || '—',
        prefeituraSlug: tenant?.slug || '',
        role,
        status,
        password,
        tenantId,
      })
      toast.success('Usuário criado com sucesso!')
      onOpenChange(false)
    } catch (err) {
      const fieldErrs = extractFieldErrors(err)
      if (Object.keys(fieldErrs).length > 0) {
        setErrors(fieldErrs)
        const msg = Object.values(fieldErrs).join(' ')
        toast.error(msg)
      } else {
        toast.error(getErrorMessage(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#1c2a3e]">Criar Novo Usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-semibold text-gray-700">Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João da Silva"
              className="mt-1"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-700">Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@exemplo.gov.br"
              className="mt-1"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Perfil *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as UserStatus)}>
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
          <div>
            <Label className="text-xs font-semibold text-gray-700">
              Prefeitura {role !== 'superadmin' ? '*' : '(opcional para superadmin)'}
            </Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione uma prefeitura..." />
              </SelectTrigger>
              <SelectContent>
                {prefeituras.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tenant && <p className="text-xs text-red-500 mt-1">{errors.tenant}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Senha *</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="mt-1"
              />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Confirmar Senha *</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className="mt-1"
              />
              {errors.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>
              )}
            </div>
          </div>
          {password && <PasswordStrengthIndicator password={password} />}
          <DialogFooter className="pt-4 border-t flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              <span>Criar Usuário</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
