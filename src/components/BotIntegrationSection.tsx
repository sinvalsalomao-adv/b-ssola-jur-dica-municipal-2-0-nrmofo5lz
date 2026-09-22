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
  const isSuperadmin = user?.role === 'superadmin'

  const [keys, setKeys] = useState<BotApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)

  // Modal para exibir chave recém-criada (uma única vez)
  const [createdKeyData, setCreatedKeyData] = useState<CreateBotKeyResponse | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)

  // Revogação de chave mestra municipal
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
    } catch {
      // Usuários não-superadmin podem não ter permissão de listar chaves mestras no novo modelo
      setKeys([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadKeys()
  }, [tenantId])

  const handleCreateKey = async () => {
    if (!tenantId || !isSuperadmin) return
    setCreating(true)
    try {
      const res = await createBotApiKey(
        tenantId,
        newKeyName.trim() || `Chave Mestra Hermes - ${tenantName || 'Prefeitura'}`,
      )
      setCreatedKeyData(res)
      setCreateModalOpen(false)
      setNewKeyName('')
      toast.success('Chave mestra da prefeitura gerada com sucesso!')
      await loadKeys()
    } catch (err) {
      toast.error('Falha ao gerar chave mestra: ' + getErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const handleRevokeKey = async (id: string) => {
    if (!isSuperadmin) return
    if (
      !confirm(
        'Tem certeza de que deseja revogar a chave mestra desta prefeitura? O bot Hermes perderá acesso imediatamente.',
      )
    ) {
      return
    }
    setRevokingId(id)
    try {
      await revokeBotApiKey(id)
      toast.success('Chave mestra revogada com sucesso.')
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

  const generateHermesFullConfigBlock = (): string => {
    const rawKeyAvailable = !!createdKeyData?.raw_key
    const apiKeyValue = rawKeyAvailable
      ? createdKeyData!.raw_key
      : activeKey
        ? `[ATENÇÃO: Chave mestra ativa detectada (prefixo ${activeKey.key_prefix}). Como o segredo completo só aparece no momento da emissão, use a chave mestra armazenada pelo superadmin ou gere uma nova chave mestra no painel Superadmin > Prefeituras.]`
        : `[ATENÇÃO: Nenhuma chave mestra ativa encontrada. Solicite ao Superadministrador a geração da chave mestra da prefeitura.]`

    const curlToken = rawKeyAvailable
      ? createdKeyData!.raw_key
      : activeKey
        ? `<SUA_CHAVE_MESTRA_PREFIXO_${activeKey.key_prefix}>`
        : '<CHAVE_MESTRA_DA_PREFEITURA>'

    const actingUserExample = user?.email || 'servidor@prefeitura.gov.br'

    return `================================================================================
CONFIGURAÇÃO COMPLETA DE INTEGRAÇÃO — AGENTE HERMES & BÚSSOLA JURÍDICA MUNICIPAL 2.0
Município: ${tenantName || 'Prefeitura Vinculada'} (ID: ${tenantId})
Modelo de Chaves: Chave Mestra por Prefeitura (Gerada exclusivamente pelo Superadmin)
Autenticação Dinâmica: Cabeçalho X-Acting-User (E-mail cadastrado no Bússola)
Autorização: Validada ao vivo no Bússola por cargo permitido (tenants.hermes_allowed_roles)
Gerado por: ${user?.name || user?.email || 'Servidor Municipal'} (${userRoleLabel})
================================================================================

1. URL BASE DA API DO BOT
--------------------------------------------------------------------------------
URL Base: ${botApiBaseUrl}
Status de Teste: ${botApiBaseUrl}/ping (responde {"status":"ok","message":"Bot Read API is active and healthy"})
Cabeçalhos de Autenticação Obrigatórios:
  - Authorization: Bearer <chave_mestra_da_prefeitura>  (ou X-API-Key: <chave_mestra>)
  - X-Acting-User: <email_do_usuario_no_bussola>
Isolamento: 100% Multi-tenant com validação ao vivo de prefeitura ativa + vínculo ativo + cargo liberado. O município é fixado pela chave mestra (nenhum dado cruza prefeituras).

2. CHAVE MESTRA DA PREFEITURA (BUSSOLA_API_KEY)
--------------------------------------------------------------------------------
${rawKeyAvailable ? `Chave Mestra Gerada Nesta Sessão (Valor Completo):\n${createdKeyData!.raw_key}` : `Instrução para a Chave Mestra:\n${apiKeyValue}`}

3. VARIÁVEIS DE AMBIENTE PARA O DOCKER DO HERMES (SEM TELEGRAM_ALLOWED_USERS)
--------------------------------------------------------------------------------
No painel do Gerenciador Docker do seu Hermes (ou arquivo docker-compose / .env), configure as variáveis em "Ambiente".
NÃO use TELEGRAM_ALLOWED_USERS: o Hermes aceita qualquer usuário no Telegram e a validação de acesso é feita ao vivo pela API do Bússola via X-Acting-User.

BUSSOLA_API_URL=${botApiBaseUrl}
BUSSOLA_API_KEY=${rawKeyAvailable ? createdKeyData!.raw_key : '<COLE_AQUI_A_CHAVE_MESTRA_GERADA_PELO_SUPERADMIN>'}
BUSSOLA_TENANT_ID=${tenantId || ''}

4. DIRETRIZ CRÍTICA DE IDENTIDADE E AUTORIZAÇÃO (X-Acting-User)
--------------------------------------------------------------------------------
Como funciona o fluxo de autorização:
- O bot Hermes aceita qualquer usuário que iniciar uma conversa no Telegram.
- Na primeira mensagem / primeiro contato, o Hermes pergunta qual é o e-mail cadastrado pelo usuário na plataforma Bússola Jurídica.
- O Hermes confirma o e-mail informado e passa a usá-lo no cabeçalho HTTP "X-Acting-User" em todas as chamadas à API da prefeitura.
- Em cada requisição, a API do Bússola valida AO VIVO:
  1. Se a integração Hermes está ativada na prefeitura (hermes_enabled).
  2. Se o usuário existe, está ativo e possui vínculo ativo no município da chave mestra.
  3. Se o papel do vínculo ativo (prefeito, vice-prefeito, secretário, gestor, procurador, servidor ou admin) está marcado nas permissões da prefeitura (tenants.hermes_allowed_roles).
- Se qualquer uma dessas condições falhar, a API retorna HTTP 403 com a seguinte MENSAGEM GENÉRICA FIXA (sem diferenciar o motivo):
  "Acesso não autorizado ao Hermes para este município ou usuário."
- Sempre que receber HTTP 403 com essa mensagem genérica, o bot Hermes deve responder ao usuário no Telegram estritamente com essa mesma mensagem genérica:
  "Acesso não autorizado ao Hermes para este município ou usuário."

Exemplo de cabeçalho:
  X-Acting-User: ${actingUserExample}

5. CATÁLOGO DOS 9 ENDPOINTS COM EXEMPLOS DE CURL
--------------------------------------------------------------------------------

[1] Healthcheck / Ping
Endpoint: GET ${botApiBaseUrl}/ping
Permissão: Livre / Teste de conectividade da API
curl -X GET "${botApiBaseUrl}/ping"

[2] Informações de Identidade e Escopo do Usuário Operador
Endpoint: GET ${botApiBaseUrl}/info
Permissão: Chave mestra ativa + usuário com vínculo e cargo liberado
curl -X GET "${botApiBaseUrl}/info" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[3] Listagem de Projetos do Kanban
Endpoint: GET ${botApiBaseUrl}/projects[?coluna=...&prioridade=...&busca=...]
Permissão: Escopado dinamicamente pelo X-Acting-User (Admin/Prefeito/Secretário conforme RBAC; Servidor Comum vê os seus)
curl -X GET "${botApiBaseUrl}/projects?coluna=Elaborar%20DFD" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[4] Resumo Agregado do Kanban (Totais por Coluna e Prioridade)
Endpoint: GET ${botApiBaseUrl}/projects/summary
Permissão: Exclusivo Administradores Municipais. Outros usuários recebem 403.
curl -X GET "${botApiBaseUrl}/projects/summary" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[5] Listagem de Documentos de Formalização de Demanda (DFDs)
Endpoint: GET ${botApiBaseUrl}/dfds[?status=...]
Permissão: Escopado dinamicamente pelo X-Acting-User
curl -X GET "${botApiBaseUrl}/dfds" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[6] Detalhe de um DFD por ID
Endpoint: GET ${botApiBaseUrl}/dfds/{id}
Permissão: Admin vê qualquer um da prefeitura; Servidor comum apenas se for responsável
curl -X GET "${botApiBaseUrl}/dfds/SEU_ID_DFD" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[7] Monitoramento de Prazos e Gargalos
Endpoint: GET ${botApiBaseUrl}/deadlines
Permissão: Escopado dinamicamente pelo X-Acting-User
curl -X GET "${botApiBaseUrl}/deadlines" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[8] Servidores e Usuários do Município
Endpoint: GET ${botApiBaseUrl}/users
Permissão: Exclusivo Administradores Municipais. Outros perfis recebem 403.
curl -X GET "${botApiBaseUrl}/users" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[9] Notificações e Alertas Internos
Endpoint: GET ${botApiBaseUrl}/notifications[?nao_lidas=true&tipo=...]
Permissão: Escopado dinamicamente pelo X-Acting-User
curl -X GET "${botApiBaseUrl}/notifications?nao_lidas=true" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

6. SYSTEM PROMPT PRONTO PARA O AGENTE HERMES (EM PORTUGUÊS)
--------------------------------------------------------------------------------
Copie e cole as diretrizes abaixo no campo de System Prompt ou Instruções do seu Agente Hermes:

"""
Você é o Hermes, o assistente oficial de inteligência operacional da plataforma Bússola Jurídica Municipal 2.0 para a Prefeitura de ${tenantName || 'nosso município'}.

DIRETRIZES FUNDAMENTAIS:
1. IDIOMA E TONALIDADE:
   - Responda sempre em português brasileiro de forma clara, profissional, objetiva e segura.
   - Apresente informações organizadas com listas com marcadores, datas no padrão DD/MM/AAAA e destaques em negrito.

2. FLUXO DE IDENTIFICAÇÃO E TELEGRAM (SEM LISTA FIXA DE IDs):
   - Você aceita qualquer usuário que inicie conversa com você no Telegram.
   - Na primeira conversa com uma pessoa (ou se ainda não souber o e-mail dela), pergunte educadamente qual é o seu e-mail cadastrado na plataforma Bússola Jurídica Municipal.
   - Após a pessoa informar o e-mail, confirme-o e guarde-o na memória da sessão/conversa dessa pessoa.
   - Utilize esse e-mail no cabeçalho HTTP "X-Acting-User" em TODAS as chamadas que fizer à API da prefeitura.

3. COMUNICAÇÃO COM A API E CABEÇALHOS:
   - Sua URL base é: ${botApiBaseUrl}
   - Em todas as requisições HTTP aos endpoints da prefeitura, envie obrigatoriamente:
     Authorization: Bearer ${rawKeyAvailable ? createdKeyData!.raw_key : '$BUSSOLA_API_KEY'}
     X-Acting-User: <e-mail confirmado do usuário>

4. TRATAMENTO DE ACESSO E HTTP 403 (REGRA CRÍTICA):
   - A plataforma Bússola valida ao vivo no banco de dados se a prefeitura está ativada, se o usuário possui vínculo ativo neste município e se o seu cargo está autorizado pelo superadministrador (tenants.hermes_allowed_roles).
   - Se a API retornar HTTP 403 (ou mensagem contendo 'Acesso não autorizado ao Hermes para este município ou usuário.'), você DEVE responder ao usuário no Telegram EXATAMENTE com esta frase fixa, sem inventar explicações detalhadas ou deduções:
     "Acesso não autorizado ao Hermes para este município ou usuário."
   - Oriente a pessoa a procurar o administrador municipal ou o superadmin da plataforma para liberar o acesso do seu cargo.

5. RESPEITO AO ESCOPO DOS DADOS:
   - Jamais invente ou deduza dados municipais ou jurídicos. Toda informação deve vir estritamente dos retornos oficiais dos endpoints da Bússola.
   - Respeite o perfil do usuário retornado por GET /info (administradores têm visão completa; servidores comuns têm visão focada nos seus projetos e prazos).

6. ENDPOINTS DISPONÍVEIS:
   - GET ${botApiBaseUrl}/ping -> Verificação de integridade da API
   - GET ${botApiBaseUrl}/info -> Perfil do usuário operador, prefeitura e status
   - GET ${botApiBaseUrl}/projects -> Projetos no Kanban (filtros: coluna, prioridade, busca)
   - GET ${botApiBaseUrl}/projects/summary -> Resumo com contagem por coluna/prioridade (exclusivo Admins)
   - GET ${botApiBaseUrl}/dfds -> DFDs (Documentos de Formalização de Demanda)
   - GET ${botApiBaseUrl}/dfds/{id} -> Detalhes de um DFD específico
   - GET ${botApiBaseUrl}/deadlines -> Prazos vencidos, da semana e futuros
   - GET ${botApiBaseUrl}/users -> Lista de servidores municipais (exclusivo Admins)
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
      {/* Banner de Contexto do Novo Modelo de Chave Mestra */}
      <div className="rounded-lg bg-slate-900 text-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Modelo Centralizado de Integração Hermes
            </span>
          </div>
          <p className="text-sm font-bold text-white">
            Chave mestra exclusiva para{' '}
            <span className="text-blue-300">{tenantName || 'este município'}</span> com verificação
            dinâmica por <span className="text-amber-300 font-mono text-xs">X-Acting-User</span>
          </p>
          <p className="text-xs text-slate-300">
            Apenas o superadministrador gera a chave mestra da prefeitura. O Hermes envia a
            identidade de quem pergunta no Telegram e o Bússola aplica as permissões dele ao vivo.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-slate-700 bg-slate-800 text-slate-200 text-xs py-1"
          >
            Seu perfil: {userRoleLabel}
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
                <h3 className="text-sm font-bold text-[#1c2a3e]">Chave Mestra da Prefeitura</h3>
                <p className="text-xs text-gray-500">
                  {tenantName
                    ? `Uma chave mestra para ${tenantName}. Gerada exclusivamente pelo superadmin.`
                    : 'Uma chave mestra por município.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleCopyAllHermes}
                size="sm"
                variant="outline"
                className="border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 text-xs h-8 gap-1.5 font-medium shadow-none"
                title="Copia URL base, chave, os 9 endpoints com cURL, instruções X-Acting-User e o prompt do Hermes"
              >
                {copiedAllHermes ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-indigo-600" />
                )}
                Copiar tudo para o Hermes
              </Button>
              {isSuperadmin && (
                <Button
                  onClick={() => setCreateModalOpen(true)}
                  disabled={!hermesEnabled}
                  size="sm"
                  className="bg-[#1c2a3e] hover:bg-[#283b54] text-white text-xs h-8 gap-1.5 disabled:opacity-50"
                  title={
                    !hermesEnabled
                      ? 'Integração Hermes desativada para esta prefeitura.'
                      : undefined
                  }
                >
                  <Plus className="w-3.5 h-3.5" />
                  {activeKey ? 'Gerar Nova Chave Mestra' : 'Nova Chave Mestra'}
                </Button>
              )}
            </div>
          </div>

          {!hermesEnabled && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                A integração Hermes está desativada para esta prefeitura pelo superadministrador.
                Não é possível gerar chaves e os endpoints retornam 403 HERMES_DISABLED.
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
                {isSuperadmin
                  ? 'Nenhuma chave mestra gerada para esta prefeitura. Clique em "Nova Chave Mestra" acima.'
                  : 'Nenhuma chave mestra ativa gerada. Solicite ao Superadministrador a emissão da chave do município.'}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Chaves pessoais por usuário deixaram de existir; o Hermes opera com uma chave mestra
                municipal e identidade X-Acting-User.
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
                      <Badge
                        variant="outline"
                        className="text-[10px] px-2 py-0 h-4 border-indigo-200 text-indigo-700 bg-indigo-50 font-medium"
                      >
                        Chave Mestra Municipal
                      </Badge>
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

                  {isSuperadmin && (
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
                            <Ban className="w-3.5 h-3.5 mr-1" />
                          )}
                          Revogar
                        </Button>
                      )}
                    </div>
                  )}
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
                Toda chave mestra pertence exclusivamente a{' '}
                <strong>{tenantName || 'sua prefeitura'}</strong>. Mesmo que o Hermes envie um
                usuário de outro município no <code>X-Acting-User</code>, o acesso é automaticamente
                bloqueado com 403 Forbidden.
              </p>
            </div>

            <div className="rounded-lg bg-purple-50/60 border border-purple-100 p-3 text-xs text-purple-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Lock className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Identidade Dinâmica (X-Acting-User ao vivo)</span>
              </div>
              <p className="text-[11px] text-purple-700 leading-relaxed">
                O Hermes passa o e-mail de quem pergunta. O Bússola valida prefeitura ativa, vínculo
                ativo e cargo liberado no município. Se negado, devolve a mesma resposta genérica
                403.
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
                Como configurar seu bot no Telegram passo a passo com o modelo de chave mestra
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
                <span className="text-xs font-bold text-gray-800">Chave Mestra da Prefeitura</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                O superadmin gera a chave mestra em <strong>Superadmin &gt; Prefeituras</strong> e a
                cadastra em <code>BUSSOLA_API_KEY</code> no Docker do Hermes.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-gray-100 bg-gray-50/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1c2a3e] text-white text-[11px] font-bold flex items-center justify-center">
                  2
                </span>
                <span className="text-xs font-bold text-gray-800">Telegram: Qualquer Usuário</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Sem lista fixa (sem <code>TELEGRAM_ALLOWED_USERS</code>). Na primeira conversa, o
                bot pergunta o e-mail do Bússola, confirma-o e envia no <code>X-Acting-User</code>.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-gray-100 bg-gray-50/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1c2a3e] text-white text-[11px] font-bold flex items-center justify-center">
                  3
                </span>
                <span className="text-xs font-bold text-gray-800">Liberação por Cargo ao Vivo</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                A API valida prefeitura ativa + vínculo ativo + cargo autorizado. Se não autorizado,
                retorna HTTP 403 com resposta genérica fixa.
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
                  <strong>URL Base</strong> ({botApiBaseUrl}), a <strong>Chave Mestra</strong>, o
                  catálogo completo dos <strong>9 endpoints</strong> e o{' '}
                  <strong>Prompt do Agente</strong> instruindo o envio de{' '}
                  <strong>X-Acting-User</strong>.
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
                <em>Editor visual &gt; Ambiente</em>), configure:
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
                    size="icon"
                    onClick={() => copyToClipboard(botApiBaseUrl, 'env-api-url')}
                    className="h-7 w-7 shrink-0 text-gray-500 hover:text-indigo-600"
                    title="Copiar URL"
                  >
                    {copiedSnippet === 'env-api-url' ? (
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
                    <span className="text-[11px] text-gray-500 block truncate">
                      {createdKeyData?.raw_key
                        ? `${createdKeyData.raw_key.slice(0, 16)}...`
                        : activeKey
                          ? `${activeKey.key_prefix}... (chave ativa)`
                          : '<Chave Mestra do Superadmin>'}
                    </span>
                  </div>
                  {createdKeyData?.raw_key ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(createdKeyData.raw_key, 'env-api-key')}
                      className="h-7 w-7 shrink-0 text-gray-500 hover:text-indigo-600"
                      title="Copiar Chave Mestra"
                    >
                      {copiedSnippet === 'env-api-key' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="text-[10px] text-indigo-700/80 italic">
                * Não use TELEGRAM_ALLOWED_USERS. O Hermes aceita qualquer usuário e a validação é
                feita ao vivo via X-Acting-User.
              </p>
            </div>
          </div>

          {/* Exemplos Práticos de Perguntas ao Hermes */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>O que o Hermes responde para o seu perfil ({userRoleLabel})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {exampleQuestions.map((ex, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition-colors space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-800">"{ex.pergunta}"</p>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 h-4 border-gray-200 text-gray-600 shrink-0 font-medium"
                    >
                      {ex.permissao}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-500">{ex.dica}</p>
                  <p className="text-[10px] font-mono text-indigo-600 pt-0.5 truncate">
                    {ex.endpoint}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Catálogo de Endpoints */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                <FileCode className="w-4 h-4 text-blue-600" />
                <span>Catálogo Completo da API (9 Endpoints de Leitura)</span>
              </div>
              <span className="text-[11px] text-gray-400">
                Respostas JSON estruturadas para Agentes LLM
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {/* Endpoint 1 */}
              <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-600 text-white text-[10px] h-5 px-1.5">GET</Badge>
                    <code className="text-xs font-bold text-gray-800">/ping</code>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    Healthcheck / Conectividade (sem autenticação)
                  </span>
                </div>
                <div className="relative group">
                  <pre className="p-2.5 rounded bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto">
                    {`curl -X GET "${botApiBaseUrl}/ping"`}
                  </pre>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(`curl -X GET "${botApiBaseUrl}/ping"`, 'ep-ping')
                    }
                    className="absolute top-1.5 right-1.5 h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    {copiedSnippet === 'ep-ping' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Endpoint 2 */}
              <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-600 text-white text-[10px] h-5 px-1.5">GET</Badge>
                    <code className="text-xs font-bold text-gray-800">/info</code>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    Identidade e Escopo do Usuário Operador (X-Acting-User)
                  </span>
                </div>
                <div className="relative group">
                  <pre className="p-2.5 rounded bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto">
                    {`curl -X GET "${botApiBaseUrl}/info" \\
  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\
  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`}
                  </pre>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(
                        `curl -X GET "${botApiBaseUrl}/info" \\\n  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\\n  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`,
                        'ep-info',
                      )
                    }
                    className="absolute top-1.5 right-1.5 h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    {copiedSnippet === 'ep-info' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Endpoint 3 */}
              <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-600 text-white text-[10px] h-5 px-1.5">GET</Badge>
                    <code className="text-xs font-bold text-gray-800">/projects</code>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    Projetos do Kanban (filtros: coluna, prioridade, busca)
                  </span>
                </div>
                <div className="relative group">
                  <pre className="p-2.5 rounded bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto">
                    {`curl -X GET "${botApiBaseUrl}/projects?coluna=Elaborar%20DFD" \\
  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\
  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`}
                  </pre>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(
                        `curl -X GET "${botApiBaseUrl}/projects?coluna=Elaborar%20DFD" \\\n  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\\n  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`,
                        'ep-projects',
                      )
                    }
                    className="absolute top-1.5 right-1.5 h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    {copiedSnippet === 'ep-projects' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Endpoint 4 */}
              <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-600 text-white text-[10px] h-5 px-1.5">GET</Badge>
                    <code className="text-xs font-bold text-gray-800">/projects/summary</code>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-amber-800 text-[10px] h-4"
                  >
                    Exclusivo Administradores
                  </Badge>
                </div>
                <p className="text-[11px] text-gray-500">
                  Resumo quantitativo por coluna e nível de prioridade no município.
                </p>
                <div className="relative group">
                  <pre className="p-2.5 rounded bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto">
                    {`curl -X GET "${botApiBaseUrl}/projects/summary" \\
  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\
  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`}
                  </pre>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(
                        `curl -X GET "${botApiBaseUrl}/projects/summary" \\\n  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\\n  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`,
                        'ep-projects-summary',
                      )
                    }
                    className="absolute top-1.5 right-1.5 h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    {copiedSnippet === 'ep-projects-summary' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Endpoint 5 */}
              <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-600 text-white text-[10px] h-5 px-1.5">GET</Badge>
                    <code className="text-xs font-bold text-gray-800">/dfds</code>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    Documentos de Formalização de Demanda (DFDs)
                  </span>
                </div>
                <div className="relative group">
                  <pre className="p-2.5 rounded bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto">
                    {`curl -X GET "${botApiBaseUrl}/dfds?status=em_elaboracao" \\
  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\
  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`}
                  </pre>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(
                        `curl -X GET "${botApiBaseUrl}/dfds?status=em_elaboracao" \\\n  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\\n  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`,
                        'ep-dfds',
                      )
                    }
                    className="absolute top-1.5 right-1.5 h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    {copiedSnippet === 'ep-dfds' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Endpoint 6 */}
              <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-600 text-white text-[10px] h-5 px-1.5">GET</Badge>
                    <code className="text-xs font-bold text-gray-800">/dfds/:id</code>
                  </div>
                  <span className="text-[11px] text-gray-500">Detalhe Completo de um DFD</span>
                </div>
                <div className="relative group">
                  <pre className="p-2.5 rounded bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto">
                    {`curl -X GET "${botApiBaseUrl}/dfds/SEU_ID_DFD" \\
  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\
  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`}
                  </pre>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(
                        `curl -X GET "${botApiBaseUrl}/dfds/SEU_ID_DFD" \\\n  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\\n  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`,
                        'ep-dfds-id',
                      )
                    }
                    className="absolute top-1.5 right-1.5 h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    {copiedSnippet === 'ep-dfds-id' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Endpoint 7 */}
              <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-600 text-white text-[10px] h-5 px-1.5">GET</Badge>
                    <code className="text-xs font-bold text-gray-800">/deadlines</code>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    Monitoramento de Prazos Vencidos e Futuros
                  </span>
                </div>
                <div className="relative group">
                  <pre className="p-2.5 rounded bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto">
                    {`curl -X GET "${botApiBaseUrl}/deadlines" \\
  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\
  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`}
                  </pre>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(
                        `curl -X GET "${botApiBaseUrl}/deadlines" \\\n  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\\n  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`,
                        'ep-deadlines',
                      )
                    }
                    className="absolute top-1.5 right-1.5 h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    {copiedSnippet === 'ep-deadlines' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Endpoint 8 */}
              <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-600 text-white text-[10px] h-5 px-1.5">GET</Badge>
                    <code className="text-xs font-bold text-gray-800">/users</code>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-amber-800 text-[10px] h-4"
                  >
                    Exclusivo Administradores
                  </Badge>
                </div>
                <p className="text-[11px] text-gray-500">
                  Lista de servidores e procuradores ativos vinculados ao município.
                </p>
                <div className="relative group">
                  <pre className="p-2.5 rounded bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto">
                    {`curl -X GET "${botApiBaseUrl}/users" \\
  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\
  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`}
                  </pre>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(
                        `curl -X GET "${botApiBaseUrl}/users" \\\n  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\\n  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`,
                        'ep-users',
                      )
                    }
                    className="absolute top-1.5 right-1.5 h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    {copiedSnippet === 'ep-users' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Endpoint 9 */}
              <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-600 text-white text-[10px] h-5 px-1.5">GET</Badge>
                    <code className="text-xs font-bold text-gray-800">/notifications</code>
                  </div>
                  <span className="text-[11px] text-gray-500">Notificações e Avisos Internos</span>
                </div>
                <div className="relative group">
                  <pre className="p-2.5 rounded bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto">
                    {`curl -X GET "${botApiBaseUrl}/notifications?nao_lidas=true" \\
  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\
  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`}
                  </pre>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(
                        `curl -X GET "${botApiBaseUrl}/notifications?nao_lidas=true" \\\n  -H "Authorization: Bearer <BUSSOLA_API_KEY>" \\\n  -H "X-Acting-User: ${user?.email || 'servidor@prefeitura.gov.br'}"`,
                        'ep-notifications',
                      )
                    }
                    className="absolute top-1.5 right-1.5 h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    {copiedSnippet === 'ep-notifications' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Criar Nova Chave Mestra (Exclusivo Superadmin) */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar Nova Chave Mestra da Prefeitura</DialogTitle>
            <DialogDescription>
              Esta chave mestra autenticará o bot Hermes para o município de{' '}
              <strong>{tenantName || 'esta prefeitura'}</strong>. Guarde o segredo com segurança ao
              gerar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Identificação da Chave</Label>
              <Input
                id="key-name"
                placeholder={`Chave Mestra Hermes - ${tenantName || 'Prefeitura'}`}
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Aviso Importante
              </p>
              <p className="text-[11px] leading-relaxed">
                O valor completo da chave só é exibido uma vez, no momento da criação. Copie-o e
                configure no Docker do Hermes antes de fechar a janela.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateKey}
              disabled={creating}
              className="bg-[#1c2a3e] hover:bg-[#283b54] text-white"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Gerar Chave Mestra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Exibir Chave Recém-Criada (Uma única vez) */}
      <Dialog
        open={!!createdKeyData}
        onOpenChange={(open) => {
          if (!open) setCreatedKeyData(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <Check className="w-5 h-5 text-emerald-600" />
              Chave Mestra Gerada com Sucesso
            </DialogTitle>
            <DialogDescription>
              Copie o segredo agora. <strong>Ele não poderá ser visualizado novamente</strong> após
              fechar este diálogo.
            </DialogDescription>
          </DialogHeader>

          {createdKeyData && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Identificação / Prefixo:</Label>
                <p className="text-xs font-semibold text-gray-800">
                  {createdKeyData.name || `Prefixo: ${createdKeyData.key_prefix}`}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Chave Mestra Secreta (raw_key):</Label>
                <div className="p-3 rounded-lg bg-slate-900 text-emerald-400 font-mono text-xs break-all border border-slate-800 flex items-start justify-between gap-2">
                  <span>{createdKeyData.raw_key}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(createdKeyData.raw_key)}
                    className="h-6 w-6 text-slate-400 hover:text-white shrink-0 hover:bg-slate-800"
                  >
                    {copiedKey ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-xs text-indigo-900 space-y-2">
                <p className="font-semibold flex items-center gap-1.5 text-indigo-950">
                  <Terminal className="w-4 h-4 text-indigo-600" />
                  Próximos Passos no Hermes
                </p>
                <p className="text-[11px] leading-relaxed text-indigo-800">
                  Configure no painel Docker do Hermes a variável <code>BUSSOLA_API_KEY</code> com o
                  valor acima. Clique no botão abaixo para copiar todas as variáveis e catálogo de
                  uma só vez.
                </p>
                <Button
                  type="button"
                  onClick={handleCopyAllHermes}
                  size="sm"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5"
                >
                  {copiedAllHermes ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copiar pacote completo para o Hermes
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              className="bg-[#1c2a3e] hover:bg-[#283b54] text-white"
              onClick={() => setCreatedKeyData(null)}
            >
              Concluído
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
