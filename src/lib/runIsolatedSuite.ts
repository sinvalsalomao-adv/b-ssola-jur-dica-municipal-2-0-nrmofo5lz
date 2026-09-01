/**
 * Runner Executável para a Suíte de Integração e Segurança Isolada
 *
 * 1. Inicializa uma instância PocketBase efêmera isolada com porta dinâmica e banco temporário.
 * 2. Injeta credenciais efêmeras de superadmin e marcador test_environment com nonce.
 * 3. Executa a suíte realSecurity.test.ts e cenários de integração.
 * 4. Redige senhas, tokens e credenciais das saídas de log.
 * 5. Garante cleanup total de processos e arquivos temporários em bloco finally.
 * 6. Propaga erros e códigos de saída sem mascaramento.
 */

import { startEphemeralPocketBase } from './ephemeralTestRunner'

function redactSensitiveData(str: string): string {
  if (!str) return ''
  return str
    .replace(
      /(?:password|senha|token|secret|token_hash)["':\s]*["'][^"']+["']/gi,
      '$1: "[REDACTED]"',
    )
    .replace(/(?:Bearer\s+)[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/AdmF_[a-zA-Z0-9!@#]+/g, '[REDACTED_PASSWORD]')
    .replace(/AdmT_[a-zA-Z0-9!@#]+/g, '[REDACTED_PASSWORD]')
    .replace(/SrvF_[a-zA-Z0-9!@#]+/g, '[REDACTED_PASSWORD]')
    .replace(/SuperAdm_[a-zA-Z0-9!@#]+/g, '[REDACTED_SUPERADMIN_PASSWORD]')
}

export async function runIsolatedIntegrationSuite(): Promise<{
  passed: boolean
  environment: {
    url: string
    port: number
    isEphemeral: boolean
    tempDirCreated: boolean
  }
  results: Array<{ name: string; ok: boolean; detail?: string }>
}> {
  console.log('='.repeat(80))
  console.log('🚀 INICIALIZANDO RUNNER DE TESTES ISOLADOS (POCKETBASE EFÊMERO)')
  console.log('='.repeat(80))

  let ephemeralInstance: Awaited<ReturnType<typeof startEphemeralPocketBase>> | null = null

  try {
    console.log('\n[1/4] Inicializando instância PocketBase efêmera...')
    ephemeralInstance = await startEphemeralPocketBase()
    console.log(
      `  ✅ Instância local ativa em ${ephemeralInstance.url} (Porta: ${ephemeralInstance.port})`,
    )
    console.log(`  ✅ Diretório temporário isolado: ${ephemeralInstance.tempDir}`)
    console.log(`  ✅ Nonce de segurança injetado: ${ephemeralInstance.testNonce}`)

    // Injetar variáveis de ambiente para a suíte de teste
    process.env.TEST_POCKETBASE_URL = ephemeralInstance.url
    process.env.VITE_POCKETBASE_URL = ephemeralInstance.url
    process.env.EPHEMERAL_TEST_NONCE = ephemeralInstance.testNonce
    process.env.EPHEMERAL_SUPERADMIN_EMAIL = ephemeralInstance.superadminEmail
    process.env.EPHEMERAL_SUPERADMIN_PASSWORD = ephemeralInstance.superadminPassword

    console.log('\n[2/4] Executando suíte de segurança HTTP real contra a base efêmera...')
    const { runRealSecurityTests } = await import('../services/realSecurity.test')
    const testResult = await runRealSecurityTests()

    console.log('\n[3/4] Resultados dos Cenários de Segurança Executados:')
    for (const r of testResult.results) {
      const statusIcon = r.ok ? '✅' : '❌'
      const detailStr = r.detail ? ` -> ${redactSensitiveData(r.detail)}` : ''
      console.log(`  ${statusIcon} ${r.name}${detailStr}`)
    }

    return {
      passed: testResult.passed,
      environment: {
        url: ephemeralInstance.url,
        port: ephemeralInstance.port,
        isEphemeral: true,
        tempDirCreated: true,
      },
      results: testResult.results,
    }
  } catch (err: any) {
    console.error(
      `\n❌ ERRO NA EXECUÇÃO DA SUÍTE ISOLADA: ${redactSensitiveData(err?.message || String(err))}`,
    )
    return {
      passed: false,
      environment: {
        url: ephemeralInstance?.url || 'não-iniciado',
        port: ephemeralInstance?.port || 0,
        isEphemeral: true,
        tempDirCreated: !!ephemeralInstance,
      },
      results: [
        { name: 'Execução do Runner Efêmero', ok: false, detail: err?.message || String(err) },
      ],
    }
  } finally {
    console.log('\n[4/4] Executando Cleanup do Ambiente Efêmero (finally)...')
    if (ephemeralInstance) {
      await ephemeralInstance.cleanup()
      console.log('  ✅ Processo do PocketBase efêmero encerrado.')
      console.log('  ✅ Diretório temporário e banco SQLite efêmeros removidos.')
    }
    console.log('='.repeat(80))
  }
}

// Execução CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  runIsolatedIntegrationSuite().then((outcome) => {
    if (!outcome.passed) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  })
}
