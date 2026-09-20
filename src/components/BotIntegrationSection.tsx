import { useState, useEffect } from 'react'
import {
  Bot,
  Key,
  Copy,
  Check,
  Plus,
  Ban,
  Terminal,
  FileCode,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Lock,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatDate } from '@/lib/dateUtils'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { useAuth } from '@/context/AuthContext'
import {
  listBotApiKeys,
  createBotApiKey,
  revokeBotApiKey,
  type BotApiKey,
  type CreateBotKeyResponse,
} from '@/services/botKeys'

interface BotIntegrationSectionProps {
  tenantId: string
  tenantName?: string
  hermesEnabled?: boolean
}

export function BotIntegrationSection({
  tenantId,
  tenantName,
  hermesEnabled = true,
}: BotIntegrationSectionProps) {
  const { user } = useAuth()
  const [keys, setKeys] = useState<BotApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)

  // Modal para exibir chave recém-criada (uma única vez)
  const [createdKeyData, setCreatedKeyData] = useState<CreateBotKeyResponse | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)

  // Revogação
  const [revokingId, setRevokingId] = useState<string | null>(null)

  // Copiar curl de exemplo
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)

  const baseUrl = (
    import.meta.env.VITE_POCKETBASE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://bussola.municipio.gov.br')
  ).replace(/\/+$/, '')
  const activeKey = keys.find((k) => k.status === 'ativa')

  const isUserAdminOrSuper = user?.role === 'admin' || user?.role === 'superadmin'
  const userRoleLabel =
    user?.role === 'superadmin'
      ? 'Superadministrador'
      : user?.role === 'admin'
        ? 'Administrador Municipal'
        : 'Usuário Comum (Servidor)'

  const loadKeys = async () => {
    if (!tenantId) return
    try {
      const data = await listBotApiKeys(tenantId)
      setKeys(data)
    } catch (err) {
      toast.error('Erro ao carregar chaves do bot: ' + getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadKeys()
  }, [tenantId])

  const handleCreateKey = async () => {
    if (!tenantId) return
    setCreating(true)
    try {
      const res = await createBotApiKey(tenantId, newKeyName.trim() || undefined)
      setCreatedKeyData(res)
      setCreateModalOpen(false)
      setNewKeyName('')
      toast.success('Chave de API vinculada gerada com sucesso!')
      await loadKeys()
    } catch (err) {
      toast.error('Falha ao gerar chave: ' + getErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const handleRevokeKey = async (id: string) => {
    if (
      !confirm(
        'Tem certeza de que deseja revogar esta chave de API? O bot Hermes perderá acesso imediatamente.',
      )
    ) {
      return
    }
    setRevokingId(id)
    try {
      await revokeBotApiKey(id)
      toast.success('Chave de API revogada com sucesso.')
      await loadKeys()
    } catch (err) {
      toast.error('Erro ao revogar chave: ' + getErrorMessage(err))
    } finally {
      setRevokingId(null)
    }
  }

  const copyToClipboard = (text: string, snippetId?: string) => {
    navigator.clipboard.writeText(text)
    if (snippetId) {
      setCopiedSnippet(snippetId)
      setTimeout(() => setCopiedSnippet(null), 2500)
    } else {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2500)
    }
    toast.success('Copiado para a área de transferência!')
  }

  const sampleToken = activeKey ? activeKey.key_prefix : 'bjm_suaChaveSecreta...'

  const exampleQuestions = isUserAdminOrSuper
    ? [
        {
          pergunta: 'Quantas ideações estão em andamento na prefeitura?',
          endpoint: '/backend/v1/bot/projects/summary',
          dica: 'Resumo geral do Kanban em contagem_por_coluna (exclusivo para administradores).',
          permissao: 'Admin/Superadmin',
        },
        {
          pergunta: 'Qual ideação está com prioridade baixa/média/alta?',
          endpoint: '/backend/v1/bot/projects?coluna=Ideação&prioridade=Alta',
          dica: 'Filtra os cards de Ideação pelo nível de prioridade no município.',
          permissao: 'Todos (Admin vê do município; Comum vê os seus)',
        },
        {
          pergunta: 'O que está na coluna Elaborar DFD do Kanban?',
          endpoint: '/backend/v1/bot/projects?coluna=Elaborar DFD',
          dica: 'Lista detalhada com título, responsável, objeto e prazo.',
          permissao: 'Todos (escopado por papel)',
        },
        {
          pergunta: 'Quantos processos estão parados ou têm prazos vencidos?',
          endpoint: '/backend/v1/bot/deadlines',
          dica: 'Traz os vencidos da semana, hoje e próximos dias para o bot resumir.',
          permissao: 'Todos (escopado por papel)',
        },
        {
          pergunta: 'Quem são os servidores e procuradores ativos no município?',
          endpoint: '/backend/v1/bot/users',
          dica: 'Lista os servidores ativos com seus papéis municipais (exclusivo para administradores).',
          permissao: 'Admin/Superadmin',
        },
      ]
    : [
        {
          pergunta: 'Quais são os meus projetos em andamento?',
          endpoint: '/backend/v1/bot/projects',
          dica: 'Retorna exclusivamente os projetos onde você é o responsável.',
          permissao: 'Usuário Comum',
        },
        {
          pergunta: 'Quais prazos dos meus processos vencem esta semana?',
          endpoint: '/backend/v1/bot/deadlines',
          dica: 'Retorna prazos vencidos e próximos dias apenas dos seus projetos atribuídos.',
          permissao: 'Usuário Comum',
        },
        {
          pergunta: 'Quais DFDs estão sob minha responsabilidade?',
          endpoint: '/backend/v1/bot/dfds',
          dica: 'Lista os DFDs atribuídos ao seu usuário neste município.',
          permissao: 'Usuário Comum',
        },
        {
          pergunta: 'Tenho alguma notificação pendente de leitura?',
          endpoint: '/backend/v1/bot/notifications?nao_lidas=true',
          dica: 'Retorna alertas e comunicados direcionados a você.',
          permissao: 'Usuário Comum',
        },
      ]

  return (
    <div className="space-y-6">
      {/* Banner de Contexto RBAC da Sessão */}
      <div className="rounded-lg bg-slate-900 text-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Identidade RBAC de Emissão
            </span>
          </div>
          <p className="text-sm font-bold text-white">
            Esta chave consulta como <span className="text-blue-300">{userRoleLabel}</span> de{' '}
            <span className="text-blue-300">{tenantName || 'este município'}</span>
          </p>
          <p className="text-xs text-slate-300">
            {isUserAdminOrSuper
              ? 'Permissão ampla: o bot Hermes consultará todos os projetos, prazos e resumos desta prefeitura.'
              : 'Permissão estrita: o bot Hermes consultará apenas os projetos, prazos e notificações atribuídos a você.'}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-slate-700 bg-slate-800 text-slate-200 text-xs py-1"
          >
            {user?.email}
          </Badge>
        </div>
      </div>

      {/* Bloco de Gestão das Chaves */}
      <Card className="bg-white border-0 shadow-subtle">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1c2a3e]">Chaves de API do Município</h3>
                <p className="text-xs text-gray-500">
                  {tenantName
                    ? `Escopadas a ${tenantName} com credencial do usuário emissor`
                    : 'Isolamento estrito por município e usuário'}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setCreateModalOpen(true)}
              disabled={!hermesEnabled}
              size="sm"
              className="bg-[#1c2a3e] hover:bg-[#283b54] text-white text-xs h-8 gap-1.5 disabled:opacity-50"
              title={
                !hermesEnabled ? 'Integração Hermes desativada para esta prefeitura.' : undefined
              }
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Chave de API
            </Button>
          </div>

          {!hermesEnabled && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                A integração Hermes está desativada para esta prefeitura pelo superadministrador.
                Não é possível gerar novas chaves e as chaves existentes estão inoperantes.
              </span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg">
              <Key className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500 font-medium">
                Nenhuma chave de API gerada para este município.
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Gere uma chave para permitir que o bot Hermes consulte dados com segurança e
                isolamento por perfil.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-800">{k.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0 h-4 border-0 font-medium ${
                          k.status === 'ativa'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {k.status === 'ativa' ? 'Ativa' : 'Revogada'}
                      </Badge>
                      {k.role_snapshot && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-2 py-0 h-4 border-gray-200 text-gray-600 bg-white"
                        >
                          Papel:{' '}
                          {k.role_snapshot === 'admin'
                            ? 'Admin'
                            : k.role_snapshot === 'superadmin'
                              ? 'Superadmin'
                              : 'Servidor Comum'}
                        </Badge>
                      )}
                      {k.user_name && (
                        <span className="text-[11px] text-gray-500">
                          (Criada por: <strong>{k.user_name}</strong>)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 font-mono flex-wrap">
                      <span>Prefixo: {k.key_prefix}</span>
                      <span>•</span>
                      <span>Criada em: {formatDate(k.created)}</span>
                      {k.last_used_at && (
                        <>
                          <span>•</span>
                          <span className="text-blue-600">
                            Último uso: {formatDate(k.last_used_at)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {k.status === 'ativa' && (
                      <Button
                        onClick={() => handleRevokeKey(k.id)}
                        disabled={revokingId === k.id}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                      >
                        {revokingId === k.id ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Ban className="w-3 h-3 mr-1" />
                        )}
                        Revogar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3 text-xs text-blue-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Isolamento Multi-Tenant Inviolável</span>
              </div>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Toda chave tem escopo <strong>fixo ao município</strong>. As rotas do bot ignoram
                parâmetros externos de município e derivam o contexto estritamente do registro da
                chave. O Hermes nunca expõe dados de outra cidade.
              </p>
            </div>

            <div className="rounded-lg bg-purple-50/60 border border-purple-100 p-3 text-xs text-purple-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Lock className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Espelhamento de Papel (RBAC ao vivo)</span>
              </div>
              <p className="text-[11px] text-purple-700 leading-relaxed">
                A chave resolve as permissões <strong>ao vivo</strong> a partir do vínculo do
                usuário no banco. Um servidor comum consulta apenas o que é dele; resumos gerenciais
                e listagens globais retornam 403 Forbidden.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bloco de Documentação Técnica */}
      <Card className="bg-white border-0 shadow-subtle">
        <CardContent className="p-5 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1c2a3e]">Guia de Conexão com o Hermes</h3>
              <p className="text-xs text-gray-500">
                Como configurar seu agente de linguagem natural no Telegram passo a passo
              </p>
            </div>
          </div>

          {/* Passo a Passo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg border border-gray-100 bg-gray-50/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1c2a3e] text-white text-[11px] font-bold flex items-center justify-center">
                  1
                </span>
                <span className="text-xs font-bold text-gray-800">Criar Bot no Telegram</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Abra o Telegram, procure por <code>@BotFather</code>, envie o comando{' '}
                <code>/newbot</code> e obtenha o <strong>Telegram Bot Token</strong>.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-gray-100 bg-gray-50/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1c2a3e] text-white text-[11px] font-bold flex items-center justify-center">
                  2
                </span>
                <span className="text-xs font-bold text-gray-800">Configurar Agente Hermes</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Na plataforma Hermes, informe o Token do Bot e configure a chamada de API usando a
                URL Base abaixo com o Header <code>Authorization: Bearer &lt;chave&gt;</code>.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-gray-100 bg-gray-50/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1c2a3e] text-white text-[11px] font-bold flex items-center justify-center">
                  3
                </span>
                <span className="text-xs font-bold text-gray-800">Conversar com Segurança</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Pergunte em português natural. As respostas serão rigorosamente escopadas ao seu
                papel ({userRoleLabel}) e município ({tenantName}).
              </p>
            </div>
          </div>

          {/* URL Base e Autenticação */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-gray-700">
              URL Base dos Endpoints de Integração
            </Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${baseUrl}/backend/v1/bot`}
                className="bg-gray-50 font-mono text-xs text-gray-700"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(`${baseUrl}/backend/v1/bot`, 'url_base')}
                className="h-9 px-3 gap-1 text-xs shrink-0"
              >
                {copiedSnippet === 'url_base' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                Copiar
              </Button>
              <a
                href={`${baseUrl}/backend/v1/bot`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1.5 rounded hover:bg-blue-50 transition-colors"
                title="Abrir endpoint base de teste no navegador"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Testar no navegador</span>
              </a>
            </div>
            <p className="text-[11px] text-gray-500">
              Autenticação aceita via Header <code>Authorization: Bearer &lt;chave&gt;</code> ou{' '}
              <code>X-API-Key: &lt;chave&gt;</code>.
            </p>
          </div>

          {/* Catálogo de Endpoints e Perguntas Equivalentes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#1c2a3e]" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Exemplos de Perguntas para o seu Papel ({userRoleLabel})
                </h4>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                {isUserAdminOrSuper ? 'Visão de Gestão Municipal' : 'Visão de Servidor Responsável'}
              </Badge>
            </div>

            <div className="space-y-2.5">
              {exampleQuestions.map((q, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition-colors space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-900">
                      💬 &quot;{q.pergunta}&quot;
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 shrink-0 font-mono"
                    >
                      GET
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded border border-gray-200">
                    <code className="text-[11px] font-mono text-blue-600 break-all">
                      {q.endpoint}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `curl -H "Authorization: Bearer ${sampleToken}" "${baseUrl}${q.endpoint}"`,
                          `q_${idx}`,
                        )
                      }
                      className="text-gray-400 hover:text-gray-700 p-1 rounded"
                      title="Copiar comando cURL"
                    >
                      {copiedSnippet === `q_${idx}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>{q.dica}</span>
                    <span className="text-[10px] text-gray-400 font-medium">{q.permissao}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Exemplo de Chamada e Resposta JSON Real */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-[#1c2a3e]" />
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Exemplo de Resposta Estruturada (GET /backend/v1/bot/info)
              </h4>
            </div>

            <div className="relative rounded-lg bg-gray-900 text-gray-100 p-4 font-mono text-xs overflow-x-auto">
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(
                      {
                        status: 'ok',
                        sistema: 'Bússola Jurídica Municipal 2.0',
                        versao: '0.0.107',
                        municipio: {
                          id: tenantId,
                          nome: tenantName || 'Prefeitura de Exemplo',
                          slug: 'prefeitura-exemplo',
                        },
                        usuario: {
                          id: user?.id || 'usr_123',
                          nome: user?.name || 'Servidor Municipal',
                          papel_no_municipio: user?.role || 'servidor',
                          is_admin_ou_superior: isUserAdminOrSuper,
                        },
                        escopo: {
                          modo: isUserAdminOrSuper ? 'municipal_completo' : 'pessoal_estrito',
                        },
                      },
                      null,
                      2,
                    ),
                    'json_example',
                  )
                }
                className="absolute top-3 right-3 text-gray-400 hover:text-white p-1 rounded bg-gray-800"
                title="Copiar JSON"
              >
                {copiedSnippet === 'json_example' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <pre className="text-[11px] text-gray-300">
                {`// GET /backend/v1/bot/info
{
  "status": "ok",
  "sistema": "Bússola Jurídica Municipal 2.0",
  "versao": "0.0.107",
  "municipio": {
    "id": "${tenantId}",
    "nome": "${tenantName || 'Prefeitura de Exemplo'}"
  },
  "usuario": {
    "id": "${user?.id || 'usr_123'}",
    "nome": "${user?.name || 'Servidor'}",
    "papel_no_municipio": "${user?.role || 'servidor'}",
    "is_admin_ou_superior": ${isUserAdminOrSuper}
  },
  "escopo": {
    "modo": "${isUserAdminOrSuper ? 'municipal_completo' : 'pessoal_estrito'}"
  }
}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal para Gerar Nova Chave */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-[#1c2a3e]">
              Gerar Nova Chave de API
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Esta chave herdará seu papel de <strong>{userRoleLabel}</strong> e dará acesso{' '}
              <strong>somente leitura</strong> aos dados de {tenantName || 'este município'}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Identificação da Chave</Label>
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Ex.: Hermes Telegram Gabinete"
                className="mt-1 text-xs"
              />
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-xs text-blue-800 space-y-1">
              <p className="font-semibold text-blue-900">Vínculo Automático:</p>
              <p className="text-[11px] text-blue-700">
                • Usuário: <strong>{user?.name || user?.email}</strong>
                <br />• Papel Efetivo: <strong>{userRoleLabel}</strong>
                <br />• Município Fixo: <strong>{tenantName || 'Selecionado'}</strong>
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateKey}
              disabled={creating}
              size="sm"
              className="bg-[#1c2a3e] hover:bg-[#283b54] text-white text-xs"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Gerar Chave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Exibição Única da Chave Secreta */}
      <Dialog open={!!createdKeyData} onOpenChange={() => setCreatedKeyData(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              <Key className="w-5 h-5" />
            </div>
            <DialogTitle className="text-sm font-bold text-[#1c2a3e]">
              Guarde sua Chave com Segurança
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Esta chave <strong>não será exibida novamente</strong>. Copie-a agora e configure seu
              agente Hermes.
            </DialogDescription>
          </DialogHeader>

          {createdKeyData && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  Chave de API (Secret Token)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={createdKeyData.raw_key}
                    className="font-mono text-xs bg-emerald-50/50 border-emerald-200 text-emerald-900 select-all"
                  />
                  <Button
                    onClick={() => copyToClipboard(createdKeyData.raw_key)}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shrink-0 gap-1.5"
                  >
                    {copiedKey ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Copiar
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-700 space-y-0.5">
                <p className="font-semibold text-slate-800">Metadados da Chave:</p>
                <p className="text-[11px] text-slate-600">
                  Proprietário: <strong>{createdKeyData.user_name || createdKeyData.user}</strong> (
                  {createdKeyData.role})
                </p>
                <p className="text-[11px] text-slate-600">
                  Município: <strong>{createdKeyData.tenant_name || tenantName}</strong>
                </p>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Aviso Importante</span>
                </div>
                <p className="text-[11px] text-amber-700">
                  Após fechar esta janela, apenas o prefixo <code>{createdKeyData.key_prefix}</code>{' '}
                  ficará visível para fins de identificação. Caso perca esta chave, basta revogá-la
                  e gerar uma nova.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setCreatedKeyData(null)}
              size="sm"
              className="bg-[#1c2a3e] hover:bg-[#283b54] text-white text-xs w-full sm:w-auto"
            >
              Já guardei a chave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
