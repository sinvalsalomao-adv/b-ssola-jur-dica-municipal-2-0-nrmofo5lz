import { useState, useEffect, useCallback } from 'react'
import { History, ChevronLeft, ChevronRight, Search, Lock, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { getAuditLogsPaginated } from '@/services/admin-notifications'
import { TenantRequiredNotice } from '@/components/TenantRequiredNotice'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState } from '@/components/common/StateDisplay'
import { FilterBar } from '@/components/common/FilterBar'

const PER_PAGE = 15

const ACTION_CONFIG: Record<string, { color: string; bg: string }> = {
  'Criou card': { color: 'text-emerald-600', bg: 'bg-emerald-50' },
  'Moveu card': { color: 'text-amber-600', bg: 'bg-amber-50' },
  'Editou card': { color: 'text-violet-600', bg: 'bg-violet-50' },
  'Adicionou documento': { color: 'text-blue-600', bg: 'bg-blue-50' },
  'Nova versão documento': { color: 'text-violet-600', bg: 'bg-violet-50' },
  'Arquivou documento': { color: 'text-amber-600', bg: 'bg-amber-50' },
  'Restaurou documento': { color: 'text-emerald-600', bg: 'bg-emerald-50' },
  'Visualizou documento': { color: 'text-sky-600', bg: 'bg-sky-50' },
  'Baixou documento': { color: 'text-slate-600', bg: 'bg-slate-50' },
  'Adicionou participante': { color: 'text-cyan-600', bg: 'bg-cyan-50' },
  'Removeu participante': { color: 'text-rose-600', bg: 'bg-rose-50' },
  'Criou comentário': { color: 'text-indigo-600', bg: 'bg-indigo-50' },
  'Editou comentário': { color: 'text-violet-600', bg: 'bg-violet-50' },
  'Removeu comentário': { color: 'text-rose-600', bg: 'bg-rose-50' },
  'Criou resposta': { color: 'text-indigo-600', bg: 'bg-indigo-50' },
  'Editou resposta': { color: 'text-violet-600', bg: 'bg-violet-50' },
  'Removeu resposta': { color: 'text-rose-600', bg: 'bg-rose-50' },
  'Mencionou usuário': { color: 'text-blue-600', bg: 'bg-blue-50' },
}

export default function AdminAuditLogsPage() {
  const { user } = useAuth()
  const isSuperadmin = user?.role === 'superadmin'

  const [availableTenants, setAvailableTenants] = useState<{ id: string; name: string }[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    user?.tenantId || (isSuperadmin ? 'all' : ''),
  )

  const [items, setItems] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (isSuperadmin) {
      import('@/services/tenants').then(({ getTenants }) => {
        getTenants()
          .then(setAvailableTenants)
          .catch(() => {})
      })
    }
  }, [isSuperadmin])

  const effectiveTenantId = isSuperadmin ? selectedTenantId : user?.tenantId || ''

  const load = useCallback(async () => {
    if (!effectiveTenantId && !isSuperadmin) return
    setLoading(true)
    try {
      const result = await getAuditLogsPaginated(
        effectiveTenantId,
        page,
        PER_PAGE,
        search || undefined,
      )
      setItems(result.items)
      setTotalPages(result.totalPages)
      setTotalItems(result.totalItems)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [effectiveTenantId, isSuperadmin, page, search])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [search, selectedTenantId])

  useRealtime(
    'audit_logs',
    () => {
      load()
    },
    !!effectiveTenantId || isSuperadmin,
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

  if (user?.role === 'superadmin' && !user?.tenantId) {
    return (
      <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
        <TenantRequiredNotice
          title="Selecione uma prefeitura para consultar logs de auditoria"
          description="Os registros de alterações em projetos, documentos e permissões são isolados por prefeitura. Como superadministrador na visão global, selecione um município para inspecionar a trilha de auditoria."
        />
      </div>
    )
  }

  const hasActiveFilters = !!search || (isSuperadmin && selectedTenantId !== 'all')

  const handleClearFilters = () => {
    setSearch('')
    if (isSuperadmin) setSelectedTenantId('all')
    setPage(1)
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl mx-auto">
      <PageHeader
        title="Logs de Auditoria"
        description="Histórico rastreável e imutável de ações realizadas em projetos, documentos e permissões."
        icon={History}
      />

      <FilterBar
        search={search}
        onSearchChange={(val) => {
          setSearch(val)
          setPage(1)
        }}
        searchPlaceholder="Buscar por usuário, ação ou título de projeto..."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        totalCount={totalItems}
        countLabel="registros de auditoria"
      >
        {isSuperadmin && (
          <div className="flex items-center gap-2">
            <label htmlFor="select-pref-audit" className="text-xs font-semibold text-slate-700 sr-only">
              Filtrar por prefeitura
            </label>
            <select
              id="select-pref-audit"
              aria-label="Filtrar por prefeitura"
              value={selectedTenantId}
              onChange={(e) => {
                setSelectedTenantId(e.target.value)
                setPage(1)
              }}
              className="h-9 rounded-md border border-input bg-white px-3 py-1 text-xs shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              <option value="all">Todas as prefeituras</option>
              {availableTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </FilterBar>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<History className="w-6 h-6 text-slate-400" aria-hidden="true" />}
          title="Nenhum registro de auditoria encontrado"
          description={
            hasActiveFilters
              ? 'Nenhuma alteração corresponde aos filtros informados. Tente limpar os termos de busca.'
              : 'Não há ações registradas para o período selecionado.'
          }
          action={
            hasActiveFilters
              ? {
                  label: 'Limpar filtros',
                  onClick: handleClearFilters,
                  icon: <X className="w-3.5 h-3.5" aria-hidden="true" />,
                }
              : undefined
          }
        />
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
            disabled={page <= 1 || loading}
            onClick={() => setPage(page - 1)}
            aria-label="Ir para página anterior"
            title="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
          <span className="text-xs text-gray-500 font-medium">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= totalPages || loading}
            onClick={() => setPage(page + 1)}
            aria-label="Ir para próxima página"
            title="Próxima página"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
