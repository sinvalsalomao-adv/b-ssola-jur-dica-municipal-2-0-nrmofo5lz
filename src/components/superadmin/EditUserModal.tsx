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
import { Loader2, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { useSuperadmin } from '@/context/SuperadminContext'
import { UserRole, UserStatus, GlobalUser } from '@/types/superadmin'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import pb from '@/lib/pocketbase/client'

interface Props {
  user: GlobalUser | null
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

export const EditUserModal: React.FC<Props> = ({ user, open, onOpenChange }) => {
  const { prefeituras, fetchUsers } = useSuperadmin()
  const [activeUser, setActiveUser] = useState<GlobalUser | null>(user)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('servidor')
  const [tenantId, setTenantId] = useState('')
  const [status, setStatus] = useState<UserStatus>('ativo')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) {
      setActiveUser(user)
    }
  }, [user])

  useEffect(() => {
    if (open && activeUser) {
      setName(activeUser.name || '')
      setEmail(activeUser.email || '')
      setRole(activeUser.role || 'servidor')
      setTenantId(prefeituras.find((p) => p.slug === activeUser.prefeituraSlug)?.id || '')
      setStatus(activeUser.status || 'ativo')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordReset(false)
      setErrors({})
    }
  }, [open, activeUser, prefeituras])

  const validate = (): boolean => {
    const errs: FieldErrors = {}
    if (!name.trim()) errs.name = 'Nome é obrigatório.'
    if (!email.trim()) errs.email = 'Email é obrigatório.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Email inválido.'
    if (!role) errs.role = 'Perfil é obrigatório.'
    if (role !== 'superadmin' && !tenantId)
      errs.tenant = 'Prefeitura é obrigatória para este perfil.'
    if (showPasswordReset) {
      if (!newPassword) errs.newPassword = 'Senha é obrigatória.'
      else if (newPassword.length < 8) errs.newPassword = 'Senha deve ter no mínimo 8 caracteres.'
      if (newPassword !== confirmPassword) errs.confirmPassword = 'As senhas não coincidem.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const target = user || activeUser
    if (!target || !validate()) return
    setSubmitting(true)
    try {
      const apiData: Record<string, any> = {
        name: name.trim(),
        email: email.trim(),
        role,
        status,
        tenant: tenantId || null,
      }
      if (showPasswordReset && newPassword) {
        apiData.password = newPassword
        apiData.passwordConfirm = confirmPassword
      }
      await pb.collection('users').update(target.id, apiData)
      await fetchUsers()
      toast.success('Usuário atualizado com sucesso!')
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
          <DialogTitle className="text-xl font-bold text-[#1c2a3e]">Editar Usuário</DialogTitle>
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

          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setShowPasswordReset(!showPasswordReset)}
              className="flex items-center gap-2 text-sm font-medium text-[#3b82f6] hover:text-[#2563eb] transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              {showPasswordReset ? 'Cancelar redefinição de senha' : 'Redefinir Senha'}
            </button>
            {showPasswordReset && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-700">Nova Senha *</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="mt-1"
                  />
                  {errors.newPassword && (
                    <p className="text-xs text-red-500 mt-1">{errors.newPassword}</p>
                  )}
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
            )}
          </div>

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
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
