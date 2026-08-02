import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldAlert, PlayCircle, Loader2, Lock } from 'lucide-react'
import { useMandatoryNotifications } from '@/hooks/use-mandatory-notifications'
import { extractYouTubeId } from '@/lib/youtube'

export function MandatoryNotificationModal() {
  const { current, confirming, confirm, loading } = useMandatoryNotifications()
  const [videoStarted, setVideoStarted] = useState(false)

  if (loading || !current) return null

  const isVideo = current.modoConfirmacao === 'video'
  const youtubeId = isVideo ? extractYouTubeId(current.videoUrl || '') : ''
  const isYouTube = !!youtubeId
  const isDirectVideo = isVideo && !isYouTube && !!current.videoUrl
  const canConfirm = !isVideo || videoStarted

  const handleConfirm = async () => {
    await confirm(current.modoConfirmacao || 'leitura')
    setVideoStarted(false)
  }

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[560px] bg-white rounded-xl shadow-xl [&>.absolute]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-[#1c2a3e]">
                Comunicado Obrigatório
              </DialogTitle>
              <p className="text-xs text-gray-500">Confirmação necessária para continuar</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base text-[#1c2a3e]">{current.projectTitle}</h3>
            <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px]">Obrigatório</Badge>
          </div>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{current.mensagem}</p>

          {isVideo && (
            <div>
              {isYouTube && (
                <div className="relative">
                  {!videoStarted ? (
                    <button
                      onClick={() => setVideoStarted(true)}
                      className="w-full aspect-video flex items-center justify-center bg-gray-900 rounded-lg"
                    >
                      <PlayCircle className="w-16 h-16 text-white" />
                    </button>
                  ) : (
                    <iframe
                      src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                      className="w-full aspect-video rounded-lg"
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                  )}
                </div>
              )}
              {isDirectVideo && (
                <video
                  src={current.videoUrl || undefined}
                  controls
                  className="w-full aspect-video rounded-lg bg-black"
                  onPlay={() => setVideoStarted(true)}
                />
              )}
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Assista o vídeo para liberar o botão de confirmação
              </p>
            </div>
          )}
        </div>

        <div className="pt-3 border-t flex flex-col gap-2">
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || confirming}
            className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white"
          >
            {confirming && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {isVideo ? 'Confirmar e acessar sistema' : 'Confirmar leitura'}
          </Button>
          {!canConfirm && (
            <p className="text-xs text-center text-gray-400">Inicie o vídeo para continuar</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
