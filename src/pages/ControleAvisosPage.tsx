import { useState, useEffect, useCallback } from 'react'
import {
  BellRing,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserX,
  Send,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Lock,
  Unlock,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import {
  getAvisos,
  getAvisosIndicadores,
  getFeriados,
  createFeriado,
  deleteFeriado,
  desbloquearUsuarioManual,
  dispararAvisoTeste,
} from '@/services/avisos'
import type { AvisoRecord, AvisosIndicadores, FeriadoRecord } from '@/types/avisos'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateDisplay'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pendente_envio: { label: 'Pendente Envio', color: 'bg-amber-100 text-amber-800' },
  enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-800' },
  entregue: { label: 'Entregue', color: 'bg-cyan-100 text-cyan-800' },
  aguardando_confirmacao: { label: 'Aguardando Ciência', color: 'bg-orange-100 text-orange-800' },
  confirmado: { label: 'Ciência Confirmada', color: 'bg-emerald-100 text-emerald-800' },
  expirado: { label: 'Expirado', color: 'bg-gray-100 text-gray-800' },
  bloqueado: { label: 'Bloqueado p/ Falta', color: 'bg-red-100 text-red-800 font-bold' },
}

export default function ControleAvisosPage() {
  const { user } = useAuth()
  const tenantId = user?.tenantId || ''

  // Indicadores
  const [indicadores, setIndicadores] = useState<AvisosIndicadores>({
    enviadosHoje: 0,
    confirmadosHoje: 0,
    aguardandoHoje: 0,
    usuariosBloqueados: 0,
    demandasCriticas: 0,
    demandasVencidas: 0,
    taxaConfirmacao: 100,
  })

  // Lista de avisos
  const [avisos, setAvisos] = useState<AvisoRecord[]>([])
  const [loadingAvisos, setLoadingAvisos] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroSearch, setFiltroSearch] = useState<string>('')

  // Lista de usuários para aba de conformidade
  const [usuariosStatus, setUsuariosStatus] = useState<any[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(false)

  // Feriados
  const [feriados, setFeriados] = useState<FeriadoRecord[]>([])
  const [novoFeriadoData, setNovoFeriadoData] = useState('')
  const [novoFeriadoDesc, setNovoFeriadoDesc] = useState('')
  const [salvandoFeriado, setSalvandoFeriado] = useState(false)

  // Modal de Detalhes do Aviso
  const [avisoSelecionado, setAvisoSelecionado] = useState<AvisoRecord | null>(null)
  const [detalhesOpen, setDetalhesOpen] = useState(false)

  // Ações de teste e desbloqueio
  const [enviandoTeste, setEnviandoTeste] = useState(false)
  const [desbloqueandoId, setDesbloqueandoId] = useState<string | null>(null)

  const carregarIndicadores = useCallback(async () => {
    try {
      const ind = await getAvisosIndicadores(tenantId || undefined)
      setIndicadores(ind)
    } catch {
      // ignore
    }
  }, [tenantId])

  const carregarAvisos = useCallback(async () => {
    setLoadingAvisos(true)
    try {
      const res = await getAvisos({
        tenantId: tenantId || undefined,
        status: filtroStatus,
        tipo: filtroTipo,
        page,
        perPage: 15,
      })
      setAvisos(res.items)
      setTotalPages(res.totalPages)
      setTotalItems(res.totalItems)
    } finally {
      setLoadingAvisos(false)
    }
  }, [tenantId, filtroStatus, filtroTipo, page])

  const carregarUsuariosConformidade = useCallback(async () => {
    setLoadingUsuarios(true)
    try {
      const filter = tenantId ? `tenant = "${tenantId}"` : ''
      const list = await pb.collection('users').getFullList({
        filter,
        sort: 'name',
      })
      setUsuariosStatus(list)
    } catch {
      setUsuariosStatus([])
    } finally {
      setLoadingUsuarios(false)
    }
  }, [tenantId])

  const carregarFeriados = useCallback(async () => {
    try {
      const res = await getFeriados(tenantId || undefined)
      setFeriados(res)
    } catch {
      // ignore
    }
  }, [tenantId])

  useEffect(() => {
    carregarIndicadores()
    carregarAvisos()
    carregarUsuariosConformidade()
    carregarFeriados()
  }, [carregarIndicadores, carregarAvisos, carregarUsuariosConformidade, carregarFeriados])

  const handleDesbloquear = async (targetUserId: string, userName: string) => {
    setDesbloqueandoId(targetUserId)
    try {
      await desbloquearUsuarioManual(targetUserId, tenantId || undefined)
      toast.success(`Usuário ${userName} desbloqueado com sucesso!`)
      carregarIndicadores()
      carregarAvisos()
      carregarUsuariosConformidade()
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao desbloquear usuário.')
    } finally {
      setDesbloqueandoId(null)
    }
  }

  const handleEnviarTeste = async () => {
    if (!user?.id) return
    setEnviandoTeste(true)
    try {
      const res = await dispararAvisoTeste(user.id, tenantId || undefined)
      toast.success(res?.message || 'Aviso de teste disparado!')
      carregarIndicadores()
      carregarAvisos()
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao disparar teste no Telegram.')
    } finally {
      setEnviandoTeste(false)
    }
  }

  const handleAdicionarFeriado = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoFeriadoData || !novoFeriadoDesc.trim()) {
      toast.error('Informe a data e a descrição do feriado.')
      return
    }
    setSalvandoFeriado(true)
    try {
      await createFeriado({
        tenant: tenantId || undefined,
        data: novoFeriadoData,
        descricao: novoFeriadoDesc.trim(),
      })
      toast.success('Feriado registrado com sucesso!')
      setNovoFeriadoData('')
      setNovoFeriadoDesc('')
      carregarFeriados()
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar feriado.')
    } finally {
      setSalvandoFeriado(false)
    }
  }

  const handleExcluirFeriado = async (id: string) => {
    try {
      await deleteFeriado(id)
      toast.success('Feriado removido.')
      carregarFeriados()
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remover feriado.')
    }
  }

  // Filtrar avisos pelo termo de busca
  const avisosFiltrados = avisos.filter((av) => {
    if (!filtroSearch.trim()) return true
    const term = filtroSearch.toLowerCase()
    return (
      av.codigo.toLowerCase().includes(term) ||
      (av.userName && av.userName.toLowerCase().includes(term)) ||
      (av.userEmail && av.userEmail.toLowerCase().includes(term))
    )
  })

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Controle de Avisos & Confirmação de Ciência"
          description="Gestão de notificações mandatórias do Telegram, rastreamento jurídico de ciência e controle de bloqueios de servidores."
          icon={BellRing}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              carregarIndicadores()
              carregarAvisos()
              carregarUsuariosConformidade()
            }}
            className="text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
          <Button
            size="sm"
            onClick={handleEnviarTeste}
            disabled={enviandoTeste}
            className="text-xs bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-1.5 shadow-sm"
          >
            {enviandoTeste ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Disparar Teste Pessoal
          </Button>
        </div>
      </div>

      {/* Grid de Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="bg-white border-0 shadow-subtle p-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Enviados Hoje
          </p>
          <p className="text-xl font-bold text-[#1c2a3e] mt-1">{indicadores.enviadosHoje}</p>
        </Card>
        <Card className="bg-white border-0 shadow-subtle p-3">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
            Confirmados
          </p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{indicadores.confirmadosHoje}</p>
        </Card>
        <Card className="bg-white border-0 shadow-subtle p-3">
          <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">
            Aguardando
          </p>
          <p className="text-xl font-bold text-amber-600 mt-1">{indicadores.aguardandoHoje}</p>
        </Card>
        <Card className="bg-white border-0 shadow-subtle p-3">
          <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">
            Bloqueados
          </p>
          <p className="text-xl font-bold text-red-600 mt-1">{indicadores.usuariosBloqueados}</p>
        </Card>
        <Card className="bg-white border-0 shadow-subtle p-3">
          <p className="text-[11px] font-semibold text-orange-600 uppercase tracking-wider">
            Críticas
          </p>
          <p className="text-xl font-bold text-orange-600 mt-1">{indicadores.demandasCriticas}</p>
        </Card>
        <Card className="bg-white border-0 shadow-subtle p-3">
          <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wider">
            Vencidas
          </p>
          <p className="text-xl font-bold text-red-700 mt-1">{indicadores.demandasVencidas}</p>
        </Card>
        <Card className="bg-white border-0 shadow-subtle p-3 col-span-2 md:col-span-1">
          <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
            Conformidade
          </p>
          <p className="text-xl font-bold text-blue-600 mt-1">{indicadores.taxaConfirmacao}%</p>
        </Card>
      </div>

      <Tabs defaultValue="historico" className="w-full">
        <TabsList className="grid grid-cols-3 max-w-md mb-4">
          <TabsTrigger value="historico" className="text-xs gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Histórico de Avisos
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="text-xs gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Servidores & Bloqueios
          </TabsTrigger>
          <TabsTrigger value="feriados" className="text-xs gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Feriados do Calendário
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: HISTÓRICO DE AVISOS */}
        <TabsContent value="historico" className="space-y-4">
          <Card className="bg-white border-0 shadow-subtle">
            <CardHeader className="p-4 pb-2 border-b border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por código, nome ou e-mail..."
                    value={filtroSearch}
                    onChange={(e) => setFiltroSearch(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="h-8 text-xs w-[170px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Status</SelectItem>
                      <SelectItem value="aguardando_confirmacao">Aguardando Ciência</SelectItem>
                      <SelectItem value="confirmado">Confirmado</SelectItem>
                      <SelectItem value="bloqueado">Bloqueado</SelectItem>
                      <SelectItem value="pendente_envio">Pendente Envio</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger className="h-8 text-xs w-[170px]">
                      <SelectValue placeholder="Tipo de Aviso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Tipos</SelectItem>
                      <SelectItem value="diario">Aviso Diário</SelectItem>
                      <SelectItem value="lembrete">Lembrete</SelectItem>
                      <SelectItem value="alerta_extraordinario">Alerta Extraordinário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingAvisos ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                  Carregando trilha de avisos...
                </div>
              ) : avisosFiltrados.length === 0 ? (
                <div className="p-8 text-center">
                  <EmptyState
                    icon={<BellRing className="w-6 h-6 text-gray-400" />}
                    title="Nenhum aviso encontrado"
                    description="Não constam registros de avisos para os filtros selecionados."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gray-50/70">
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Código</TableHead>
                        <TableHead className="text-xs font-semibold">
                          Servidor Destinatário
                        </TableHead>
                        <TableHead className="text-xs font-semibold">Tipo</TableHead>
                        <TableHead className="text-xs font-semibold text-center">
                          Demandas
                        </TableHead>
                        <TableHead className="text-xs font-semibold">Data/Hora Envio</TableHead>
                        <TableHead className="text-xs font-semibold">Status do Ciclo</TableHead>
                        <TableHead className="text-xs font-semibold">Confirmação</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {avisosFiltrados.map((av) => {
                        const st = STATUS_MAP[av.status] || {
                          label: av.status,
                          color: 'bg-gray-100 text-gray-700',
                        }
                        const envioFmt = av.data_hora_envio
                          ? new Date(av.data_hora_envio).toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'
                        const confFmt = av.data_hora_confirmacao
                          ? new Date(av.data_hora_confirmacao).toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'

                        return (
                          <TableRow key={av.id} className="hover:bg-slate-50/80">
                            <TableCell className="font-mono text-xs font-semibold text-[#1c2a3e]">
                              {av.codigo}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-xs font-medium text-gray-900">{av.userName}</p>
                                <p className="text-[11px] text-gray-500">{av.userEmail}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-gray-700 capitalize">
                                {av.tipo === 'alerta_extraordinario'
                                  ? 'Alerta Extraordinário'
                                  : av.tipo === 'lembrete'
                                    ? 'Lembrete'
                                    : 'Aviso Diário'}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-xs font-bold">
                                {av.qtd_demandas}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-gray-600">{envioFmt}</TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] py-0.5 border-0 ${st.color}`}>
                                {st.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {av.data_hora_confirmacao ? (
                                <span className="text-emerald-700 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> {confFmt}
                                </span>
                              ) : (
                                <span className="text-gray-400">Pendente</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setAvisoSelecionado(av)
                                  setDetalhesOpen(true)
                                }}
                                className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                Ver Detalhes
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Paginação */}
              <div className="flex items-center justify-between p-4 border-t border-gray-100 text-xs text-gray-500">
                <span>
                  Total de <strong>{totalItems}</strong> aviso(s)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-7 px-2"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Anterior
                  </Button>
                  <span>
                    Página {page} de {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-7 px-2"
                  >
                    Próxima <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: SERVIDORES & BLOQUEIOS */}
        <TabsContent value="usuarios" className="space-y-4">
          <Card className="bg-white border-0 shadow-subtle">
            <CardHeader className="p-4 pb-2 border-b border-gray-100">
              <CardTitle className="text-sm font-bold text-[#1c2a3e]">
                Conformidade de Ciência por Servidor
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Acompanhe quais servidores possuem o Telegram vinculado, se recebem avisos e execute
                o desbloqueio administrativo imediato quando necessário.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingUsuarios ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                  Carregando lista de servidores...
                </div>
              ) : usuariosStatus.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  Nenhum servidor encontrado para este município.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-gray-50/70">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Nome do Servidor</TableHead>
                      <TableHead className="text-xs font-semibold">E-mail Cadastrado</TableHead>
                      <TableHead className="text-xs font-semibold">Telegram Vinculado</TableHead>
                      <TableHead className="text-xs font-semibold">Receber Avisos</TableHead>
                      <TableHead className="text-xs font-semibold">Status de Acesso</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuariosStatus.map((u) => {
                      const isLinked = Boolean(u.telegram_id)
                      const isBlocked = u.status_bloqueio === 'bloqueado_ciencia'

                      return (
                        <TableRow key={u.id}>
                          <TableCell className="text-xs font-medium text-gray-900">
                            {u.name || 'Sem nome'}
                          </TableCell>
                          <TableCell className="text-xs text-gray-600">{u.email}</TableCell>
                          <TableCell>
                            {isLinked ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px] gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Sim (`{u.telegram_id}`)
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-500 border-0 text-[10px]">
                                Não vinculado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {u.receber_avisos_telegram ? (
                              <span className="text-xs text-emerald-700 font-semibold">Ativo</span>
                            ) : (
                              <span className="text-xs text-gray-400">Inativo</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isBlocked ? (
                              <Badge className="bg-red-500 text-white border-0 text-[10px] gap-1 animate-pulse">
                                <Lock className="w-3 h-3" /> BLOQUEADO P/ CIÊNCIA
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] gap-1">
                                Regular (Ativo)
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isBlocked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDesbloquear(u.id, u.name || u.email)}
                                disabled={desbloqueandoId === u.id}
                                className="h-7 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1.5"
                              >
                                {desbloqueandoId === u.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Unlock className="w-3 h-3" />
                                )}
                                Desbloquear Manualmente
                              </Button>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 3: FERIADOS */}
        <TabsContent value="feriados" className="space-y-4">
          <Card className="bg-white border-0 shadow-subtle">
            <CardHeader className="p-4 pb-2 border-b border-gray-100">
              <CardTitle className="text-sm font-bold text-[#1c2a3e]">
                Feriados e Pontos Facultativos
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Cadastre as datas em que a contagem de prazos por dias úteis deve ser suspensa na
                prefeitura.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <form
                onSubmit={handleAdicionarFeriado}
                className="flex flex-col sm:flex-row items-end gap-3 bg-gray-50/70 p-3 rounded-lg border border-gray-200/60"
              >
                <div className="w-full sm:w-48">
                  <Label className="text-xs font-semibold text-gray-700">Data *</Label>
                  <Input
                    type="date"
                    value={novoFeriadoData}
                    onChange={(e) => setNovoFeriadoData(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div className="flex-1 w-full">
                  <Label className="text-xs font-semibold text-gray-700">
                    Descrição / Motivo *
                  </Label>
                  <Input
                    placeholder="Ex: Aniversário da Cidade / Emancipação Política"
                    value={novoFeriadoDesc}
                    onChange={(e) => setNovoFeriadoDesc(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={salvandoFeriado}
                  className="h-8 text-xs bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-1 shrink-0"
                >
                  {salvandoFeriado ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Adicionar Feriado
                </Button>
              </form>

              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50/70">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Data</TableHead>
                      <TableHead className="text-xs font-semibold">Descrição</TableHead>
                      <TableHead className="text-xs font-semibold">Escopo</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feriados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-xs text-gray-400 py-6">
                          Nenhum feriado municipal cadastrado no momento.
                        </TableCell>
                      </TableRow>
                    ) : (
                      feriados.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="text-xs font-medium text-gray-900">
                            {f.data.split('-').reverse().join('/')}
                          </TableCell>
                          <TableCell className="text-xs text-gray-700">{f.descricao}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {f.tenant ? 'Municipal' : 'Nacional'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExcluirFeriado(f.id)}
                              className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Detalhes do Aviso */}
      <Dialog open={detalhesOpen} onOpenChange={setDetalhesOpen}>
        <DialogContent className="sm:max-w-[620px] bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1c2a3e] flex items-center justify-between">
              <span>Aviso {avisoSelecionado?.codigo}</span>
              {avisoSelecionado && (
                <Badge className={STATUS_MAP[avisoSelecionado.status]?.color || 'bg-gray-100'}>
                  {STATUS_MAP[avisoSelecionado.status]?.label || avisoSelecionado.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Registro pericial e trilha de conformidade jurídica do envio deste aviso.
            </DialogDescription>
          </DialogHeader>

          {avisoSelecionado && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg text-xs">
                <div>
                  <span className="text-gray-500 block">Destinatário:</span>
                  <span className="font-semibold text-gray-800">{avisoSelecionado.userName}</span>
                  <span className="text-gray-500 block text-[11px]">
                    {avisoSelecionado.userEmail}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Telegram ID:</span>
                  <span className="font-mono text-gray-800">
                    {avisoSelecionado.telegram_id || 'Não configurado'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Enviado em:</span>
                  <span className="font-medium text-gray-800">
                    {avisoSelecionado.data_hora_envio
                      ? new Date(avisoSelecionado.data_hora_envio).toLocaleString('pt-BR')
                      : 'Pendente'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Confirmado em:</span>
                  <span className="font-medium text-emerald-700">
                    {avisoSelecionado.data_hora_confirmacao
                      ? new Date(avisoSelecionado.data_hora_confirmacao).toLocaleString('pt-BR')
                      : 'Ainda não confirmado'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-[#1c2a3e] uppercase mb-2">
                  Demandas Vinculadas a Este Aviso ({avisoSelecionado.qtd_demandas})
                </h4>
                {!avisoSelecionado.demandas_vinculadas ||
                avisoSelecionado.demandas_vinculadas.length === 0 ? (
                  <p className="text-xs text-gray-500 italic bg-slate-50 p-3 rounded-lg">
                    Aviso emitido no modo de confirmação sem demandas pendentes.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {avisoSelecionado.demandas_vinculadas.map((d, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-gray-200/80 bg-white flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-gray-800 block">{d.titulo}</span>
                          <span className="text-[11px] text-gray-500">
                            Tipo: {d.tipo.toUpperCase()} | Prazo:{' '}
                            {d.prazo?.split('-').reverse().join('/')}
                          </span>
                        </div>
                        <Badge
                          className={`text-[10px] ${
                            d.urgencia === 'CRÍTICA' || d.urgencia === 'VENCIDA'
                              ? 'bg-red-500 text-white'
                              : d.urgencia === 'ALTA'
                                ? 'bg-orange-500 text-white'
                                : 'bg-emerald-500 text-white'
                          }`}
                        >
                          {d.urgencia}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {avisoSelecionado.ultimo_erro && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-xs text-red-700">
                  <span className="font-bold block">Último erro de entrega:</span>
                  {avisoSelecionado.ultimo_erro}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDetalhesOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
