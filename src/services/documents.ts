import pb from '@/lib/pocketbase/client'
import type { DocumentItem } from '@/types/controle'

export function normalizeDocument(r: any): DocumentItem {
  let fileUrl = ''
  if (r.file && typeof r.file === 'string') {
    fileUrl = pb.files.getUrl(r, r.file) as string
  } else if (r.url) {
    fileUrl = r.url
  }
  return {
    id: r.id,
    fileName: r.nome_arquivo || '',
    fileSize: r.tamanho || 0,
    projectTitle: r.project_name || '',
    uploadDate: r.upload_em || r.created || '',
    uploader: r.upload_por || '',
    pdfUrl: fileUrl,
  }
}

export const getDocumentsByProject = async (projectId: string): Promise<DocumentItem[]> => {
  const records = await pb.collection('documents').getFullList({
    filter: `projeto_id = "${projectId}"`,
    sort: '-created',
  })
  return records.map(normalizeDocument)
}

export const uploadDocument = async (
  file: File,
  projectId: string,
  tenantId: string,
  uploaderName: string,
  projectName: string,
): Promise<DocumentItem> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('projeto_id', projectId)
  formData.append('tenant', tenantId)
  formData.append('nome_arquivo', file.name)
  formData.append('tamanho', String(file.size))
  formData.append('upload_em', new Date().toISOString().split('T')[0])
  formData.append('upload_por', uploaderName)
  formData.append('project_name', projectName)
  const record = await pb.collection('documents').create(formData)
  return normalizeDocument(record)
}

export const deleteDocument = async (id: string) => {
  await pb.collection('documents').delete(id)
}
