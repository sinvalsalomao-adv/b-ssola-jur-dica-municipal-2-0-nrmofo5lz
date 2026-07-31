import React from 'react'
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
import { GlobalUser } from '@/types/superadmin'

interface Props {
  user: GlobalUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}

export const DeleteUserDialog: React.FC<Props> = ({ user, open, onOpenChange, onConfirm }) => {
  const [deleting, setDeleting] = React.useState(false)

  const handleConfirm = async () => {
    setDeleting(true)
    try {
      await onConfirm()
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
            <span className="font-semibold text-[#1c2a3e]">{user?.name}</span>? Esta ação não pode
            ser desfeita.
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
