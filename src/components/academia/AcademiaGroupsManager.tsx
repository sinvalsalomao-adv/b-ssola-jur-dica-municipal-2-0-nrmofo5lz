import React, { useState, useEffect, useTransition } from 'react'
import {
  GraduationCap,
  Building2,
  Users,
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Search,
  BadgeCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/context/AuthContext'
import { useSuperadmin } from '@/context/SuperadminContext'
import {
  getSecretariasByTenant,
  createSecretaria,
  updateSecretaria,
  deleteSecretaria,
  getEducationGroupsByTenant,
  createEducationGroup,
  updateEducationGroup,
  deleteEducationGroup,
  getGroupMembers,
  getUserGroupMemberships,
  addMemberToGroup,
  removeMemberFromGroup,
} from '@/services/academia'
import { getUsersByTenant } from '@/services/users'
import { sanitizeError } from '@/lib/errorSanitizer'
import { toast } from 'sonner'
import type {
  SecretariaRecord,
  EducationGroupRecord,
  EducationGroupMemberRecord,
} from '@/types/academia'
import type { GlobalUser } from '@/types/superadmin'

const AVAILABLE_ROLES = [
  { value: 'servidor', label: 'Servidor Geral' },
  { value: 'gestor', label: 'Gestor Municipal' },
  { value: 'secretario', label: 'Secretário / Diretor' },
  { value: 'procurador', label: 'Procurador Jurídico' },
  { value: 'admin', label: 'Administrador' },
]

export default function AcademiaGroupsManager() {
  const { user } = useAuth()
  const { prefeituras } = useSuperadmin()
  const isSuperadmin = user?.role === 'superadmin'
  const isAdmin = user?.role === 'admin'
  const isManager = isSuperadmin || isAdmin

  // Tenant ativo
  const [selectedTenantId, setSelectedTenantId] = useState<string>(user?.tenantId || '')
  const [, startTransition] = useTransition()

  // Estados de dados
  const [secretarias, setSecretarias] = useState<SecretariaRecord[]>([])
  const [groups, setGroups] = useState<EducationGroupRecord[]>([])
  const [userMemberships, setUserMemberships] = useState<EducationGroupMemberRecord[]>([])
  const [tenantUsers, setTenantUsers] = useState<GlobalUser[]>([])

  // Estados de carregamento e erro
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Gerenciamento de Grupo selecionado para Membros
  const [selectedGroup, setSelectedGroup] = useState<EducationGroupRecord | null>(null)
  const [groupMembers, setGroupMembers] = useState<EducationGroupMemberRecord[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  // Modais de Secretaria
  const [secModalOpen, setSecModalOpen] = useState(false)
  const [editingSec, setEditingSec] = useState<SecretariaRecord | null>(null)
  const [secForm, setSecForm] = useState({
    nome: '',
    sigla: '',
    descricao: '',
    status: 'ativo' as 'ativo' | 'inativo',
  })
  const [secToDelete, setSecToDelete] = useState<SecretariaRecord | null>(null)

  // Modais de Grupo Educacional
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<EducationGroupRecord | null>(null)
  const [groupForm, setGroupForm] = useState({
    nome: '',
    descricao: '',
    secretaria: '',
    cargos_alvo: [] as string[],
    status: 'ativo' as 'ativo' | 'inativo',
  })
  const [groupToDelete, setGroupToDelete] = useState<EducationGroupRecord | null>(null)

  // Modais de Associação de Membro
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false)
  const [selectedUserIdToAdd, setSelectedUserIdToAdd] = useState('')
  const [memberToRemove, setMemberToRemove] = useState<EducationGroupMemberRecord | null>(null)

  // Busca e Filtros
  const [searchFilter, setSearchFilter] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Sincronizar tenant caso usuário mude
  useEffect(() => {
    if (user?.tenantId && (!selectedTenantId || !isSuperadmin)) {
      setSelectedTenantId(user.tenantId)
    }
  }, [user?.tenantId, isSuperadmin, selectedTenantId])

  // Carregar dados principais
  const loadData = async () => {
    setError(null)
    setLoading(true)
    try {
      if (!isManager) {
        // Usuário comum: carregar apenas os grupos aos quais pertence
        if (user?.id) {
          const myMemberships = await getUserGroupMemberships(user.id, user.tenantId || undefined)
          setUserMemberships(myMemberships)
        }
      } else {
        // Superadmin ou Admin Municipal
        if (!selectedTenantId) {
          setSecretarias([])
          setGroups([])
          setTenantUsers([])
          setLoading(false)
          return
        }

        const [secData, groupData, usersResp] = await Promise.all([
          getSecretariasByTenant(selectedTenantId),
          getEducationGroupsByTenant(selectedTenantId),
          getUsersByTenant(selectedTenantId, { status: 'ativo', perPage: 100 }).catch(() => ({
            items: [] as GlobalUser[],
            page: 1,
            perPage: 100,
            totalItems: 0,
            totalPages: 0,
          })),
        ])

        setSecretarias(secData)
        setGroups(groupData)
        const userList = Array.isArray(usersResp) ? usersResp : usersResp.items || []
        setTenantUsers(userList as unknown as GlobalUser[])
      }
    } catch (err) {
      const sanitized = sanitizeError(err)
      setError(sanitized.message || 'Erro ao carregar dados da Academia.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedTenantId, user?.id, isManager])

  // Carregar membros do grupo selecionado
  const loadGroupMembers = async (grp: EducationGroupRecord) => {
    setSelectedGroup(grp)
    setLoadingMembers(true)
    try {
      const members = await getGroupMembers(grp.id)
      setGroupMembers(members)
    } catch (err) {
      toast.error('Erro ao listar membros do grupo: ' + sanitizeError(err).message)
    } finally {
      setLoadingMembers(false)
    }
  }

  // Ações de Secretaria
  const handleOpenCreateSec = () => {
    setEditingSec(null)
    setSecForm({ nome: '', sigla: '', descricao: '', status: 'ativo' })
    setSecModalOpen(true)
  }

  const handleOpenEditSec = (sec: SecretariaRecord) => {
    setEditingSec(sec)
    setSecForm({
      nome: sec.nome,
      sigla: sec.sigla || '',
      descricao: sec.descricao || '',
      status: sec.status,
    })
    setSecModalOpen(true)
  }

  const handleSaveSecretaria = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTenantId) {
      toast.error('Selecione uma prefeitura antes de cadastrar.')
      return
    }
    if (!secForm.nome.trim()) {
      toast.error('O nome da secretaria/unidade é obrigatório.')
      return
    }

    setSubmitting(true)
    try {
      if (editingSec) {
        await updateSecretaria(editingSec.id, {
          nome: secForm.nome.trim(),
          sigla: secForm.sigla.trim(),
          descricao: secForm.descricao.trim(),
          status: secForm.status,
        })
        toast.success('Secretaria atualizada com sucesso!')
      } else {
        await createSecretaria({
          nome: secForm.nome.trim(),
          sigla: secForm.sigla.trim(),
          descricao: secForm.descricao.trim(),
          tenant: selectedTenantId,
          status: secForm.status,
        })
        toast.success('Secretaria criada com sucesso!')
      }
      setSecModalOpen(false)
      loadData()
    } catch (err) {
      toast.error(sanitizeError(err).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmDeleteSec = async () => {
    if (!secToDelete) return
    setSubmitting(true)
    try {
      await deleteSecretaria(secToDelete.id)
      toast.success('Secretaria excluída com sucesso!')
      setSecToDelete(null)
      loadData()
    } catch (err) {
      toast.error(sanitizeError(err).message)
    } finally {
      setSubmitting(false)
    }
  }

  // Ações de Grupo Educacional
  const handleOpenCreateGroup = () => {
    setEditingGroup(null)
    setGroupForm({
      nome: '',
      descricao: '',
      secretaria: '',
      cargos_alvo: [],
      status: 'ativo',
    })
    setGroupModalOpen(true)
  }

  const handleOpenEditGroup = (grp: EducationGroupRecord) => {
    setEditingGroup(grp)
    setGroupForm({
      nome: grp.nome,
      descricao: grp.descricao || '',
      secretaria: grp.secretaria || '',
      cargos_alvo: grp.cargos_alvo || [],
      status: grp.status,
    })
    setGroupModalOpen(true)
  }

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTenantId) {
      toast.error('Selecione uma prefeitura antes de cadastrar.')
      return
    }
    if (!groupForm.nome.trim()) {
      toast.error('O nome do grupo é obrigatório.')
      return
    }

    setSubmitting(true)
    try {
      if (editingGroup) {
        await updateEducationGroup(editingGroup.id, {
          nome: groupForm.nome.trim(),
          descricao: groupForm.descricao.trim(),
          secretaria: groupForm.secretaria || undefined,
          cargos_alvo: groupForm.cargos_alvo,
          status: groupForm.status,
        })
        toast.success('Grupo educacional atualizado com sucesso!')
      } else {
        await createEducationGroup({
          nome: groupForm.nome.trim(),
          descricao: groupForm.descricao.trim(),
          tenant: selectedTenantId,
          secretaria: groupForm.secretaria || undefined,
          cargos_alvo: groupForm.cargos_alvo,
          status: groupForm.status,
        })
        toast.success('Grupo educacional criado com sucesso!')
      }
      setGroupModalOpen(false)
      loadData()
    } catch (err) {
      toast.error(sanitizeError(err).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmDeleteGroup = async () => {
    if (!groupToDelete) return
    setSubmitting(true)
    try {
      await deleteEducationGroup(groupToDelete.id)
      toast.success('Grupo educacional excluído com sucesso!')
      if (selectedGroup?.id === groupToDelete.id) {
        setSelectedGroup(null)
      }
      setGroupToDelete(null)
      loadData()
    } catch (err) {
      toast.error(sanitizeError(err).message)
    } finally {
      setSubmitting(false)
    }
  }

  // Ações de Membros do Grupo
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGroup || !selectedUserIdToAdd) {
      toast.error('Selecione um usuário para associar.')
      return
    }

    setSubmitting(true)
    try {
      await addMemberToGroup({
        group: selectedGroup.id,
        user: selectedUserIdToAdd,
        tenant: selectedTenantId,
        status: 'ativo',
      })
      toast.success('Membro associado com sucesso ao grupo!')
      setAddMemberModalOpen(false)
      setSelectedUserIdToAdd('')
      loadGroupMembers(selectedGroup)
    } catch (err) {
      toast.error(sanitizeError(err).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove || !selectedGroup) return
    setSubmitting(true)
    try {
      await removeMemberFromGroup(memberToRemove.id)
      toast.success('Membro removido do grupo com sucesso!')
      setMemberToRemove(null)
      loadGroupMembers(selectedGroup)
    } catch (err) {
      toast.error(sanitizeError(err).message)
    } finally {
      setSubmitting(false)
    }
  }

  // Toggle Cargo Alvo
  const toggleCargoAlvo = (roleVal: string) => {
    setGroupForm((prev) => {
      const exists = prev.cargos_alvo.includes(roleVal)
      if (exists) {
        return { ...prev, cargos_alvo: prev.cargos_alvo.filter((r) => r !== roleVal) }
      } else {
        return { ...prev, cargos_alvo: [...prev.cargos_alvo, roleVal] }
      }
    })
  }

  // Filtros em memória
  const filteredSecretarias = secretarias.filter(
    (s) =>
      s.nome.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (s.sigla && s.sigla.toLowerCase().includes(searchFilter.toLowerCase())),
  )

  const filteredGroups = groups.filter(
    (g) =>
      g.nome.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (g.descricao && g.descricao.toLowerCase().includes(searchFilter.toLowerCase())),
  )

  // 1. VISÃO PARA USUÁRIO COMUM (SOMENTE LEITURA DOS SEUS GRUPOS)
  if (!isManager) {
    return (
      <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1c2a3e]">Bússola Academia — Meus Grupos</h2>
              <p className="text-xs text-gray-500">
                Consulte os grupos educacionais aos quais seu perfil está associado no seu
                município.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
            <p className="text-xs">Carregando seus grupos educacionais...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : userMemberships.length === 0 ? (
          <Card className="bg-white border-dashed border-2 border-gray-200">
            <CardContent className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto text-blue-500">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800">Nenhum grupo atribuído</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Você ainda não foi vinculado a nenhum grupo de acesso educacional ou secretaria pelo
                Administrador.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userMemberships.map((m) => {
              const grp = m.expand?.group
              const sec = grp?.expand?.secretaria
              return (
                <Card
                  key={m.id}
                  className="bg-white border shadow-sm hover:shadow transition-shadow"
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base font-bold text-[#1c2a3e]">
                        {grp?.nome || 'Grupo Educacional'}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className="text-emerald-700 bg-emerald-50 border-emerald-200"
                      >
                        <BadgeCheck className="w-3 h-3 mr-1" /> Ativo
                      </Badge>
                    </div>
                    {sec && (
                      <CardDescription className="text-xs flex items-center gap-1.5 text-blue-600 font-medium mt-1">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>
                          {sec.nome} {sec.sigla ? `(${sec.sigla})` : ''}
                        </span>
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-3">
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {grp?.descricao || 'Sem descrição cadastrada.'}
                    </p>
                    {grp?.cargos_alvo && grp.cargos_alvo.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {grp.cargos_alvo.map((c) => (
                          <span
                            key={c}
                            className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded capitalize"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // 2. VISÃO PARA ADMINISTRADOR / SUPERADMIN (GERENCIAMENTO COMPLETO)
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1c2a3e]">
              Bússola Academia — Controle de Acesso e Grupos
            </h2>
            <p className="text-xs text-gray-500">
              Gerencie secretarias municipais, grupos educacionais e distribuição de acesso aos
              servidores.
            </p>
          </div>
        </div>

        {/* Superadmin Tenant Selector Guard */}
        {isSuperadmin && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2 max-w-md">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="flex-1">
              <Select
                value={selectedTenantId}
                onValueChange={(val) => {
                  startTransition(() => {
                    setSelectedTenantId(val)
                  })
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-white border-amber-300">
                  <SelectValue placeholder="Selecione uma Prefeitura explicitamente *" />
                </SelectTrigger>
                <SelectContent>
                  {prefeituras.map((pref) => (
                    <SelectItem key={pref.id} value={pref.id} className="text-xs">
                      {pref.name} ({pref.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Bloqueio se superadmin não selecionou tenant */}
      {isSuperadmin && !selectedTenantId ? (
        <Card className="bg-amber-50/50 border-amber-200">
          <CardContent className="py-12 text-center space-y-3">
            <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto" />
            <h3 className="text-base font-bold text-[#1c2a3e]">
              Seleção Explícita de Município Obrigatória
            </h3>
            <p className="text-xs text-gray-600 max-w-md mx-auto">
              Como Superadministrador, selecione uma Prefeitura específica no seletor acima para
              atuar no escopo isolado daquele município.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Barra de Filtros e Ações */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar secretarias ou grupos..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>
          </div>

          {/* Abas: Grupos Educacionais & Secretarias */}
          <Tabs defaultValue="grupos" className="space-y-4">
            <TabsList className="bg-slate-100 p-1 border">
              <TabsTrigger value="grupos" className="text-xs gap-2">
                <Users className="w-3.5 h-3.5" /> Grupos Educacionais ({groups.length})
              </TabsTrigger>
              <TabsTrigger value="secretarias" className="text-xs gap-2">
                <Building2 className="w-3.5 h-3.5" /> Secretarias / Unidades ({secretarias.length})
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: GRUPOS EDUCACIONAIS */}
            <TabsContent value="grupos" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-700">
                  Grupos de Aprendizagem e Capacitação
                </h3>
                <Button
                  size="sm"
                  onClick={handleOpenCreateGroup}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Novo Grupo
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  {error}
                </div>
              ) : filteredGroups.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center text-xs text-gray-500 space-y-2">
                    <Users className="w-8 h-8 mx-auto text-gray-400" />
                    <p>Nenhum grupo educacional cadastrado para este município.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredGroups.map((grp) => {
                    const sec = grp.expand?.secretaria
                    return (
                      <Card
                        key={grp.id}
                        className="bg-white border shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <CardHeader className="p-4 pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-sm font-bold text-[#1c2a3e]">
                              {grp.nome}
                            </CardTitle>
                            <Badge
                              variant="outline"
                              className={
                                grp.status === 'ativo'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                                  : 'bg-gray-100 text-gray-500 text-[10px]'
                              }
                            >
                              {grp.status}
                            </Badge>
                          </div>
                          {sec && (
                            <CardDescription className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-1">
                              <Building2 className="w-3.5 h-3.5" /> {sec.nome}{' '}
                              {sec.sigla ? `(${sec.sigla})` : ''}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-3 flex-1 flex flex-col justify-between">
                          <div className="space-y-2">
                            <p className="text-xs text-gray-600 line-clamp-2">
                              {grp.descricao || 'Sem descrição cadastrada.'}
                            </p>
                            {grp.cargos_alvo && grp.cargos_alvo.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {grp.cargos_alvo.map((c) => (
                                  <span
                                    key={c}
                                    className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded capitalize"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadGroupMembers(grp)}
                              className="text-xs h-8 text-blue-600 border-blue-200 hover:bg-blue-50 gap-1.5"
                            >
                              <Users className="w-3.5 h-3.5" /> Membros
                            </Button>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-500 hover:text-gray-900"
                                onClick={() => handleOpenEditGroup(grp)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setGroupToDelete(grp)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* ABA 2: SECRETARIAS / UNIDADES */}
            <TabsContent value="secretarias" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-700">
                  Secretarias e Unidades Organizacionais
                </h3>
                <Button
                  size="sm"
                  onClick={handleOpenCreateSec}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Nova Secretaria
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : filteredSecretarias.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center text-xs text-gray-500 space-y-2">
                    <Building2 className="w-8 h-8 mx-auto text-gray-400" />
                    <p>Nenhuma secretaria cadastrada para este município.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSecretarias.map((sec) => (
                    <Card
                      key={sec.id}
                      className="bg-white border shadow-sm hover:shadow transition-all"
                    >
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-sm font-bold text-[#1c2a3e]">
                              {sec.nome}
                            </CardTitle>
                            {sec.sigla && (
                              <CardDescription className="text-xs font-semibold text-blue-600 mt-0.5">
                                {sec.sigla}
                              </CardDescription>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              sec.status === 'ativo'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                                : 'bg-gray-100 text-gray-500 text-[10px]'
                            }
                          >
                            {sec.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-2 space-y-3">
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {sec.descricao || 'Sem descrição cadastrada.'}
                        </p>
                        <div className="pt-2 border-t border-gray-100 flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-gray-900"
                            onClick={() => handleOpenEditSec(sec)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setSecToDelete(sec)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* PAINEL DE GESTÃO DE MEMBROS DO GRUPO SELECIONADO */}
          {selectedGroup && (
            <Card className="bg-white border shadow-md border-blue-200 mt-6 animate-fade-in">
              <CardHeader className="p-4 border-b bg-blue-50/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-[#1c2a3e] flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" /> Membros do Grupo:{' '}
                    {selectedGroup.nome}
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500">
                    Gerencie a inclusão e remoção de servidores ativos deste município neste grupo.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setAddMemberModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs h-8"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Associar Servidor
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedGroup(null)}
                    className="text-xs h-8 text-gray-500"
                  >
                    Fechar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {loadingMembers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  </div>
                ) : groupMembers.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400">
                    Nenhum servidor associado a este grupo ainda.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {groupMembers.map((gm) => {
                      const u = gm.expand?.user
                      return (
                        <div key={gm.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
                              {(u?.name || u?.email || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-900 truncate">
                                {u?.name || 'Servidor'}
                              </p>
                              <p className="text-[11px] text-gray-500 truncate">{u?.email || ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">
                              Ativo no Grupo
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setMemberToRemove(gm)}
                              title="Remover do Grupo"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* MODAIS DE SECRETARIA */}
      <Dialog open={secModalOpen} onOpenChange={setSecModalOpen}>
        <DialogContent className="sm:max-w-[440px] bg-white rounded-xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1c2a3e]">
              {editingSec ? 'Editar Secretaria' : 'Nova Secretaria / Unidade'}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Cadastre a unidade organizacional no município selecionado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSecretaria} className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Nome da Secretaria / Unidade *
              </Label>
              <Input
                placeholder="Ex: Secretaria Municipal de Educação"
                value={secForm.nome}
                onChange={(e) => setSecForm({ ...secForm, nome: e.target.value })}
                className="mt-1 text-xs"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Sigla</Label>
              <Input
                placeholder="Ex: SEMED"
                value={secForm.sigla}
                onChange={(e) => setSecForm({ ...secForm, sigla: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Descrição / Atribuições</Label>
              <Textarea
                placeholder="Resumo das atribuições desta secretaria..."
                value={secForm.descricao}
                onChange={(e) => setSecForm({ ...secForm, descricao: e.target.value })}
                className="mt-1 text-xs min-h-[70px]"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Status</Label>
              <Select
                value={secForm.status}
                onValueChange={(val: 'ativo' | 'inativo') =>
                  setSecForm({ ...secForm, status: val })
                }
              >
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo" className="text-xs">
                    Ativo
                  </SelectItem>
                  <SelectItem value="inativo" className="text-xs">
                    Inativo
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-3 border-t gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSecModalOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={submitting}
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                {editingSec ? 'Salvar Alterações' : 'Criar Secretaria'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE GRUPO EDUCACIONAL */}
      <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white rounded-xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1c2a3e]">
              {editingGroup ? 'Editar Grupo Educacional' : 'Novo Grupo Educacional'}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Configure o grupo, secretaria vinculada e cargos-alvo para a Academia.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveGroup} className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Nome do Grupo *</Label>
              <Input
                placeholder="Ex: Equipe de Licitações e Contratos"
                value={groupForm.nome}
                onChange={(e) => setGroupForm({ ...groupForm, nome: e.target.value })}
                className="mt-1 text-xs"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Secretaria / Unidade Vinculada
              </Label>
              <Select
                value={groupForm.secretaria || 'none'}
                onValueChange={(val) =>
                  setGroupForm({ ...groupForm, secretaria: val === 'none' ? '' : val })
                }
              >
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Selecione uma secretaria (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">
                    Nenhuma (Geral do Município)
                  </SelectItem>
                  {secretarias.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.nome} {s.sigla ? `(${s.sigla})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Cargos / Funções Alvo</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {AVAILABLE_ROLES.map((r) => {
                  const isChecked = groupForm.cargos_alvo.includes(r.value)
                  return (
                    <button
                      type="button"
                      key={r.value}
                      onClick={() => toggleCargoAlvo(r.value)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                        isChecked
                          ? 'bg-blue-600 text-white border-blue-600 font-medium'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {r.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Descrição</Label>
              <Textarea
                placeholder="Finalidade pedagógica e escopo do grupo..."
                value={groupForm.descricao}
                onChange={(e) => setGroupForm({ ...groupForm, descricao: e.target.value })}
                className="mt-1 text-xs min-h-[70px]"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Status</Label>
              <Select
                value={groupForm.status}
                onValueChange={(val: 'ativo' | 'inativo') =>
                  setGroupForm({ ...groupForm, status: val })
                }
              >
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo" className="text-xs">
                    Ativo
                  </SelectItem>
                  <SelectItem value="inativo" className="text-xs">
                    Inativo
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-3 border-t gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setGroupModalOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={submitting}
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                {editingGroup ? 'Salvar Alterações' : 'Criar Grupo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL ASSOCIAR MEMBRO AO GRUPO */}
      <Dialog open={addMemberModalOpen} onOpenChange={setAddMemberModalOpen}>
        <DialogContent className="sm:max-w-[420px] bg-white rounded-xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1c2a3e]">
              Associar Servidor ao Grupo
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Selecione um servidor ativo deste município para vincular ao grupo &quot;
              {selectedGroup?.nome}&quot;.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Servidor Ativo *</Label>
              <Select value={selectedUserIdToAdd} onValueChange={setSelectedUserIdToAdd}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Selecione um usuário ativo" />
                </SelectTrigger>
                <SelectContent>
                  {tenantUsers
                    .filter((u) => !groupMembers.some((gm) => gm.user === u.id))
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-3 border-t gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddMemberModalOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={submitting || !selectedUserIdToAdd}
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                Associar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG: EXCLUIR SECRETARIA */}
      <AlertDialog open={!!secToDelete} onOpenChange={(open) => !open && setSecToDelete(null)}>
        <AlertDialogContent className="bg-white rounded-xl shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-[#1c2a3e]">
              Confirmar Exclusão de Secretaria
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600">
              Deseja realmente excluir a secretaria &quot;{secToDelete?.nome}&quot;? Esta operação
              registrará auditoria imutável.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteSec}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ALERT DIALOG: EXCLUIR GRUPO */}
      <AlertDialog open={!!groupToDelete} onOpenChange={(open) => !open && setGroupToDelete(null)}>
        <AlertDialogContent className="bg-white rounded-xl shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-[#1c2a3e]">
              Confirmar Exclusão de Grupo Educacional
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600">
              Deseja realmente excluir o grupo &quot;{groupToDelete?.nome}&quot;? As associações de
              membros vinculadas serão desfeitas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteGroup}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ALERT DIALOG: REMOVER MEMBRO DO GRUPO */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent className="bg-white rounded-xl shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-[#1c2a3e]">
              Confirmar Desassociação de Membro
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600">
              Deseja remover este servidor do grupo educacional? O registro de auditoria imutável
              será gravado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemoveMember}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />} Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
