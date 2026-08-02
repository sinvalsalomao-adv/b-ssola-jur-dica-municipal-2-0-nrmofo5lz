import { ColumnType } from '@/types/project'

export type AlertType = 'Gargalo' | 'Prazo Fatal' | 'Aviso Interno'
export type DeliveryStatus = 'enviada' | 'agendada' | 'cancelada'

export interface NotificationItem {
  id: string
  projectTitle: string
  column: ColumnType
  daysIdle: number
  responsible: string
  alertDate: string
  alertType: AlertType
  prefeitura: string
  mensagem?: string
  lida?: boolean
  projetoId?: string
  deliveryStatus?: DeliveryStatus
  scheduledFor?: string
  deliveredAt?: string
}

export interface CalendarEvent {
  id: string
  date: string
  projectTitle: string
  responsible: string
  column: ColumnType
}

export interface DocumentItem {
  id: string
  fileName: string
  fileSize: number
  projectTitle: string
  uploadDate: string
  uploader: string
  pdfUrl: string
}

export type AuditActionType = 'Criou card' | 'Moveu card' | 'Editou card'

export interface AuditLogEntry {
  id: string
  actionType: AuditActionType
  userName: string
  projectTitle: string
  dateTime: string
  description: string
}

export type StallLimits = Record<ColumnType, number>

export const DEFAULT_STALL_LIMITS: StallLimits = {
  Ideação: 5,
  'Projeto Executivo': 5,
  'Elaborar DFD': 3,
  'Procedimentos Internos': 7,
  Execução: 10,
  'Prestação de Contas': 5,
  Marketing: 3,
}

export const DEFAULT_PROXIMITY_DAYS = 3

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
