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
import {
  Building2,
  Upload,
  Key,
  RefreshCw,
  Ban,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSuperadmin } from '@/context/SuperadminContext'
import { Prefeitura } from '@/types/superadmin'
import { LogoUploadDialog } from '@/components/LogoUploadDialog'
import pb from '@/lib/pocketbase/client'
import {
  listBotApiKeys,
  createBotApiKey,
  revokeBotApiKey,
  type BotApiKey,
  type CreateBotKeyResponse,
} from '@/services/botKeys'
import { formatDate } from '@/lib/dateUtils'
import { getErrorMessage } from '@/lib/pocketbase/errors'

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
  const { updatePrefeitura, togglePrefeituraStatus, globalUsers, updateUser, refreshTenant } =
    useSuperadmin()
  const [adminName, setAdminName] = useState(prefeitura.adminName)
  const [cidade, setCidade] = useState(prefeitura.cidade)
  const [estado, setEstado] = useState(prefeitura.estado)
  const [hermesEnabled, setHermesEnabled] = useState(Boolean(prefeitura.hermesEnabled))
  const [hermesAllowedRoles, setHermesAllowedRoles] = useState<string[]>(
    Array.isArray(prefeitura.hermesAllowedRoles) ? prefeitura.hermesAllowedRoles : [],
  )
  const [logoDialogOpen, setLogoDialogOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(getLogoUrl(prefeitura))

  const HERMES_ROLE_OPTIONS: { id: string; label: string; desc: string }[] = [
    { id: 'prefeito', label: 'Prefeito', desc: 'Chefe do Executivo Municipal' },
    { id: 'vice-prefeito', label: 'Vice-Prefeito', desc: 'Gabinete do Vice-Prefeito' },
    { id: 'secretario', label: 'Secretário', desc: 'Secretários e Diretores de pasta' },
    { id: 'gestor', label: 'Gestor', desc: 'Gestores e fiscais de contratos' },
    { id: 'servidor', label: 'Servidor', desc: 'Servidores municipais operacionais' },
    { id: 'procurador', label: 'Procurador', desc: 'Procuradores e corpo jurídico' },
    { id: 'admin', label: 'Admin Municipal', desc: 'Administradores locais da plataforma' },
  ]

  // Gestão da chave mestra da prefeitura
  const [botKeys, setBotKeys] = useState<BotApiKey[]>([])
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<CreateBotKeyResponse | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)

  const loadBotKeys = async () => {
    if (!prefeitura.id) return
    setLoadingKeys(true)
    try {
      const data = await listBotApiKeys(prefeitura.id)
      setBotKeys(data)
    } catch {
      setBotKeys([])
    } finally {
      setLoadingKeys(false)
    }
  }

  useEffect(() => {
    if (open) {
      setLogoUrl(getLogoUrl(prefeitura))
      setAdminName(prefeitura.adminName)
      setCidade(prefeitura.cidade)
      setEstado(prefeitura.estado)
      setHermesEnabled(Boolean(prefeitura.hermesEnabled))
      setHermesAllowedRoles(
        Array.isArray(prefeitura.hermesAllowedRoles) ? prefeitura.hermesAllowedRoles : [],
      )
      setNewlyCreatedKey(null)
      loadBotKeys()
    }
  }, [open, prefeitura])

  const handleGenerateMasterKey = async () => {
    if (!prefeitura.id) return
    if (!hermesEnabled) {
      toast.error('Ative a Integração Hermes para poder emitir a chave mestra.')
      return
    }
    setGeneratingKey(true)
    try {
      const res = await createBotApiKey(prefeitura.id, `Chave Mestra Hermes - ${prefeitura.name}`)
      setNewlyCreatedKey(res)
      toast.success('Chave mestra gerada com sucesso! Guarde-a com segurança.')
      await loadBotKeys()
    } catch (err) {
      toast.error('Erro ao gerar chave mestra: ' + getErrorMessage(err))
    } finally {
      setGeneratingKey(false)
    }
  }

  const handleRevokeMasterKey = async (keyId: string) => {
    if (
      !confirm(
        'Tem certeza de que deseja revogar a chave mestra desta prefeitura? O Hermes perderá acesso imediatamente.',
      )
    ) {
      return
    }
    setRevokingKeyId(keyId)
    try {
      await revokeBotApiKey(keyId)
      toast.success('Chave mestra revogada com sucesso.')
      await loadBotKeys()
    } catch (err) {
      toast.error('Erro ao revogar chave mestra: ' + getErrorMessage(err))
    } finally {
      setRevokingKeyId(null)
    }
  }

  const handleCopySecretKey = (secret: string) => {
    navigator.clipboard.writeText(secret)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2500)
    toast.success('Chave secreta copiada!')
  }

  const activeMasterKey = botKeys.find((k) => k.status === 'ativa')

  const adminUser = globalUsers.find(
    (u: any) => u.prefeituraSlug === prefeitura.slug && u.role === 'admin',
  )

  const toggleRolePermission = (roleId: string) => {
    setHermesAllowedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId],
    )
  }

  const handleSave = () => {
    updatePrefeitura(prefeitura.id, {
      adminName: adminName.trim(),
      cidade: cidade.trim(),
      estado: estado.trim(),
      hermesEnabled,
      hermesAllowedRoles,
    } as any)
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

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="hermes-toggle" className="text-sm font-semibold text-gray-800">
                    Integração Hermes
                  </Label>
                  <p className="text-xs text-gray-500">
                    Habilita o bot Telegram/Hermes e a emissão da chave mestra desta prefeitura.
                  </p>
                </div>
                <Switch
                  id="hermes-toggle"
                  checked={hermesEnabled}
                  onCheckedChange={setHermesEnabled}
                />
              </div>

              {hermesEnabled && (
                <div className="pt-2 border-t border-slate-200/80 space-y-2">
                  <div>
                    <Label className="text-xs font-bold text-gray-800">
                      Cargos Autorizados a Usar o Hermes
                    </Label>
                    <p className="text-[11px] text-gray-500">
                      O bot aceita qualquer usuário do Telegram e o Bússola valida ao vivo se o
                      papel do vínculo ativo nesta prefeitura está liberado abaixo.
                    </p>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {HERMES_ROLE_OPTIONS.map((opt) => {
                      const isAllowed = hermesAllowedRoles.includes(opt.id)
                      return (
                        <div
                          key={opt.id}
                          className="flex items-center justify-between p-2 rounded-md bg-white border border-slate-200/70 hover:border-slate-300 transition-colors"
                        >
                          <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-gray-800 block">
                              {opt.label}
                            </span>
                            <span className="text-[10px] text-gray-500 block">{opt.desc}</span>
                          </div>
                          <Switch
                            checked={isAllowed}
                            onCheckedChange={() => toggleRolePermission(opt.id)}
                            aria-label={`Permitir ${opt.label} no Hermes`}
                          />
                        </div>
                      )
                    })}
                  </div>
                  {hermesAllowedRoles.length === 0 && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      Nenhum cargo selecionado. Usuários que chamarem o Hermes receberão resposta
                      genérica de não autorizado até que pelo menos um cargo seja liberado.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Bloco de Gestão da Chave Mestra da Prefeitura */}
            <div className="p-3.5 rounded-lg border border-indigo-100 bg-indigo-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-700" />
                  <div>
                    <h4 className="text-xs font-bold text-indigo-950">
                      Chave Mestra da Prefeitura
                    </h4>
                    <p className="text-[11px] text-indigo-800">
                      Uma chave por prefeitura. O Hermes envia X-Acting-User para aplicar permissões
                      ao vivo.
                    </p>
                  </div>
                </div>
                {hermesEnabled && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateMasterKey}
                    disabled={generatingKey}
                    className="h-7 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-100 font-medium gap-1"
                  >
                    {generatingKey ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    {activeMasterKey ? 'Gerar Nova (Revoga Atual)' : 'Gerar Chave Mestra'}
                  </Button>
                )}
              </div>

              {newlyCreatedKey && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-emerald-600" />
                      Chave Mestra Gerada (Segredo Único):
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCopySecretKey(newlyCreatedKey.raw_key)}
                      className="h-6 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                    >
                      {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedKey ? 'Copiado' : 'Copiar'}
                    </Button>
                  </div>
                  <Input
                    readOnly
                    value={newlyCreatedKey.raw_key}
                    className="font-mono text-xs bg-white text-emerald-950 border-emerald-300 select-all h-8"
                  />
                  <p className="text-[10px] text-emerald-700">
                    Copie agora! Este segredo não será exibido novamente.
                  </p>
                </div>
              )}

              {loadingKeys ? (
                <div className="py-2 text-center text-xs text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Carregando chave...
                </div>
              ) : activeMasterKey ? (
                <div className="flex items-center justify-between p-2 rounded bg-white border border-indigo-100 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-emerald-500 text-white text-[10px] h-4 px-1.5">
                        Ativa
                      </Badge>
                      <span className="font-mono font-medium text-slate-800">
                        {activeMasterKey.key_prefix}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500">
                      Criada em {formatDate(activeMasterKey.created)}
                      {activeMasterKey.last_used_at &&
                        ` • Último uso: ${formatDate(activeMasterKey.last_used_at)}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRevokeMasterKey(activeMasterKey.id)}
                    disabled={revokingKeyId === activeMasterKey.id}
                    className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  >
                    {revokingKeyId === activeMasterKey.id ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Ban className="w-3 h-3 mr-1" />
                    )}
                    Revogar
                  </Button>
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 italic">
                  Nenhuma chave mestra ativa gerada para esta prefeitura.
                </p>
              )}
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
        onLogoUpdated={(url) => {
          setLogoUrl(url)
          refreshTenant(prefeitura.id)
        }}
      />
    </>
  )
}
