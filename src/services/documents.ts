import pb from '@/lib/pocketbase/client'
import type { DocumentItem } from '@/types/controle'
import { sanitizeInput } from '@/lib/sanitize'
import { sanitizeString } from '@/lib/errorSanitizer'

export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024 // 20 MB

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'png',
  'jpg',
  'jpeg',
] as const

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
] as const

export const DOCUMENT_CATEGORIES = [
  'Edital / Termo de Referência',
  'Parecer Jurídico',
  'Contrato / Aditivo',
  'Nota de Empenho / Fiscal',
  'DFD / Estudo Técnico Preliminar',
  'Publicação / Diário Oficial',
  'Planilha Orçamentária',
  'Outro',
] as const

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]

/**
 * Validação de extensão e MIME type de arquivo seguro.
 * Rejeita executáveis, scripts, html, svg e tipos não autorizados.
 */
export function validateDocumentFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Nenhum arquivo selecionado.' }
  }

  if (file.size > MAX_DOCUMENT_SIZE) {
    return {
      valid: false,
      error: `O arquivo excede o limite máximo permitido de 20 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    }
  }

  const name = file.name || ''
  const ext = name.split('.').pop()?.toLowerCase() || ''

  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext as any)) {
    return {
      valid: false,
      error: `Formato de arquivo ".${ext}" não permitido. Permitidos apenas: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG e JPEG.`,
    }
  }

  // Validação do MIME type
  const mime = (file.type || '').toLowerCase()
  if (mime) {
    // Rejeição expressa de tipos perigosos
    if (
      mime.includes('html') ||
      mime.includes('javascript') ||
      mime.includes('svg') ||
      mime.includes('executable') ||
      mime.includes('x-sh') ||
      mime.includes('x-msdownload')
    ) {
      return {
        valid: false,
        error: 'Tipo de arquivo potencialmente inseguro rejeitado.',
      }
    }

    const isMimeAllowed = ALLOWED_MIME_TYPES.some(
      (m) => mime === m || mime.startsWith('image/jpeg') || mime.startsWith('image/png'),
    )

    // Se o MIME estiver preenchido e não for compatível
    if (!isMimeAllowed) {
      // Casos específicos onde o SO envia mime genérico para office
      const isOfficeExt = ['doc', 'docx', 'xls', 'xlsx'].includes(ext)
      const isPdfExt = ext === 'pdf' && mime === 'application/pdf'
      const isImgExt = ['png', 'jpg', 'jpeg'].includes(ext) && mime.startsWith('image/')
      if (!isOfficeExt && !isPdfExt && !isImgExt) {
        return {
          valid: false,
          error: `MIME type "${mime}" incompatível com os tipos documentais permitidos.`,
        }
      }
    }
  }

  return { valid: true }
}

/**
 * Sanitize amigável de nome de arquivo
 */
export function sanitizeFileName(rawName: string): string {
  if (!rawName) return 'documento'
  // Remove caracteres de controle e perigosos mantendo acentos e formato amigável
  const clean = Array.from(rawName)
    .filter((char) => {
      const code = char.charCodeAt(0)
      if (code < 32 || code === 127) return false
      return !['<', '>', ':', '"', '/', '\\', '|', '?', '*'].includes(char)
    })
    .join('')
    .trim()
  return sanitizeString(clean) || 'documento'
}

export function normalizeDocument(r: any): DocumentItem {
  return {
    id: r.id,
    projectTitle: r.project_name || '',
    fileName: r.nome_arquivo || r.file || 'Documento',
    pdfUrl: r.file ? pb.files.getURL(r, r.file) : r.url || '',
    fileSize: r.tamanho || 0,
    uploadDate: r.upload_em || r.created || '',
    uploader: r.upload_por || r.expand?.user_id?.name || 'Sistema',
    projectId: r.projeto_id || '',
    tenantId: r.tenant || '',
    categoria: r.categoria || 'Outro',
    etapa: r.etapa || 'Ideação',
    descricao: r.descricao || '',
    versao: typeof r.versao === 'number' ? r.versao : 1,
    parentDocumentId: r.parent_document_id || null,
    isLatestVersion: r.is_latest_version !== false,
    arquivado: !!r.arquivado,
    userId: r.user_id || '',
    file: r.file || '',
  }
}

/**
 * Retorna uma URL temporária autenticada para download/visualização de documento protegido
 */
export async function getProtectedDocumentUrl(
  record: { id: string; file?: string; [key: string]: any },
  filename?: string,
  download = false,
): Promise<string> {
  const targetFile = filename || record.file
  if (!targetFile) {
    return record.url || ''
  }

  try {
    const fileToken = await pb.files.getToken()
    return pb.files.getURL(record, targetFile, {
      token: fileToken,
      download: download ? true : undefined,
    })
  } catch (_err) {
    // Fallback para getURL com token de auth atual se getFileToken não estiver configurado
    return pb.files.getURL(record, targetFile, {
      download: download ? true : undefined,
    })
  }
}

export interface UploadDocumentParams {
  file: File
  projectId: string
  projectName: string
  tenantId: string
  userName: string
  userId?: string
  categoria: string
  etapa: string
  descricao?: string
  versao?: number
  parentDocumentId?: string | null
}

/**
 * Faz upload de um documento com validação e tenant obrigatório
 */
export const uploadDocument = async (
  file: File,
  projectId: string,
  projectName: string,
  tenantId: string,
  userName: string,
  options?: {
    userId?: string
    categoria?: string
    etapa?: string
    descricao?: string
    versao?: number
    parentDocumentId?: string | null
  },
) => {
  if (!tenantId || tenantId.trim() === '') {
    throw new Error('Tenant é obrigatório para upload de documento.')
  }
  if (!projectId || projectId.trim() === '') {
    throw new Error('Projeto é obrigatório para upload de documento.')
  }

  // Validação no cliente
  const validation = validateDocumentFile(file)
  if (!validation.valid) {
    throw new Error(validation.error || 'Arquivo inválido para upload.')
  }

  const cleanName = sanitizeFileName(file.name)
  const cleanDesc = options?.descricao ? sanitizeInput(options.descricao) : ''

  const formData = new FormData()
  formData.append('file', file)
  formData.append('nome_arquivo', cleanName)
  formData.append('tamanho', file.size.toString())
  formData.append('project_name', sanitizeInput(projectName))
  formData.append('projeto_id', projectId)
  formData.append('tenant', tenantId)
  formData.append('upload_por', sanitizeInput(userName))
  formData.append('upload_em', new Date().toISOString())
  formData.append('categoria', options?.categoria || 'Outro')
  formData.append('etapa', options?.etapa || 'Ideação')
  formData.append('descricao', cleanDesc)
  formData.append('versao', (options?.versao || 1).toString())
  formData.append('is_latest_version', 'true')
  formData.append('arquivado', 'false')

  if (options?.parentDocumentId) {
    formData.append('parent_document_id', options.parentDocumentId)
  }
  if (options?.userId) {
    formData.append('user_id', options.userId)
  }

  const record = await pb.collection('documents').create(formData, {
    expand: 'user_id',
  })
  return normalizeDocument(record)
}

/**
 * Cria uma nova versão de um documento existente
 */
export const createDocumentVersion = async (
  file: File,
  parentDoc: DocumentItem,
  tenantId: string,
  userName: string,
  options?: {
    userId?: string
    categoria?: string
    etapa?: string
    descricao?: string
  },
) => {
  if (!tenantId) {
    throw new Error('Tenant é obrigatório para substituição de documento.')
  }

  const rootParentId = parentDoc.parentDocumentId || parentDoc.id
  const nextVersion = (parentDoc.versao || 1) + 1

  // 1. Marca versões anteriores como is_latest_version = false
  try {
    await pb.collection('documents').update(parentDoc.id, {
      is_latest_version: false,
    })
  } catch (err) {
    console.warn('Não foi possível atualizar versão anterior:', err)
  }

  // 2. Cria a nova versão
  return uploadDocument(
    file,
    parentDoc.projectId || '',
    parentDoc.projectTitle || '',
    tenantId,
    userName,
    {
      userId: options?.userId,
      categoria: options?.categoria || parentDoc.categoria || 'Outro',
      etapa: options?.etapa || parentDoc.etapa || 'Ideação',
      descricao: options?.descricao !== undefined ? options.descricao : parentDoc.descricao,
      versao: nextVersion,
      parentDocumentId: rootParentId,
    },
  )
}

/**
 * Arquiva um documento de forma reversível
 */
export const archiveDocument = async (id: string) => {
  const record = await pb.collection('documents').update(id, {
    arquivado: true,
  })
  return normalizeDocument(record)
}

/**
 * Restaura um documento arquivado
 */
export const restoreDocument = async (id: string) => {
  const record = await pb.collection('documents').update(id, {
    arquivado: false,
  })
  return normalizeDocument(record)
}

/**
 * Busca histórico de todas as versões de uma cadeia documental
 */
export const getDocumentVersionHistory = async (rootId: string, tenantId?: string) => {
  let filter = `(id = "${rootId}" || parent_document_id = "${rootId}")`
  if (tenantId) {
    filter += ` && tenant = "${tenantId}"`
  }
  const records = await pb.collection('documents').getFullList({
    filter,
    sort: '-versao',
    expand: 'user_id',
  })
  return records.map(normalizeDocument)
}

/**
 * Busca documentos vinculados exclusivamente a um projeto
 */
export const getDocumentsByProject = async (
  projectId: string,
  tenantId?: string,
  includeArchived = false,
) => {
  if (!projectId) return []

  let filter = `projeto_id = "${projectId}"`
  if (tenantId) {
    filter += ` && tenant = "${tenantId}"`
  }
  if (!includeArchived) {
    filter += ` && arquivado = false`
  }

  const records = await pb.collection('documents').getFullList({
    filter,
    sort: '-created',
    expand: 'user_id',
  })
  return records.map(normalizeDocument)
}

export const deleteDocument = async (id: string) => {
  await pb.collection('documents').delete(id)
}

export const generateDocument = async (
  dfdData: {
    titulo: string
    objeto: string
    descricao: string
    justificativa: string
    prazo: string
    responsavel: string
  },
  docType: string,
  customType?: string,
  templateContent?: string,
) => {
  return pb.send('/backend/v1/generate-document', {
    method: 'POST',
    body: JSON.stringify({
      dfdData,
      docType,
      customType,
      templateContent,
    }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const saveGeneratedDocument = async (
  content: string,
  typeLabel: string,
  title: string,
  projectId: string,
  tenantId: string,
  userName: string,
  categoria = 'Outro',
  etapa = 'Ideação',
) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const fileName = `${typeLabel}_${title}.txt`
  const file = new File([blob], fileName, { type: 'text/plain' })

  return uploadDocument(file, projectId, title, tenantId, userName, {
    categoria,
    etapa,
    descricao: `Gerado automaticamente: ${typeLabel}`,
  })
}
