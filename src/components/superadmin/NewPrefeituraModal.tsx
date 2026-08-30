import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useSuperadmin } from '@/context/SuperadminContext'
import { generateSlug, formatCNPJ, isValidCNPJ } from '@/types/superadmin'
import { sanitizeInput } from '@/lib/sanitize'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const NewPrefeituraModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const { addPrefeitura, addGlobalUser } = useSuperadmin()
  const [name, setName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [slug, setSlug] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [adminName, setAdminName] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setCnpj('')
      setSlug('')
      setLogo(null)
      setAdminName('')
      setSlugEdited(false)
    }
  }, [open])

  useEffect(() => {
    if (!slugEdited) setSlug(generateSlug(name))
  }, [name, slugEdited])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return toast.error('Nome da Prefeitura é obrigatório.')
    if (!isValidCNPJ(cnpj))
      return toast.error('CNPJ inválido. Formato esperado: XX.XXX.XXX/XXXX-XX')
    if (!slug.trim()) return toast.error('Slug do subdomínio é obrigatório.')
    if (!adminName.trim()) return toast.error('Nome do Administrador Inicial é obrigatório.')

    const prefName = sanitizeInput(name.trim())
    const prefSlug = slug.trim()
    const cleanAdminName = sanitizeInput(adminName.trim())

    addPrefeitura({
      name: prefName,
      cnpj,
      slug: prefSlug,
      logo,
      adminName: cleanAdminName,
      cidade: '',
      estado: '',
    })
      .then(() => {
        toast.success(`Prefeitura "${prefName}" criada com sucesso!`)
        onOpenChange(false)
      })
      .catch((err: any) => {
        toast.error(err?.message || 'Erro ao criar prefeitura.')
      })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-white rounded-xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#1c2a3e]">Nova Prefeitura</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-semibold text-gray-700">Nome da Prefeitura *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: São Miguel"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-700">CNPJ *</Label>
            <Input
              value={cnpj}
              onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
              placeholder="00.000.000/0000-00"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-700">Slug do Subdomínio *</Label>
            <Input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value)
                setSlugEdited(true)
              }}
              placeholder="auto-gerado"
              className="mt-1 font-mono text-sm"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Auto-gerado a partir do nome. Editável se necessário.
            </p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-700">Logo (imagem)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setLogo(f.name)
              }}
              className="mt-1 cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-[#1c2a3e] file:text-white file:text-xs"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-700">
              Nome do Administrador Inicial *
            </Label>
            <Input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="Ex: João da Silva"
              className="mt-1"
            />
          </div>
          <DialogFooter className="pt-4 border-t flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">
              Criar Prefeitura
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
