import React from 'react'
import { DocumentItem } from '@/types/controle'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface PdfPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: DocumentItem | null
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  open,
  onOpenChange,
  document,
}) => {
  return (
    <Dialog open={open && !!document} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
        {document && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#1c2a3e]">
                {document.fileName}
              </DialogTitle>
            </DialogHeader>
            <iframe
              src={document.pdfUrl}
              className="w-full flex-1 rounded-lg border border-gray-200"
              title={document.fileName}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
