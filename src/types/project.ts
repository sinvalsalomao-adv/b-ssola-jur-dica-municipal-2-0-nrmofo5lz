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

export interface ProjectParticipant {
  id: string
  projectId: string
  userId: string
  userName: string
  userEmail?: string
  userRole?: string
  userAvatar?: string | null
  tenantId: string
  addedBy?: string
  role?: string
  createdAt: string
  updatedAt: string
}

export interface CommentMention {
  id: string
  commentId: string
  projectId: string
  mentionedUserId: string
  mentionedUserName?: string
  authorId: string
  tenantId: string
  createdAt: string
}

export interface ProjectComment {
  id: string
  projectId: string
  userId: string
  authorName: string
  authorRole?: string
  authorAvatar?: string | null
  content: string
  parentId?: string | null
  isEdited?: boolean
  editedAt?: string | null
  deleted?: boolean
  deletedAt?: string | null
  deletedBy?: string | null
  tenantId: string
  createdAt: string
  updatedAt: string
  replies?: ProjectComment[]
  mentions?: CommentMention[]
}

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
  tenantId?: string
  objeto?: string
  justificativa?: string
  participants?: ProjectParticipant[]
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
