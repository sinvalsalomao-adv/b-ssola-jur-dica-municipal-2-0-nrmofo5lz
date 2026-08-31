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
import { sanitizeInput } from '@/lib/sanitize'
import { createTenantUserSecure } from '@/services/memberships'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  defaultTenantId?: string
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin (Administrador Local)' },
  { value: 'servidor', label: 'Servidor Público' },
  { value: 'gestor', label: 'Gestor de Contratos' },
  { value: 'secretario', label: 'Secretário / Diretor' },
  { value: 'procurador', label: 'Procurador / Jurídico' },
]

export function TenantUserCreateModal({ open, onOpenChange, onCreated, defaultTenantId }: Props) {
  const { user } = useAuth()
  const isSuperadmin = user?.role === 'superadmin'
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('servidor')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  // Carregar lista de prefeituras se for superadmin
  useEffect(() => {
    if (open && isSuperadmin) {
      pb.collection('tenants')
        .getFullList({ filter: 'status = "ativa"', sort: 'name' })
        .then((records) => {
          setTenants(records.map((r: any) => ({ id: r.id, name: r.name })))
        })
        .catch(() => {})
    }
  }, [open, isSuperadmin])

  useEffect(() => {
    if (open) {
      setName('')
      setEmail('')
      setRole('servidor')
      setErrors({})
      const initialTenant = defaultTenantId || user?.tenantId || ''
      setSelectedTenantId(initialTenant)
    }
  }, [open, defaultTenantId, user?.tenantId])

  const validate = () => {
    const e: FieldErrors = {}
    if (!name.trim()) e.name = 'Nome é obrigatório.'
    if (!email.trim()) e.email = 'Email é obrigatório.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email inválido.'

    if (!selectedTenantId) {
      e.tenant = 'O município/prefeitura é obrigatório.'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate() || !selectedTenantId) return
    setSubmitting(true)
    try {
      const cleanEmail = sanitizeInput(email.trim().toLowerCase())
      const cleanName = sanitizeInput(name.trim())

      // Chamar endpoint backend transacional seguro (R-4: sem senha inicial na UI/endpoint)
      const res = await createTenantUserSecure({
        name: cleanName,
        email: cleanEmail,
        tenant: selectedTenantId,
        role,
      })

      toast.success(res.message || 'Convite enviado com sucesso!')
      onOpenChange(false)
      onCreated()
    } catch (err: any) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) {
        setErrors(fe)
        toast.error(Object.values(fe).join(' '))
      } else {
        toast.error(getErrorMessage(err) || err?.message || 'Erro ao criar usuário.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1c2a3e]">
            Convidar / Criar Usuário
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-1">
          {/* Campo Município / Prefeitura */}
          <div>
            <Label className="text-xs font-semibold text-gray-700">Município / Prefeitura *</Label>
            {isSuperadmin ? (
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o município..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={user?.prefeitura || 'Município atual'}
                disabled
                className="mt-1 bg-slate-50 text-gray-600 cursor-not-allowed"
              />
            )}
            {errors.tenant && <p className="text-xs text-red-500 mt-1">{errors.tenant}</p>}
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-700">Nome Completo *</Label>
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
          <p className="text-[11px] text-gray-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            O usuário convidado receberá uma mensagem para validar o acesso e definir sua própria
            senha com segurança. Vínculos municipais só são ativados após o aceite formal do
            titular.
          </p>
          <DialogFooter className="pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-1.5"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Enviar Convite / Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
