export interface WidgetConfig {
  id: string
  visible: boolean
  order: number
}

export const WIDGET_CATALOG = [
  {
    id: 'stats-overview',
    name: 'Visão Geral',
    description: 'Projetos ativos, notificações e prazos',
  },
  {
    id: 'recent-projects',
    name: 'Projetos Recentes',
    description: 'Últimas atualizações de projetos',
  },
  { id: 'users-total', name: 'Total de Usuários', description: 'Contagem total de usuários' },
  {
    id: 'users-status',
    name: 'Usuários Ativos/Inativos',
    description: 'Status de ativação dos usuários',
  },
  { id: 'recent-access', name: 'Últimos Acessos', description: 'Últimos logins no sistema' },
  {
    id: 'recent-notifications',
    name: 'Notificações Recentes',
    description: 'Últimas notificações do sistema',
  },
  { id: 'stalled-items', name: 'Itens Estagnados', description: 'Projetos parados no fluxo' },
  {
    id: 'chart-users-role',
    name: 'Gráfico de Usuários por Papel',
    description: 'Distribuição por função',
  },
  {
    id: 'chart-projects-column',
    name: 'Gráfico de Projetos por Etapa',
    description: 'Projetos por coluna Kanban',
  },
  {
    id: 'recent-audit-logs',
    name: 'Logs de Auditoria Recentes',
    description: 'Últimas ações registradas',
  },
] as const

export const DEFAULT_WIDGET_CONFIG: WidgetConfig[] = WIDGET_CATALOG.map((w, i) => ({
  id: w.id,
  visible: true,
  order: i,
}))
