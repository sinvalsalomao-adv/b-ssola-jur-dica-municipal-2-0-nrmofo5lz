import { useState, useEffect, useCallback } from 'react'
import { UploadCloud, FileText, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatFileSize } from '@/types/controle'
import { getDocumentsByProject, deleteDocument } from '@/services/documents'
import { toast } from 'sonner'
import type { DocumentItem } from '@/types/controle'

const MAX_SIZE = 10 * 1024 * 1024

interface DfdDocumentsSectionProps {
  projectId?: string
  pendingFiles: File[]
  onPendingFilesChange: (files: File[]) => void
}

export function DfdDocumentsSection({
  projectId,
  pendingFiles,
  onPendingFilesChange,
}: DfdDocumentsSectionProps) {
  const [existingDocs, setExistingDocs] = useState<DocumentItem[]>([])

  const loadDocs = useCallback(async () => {
    if (!projectId) {
      setExistingDocs([])
      return
    }
    try {
      const docs = await getDocumentsByProject(projectId)
      setExistingDocs(docs)
    } catch {
      // ignore
    }
  }, [projectId])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const valid: File[] = []
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        toast.error(`"${file.name}" excede o limite de 10 MB.`)
        continue
      }
      valid.push(file)
    }
    if (valid.length > 0) {
      onPendingFilesChange([...pendingFiles, ...valid])
    }
    e.target.value = ''
  }

  const removePendingFile = (index: number) => {
    onPendingFilesChange(pendingFiles.filter((_, i) => i !== index))
  }

  const handleDeleteExisting = async (id: string) => {
    try {
      await deleteDocument(id)
      setExistingDocs((prev) => prev.filter((d) => d.id !== id))
      toast.success('Documento removido.')
    } catch {
      toast.error('Erro ao remover documento.')
    }
  }

  const handleDownload = (doc: DocumentItem) => {
    if (doc.pdfUrl) window.open(doc.pdfUrl, '_blank')
  }

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-gray-300 hover:border-gray-400 rounded-lg p-4 text-center transition-colors cursor-pointer">
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          className="hidden"
          id="dfd-doc-input"
          onChange={handleFileSelect}
        />
        <label htmlFor="dfd-doc-input" className="cursor-pointer flex flex-col items-center">
          <UploadCloud className="w-6 h-6 text-gray-400 mb-1" />
          <p className="text-xs font-medium text-gray-600">Clique ou arraste arquivos</p>
          <p className="text-[10px] text-gray-400 mt-0.5">PDF, DOC, PNG, JPG · Máx 10MB</p>
        </label>
      </div>

      {pendingFiles.length > 0 && (
        <div className="space-y-1.5">
          {pendingFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-100"
            >
              <FileText className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-xs font-medium text-[#1c2a3e] flex-1 truncate">
                {file.name}
              </span>
              <span className="text-[10px] text-gray-400">{formatFileSize(file.size)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-600 hover:bg-red-50"
                onClick={() => removePendingFile(index)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {existingDocs.length > 0 && (
        <div className="space-y-1.5">
          {existingDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-gray-100"
            >
              <FileText className="w-4 h-4 text-gray-500 shrink-0" />
              <span className="text-xs font-medium text-[#1c2a3e] flex-1 truncate">
                {doc.fileName}
              </span>
              <span className="text-[10px] text-gray-400">{formatFileSize(doc.fileSize)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-blue-600 hover:bg-blue-50"
                onClick={() => handleDownload(doc)}
              >
                <Download className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-600 hover:bg-red-50"
                onClick={() => handleDeleteExisting(doc.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
