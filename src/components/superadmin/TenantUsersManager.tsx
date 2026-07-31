import { useState, useEffect, useCallback } from 'react'
import { UserPlus, Pencil, Trash2, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { getUsersByTenant } from '@/services/users'
import type { GlobalUser } from '@/types/superadmin'
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
  const [users, setUsers] = useState<GlobalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<GlobalUser | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<GlobalUser | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const loadUsers = useCallback(async () => {
    if (!user?.tenantId) {
      setLoading(false)
      return
    }
    try {
      const data = await getUsersByTenant(user.tenantId)
      const filtered = user?.role === 'admin' ? data.filter((u) => u.role !== 'superadmin') : data
      setUsers(filtered)
    } catch {
      /* ignore */
    }
    setLoading(false)
  }, [user?.tenantId])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useRealtime('users', () => {
    loadUsers()
  })

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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#1c2a3e] flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#1c2a3e]">Gestão de Usuários</h2>
            <p className="text-sm text-gray-500">
              Usuários do município: {user?.prefeitura || '—'}
            </p>
          </div>
        </div>
        <Button className="bg-[#3b82f6] text-white gap-2" onClick={() => setCreateOpen(true)}>
          <UserPlus className="w-4 h-4" /> Criar Usuário
        </Button>
      </div>

      <Card className="bg-white border-0 shadow-subtle">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs font-semibold text-[#1c2a3e]">Nome</TableHead>
                <TableHead className="text-xs font-semibold text-[#1c2a3e]">Email</TableHead>
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
              {users.map((u) => (
                <TableRow key={u.id} className="hover:bg-slate-50/50">
                  <TableCell className="text-sm font-medium text-[#1c2a3e]">
                    {u.name || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{u.email || '—'}</TableCell>
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
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => handleDelete(u)}
                        disabled={u.id === user?.id}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400">{users.length} usuário(s) encontrado(s).</p>

      <TenantUserCreateModal open={createOpen} onOpenChange={setCreateOpen} onCreated={loadUsers} />
      <TenantUserEditModal
        user={editTarget}
        open={editOpen}
        onOpenChange={handleEditClose}
        onSaved={loadUsers}
      />
      <TenantUserDeleteDialog
        user={deleteTarget}
        open={deleteOpen}
        onOpenChange={handleDeleteClose}
        onDeleted={loadUsers}
      />
    </div>
  )
}
