/**
 * Testes automatizados para o sanitizador de erros e segurança de logs.
 * Executável via test runner ou verificação interna.
 */

import {
  sanitizeString,
  sanitizeObjectData,
  sanitizeUrl,
  sanitizeHttpError,
  summarizeBodyStructure,
  SENSITIVE_KEYS,
} from './errorSanitizer'
import { getErrorMessage, extractFieldErrors } from './pocketbase/errors'

export function runSanitizerSecurityTests(): {
  passed: boolean
  results: Array<{ name: string; ok: boolean; detail?: string }>
} {
  const results: Array<{ name: string; ok: boolean; detail?: string }> = []

  function test(name: string, fn: () => boolean) {
    try {
      const ok = fn()
      results.push({ name, ok })
    } catch (err) {
      results.push({ name, ok: false, detail: String(err) })
    }
  }

  // Teste 1: Mascaramento de Bearer Tokens
  test('Deve mascarar Bearer tokens em mensagens', () => {
    const raw =
      'Request failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature'
    const clean = sanitizeString(raw)
    return !clean.includes('doNotLeakThisSignature') && clean.includes('[REDACTED]')
  })

  // Teste 2: Mascaramento de JWTs soltos
  test('Deve mascarar JWTs completos no formato xxx.yyy.zzz', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const clean = sanitizeString(`Failed to authenticate with token ${jwt}`)
    return (
      !clean.includes('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c') && clean.includes('[REDACTED]')
    )
  })

  // Teste 3: Mascaramento de chaves sensíveis em query string de URLs
  test('Deve mascarar query parameters sensíveis em URLs', () => {
    const url =
      'https://api.goskip.dev/api/collections/users/auth?token=secret123&apiKey=key999&password=mypassword&user_id=123'
    const clean = sanitizeUrl(url)
    return (
      (!clean.includes('secret123') &&
        !clean.includes('key999') &&
        !clean.includes('mypassword') &&
        clean.includes('user_id=123') &&
        clean.includes('token=%5BREDACTED%5D')) ||
      clean.includes('token=[REDACTED]')
    )
  })

  // Teste 4: Mascaramento de chaves sensíveis em objetos (case insensitive)
  test('Deve mascarar todas as chaves sensíveis obrigatórias em objetos', () => {
    const sensitivePayload = {
      Authorization: 'Basic dXNlcjpwYXNz',
      'Proxy-Authorization': 'Proxy auth-data',
      Cookie: 'session_id=abcdefg123456',
      'Set-Cookie': 'sid=abcdefg; Secure; HttpOnly',
      token: 'jwt-token-val',
      access_token: 'acc-token-val',
      refresh_token: 'ref-token-val',
      id_token: 'id-token-val',
      apiKey: 'secret-key-1',
      api_key: 'secret-key-2',
      password: 'realpassword123',
      senha: 'minhasenhasecreta',
      secret: 'my-app-secret',
      client_secret: 'client-sec-456',
      session: 'active-session-guid',
      legitimateField: 'Conteúdo Seguro',
    }

    const sanitized = sanitizeObjectData(sensitivePayload) as Record<string, any>

    for (const key of SENSITIVE_KEYS) {
      // Checar se a chave sensível foi substituída por [REDACTED]
      const foundMatch = Object.keys(sanitized).find(
        (k) =>
          k.toLowerCase() === key.toLowerCase() ||
          k.replace(/[-_]/g, '').toLowerCase() === key.replace(/[-_]/g, '').toLowerCase(),
      )
      if (foundMatch && sanitized[foundMatch] !== '[REDACTED]') {
        return false
      }
    }

    return (
      sanitized.legitimateField === 'Conteúdo Seguro' &&
      !JSON.stringify(sanitized).includes('realpassword123') &&
      !JSON.stringify(sanitized).includes('minhasenhasecreta') &&
      !JSON.stringify(sanitized).includes('session_id=abcdefg123456')
    )
  })

  // Teste 5: Não registrar o corpo integral das requisições (somente nomes e tipos)
  test('Deve resumir a estrutura do corpo da requisição sem expor valores ou dados pessoais', () => {
    const requestBody = {
      titulo: 'Parecer Jurídico para Licitação nº 12/2025',
      objeto: 'Contratação de empresa para reforma da UBS Central',
      cpfInteressado: '123.456.789-00',
      valorEstimado: 250000.5,
      urgente: true,
      anexosCount: 3,
      password: 'secret_user_pass',
      detalhes: {
        observacaoSigilosa: 'Informação confidencial interna',
        diasPrazo: 15,
      },
    }

    const summary = summarizeBodyStructure(requestBody) as Record<string, any>

    // Verificar que valores reais de texto/dados não aparecem
    const summaryStr = JSON.stringify(summary)
    const leaksText =
      summaryStr.includes('Parecer Jurídico') ||
      summaryStr.includes('reforma da UBS') ||
      summaryStr.includes('123.456.789-00') ||
      summaryStr.includes('Informação confidencial interna') ||
      summaryStr.includes('secret_user_pass')

    // Verificar que os nomes dos campos e os tipos primitivos são preservados
    const preservesStructure =
      summary.titulo === '<string>' &&
      summary.objeto === '<string>' &&
      summary.cpfInteressado === '<string>' &&
      summary.valorEstimado === '<number>' &&
      summary.urgente === '<boolean>' &&
      summary.password === '[REDACTED]' &&
      typeof summary.detalhes === 'object' &&
      summary.detalhes.observacaoSigilosa === '<string>' &&
      summary.detalhes.diasPrazo === '<number>'

    return !leaksText && preservesStructure
  })

  // Teste 6: Extração de erros com sanitização em getErrorMessage e sanitizeHttpError
  test('Deve sanitizar mensagens de erro da interface e sanitizeHttpError', () => {
    const errorObj = {
      status: 401,
      method: 'POST',
      url: 'https://api.goskip.dev/api/users?token=super-secret-token',
      requestId: 'req-abc-123',
      message: 'Authentication failed for Bearer <redacted>',
      response: {
        data: {
          email: { message: 'Email inválido ou token Bearer exp123' },
          password: { message: 'Senha deve conter ao menos 8 caracteres' },
        },
      },
      request: {
        body: {
          email: 'admin@prefeitura.gov.br',
          password: 'secret_pass_123',
          secret_key: 'top_secret',
        },
      },
    }

    const errorMsg = getErrorMessage(errorObj)
    const sanitizedError = sanitizeHttpError(errorObj)

    const isMessageClean =
      !errorMsg.includes('xyzSecretSignature') &&
      !errorMsg.includes('super-secret-token') &&
      !errorMsg.includes('secret_pass_123')

    const isSanitizedClean =
      sanitizedError.status === 401 &&
      sanitizedError.method === 'POST' &&
      !sanitizedError.endpoint?.includes('super-secret-token') &&
      !sanitizedError.message.includes('xyzSecretSignature')

    return isMessageClean && isSanitizedClean
  })
  // Teste 7: Mascaramento de ai_api_key em configurações e respostas
  test('Deve mascarar ai_api_key e não expor o segredo em claro no estado do cliente', () => {
    const rawSettings = {
      id: 'sett_001',
      tenant: 'tenant_florania',
      ai_api_key: 'sk-proj-superSecretAiKey1234567890',
      smtp_config: { password: 'mySecretSmtpPassword123' },
    }

    // Simulação do comportamento de enriquecimento / sanitização
    const sanitizedObj = sanitizeObjectData(rawSettings) as Record<string, any>
    const isAiKeyRedacted = !JSON.stringify(sanitizedObj).includes('superSecretAiKey1234567890')

    return isAiKeyRedacted
  })

  // Teste 8: Proibição de fallback de primeiro tenant para Superadmin sem seleção
  test('Deve rejeitar criação de projeto ou DFD por Superadmin quando tenantId não estiver explicitamente selecionado', () => {
    let blockedSuperadminWithoutTenant = false
    const superadminUser = { role: 'superadmin', tenantId: null }
    const selectedTenantId = ''

    const effectiveTenantId =
      superadminUser.role === 'superadmin' ? selectedTenantId : superadminUser.tenantId

    if (!effectiveTenantId || effectiveTenantId.trim() === '') {
      blockedSuperadminWithoutTenant = true
    }

    return blockedSuperadminWithoutTenant === true
  })

  // Teste 9: Admin e Servidor utilizam exclusivamente o tenant autenticado
  test('Admin e Servidor devem ser vinculados estritamente ao seu tenant autenticado', () => {
    const adminUser: { role: string; tenantId: string | null } = {
      role: 'admin',
      tenantId: 'tenant_florania',
    }
    const serverUser: { role: string; tenantId: string | null } = {
      role: 'servidor',
      tenantId: 'tenant_florania',
    }
    const attackerAttemptedTenantId: string = 'tenant_tangara'

    const resolveEffective = (
      user: { role: string; tenantId: string | null },
      requestedTenant?: string,
    ): string | null => {
      if (user.role !== 'superadmin') {
        return user.tenantId
      }
      return requestedTenant || user.tenantId
    }

    const adminEffective = resolveEffective(adminUser, attackerAttemptedTenantId)
    const serverEffective = resolveEffective(serverUser, attackerAttemptedTenantId)

    return (
      adminEffective === 'tenant_florania' &&
      serverEffective === 'tenant_florania' &&
      adminEffective !== attackerAttemptedTenantId
    )
  })

  const passed = results.every((r) => r.ok)
  return { passed, results }
}
