import React, { useState, useRef } from 'react'
import { FileText, Eye, Trash2, UploadCloud } from 'lucide-react'
import { formatDate } from '@/lib/dateUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
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
import { DocumentItem, formatFileSize } from '@/types/controle'
import { MOCK_PDF_URL } from '@/data/mockControle'
import { PdfPreviewModal } from '@/components/controle/PdfPreviewModal'
import { toast } from 'sonner'

interface DocumentosTabProps {
  documents: DocumentItem[]
  onAddDocument: (doc: DocumentItem) => void
  onDeleteDocument: (id: string) => void
}

export const DocumentosTab: React.FC<DocumentosTabProps> = ({
  documents,
  onAddDocument,
  onDeleteDocument,
}) => {
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são permitidos.')
      return
    }
    onAddDocument({
      id: `doc-${Date.now()}`,
      fileName: file.name,
      fileSize: file.size || 102400,
      projectTitle: 'Projeto sem vínculo',
      uploadDate: new Date().toISOString().split('T')[0],
      uploader: 'Dr. Silval Salomão',
      pdfUrl: MOCK_PDF_URL,
    })
    toast.success('Documento adicionado com sucesso!')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    Array.from(e.dataTransfer.files).forEach(handleFile)
  }

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(handleFile)
    e.target.value = ''
  }

  const confirmDelete = () => {
    if (deleteTarget) {
      onDeleteDocument(deleteTarget.id)
      toast.success('Documento excluído.')
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-[#3b82f6] bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-600">
          Arraste arquivos PDF aqui ou clique para selecionar
        </p>
        <p className="text-xs text-gray-400 mt-1">Apenas arquivos .pdf</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={handleSelect}
        />
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Arquivo</TableHead>
                <TableHead className="text-xs">Tamanho</TableHead>
                <TableHead className="text-xs">Projeto</TableHead>
                <TableHead className="text-xs">Upload</TableHead>
                <TableHead className="text-xs">Enviado por</TableHead>
                <TableHead className="text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-red-500 shrink-0" />
                      <span className="text-xs font-medium text-[#1c2a3e] truncate max-w-[180px]">
                        {doc.fileName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {formatFileSize(doc.fileSize)}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600 truncate max-w-[150px]">
                    {doc.projectTitle}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {formatDate(doc.uploadDate)}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">{doc.uploader}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                        onClick={() => {
                          setPreviewDoc(doc)
                          setPreviewOpen(true)
                        }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteTarget(doc)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PdfPreviewModal open={previewOpen} onOpenChange={setPreviewOpen} document={previewDoc} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-[#1c2a3e]">
              Excluir documento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Tem certeza que deseja excluir <strong>{deleteTarget?.fileName}</strong>? Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white text-xs"
              onClick={confirmDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
