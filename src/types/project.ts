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
  deadline: string // YYYY-MM-DD
  priority: Priority
  column: ColumnType
  prefeitura: Prefecture
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
