import pb from '@/lib/pocketbase/client'

export interface BotApiKey {
  id: string
  tenant: string
  name: string
  key_prefix: string
  status: 'ativa' | 'revogada'
  user?: string | null
  user_name?: string
  user_email?: string
  role_snapshot?: string | null
  last_used_at?: string | null
  created: string
  updated: string
  raw_key?: string // Presente apenas no retorno da criação
}

export interface CreateBotKeyResponse {
  id: string
  tenant: string
  tenant_name?: string
  name: string
  key_prefix: string
  raw_key: string
  status: 'ativa'
  user: string
  user_name?: string
  role: string
  created: string
}

/**
 * Cria/gera a chave mestra de API para a prefeitura (exclusivo Superadmin).
 * Gerar nova chave revoga automaticamente a chave anterior da prefeitura.
 * A chave em texto claro é retornada apenas nesta resposta e nunca mais.
 */
export async function createBotApiKey(
  tenantId: string,
  name?: string,
): Promise<CreateBotKeyResponse> {
  const res = await pb.send<CreateBotKeyResponse>('/backend/v1/bot-keys/create', {
    method: 'POST',
    body: {
      tenant: tenantId,
      name: name || 'Chave Mestra Hermes',
    },
  })
  return res
}

/**
 * Lista as chaves mestras de API da prefeitura (exclusivo Superadmin).
 */
export async function listBotApiKeys(tenantId: string): Promise<BotApiKey[]> {
  const res = await pb.send<BotApiKey[]>('/backend/v1/bot-keys/list', {
    method: 'GET',
    query: {
      tenant: tenantId,
    },
  })
  return res || []
}

/**
 * Revoga uma chave mestra existente (exclusivo Superadmin).
 */
export async function revokeBotApiKey(
  keyId: string,
): Promise<{ success: boolean; id: string; status: string }> {
  const res = await pb.send<{ success: boolean; id: string; status: string }>(
    '/backend/v1/bot-keys/revoke',
    {
      method: 'POST',
      body: {
        id: keyId,
      },
    },
  )
  return res
}
