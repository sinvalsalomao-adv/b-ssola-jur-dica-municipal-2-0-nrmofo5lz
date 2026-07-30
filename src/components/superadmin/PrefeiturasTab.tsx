import React, { useState } from 'react'
import { Plus, Settings2, Building } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { useSuperadmin } from '@/context/SuperadminContext'
import { NewPrefeituraModal } from '@/components/superadmin/NewPrefeituraModal'
import { ManagePrefeituraModal } from '@/components/superadmin/ManagePrefeituraModal'
import { Prefeitura } from '@/types/superadmin'

export const PrefeiturasTab: React.FC = () => {
  const { prefeituras, globalUsers } = useSuperadmin()
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [manageTarget, setManageTarget] = useState<Prefeitura | null>(null)

  const getActiveUserCount = (slug: string) =>
    globalUsers.filter((u) => u.prefeituraSlug === slug && u.status === 'ativo').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-[#1c2a3e]">Prefeituras Cadastradas</h3>
          <p className="text-xs text-gray-500">
            Gerencie todas as prefeituras (tenants) da plataforma.
          </p>
        </div>
        <Button
          className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2"
          onClick={() => setNewModalOpen(true)}
        >
          <Plus className="w-4 h-4" /> Nova Prefeitura
        </Button>
      </div>

      <div className="rounded-lg border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="font-semibold text-[#1c2a3e]">Nome da Prefeitura</TableHead>
              <TableHead className="font-semibold text-[#1c2a3e]">CNPJ</TableHead>
              <TableHead className="font-semibold text-[#1c2a3e]">Slug do Subdomínio</TableHead>
              <TableHead className="font-semibold text-[#1c2a3e] text-center">
                Usuários Ativos
              </TableHead>
              <TableHead className="font-semibold text-[#1c2a3e] text-center">Status</TableHead>
              <TableHead className="font-semibold text-[#1c2a3e] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prefeituras.map((pref) => (
              <TableRow key={pref.id} className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-[#1c2a3e]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#1c2a3e] flex items-center justify-center shrink-0">
                      <Building className="w-4 h-4 text-white" />
                    </div>
                    {pref.name}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-gray-600">{pref.cnpj}</TableCell>
                <TableCell className="text-sm text-gray-600 font-mono">{pref.slug}</TableCell>
                <TableCell className="text-center text-sm font-semibold text-[#1c2a3e]">
                  {getActiveUserCount(pref.slug)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    className={
                      pref.status === 'ativa'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-400 text-white'
                    }
                  >
                    {pref.status === 'ativa' ? 'Ativa' : 'Inativa'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setManageTarget(pref)}
                  >
                    <Settings2 className="w-3.5 h-3.5" /> Gerenciar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NewPrefeituraModal open={newModalOpen} onOpenChange={setNewModalOpen} />
      {manageTarget && (
        <ManagePrefeituraModal
          prefeitura={manageTarget}
          open={!!manageTarget}
          onOpenChange={(v) => !v && setManageTarget(null)}
        />
      )}
    </div>
  )
}
