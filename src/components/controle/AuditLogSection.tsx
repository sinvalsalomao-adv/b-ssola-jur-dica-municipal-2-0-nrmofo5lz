import React from 'react'
import { Plus, ArrowLeftRight, Pencil, History } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AuditActionType } from '@/types/controle'
import { MOCK_AUDIT_LOG } from '@/data/mockControle'

const ACTION_CONFIG: Record<
  AuditActionType,
  { icon: React.ElementType; color: string; bg: string }
> = {
  'Criou card': { icon: Plus, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  'Moveu card': { icon: ArrowLeftRight, color: 'text-amber-600', bg: 'bg-amber-50' },
  'Editou card': { icon: Pencil, color: 'text-violet-600', bg: 'bg-violet-50' },
}

export const AuditLogSection: React.FC = () => {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-[#1c2a3e]" />
          <h3 className="font-bold text-sm text-[#1c2a3e]">Últimas Ações</h3>
          <Badge variant="outline" className="text-[10px] ml-1">
            {MOCK_AUDIT_LOG.length} registros
          </Badge>
        </div>

        <div className="space-y-2">
          {MOCK_AUDIT_LOG.map((entry) => {
            const config = ACTION_CONFIG[entry.actionType]
            const Icon = config.icon
            const dt = new Date(entry.dateTime)
            return (
              <div
                key={entry.id}
                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.bg}`}
                >
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#1c2a3e]">{entry.userName}</span>
                    <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                      {entry.actionType}
                    </Badge>
                    <span className="text-xs text-gray-500 truncate">{entry.projectTitle}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{entry.description}</p>
                </div>
                <div className="text-xs text-gray-400 shrink-0 text-right">
                  <p>{dt.toLocaleDateString('pt-BR')}</p>
                  <p>{dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
