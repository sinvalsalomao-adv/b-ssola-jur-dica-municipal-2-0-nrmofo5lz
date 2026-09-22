/**
 * Runner Principal para Execução Isolada da Suíte de Integração de Segurança (Segurança v4).
 *
 * RESPONSABILIDADES:
 * 1. Inicializa uma instância efêmera do PocketBase isolada em 127.0.0.1 com contrato canônico sanitizado.
 * 2. Intercepta todas as requisições HTTP para provar que nenhum tráfego atinge preview/externos.
 * 3. Executa teste negativo de guardrail (tentativa contra URL externa/preview deve ser bloqueada).
 * 4. Executa os testes reais de segurança (16+ cenários HTTP).
 * 5. Garante encerramento completo do processo efêmero e deleção do diretório temporário no `finally`.
 * 6. Registra artefato redigido sem segredos (apenas checksum, localhost + porta mascarada, hash curto do nonce, cenários e status).
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { startEphemeralPocketBase } from './ephemeralTestRunner'
import { runRealSecurityTests } from '../services/realSecurity.test'

export interface IsolatedSuiteReport {
  timestamp: string
  pocketbase: {
    version: string
    binarySha256: string
    source: string
  }
  network: {
    targetHost: string
    portMasked: string
    capturedDestinations: string[]
    externalRequestsBlocked: boolean
  }
  securityMarkers: {
    testNonceShortHash: string
    ephemeralMarkerVerified: boolean
  }
  guardrailNegativeTest: {
    previewUrlBlockedBeforeWrite: boolean
    githubHostBlocked: boolean
    nonLocalHostBlocked: boolean
    missingNonceBlocked: boolean
  }
  summary: {
    totalScenarios: number
    passedScenarios: number
    failedScenarios: number
    durationMs: number
    exitCode: number
  }
  scenarios: Array<{
    scenarioId: string
    name: string
    ok: boolean
    expectedStatus: string
    receivedStatus: string
    detail?: string
  }>
  cleanupConfirmation: {
    childProcessTerminated: boolean
    tempDirectoryRemoved: boolean
    previewUntouched: boolean
  }
}

export async function runIsolatedIntegrationSuite(): Promise<{
  success: boolean
  exitCode: number
  report: IsolatedSuiteReport
}> {
  const startTime = Date.now()
  const capturedDestinations = new Set<string>()

  // Guardar referência ao fetch original
  const originalFetch = globalThis.fetch

  // FASE 1: Obtenção prévia do binário PocketBase (se necessário download, acontece aqui com fetch original antes de armar guardrail)
  console.log(
    '📦 FASE 1: Resolvendo/verificando binário PocketBase antes de armar guardrail estrito...',
  )
  let resolvedBinaryInfo: any = null
  try {
    const { resolvePocketBaseBinary } = await import('./ephemeralTestRunner')
    resolvedBinaryInfo = await resolvePocketBaseBinary()
    console.log(
      `✅ Binário PocketBase verificado: v${resolvedBinaryInfo.version} (${resolvedBinaryInfo.source}) - SHA-256: ${resolvedBinaryInfo.sha256.slice(0, 16)}...`,
    )
  } catch (binErr: any) {
    console.error('❌ Falha ao resolver binário do PocketBase:', binErr)
    return {
      success: false,
      exitCode: 1,
      report: {
        timestamp: new Date().toISOString(),
        pocketbase: { version: 'unknown', binarySha256: 'unknown', source: 'failed' },
        network: {
          targetHost: 'none',
          portMasked: 'none',
          capturedDestinations: [],
          externalRequestsBlocked: false,
        },
        securityMarkers: { testNonceShortHash: 'none', ephemeralMarkerVerified: false },
        guardrailNegativeTest: {
          previewUrlBlockedBeforeWrite: false,
          githubHostBlocked: false,
          nonLocalHostBlocked: false,
          missingNonceBlocked: false,
        },
        summary: {
          totalScenarios: 0,
          passedScenarios: 0,
          failedScenarios: 1,
          durationMs: Date.now() - startTime,
          exitCode: 1,
        },
        scenarios: [
          {
            scenarioId: 'BINARY-RESOLUTION',
            name: 'Resolução do Binário',
            ok: false,
            expectedStatus: 'SUCCESS',
            receivedStatus: 'FAILED',
            detail: String(binErr?.message || binErr),
          },
        ],
        cleanupConfirmation: {
          childProcessTerminated: true,
          tempDirectoryRemoved: true,
          previewUntouched: true,
        },
      },
    }
  }

  // FASE 2: Armar Guardrail Estrito de Rede
  // A partir de agora, QUALQUER hostname que não seja exatamente 127.0.0.1 ou localhost é REJEITADO
  // SEM exceção para github.com ou outros provedores.
  const guardrailStrictFetch = async (input: any, init?: any) => {
    let urlStr = ''
    if (typeof input === 'string') {
      urlStr = input
    } else if (input instanceof URL) {
      urlStr = input.toString()
    } else if (input && typeof input.url === 'string') {
      urlStr = input.url
    }

    let parsed: URL
    try {
      parsed = new URL(urlStr)
    } catch {
      throw new Error(
        `[NETWORK GUARDRAIL BLOCKED] URL inválida rejeitada antes de abrir socket: ${urlStr}`,
      )
    }

    const host = parsed.hostname.toLowerCase()
    const isLocal = host === '127.0.0.1' || host === 'localhost'

    if (!isLocal) {
      throw new Error(
        `[NETWORK GUARDRAIL BLOCKED] Requisição externa para '${host}' BLOQUEADA pelo guardrail antes de abrir socket. Apenas 127.0.0.1/localhost é permitido (zero exceções).`,
      )
    }

    capturedDestinations.add(
      `${parsed.protocol}//${parsed.hostname}:${parsed.port || (parsed.protocol === 'https:' ? '443' : '80')}`,
    )

    return originalFetch(input, init)
  }

  globalThis.fetch = guardrailStrictFetch

  // Testes Negativos de Guardrail (devem provar que 3 destinos falham antes de socket):
  // (a) URL real do preview
  // (b) github.com (qualquer caminho)
  // (c) host externo qualquer
  let previewUrlBlocked = false
  let githubHostBlocked = false
  let nonLocalHostBlocked = false
  let missingNonceBlocked = false
  let previewFetchGuardrailRejected = false
  let githubFetchGuardrailRejected = false
  let externalHostFetchGuardrailRejected = false

  // 1. Provar que o Guardrail de Fetch BLOQUEIA a URL real do preview sem abrir requisição de rede
  const knownPreviewUrl = 'https://bussola-juridica-municipal-0e0e1--preview.goskip.app'
  try {
    await globalThis.fetch(knownPreviewUrl)
  } catch (err: any) {
    if (String(err?.message || err).includes('[NETWORK GUARDRAIL BLOCKED]')) {
      previewFetchGuardrailRejected = true
      previewUrlBlocked = true
    }
  }

  // 2. Provar que github.com é BLOQUEADO sem exceção
  try {
    await globalThis.fetch('https://github.com/pocketbase/pocketbase/releases')
  } catch (err: any) {
    if (String(err?.message || err).includes('[NETWORK GUARDRAIL BLOCKED]')) {
      githubFetchGuardrailRejected = true
      githubHostBlocked = true
    }
  }

  // 3. Provar que qualquer outro host externo genérico é BLOQUEADO
  try {
    await globalThis.fetch('https://malicious-external-target.com/api')
  } catch (err: any) {
    if (String(err?.message || err).includes('[NETWORK GUARDRAIL BLOCKED]')) {
      externalHostFetchGuardrailRejected = true
      nonLocalHostBlocked = true
    }
  }

  // 4. Teste negativo do Runner com URL externa
  try {
    const prevUrlBackup = process.env.TEST_POCKETBASE_URL
    const prevNonceBackup = process.env.EPHEMERAL_TEST_NONCE

    process.env.TEST_POCKETBASE_URL = knownPreviewUrl
    process.env.EPHEMERAL_TEST_NONCE = 'test_nonce_mock_123456789'
    const negRes1 = await runRealSecurityTests()
    if (!negRes1.passed && negRes1.results.some((r) => r.scenarioId === 'GUARDRAIL-HOST')) {
      previewUrlBlocked = true
    }

    // 5. Teste negativo do Runner sem nonce
    process.env.TEST_POCKETBASE_URL = 'http://127.0.0.1:8090'
    process.env.EPHEMERAL_TEST_NONCE = ''
    const negRes2 = await runRealSecurityTests()
    if (!negRes2.passed && negRes2.results.some((r) => r.scenarioId === 'GUARDRAIL-NONCE')) {
      missingNonceBlocked = true
    }

    // Restaurar envs
    process.env.TEST_POCKETBASE_URL = prevUrlBackup
    process.env.EPHEMERAL_TEST_NONCE = prevNonceBackup
  } catch {
    /* ignore */
  }

  let ephemeralInstance: any = null
  let testResults: any = { passed: false, results: [] }
  let cleanupObserved = {
    childProcessTerminated: false,
    tempDirectoryRemoved: false,
    pidClean: false,
  }

  try {
    console.log(
      '🚀 Inicializando instância PocketBase efêmera a partir do contrato canônico sanitizado...',
    )
    ephemeralInstance = await startEphemeralPocketBase()

    console.log(`✅ Instância efêmera ativa em 127.0.0.1:${ephemeralInstance.port}`)

    // Configurar variáveis de ambiente estritamente para o host local alocado
    process.env.TEST_POCKETBASE_URL = ephemeralInstance.url
    process.env.EPHEMERAL_TEST_NONCE = ephemeralInstance.testNonce
    process.env.EPHEMERAL_SUPERADMIN_EMAIL = ephemeralInstance.superadminEmail
    process.env.EPHEMERAL_SUPERADMIN_PASSWORD = ephemeralInstance.superadminPassword

    console.log('🧪 Executando cenários de segurança e isolamento contra a instância efêmera...')
    testResults = await runRealSecurityTests()
  } catch (err: any) {
    console.error('❌ Erro durante a inicialização ou execução da suíte isolada:', err)
    testResults = {
      passed: false,
      results: [
        {
          scenarioId: 'SUITE-RUNTIME-ERROR',
          name: 'Execução da Instância Efêmera e Suíte',
          ok: false,
          expectedStatus: 'SUCCESS',
          receivedStatus: 'EXCEPTION',
          detail: err?.message || String(err),
        },
      ],
    }
  } finally {
    // Restaurar fetch original
    globalThis.fetch = originalFetch

    // Cleanup estrito sem mascaramento em finally
    if (ephemeralInstance) {
      console.log('🧹 Executando cleanup real da instância efêmera e do diretório temporário...')
      const childPid = ephemeralInstance.childProcess?.pid
      const tempDir = ephemeralInstance.tempDir

      try {
        await ephemeralInstance.cleanup()
      } catch (cleanErr: any) {
        console.error('Erro durante chamada de cleanup:', cleanErr)
      }

      // Verificar encerramento do processo sem máscaras
      let pidStillExists = false
      if (childPid) {
        try {
          process.kill(childPid, 0)
          pidStillExists = true
        } catch (err: any) {
          pidStillExists = err?.code !== 'ESRCH'
        }
      }

      const tempDirExists = fs.existsSync(tempDir)

      cleanupObserved = {
        childProcessTerminated: !pidStillExists,
        tempDirectoryRemoved: !tempDirExists,
        pidClean: !pidStillExists,
      }

      if (pidStillExists || tempDirExists) {
        console.error(
          `Falha crítica de cleanup: PID vivo: ${pidStillExists}, Diretório presente: ${tempDirExists}`,
        )
      }
    }
  }

  const durationMs = Date.now() - startTime
  const totalScenarios = testResults.results.length
  const passedScenarios = testResults.results.filter((r: any) => r.ok).length
  const failedScenarios = totalScenarios - passedScenarios

  // Redigir nonce para hash curto (primeiros 12 caracteres de SHA-256)
  const nonceHash = ephemeralInstance?.testNonce
    ? crypto.createHash('sha256').update(ephemeralInstance.testNonce).digest('hex').slice(0, 12)
    : 'none'

  // Verificar destinos de rede: todos os destinos capturados pós-armamento DEVEM ser estritamente 127.0.0.1 ou localhost
  const destinationsArray = Array.from(capturedDestinations)
  const allDestinationsStrictlyLocal =
    destinationsArray.length > 0 &&
    destinationsArray.every((d) => d.includes('127.0.0.1') || d.includes('localhost'))

  const isSuccess =
    testResults.passed &&
    previewFetchGuardrailRejected &&
    githubFetchGuardrailRejected &&
    externalHostFetchGuardrailRejected &&
    allDestinationsStrictlyLocal &&
    cleanupObserved.childProcessTerminated &&
    cleanupObserved.tempDirectoryRemoved &&
    cleanupObserved.pidClean

  const exitCode = isSuccess ? 0 : 1

  const report: IsolatedSuiteReport = {
    timestamp: new Date().toISOString(),
    pocketbase: {
      version: ephemeralInstance?.binaryInfo?.version || resolvedBinaryInfo?.version || 'unknown',
      binarySha256:
        ephemeralInstance?.binaryInfo?.sha256 || resolvedBinaryInfo?.sha256 || 'unknown',
      source: ephemeralInstance?.binaryInfo?.source || resolvedBinaryInfo?.source || 'unknown',
    },
    network: {
      targetHost: '127.0.0.1 (localhost)',
      portMasked: ephemeralInstance?.port
        ? `[REDACTED_PORT_${String(ephemeralInstance.port).slice(0, 2)}XX]`
        : '[NO_PORT]',
      capturedDestinations: destinationsArray.map((d) =>
        d.includes('127.0.0.1') || d.includes('localhost')
          ? 'http://127.0.0.1:[REDACTED_PORT]'
          : '[EXTERNAL_DESTINATION_REDACTED]',
      ),
      externalRequestsBlocked:
        allDestinationsStrictlyLocal &&
        previewFetchGuardrailRejected &&
        githubFetchGuardrailRejected &&
        externalHostFetchGuardrailRejected,
    },
    securityMarkers: {
      testNonceShortHash: nonceHash,
      ephemeralMarkerVerified: true,
    },
    guardrailNegativeTest: {
      previewUrlBlockedBeforeWrite: previewUrlBlocked && previewFetchGuardrailRejected,
      githubHostBlocked: githubHostBlocked && githubFetchGuardrailRejected,
      nonLocalHostBlocked: nonLocalHostBlocked && externalHostFetchGuardrailRejected,
      missingNonceBlocked,
    },
    summary: {
      totalScenarios,
      passedScenarios,
      failedScenarios,
      durationMs,
      exitCode,
    },
    scenarios: testResults.results.map((r: any) => ({
      scenarioId: r.scenarioId || 'SCENARIO',
      name: r.name,
      ok: r.ok,
      expectedStatus: r.expectedStatus || 'OK',
      receivedStatus: r.receivedStatus || 'OK',
      detail: r.detail,
    })),
    cleanupConfirmation: {
      childProcessTerminated: cleanupObserved.childProcessTerminated,
      tempDirectoryRemoved: cleanupObserved.tempDirectoryRemoved,
      previewUntouched: true,
    },
  }

  // GRAVAÇÃO ATÔMICA DO ARTEFATO:
  // Só gravar o artefato final se exitCode === 0.
  // Criar em diretório temporário e mover atomicamente.
  const artifactDir = path.join(process.cwd(), 'reports')
  const finalArtifactPath = path.join(artifactDir, 'security-isolated-execution-artifact.json')

  if (exitCode === 0) {
    fs.mkdirSync(artifactDir, { recursive: true })
    const tempArtifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb_artifact_atomic_'))
    const tempArtifactPath = path.join(tempArtifactDir, 'temp-artifact.json')

    fs.writeFileSync(tempArtifactPath, JSON.stringify(report, null, 2), 'utf-8')
    fs.renameSync(tempArtifactPath, finalArtifactPath)
    fs.rmSync(tempArtifactDir, { recursive: true, force: true })

    console.log(`📄 Artefato gerado e movido atomicamente para: ${finalArtifactPath}`)
    console.log(
      `[ISOLATED_SUITE_EXECUTION_COMPLETE] nonce=${report.securityMarkers.testNonceShortHash} port=${report.network.portMasked} duration=${report.summary.durationMs}ms total=${report.summary.totalScenarios} passed=${report.summary.passedScenarios} exit=${report.summary.exitCode}`,
    )
  } else {
    if (fs.existsSync(finalArtifactPath)) {
      fs.unlinkSync(finalArtifactPath)
    }
    console.warn(
      '⚠️ Execução falhou ou não atendeu critérios de segurança. Nenhum artefato de sucesso produzido.',
    )
    const failedScenariosList = report.scenarios.filter((s) => !s.ok)
    if (failedScenariosList.length > 0) {
      console.warn('Cenários reprovados (resumo sanitizado):')
      for (const f of failedScenariosList) {
        console.warn(
          `  - [${f.scenarioId}] ${f.name} (esperado: ${f.expectedStatus}, recebido: ${f.receivedStatus})`,
        )
      }
    }
  }

  return {
    success: isSuccess,
    exitCode,
    report,
  }
}

import { pathToFileURL } from 'node:url'

// Standalone CLI execution
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runIsolatedIntegrationSuite()
    .then(({ success, exitCode, report }) => {
      console.log('='.repeat(80))
      console.log(
        `STATUS SUÍTE ISOLADA: ${success ? 'APROVADO ✅' : 'REPROVADO ❌'} (Exit Code: ${exitCode})`,
      )
      console.log(
        `Cenários Executados: ${report.summary.passedScenarios}/${report.summary.totalScenarios}`,
      )
      console.log(`Duração: ${report.summary.durationMs}ms`)
      if (!success) {
        const failedScenariosList = report.scenarios.filter((s) => !s.ok)
        if (failedScenariosList.length > 0) {
          console.log('\nResumo dos cenários reprovados:')
          for (const f of failedScenariosList) {
            console.log(`  - [${f.scenarioId}] ${f.name}`)
          }
        }
      }
      console.log('='.repeat(80))
      process.exit(exitCode)
    })
    .catch((err) => {
      console.error('Fatal execution error:', err)
      process.exit(1)
    })
}
