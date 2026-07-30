import { DfdRecord } from '@/types/dfd'

export const MOCK_RECENT_DFDs: DfdRecord[] = [
  {
    id: 'dfd-1',
    title: 'Reforma da Praça Central de Florânia',
    objeto: 'Reforma e revitalização da praça central',
    descricao: 'Obra de melhoria urbana no centro da cidade',
    justificativa: '',
    responsible: 'Ana Oliveira',
    deadline: '2024-12-15',
    status: 'Finalizado',
    createdAt: '2024-10-15T10:00:00Z',
  },
  {
    id: 'dfd-2',
    title: 'Aquisição de Veículos para Saúde',
    objeto: 'Aquisição de ambulâncias e veículos de apoio',
    descricao: 'Renovação da frota municipal de saúde',
    justificativa: '',
    responsible: 'Carlos Santos',
    deadline: '2024-12-20',
    status: 'Rascunho',
    createdAt: '2024-10-12T14:00:00Z',
  },
  {
    id: 'dfd-3',
    title: 'Construção de Creche Municipal',
    objeto: 'Construção de unidade de educação infantil',
    descricao: 'Ampliação da rede de ensino municipal',
    justificativa: '',
    responsible: 'Marina Costa',
    deadline: '2025-01-15',
    status: 'Rascunho',
    createdAt: '2024-10-10T09:00:00Z',
  },
]
