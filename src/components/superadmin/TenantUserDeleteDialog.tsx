import { useState } from 'react'
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
import { Loader2 } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'
import type { GlobalUser } from '@/types/superadmin'

interface Props {
  user: GlobalUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function TenantUserDeleteDialog({ user, open, onOpenChange, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    if (!user) return
    setDeleting(true)
    try {
      await pb.collection('users').delete(user.id)
      toast.success('Usuário excluído com sucesso!')
      onOpenChange(false)
      onDeleted()
    } catch (err: any) {
      toast.error(err?.response?.message || err?.message || 'Erro ao excluir usuário.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white rounded-xl shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-bold text-[#1c2a3e]">
            Confirmar Exclusão
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-gray-600">
            Tem certeza que deseja excluir o usuário{' '}
            <span className="font-semibold text-[#1c2a3e]">{user?.name || 'este usuário'}</span>?
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {deleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Confirmar Exclusão
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
