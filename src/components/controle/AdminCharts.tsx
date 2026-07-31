import { useState, useEffect, useCallback } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Layers } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { getUsersByRole, getProjectsByColumnForTenant } from '@/services/reports'
import { COLUMNS } from '@/types/project'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  servidor: 'Servidor',
  gestor: 'Gestor',
  secretario: 'Secretário',
  procurador: 'Procurador',
}

const ROLE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

const COLUMN_COLORS: Record<string, string> = {
  Ideação: '#3b82f6',
  'Projeto Executivo': '#10b981',
  'Elaborar DFD': '#f59e0b',
  'Procedimentos Internos': '#8b5cf6',
  Execução: '#ec4899',
  'Prestação de Contas': '#6366f1',
  Marketing: '#14b8a6',
}

export function AdminCharts() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [usersByRole, setUsersByRole] = useState<Record<string, number>>({})
  const [projectsByCol, setProjectsByCol] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    if (!user?.tenantId) return
    try {
      const [ur, pbc] = await Promise.all([
        getUsersByRole(user.tenantId),
        getProjectsByColumnForTenant(user.tenantId),
      ])
      setUsersByRole(ur)
      setProjectsByCol(pbc)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [user?.tenantId])

  useEffect(() => {
    load()
  }, [load])

  useRealtime('users', () => load(), !!user?.tenantId)
  useRealtime('projects', () => load(), !!user?.tenantId)

  const roleData = Object.keys(ROLE_LABELS)
    .map((role, i) => ({
      name: ROLE_LABELS[role],
      value: usersByRole[role] || 0,
      fill: ROLE_COLORS[i],
    }))
    .filter((d) => d.value > 0)

  const colData = (COLUMNS as string[]).map((col) => ({
    name: col,
    count: projectsByCol[col] || 0,
    fill: COLUMN_COLORS[col] || '#3b82f6',
  }))

  const roleConfig = Object.fromEntries(
    Object.keys(ROLE_LABELS).map((r, i) => [r, { label: ROLE_LABELS[r], color: ROLE_COLORS[i] }]),
  ) satisfies ChartConfig

  const colConfig = {
    count: { label: 'Projetos', color: '#3b82f6' },
  } satisfies ChartConfig

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Skeleton className="h-[300px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <Card className="bg-white border-0 shadow-subtle">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#3b82f6]" />
          <h3 className="text-sm font-bold text-[#1c2a3e]">Usuários por Papel</h3>
        </div>
        <CardContent className="p-4">
          {roleData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhum usuário encontrado.</p>
          ) : (
            <ChartContainer config={roleConfig} className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Pie
                    data={roleData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={{ fontSize: 11 }}
                  >
                    {roleData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white border-0 shadow-subtle">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#3b82f6]" />
          <h3 className="text-sm font-bold text-[#1c2a3e]">Projetos por Etapa Kanban</h3>
        </div>
        <CardContent className="p-4">
          <ChartContainer config={colConfig} className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={colData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                  }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Bar dataKey="count" name="Projetos" radius={[4, 4, 0, 0]}>
                  {colData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
