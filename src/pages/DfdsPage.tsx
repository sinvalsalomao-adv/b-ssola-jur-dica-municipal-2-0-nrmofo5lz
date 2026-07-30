import { useState, useEffect, useCallback } from 'react'
import { FileText, ArrowLeft, Plus, Clock, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { getRecentDfds } from '@/services/dfds'
import type { DfdRecord } from '@/types/dfd'

export default function DfdsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [dfds, setDfds] = useState<DfdRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadDfds = useCallback(async () => {
    if (!user?.tenantId) return
    try {
      const data = await getRecentDfds(user.tenantId, 50)
      setDfds(data)
    } catch {
      /* ignore */
    }
  }, [user?.tenantId])

  useEffect(() => {
    loadDfds().finally(() => setLoading(false))
  }, [loadDfds])

  useRealtime(
    'dfds',
    () => {
      loadDfds()
    },
    !!user?.tenantId,
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-[#1c2a3e]">Diagramas de Fluxo de Dados (DFDs)</h2>
          <p className="text-sm text-gray-500">
            Documentos de Formalização de Demanda — Lei nº 14.133/2021
          </p>
        </div>
        <Button
          onClick={() => navigate('/novo-dfd')}
          className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2"
        >
          <Plus className="w-4 h-4" /> Novo DFD
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : dfds.length === 0 ? (
        <Card className="bg-white border-0 shadow-subtle p-12 text-center">
          <CardContent className="space-y-4 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#3b82f6] flex items-center justify-center">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#1c2a3e]">Nenhum DFD criado</h3>
            <p className="text-sm text-gray-500 max-w-md">
              Crie seu primeiro Documento de Formalização de Demanda para começar.
            </p>
            <Button
              onClick={() => navigate('/novo-dfd')}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2"
            >
              <Plus className="w-4 h-4" /> Criar Novo DFD
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white border-0 shadow-subtle">
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-base font-bold text-[#1c2a3e] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#3b82f6]" />
              DFDs Cadastrados ({dfds.length})
            </h3>
          </div>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {dfds.map((dfd) => (
                <div
                  key={dfd.id}
                  onClick={() => navigate(`/dfds/${dfd.id}`)}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${dfd.status === 'Finalizado' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}
                    >
                      {dfd.status === 'Finalizado' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1c2a3e] truncate">{dfd.title}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(dfd.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={`text-xs ${dfd.status === 'Finalizado' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}
                  >
                    {dfd.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
