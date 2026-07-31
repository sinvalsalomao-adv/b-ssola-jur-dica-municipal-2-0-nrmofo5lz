import React, { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { UserPlus, Search, X, Pencil, Trash2 } from 'lucide-react'
import { CreateUserModal } from '@/components/superadmin/CreateUserModal'
import { EditUserModal } from '@/components/superadmin/EditUserModal'
import { DeleteUserDialog } from '@/components/superadmin/DeleteUserDialog'
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
import { toast } from 'sonner'
import { useSuperadmin } from '@/context/SuperadminContext'
import { UserRole, GlobalUser } from '@/types/superadmin'

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  servidor: 'Servidor',
  gestor: 'Gestor',
  secretario: 'Secretário',
  procurador: 'Procurador',
}

const ROLE_COLORS: Record<UserRole, string> = {
  superadmin: 'bg-purple-500 text-white',
  admin: 'bg-blue-500 text-white',
  servidor: 'bg-slate-400 text-white',
  gestor: 'bg-green-500 text-white',
  secretario: 'bg-orange-500 text-white',
  procurador: 'bg-cyan-500 text-white',
}

function formatDate(iso: string): string {
  if (!iso || iso === '—') return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return (
    d.toLocaleDateString('pt-BR') +
    ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
}

export const GlobalUsersTab: React.FC = () => {
  const { globalUsers, prefeituras, toggleUserStatus, fetchUsers } = useSuperadmin()
  const [filterPref, setFilterPref] = useState('all')
  const [filterRole, setFilterRole] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<GlobalUser | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteUser, setDeleteUser] = useState<GlobalUser | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const filtered = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase().trim()
    return globalUsers.filter((u) => {
      if (filterPref !== 'all' && u.prefeituraSlug !== filterPref) return false
      if (filterRole !== 'all' && u.role !== filterRole) return false
      if (
        lowerQuery &&
        !u.name.toLowerCase().includes(lowerQuery) &&
        !u.email.toLowerCase().includes(lowerQuery)
      )
        return false
      return true
    })
  }, [globalUsers, filterPref, filterRole, searchQuery])

  const handleRowClick = (user: GlobalUser) => {
    setEditUser(user)
    setEditModalOpen(true)
  }

  const handleEditModalChange = (open: boolean) => {
    setEditModalOpen(open)
    if (!open) setEditUser(null)
  }

  const handleDeleteClick = (e: React.MouseEvent, user: GlobalUser) => {
    e.stopPropagation()
    setDeleteUser(user)
    setDeleteDialogOpen(true)
  }

  const handleDeleteDialogChange = (open: boolean) => {
    setDeleteDialogOpen(open)
    if (!open) setDeleteUser(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteUser) return
    try {
      const pb = (await import('@/lib/pocketbase/client')).default
      await pb.collection('users').delete(deleteUser.id)
      await fetchUsers()
      toast.success('Usuário excluído com sucesso!')
      handleDeleteDialogChange(false)
    } catch (err: any) {
      const msg = err?.response?.message || err?.message || 'Erro ao excluir usuário.'
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-[#1c2a3e]">Usuários Globais</h3>
          <p className="text-xs text-gray-500">
            Todos os usuários cadastrados em todas as prefeituras.
          </p>
        </div>
        <Button
          className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
          onClick={() => setCreateModalOpen(true)}
        >
          <UserPlus className="w-4 h-4 mr-1.5" />
          <span>Criar Usuário</span>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar usuário por nome ou e-mail"
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Select value={filterPref} onValueChange={setFilterPref}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Prefeitura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Prefeituras</SelectItem>
            {prefeituras.map((p) => (
              <SelectItem key={p.id || p.slug} value={p.slug}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Perfis</SelectItem>
            <SelectItem value="superadmin">Superadmin</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="servidor">Servidor</SelectItem>
            <SelectItem value="gestor">Gestor</SelectItem>
            <SelectItem value="secretario">Secretário</SelectItem>
            <SelectItem value="procurador">Procurador</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="font-semibold text-[#1c2a3e]">Nome</TableHead>
              <TableHead className="font-semibold text-[#1c2a3e]">Email</TableHead>
              <TableHead className="font-semibold text-[#1c2a3e]">Prefeitura</TableHead>
              <TableHead className="font-semibold text-[#1c2a3e]">Perfil</TableHead>
              <TableHead className="font-semibold text-[#1c2a3e] text-center">Status</TableHead>
              <TableHead className="font-semibold text-[#1c2a3e]">Último Acesso</TableHead>
              <TableHead className="font-semibold text-[#1c2a3e] text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500 text-sm">
                  <span>Nenhum usuário encontrado.</span>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                return (
                  <TableRow
                    key={u.id}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(u)}
                  >
                    <TableCell className="font-medium text-[#1c2a3e] text-sm">
                      <span>{u.name || '—'}</span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <span>{u.email || '—'}</span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <span>{u.prefeituraName || '—'}</span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Badge className={ROLE_COLORS[u.role] || 'bg-slate-400 text-white'}>
                        {ROLE_LABELS[u.role] || u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xs text-gray-500">
                          {u.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                        <Switch
                          checked={u.status === 'ativo'}
                          onCheckedChange={() => toggleUserStatus(u.id)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      <span>{formatDate(u.lastAccess)}</span>
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-[#3b82f6] hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRowClick(u)
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                          onClick={(e) => handleDeleteClick(e, u)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-gray-400">
        <span>{filtered.length} usuário(s) encontrado(s).</span>
      </p>
      <CreateUserModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
      <EditUserModal user={editUser} open={editModalOpen} onOpenChange={handleEditModalChange} />
      <DeleteUserDialog
        user={deleteUser}
        open={deleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
