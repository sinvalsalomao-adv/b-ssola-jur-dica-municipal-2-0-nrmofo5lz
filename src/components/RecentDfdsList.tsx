import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Clock, CheckCircle2, Pencil, Loader2 } from 'lucide-react'
import { DfdRecord } from '@/types/dfd'
import { getRecentDfds } from '@/services/dfds'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { Skeleton } from '@/components/ui/skeleton'

interface RecentDfdsListProps {
  dfds?: DfdRecord[]
  onEdit?: (dfd: DfdRecord) => void
  loading?: boolean
}

export const RecentDfdsList = ({
  dfds: propDfds,
  onEdit,
  loading: propLoading,
}: RecentDfdsListProps) => {
  const { user } = useAuth()
  const tenantId = user?.tenant || ''
  const isControlled = propDfds !== undefined

  const [internalDfds, setInternalDfds] = useState<DfdRecord[]>([])
  const [internalLoading, setInternalLoading] = useState(!isControlled)

  const loadDfds = useCallback(async () => {
    if (isControlled || !tenantId) return
    try {
      setInternalLoading(true)
      const data = await getRecentDfds(tenantId)
      setInternalDfds(data)
    } catch {
      setInternalDfds([])
    } finally {
      setInternalLoading(false)
    }
  }, [isControlled, tenantId])

  useEffect(() => {
    if (isControlled) return
    loadDfds()
  }, [loadDfds, isControlled])

  useRealtime('dfds', () => {
    if (!isControlled) loadDfds()
  })

  const dfds = isControlled ? (propDfds ?? []) : internalDfds
  const loading = isControlled ? (propLoading ?? false) : internalLoading

  return (
    <Card className="bg-white border-0 shadow-subtle">
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-base font-bold text-[#1c2a3e] flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#3b82f6]" />
          DFDs Recentes
        </h3>
      </div>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-2.5 w-1/3" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : !dfds || dfds.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Nenhum DFD encontrado. Crie seu primeiro documento acima.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {dfds.map((dfd) => (
              <div
                key={dfd.id}
                onClick={() => onEdit?.(dfd)}
                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      dfd.status === 'Finalizado'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}
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
                <div className="flex items-center gap-2">
                  <Badge
                    className={`text-xs font-medium ${
                      dfd.status === 'Finalizado'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-amber-100 text-amber-700 border-amber-200'
                    }`}
                  >
                    {dfd.status}
                  </Badge>
                  <Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
