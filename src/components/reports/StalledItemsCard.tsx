import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface StalledItem {
  id: string
  projectTitle: string
  column: string
  daysStalled: number
  responsible: string
}

interface Props {
  items: StalledItem[]
}

export function StalledItemsCard({ items }: Props) {
  return (
    <Card className="bg-white border-0 shadow-subtle">
      <div className="p-5 border-b border-gray-100 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-bold text-[#1c2a3e]">Itens Parados ({items.length})</h3>
      </div>
      <CardContent className="p-4">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum item parado encontrado.</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50/50 border border-amber-100"
              >
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1c2a3e] truncate">
                    {item.projectTitle}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.column} • {item.responsible}
                  </p>
                </div>
                <Badge className="bg-amber-500 text-white text-xs shrink-0">
                  {item.daysStalled} dias
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
