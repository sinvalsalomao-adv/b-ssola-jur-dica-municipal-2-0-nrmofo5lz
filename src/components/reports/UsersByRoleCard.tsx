import { Card, CardContent } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  servidor: 'Servidor',
  gestor: 'Gestor',
  secretario: 'Secretário',
  procurador: 'Procurador',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-blue-100 text-blue-700',
  servidor: 'bg-slate-100 text-slate-700',
  gestor: 'bg-green-100 text-green-700',
  secretario: 'bg-orange-100 text-orange-700',
  procurador: 'bg-cyan-100 text-cyan-700',
}

interface Props {
  data: Record<string, number>
}

export function UsersByRoleCard({ data }: Props) {
  const roles = Object.keys(ROLE_LABELS)
  const total = roles.reduce((sum, r) => sum + (data[r] || 0), 0)

  return (
    <Card className="bg-white border-0 shadow-subtle">
      <div className="p-5 border-b border-gray-100 flex items-center gap-2">
        <Users className="w-4 h-4 text-[#3b82f6]" />
        <h3 className="text-sm font-bold text-[#1c2a3e]">Usuários por Papel</h3>
      </div>
      <CardContent className="p-4">
        <div className="space-y-2">
          {roles.map((role) => (
            <div
              key={role}
              className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0"
            >
              <Badge className={ROLE_COLORS[role] || 'bg-slate-100 text-slate-700'}>
                {ROLE_LABELS[role]}
              </Badge>
              <span className="text-sm font-bold text-[#1c2a3e]">{data[role] || 0}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <span className="text-sm font-bold text-[#1c2a3e]">Total</span>
          <span className="text-lg font-bold text-[#3b82f6]">{total}</span>
        </div>
      </CardContent>
    </Card>
  )
}
