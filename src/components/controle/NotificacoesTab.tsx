import React, { useState, useMemo } from 'react'
import { AlertTriangle, Clock, User, Building2, Settings2 } from 'lucide-react'
import { formatDate } from '@/lib/dateUtils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PREFEITURAS, USERS } from '@/types/project'
import { StallLimits } from '@/types/controle'
import { MOCK_NOTIFICATIONS } from '@/data/mockControle'
import { StallLimitsModal } from '@/components/controle/StallLimitsModal'

interface NotificacoesTabProps {
  limits: StallLimits
  proximityDays: number
  onSaveLimits: (limits: StallLimits, proximityDays: number) => void
}

export const NotificacoesTab: React.FC<NotificacoesTabProps> = ({
  limits,
  proximityDays,
  onSaveLimits,
}) => {
  const [filterPref, setFilterPref] = useState('Todas')
  const [filterResp, setFilterResp] = useState('Todos')
  const [filterType, setFilterType] = useState('Todos')
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = useMemo(() => {
    return MOCK_NOTIFICATIONS.filter((n) => {
      if (filterPref !== 'Todas' && n.prefeitura !== filterPref) return false
      if (filterResp !== 'Todos' && n.responsible !== filterResp) return false
      if (filterType !== 'Todos' && n.alertType !== filterType) return false
      return true
    })
  }, [filterPref, filterResp, filterType])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <Select value={filterPref} onValueChange={setFilterPref}>
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <SelectValue placeholder="Prefeitura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas as Prefeituras</SelectItem>
              {PREFEITURAS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterResp} onValueChange={setFilterResp}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {USERS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Tipo de Alerta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              <SelectItem value="Gargalo">Gargalo</SelectItem>
              <SelectItem value="Prazo Fatal">Prazo Fatal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          className="h-9 text-xs gap-1.5 shrink-0"
          onClick={() => setModalOpen(true)}
        >
          <Settings2 className="w-4 h-4" /> Configurar limites
        </Button>
      </div>

      <div className="space-y-3">
        {filtered.map((n) => {
          const isFatal = n.alertType === 'Prazo Fatal'
          return (
            <Card
              key={n.id}
              className={`border-l-4 ${isFatal ? 'border-l-red-500' : 'border-l-amber-500'} shadow-sm`}
            >
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isFatal ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}
                >
                  {isFatal ? <AlertTriangle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm text-[#1c2a3e]">{n.projectTitle}</h4>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${isFatal ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                    >
                      {n.alertType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {n.prefeitura}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Coluna: <strong className="text-gray-700">{n.column}</strong>
                    </span>
                    <span className="flex items-center gap-1 text-red-600 font-medium">
                      {n.daysIdle} dias parado
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {n.responsible}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-400 sm:text-right shrink-0">
                  <p className="font-medium">Alerta enviado</p>
                  <p>{formatDate(n.alertDate)}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            Nenhuma notificação encontrada com os filtros selecionados.
          </div>
        )}
      </div>

      <StallLimitsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        limits={limits}
        proximityDays={proximityDays}
        onSave={onSaveLimits}
      />
    </div>
  )
}
