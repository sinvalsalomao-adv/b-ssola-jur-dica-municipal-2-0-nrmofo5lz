import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  UploadCloud,
  FileText,
  Eye,
  Download,
  RotateCcw,
  Archive,
  ArchiveRestore,
  History,
  Plus,
  Loader2,
  FileSpreadsheet,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  getDocumentsByProject,
  uploadDocument,
  createDocumentVersion,
  archiveDocument,
  restoreDocument,
  getDocumentVersionHistory,
  getProtectedDocumentUrl,
  validateDocumentFile,
  DOCUMENT_CATEGORIES,
} from '@/services/documents'
import { createAuditLog } from '@/services/projects'
import { Project, COLUMNS, ColumnType } from '@/types/project'
import { DocumentItem, formatFileSize } from '@/types/controle'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { sanitizeHttpError } from '@/lib/errorSanitizer'

interface ProjectDocumentsSectionProps {
  project: Project
  onHistoryUpdate?: () => void
}

export const ProjectDocumentsSection: React.FC<ProjectDocumentsSectionProps> = ({
  project,
  onHistoryUpdate,
}) => {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadCategoria, setUploadCategoria] = useState<string>('Parecer Jurídico')
  const [uploadEtapa, setUploadEtapa] = useState<ColumnType>(project.column || 'Ideação')
  const [uploadDescricao, setUploadDescricao] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Replace / New Version Modal State
  const [replaceTarget, setReplaceTarget] = useState<DocumentItem | null>(null)
  const [replaceFile, setReplaceFile] = useState<File | null>(null)
  const [replaceCategoria, setReplaceCategoria] = useState<string>('')
  const [replaceEtapa, setReplaceEtapa] = useState<ColumnType>(project.column || 'Ideação')
  const [replaceDescricao, setReplaceDescricao] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [replaceError, setReplaceError] = useState<string | null>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  // Archive Modal State
  const [archiveTarget, setArchiveTarget] = useState<DocumentItem | null>(null)
  const [archiving, setArchiving] = useState(false)

  // Restore Modal State
  const [restoreTarget, setRestoreTarget] = useState<DocumentItem | null>(null)
  const [restoring, setRestoring] = useState(false)

  // Version History Modal State
  const [historyTarget, setHistoryTarget] = useState<DocumentItem | null>(null)
  const [versionList, setVersionList] = useState<DocumentItem[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)

  // Drag and Drop state
  const [isDragging, setIsDragging] = useState(false)

  // Resolved tenant - strictly enforce project's tenant
  const tenantId = (project as any).tenantId || user?.tenantId || ''

  const loadDocuments = useCallback(async () => {
    if (!project.id) return
    setLoading(true)
    try {
      const data = await getDocumentsByProject(project.id, tenantId || undefined, showArchived)
      setDocuments(data)
    } catch (err) {
      console.error('Erro ao carregar documentos do projeto:', sanitizeHttpError(err).message)
      toast.error('Não foi possível carregar os documentos.')
    } finally {
      setLoading(false)
    }
  }, [project.id, tenantId, showArchived])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // Reset upload form
  const resetUploadModal = () => {
    setUploadFile(null)
    setUploadCategoria('Parecer Jurídico')
    setUploadEtapa(project.column || 'Ideação')
    setUploadDescricao('')
    setUploadError(null)
    setUploadSuccess(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Open Upload Dialog
  const handleOpenUpload = () => {
    resetUploadModal()
    setUploadEtapa(project.column || 'Ideação')
    setIsUploadOpen(true)
  }

  // File selection for upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null)
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const validation = validateDocumentFile(file)
    if (!validation.valid) {
      setUploadError(validation.error || 'Arquivo inválido.')
      toast.error(validation.error)
      return
    }

    setUploadFile(file)
  }

  // Submit Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) {
      setUploadError('Por favor, selecione um arquivo.')
      return
    }
    if (!tenantId) {
      setUploadError('Tenant do projeto não identificado.')
      toast.error('Erro: Tenant do projeto não identificado.')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      const created = await uploadDocument(
        uploadFile,
        project.id,
        project.title,
        tenantId,
        user?.name || 'Usuário',
        {
          userId: user?.id,
          categoria: uploadCategoria,
          etapa: uploadEtapa,
          descricao: uploadDescricao.trim(),
          versao: 1,
        },
      )

      // Registrar auditoria
      await createAuditLog({
        userName: user?.name || 'Usuário',
        actionType: 'Adicionou documento',
        description: `Adicionou o documento "${created.fileName}" (v${created.versao}, categoria: ${created.categoria}, etapa: ${created.etapa})`,
        projectTitle: project.title,
        tenantId: tenantId,
      })

      setUploadSuccess(true)
      toast.success(`Documento "${created.fileName}" adicionado com sucesso!`)
      onHistoryUpdate?.()
      await loadDocuments()

      setTimeout(() => {
        setIsUploadOpen(false)
        resetUploadModal()
      }, 800)
    } catch (err: any) {
      const sanitized = sanitizeHttpError(err)
      setUploadError(sanitized.message || getErrorMessage(err))
      toast.error(sanitized.message || 'Erro ao enviar documento.')
    } finally {
      setUploading(false)
    }
  }

  // Handle Replace (Create New Version)
  const handleOpenReplace = (doc: DocumentItem) => {
    setReplaceTarget(doc)
    setReplaceFile(null)
    setReplaceCategoria(doc.categoria || 'Parecer Jurídico')
    setReplaceEtapa((doc.etapa as ColumnType) || project.column || 'Ideação')
    setReplaceDescricao(doc.descricao || '')
    setReplaceError(null)
    if (replaceInputRef.current) replaceInputRef.current.value = ''
  }

  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replaceTarget || !replaceFile) {
      setReplaceError('Por favor, selecione o arquivo substituto.')
      return
    }
    if (!tenantId) {
      setReplaceError('Tenant do projeto não identificado.')
      return
    }

    setReplacing(true)
    setReplaceError(null)

    try {
      const newVersion = await createDocumentVersion(
        replaceFile,
        replaceTarget,
        tenantId,
        user?.name || 'Usuário',
        {
          userId: user?.id,
          categoria: replaceCategoria,
          etapa: replaceEtapa,
          descricao: replaceDescricao.trim(),
        },
      )

      // Registrar auditoria
      await createAuditLog({
        userName: user?.name || 'Usuário',
        actionType: 'Nova versão documento',
        description: `Criou nova versão v${newVersion.versao} para o documento "${newVersion.fileName}"`,
        projectTitle: project.title,
        tenantId: tenantId,
      })

      toast.success(`Nova versão v${newVersion.versao} criada com sucesso!`)
      onHistoryUpdate?.()
      setReplaceTarget(null)
      await loadDocuments()
    } catch (err: any) {
      const sanitized = sanitizeHttpError(err)
      setReplaceError(sanitized.message || getErrorMessage(err))
      toast.error(sanitized.message || 'Erro ao substituir documento.')
    } finally {
      setReplacing(false)
    }
  }

  // Handle Archive
  const handleConfirmArchive = async () => {
    if (!archiveTarget) return
    setArchiving(true)
    try {
      await archiveDocument(archiveTarget.id)
      await createAuditLog({
        userName: user?.name || 'Usuário',
        actionType: 'Arquivou documento',
        description: `Arquivou o documento "${archiveTarget.fileName}" (v${archiveTarget.versao})`,
        projectTitle: project.title,
        tenantId: tenantId,
      })
      toast.success(`Documento "${archiveTarget.fileName}" arquivado.`)
      setArchiveTarget(null)
      onHistoryUpdate?.()
      await loadDocuments()
    } catch (err: any) {
      toast.error(getErrorMessage(err) || 'Erro ao arquivar documento.')
    } finally {
      setArchiving(false)
    }
  }

  // Handle Restore
  const handleConfirmRestore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    try {
      await restoreDocument(restoreTarget.id)
      await createAuditLog({
        userName: user?.name || 'Usuário',
        actionType: 'Restaurou documento',
        description: `Restaurou o documento arquivado "${restoreTarget.fileName}" (v${restoreTarget.versao})`,
        projectTitle: project.title,
        tenantId: tenantId,
      })
      toast.success(`Documento "${restoreTarget.fileName}" restaurado!`)
      setRestoreTarget(null)
      onHistoryUpdate?.()
      await loadDocuments()
    } catch (err: any) {
      toast.error(getErrorMessage(err) || 'Erro ao restaurar documento.')
    } finally {
      setRestoring(false)
    }
  }

  // Handle View Document (Protected temporary URL)
  const handleView = async (doc: DocumentItem) => {
    try {
      const url = await getProtectedDocumentUrl(
        { id: doc.id, file: doc.file, url: doc.pdfUrl },
        undefined,
        false,
      )
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
        // Registrar log de auditoria
        createAuditLog({
          userName: user?.name || 'Usuário',
          actionType: 'Visualizou documento',
          description: `Visualizou o documento "${doc.fileName}" (v${doc.versao})`,
          projectTitle: project.title,
          tenantId: tenantId,
        }).catch(() => {})
      } else {
        toast.error('URL do arquivo não disponível.')
      }
    } catch (err) {
      toast.error('Erro ao abrir documento.')
    }
  }

  // Handle Download Document (Protected temporary URL)
  const handleDownload = async (doc: DocumentItem) => {
    try {
      const url = await getProtectedDocumentUrl(
        { id: doc.id, file: doc.file, url: doc.pdfUrl },
        undefined,
        true,
      )
      if (url) {
        const link = document.createElement('a')
        link.href = url
        link.download = doc.fileName || 'documento'
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // Registrar log de auditoria
        createAuditLog({
          userName: user?.name || 'Usuário',
          actionType: 'Baixou documento',
          description: `Baixou o documento "${doc.fileName}" (v${doc.versao})`,
          projectTitle: project.title,
          tenantId: tenantId,
        }).catch(() => {})
      } else {
        toast.error('Arquivo para download não disponível.')
      }
    } catch (err) {
      toast.error('Erro ao baixar documento.')
    }
  }

  // Load Version History
  const handleOpenVersions = async (doc: DocumentItem) => {
    setHistoryTarget(doc)
    setLoadingVersions(true)
    try {
      const rootId = doc.parentDocumentId || doc.id
      const history = await getDocumentVersionHistory(rootId, tenantId || undefined)
      setVersionList(history)
    } catch {
      setVersionList([doc])
    } finally {
      setLoadingVersions(false)
    }
  }

  // Helpers for file icon
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    if (ext === 'pdf') return <FileText className="w-5 h-5 text-red-500 shrink-0" />
    if (['xls', 'xlsx'].includes(ext))
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
    if (['png', 'jpg', 'jpeg'].includes(ext))
      return <ImageIcon className="w-5 h-5 text-blue-500 shrink-0" />
    return <FileText className="w-5 h-5 text-blue-600 shrink-0" />
  }

  const formatDocDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
  }

  return (
    <div className="space-y-4">
      {/* Header com Ação e Toggle de Arquivados */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-gray-100">
        <Button
          type="button"
          onClick={handleOpenUpload}
          className="bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs gap-1.5 h-8 shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar documento
        </Button>

        <div className="flex items-center gap-2">
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
            className="data-[state=checked]:bg-slate-600 scale-75"
          />
          <Label
            htmlFor="show-archived"
            className="text-xs text-gray-600 cursor-pointer font-medium select-none"
          >
            Mostrar arquivados
          </Label>
        </div>
      </div>

      {/* Drag & Drop Quick Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0]
            const val = validateDocumentFile(file)
            if (val.valid) {
              setUploadFile(file)
              setUploadError(null)
              setUploadEtapa(project.column || 'Ideação')
              setIsUploadOpen(true)
            } else {
              toast.error(val.error)
            }
          }
        }}
        onClick={handleOpenUpload}
        className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-[#3b82f6] bg-blue-50/70'
            : 'border-gray-200 hover:border-gray-300 bg-slate-50/50'
        }`}
      >
        <UploadCloud className="w-5 h-5 text-gray-400 mx-auto mb-1" />
        <p className="text-xs font-medium text-gray-600">
          Arraste ou clique para adicionar arquivos
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          PDF, DOC, DOCX, XLS, XLSX, PNG, JPG (máx. 20 MB)
        </p>
      </div>

      {/* Lista de Documentos */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-10 px-4 bg-slate-50/60 rounded-lg border border-dashed border-gray-200">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <h4 className="text-xs font-semibold text-gray-700">Nenhum documento anexado</h4>
          <p className="text-[11px] text-gray-500 mt-1 max-w-xs mx-auto">
            {showArchived
              ? 'Nenhum documento ativo ou arquivado neste projeto.'
              : 'Clique no botão acima para adicionar peças jurídicas, pareceres, editais ou planilhas.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
          {documents.map((doc) => {
            const isArchived = !!doc.arquivado
            return (
              <div
                key={doc.id}
                className={`p-3 rounded-lg border text-xs transition-all ${
                  isArchived
                    ? 'bg-gray-100/70 border-gray-200 text-gray-500 opacity-80'
                    : 'bg-white border-slate-200/90 hover:border-blue-200 shadow-xs'
                }`}
              >
                {/* Top Row: Icon + Name + Version Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    {getFileIcon(doc.fileName)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`font-semibold truncate max-w-[210px] sm:max-w-[260px] ${
                            isArchived ? 'line-through text-gray-600' : 'text-[#1c2a3e]'
                          }`}
                          title={doc.fileName}
                        >
                          {doc.fileName}
                        </span>
                        <Badge
                          variant="secondary"
                          className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold px-1.5 py-0 h-4"
                        >
                          v{doc.versao || 1}
                        </Badge>
                        {isArchived && (
                          <Badge
                            variant="outline"
                            className="bg-gray-200 text-gray-700 text-[10px] px-1.5 py-0 h-4"
                          >
                            Arquivado
                          </Badge>
                        )}
                      </div>

                      {/* Tags: Categoria + Etapa */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {doc.categoria || 'Outro'}
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200/60">
                          {doc.etapa || 'Ideação'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {formatFileSize(doc.fileSize)}
                        </span>
                      </div>

                      {/* Descrição Opcional */}
                      {doc.descricao && (
                        <p className="text-[11px] text-gray-600 mt-1.5 bg-slate-50/80 p-1.5 rounded border border-gray-100 italic">
                          {doc.descricao}
                        </p>
                      )}

                      {/* Metadados: Usuário e Data */}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                        <span>
                          Enviado por:{' '}
                          <strong className="text-gray-600 font-medium">{doc.uploader}</strong>
                        </span>
                        <span>•</span>
                        <span>{formatDocDate(doc.uploadDate)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="flex items-center justify-between border-t border-gray-100 mt-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => handleOpenVersions(doc)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 hover:underline"
                  >
                    <Layers className="w-3 h-3" />
                    Versões
                  </button>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleView(doc)}
                      className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50 gap-1"
                      title="Visualizar documento"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Ver</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      className="h-7 px-2 text-xs text-slate-700 hover:bg-slate-100 gap-1"
                      title="Baixar documento"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Baixar</span>
                    </Button>

                    {!isArchived ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenReplace(doc)}
                          className="h-7 px-2 text-xs text-violet-700 hover:bg-violet-50 gap-1"
                          title="Substituir e criar nova versão"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Substituir</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setArchiveTarget(doc)}
                          className="h-7 px-2 text-xs text-amber-700 hover:bg-amber-50 gap-1"
                          title="Arquivar documento"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Arquivar</span>
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRestoreTarget(doc)}
                        className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-50 gap-1"
                        title="Restaurar documento"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5" />
                        <span>Restaurar</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* DIALOG DE UPLOAD */}
      <Dialog
        open={isUploadOpen}
        onOpenChange={(open) => {
          if (!uploading) setIsUploadOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-[480px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1c2a3e] flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-blue-600" />
              Adicionar Documento ao Projeto
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Projeto: <strong>{project.title}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadSubmit} className="space-y-3.5">
            {/* Mensagem de Erro com Sanitização */}
            {uploadError && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Erro no upload</p>
                  <p className="text-[11px] mt-0.5">{uploadError}</p>
                </div>
              </div>
            )}

            {/* Mensagem de Sucesso */}
            {uploadSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Documento enviado com sucesso!</span>
              </div>
            )}

            {/* Seleção do Arquivo */}
            <div>
              <Label className="text-xs font-semibold text-gray-700">Arquivo *</Label>
              <div className="mt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="modal-doc-upload"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="modal-doc-upload"
                  className={`border-2 border-dashed rounded-lg p-3.5 text-center cursor-pointer block transition-colors ${
                    uploadFile
                      ? 'border-blue-400 bg-blue-50/40'
                      : 'border-gray-300 hover:border-gray-400 bg-slate-50/50'
                  }`}
                >
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-blue-800 font-medium">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="truncate max-w-[280px]">{uploadFile.name}</span>
                      <span className="text-[10px] text-gray-500">
                        ({formatFileSize(uploadFile.size)})
                      </span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs font-medium text-gray-700">
                        Clique para selecionar o arquivo
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        PDF, DOC, DOCX, XLS, XLSX, PNG, JPG (máx. 20 MB)
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Categoria e Etapa */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Categoria Documental *
                </Label>
                <Select value={uploadCategoria} onValueChange={setUploadCategoria}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-xs">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Etapa do Projeto *</Label>
                <Select value={uploadEtapa} onValueChange={(v) => setUploadEtapa(v as ColumnType)}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map((col) => (
                      <SelectItem key={col} value={col} className="text-xs">
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Descrição Opcional */}
            <div>
              <Label className="text-xs font-semibold text-gray-700">Descrição (Opcional)</Label>
              <Textarea
                value={uploadDescricao}
                onChange={(e) => setUploadDescricao(e.target.value)}
                placeholder="Observações sobre este documento..."
                className="mt-1 text-xs min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-2 border-t border-gray-100 flex-row justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsUploadOpen(false)}
                disabled={uploading}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={uploading || !uploadFile}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs gap-1.5"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" /> Enviar Documento
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE SUBSTITUIÇÃO / NOVA VERSÃO */}
      <Dialog
        open={!!replaceTarget}
        onOpenChange={(open) => {
          if (!replacing && !open) setReplaceTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-[480px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1c2a3e] flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-violet-600" />
              Substituir Documento (Criar Nova Versão)
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Versão atual: <strong>v{replaceTarget?.versao || 1}</strong> • Arquivo:{' '}
              {replaceTarget?.fileName}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReplaceSubmit} className="space-y-3.5">
            {replaceError && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p>{replaceError}</p>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Novo Arquivo (Substituto) *
              </Label>
              <div className="mt-1">
                <input
                  ref={replaceInputRef}
                  type="file"
                  id="modal-doc-replace"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      const val = validateDocumentFile(f)
                      if (!val.valid) {
                        setReplaceError(val.error || 'Arquivo inválido.')
                        return
                      }
                      setReplaceFile(f)
                      setReplaceError(null)
                    }
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="modal-doc-replace"
                  className={`border-2 border-dashed rounded-lg p-3.5 text-center cursor-pointer block transition-colors ${
                    replaceFile
                      ? 'border-violet-400 bg-violet-50/40'
                      : 'border-gray-300 hover:border-gray-400 bg-slate-50/50'
                  }`}
                >
                  {replaceFile ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-violet-900 font-medium">
                      <FileText className="w-4 h-4 text-violet-600" />
                      <span className="truncate max-w-[280px]">{replaceFile.name}</span>
                      <span className="text-[10px] text-gray-500">
                        ({formatFileSize(replaceFile.size)})
                      </span>
                    </div>
                  ) : (
                    <>
                      <RotateCcw className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs font-medium text-gray-700">
                        Clique para selecionar a nova versão
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        A versão anterior (v{replaceTarget?.versao || 1}) será preservada
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Categoria</Label>
                <Select value={replaceCategoria} onValueChange={setReplaceCategoria}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-xs">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Etapa</Label>
                <Select
                  value={replaceEtapa}
                  onValueChange={(v) => setReplaceEtapa(v as ColumnType)}
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map((col) => (
                      <SelectItem key={col} value={col} className="text-xs">
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Nota da Nova Versão</Label>
              <Textarea
                value={replaceDescricao}
                onChange={(e) => setReplaceDescricao(e.target.value)}
                placeholder="Motivo da alteração ou histórico da versão..."
                className="mt-1 text-xs min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-2 border-t border-gray-100 flex-row justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReplaceTarget(null)}
                disabled={replacing}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={replacing || !replaceFile}
                className="bg-violet-600 hover:bg-violet-700 text-white text-xs gap-1.5"
              >
                {replacing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Criando versão...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" /> Salvar Versão v
                    {(replaceTarget?.versao || 1) + 1}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE HISTÓRICO DE VERSÕES */}
      <Dialog
        open={!!historyTarget}
        onOpenChange={(open) => {
          if (!open) setHistoryTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-[500px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1c2a3e] flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              Histórico de Versões do Documento
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              {historyTarget?.fileName}
            </DialogDescription>
          </DialogHeader>

          {loadingVersions ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {versionList.map((ver) => (
                <div
                  key={ver.id}
                  className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600 text-white text-[10px] font-bold">
                        v{ver.versao || 1}
                      </Badge>
                      <span className="font-medium text-slate-800">{ver.fileName}</span>
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {formatDocDate(ver.uploadDate)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                    <span>
                      Enviado por: {ver.uploader} ({formatFileSize(ver.fileSize)})
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(ver)}
                        className="h-6 px-2 text-[11px] text-blue-600 hover:bg-blue-100/50"
                      >
                        <Eye className="w-3 h-3 mr-1" /> Ver
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(ver)}
                        className="h-6 px-2 text-[11px] text-slate-700 hover:bg-slate-200/60"
                      >
                        <Download className="w-3 h-3 mr-1" /> Baixar
                      </Button>
                    </div>
                  </div>

                  {ver.descricao && (
                    <p className="text-[10px] text-gray-600 bg-white/80 p-1 rounded border border-gray-100 mt-1 italic">
                      {ver.descricao}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-gray-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryTarget(null)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE ARQUIVAMENTO */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-[#1c2a3e]">
              Arquivar documento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600">
              Tem certeza que deseja arquivar <strong>{archiveTarget?.fileName}</strong> (v
              {archiveTarget?.versao || 1})? O documento ficará oculto da lista principal, mas
              poderá ser consultado e restaurado a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={archiving}
              onClick={handleConfirmArchive}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
            >
              {archiving ? 'Arquivando...' : 'Sim, arquivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CONFIRMAÇÃO DE RESTAURAÇÃO */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-[#1c2a3e]">
              Restaurar documento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600">
              Deseja restaurar o documento <strong>{restoreTarget?.fileName}</strong> para a
              listagem ativa do projeto?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={restoring}
              onClick={handleConfirmRestore}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              {restoring ? 'Restaurando...' : 'Restaurar documento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
