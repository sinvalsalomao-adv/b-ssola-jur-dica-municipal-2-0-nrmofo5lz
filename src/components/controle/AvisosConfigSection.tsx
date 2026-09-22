import { useState, useEffect } from 'react'
import {
  BellRing,
  Clock,
  Calendar,
  AlertTriangle,
  Lock,
  Save,
  Loader2,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import {
  getAvisosConfig,
  saveAvisosConfig,
  DEFAULT_AVISOS_CONFIG,
  DEFAULT_FAIXAS_URGENCIA,
} from '@/services/avisos'
import type { AvisosConfigRecord } from '@/types/avisos'

interface Props {
  tenantId: string
}

export function AvisosConfigSection({ tenantId }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configId, setConfigId] = useState<string | null>(null)

  const [form, setForm] = useState({
    horario_aviso_diario: DEFAULT_AVISOS_CONFIG.horario_aviso_diario,
    dias_antecedencia: DEFAULT_AVISOS_CONFIG.dias_antecedencia,
    horario_limite_confirmacao: DEFAULT_AVISOS_CONFIG.horario_limite_confirmacao,
    intervalo_lembrete_horas: DEFAULT_AVISOS_CONFIG.intervalo_lembrete_horas,
    max_lembretes: DEFAULT_AVISOS_CONFIG.max_lembretes,
    bloqueio_automatico: DEFAULT_AVISOS_CONFIG.bloqueio_automatico,
    exigir_confirmacao_sem_demandas: DEFAULT_AVISOS_CONFIG.exigir_confirmacao_sem_demandas,
    alerta_extraordinario_critica_vencida:
      DEFAULT_AVISOS_CONFIG.alerta_extraordinario_critica_vencida,
    tipo_contagem_dias: DEFAULT_AVISOS_CONFIG.tipo_contagem_dias,
    mensagem_padrao: DEFAULT_AVISOS_CONFIG.mensagem_padrao,
    ativo: DEFAULT_AVISOS_CONFIG.ativo,
    faixas_urgencia: { ...DEFAULT_FAIXAS_URGENCIA },
  })

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      try {
        const cfg = await getAvisosConfig(tenantId)
        if (cfg) {
          setConfigId(cfg.id)
          setForm({
            horario_aviso_diario: cfg.horario_aviso_diario || '08:00',
            dias_antecedencia: cfg.dias_antecedencia ?? 2,
            horario_limite_confirmacao: cfg.horario_limite_confirmacao || '12:00',
            intervalo_lembrete_horas: cfg.intervalo_lembrete_horas ?? 3,
            max_lembretes: cfg.max_lembretes ?? 2,
            bloqueio_automatico: cfg.bloqueio_automatico !== false,
            exigir_confirmacao_sem_demandas: Boolean(cfg.exigir_confirmacao_sem_demandas),
            alerta_extraordinario_critica_vencida:
              cfg.alerta_extraordinario_critica_vencida !== false,
            tipo_contagem_dias: cfg.tipo_contagem_dias || 'dias_uteis',
            mensagem_padrao: cfg.mensagem_padrao || 'BÚSSOLA JURÍDICA — AVISO DIÁRIO',
            ativo: cfg.ativo !== false,
            faixas_urgencia: cfg.faixas_urgencia || { ...DEFAULT_FAIXAS_URGENCIA },
          })
        }
      } catch (err) {
        console.warn('Erro ao carregar avisos_config:', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [tenantId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId) return
    setSaving(true)
    try {
      const saved = await saveAvisosConfig(tenantId, form, configId || undefined)
      if (saved?.id) setConfigId(saved.id)
      toast.success('Configurações de avisos e ciência salvas com sucesso!')
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Erro ao salvar configurações de avisos.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
        Carregando parâmetros de avisos...
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Card className="bg-white border-0 shadow-subtle">
        <CardHeader className="p-5 pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-[#1c2a3e] flex items-center gap-2">
              <BellRing className="w-4 h-4 text-[#3b82f6]" />
              Parâmetros de Avisos & Confirmação de Ciência
            </CardTitle>
            <CardDescription className="text-xs text-gray-500 mt-1">
              Configure as regras de envio diário via Telegram, lembretes, horários limites e
              bloqueio automático de acesso.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="ativo-switch" className="text-xs font-semibold text-gray-700">
              Módulo Ativo
            </Label>
            <Switch
              id="ativo-switch"
              checked={form.ativo}
              onCheckedChange={(v) => setForm({ ...form, ativo: v })}
            />
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-6">
          {/* Horários e Prazos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Horário do Aviso Diário</Label>
              <Input
                type="text"
                value={form.horario_aviso_diario}
                onChange={(e) => setForm({ ...form, horario_aviso_diario: e.target.value })}
                placeholder="08:00"
                className="mt-1 h-8 text-xs"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">Formato 24h (ex: 08:00)</p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Dias de Antecedência</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={form.dias_antecedencia}
                onChange={(e) => setForm({ ...form, dias_antecedencia: Number(e.target.value) })}
                className="mt-1 h-8 text-xs"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">
                Janela para incluir demandas próximas
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Horário Limite p/ Confirmação
              </Label>
              <Input
                type="text"
                value={form.horario_limite_confirmacao}
                onChange={(e) => setForm({ ...form, horario_limite_confirmacao: e.target.value })}
                placeholder="12:00"
                className="mt-1 h-8 text-xs"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">
                Limite antes do bloqueio (ex: 12:00)
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Intervalo de Lembretes (Horas)
              </Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={form.intervalo_lembrete_horas}
                onChange={(e) =>
                  setForm({ ...form, intervalo_lembrete_horas: Number(e.target.value) })
                }
                className="mt-1 h-8 text-xs"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">Reenvio caso não haja confirmação</p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Máximo de Lembretes</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={form.max_lembretes}
                onChange={(e) => setForm({ ...form, max_lembretes: Number(e.target.value) })}
                className="mt-1 h-8 text-xs"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">Tentativas até o horário limite</p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Tipo de Contagem de Dias
              </Label>
              <Select
                value={form.tipo_contagem_dias}
                onValueChange={(v: 'dias_uteis' | 'dias_corridos') =>
                  setForm({ ...form, tipo_contagem_dias: v })
                }
              >
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dias_uteis">Dias Úteis (deduz feriados)</SelectItem>
                  <SelectItem value="dias_corridos">Dias Corridos</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Dias úteis desconsideram finais de semana e feriados
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <h4 className="text-xs font-bold text-[#1c2a3e] uppercase">
              Regras de Bloqueio & Alertas Extraordinários
            </h4>

            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-slate-50/50">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold text-gray-800">
                  Bloqueio Automático por Falta de Confirmação
                </Label>
                <p className="text-[11px] text-gray-500">
                  Se o servidor não confirmar até o horário limite, o acesso à tela do Bússola é
                  bloqueado até a confirmação no Telegram.
                </p>
              </div>
              <Switch
                checked={form.bloqueio_automatico}
                onCheckedChange={(v) => setForm({ ...form, bloqueio_automatico: v })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-slate-50/50">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold text-gray-800">
                  Exigir Confirmação Mesmo Sem Demandas
                </Label>
                <p className="text-[11px] text-gray-500">
                  Envia a mensagem "Não existem demandas disponíveis para você neste momento"
                  exigindo o clique de ciência.
                </p>
              </div>
              <Switch
                checked={form.exigir_confirmacao_sem_demandas}
                onCheckedChange={(v) => setForm({ ...form, exigir_confirmacao_sem_demandas: v })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-slate-50/50">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold text-gray-800">
                  Alerta Extraordinário Imediato (Crítica / Vencida)
                </Label>
                <p className="text-[11px] text-gray-500">
                  Quando surgir demanda crítica (0 dias) ou vencida atribuída ao servidor, enviar
                  notificação imediata com botão de ciência fora do ciclo matinal.
                </p>
              </div>
              <Switch
                checked={form.alerta_extraordinario_critica_vencida}
                onCheckedChange={(v) =>
                  setForm({ ...form, alerta_extraordinario_critica_vencida: v })
                }
              />
            </div>
          </div>

          {/* Faixas de Urgência Editáveis */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <h4 className="text-xs font-bold text-[#1c2a3e] uppercase">
              Faixas de Urgência Parametrizáveis
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                <span className="font-semibold text-emerald-800 block">🟢 Baixa Urgência</span>
                <span className="text-[11px] text-gray-600 block mt-1">Mais de 5 dias</span>
              </div>
              <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50">
                <span className="font-semibold text-amber-800 block">🟡 Média Urgência</span>
                <span className="text-[11px] text-gray-600 block mt-1">De 3 a 5 dias</span>
              </div>
              <div className="p-2.5 rounded-lg border border-orange-200 bg-orange-50/50">
                <span className="font-semibold text-orange-800 block">🟠 Alta Urgência</span>
                <span className="text-[11px] text-gray-600 block mt-1">De 1 a 2 dias</span>
              </div>
              <div className="p-2.5 rounded-lg border border-red-200 bg-red-50/50">
                <span className="font-semibold text-red-800 block">🔴 Crítica / Vencida</span>
                <span className="text-[11px] text-gray-600 block mt-1">
                  Hoje (0) ou Menor que 0
                </span>
              </div>
            </div>
          </div>

          {/* Mensagem Padrão */}
          <div className="border-t border-gray-100 pt-4">
            <Label className="text-xs font-semibold text-gray-700">
              Cabeçalho / Mensagem Padrão do Aviso
            </Label>
            <Input
              value={form.mensagem_padrao}
              onChange={(e) => setForm({ ...form, mensagem_padrao: e.target.value })}
              className="mt-1 h-8 text-xs font-mono"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs gap-1.5"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Salvar Parâmetros de Avisos
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
