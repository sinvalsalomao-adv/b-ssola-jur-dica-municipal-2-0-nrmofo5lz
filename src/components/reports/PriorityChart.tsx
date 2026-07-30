import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Project } from '@/types/project'

const COLORS = { Alta: '#ef4444', Média: '#f59e0b', Baixa: '#10b981' }
const config = {
  Alta: { label: 'Alta', color: COLORS.Alta },
  Média: { label: 'Média', color: COLORS.Média },
  Baixa: { label: 'Baixa', color: COLORS.Baixa },
} satisfies ChartConfig

interface Props {
  projects: Project[]
  tenants: { id: string; name: string }[]
}

export function PriorityChart({ projects, tenants }: Props) {
  const [selectedTenant, setSelectedTenant] = useState('Todas')

  const filtered =
    selectedTenant === 'Todas' ? projects : projects.filter((p) => p.prefeitura === selectedTenant)
  const data = [
    {
      name: 'Alta',
      value: filtered.filter((p) => p.priority === 'Alta').length,
      fill: COLORS.Alta,
    },
    {
      name: 'Média',
      value: filtered.filter((p) => p.priority === 'Média').length,
      fill: COLORS.Média,
    },
    {
      name: 'Baixa',
      value: filtered.filter((p) => p.priority === 'Baixa').length,
      fill: COLORS.Baixa,
    },
  ].filter((d) => d.value > 0)

  return (
    <div className="space-y-3">
      <Select value={selectedTenant} onValueChange={setSelectedTenant}>
        <SelectTrigger className="w-[200px] h-8 text-xs">
          <SelectValue placeholder="Filtrar por prefeitura" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Todas">Todas as Prefeituras</SelectItem>
          {tenants.map((t) => (
            <SelectItem key={t.id} value={t.name}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ChartContainer config={config} className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={{ fontSize: 11 }}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  )
}
