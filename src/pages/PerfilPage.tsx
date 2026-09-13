import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Mail,
  Shield,
  Camera,
  KeyRound,
  Save,
  SlidersHorizontal,
  Check,
  Building2,
  Globe,
  Info,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth, type HierarchyRole } from '@/context/AuthContext'
import { useUnsavedChanges } from '@/context/UnsavedChangesContext'
import { updateProfileName, uploadAvatar, changePassword, getAvatarUrl } from '@/services/profile'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'
import {
  PasswordStrengthIndicator,
  validatePasswordStrength,
} from '@/components/PasswordStrengthIndicator'
import { sanitizeInput } from '@/lib/sanitize'
import { PageHeader } from '@/components/common/PageHeader'
import { SubmitButton } from '@/components/common/StateDisplay'

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  servidor: 'Comum (Servidor)',
  gestor: 'Gestor',
  secretario: 'Secretário',
  procurador: 'Procurador',
}

const HIERARCHY_DETAILS: Record<
  HierarchyRole,
  { label: string; tag: string; description: string; badgeClass: string }
> = {
  superadmin: {
    label: 'Superadministrador',
    tag: 'Visão Global',
    description:
      'Acesso irrestrito a todas as prefeituras, configurações de plataforma e auditoria.',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  admin: {
    label: 'Administrador Local',
    tag: 'Gestão Municipal',
    description:
      'Gestão de usuários locais, relatórios municipais, configurações e auditoria do município.',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  servidor: {
    label: 'Usuário Comum',
    tag: 'Operação Municipal',
    description:
      'Acesso focado na operação diária: kanban, DFDs, cursos, sem acesso a cadastros e relatórios gerenciais.',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
  },
}

export default function PerfilPage() {
  const navigate = useNavigate()
  const { user, availableHierarchyRoles, canSwitchRole, switchRole } = useAuth()
  const { confirmTenantSwitch } = useUnsavedChanges()
  const [switchingRole, setSwitchingRole] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    setName(user.name)
    setEmail(user.email)
    const fetchUser = async () => {
      try {
        const record = await pb.collection('users').getOne(user.id)
        if (record.avatar) {
          setAvatarUrl(getAvatarUrl(user.id, record.avatar))
        }
      } catch {
        /* ignore */
      }
    }
    fetchUser()
  }, [user?.id])

  const handleSaveName = async () => {
    if (!user) return
    setSavingName(true)
    try {
      await updateProfileName(user.id, sanitizeInput(name))
      toast.success('Nome atualizado com sucesso!')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingName(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setSavingAvatar(true)
    try {
      await uploadAvatar(user.id, file)
      const record = await pb.collection('users').getOne(user.id)
      if (record.avatar) {
        setAvatarUrl(getAvatarUrl(user.id, record.avatar))
      }
      toast.success('Avatar atualizado com sucesso!')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingAvatar(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleChangePassword = async () => {
    if (!user) return
    const pwdVal = validatePasswordStrength(newPwd)
    if (!pwdVal.allValid) {
      toast.error('A nova senha não atende a todos os requisitos de segurança.')
      return
    }
    if (newPwd !== confirmPwd) {
      toast.error('As senhas não coincidem.')
      return
    }
    setSavingPwd(true)
    try {
      await changePassword(email, currentPwd, newPwd)
      toast.success('Senha alterada com sucesso!')
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
    } catch {
      toast.error('Senha atual incorreta ou erro ao alterar.')
    } finally {
      setSavingPwd(false)
    }
  }

  const initials = (name || 'U')
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('')

  const handleRoleSelection = (targetRole: HierarchyRole) => {
    if (!user || user.role === targetRole || switchingRole) return

    confirmTenantSwitch(async () => {
      setSwitchingRole(true)
      try {
        await switchRole(targetRole)
        toast.success(`Papel alterado para ${HIERARCHY_DETAILS[targetRole].label}!`)
        if (targetRole === 'superadmin') {
          navigate('/superadmin')
        } else {
          navigate('/dashboard')
        }
      } catch (err: any) {
        toast.error(err?.message || 'Não foi possível alterar a hierarquia.')
      } finally {
        setSwitchingRole(false)
      }
    })
  }

  // Seletor de papéis ordenados hierarquicamente: superadmin -> admin -> servidor
  const allHierarchyOrder: HierarchyRole[] = ['superadmin', 'admin', 'servidor']

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-10">
      <PageHeader
        title="Meu Perfil"
        description="Gerencie seus dados pessoais, hierarquia de acesso em uso e credenciais de segurança."
        icon={User}
      />

      <Card className="bg-white border-0 shadow-subtle">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-20 h-20 border-2 border-gray-200">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
                <AvatarFallback className="bg-[#1c2a3e] text-white text-xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#3b82f6] flex items-center justify-center text-white shadow-md hover:bg-[#2563eb] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#3b82f6]"
                disabled={savingAvatar}
                aria-label="Alterar foto do perfil"
                title="Alterar foto do perfil"
              >
                {savingAvatar ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1c2a3e]">{name}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Mail className="w-3 h-3" /> {email}
              </p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <Shield className="w-3 h-3" /> Papel em uso:{' '}
                <span className="font-semibold text-gray-700">
                  {ROLE_LABELS[user?.role || 'servidor'] || user?.role}
                </span>
              </p>
              {user?.tenantId && user?.prefeitura ? (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3 h-3 text-blue-500" /> {user.prefeitura}
                </p>
              ) : (
                <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                  <Globe className="w-3 h-3" /> Visão Global (sem prefeitura vinculada)
                </p>
              )}
            </div>
          </div>

          {/* Card / Seção de Alternância de Hierarquia (Visível se tiver direito a alternar) */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#3b82f6]" />
                <h3 className="text-sm font-bold text-[#1c2a3e]">Alternância de Hierarquia</h3>
              </div>
              <Badge variant="outline" className="text-[11px] font-normal">
                Conta: {ROLE_LABELS[user?.accountRole || 'servidor'] || user?.accountRole}
              </Badge>
            </div>

            {canSwitchRole ? (
              <div className="space-y-3 mt-3">
                <p className="text-xs text-gray-600 leading-relaxed">
                  Alterne entre as hierarquias disponíveis para sua conta e vínculo ativo. O papel
                  selecionado define as permissões e o menu visualizados nesta sessão.
                </p>

                <div className="grid grid-cols-1 gap-2.5">
                  {allHierarchyOrder.map((roleKey) => {
                    const isAvailable = availableHierarchyRoles.includes(roleKey)
                    const isActive = user?.role === roleKey
                    const details = HIERARCHY_DETAILS[roleKey]

                    return (
                      <div
                        key={roleKey}
                        className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                          isActive
                            ? 'border-blue-500 bg-blue-50/60 shadow-xs'
                            : isAvailable
                              ? 'border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50/50'
                              : 'border-gray-100 bg-gray-50/60 opacity-55'
                        }`}
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-sm text-[#1c2a3e]">
                              {details.label}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${details.badgeClass}`}
                            >
                              {details.tag}
                            </span>
                            {isActive && (
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-100/70 px-2 py-0.5 rounded-full">
                                <Check className="w-3 h-3" /> Em uso
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 leading-snug">
                            {details.description}
                          </p>
                        </div>

                        <div className="shrink-0 pt-0.5">
                          {isActive ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled
                              className="h-8 text-xs font-semibold border-blue-200 text-blue-700 bg-white"
                            >
                              Ativo
                            </Button>
                          ) : isAvailable ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleRoleSelection(roleKey)}
                              disabled={switchingRole}
                              className="h-8 text-xs bg-[#1c2a3e] hover:bg-[#2a3f5f] text-white transition-colors"
                            >
                              Alternar
                            </Button>
                          ) : (
                            <span className="text-[11px] text-gray-400 font-medium px-2 py-1">
                              Indisponível
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex items-start gap-2 bg-amber-50/80 border border-amber-200/80 rounded-lg p-2.5 text-xs text-amber-900 mt-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-snug">
                    A alternância de papel altera as telas, menus e experiência operacional na
                    sessão atual. Ela não altera o cadastro da sua conta no banco de dados e não
                    exige nova senha.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 mt-3">
                <p className="text-xs text-gray-600 leading-relaxed">
                  Sua conta possui acesso exclusivo como{' '}
                  <strong>{ROLE_LABELS[user?.role || 'servidor']}</strong>. Apenas contas com perfil
                  de Superadministrador ou Administrador Municipal podem alternar entre níveis
                  hierárquicos.
                </p>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <Label htmlFor="perfil-nome" className="text-xs font-semibold text-gray-700">
              Nome Completo
            </Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="perfil-nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                disabled={savingName}
              />
              <SubmitButton
                type="button"
                onClick={handleSaveName}
                submitting={savingName}
                submittingText="Salvando..."
                icon={<Save className="w-4 h-4" aria-hidden="true" />}
                className="shrink-0"
                aria-label="Salvar nome do perfil"
              >
                Salvar
              </SubmitButton>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-0 shadow-subtle">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <KeyRound className="w-4 h-4 text-[#3b82f6]" />
            <h3 className="text-sm font-bold text-[#1c2a3e]">Redefinir Senha</h3>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Senha Atual</Label>
              <Input
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="nova-senha" className="text-xs font-semibold text-gray-700">
                  Nova Senha
                </Label>
                <Input
                  id="nova-senha"
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  className="mt-1"
                  disabled={savingPwd}
                />
              </div>
              <div>
                <Label htmlFor="confirmar-senha" className="text-xs font-semibold text-gray-700">
                  Confirmar Nova Senha
                </Label>
                <Input
                  id="confirmar-senha"
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  className="mt-1"
                  disabled={savingPwd}
                />
              </div>
              {newPwd && (
                <div className="col-span-2">
                  <PasswordStrengthIndicator password={newPwd} />
                </div>
              )}
            </div>
            <SubmitButton
              type="button"
              onClick={handleChangePassword}
              submitting={savingPwd}
              submittingText="Atualizando senha..."
              disabled={!currentPwd || !newPwd || !confirmPwd}
              icon={<Save className="w-4 h-4" aria-hidden="true" />}
              aria-label="Salvar nova senha"
            >
              Salvar Senha
            </SubmitButton>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
