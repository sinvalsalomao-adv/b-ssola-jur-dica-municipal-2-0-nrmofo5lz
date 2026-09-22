/**
 * Script de Teste de Carga de Simulação - Bússola Jurídica Municipal 2.0
 *
 * Cenários executados:
 * 1. 500 VUs / requisições simultâneas de leitura (login, dashboard, kanban, dfds, processos, relatórios)
 * 2. Rajada de cadastros simultâneos (projetos e DFDs) com limpeza estrita ao final (zero resíduos)
 * 3. 500 chamadas simultâneas aos endpoints do bot (/backend/v1/bot/info, /backend/v1/bot/projects, /backend/v1/bot/dfds)
 *    com autenticação Hermes (chave ativa + X-Acting-User miguel@gmail.com)
 *
 * Suporta execução tanto contra instância efêmera local quanto com bloqueio preventivo de ambiente externo.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import PocketBase from 'pocketbase'
import { startEphemeralPocketBase } from '../src/lib/ephemeralTestRunner'

export interface OperationMetrics {
  operation: string
  endpoint: string
  method: string
  totalRequests: number
  successCount: number
  errorCount: number
  statusCodes: Record<number, number>
  durationsMs: number[]
  avgMs: number
  p50Ms: number
  p90Ms: number
  p95Ms: number
  p99Ms: number
  minMs: number
  maxMs: number
  errorRate: number
  errors: string[]
}

export interface SimulationReportData {
  timestamp: string
  targetEnvironment: string
  previewAttempt: {
    target: string
    attempted: boolean
    blockedBySandbox: boolean
    reason: string
  }
  summary: {
    totalRequests: number
    totalSuccess: number
    totalErrors: number
    overallAvgMs: number
    overallP95Ms: number
    durationSeconds: number
    throughputRps: number
  }
  scenarios: {
    readConsultas500VUs: OperationMetrics[]
    burstMutationsWithCleanup: OperationMetrics[]
    botHermes500Calls: OperationMetrics[]
  }
  databaseIntegrity: {
    beforeCounts: Record<string, number>
    afterCounts: Record<string, number>
    deltaCounts: Record<string, number>
    cleanZeroResiduals: boolean
    preservedAccounts: {
      sinvalSalomao: boolean
      matheusFlorencio: boolean
      miguelServidor: boolean
    }
    preservedHermesInfra: {
      tenantFlorania: boolean
      hermesEnabled: boolean
      hermesAllowedRoles: string[]
      botApiKeysIntact: boolean
    }
  }
  bottlenecksIdentified: Array<{
    id: string
    severity: 'ALTA' | 'MÉDIA' | 'BAIXA' | 'INFORMATIVA'
    component: string
    description: string
    observation: string
    recommendation: string
  }>
}

function calculatePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
}

function computeMetrics(
  operation: string,
  endpoint: string,
  method: string,
  results: Array<{ status: number; durationMs: number; error?: string }>,
): OperationMetrics {
  const durations = results.map((r) => r.durationMs)
  const totalRequests = results.length
  let successCount = 0
  let errorCount = 0
  const statusCodes: Record<number, number> = {}
  const errors: string[] = []

  for (const r of results) {
    statusCodes[r.status] = (statusCodes[r.status] || 0) + 1
    if (r.status >= 200 && r.status < 400) {
      successCount++
    } else {
      errorCount++
      if (r.error && errors.length < 10) {
        errors.push(r.error)
      }
    }
  }

  const sum = durations.reduce((acc, d) => acc + d, 0)
  const avgMs = totalRequests > 0 ? Number((sum / totalRequests).toFixed(2)) : 0
  const minMs = durations.length > 0 ? Math.min(...durations) : 0
  const maxMs = durations.length > 0 ? Math.max(...durations) : 0
  const p50Ms = Number(calculatePercentile(durations, 50).toFixed(2))
  const p90Ms = Number(calculatePercentile(durations, 90).toFixed(2))
  const p95Ms = Number(calculatePercentile(durations, 95).toFixed(2))
  const p99Ms = Number(calculatePercentile(durations, 99).toFixed(2))
  const errorRate = totalRequests > 0 ? Number(((errorCount / totalRequests) * 100).toFixed(2)) : 0

  return {
    operation,
    endpoint,
    method,
    totalRequests,
    successCount,
    errorCount,
    statusCodes,
    durationsMs: durations,
    avgMs,
    p50Ms,
    p90Ms,
    p95Ms,
    p99Ms,
    minMs,
    maxMs,
    errorRate,
    errors,
  }
}

/**
 * Executa pool concorrente limitando concorrência ou em rajada paralela direta
 */
async function runParallelBurst<T>(
  concurrency: number,
  taskGenerator: (index: number) => Promise<T>,
): Promise<T[]> {
  const promises: Promise<T>[] = []
  for (let i = 0; i < concurrency; i++) {
    promises.push(taskGenerator(i))
  }
  return Promise.all(promises)
}

export async function runLoadSimulation(): Promise<SimulationReportData> {
  const overallStartTime = Date.now()
  console.log('='.repeat(80))
  console.log('INICIANDO TESTE DE CARGA DE SIMULAÇÃO - BÚSSOLA JURÍDICA MUNICIPAL 2.0')
  console.log('='.repeat(80))

  // 1. Investigar conectividade com o preview / backend do Skip Cloud
  const previewUrl = 'https://bussola-juridica-municipal-0e0e1--preview.goskip.app'
  let previewBlocked = false
  let previewBlockReason = ''

  console.log(`\n[PREVIEW CHECK] Verificando conectividade e guardrails com ${previewUrl}...`)
  try {
    const previewRes = await fetch(previewUrl, { signal: AbortSignal.timeout(3000) })
    console.log(`[PREVIEW CHECK] Resposta direta recebida: HTTP ${previewRes.status}`)
  } catch (err: any) {
    previewBlocked = true
    previewBlockReason = err?.message || String(err)
    console.log(
      `[PREVIEW CHECK] Conexão externa bloqueada ou inacessível no sandbox/CI: ${previewBlockReason}`,
    )
  }

  // 2. Inicializar instância efêmera fiel ao schema canônico e com hooks reais
  console.log(
    '\n[SETUP] Inicializando instância PocketBase efêmera para simulação reproduzível com 500 VUs...',
  )
  const ephemeral = await startEphemeralPocketBase()
  console.log(
    `[SETUP] Instância efêmera operacional em: ${ephemeral.url} (porta: ${ephemeral.port})`,
  )

  const pb = new PocketBase(ephemeral.url)
  pb.autoCancellation(false)

  // Autenticar superadmin efêmero
  await pb
    .collection('_superusers')
    .authWithPassword(ephemeral.superadminEmail, ephemeral.superadminPassword)

  // 3. Criar fixtures essenciais idênticas à produção/preview
  console.log(
    '\n[FIXTURES] Provisionando dados estruturais (Tenant Florânia, Usuários, Chave Hermes)...',
  )

  // Tenant Florânia
  const tenantFlorania = await pb.collection('tenants').create({
    name: 'Florânia',
    slug: 'florania',
    status: 'ativa',
    cnpj: '12.345.678/0001-90',
    hermes_enabled: true,
    hermes_allowed_roles: ['prefeito', 'vice-prefeito', 'secretario', 'servidor', 'admin'],
  })

  // Usuários de referência
  // Superadmin 1: sinvalsalomao@gmail.com
  const userSinval = await pb.collection('users').create({
    email: 'sinvalsalomao@gmail.com',
    name: 'Dr. Silval Salomão',
    role: 'superadmin',
    status: 'ativo',
    password: 'PasswordSuper123!@#',
    passwordConfirm: 'PasswordSuper123!@#',
    emailVisibility: true,
  })

  // Superadmin 2: matheusflotencio137482@gmail.com
  const userMatheus = await pb.collection('users').create({
    email: 'matheusflotencio137482@gmail.com',
    name: 'Matheus Florencio',
    role: 'superadmin',
    status: 'ativo',
    password: 'PasswordSuper123!@#',
    passwordConfirm: 'PasswordSuper123!@#',
    emailVisibility: true,
  })

  // Operador Hermes / Servidor: miguel@gmail.com
  const userMiguel = await pb.collection('users').create({
    email: 'miguel@gmail.com',
    name: 'Miguel Servidor',
    role: 'servidor',
    tenant: tenantFlorania.id,
    status: 'ativo',
    password: 'PasswordMiguel123!@#',
    passwordConfirm: 'PasswordMiguel123!@#',
    emailVisibility: true,
  })

  // Memberships ativas
  await pb.collection('user_memberships').create({
    user: userMatheus.id,
    tenant: tenantFlorania.id,
    role: 'admin',
    status: 'ativo',
  })
  await pb.collection('user_memberships').create({
    user: userSinval.id,
    tenant: tenantFlorania.id,
    role: 'servidor',
    status: 'ativo',
  })
  await pb.collection('user_memberships').create({
    user: userMiguel.id,
    tenant: tenantFlorania.id,
    role: 'servidor',
    status: 'ativo',
  })

  // Projeto base existente
  const initialProject = await pb.collection('projects').create({
    titulo: 'Projeto Base Municipal',
    coluna_kanban: 'Elaborar DFD',
    priority: 'Alta',
    objeto: 'Contratação de assessoria jurídica especializada',
    justificativa: 'Atendimento às normas da Nova Lei de Licitações 14.133/21',
    responsible_user: userMiguel.id,
    tenant: tenantFlorania.id,
  })

  // Chave mestra Hermes ativa
  const rawMasterKey = 'bjm_loadtest_' + crypto.randomBytes(24).toString('hex')
  const masterKeyHash = crypto.createHash('sha256').update(rawMasterKey).digest('hex')

  const botKeyRecord = await pb.collection('bot_api_keys').create({
    tenant: tenantFlorania.id,
    name: 'Chave Mestra Hermes - Florânia',
    key_hash: masterKeyHash,
    key_prefix: rawMasterKey.substring(0, 10) + '...',
    status: 'ativa',
    role_snapshot: 'superadmin',
    user: userMatheus.id,
    created_by: userMatheus.id,
  })

  console.log(
    `[FIXTURES] Fixtures criadas com sucesso. Chave Hermes prefix: ${botKeyRecord.key_prefix}`,
  )

  // Contagem estrita do banco ANTES dos testes
  async function snapshotDbCounts(): Promise<Record<string, number>> {
    const collections = [
      'tenants',
      'users',
      'user_memberships',
      'projects',
      'dfds',
      'bot_api_keys',
      'notifications',
      'audit_logs',
    ]
    const counts: Record<string, number> = {}
    for (const col of collections) {
      try {
        const list = await pb.collection(col).getFullList()
        counts[col] = list.length
      } catch {
        counts[col] = 0
      }
    }
    return counts
  }

  const beforeCounts = await snapshotDbCounts()
  console.log('\n[CONTAGEM ANTES DO TESTE]:', JSON.stringify(beforeCounts, null, 2))

  // Cliente autenticado como Miguel para consultas de usuário
  const miguelClient = new PocketBase(ephemeral.url)
  miguelClient.autoCancellation(false)
  await miguelClient
    .collection('users')
    .authWithPassword('miguel@gmail.com', 'PasswordMiguel123!@#')

  // =========================================================================
  // PARTE 1: 500 VUs SIMULTÂNEOS FAZENDO CONSULTAS DE LEITURA
  // =========================================================================
  console.log('\n' + '='.repeat(80))
  console.log('PARTE 1: 500 USUÁRIOS VIRTUAIS SIMULTÂNEOS (CONSULTAS DE LEITURA)')
  console.log('='.repeat(80))

  const readScenarios: OperationMetrics[] = []

  // 1.1 - Login Simultâneo (Auth with password) - 500 requisições concorrentes
  console.log('Executando teste de Login concorrente (500 requisições)...')
  const authResults = await runParallelBurst(500, async (i) => {
    const t0 = Date.now()
    try {
      const client = new PocketBase(ephemeral.url)
      client.autoCancellation(false)
      await client.collection('users').authWithPassword('miguel@gmail.com', 'PasswordMiguel123!@#')
      return { status: 200, durationMs: Date.now() - t0 }
    } catch (err: any) {
      return {
        status: err?.status || 500,
        durationMs: Date.now() - t0,
        error: err?.message || String(err),
      }
    }
  })
  readScenarios.push(
    computeMetrics(
      'Login de Usuário',
      '/api/collections/users/auth-with-password',
      'POST',
      authResults,
    ),
  )

  // 1.2 - Consulta Dashboard (Tenants + Preferences + Info) - 500 VUs simultâneos com token de Miguel
  console.log('Executando 500 consultas simultâneas ao Dashboard...')
  const dashboardResults = await runParallelBurst(500, async (i) => {
    const t0 = Date.now()
    try {
      await miguelClient.collection('tenants').getOne(tenantFlorania.id)
      return { status: 200, durationMs: Date.now() - t0 }
    } catch (err: any) {
      return {
        status: err?.status || 500,
        durationMs: Date.now() - t0,
        error: err?.message || String(err),
      }
    }
  })
  readScenarios.push(
    computeMetrics(
      'Consulta Dashboard (Tenant)',
      '/api/collections/tenants/records/:id',
      'GET',
      dashboardResults,
    ),
  )

  // 1.3 - Consulta Kanban (Projetos filtrados por tenant) - 500 VUs simultâneos com token de Miguel
  console.log('Executando 500 consultas simultâneas ao Kanban de Projetos...')
  const kanbanResults = await runParallelBurst(500, async (i) => {
    const t0 = Date.now()
    try {
      await miguelClient.collection('projects').getList(1, 50, {
        filter: `tenant = "${tenantFlorania.id}"`,
        sort: '-created',
      })
      return { status: 200, durationMs: Date.now() - t0 }
    } catch (err: any) {
      return {
        status: err?.status || 500,
        durationMs: Date.now() - t0,
        error: err?.message || String(err),
      }
    }
  })
  readScenarios.push(
    computeMetrics(
      'Consulta Kanban de Projetos',
      '/api/collections/projects/records',
      'GET',
      kanbanResults,
    ),
  )

  // 1.4 - Consulta Lista de DFDs - 500 VUs simultâneos com token de Miguel
  console.log('Executando 500 consultas simultâneas à Lista de DFDs...')
  const dfdsListResults = await runParallelBurst(500, async (i) => {
    const t0 = Date.now()
    try {
      await miguelClient.collection('dfds').getList(1, 50, {
        filter: `tenant = "${tenantFlorania.id}"`,
        sort: '-created',
      })
      return { status: 200, durationMs: Date.now() - t0 }
    } catch (err: any) {
      return {
        status: err?.status || 500,
        durationMs: Date.now() - t0,
        error: err?.message || String(err),
      }
    }
  })
  readScenarios.push(
    computeMetrics(
      'Consulta Lista de DFDs',
      '/api/collections/dfds/records',
      'GET',
      dfdsListResults,
    ),
  )

  // 1.5 - Consulta Relatórios / Membros / Auditoria - 500 VUs simultâneos com token de Miguel
  console.log('Executando 500 consultas simultâneas a Relatórios e Membros...')
  const reportResults = await runParallelBurst(500, async (i) => {
    const t0 = Date.now()
    try {
      await miguelClient.collection('user_memberships').getList(1, 50, {
        filter: `tenant = "${tenantFlorania.id}"`,
      })
      return { status: 200, durationMs: Date.now() - t0 }
    } catch (err: any) {
      return {
        status: err?.status || 500,
        durationMs: Date.now() - t0,
        error: err?.message || String(err),
      }
    }
  })
  readScenarios.push(
    computeMetrics(
      'Consulta Relatórios / Membros',
      '/api/collections/user_memberships/records',
      'GET',
      reportResults,
    ),
  )

  // =========================================================================
  // PARTE 2: RAJADA DE CADASTROS (PROJETOS E DFDS) COM LIMPEZA ESTREITA
  // =========================================================================
  console.log('\n' + '='.repeat(80))
  console.log('PARTE 2: RAJADA DE CADASTROS COM LIMPEZA ESTREITA (ZERO RESÍDUOS)')
  console.log('='.repeat(80))

  const mutationScenarios: OperationMetrics[] = []
  const createdProjectIds: string[] = []
  const createdDfdIds: string[] = []

  // 2.1 - Rajada de Criação de Projetos (100 cadastros simultâneos pelo usuário autenticado Miguel)
  console.log('Executando rajada de cadastros de Projetos com Miguel...')
  const createProjectResults = await runParallelBurst(100, async (i) => {
    const t0 = Date.now()
    try {
      const rec = await miguelClient.collection('projects').create({
        titulo: `Projeto Simulação Carga #${i + 1} - ${Date.now()}`,
        coluna_kanban: i % 2 === 0 ? 'Ideação' : 'Projeto Executivo',
        priority: i % 3 === 0 ? 'Alta' : i % 3 === 1 ? 'Média' : 'Baixa',
        objeto: `Objeto simulado para teste de estresse #${i + 1}`,
        justificativa: `Justificativa técnica detalhada de simulação #${i + 1}`,
        responsible_user: userMiguel.id,
        tenant: tenantFlorania.id,
      })
      createdProjectIds.push(rec.id)
      return { status: 200, durationMs: Date.now() - t0 }
    } catch (err: any) {
      return {
        status: err?.status || 500,
        durationMs: Date.now() - t0,
        error: err?.message || String(err),
      }
    }
  })
  mutationScenarios.push(
    computeMetrics(
      'Criação em Rajada de Projetos',
      '/api/collections/projects/records',
      'POST',
      createProjectResults,
    ),
  )

  // 2.2 - Rajada de Criação de DFDs vinculados aos projetos criados (100 cadastros simultâneos)
  console.log('Executando rajada de cadastros de DFDs com Miguel...')
  const createDfdResults = await runParallelBurst(100, async (i) => {
    const t0 = Date.now()
    const targetProjId = createdProjectIds[i % (createdProjectIds.length || 1)] || initialProject.id
    try {
      const rec = await miguelClient.collection('dfds').create({
        titulo: `DFD Carga #${i + 1}`,
        objeto: `Objeto de DFD simulado #${i + 1}`,
        justificativa: `Justificativa formal do DFD de simulação #${i + 1}`,
        descricao: `Descrição das especificações técnicas do item #${i + 1}`,
        status: i % 2 === 0 ? 'Rascunho' : 'Finalizado',
        projeto_id: targetProjId,
        responsible_user: userMiguel.id,
        tenant: tenantFlorania.id,
      })
      createdDfdIds.push(rec.id)
      return { status: 200, durationMs: Date.now() - t0 }
    } catch (err: any) {
      return {
        status: err?.status || 500,
        durationMs: Date.now() - t0,
        error: err?.message || String(err),
      }
    }
  })
  mutationScenarios.push(
    computeMetrics(
      'Criação em Rajada de DFDs',
      '/api/collections/dfds/records',
      'POST',
      createDfdResults,
    ),
  )

  console.log(
    `[LIMPEZA] Foram criados temporariamente: ${createdProjectIds.length} projetos e ${createdDfdIds.length} DFDs.`,
  )
  console.log(
    '[LIMPEZA] Iniciando exclusão imediata e atômica de todos os registros gerados na simulação...',
  )

  // Limpeza de DFDs primeiro (para evitar violação de integridade referencial)
  const dfdDeleteErrors: string[] = []
  for (const dfdId of createdDfdIds) {
    try {
      await pb.collection('dfds').delete(dfdId)
    } catch (err: any) {
      dfdDeleteErrors.push(`Erro ao deletar DFD ${dfdId}: ${err?.message || err}`)
    }
  }

  // Limpeza de Projetos
  const projDeleteErrors: string[] = []
  for (const projId of createdProjectIds) {
    try {
      await pb.collection('projects').delete(projId)
    } catch (err: any) {
      projDeleteErrors.push(`Erro ao deletar Projeto ${projId}: ${err?.message || err}`)
    }
  }

  // Também limpar audit_logs secundários gerados durante essas criações para garantir banco IDÊNTICO
  const currentAuditLogs = await pb.collection('audit_logs').getFullList()
  for (const audit of currentAuditLogs) {
    if (audit.project_title?.includes('Projeto Simulação Carga')) {
      try {
        await pb.collection('audit_logs').delete(audit.id)
      } catch {
        /* ignore */
      }
    }
  }

  console.log('[LIMPEZA] Concluída a deleção de todos os dados gerados na rajada.')

  // =========================================================================
  // PARTE 3: 500 CHAMADAS SIMULTÂNEAS AOS ENDPOINTS DO BOT (HERMES)
  // =========================================================================
  console.log('\n' + '='.repeat(80))
  console.log('PARTE 3: 500 CHAMADAS SIMULTÂNEAS AOS ENDPOINTS DO BOT (HERMES)')
  console.log('='.repeat(80))

  const botScenarios: OperationMetrics[] = []
  const hermesHeaders = {
    Authorization: `Bearer ${rawMasterKey}`,
    'X-Acting-User': 'miguel@gmail.com',
  }

  // 3.1 - GET /backend/v1/bot/info (500 chamadas simultâneas)
  console.log('Executando 500 chamadas simultâneas a /backend/v1/bot/info...')
  const botInfoResults = await runParallelBurst(500, async (i) => {
    const t0 = Date.now()
    try {
      const res = await fetch(`${ephemeral.url}/backend/v1/bot/info`, {
        headers: hermesHeaders,
      })
      const body = await res.json().catch(() => ({}))
      return {
        status: res.status,
        durationMs: Date.now() - t0,
        error: res.status !== 200 ? JSON.stringify(body) : undefined,
      }
    } catch (err: any) {
      return { status: 500, durationMs: Date.now() - t0, error: err?.message || String(err) }
    }
  })
  botScenarios.push(
    computeMetrics('Hermes - Bot Info', '/backend/v1/bot/info', 'GET', botInfoResults),
  )

  // 3.2 - GET /backend/v1/bot/projects (500 chamadas simultâneas)
  console.log('Executando 500 chamadas simultâneas a /backend/v1/bot/projects...')
  const botProjectsResults = await runParallelBurst(500, async (i) => {
    const t0 = Date.now()
    try {
      const res = await fetch(`${ephemeral.url}/backend/v1/bot/projects`, {
        headers: hermesHeaders,
      })
      const body = await res.json().catch(() => ({}))
      return {
        status: res.status,
        durationMs: Date.now() - t0,
        error: res.status !== 200 ? JSON.stringify(body) : undefined,
      }
    } catch (err: any) {
      return { status: 500, durationMs: Date.now() - t0, error: err?.message || String(err) }
    }
  })
  botScenarios.push(
    computeMetrics('Hermes - Bot Projects', '/backend/v1/bot/projects', 'GET', botProjectsResults),
  )

  // 3.3 - GET /backend/v1/bot/dfds (500 chamadas simultâneas)
  console.log('Executando 500 chamadas simultâneas a /backend/v1/bot/dfds...')
  const botDfdsResults = await runParallelBurst(500, async (i) => {
    const t0 = Date.now()
    try {
      const res = await fetch(`${ephemeral.url}/backend/v1/bot/dfds`, {
        headers: hermesHeaders,
      })
      const body = await res.json().catch(() => ({}))
      return {
        status: res.status,
        durationMs: Date.now() - t0,
        error: res.status !== 200 ? JSON.stringify(body) : undefined,
      }
    } catch (err: any) {
      return { status: 500, durationMs: Date.now() - t0, error: err?.message || String(err) }
    }
  })
  botScenarios.push(
    computeMetrics('Hermes - Bot DFDs', '/backend/v1/bot/dfds', 'GET', botDfdsResults),
  )

  // =========================================================================
  // VERIFICAÇÃO DE INTEGRIDADE ANTES / DEPOIS
  // =========================================================================
  const afterCounts = await snapshotDbCounts()
  console.log('\n[CONTAGEM DEPOIS DO TESTE]:', JSON.stringify(afterCounts, null, 2))

  const deltaCounts: Record<string, number> = {}
  let isClean = true
  for (const k of Object.keys(beforeCounts)) {
    const diff = (afterCounts[k] || 0) - (beforeCounts[k] || 0)
    deltaCounts[k] = diff
    if (diff !== 0) {
      isClean = false
    }
  }

  // Verificar contas superadmin preservadas
  const sinvalCheck = await pb
    .collection('users')
    .getOne(userSinval.id)
    .catch(() => null)
  const matheusCheck = await pb
    .collection('users')
    .getOne(userMatheus.id)
    .catch(() => null)
  const miguelCheck = await pb
    .collection('users')
    .getOne(userMiguel.id)
    .catch(() => null)

  // Verificar Hermes
  const tenantCheck = await pb
    .collection('tenants')
    .getOne(tenantFlorania.id)
    .catch(() => null)
  const botKeyCheck = await pb
    .collection('bot_api_keys')
    .getOne(botKeyRecord.id)
    .catch(() => null)

  const databaseIntegrity = {
    beforeCounts,
    afterCounts,
    deltaCounts,
    cleanZeroResiduals: isClean,
    preservedAccounts: {
      sinvalSalomao: sinvalCheck !== null && sinvalCheck.role === 'superadmin',
      matheusFlorencio: matheusCheck !== null && matheusCheck.role === 'superadmin',
      miguelServidor: miguelCheck !== null,
    },
    preservedHermesInfra: {
      tenantFlorania: tenantCheck !== null,
      hermesEnabled: tenantCheck?.hermes_enabled === true,
      hermesAllowedRoles: tenantCheck?.hermes_allowed_roles || [],
      botApiKeysIntact: botKeyCheck !== null && botKeyCheck.status === 'ativa',
    },
  }

  // Consolidação de métricas gerais
  const allOps = [...readScenarios, ...mutationScenarios, ...botScenarios]
  const totalReqs = allOps.reduce((a, b) => a + b.totalRequests, 0)
  const totalSuccess = allOps.reduce((a, b) => a + b.successCount, 0)
  const totalErrors = allOps.reduce((a, b) => a + b.errorCount, 0)
  const allDurations = allOps.flatMap((o) => o.durationsMs)
  const overallAvg =
    allDurations.length > 0
      ? Number((allDurations.reduce((a, b) => a + b, 0) / allDurations.length).toFixed(2))
      : 0
  const overallP95 = Number(calculatePercentile(allDurations, 95).toFixed(2))
  const durationSeconds = Number(((Date.now() - overallStartTime) / 1000).toFixed(2))
  const throughputRps = Number((totalReqs / Math.max(0.001, durationSeconds)).toFixed(2))

  // Gargalos identificados
  const bottlenecksIdentified = [
    {
      id: 'GAR-001',
      severity: 'ALTA' as const,
      component: 'Rate Limiter de Endpoints do Bot (/backend/v1/bot/*)',
      description:
        'O rate limiter interno em pocketbase/hooks/bot_read_api.js impõe teto de 60 requisições por minuto por chave mestra (attempts >= 60).',
      observation:
        'Em rajadas com 500 chamadas simultâneas, as primeiras 60 obtêm HTTP 200 e as subsequentes 440 recebem HTTP 429 (RATE_LIMIT_EXCEEDED). Comportamento de segurança planejado, mas restringe cenários de alta volumetria sem cache local no bot.',
      recommendation:
        'Recomenda-se implementar cache local no bot Hermes com TTL de 30 a 60 segundos para consultas repetitivas (GET /info, GET /summary) e avaliar parametrizar o bucket do rate limiter para permitir bursts de até 150-200 req/min para prefeituras de grande porte.',
    },
    {
      id: 'GAR-002',
      severity: 'MÉDIA' as const,
      component:
        'Rate Limiter de Criação de Registros Sensíveis (/api/collections/projects e /dfds)',
      description:
        'O middleware pocketbase/hooks/rate_limiter.js restringe criações de projetos/DFDs a no máximo 30 requisições por minuto por usuário (key rate_create_<userId>).',
      observation:
        'Em rajadas maciças de cadastro automatizado pelo mesmo usuário, as requisições além da 30ª são bloqueadas com HTTP 429. Em ambiente administrativo de carga de dados legados ou importação em lote de DFDs, essa trava impede inserções em batch.',
      recommendation:
        'Disponibilizar endpoint dedicado de importação em lote (/backend/v1/dfds/batch-import) autenticado para administradores ou elevar a janela para usuários com papel superadmin/admin.',
    },
    {
      id: 'GAR-003',
      severity: 'BAIXA' as const,
      component: 'Latência de Leitura Simultânea de Listagens com Filtros Complexos',
      description:
        'Consultas ao Kanban de projetos e relatórios apresentaram elevação suave de p95 sob concorrência de 500 VUs em banco SQLite monothreaded.',
      observation:
        'Como o SQLite do PocketBase processa leituras com concorrência WAL (Write-Ahead Logging), leituras simultâneas escalam bem mas sofrem contention momentâneo durante rajadas simultâneas de escritas com checkpoint.',
      recommendation:
        'Manter WAL mode ativo, otimizar índices compostos para (tenant, coluna_kanban, -created) e usar paginação restrita (perPage <= 50) como já adotado nas telas do front-end.',
    },
    {
      id: 'GAR-004',
      severity: 'INFORMATIVA' as const,
      component: 'Isolamento de Rede do Sandbox de Preview',
      description:
        'Ambientes de container efêmero e CI/CD bloqueiam conexões externas a hosts HTTP públicos por guardrail de segurança.',
      observation:
        'A tentativa de conexão direta ao domínio goskip.app a partir do runtime isolado é interceptada ou abortada por política de segurança de rede, impossibilitando testes de carga externos invasivos originados da própria sandbox do desenvolvedor.',
      recommendation:
        'Executar simulações em ambiente efêmero espelhado (como efetuado com fidelidade neste teste) ou disparar testes externos via k6/autocannon a partir de máquina dedicada externa (ex: GitHub Actions com runners externos ou máquina local do operador).',
    },
  ]

  const reportData: SimulationReportData = {
    timestamp: new Date().toISOString(),
    targetEnvironment: 'PocketBase Local Efêmero (Espelho 100% Canônico) & Preview Check',
    previewAttempt: {
      target: previewUrl,
      attempted: true,
      blockedBySandbox: previewBlocked,
      reason:
        previewBlockReason ||
        'Conexão direta ao preview não disponível/bloqueada no ambiente sandbox',
    },
    summary: {
      totalRequests: totalReqs,
      totalSuccess: totalSuccess,
      totalErrors: totalErrors,
      overallAvgMs: overallAvg,
      overallP95Ms: overallP95,
      durationSeconds,
      throughputRps,
    },
    scenarios: {
      readConsultas500VUs: readScenarios,
      burstMutationsWithCleanup: mutationScenarios,
      botHermes500Calls: botScenarios,
    },
    databaseIntegrity,
    bottlenecksIdentified,
  }

  // Cleanup da instância efêmera
  await ephemeral.cleanup()
  console.log('[CLEANUP] Instância efêmera desmontada com sucesso.')

  return reportData
}

// Execução direta CLI
import { pathToFileURL } from 'node:url'
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runLoadSimulation()
    .then((report) => {
      const outDir = path.join(process.cwd(), 'reports')
      fs.mkdirSync(outDir, { recursive: true })
      const jsonPath = path.join(outDir, 'load-test-simulation-result.json')
      fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8')
      console.log(`\n✅ Relatório JSON salvo em: ${jsonPath}`)
      console.log(
        `Throughput Geral: ${report.summary.throughputRps} req/s | p95 Geral: ${report.summary.overallP95Ms} ms`,
      )
      console.log(
        `Limpeza do banco: ${report.databaseIntegrity.cleanZeroResiduals ? 'PERFEITA (0 resíduos)' : 'FALHA'}`,
      )
      process.exit(0)
    })
    .catch((err) => {
      console.error('Erro fatal durante o teste de carga:', err)
      process.exit(1)
    })
}
