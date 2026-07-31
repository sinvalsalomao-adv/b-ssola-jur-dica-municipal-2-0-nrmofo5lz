import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, AlertCircle, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'

const MAX_SIZE = 2 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']
const ACCEPTED_EXTENSIONS = '.png,.jpg,.jpeg,.svg'

interface Props {
  tenantId: string
  currentLogo: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onLogoUpdated: (logoUrl: string | null) => void
}

export function LogoUploadDialog({
  tenantId,
  currentLogo,
  open,
  onOpenChange,
  onLogoUpdated,
}: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(currentLogo)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSelectedFile(null)
      setPreview(currentLogo)
      setError('')
    }
  }, [open, currentLogo])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato inválido. Apenas PNG, JPG e SVG são aceitos.')
      setSelectedFile(null)
      return
    }

    if (file.size > MAX_SIZE) {
      setError('O arquivo excede o limite de 2 MB.')
      setSelectedFile(null)
      return
    }

    setError('')
    setSelectedFile(file)

    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview)
    }
    setPreview(URL.createObjectURL(file))
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('logo', selectedFile)
      await pb.collection('tenants').update(tenantId, formData)

      const updated = await pb.collection('tenants').getOne(tenantId)
      const logoFilename = (updated as any)?.logo || ''
      const base = pb.baseUrl.replace(/\/$/, '')
      const logoUrl = logoFilename ? `${base}/api/files/tenants/${tenantId}/${logoFilename}` : null

      onLogoUpdated(logoUrl)
      toast.success('Brasão atualizado com sucesso!')
      onOpenChange(false)
    } catch (err) {
      toast.error('Erro ao fazer upload do brasão. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  const handleOpenChange = (v: boolean) => {
    if (!v && preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview)
    }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1c2a3e]">
            Brasão da Organização
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex flex-col items-center gap-3">
            <div className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-slate-50">
              {preview ? (
                <img
                  src={preview}
                  alt="Pré-visualização"
                  className="w-full h-full object-contain"
                />
              ) : (
                <ImageIcon className="w-10 h-10 text-gray-300" />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-2" />
              {selectedFile ? 'Trocar arquivo' : 'Selecionar arquivo'}
            </Button>
            {selectedFile && (
              <p className="text-xs text-gray-500">
                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            Formatos aceitos: PNG, JPG, SVG. Tamanho máximo: 2 MB.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Salvar Brasão'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
