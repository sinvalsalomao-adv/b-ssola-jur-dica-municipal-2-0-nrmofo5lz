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

  const actingUserExample = user?.email || user?.id || 'servidor@prefeitura.gov.br'
  const sampleToken = createdKeyData
    ? createdKeyData.raw_key
    : activeKey
      ? activeKey.key_prefix
      : 'bjm_chaveMestra...'


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
curl -X GET "${botApiBaseUrl}/info" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[3] Listagem de Projetos do Kanban
Endpoint: GET ${botApiBaseUrl}/projects[?coluna=...&prioridade=...&busca=...]
Permissão: Escopado dinamicamente pelo X-Acting-User (Admin/Prefeito/Secretário conforme RBAC; Servidor Comum vê os seus)
curl -X GET "${botApiBaseUrl}/projects?coluna=Elaborar%20DFD" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[4] Resumo Agregado do Kanban (Totais por Coluna e Prioridade)
Endpoint: GET ${botApiBaseUrl}/projects/summary
Permissão: Exclusivo Administradores Municipais. Outros usuários recebem 403.
curl -X GET "${botApiBaseUrl}/projects/summary" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[5] Listagem de Documentos de Formalização de Demanda (DFDs)
Endpoint: GET ${botApiBaseUrl}/dfds[?status=...]
Permissão: Escopado dinamicamente pelo X-Acting-User
curl -X GET "${botApiBaseUrl}/dfds" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[6] Detalhe de um DFD por ID
Endpoint: GET ${botApiBaseUrl}/dfds/{id}
Permissão: Admin vê qualquer um da prefeitura; Servidor comum apenas se for responsável
curl -X GET "${botApiBaseUrl}/dfds/SEU_ID_DFD" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[7] Monitoramento de Prazos e Gargalos
Endpoint: GET ${botApiBaseUrl}/deadlines
Permissão: Escopado dinamicamente pelo X-Acting-User
curl -X GET "${botApiBaseUrl}/deadlines" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[8] Servidores e Usuários do Município
Endpoint: GET ${botApiBaseUrl}/users
Permissão: Exclusivo Administradores Municipais. Outros perfis recebem 403.
curl -X GET "${botApiBaseUrl}/users" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[9] Notificações e Alertas Internos
Endpoint: GET ${botApiBaseUrl}/notifications[?nao_lidas=true&tipo=...]
Permissão: Escopado dinamicamente pelo X-Acting-User
curl -X GET "${botApiBaseUrl}/notifications?nao_lidas=true" \
  -H "Authorization: Bearer ${curlToken}" \
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
=======

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
curl -X GET "${botApiBaseUrl}/info" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[3] Listagem de Projetos do Kanban
Endpoint: GET ${botApiBaseUrl}/projects[?coluna=...&prioridade=...&busca=...]
Permissão: Escopado dinamicamente pelo X-Acting-User (Admin/Prefeito/Secretário conforme RBAC; Servidor Comum vê os seus)
curl -X GET "${botApiBaseUrl}/projects?coluna=Elaborar%20DFD" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[4] Resumo Agregado do Kanban (Totais por Coluna e Prioridade)
Endpoint: GET ${botApiBaseUrl}/projects/summary
Permissão: Exclusivo Administradores Municipais. Outros usuários recebem 403.
curl -X GET "${botApiBaseUrl}/projects/summary" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[5] Listagem de Documentos de Formalização de Demanda (DFDs)
Endpoint: GET ${botApiBaseUrl}/dfds[?status=...]
Permissão: Escopado dinamicamente pelo X-Acting-User
curl -X GET "${botApiBaseUrl}/dfds" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[6] Detalhe de um DFD por ID
Endpoint: GET ${botApiBaseUrl}/dfds/{id}
Permissão: Admin vê qualquer um da prefeitura; Servidor comum apenas se for responsável
curl -X GET "${botApiBaseUrl}/dfds/SEU_ID_DFD" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[7] Monitoramento de Prazos e Gargalos
Endpoint: GET ${botApiBaseUrl}/deadlines
Permissão: Escopado dinamicamente pelo X-Acting-User
curl -X GET "${botApiBaseUrl}/deadlines" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[8] Servidores e Usuários do Município
Endpoint: GET ${botApiBaseUrl}/users
Permissão: Exclusivo Administradores Municipais. Outros perfis recebem 403.
curl -X GET "${botApiBaseUrl}/users" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[9] Notificações e Alertas Internos
Endpoint: GET ${botApiBaseUrl}/notifications[?nao_lidas=true&tipo=...]
Permissão: Escopado dinamicamente pelo X-Acting-User
curl -X GET "${botApiBaseUrl}/notifications?nao_lidas=true" \
  -H "Authorization: Bearer ${curlToken}" \
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
=======
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
curl -X GET "${botApiBaseUrl}/info" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[3] Listagem de Projetos do Kanban
Endpoint: GET ${botApiBaseUrl}/projects[?coluna=...&prioridade=...&busca=...]
Permissão: Escopado dinamicamente pelo X-Acting-User (Admin/Prefeito/Secretário conforme RBAC; Servidor Comum vê os seus)
curl -X GET "${botApiBaseUrl}/projects?coluna=Elaborar%20DFD" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[4] Resumo Agregado do Kanban (Totais por Coluna e Prioridade)
Endpoint: GET ${botApiBaseUrl}/projects/summary
Permissão: Exclusivo Administradores Municipais. Outros usuários recebem 403.
curl -X GET "${botApiBaseUrl}/projects/summary" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[5] Listagem de Documentos de Formalização de Demanda (DFDs)
Endpoint: GET ${botApiBaseUrl}/dfds[?status=...]
Permissão: Escopado dinamicamente pelo X-Acting-User
curl -X GET "${botApiBaseUrl}/dfds" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[6] Detalhe de um DFD por ID
Endpoint: GET ${botApiBaseUrl}/dfds/{id}
Permissão: Admin vê qualquer um da prefeitura; Servidor comum apenas se for responsável
curl -X GET "${botApiBaseUrl}/dfds/SEU_ID_DFD" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[7] Monitoramento de Prazos e Gargalos
Endpoint: GET ${botApiBaseUrl}/deadlines
Permissão: Escopado dinamicamente pelo X-Acting-User
curl -X GET "${botApiBaseUrl}/deadlines" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[8] Servidores e Usuários do Município
Endpoint: GET ${botApiBaseUrl}/users
Permissão: Exclusivo Administradores Municipais. Outros perfis recebem 403.
curl -X GET "${botApiBaseUrl}/users" \
  -H "Authorization: Bearer ${curlToken}" \
  -H "X-Acting-User: ${actingUserExample}"

[9] Notificações e Alertas Internos
Endpoint: GET ${botApiBaseUrl}/notifications[?nao_lidas=true&tipo=...]
Permissão: Escopado dinamicamente pelo X-Acting-User
curl -X GET "${botApiBaseUrl}/notifications?nao_lidas=true" \
  -H "Authorization: Bearer ${curlToken}" \
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
=======
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


1. URL BASE DA API DO BOT
--------------------------------------------------------------------------------
URL Base: ${botApiBaseUrl}
Status de Teste: ${botApiBaseUrl}/ping (responde {"status":"ok","message":"Bot Read API is active and healthy"})
Cabeçalhos de Autenticação Obrigatórios:
  - Authorization: Bearer <chave_mestra_da_prefeitura>  (ou X-API-Key: <chave_mestra>)
  - X-Acting-User: <email_ou_id_do_usuario>
Isolamento: 100% Multi-tenant com RBAC ao vivo. O município é fixado pela chave mestra (nenhum dado cruza prefeituras) e o usuário operador é resolvido dinamicamente pelo cabeçalho X-Acting-User.

2. CHAVE MESTRA DA PREFEITURA (BUSSOLA_API_KEY)
--------------------------------------------------------------------------------
${rawKeyAvailable ? `Chave Mestra Gerada Nesta Sessão (Valor Completo):\n${createdKeyData!.raw_key}` : `Instrução para a Chave Mestra:\n${apiKeyValue}`}

3. VARIÁVEIS DE AMBIENTE PARA O DOCKER DO HERMES (HOSTINGER / .env)
--------------------------------------------------------------------------------
No painel do Gerenciador Docker do seu Hermes (ou arquivo docker-compose / .env), configure as variáveis em "Ambiente":

BUSSOLA_API_URL=${botApiBaseUrl}
BUSSOLA_API_KEY=${rawKeyAvailable ? createdKeyData!.raw_key : '<COLE_AQUI_A_CHAVE_MESTRA_GERADA_PELO_SUPERADMIN>'}
BUSSOLA_TENANT_ID=${tenantId || ''}

4. DIRETRIZ CRÍTICA DE IDENTIDADE (CABEÇALHO X-Acting-User)
--------------------------------------------------------------------------------
O Hermes deve enviar a identidade de QUEM PERGUNTA em cada requisição à API.
Formato: e-mail ou ID do usuário cadastrado na prefeitura do Bússola Jurídica.
Exemplo:
  X-Acting-User: ${actingUserExample}

Como funciona:
- Ao conversar com o usuário no Telegram, o Hermes identifica o e-mail ou ID dele no Bússola.
- Envia esse identificador no cabeçalho X-Acting-User.
- A API do Bússola calcula as permissões AO VIVO:
  * Admin Municipal ou Superadmin -> visão completa da prefeitura.
  * Servidor Comum -> apenas o que é dele (projetos onde é responsável, seus prazos e notificações). Resumos municipais (/summary) e lista de servidores (/users) retornam 403 Forbidden.
  * Usuário inexistente ou de outro município -> acesso negado (403 Forbidden).

5. CATÁLOGO DOS 9 ENDPOINTS COM EXEMPLOS DE CURL
--------------------------------------------------------------------------------

[1] Healthcheck / Ping
Endpoint: GET ${botApiBaseUrl}/ping
Permissão: Público / Teste de conectividade
curl -X GET "${botApiBaseUrl}/ping"

[2] Informações de Identidade e Escopo do Usuário Operador
Endpoint: GET ${botApiBaseUrl}/info
Permissão: Todas as chaves mestras válidas com X-Acting-User ativo
curl -X GET "${botApiBaseUrl}/info" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[3] Listagem de Projetos do Kanban
Endpoint: GET ${botApiBaseUrl}/projects[?coluna=...&prioridade=...&busca=...]
Permissão: Escopado dinamicamente pelo X-Acting-User (Admin vê todos; Comum vê apenas os seus)
curl -X GET "${botApiBaseUrl}/projects?coluna=Elaborar%20DFD" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[4] Resumo Agregado do Kanban (Totais por Coluna e Prioridade)
Endpoint: GET ${botApiBaseUrl}/projects/summary
Permissão: Exclusivo Administradores Municipais. Servidor comum recebe 403 Forbidden.
curl -X GET "${botApiBaseUrl}/projects/summary" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[5] Listagem de Documentos de Formalização de Demanda (DFDs)
Endpoint: GET ${botApiBaseUrl}/dfds[?status=...]
Permissão: Escopado dinamicamente pelo X-Acting-User (Admin vê todos; Comum vê os seus)
curl -X GET "${botApiBaseUrl}/dfds" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[6] Detalhe de um DFD por ID
Endpoint: GET ${botApiBaseUrl}/dfds/{id}
Permissão: Admin vê qualquer um da prefeitura; Comum vê apenas se for o responsável
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
Permissão: Exclusivo Administradores Municipais. Servidor comum recebe 403 Forbidden.
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

2. COMUNICAÇÃO COM A API E CABEÇALHO DE IDENTIDADE:
   - Sua URL base é: ${botApiBaseUrl}
   - Em todas as requisições HTTP, envie obrigatoriamente os dois cabeçalhos:
     Authorization: Bearer ${rawKeyAvailable ? createdKeyData!.raw_key : '$BUSSOLA_API_KEY'}
     X-Acting-User: <e-mail ou ID do usuário que está perguntando>
   - Identifique quem está conversando com você no Telegram (pelo e-mail do Bússola) e envie essa identidade em X-Acting-User.
   - Para inspecionar as permissões do usuário antes de responder a consultas complexas, faça uma chamada prévia a:
     GET ${botApiBaseUrl}/info com o header X-Acting-User correspondente.

3. RESPEITO ESTRITO AO RBAC E ESCOPO DE SEGURANÇA:
   - A Bússola Jurídica aplica as regras do usuário AO VIVO no banco de dados:
     * Administradores municipais têm visão integral dos projetos, prazos e métricas da prefeitura.
     * Servidores comuns visualizam apenas seus próprios projetos em /projects, seus DFDs em /dfds, seus prazos em /deadlines e suas notificações em /notifications.
   - Se um endpoint retornar HTTP 403 Forbidden (como /projects/summary ou /users para servidor comum), explique educadamente em português que a consulta agregada municipal é restrita a administradores e forneça a alternativa voltada aos projetos dele.
   - Nenhum dado cruza prefeituras: a prefeitura é fixada pela chave mestra. Usuários de outro município têm acesso negado automaticamente.
   - Jamais invente ou deduza dados jurídicos. Todas as respostas com dados da prefeitura devem ser baseadas estritamente nos retornos JSON recebidos dos endpoints oficiais da Bússola.

4. ENDPOINTS DISPONÍVEIS:
   - GET ${botApiBaseUrl}/ping -> Verificação de integridade
   - GET ${botApiBaseUrl}/info -> Perfil do usuário operador, prefeitura e colunas
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
=======
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
================================================================================

1. URL BASE DA API DO BOT
--------------------------------------------------------------------------------
URL Base: ${botApiBaseUrl}
Status de Teste: ${botApiBaseUrl}/ping (responde {"status":"ok","message":"Bot Read API is active and healthy"})
Cabeçalhos de Autenticação Obrigatórios:
  - Authorization: Bearer <chave_mestra_da_prefeitura>  (ou X-API-Key: <chave_mestra>)
  - X-Acting-User: <email_ou_id_do_usuario>
Isolamento: 100% Multi-tenant com RBAC ao vivo. O município é fixado pela chave mestra (nenhum dado cruza prefeituras) e o usuário operador é resolvido dinamicamente pelo cabeçalho X-Acting-User.

2. CHAVE MESTRA DA PREFEITURA (BUSSOLA_API_KEY)
--------------------------------------------------------------------------------
${rawKeyAvailable ? `Chave Mestra Gerada Nesta Sessão (Valor Completo):\n${createdKeyData!.raw_key}` : `Instrução para a Chave Mestra:\n${apiKeyValue}`}

3. VARIÁVEIS DE AMBIENTE PARA O DOCKER DO HERMES (HOSTINGER / .env)
--------------------------------------------------------------------------------
No painel do Gerenciador Docker do seu Hermes (ou arquivo docker-compose / .env), configure as variáveis em "Ambiente":

BUSSOLA_API_URL=${botApiBaseUrl}
BUSSOLA_API_KEY=${rawKeyAvailable ? createdKeyData!.raw_key : '<COLE_AQUI_A_CHAVE_MESTRA_GERADA_PELO_SUPERADMIN>'}
BUSSOLA_TENANT_ID=${tenantId || ''}

4. DIRETRIZ CRÍTICA DE IDENTIDADE (CABEÇALHO X-Acting-User)
--------------------------------------------------------------------------------
O Hermes deve enviar a identidade de QUEM PERGUNTA em cada requisição à API.
Formato: e-mail ou ID do usuário cadastrado na prefeitura do Bússola Jurídica.
Exemplo:
  X-Acting-User: ${actingUserExample}

Como funciona:
- Ao conversar com o usuário no Telegram, o Hermes identifica o e-mail ou ID dele no Bússola.
- Envia esse identificador no cabeçalho X-Acting-User.
- A API do Bússola calcula as permissões AO VIVO:
  * Admin Municipal ou Superadmin -> visão completa da prefeitura.
  * Servidor Comum -> apenas o que é dele (projetos onde é responsável, seus prazos e notificações). Resumos municipais (/summary) e lista de servidores (/users) retornam 403 Forbidden.
  * Usuário inexistente ou de outro município -> acesso negado (403 Forbidden).

5. CATÁLOGO DOS 9 ENDPOINTS COM EXEMPLOS DE CURL
--------------------------------------------------------------------------------

[1] Healthcheck / Ping
Endpoint: GET ${botApiBaseUrl}/ping
Permissão: Público / Teste de conectividade
curl -X GET "${botApiBaseUrl}/ping"

[2] Informações de Identidade e Escopo do Usuário Operador
Endpoint: GET ${botApiBaseUrl}/info
Permissão: Todas as chaves mestras válidas com X-Acting-User ativo
curl -X GET "${botApiBaseUrl}/info" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[3] Listagem de Projetos do Kanban
Endpoint: GET ${botApiBaseUrl}/projects[?coluna=...&prioridade=...&busca=...]
Permissão: Escopado dinamicamente pelo X-Acting-User (Admin vê todos; Comum vê apenas os seus)
curl -X GET "${botApiBaseUrl}/projects?coluna=Elaborar%20DFD" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[4] Resumo Agregado do Kanban (Totais por Coluna e Prioridade)
Endpoint: GET ${botApiBaseUrl}/projects/summary
Permissão: Exclusivo Administradores Municipais. Servidor comum recebe 403 Forbidden.
curl -X GET "${botApiBaseUrl}/projects/summary" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[5] Listagem de Documentos de Formalização de Demanda (DFDs)
Endpoint: GET ${botApiBaseUrl}/dfds[?status=...]
Permissão: Escopado dinamicamente pelo X-Acting-User (Admin vê todos; Comum vê os seus)
curl -X GET "${botApiBaseUrl}/dfds" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[6] Detalhe de um DFD por ID
Endpoint: GET ${botApiBaseUrl}/dfds/{id}
Permissão: Admin vê qualquer um da prefeitura; Comum vê apenas se for o responsável
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
Permissão: Exclusivo Administradores Municipais. Servidor comum recebe 403 Forbidden.
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

2. COMUNICAÇÃO COM A API E CABEÇALHO DE IDENTIDADE:
   - Sua URL base é: ${botApiBaseUrl}
   - Em todas as requisições HTTP, envie obrigatoriamente os dois cabeçalhos:
     Authorization: Bearer ${rawKeyAvailable ? createdKeyData!.raw_key : '$BUSSOLA_API_KEY'}
     X-Acting-User: <e-mail ou ID do usuário que está perguntando>
   - Identifique quem está conversando com você no Telegram (pelo e-mail do Bússola) e envie essa identidade em X-Acting-User.
   - Para inspecionar as permissões do usuário antes de responder a consultas complexas, faça uma chamada prévia a:
     GET ${botApiBaseUrl}/info com o header X-Acting-User correspondente.

3. RESPEITO ESTRITO AO RBAC E ESCOPO DE SEGURANÇA:
   - A Bússola Jurídica aplica as regras do usuário AO VIVO no banco de dados:
     * Administradores municipais têm visão integral dos projetos, prazos e métricas da prefeitura.
     * Servidores comuns visualizam apenas seus próprios projetos em /projects, seus DFDs em /dfds, seus prazos em /deadlines e suas notificações em /notifications.
   - Se um endpoint retornar HTTP 403 Forbidden (como /projects/summary ou /users para servidor comum), explique educadamente em português que a consulta agregada municipal é restrita a administradores e forneça a alternativa voltada aos projetos dele.
   - Nenhum dado cruza prefeituras: a prefeitura é fixada pela chave mestra. Usuários de outro município têm acesso negado automaticamente.
   - Jamais invente ou deduza dados jurídicos. Todas as respostas com dados da prefeitura devem ser baseadas estritamente nos retornos JSON recebidos dos endpoints oficiais da Bússola.

4. ENDPOINTS DISPONÍVEIS:
   - GET ${botApiBaseUrl}/ping -> Verificação de integridade
   - GET ${botApiBaseUrl}/info -> Perfil do usuário operador, prefeitura e colunas
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
=======
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
=======
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
================================================================================

1. URL BASE DA API DO BOT
--------------------------------------------------------------------------------
URL Base: ${botApiBaseUrl}
Status de Teste: ${botApiBaseUrl}/ping (responde {"status":"ok","message":"Bot Read API is active and healthy"})
Cabeçalhos de Autenticação Obrigatórios:
  - Authorization: Bearer <chave_mestra_da_prefeitura>  (ou X-API-Key: <chave_mestra>)
  - X-Acting-User: <email_ou_id_do_usuario>
Isolamento: 100% Multi-tenant com RBAC ao vivo. O município é fixado pela chave mestra (nenhum dado cruza prefeituras) e o usuário operador é resolvido dinamicamente pelo cabeçalho X-Acting-User.

2. CHAVE MESTRA DA PREFEITURA (BUSSOLA_API_KEY)
--------------------------------------------------------------------------------
${rawKeyAvailable ? `Chave Mestra Gerada Nesta Sessão (Valor Completo):\n${createdKeyData!.raw_key}` : `Instrução para a Chave Mestra:\n${apiKeyValue}`}

3. VARIÁVEIS DE AMBIENTE PARA O DOCKER DO HERMES (HOSTINGER / .env)
--------------------------------------------------------------------------------
No painel do Gerenciador Docker do seu Hermes (ou arquivo docker-compose / .env), configure as variáveis em "Ambiente":

BUSSOLA_API_URL=${botApiBaseUrl}
BUSSOLA_API_KEY=${rawKeyAvailable ? createdKeyData!.raw_key : '<COLE_AQUI_A_CHAVE_MESTRA_GERADA_PELO_SUPERADMIN>'}
BUSSOLA_TENANT_ID=${tenantId || ''}

4. DIRETRIZ CRÍTICA DE IDENTIDADE (CABEÇALHO X-Acting-User)
--------------------------------------------------------------------------------
O Hermes deve enviar a identidade de QUEM PERGUNTA em cada requisição à API.
Formato: e-mail ou ID do usuário cadastrado na prefeitura do Bússola Jurídica.
Exemplo:
  X-Acting-User: ${actingUserExample}

Como funciona:
- Ao conversar com o usuário no Telegram, o Hermes identifica o e-mail ou ID dele no Bússola.
- Envia esse identificador no cabeçalho X-Acting-User.
- A API do Bússola calcula as permissões AO VIVO:
  * Admin Municipal ou Superadmin -> visão completa da prefeitura.
  * Servidor Comum -> apenas o que é dele (projetos onde é responsável, seus prazos e notificações). Resumos municipais (/summary) e lista de servidores (/users) retornam 403 Forbidden.
  * Usuário inexistente ou de outro município -> acesso negado (403 Forbidden).

5. CATÁLOGO DOS 9 ENDPOINTS COM EXEMPLOS DE CURL
--------------------------------------------------------------------------------

[1] Healthcheck / Ping
Endpoint: GET ${botApiBaseUrl}/ping
Permissão: Público / Teste de conectividade
curl -X GET "${botApiBaseUrl}/ping"

[2] Informações de Identidade e Escopo do Usuário Operador
Endpoint: GET ${botApiBaseUrl}/info
Permissão: Todas as chaves mestras válidas com X-Acting-User ativo
curl -X GET "${botApiBaseUrl}/info" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[3] Listagem de Projetos do Kanban
Endpoint: GET ${botApiBaseUrl}/projects[?coluna=...&prioridade=...&busca=...]
Permissão: Escopado dinamicamente pelo X-Acting-User (Admin vê todos; Comum vê apenas os seus)
curl -X GET "${botApiBaseUrl}/projects?coluna=Elaborar%20DFD" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[4] Resumo Agregado do Kanban (Totais por Coluna e Prioridade)
Endpoint: GET ${botApiBaseUrl}/projects/summary
Permissão: Exclusivo Administradores Municipais. Servidor comum recebe 403 Forbidden.
curl -X GET "${botApiBaseUrl}/projects/summary" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[5] Listagem de Documentos de Formalização de Demanda (DFDs)
Endpoint: GET ${botApiBaseUrl}/dfds[?status=...]
Permissão: Escopado dinamicamente pelo X-Acting-User (Admin vê todos; Comum vê os seus)
curl -X GET "${botApiBaseUrl}/dfds" \\
  -H "Authorization: Bearer ${curlToken}" \\
  -H "X-Acting-User: ${actingUserExample}"

[6] Detalhe de um DFD por ID
Endpoint: GET ${botApiBaseUrl}/dfds/{id}
Permissão: Admin vê qualquer um da prefeitura; Comum vê apenas se for o responsável
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
Permissão: Exclusivo Administradores Municipais. Servidor comum recebe 403 Forbidden.
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

2. COMUNICAÇÃO COM A API E CABEÇALHO DE IDENTIDADE:
   - Sua URL base é: ${botApiBaseUrl}
   - Em todas as requisições HTTP, envie obrigatoriamente os dois cabeçalhos:
     Authorization: Bearer ${rawKeyAvailable ? createdKeyData!.raw_key : '$BUSSOLA_API_KEY'}
     X-Acting-User: <e-mail ou ID do usuário que está perguntando>
   - Identifique quem está conversando com você no Telegram (pelo e-mail do Bússola) e envie essa identidade em X-Acting-User.
   - Para inspecionar as permissões do usuário antes de responder a consultas complexas, faça uma chamada prévia a:
     GET ${botApiBaseUrl}/info com o header X-Acting-User correspondente.

3. RESPEITO ESTRITO AO RBAC E ESCOPO DE SEGURANÇA:
   - A Bússola Jurídica aplica as regras do usuário AO VIVO no banco de dados:
     * Administradores municipais têm visão integral dos projetos, prazos e métricas da prefeitura.
     * Servidores comuns visualizam apenas seus próprios projetos em /projects, seus DFDs em /dfds, seus prazos em /deadlines e suas notificações em /notifications.
   - Se um endpoint retornar HTTP 403 Forbidden (como /projects/summary ou /users para servidor comum), explique educadamente em português que a consulta agregada municipal é restrita a administradores e forneça a alternativa voltada aos projetos dele.
   - Nenhum dado cruza prefeituras: a prefeitura é fixada pela chave mestra. Usuários de outro município têm acesso negado automaticamente.
   - Jamais invente ou deduza dados jurídicos. Todas as respostas com dados da prefeitura devem ser baseadas estritamente nos retornos JSON recebidos dos endpoints oficiais da Bússola.

4. ENDPOINTS DISPONÍVEIS:
   - GET ${botApiBaseUrl}/ping -> Verificação de integridade
   - GET ${botApiBaseUrl}/info -> Perfil do usuário operador, prefeitura e colunas
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
                ativo e cargo liberado no município. Se negado, devolve a mesma resposta genérica 403.
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
                Sem lista fixa (sem <code>TELEGRAM_ALLOWED_USERS</code>). Na primeira conversa, o bot pergunta o e-mail do Bússola, confirma-o e envia no <code>X-Acting-User</code>.
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
                A API valida prefeitura ativa + vínculo ativo + cargo autorizado. Se não autorizado, retorna HTTP 403 com resposta genérica fixa.
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
                          ? `Chave mestra ativa (${activeKey.key_prefix}...)`
                          : 'Gerada pelo Superadmin')
                      }
                    >
                      {createdKeyData?.raw_key ||
                        (activeKey
                          ? `Chave mestra (${activeKey.key_prefix}...)`
                          : '<CHAVE_MESTRA_DA_PREFEITURA>')}
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
                            ? `Chave mestra ativa: ${activeKey.key_prefix}. O valor bruto completo só é visível ao superadmin no momento da criação.`
                            : 'Solicite ao Superadmin a emissão da chave mestra da prefeitura.',
                        )
                      }
                    }}
                    title={
                      createdKeyData?.raw_key ? 'Copiar chave mestra' : 'Instrução sobre a chave'
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
              Autenticação: <code>Authorization: Bearer &lt;chave_mestra&gt;</code> e cabeçalho
              obrigatório <code>X-Acting-User: &lt;email_ou_id_do_usuario&gt;</code>.
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
                          `curl -H "Authorization: Bearer ${sampleToken}" -H "X-Acting-User: ${actingUserExample}" "${baseUrl}${q.endpoint}"`,
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
                        versao: '0.0.109',
                        municipio: {
                          id: tenantId,
                          nome: tenantName || 'Prefeitura de Exemplo',
                          slug: 'prefeitura-exemplo',
                          hermes_enabled: true,
                        },
                        chave_mestra: {
                          tipo: 'chave_mestra_prefeitura',
                        },
                        usuario_operador: {
                          id: user?.id || 'usr_123',
                          nome: user?.name || 'Servidor Municipal',
                          email: user?.email || 'servidor@prefeitura.gov.br',
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
                {`// GET /backend/v1/bot/info (com X-Acting-User: ${actingUserExample})
{
  "status": "ok",
  "sistema": "Bússola Jurídica Municipal 2.0",
  "versao": "0.0.109",
  "municipio": {
    "id": "${tenantId}",
    "nome": "${tenantName || 'Prefeitura de Exemplo'}",
    "hermes_enabled": true
  },
  "chave_mestra": {
    "tipo": "chave_mestra_prefeitura"
  },
  "usuario_operador": {
    "id": "${user?.id || 'usr_123'}",
    "nome": "${user?.name || 'Servidor'}",
    "email": "${actingUserExample}",
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

      {/* Modal para Gerar Nova Chave Mestra (Exclusivo Superadmin) */}
      {isSuperadmin && (
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-[#1c2a3e]">
                Gerar Chave Mestra da Prefeitura
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Gera a chave mestra para <strong>{tenantName || 'esta prefeitura'}</strong>.
                Qualquer chave mestra anterior ativa será <strong>revogada automaticamente</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Identificação da Chave
                </Label>
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder={`Ex.: Chave Mestra Hermes - ${tenantName || 'Prefeitura'}`}
                  className="mt-1 text-xs"
                />
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-xs text-blue-800 space-y-1">
                <p className="font-semibold text-blue-900">Modelo de Integração:</p>
                <p className="text-[11px] text-blue-700">
                  • Prefeituras: <strong>{tenantName || 'Selecionada'}</strong>
                  <br />• Chave única mestra. O Hermes informará <strong>X-Acting-User</strong> a
                  cada consulta e a API validará os cargos liberados.
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
                Gerar Chave Mestra
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal para Exibição Única da Chave Secreta */}
      <Dialog open={!!createdKeyData} onOpenChange={() => setCreatedKeyData(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              <Key className="w-5 h-5" />
            </div>
            <DialogTitle className="text-sm font-bold text-[#1c2a3e]">
              Guarde a Chave Mestra com Segurança
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Esta chave mestra <strong>não será exibida novamente</strong>. Copie-a agora e
              configure no Hermes.
            </DialogDescription>
          </DialogHeader>

          {createdKeyData && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  Chave Mestra de API (Secret Token)
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
                    Copie a URL base, esta chave mestra recém-gerada, variáveis Docker e o prompt do
                    Hermes com instruções X-Acting-User.
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
                  Tipo: <strong>Chave Mestra Municipal</strong>
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
                  ficará visível. Caso perca esta chave, o superadmin precisará gerar uma nova.
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
