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
  Boxes,
  Sparkles,
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
  const [copiedAllHermes, setCopiedAllHermes] = useState(false)

  const baseUrl = (
    import.meta.env.VITE_POCKETBASE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://bussola.municipio.gov.br')
  ).replace(/\/+$/, '')
  const botApiBaseUrl = `${baseUrl}/backend/v1/bot`
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

  const sampleToken = createdKeyData
    ? createdKeyData.raw_key
    : activeKey
      ? activeKey.key_prefix
      : 'bjm_suaChaveSecreta...'

  const generateHermesFullConfigBlock = (): string => {
    const rawKeyAvailable = !!createdKeyData?.raw_key
    const apiKeyValue = rawKeyAvailable
      ? createdKeyData!.raw_key
      : activeKey
        ? `[ATENÇÃO: Chave ativa detectada (prefixo ${activeKey.key_prefix}), mas o valor secreto completo só é exibido no momento da criação. Caso não tenha o segredo guardado, gere uma nova chave na aba "Integração Bot / Hermes" em /configuracoes para obter o token completo.]`
        : `[ATENÇÃO: Nenhuma chave de API ativa encontrada. Acesse a aba "Integração Bot / Hermes" em /configuracoes e clique em "Nova Chave de API" para gerar seu token.]`

    const curlToken = rawKeyAvailable
      ? createdKeyData!.raw_key
      : activeKey
        ? `<SUA_CHAVE_API_PREFIXO_${activeKey.key_prefix}>`
        : '<SUA_CHAVE_API>'

    return `================================================================================
CONFIGURAÇÃO COMPLETA DE INTEGRAÇÃO — AGENTE HERMES & BÚSSOLA JURÍDICA MUNICIPAL 2.0
Município: ${tenantName || 'Prefeitura Vinculada'} (ID: ${tenantId})
Usuário: ${user?.name || user?.email || 'Servidor Municipal'}
Papel Efetivo: ${userRoleLabel} (${isUserAdminOrSuper ? 'Visão ampla da prefeitura' : 'Visão estrita do servidor'})
================================================================================

1. URL BASE DA API DO BOT
--------------------------------------------------------------------------------
URL Base: ${botApiBaseUrl}
Status de Teste: ${botApiBaseUrl}/ping (responde {"status":"ok","message":"Bot Read API is active and healthy"})
Autenticação: Header "Authorization: Bearer <chave>" ou "X-API-Key: <chave>"
Isolamento: 100% Multi-tenant com RBAC embutido na chave. O município e o papel do usuário são resolvidos diretamente no servidor a partir da chave de API.

2. CHAVE DE API (BUSSOLA_API_KEY)
--------------------------------------------------------------------------------
${rawKeyAvailable ? `Chave Gerada Nesta Sessão (Valor Completo):\n${createdKeyData!.raw_key}` : `Instrução para a Chave de API:\n${apiKeyValue}`}

3. VARIÁVEIS DE AMBIENTE PARA O DOCKER DO HERMES
--------------------------------------------------------------------------------
No painel do Gerenciador Docker do seu Hermes (ou arquivo docker-compose / .env), configure as variáveis em "Ambiente":

BUSSOLA_API_URL=${botApiBaseUrl}
BUSSOLA_API_KEY=${rawKeyAvailable ? createdKeyData!.raw_key : '<COLE_AQUI_A_CHAVE_GERADA_NA_ABA_CONFIGURACOES>'}

4. CATÁLOGO DOS 9 ENDPOINTS COM EXEMPLOS DE CURL
--------------------------------------------------------------------------------
Observação: A chave deriva automaticamente o município (${tenantName || tenantId}) e as permissões de ${userRoleLabel}.

[1] Healthcheck / Ping
Endpoint: GET ${botApiBaseUrl}/ping
Permissão: Público / Teste de conectividade
Descrição: Verifica se o subsistema de bot da Bússola está ativo e saudável.
Exemplo cURL:
curl -X GET "${botApiBaseUrl}/ping"

[2] Informações de Identidade e Escopo da Chave
Endpoint: GET ${botApiBaseUrl}/info
Permissão: Todas as chaves ativas
Descrição: Retorna os dados do município vinculado, usuário emissor, papel RBAC em tempo real e colunas do Kanban.
Exemplo cURL:
curl -X GET "${botApiBaseUrl}/info" \\
  -H "Authorization: Bearer ${curlToken}"

[3] Listagem de Projetos do Kanban
Endpoint: GET ${botApiBaseUrl}/projects[?coluna=...&prioridade=...&busca=...]
Permissão: Escopado por papel
  - Admin/Superadmin: visualiza todos os projetos do município.
  - Usuário Comum: visualiza exclusivamente os projetos onde é responsável direto.
Filtros suportados:
  - coluna: Ideação, Projeto Executivo, Elaborar DFD, Procedimentos Internos, Execução, Prestação de Contas, Marketing
  - prioridade: Alta, Média, Baixa
  - busca: termo de busca textual no título, objeto ou número de processo
Exemplo cURL:
curl -X GET "${botApiBaseUrl}/projects?coluna=Elaborar%20DFD" \\
  -H "Authorization: Bearer ${curlToken}"

[4] Resumo Agregado do Kanban (Totais por Coluna e Prioridade)
Endpoint: GET ${botApiBaseUrl}/projects/summary
Permissão: Exclusivo Administradores (Admin / Superadmin). Retorna 403 Forbidden para Usuário Comum.
Descrição: Retorna contadores de cards por coluna, por prioridade e a matriz cruzada coluna x prioridade.
Exemplo cURL:
curl -X GET "${botApiBaseUrl}/projects/summary" \\
  -H "Authorization: Bearer ${curlToken}"

[5] Listagem de Documentos de Formalização de Demanda (DFDs)
Endpoint: GET ${botApiBaseUrl}/dfds[?status=...]
Permissão: Escopado por papel
  - Admin/Superadmin: visualiza todos os DFDs do município.
  - Usuário Comum: visualiza exclusivamente os DFDs sob sua responsabilidade.
Filtros suportados:
  - status: Em Elaboração, Aguardando Aprovação, Aprovado, Rejeitado, etc.
Exemplo cURL:
curl -X GET "${botApiBaseUrl}/dfds" \\
  -H "Authorization: Bearer ${curlToken}"

[6] Detalhe de um DFD por ID
Endpoint: GET ${botApiBaseUrl}/dfds/{id}
Permissão: Escopado por papel
  - Admin/Superadmin: visualiza qualquer DFD do município.
  - Usuário Comum: visualiza somente se for o responsável direto pelo DFD. DFDs de outros usuários ou outros municípios retornam 404 Not Found.
Exemplo cURL:
curl -X GET "${botApiBaseUrl}/dfds/SEU_ID_DFD" \\
  -H "Authorization: Bearer ${curlToken}"

[7] Monitoramento de Prazos e Gargalos
Endpoint: GET ${botApiBaseUrl}/deadlines
Permissão: Escopado por papel
  - Admin/Superadmin: analisa todos os prazos do município.
  - Usuário Comum: analisa apenas os prazos dos seus processos atribuídos.
Descrição: Retorna itens vencidos, prazos que vencem nos próximos 7 dias e contadores analíticos.
Exemplo cURL:
curl -X GET "${botApiBaseUrl}/deadlines" \\
  -H "Authorization: Bearer ${curlToken}"

[8] Servidores e Usuários do Município
Endpoint: GET ${botApiBaseUrl}/users
Permissão: Exclusivo Administradores (Admin / Superadmin). Retorna 403 Forbidden para Usuário Comum.
Descrição: Lista servidores com vínculo ativo no município, seus e-mails e respectivos papéis (admin / servidor).
Exemplo cURL:
curl -X GET "${botApiBaseUrl}/users" \\
  -H "Authorization: Bearer ${curlToken}"

[9] Notificações e Alertas Internos
Endpoint: GET ${botApiBaseUrl}/notifications[?nao_lidas=true&tipo=...]
Permissão: Escopado por papel
  - Admin/Superadmin: visualiza notificações do município.
  - Usuário Comum: visualiza exclusivamente notificações direcionadas a ele ou gerais da equipe.
Filtros suportados:
  - nao_lidas=true: filtra apenas pendentes de leitura
  - tipo: alerta_gargalo, prazo_vencendo, etc.
Exemplo cURL:
curl -X GET "${botApiBaseUrl}/notifications?nao_lidas=true" \\
  -H "Authorization: Bearer ${curlToken}"

5. SYSTEM PROMPT PRONTO PARA O AGENTE HERMES (EM PORTUGUÊS)
--------------------------------------------------------------------------------
Copie e cole as diretrizes abaixo no campo de System Prompt ou Instruções do seu Agente Hermes:

"""
Você é o Hermes, o assistente oficial de inteligência operacional da plataforma Bússola Jurídica Municipal 2.0 para a Prefeitura de ${tenantName || 'seu município'}.

DIRETRIZES FUNDAMENTAIS:
1. IDIOMA E TONALIDADE:
   - Responda sempre em português brasileiro de forma clara, profissional, objetiva e segura.
   - Apresente informações organizadas com listas com marcadores, datas no padrão DD/MM/AAAA e destaques em negrito.

2. COMUNICAÇÃO COM A API:
   - Sua URL base é: ${botApiBaseUrl}
   - Em todas as requisições HTTP, envie obrigatoriamente o cabeçalho:
     Authorization: Bearer ${rawKeyAvailable ? createdKeyData!.raw_key : '$BUSSOLA_API_KEY'}
     (ou utilize o header equivalente: X-API-Key: ${rawKeyAvailable ? createdKeyData!.raw_key : '$BUSSOLA_API_KEY'})
   - Para identificar o usuário conectado, prefeitura e limitações de acesso, realize primeiro uma chamada a:
     GET ${botApiBaseUrl}/info

3. RESPEITO ESTRITO AO RBAC E ESCOPO DE SEGURANÇA:
   - A Bússola Jurídica isola os dados por chave no servidor:
     * Usuários com papel de Administrador Municipal ou Superadministrador têm acesso global aos dados da prefeitura (${botApiBaseUrl}/projects/summary e ${botApiBaseUrl}/users são permitidos).
     * Usuários com papel Comum (Servidores) têm visão estrita. Eles visualizam apenas seus próprios processos em /projects, seus próprios DFDs em /dfds, seus prazos em /deadlines e suas notificações em /notifications.
   - Se um endpoint retornar HTTP 403 Forbidden com mensagem de permissão, explique educadamente ao usuário em português que a consulta agregada municipal é restrita a administradores e ofereça a alternativa permitida para o perfil dele.
   - Jamais invente ou alucine dados jurídicos ou números de processos. Todas as respostas com dados da prefeitura devem ser baseadas estritamente nos retornos JSON recebidos dos endpoints oficiais da Bússola.

4. ENDPOINTS DISPONÍVEIS:
   - GET ${botApiBaseUrl}/ping -> Verificação de integridade
   - GET ${botApiBaseUrl}/info -> Perfil do usuário autenticado, município e colunas
   - GET ${botApiBaseUrl}/projects -> Projetos no Kanban (filtros: coluna, prioridade, busca)
   - GET ${botApiBaseUrl}/projects/summary -> Resumo com contagem por coluna/prioridade (apenas Admins)
   - GET ${botApiBaseUrl}/dfds -> DFDs (Documentos de Formalização de Demanda)
   - GET ${botApiBaseUrl}/dfds/{id} -> Detalhes de um DFD específico
   - GET ${botApiBaseUrl}/deadlines -> Prazos vencidos, da semana e futuros
   - GET ${botApiBaseUrl}/users -> Lista de servidores municipais (apenas Admins)
   - GET ${botApiBaseUrl}/notifications -> Notificações e avisos de gargalo
"""
================================================================================`
  }

  const handleCopyAllHermes = () => {
    const fullText = generateHermesFullConfigBlock()
    navigator.clipboard.writeText(fullText)
    setCopiedAllHermes(true)
    setTimeout(() => setCopiedAllHermes(false), 3000)
    toast.success('Configuração completa copiada para a área de transferência!')
  }

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
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleCopyAllHermes}
                size="sm"
                variant="outline"
                className="border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 text-xs h-8 gap-1.5 font-medium shadow-none"
                title="Copia URL base, chave, os 9 endpoints com cURL, variáveis Docker e o prompt do Hermes"
              >
                {copiedAllHermes ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-indigo-600" />
                )}
                Copiar tudo para o Hermes
              </Button>
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

          {/* Card de Destaque: Botão Copiar Tudo para o Hermes + Instruções de Variáveis de Ambiente */}
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-blue-50/60 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                    Integração Rápida com Agente Hermes
                  </h4>
                </div>
                <p className="text-xs text-indigo-900 leading-relaxed max-w-xl">
                  Gere o pacote unificado pronto para colar no Hermes: inclui a{' '}
                  <strong>URL Base</strong> ({botApiBaseUrl}), a <strong>Chave de API</strong> (com
                  o valor integral se gerada agora ou instrução de criação), o catálogo completo dos{' '}
                  <strong>9 endpoints</strong> e o <strong>Prompt do Agente</strong> em português.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleCopyAllHermes}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 px-4 gap-2 shrink-0 shadow-sm font-semibold"
              >
                {copiedAllHermes ? (
                  <Check className="w-4 h-4 text-emerald-200" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedAllHermes
                  ? 'Copiado para a Área de Transferência!'
                  : 'Copiar tudo para o Hermes'}
              </Button>
            </div>

            {/* Instruções de Variáveis de Ambiente para o Docker do Hermes */}
            <div className="border-t border-indigo-100/80 pt-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                <Boxes className="w-4 h-4 text-indigo-600" />
                <span>Variáveis de Ambiente para o Docker do Hermes</span>
              </div>
              <p className="text-[11px] text-indigo-800/90 leading-relaxed">
                No painel do Gerenciador Docker do seu Hermes (aba{' '}
                <em>Editor visual &gt; Ambiente</em>), adicione as duas variáveis obrigatórias:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-white/90 border border-indigo-100 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0">
                    <span className="text-[10px] text-gray-500 font-sans block">
                      Nome da Variável:
                    </span>
                    <span className="font-semibold text-gray-800">BUSSOLA_API_URL</span>
                    <span
                      className="text-[11px] text-indigo-600 block truncate"
                      title={botApiBaseUrl}
                    >
                      {botApiBaseUrl}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0 text-gray-500 hover:text-indigo-600"
                    onClick={() => copyToClipboard(botApiBaseUrl, 'env_url')}
                    title="Copiar URL"
                  >
                    {copiedSnippet === 'env_url' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>

                <div className="p-2.5 rounded-lg bg-white/90 border border-indigo-100 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0">
                    <span className="text-[10px] text-gray-500 font-sans block">
                      Nome da Variável:
                    </span>
                    <span className="font-semibold text-gray-800">BUSSOLA_API_KEY</span>
                    <span
                      className="text-[11px] text-indigo-600 block truncate"
                      title={
                        createdKeyData?.raw_key ||
                        (activeKey
                          ? `Chave ativa (prefixo ${activeKey.key_prefix})`
                          : 'Gere uma chave')
                      }
                    >
                      {createdKeyData?.raw_key ||
                        (activeKey
                          ? `Chave ativa (${activeKey.key_prefix}...)`
                          : 'Clique em "Nova Chave de API"')}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0 text-gray-500 hover:text-indigo-600"
                    onClick={() => {
                      if (createdKeyData?.raw_key) {
                        copyToClipboard(createdKeyData.raw_key, 'env_key')
                      } else {
                        toast.info(
                          activeKey
                            ? 'Copie a chave completa gerada ou gere uma nova chave nesta aba.'
                            : 'Gere uma nova chave de API primeiro.',
                        )
                      }
                    }}
                    title={
                      createdKeyData?.raw_key ? 'Copiar chave completa' : 'Instrução sobre a chave'
                    }
                  >
                    {copiedSnippet === 'env_key' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
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
                value={botApiBaseUrl}
                className="bg-gray-50 font-mono text-xs text-gray-700"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(botApiBaseUrl, 'url_base')}
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
                href={botApiBaseUrl}
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
                    Copiar Chave
                  </Button>
                </div>
              </div>

              {/* Botão integrado de copiar tudo para o Hermes com o token recém-criado */}
              <div className="p-3 rounded-lg border border-indigo-100 bg-indigo-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Pacote Completo para o Hermes
                  </span>
                  <p className="text-[11px] text-indigo-800">
                    Copie a URL base, esta chave recém-gerada, variáveis Docker e o prompt do Hermes
                    em um só bloco.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleCopyAllHermes}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-3 gap-1.5 shrink-0"
                >
                  {copiedAllHermes ? (
                    <Check className="w-3.5 h-3.5 text-emerald-200" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copiar tudo para o Hermes
                </Button>
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
