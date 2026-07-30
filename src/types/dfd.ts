export type DfdStatus = 'Rascunho' | 'Finalizado'

export interface DfdRecord {
  id: string
  title: string
  objeto: string
  descricao: string
  justificativa: string
  responsible: string
  responsibleUserId: string
  deadline: string
  status: DfdStatus
  createdAt: string
  projetoId: string
}

export const INITIAL_SAVED_PHRASES = [
  'Reforma da praça central',
  'Aquisição de material de expediente',
  'Manutenção de veículos',
]

export const DFD_RESPONSIBLES = [
  'Ana Oliveira',
  'Carlos Santos',
  'Marina Costa',
  'Pedro Almeida',
  'Juliana Rocha',
]
