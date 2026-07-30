import pb from '@/lib/pocketbase/client'
import type {
  NotificationItem,
  CalendarEvent,
  DocumentItem,
  AuditLogEntry,
  AuditActionType,
} from '@/types/controle'
import type { ColumnType } from '@/types/project'

export function normalizeNotification(r: any): NotificationItem {
  return {
    id: r.id,
    projectTitle: r.project_title || '',
    column: r.column as ColumnType,
    daysIdle: r.days_stalled || 0,
    responsible: r.person_responsible || '',
    alertDate: r.alert_date || '',
    alertType: r.tipo as any,
    prefeitura: r.expand?.tenant?.name || '',
  }
}

export function normalizeEvent(r: any): CalendarEvent {
  return {
    id: r.id,
    date: r.day || '',
    projectTitle: r.card_title || '',
    responsible: r.responsible || '',
    column: r.column as ColumnType,
  }
}

export function normalizeDocument(r: any): DocumentItem {
  return {
    id: r.id,
    fileName: r.nome_arquivo || '',
    fileSize: r.tamanho || 0,
    projectTitle: r.project_name || '',
    uploadDate: r.upload_em || '',
    uploader: r.upload_por || '',
    pdfUrl: r.url || (r.file ? pb.files.getURL(r, r.file) : ''),
  }
}

export function normalizeAuditLog(r: any): AuditLogEntry {
  return {
    id: r.id,
    actionType: r.action_type as AuditActionType,
    userName: r.user_name || '',
    projectTitle: r.project_title || '',
    dateTime: r.created || '',
    description: r.description || '',
  }
}

export const getNotifications = async () => {
  const records = await pb
    .collection('notifications')
    .getFullList({ expand: 'tenant', sort: '-alert_date' })
  return records.map(normalizeNotification)
}

export const getAgendaEvents = async () => {
  const records = await pb.collection('agenda_events').getFullList({ sort: 'day' })
  return records.map(normalizeEvent)
}

export const getDocuments = async () => {
  const records = await pb.collection('documents').getFullList({ sort: '-upload_em' })
  return records.map(normalizeDocument)
}

export const createDocument = async (data: FormData) =>
  normalizeDocument(await pb.collection('documents').create(data))

export const deleteDocument = async (id: string) => pb.collection('documents').delete(id)

export const getAuditLogs = async (limit = 10) => {
  const records = await pb.collection('audit_logs').getFullList({ sort: '-created' })
  return records.slice(0, limit).map(normalizeAuditLog)
}

export const getAllAuditLogs = async () => {
  const records = await pb
    .collection('audit_logs')
    .getFullList({ sort: '-created', expand: 'tenant' })
  return records.map(normalizeAuditLog)
}
