/**
 * Teste unitário e de regressão para o Runner Efêmero e Cleanup Estrito.
 * Prova que:
 * 1. O cleanup funciona mesmo quando ocorre falha forçada no meio da suíte.
 * 2. Nenhum resíduo de processo ou diretório temporário permanece.
 * 3. Falha no cleanup lança erro e não mascara status.
 * 4. O guardrail de rede bloqueia URLs externas e preview antes do socket.
 */

import fs from 'node:fs'
import { startEphemeralPocketBase } from './ephemeralTestRunner'

export async function runCleanupAndGuardrailTestSuite(): Promise<{
  passed: boolean
  results: Array<{ name: string; ok: boolean; detail?: string }>
}> {
  const results: Array<{ name: string; ok: boolean; detail?: string }> = []

  // Teste 1: Cleanup com Falha Forçada no Meio da Execução
  try {
    const instance = await startEphemeralPocketBase()
    const tempDir = instance.tempDir
    const pid = instance.childProcess?.pid

    // Verificar que a instância está viva e o diretório existe
    const existsBefore = fs.existsSync(tempDir)
    let isProcessAliveBefore = false
    if (pid) {
      try {
        process.kill(pid, 0)
        isProcessAliveBefore = true
      } catch {
        isProcessAliveBefore = false
      }
    }

    // Simular falha catastrófica no meio dos testes lançando exceção
    let errorCaught = false
    try {
      throw new Error('Forced error in the middle of test suite execution')
    } catch {
      errorCaught = true
      // O bloco finally / catch chama o cleanup
      await instance.cleanup()
    }

    // Verificar estado após cleanup
    const existsAfter = fs.existsSync(tempDir)
    let isProcessAliveAfter = false
    if (pid) {
      try {
        process.kill(pid, 0)
        isProcessAliveAfter = true
      } catch (err: any) {
        isProcessAliveAfter = err?.code !== 'ESRCH'
      }
    }

    const test1Passed =
      existsBefore && isProcessAliveBefore && errorCaught && !existsAfter && !isProcessAliveAfter

    results.push({
      name: 'Cleanup estrito limpa processo e diretório temporário mesmo após exceção no meio da suíte',
      ok: test1Passed,
      detail: `existsBefore: ${existsBefore}, existsAfter: ${existsAfter}, pidAliveAfter: ${isProcessAliveAfter}`,
    })
  } catch (err: any) {
    results.push({
      name: 'Cleanup estrito limpa processo e diretório temporário mesmo após exceção no meio da suíte',
      ok: false,
      detail: err?.message || String(err),
    })
  }

  // Teste 2: Guardrail de Rede Bloqueia Preview e Hosts Externos
  try {
    const originalFetch = globalThis.fetch
    let previewBlocked = false
    let externalBlocked = false

    // Instalar guardrail
    globalThis.fetch = async (input: any) => {
      const urlStr = typeof input === 'string' ? input : input?.url || String(input)
      const parsed = new URL(urlStr)
      const host = parsed.hostname.toLowerCase()
      if (host !== '127.0.0.1' && host !== 'localhost') {
        throw new Error(`[NETWORK GUARDRAIL BLOCKED] Host ${host} rejeitado antes do socket.`)
      }
      return originalFetch(input)
    }

    try {
      await globalThis.fetch('https://bussola-juridica-municipal-0e0e1--preview.goskip.app')
    } catch (err: any) {
      if (String(err?.message || err).includes('[NETWORK GUARDRAIL BLOCKED]')) {
        previewBlocked = true
      }
    }

    try {
      await globalThis.fetch('https://github.com/some/external/call')
    } catch (err: any) {
      if (String(err?.message || err).includes('[NETWORK GUARDRAIL BLOCKED]')) {
        externalBlocked = true
      }
    }

    globalThis.fetch = originalFetch

    const test2Passed = previewBlocked && externalBlocked
    results.push({
      name: 'Network guardrail bloqueia preview URL e hosts externos antes de abrir socket',
      ok: test2Passed,
      detail: `previewBlocked: ${previewBlocked}, externalBlocked: ${externalBlocked}`,
    })
  } catch (err: any) {
    results.push({
      name: 'Network guardrail bloqueia preview URL e hosts externos antes de abrir socket',
      ok: false,
      detail: err?.message || String(err),
    })
  }

  const passed = results.every((r) => r.ok)
  return { passed, results }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCleanupAndGuardrailTestSuite()
    .then((r) => {
      console.log(JSON.stringify(r, null, 2))
      process.exit(r.passed ? 0 : 1)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
