export type Priority = 'Alta' | 'Média' | 'Baixa'

export type ColumnType =
  | 'Ideação'
  | 'Projeto Executivo'
  | 'Elaborar DFD'
  | 'Procedimentos Internos'
  | 'Execução'
  | 'Prestação de Contas'
  | 'Marketing'

export type Prefecture = 'Florânia' | 'Tangará' | 'Parazinho'

export interface Project {
  id: string
  title: string
  description: string
  responsible: string
  responsibleUserId: string
  deadline: string
  priority: Priority
  column: ColumnType
  prefeitura: string
  objeto?: string
  justificativa?: string
  createdAt: string
  updatedAt: string
}

export interface ChecklistItem {
  id: string
  checklistId: string
  projetoId: string
  texto: string
  concluido: boolean
  responsibleUserId?: string
  responsibleUserName?: string
  prazo?: string
  ordem: number
  tenantId: string
  createdAt: string
  updatedAt: string
}

export interface Checklist {
  id: string
  titulo: string
  projetoId: string
  tenantId: string
  ordem: number
  items: ChecklistItem[]
  createdAt: string
  updatedAt: string
}

export const COLUMNS: ColumnType[] = [
  'Ideação',
  'Projeto Executivo',
  'Elaborar DFD',
  'Procedimentos Internos',
  'Execução',
  'Prestação de Contas',
  'Marketing',
]

export const PREFEITURAS: Prefecture[] = ['Florânia', 'Tangará', 'Parazinho']

export const USERS = ['Ana', 'Carlos', 'Mariana', 'Pedro', 'Sofia']
