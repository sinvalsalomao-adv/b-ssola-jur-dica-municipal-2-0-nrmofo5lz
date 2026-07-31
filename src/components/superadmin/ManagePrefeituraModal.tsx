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
import { Building2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useSuperadmin } from '@/context/SuperadminContext'
import { Prefeitura } from '@/types/superadmin'
import { LogoUploadDialog } from '@/components/LogoUploadDialog'
import pb from '@/lib/pocketbase/client'

interface Props {
  prefeitura: Prefeitura
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getLogoUrl(pref: Prefeitura): string | null {
  if (!pref.logo) return null
  const base = pb.baseUrl.replace(/\/$/, '')
  return `${base}/api/files/tenants/${pref.id}/${pref.logo}`
}

export const ManagePrefeituraModal: React.FC<Props> = ({ prefeitura, open, onOpenChange }) => {
  const { updatePrefeitura, togglePrefeituraStatus, globalUsers, updateUser } = useSuperadmin()
  const [adminName, setAdminName] = useState(prefeitura.adminName)
  const [cidade, setCidade] = useState(prefeitura.cidade)
  const [estado, setEstado] = useState(prefeitura.estado)
  const [logoDialogOpen, setLogoDialogOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(getLogoUrl(prefeitura))

  useEffect(() => {
    if (open) {
      setLogoUrl(getLogoUrl(prefeitura))
      setAdminName(prefeitura.adminName)
      setCidade(prefeitura.cidade)
      setEstado(prefeitura.estado)
    }
  }, [open, prefeitura])

  const adminUser = globalUsers.find(
    (u: any) => u.prefeituraSlug === prefeitura.slug && u.role === 'admin',
  )

  const handleSave = () => {
    updatePrefeitura(prefeitura.id, {
      adminName: adminName.trim(),
      cidade: cidade.trim(),
      estado: estado.trim(),
    })
    if (adminUser && adminName.trim() !== prefeitura.adminName) {
      updateUser(adminUser.id, { name: adminName.trim() })
    }
    toast.success('Prefeitura atualizada com sucesso!')
    onOpenChange(false)
  }

  return (
    <>
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
              <Label className="text-xs font-semibold text-gray-700">Brasão (Logo)</Label>
              <div className="mt-1 flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden bg-slate-50">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Brasão" className="w-full h-full object-contain" />
                  ) : (
                    <Building2 className="w-6 h-6 text-gray-300" />
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setLogoDialogOpen(true)}>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  {logoUrl ? 'Trocar' : 'Enviar'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Cidade</Label>
                <Input
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className="mt-1"
                  placeholder="Cidade"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Estado</Label>
                <Input
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="mt-1"
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
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
      <LogoUploadDialog
        tenantId={prefeitura.id}
        currentLogo={logoUrl}
        open={logoDialogOpen}
        onOpenChange={setLogoDialogOpen}
        onLogoUpdated={(url) => setLogoUrl(url)}
      />
    </>
  )
}
