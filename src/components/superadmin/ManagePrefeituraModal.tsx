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
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { useSuperadmin } from '@/context/SuperadminContext'
import { Prefeitura } from '@/types/superadmin'

interface Props {
  prefeitura: Prefeitura
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ManagePrefeituraModal: React.FC<Props> = ({ prefeitura, open, onOpenChange }) => {
  const { updatePrefeitura, togglePrefeituraStatus, globalUsers, updateUser } = useSuperadmin()
  const [logo, setLogo] = useState<string | null>(prefeitura.logo)
  const [adminName, setAdminName] = useState(prefeitura.adminName)

  useEffect(() => {
    if (open) {
      setLogo(prefeitura.logo)
      setAdminName(prefeitura.adminName)
    }
  }, [open, prefeitura])

  const adminUser = globalUsers.find(
    (u) => u.prefeituraSlug === prefeitura.slug && u.role === 'admin',
  )

  const handleSave = () => {
    updatePrefeitura(prefeitura.id, { logo, adminName: adminName.trim() })
    if (adminUser && adminName.trim() !== prefeitura.adminName) {
      updateUser(adminUser.id, { name: adminName.trim() })
    }
    toast.success('Prefeitura atualizada com sucesso!')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-white rounded-xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#1c2a3e]">
            Gerenciar Prefeitura
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
            <div>
              <p className="text-sm font-bold text-[#1c2a3e]">{prefeitura.name}</p>
              <p className="text-xs text-gray-500 font-mono">{prefeitura.slug}</p>
            </div>
            <Badge
              className={
                prefeitura.status === 'ativa'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-400 text-white'
              }
            >
              {prefeitura.status === 'ativa' ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-gray-700">Status da Prefeitura</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {prefeitura.status === 'ativa' ? 'Ativa' : 'Inativa'}
              </span>
              <Switch
                checked={prefeitura.status === 'ativa'}
                onCheckedChange={() => togglePrefeituraStatus(prefeitura.id)}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-700">CNPJ</Label>
            <Input value={prefeitura.cnpj} disabled className="mt-1 bg-slate-50 text-gray-500" />
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-700">Logo (imagem)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setLogo(f.name)
              }}
              className="mt-1 cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-[#1c2a3e] file:text-white file:text-xs"
            />
            {logo && <p className="text-[10px] text-gray-400 mt-1">Arquivo: {logo}</p>}
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-700">Nome do Administrador</Label>
            <Input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="mt-1"
            />
            {adminUser && (
              <p className="text-[10px] text-gray-400 mt-1">Email: {adminUser.email}</p>
            )}
          </div>
        </div>
        <DialogFooter className="pt-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white" onClick={handleSave}>
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
