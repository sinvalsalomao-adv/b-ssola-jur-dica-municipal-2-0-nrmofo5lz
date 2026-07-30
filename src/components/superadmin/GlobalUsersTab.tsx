import React, { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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
import { useSuperadmin } from '@/context/SuperadminContext'
import { UserRole } from '@/types/superadmin'

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  servidor: 'Servidor',
}

const ROLE_COLORS: Record<UserRole, string> = {
  superadmin: 'bg-purple-500 text-white',
  admin: 'bg-blue-500 text-white',
  servidor: 'bg-slate-400 text-white',
}

function formatDate(iso: string): string {
  if (!iso || iso === '—') return '—'
  const d = new Date(iso)
  return (
    d.toLocaleDateString('pt-BR') +
    ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
}

export const GlobalUsersTab: React.FC = () => {
  const { globalUsers, prefeituras, updateUser, toggleUserStatus } = useSuperadmin()
  const [filterPref, setFilterPref] = useState('all')
  const [filterRole, setFilterRole] = useState('all')

  const filtered = useMemo(() => {
    return globalUsers.filter((u) => {
      if (filterPref !== 'all' && u.prefeituraSlug !== filterPref) return false
      if (filterRole !== 'all' && u.role !== filterRole) return false
      return true
    })
  }, [globalUsers, filterPref, filterRole])

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-[#1c2a3e]">Usuários Globais</h3>
        <p className="text-xs text-gray-500">
          Todos os usuários cadastrados across todas as prefeituras.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filterPref} onValueChange={setFilterPref}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Prefeitura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Prefeituras</SelectItem>
            {prefeituras.map((p) => (
              <SelectItem key={p.id} value={p.slug}>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id} className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-[#1c2a3e] text-sm">{u.name}</TableCell>
                <TableCell className="text-sm text-gray-600">{u.email}</TableCell>
                <TableCell className="text-sm text-gray-600">{u.prefeituraName}</TableCell>
                <TableCell>
                  {u.role === 'superadmin' ? (
                    <Badge className={ROLE_COLORS[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                  ) : (
                    <Select
                      value={u.role}
                      onValueChange={(v) => updateUser(u.id, { role: v as UserRole })}
                    >
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="servidor">Servidor</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell className="text-center">
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
                <TableCell className="text-xs text-gray-500">{formatDate(u.lastAccess)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-gray-400">{filtered.length} usuário(s) encontrado(s).</p>
    </div>
  )
}
