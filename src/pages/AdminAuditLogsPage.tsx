import { useState, useEffect, useCallback } from 'react'
import { History, ChevronLeft, ChevronRight, Search, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { getAuditLogsPaginated } from '@/services/admin-notifications'

const PER_PAGE = 15

const ACTION_CONFIG: Record<string, { color: string; bg: string }> = {
  'Criou card': { color: 'text-emerald-600', bg: 'bg-emerald-50' },
  'Moveu card': { color: 'text-amber-600', bg: 'bg-amber-50' },
  'Editou card': { color: 'text-violet-600', bg: 'bg-violet-50' },
}

export default function AdminAuditLogsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!user?.tenantId) return
    setLoading(true)
    try {
      const result = await getAuditLogsPaginated(user.tenantId, page, PER_PAGE, search || undefined)
      setItems(result.items)
      setTotalPages(result.totalPages)
      setTotalItems(result.totalItems)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [user?.tenantId, page, search])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [search])

  useRealtime(
    'audit_logs',
    () => {
      load()
    },
    !!user?.tenantId,
  )

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <Lock className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-[#1c2a3e]">Acesso Negado</h2>
        <p className="text-sm text-gray-500 text-center max-w-md">
          Apenas administradores podem acessar os logs de auditoria.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#1c2a3e] flex items-center justify-center">
          <History className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1c2a3e]">Logs de Auditoria</h2>
          <p className="text-xs text-gray-500">{totalItems} registro(s) encontrado(s)</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por usuário ou ação..."
          className="pl-9 h-9 text-xs"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="bg-white border-0 shadow-subtle">
          <CardContent className="p-12 text-center text-sm text-gray-400">
            Nenhum registro de auditoria encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((entry) => {
            const config = ACTION_CONFIG[entry.actionType] || ACTION_CONFIG['Editou card']
            const dt = entry.created ? new Date(entry.created) : new Date()
            return (
              <Card key={entry.id} className="bg-white border-0 shadow-subtle">
                <CardContent className="p-3 flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.bg}`}
                  >
                    <History className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#1c2a3e]">{entry.userName}</span>
                      <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                        {entry.actionType}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{entry.description}</p>
                    {entry.projectTitle && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{entry.projectTitle}</p>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400 shrink-0 text-right">
                    <p>{dt.toLocaleDateString('pt-BR')}</p>
                    <p>
                      {dt.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-gray-500">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
