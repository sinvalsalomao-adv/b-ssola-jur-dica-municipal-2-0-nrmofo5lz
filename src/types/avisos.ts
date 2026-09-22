export type AvisoStatus =
  | 'pendente_envio'
  | 'enviado'
  | 'entregue'
  | 'aguardando_confirmacao'
  | 'confirmado'
  | 'expirado'
  | 'bloqueado'

export type AvisoTipo = 'diario' | 'lembrete' | 'alerta_extraordinario'

export interface DemandaVinculada {
  id: string
  tipo: 'projeto' | 'dfd'
  titulo: string
  prazo: string
  dias?: number
  urgencia: 'BAIXA' | 'MÉDIA' | 'ALTA' | 'CRÍTICA' | 'VENCIDA'
  icone?: string
  status?: string
  coluna?: string
}

export interface AvisoRecord {
  id: string
  codigo: string
  user: string
  userName?: string
  userEmail?: string
  tenant: string
  tenantName?: string
  telegram_id?: string
  data_hora_envio?: string
  tipo: AvisoTipo
  demandas_vinculadas?: DemandaVinculada[]
  qtd_demandas: number
  status: AvisoStatus
  data_hora_confirmacao?: string
  tentativas_envio?: number
  ultimo_erro?: string
  telegram_message_id?: string
  parent_aviso?: string
  created: string
  updated: string
}

export interface FaixasUrgencia {
  baixa_dias: number
  media_dias_min: number
  media_dias_max: number
  alta_dias_min: number
  alta_dias_max: number
  critica_dias: number
}

export interface AvisosConfigRecord {
  id: string
  tenant: string
  horario_aviso_diario: string
  dias_antecedencia: number
  horario_limite_confirmacao: string
  intervalo_lembrete_horas: number
  max_lembretes: number
  bloqueio_automatico: boolean
  exigir_confirmacao_sem_demandas: boolean
  alerta_extraordinario_critica_vencida: boolean
  tipo_contagem_dias: 'dias_uteis' | 'dias_corridos'
  faixas_urgencia: FaixasUrgencia
  mensagem_padrao: string
  ativo: boolean
  created?: string
  updated?: string
}

export interface FeriadoRecord {
  id: string
  tenant?: string
  data: string
  descricao: string
  created?: string
  updated?: string
}

export interface AvisosIndicadores {
  enviadosHoje: number
  confirmadosHoje: number
  aguardandoHoje: number
  usuariosBloqueados: number
  demandasCriticas: number
  demandasVencidas: number
  taxaConfirmacao: number
}
