import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { COLUMNS } from '@/types/project'

const COLORS: Record<string, string> = {
  Ideação: '#3b82f6',
  'Projeto Executivo': '#10b981',
  'Elaborar DFD': '#f59e0b',
  'Procedimentos Internos': '#8b5cf6',
  Execução: '#ec4899',
  'Prestação de Contas': '#6366f1',
  Marketing: '#14b8a6',
}

const config = Object.fromEntries(
  COLUMNS.map((c) => [c, { label: c, color: COLORS[c] }]),
) satisfies ChartConfig

interface Props {
  data: Record<string, any>[]
}

export function KanbanColumnsChart({ data }: Props) {
  return (
    <ChartContainer config={config} className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            interval={0}
            angle={-15}
            textAnchor="end"
            height={50}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
            cursor={{ fill: '#f1f5f9' }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {COLUMNS.map((col) => (
            <Bar
              key={col}
              dataKey={col}
              stackId="a"
              fill={COLORS[col]}
              name={col}
              radius={[0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
