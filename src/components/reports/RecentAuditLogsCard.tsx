import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, ArrowLeftRight, Pencil, History } from 'lucide-react'

interface LogEntry {
  id: string
  userName: string
  actionType: string
  description: string
  projectTitle: string
  created: string
}

const ACTION_CONFIG: Record<string, { icon: typeof Plus; color: string; bg: string }> = {
  'Criou card': { icon: Plus, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  'Moveu card': { icon: ArrowLeftRight, color: 'text-amber-600', bg: 'bg-amber-50' },
  'Editou card': { icon: Pencil, color: 'text-violet-600', bg: 'bg-violet-50' },
}

interface Props {
  logs: LogEntry[]
}

export function RecentAuditLogsCard({ logs }: Props) {
  return (
    <Card className="bg-white border-0 shadow-subtle">
      <div className="p-5 border-b border-gray-100 flex items-center gap-2">
        <History className="w-4 h-4 text-[#3b82f6]" />
        <h3 className="text-sm font-bold text-[#1c2a3e]">Auditoria Recente ({logs.length})</h3>
      </div>
      <CardContent className="p-4">
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum registro encontrado.</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {logs.map((entry) => {
              const config = ACTION_CONFIG[entry.actionType] || ACTION_CONFIG['Editou card']
              const Icon = config.icon
              const dt = entry.created ? new Date(entry.created) : new Date()
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100"
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
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{entry.description}</p>
                    {entry.projectTitle && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{entry.projectTitle}</p>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400 shrink-0 text-right">
                    <p>{dt.toLocaleDateString('pt-BR')}</p>
                    <p>
                      {dt.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
