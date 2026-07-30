import { useState, useEffect } from 'react'
import { Settings, Mail, Zap, Save, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { COLUMNS } from '@/types/project'
import { StallLimits, DEFAULT_STALL_LIMITS, DEFAULT_PROXIMITY_DAYS } from '@/types/controle'
import { useAuth } from '@/context/AuthContext'
import {
  getTenantSettings,
  saveTenantSettings,
  createTenantSettings,
  getPlatformSettings,
  parseStallLimits,
  parseSmtpConfig,
} from '@/services/settings'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { toast } from 'sonner'

export default function ConfiguracoesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const [loading, setLoading] = useState(true)
  const [savingLimits, setSavingLimits] = useState(false)
  const [savingSmtp, setSavingSmtp] = useState(false)
  const [limits, setLimits] = useState<StallLimits>(DEFAULT_STALL_LIMITS)
  const [proximityDays, setProximityDays] = useState(DEFAULT_PROXIMITY_DAYS)
  const [smtp, setSmtp] = useState({
    server: '',
    port: '',
    username: '',
    password: '',
    senderEmail: '',
    senderName: '',
  })
  const [settingsId, setSettingsId] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false)
      return
    }
    ;(async () => {
      try {
        const ts = await getTenantSettings(user.tenantId!)
        if (ts) {
          setSettingsId(ts.id)
          setLimits(parseStallLimits(ts.stall_limits))
          const parsed = parseSmtpConfig(ts.smtp_config)
          setSmtp({ ...parsed, senderName: parsed.senderName || '' })
          if (ts.proximity_days && ts.proximity_days > 0) setProximityDays(ts.proximity_days)
        } else {
          const ps = await getPlatformSettings()
          if (ps) {
            setLimits(parseStallLimits(ps.stall_limits))
            if (ps.proximity_days && ps.proximity_days > 0) setProximityDays(ps.proximity_days)
          }
        }
      } catch {
        // ignore
      }
      setLoading(false)
    })()
  }, [user?.tenantId])

  const handleSaveLimits = async () => {
    if (!user?.tenantId) return
    setSavingLimits(true)
    try {
      const data = {
        tenant: user.tenantId,
        stall_limits: JSON.stringify(limits),
        proximity_days: proximityDays,
      }
      if (settingsId) {
        await saveTenantSettings(settingsId, data)
      } else {
        const created = await createTenantSettings(data)
        setSettingsId(created.id)
      }
      toast.success('Limites de gargalo salvos com sucesso!')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingLimits(false)
    }
  }

  const handleSaveSmtp = async () => {
    if (!user?.tenantId) return
    setSavingSmtp(true)
    try {
      const data = {
        tenant: user.tenantId,
        smtp_config: JSON.stringify(smtp),
      }
      if (settingsId) {
        await saveTenantSettings(settingsId, data)
      } else {
        const created = await createTenantSettings(data)
        setSettingsId(created.id)
      }
      toast.success('Configurações de e-mail salvas com sucesso!')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingSmtp(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2 animate-fade-in">
        <Settings className="w-10 h-10 text-gray-300" />
        <p className="text-sm text-gray-500">Você não tem permissão para acessar esta página.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-[#1c2a3e]">Configurações do Tenant</h2>
        <p className="text-sm text-gray-500">
          Ajuste limites de gargalo e configurações de e-mail para a sua prefeitura.
        </p>
      </div>

      <Card className="bg-white border-0 shadow-subtle">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Zap className="w-4 h-4 text-[#3b82f6]" />
            <h3 className="text-sm font-bold text-[#1c2a3e]">Limites de Gargalo (Kanban)</h3>
          </div>
          <p className="text-xs text-gray-500">
            Dias máximos que um card pode ficar parado em cada coluna antes de gerar alerta.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COLUMNS.map((col) => (
              <div key={col} className="flex items-center justify-between gap-3">
                <Label className="text-xs text-gray-700 flex-1">{col}</Label>
                <Input
                  type="number"
                  min={1}
                  value={limits[col]}
                  onChange={(e) =>
                    setLimits({ ...limits, [col]: Math.max(1, Number(e.target.value)) })
                  }
                  className="w-20 h-8 text-center"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
            <Label className="text-xs text-gray-700 flex-1 font-semibold">
              Proximidade de Prazo (dias)
            </Label>
            <Input
              type="number"
              min={1}
              value={proximityDays}
              onChange={(e) => setProximityDays(Math.max(1, Number(e.target.value)))}
              className="w-20 h-8 text-center"
            />
          </div>
          <Button
            onClick={handleSaveLimits}
            disabled={savingLimits}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2"
          >
            {savingLimits ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar Limites
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-white border-0 shadow-subtle">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Mail className="w-4 h-4 text-[#3b82f6]" />
            <h3 className="text-sm font-bold text-[#1c2a3e]">Configuração de E-mail (SMTP)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Servidor SMTP</Label>
              <Input
                value={smtp.server}
                onChange={(e) => setSmtp({ ...smtp, server: e.target.value })}
                className="mt-1"
                placeholder="smtp.exemplo.com"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Porta</Label>
              <Input
                value={smtp.port}
                onChange={(e) => setSmtp({ ...smtp, port: e.target.value })}
                className="mt-1"
                placeholder="587"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Usuário</Label>
              <Input
                value={smtp.username}
                onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Senha</Label>
              <Input
                type="password"
                value={smtp.password}
                onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Nome do Remetente</Label>
              <Input
                value={smtp.senderName}
                onChange={(e) => setSmtp({ ...smtp, senderName: e.target.value })}
                className="mt-1"
                placeholder="Bússola Jurídica"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">E-mail Remetente</Label>
              <Input
                value={smtp.senderEmail}
                onChange={(e) => setSmtp({ ...smtp, senderEmail: e.target.value })}
                className="mt-1"
                placeholder="noreply@exemplo.com"
              />
            </div>
          </div>
          <Button
            onClick={handleSaveSmtp}
            disabled={savingSmtp}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2"
          >
            {savingSmtp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
