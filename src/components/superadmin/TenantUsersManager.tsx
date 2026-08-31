import { useState, useEffect, useCallback } from 'react'
import {
  UserPlus,
  Pencil,
  Trash2,
  Loader2,
  Users,
  UserCheck,
  Check,
  X,
  Clock,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { getUsersByTenant } from '@/services/users'
import {
  getPendingMemberships,
  approveMembership,
  rejectMembership,
  type UserMembership,
} from '@/services/memberships'
import type { GlobalUser, UserRole } from '@/types/superadmin'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'
import { TenantUserCreateModal } from '@/components/superadmin/TenantUserCreateModal'
import { TenantUserEditModal } from '@/components/superadmin/TenantUserEditModal'
import { TenantUserDeleteDialog } from '@/components/superadmin/TenantUserDeleteDialog'

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-blue-500 text-white',
  servidor: 'bg-slate-400 text-white',
  gestor: 'bg-green-500 text-white',
  secretario: 'bg-orange-500 text-white',
  procurador: 'bg-cyan-500 text-white',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  servidor: 'Servidor',
  gestor: 'Gestor',
  secretario: 'Secretário',
  procurador: 'Procurador',
}

export function TenantUsersManager() {
  const { user } = useAuth()
  const isSuperadmin = user?.role === 'superadmin'
  const [activeTab, setActiveTab] = useState<'users' | 'pending'>('users')
  const [users, setUsers] = useState<GlobalUser[]>([])
  const [pendingMemberships, setPendingMemberships] = useState<UserMembership[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPending, setLoadingPending] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<GlobalUser | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<GlobalUser | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Superadmin: seletor de prefeituras
  const [tenantsList, setTenantsList] = useState<{ id: string; name: string }[]>([])
  const [selectedSuperadminTenant, setSelectedSuperadminTenant] = useState<string>('all')
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null)

  // Carregar lista de prefeituras se for superadmin
  useEffect(() => {
    if (isSuperadmin) {
      pb.collection('tenants')
        .getFullList({ filter: 'status = "ativa"', sort: 'name' })
        .then((records) => {
          setTenantsList(records.map((r: any) => ({ id: r.id, name: r.name })))
        })
        .catch(() => {})
    }
  }, [isSuperadmin])

  const targetTenantId = isSuperadmin
    ? selectedSuperadminTenant === 'all'
      ? undefined
      : selectedSuperadminTenant
    : user?.tenantId || undefined

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      if (isSuperadmin && (!targetTenantId || selectedSuperadminTenant === 'all')) {
        // Superadmin vendo todos os usuários pelo endpoint seguro
        const data = await getUsersByTenant('')
        setUsers(data)
      } else if (targetTenantId) {
        const data = await getUsersByTenant(targetTenantId)
        const filtered = user?.role === 'admin' ? data.filter((u) => u.role !== 'superadmin') : data
        setUsers(filtered)
      } else {
        setUsers([])
      }
    } catch {
      /* ignore */
    }
    setLoading(false)
  }, [isSuperadmin, targetTenantId, selectedSuperadminTenant, user?.role])

  const loadPending = useCallback(async () => {
    setLoadingPending(true)
    try {
      const data = await getPendingMemberships(targetTenantId)
      setPendingMemberships(data)
    } catch {
      /* ignore */
    }
    setLoadingPending(false)
  }, [targetTenantId])

  useEffect(() => {
    loadUsers()
    loadPending()
  }, [loadUsers, loadPending])

  useRealtime('users', () => {
    loadUsers()
  })
  useRealtime('user_memberships', () => {
    loadPending()
    loadUsers()
  })

  const handleApprove = async (membership: UserMembership, newRole?: UserRole) => {
    setActionInProgressId(membership.id)
    try {
      const effectiveTenant = membership.tenantId || targetTenantId || user?.tenantId || ''
      await approveMembership(membership.id, effectiveTenant, newRole)
      toast.success(`Cadastro de ${membership.userName} aprovado com sucesso!`)
      await Promise.all([loadPending(), loadUsers()])
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao aprovar cadastro.')
    } finally {
      setActionInProgressId(null)
    }
  }

  const handleReject = async (membership: UserMembership) => {
    setActionInProgressId(membership.id)
    try {
      const effectiveTenant = membership.tenantId || targetTenantId || user?.tenantId || ''
      await rejectMembership(membership.id, effectiveTenant)
      toast.success(`Solicitação de ${membership.userName} rejeitada.`)
      await Promise.all([loadPending(), loadUsers()])
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao rejeitar solicitação.')
    } finally {
      setActionInProgressId(null)
    }
  }

  const handleEdit = (u: GlobalUser) => {
    setEditTarget(u)
    setEditOpen(true)
  }
  const handleEditClose = (open: boolean) => {
    setEditOpen(open)
    if (!open) setEditTarget(null)
  }
  const handleDelete = (u: GlobalUser) => {
    setDeleteTarget(u)
    setDeleteOpen(true)
  }
  const handleDeleteClose = (open: boolean) => {
    setDeleteOpen(open)
    if (!open) setDeleteTarget(null)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#1c2a3e] flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#1c2a3e]">Gestão de Usuários</h2>
            <p className="text-sm text-gray-500">
              {isSuperadmin
                ? 'Gestão de usuários municipais e aprovações de acesso (Visão Superadmin)'
                : `Município: ${user?.prefeitura || '—'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isSuperadmin && (
            <div className="w-52">
              <Select
                value={selectedSuperadminTenant}
                onValueChange={(val) => setSelectedSuperadminTenant(val)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <Building2 className="w-3.5 h-3.5 mr-1 text-gray-500" />
                  <SelectValue placeholder="Filtrar município..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os municípios</SelectItem>
                  {tenantsList.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button className="bg-[#3b82f6] text-white gap-2 h-9" onClick={() => setCreateOpen(true)}>
            <UserPlus className="w-4 h-4" /> Criar Usuário
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'users' | 'pending')}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            <span>Usuários Ativos ({users.length})</span>
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2 relative">
            <UserCheck className="w-4 h-4" />
            <span>Aprovações Pendentes</span>
            {pendingMemberships.length > 0 && (
              <Badge className="ml-1.5 bg-amber-500 text-white hover:bg-amber-600 px-1.5 py-0 text-[10px] rounded-full">
                {pendingMemberships.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: Usuários Ativos / Cadastrados */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <Card className="bg-white border-0 shadow-subtle">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs font-semibold text-[#1c2a3e]">Nome</TableHead>
                    <TableHead className="text-xs font-semibold text-[#1c2a3e]">Email</TableHead>
                    {isSuperadmin && (
                      <TableHead className="text-xs font-semibold text-[#1c2a3e]">
                        Município
                      </TableHead>
                    )}
                    <TableHead className="text-xs font-semibold text-[#1c2a3e]">Papel</TableHead>
                    <TableHead className="text-xs font-semibold text-[#1c2a3e] text-center">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-[#1c2a3e] text-center">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={isSuperadmin ? 6 : 5}
                        className="text-center py-8 text-gray-500 text-sm"
                      >
                        Nenhum usuário encontrado no município selecionado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-sm font-medium text-[#1c2a3e]">
                          {u.name || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{u.email || '—'}</TableCell>
                        {isSuperadmin && (
                          <TableCell className="text-xs text-gray-600 font-medium">
                            {u.prefeituraName || '—'}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge className={ROLE_COLORS[u.role] || 'bg-slate-400 text-white'}>
                            {ROLE_LABELS[u.role] || u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={
                              u.status === 'ativo'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-gray-400 text-white'
                            }
                          >
                            {u.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-[#3b82f6] hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed"
                              onClick={() => handleEdit(u)}
                              disabled={u.id === user?.id}
                              title="Editar Usuário"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                              onClick={() => handleDelete(u)}
                              disabled={u.id === user?.id}
                              title="Excluir Usuário"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-gray-400">{users.length} usuário(s) listado(s).</p>
        </TabsContent>

        {/* ABA 2: Aprovações Pendentes */}
        <TabsContent value="pending" className="space-y-4 mt-4">
          <Card className="bg-white border-0 shadow-subtle">
            <CardContent className="p-0">
              {loadingPending ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-semibold text-[#1c2a3e]">
                        Solicitante
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-[#1c2a3e]">Email</TableHead>
                      {isSuperadmin && (
                        <TableHead className="text-xs font-semibold text-[#1c2a3e]">
                          Município
                        </TableHead>
                      )}
                      <TableHead className="text-xs font-semibold text-[#1c2a3e]">
                        Papel Solicitado
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-[#1c2a3e]">
                        Data Solicitação
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-[#1c2a3e] text-center">
                        Ações de Aprovação
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingMemberships.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={isSuperadmin ? 6 : 5}
                          className="text-center py-10 text-gray-500"
                        >
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Clock className="w-8 h-8 text-gray-300" />
                            <p className="text-sm font-medium">
                              Nenhum cadastro pendente de aprovação
                            </p>
                            <p className="text-xs text-gray-400 max-w-sm text-center">
                              Quando um servidor ou cidadão se cadastrar na página pública{' '}
                              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded text-blue-600">
                                /cadastro/:slug
                              </code>
                              , a solicitação aparecerá aqui para liberação.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingMemberships.map((m) => (
                        <TableRow key={m.id} className="hover:bg-slate-50/50">
                          <TableCell className="text-sm font-medium text-[#1c2a3e]">
                            {m.userName}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {m.userEmail || '—'}
                          </TableCell>
                          {isSuperadmin && (
                            <TableCell className="text-xs text-gray-700 font-medium">
                              {m.tenantName || '—'}
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge className={ROLE_COLORS[m.role] || 'bg-slate-400 text-white'}>
                              {ROLE_LABELS[m.role] || m.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {m.created ? new Date(m.created).toLocaleDateString('pt-BR') : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs px-2.5"
                                disabled={actionInProgressId === m.id}
                                onClick={() => handleApprove(m)}
                              >
                                {actionInProgressId === m.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 gap-1 text-xs px-2.5"
                                disabled={actionInProgressId === m.id}
                                onClick={() => handleReject(m)}
                              >
                                <X className="w-3.5 h-3.5" />
                                Rejeitar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-gray-400">
            {pendingMemberships.length} solicitação(ões) pendente(s).
          </p>
        </TabsContent>
      </Tabs>

      <TenantUserCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          loadUsers()
          loadPending()
        }}
        defaultTenantId={targetTenantId}
      />
      <TenantUserEditModal
        user={editTarget}
        tenantId={targetTenantId}
        open={editOpen}
        onOpenChange={handleEditClose}
        onSaved={loadUsers}
      />
      <TenantUserDeleteDialog
        user={deleteTarget}
        tenantId={targetTenantId}
        open={deleteOpen}
        onOpenChange={handleDeleteClose}
        onDeleted={loadUsers}
      />
    </div>
  )
}
