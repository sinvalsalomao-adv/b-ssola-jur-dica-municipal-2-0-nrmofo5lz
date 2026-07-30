import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'

const config = { count: { label: 'Projetos', color: '#3b82f6' } } satisfies ChartConfig

interface Props {
  data: { name: string; count: number }[]
}

export function TenantsProjectsChart({ data }: Props) {
  return (
    <ChartContainer config={config} className="h-[300px] w-full">
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
          <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Projetos" />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
