import { Card, CardContent } from '@/components/ui/card'
import { Bell, Mail, MailOpen, AlertTriangle, Clock } from 'lucide-react'

interface Props {
  data: {
    total: number
    unread: number
    read: number
    gargalo: number
    prazoFatal: number
  }
}

export function NotificationsSummaryCard({ data }: Props) {
  const stats = [
    { label: 'Total', value: data.total, icon: Bell, color: 'text-[#3b82f6]' },
    { label: 'Não lidas', value: data.unread, icon: Mail, color: 'text-amber-500' },
    { label: 'Lidas', value: data.read, icon: MailOpen, color: 'text-emerald-500' },
  ]
  const types = [
    { label: 'Gargalo', value: data.gargalo, icon: Clock, color: 'bg-amber-50 text-amber-700' },
    {
      label: 'Prazo Fatal',
      value: data.prazoFatal,
      icon: AlertTriangle,
      color: 'bg-red-50 text-red-700',
    },
  ]

  return (
    <Card className="bg-white border-0 shadow-subtle">
      <div className="p-5 border-b border-gray-100 flex items-center gap-2">
        <Bell className="w-4 h-4 text-[#3b82f6]" />
        <h3 className="text-sm font-bold text-[#1c2a3e]">Resumo de Notificações</h3>
      </div>
      <CardContent className="p-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {stats.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.label} className="text-center p-2 rounded-lg bg-slate-50">
                <Icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                <p className="text-xl font-bold text-[#1c2a3e]">{s.value}</p>
                <p className="text-[10px] text-gray-500">{s.label}</p>
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {types.map((t) => {
            const Icon = t.icon
            return (
              <div key={t.label} className={`flex items-center gap-2 p-2.5 rounded-lg ${t.color}`}>
                <Icon className="w-4 h-4" />
                <div>
                  <p className="text-sm font-bold">{t.value}</p>
                  <p className="text-[10px]">{t.label}</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
