import React, { useState } from 'react'
import { Lock, Send, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'

export function BloqueioCienciaScreen() {
  const { user, logout } = useAuth()
  const [checking, setChecking] = useState(false)

  const handleVerificarNovamente = async () => {
    if (!user?.id) return
    setChecking(true)
    try {
      const rec = await pb.collection('users').getOne(user.id)
      if (rec.status_bloqueio === 'ativo' || !rec.status_bloqueio) {
        toast.success('Ciência confirmada! Acesso restabelecido.')
        window.location.reload()
      } else {
        toast.error('O aviso ainda consta como pendente de confirmação no Telegram.')
      }
    } catch {
      toast.error('Erro ao verificar status no servidor.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-white rounded-2xl shadow-2xl border-0 overflow-hidden">
        <div className="bg-red-600 p-6 text-center text-white">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">ACESSO TEMPORARIAMENTE BLOQUEADO</h2>
          <p className="text-red-100 text-xs mt-1">Conformidade e Ciência Obrigatória de Prazos</p>
        </div>

        <CardContent className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 leading-relaxed">
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <span>⚠️</span> Atenção, {user?.name || 'Servidor'}:
            </p>
            Existe um aviso pendente de confirmação de ciência enviado pelo Bússola Jurídica.
            Confirme a leitura do aviso recebido no Telegram para liberar seu acesso.
          </div>

          <div className="space-y-2 text-xs text-gray-600">
            <p className="font-semibold text-gray-800">Como restabelecer seu acesso imediato?</p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1">
              <li>
                Abra o chat com o bot oficial de avisos no seu <strong>Telegram</strong>.
              </li>
              <li>Localize a mensagem do aviso diário de prazos pendente.</li>
              <li>
                Toque no botão <strong>"✅ CONFIRMAR LEITURA E CIÊNCIA"</strong>.
              </li>
              <li>
                Após a confirmação no chat, clique no botão <strong>"Verificar Novamente"</strong>{' '}
                abaixo.
              </li>
            </ol>
          </div>

          <div className="pt-2 space-y-2">
            <Button
              onClick={handleVerificarNovamente}
              disabled={checking}
              className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs gap-2 py-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Verificando no sistema...' : 'Já Confirmei no Telegram — Verificar'}
            </Button>

            <Button
              variant="outline"
              onClick={logout}
              className="w-full text-xs text-gray-600 gap-2 py-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair da Conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
