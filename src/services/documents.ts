import pb from '@/lib/pocketbase/client'
import type { DocumentItem } from '@/types/controle'

export function normalizeDocument(r: any): DocumentItem {
  return {
    id: r.id,
    projectTitle: r.project_name || '',
    fileName: r.nome_arquivo || r.file || 'Documento',
    pdfUrl: r.url || (r.file ? pb.files.getURL(r, r.file) : ''),
    fileSize: r.tamanho || 0,
    uploadDate: r.upload_em || r.created || '',
    uploader: r.upload_por || 'Sistema',
  }
}

export const getDocumentsByProject = async (projectId: string, tenantId?: string) => {
  let filter = `projeto_id = "${projectId}"`
  if (tenantId) {
    filter += ` && tenant = "${tenantId}"`
  }
  const records = await pb.collection('documents').getFullList({
    filter,
    sort: '-created',
  })
  return records.map(normalizeDocument)
}

export const uploadDocument = async (
  file: File,
  projectId: string,
  projectName: string,
  tenantId: string,
  userName: string,
) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('nome_arquivo', file.name)
  formData.append('tamanho', file.size.toString())
  formData.append('project_name', projectName)
  formData.append('projeto_id', projectId)
  formData.append('tenant', tenantId)
  formData.append('upload_por', userName)
  formData.append('upload_em', new Date().toISOString())

  const record = await pb.collection('documents').create(formData)
  return normalizeDocument(record)
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
) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const fileName = `${typeLabel}_${title}.txt`
  const file = new File([blob], fileName, { type: 'text/plain' })

  return uploadDocument(file, projectId, title, tenantId, userName)
}
