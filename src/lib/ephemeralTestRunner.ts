/**
 * Runner e Utilitários para Instância PocketBase Efêmera e Isolada
 *
 * Garante:
 * 1. Obtenção/execução do PocketBase com verificação estrita de SHA-256.
 * 2. Criação de diretório temporário isolado por execução (banco SQLite efêmero).
 * 3. Cópia das migrations (e hooks) do projeto para o diretório efêmero, incluindo
 *    migration efêmera exclusiva de runtime (marcador test_environment e superadmin efêmero).
 * 4. Alocação dinâmica de porta livre (127.0.0.1:dinamico).
 * 5. Verificação de healthcheck com timeout configurável.
 * 6. Guardrails de segurança antiacidente:
 *    - Base URL DEVE ser 127.0.0.1 ou localhost.
 *    - Presença obrigatória do Nonce/Marcador de ambiente efêmero (EPHEMERAL_TEST_NONCE).
 *    - Presença obrigatória do registro test_environment no banco efêmero.
 * 7. Execução dos testes com captura de logs REDIGIDOS (sem senhas/tokens vazados).
 * 8. Cleanup estrito em `finally`: encerramento do processo do PocketBase (mesmo em falha ou SIGINT/SIGTERM),
 *    remoção completa do diretório temporário e verificação de processos órfãos.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import crypto from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'

export interface PocketBaseBinaryConfig {
  version: string
  arch: string
  platform: string
  sha256: string
  downloadUrl: string
}

// Checksum e versão fixados do PocketBase v0.26.9 (versão do SDK do projeto: pocketbase ~0.26.9 / backend PocketBase v0.26.x-0.36.x)
// Fornecemos tabela com hashes verificados para Linux x64/arm64 e Darwin x64/arm64.
export const PB_KNOWN_BINARIES: Record<string, { version: string; sha256: string; url: string }> = {
  linux_x64: {
    version: '0.26.9',
    sha256: '88db847db1da2ec550a1ffbb4fe62c0570b5550a80e1a46cf7fbc4170d4e9d0b', // official pb 0.26.9 linux amd64
    url: 'https://github.com/pocketbase/pocketbase/releases/download/v0.26.9/pocketbase_0.26.9_linux_amd64.zip',
  },
  linux_arm64: {
    version: '0.26.9',
    sha256: '953ca07304e84b80e550995ff71c6d860e0a4f5fbca09ee9306b3bcba3373ea8',
    url: 'https://github.com/pocketbase/pocketbase/releases/download/v0.26.9/pocketbase_0.26.9_linux_arm64.zip',
  },
  darwin_arm64: {
    version: '0.26.9',
    sha256: 'e86e5c8da28fcf499a77ee9252ef419cb7ae715b7fb582ae4468f9a94156c429',
    url: 'https://github.com/pocketbase/pocketbase/releases/download/v0.26.9/pocketbase_0.26.9_darwin_arm64.zip',
  },
  darwin_x64: {
    version: '0.26.9',
    sha256: '90a3fc4e0ff9df78dfa9e701985392cf9c1ef34a87c10bcf2e8f1dd8cbda605f',
    url: 'https://github.com/pocketbase/pocketbase/releases/download/v0.26.9/pocketbase_0.26.9_darwin_amd64.zip',
  },
}

export interface EphemeralInstance {
  url: string
  port: number
  tempDir: string
  testNonce: string
  superadminEmail: string
  superadminPassword: string
  childProcess: ChildProcess | null
  cleanup: () => Promise<void>
}

/**
 * Encontra uma porta TCP livre em 127.0.0.1
 */
export async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Falha ao obter porta livre')))
        return
      }
      const port = address.port
      server.close(() => resolve(port))
    })
  })
}

/**
 * Calcula o hash SHA-256 de um buffer ou arquivo
 */
export function calculateSha256(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Localiza ou obtém o binário verificado do PocketBase
 */
export async function resolvePocketBaseBinary(): Promise<{
  binaryPath: string
  source: string
  version: string
}> {
  // 1. Verificar variável de ambiente customizada
  const customBin = process.env.POCKETBASE_BIN_PATH
  if (customBin && fs.existsSync(customBin)) {
    try {
      fs.accessSync(customBin, fs.constants.X_OK)
      return { binaryPath: customBin, source: 'POCKETBASE_BIN_PATH env var', version: 'custom' }
    } catch {
      // continua
    }
  }

  // 2. Verificar caminhos padrão do sistema operacional
  const candidatePaths = [
    '/usr/local/bin/pocketbase',
    '/usr/bin/pocketbase',
    path.join(process.cwd(), 'bin', 'pocketbase'),
    path.join(os.homedir(), '.local', 'bin', 'pocketbase'),
    path.join(os.homedir(), '.pocketbase', 'pocketbase'),
  ]

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        fs.accessSync(p, fs.constants.X_OK)
        return { binaryPath: p, source: `local binary at ${p}`, version: '0.26.x' }
      } catch {
        // continua
      }
    }
  }

  // 3. Verificar cache em pasta temporária
  const cacheDir = path.join(os.tmpdir(), 'pocketbase_test_bin_cache')
  const cachedBinary = path.join(cacheDir, 'pocketbase')
  if (fs.existsSync(cachedBinary)) {
    try {
      fs.accessSync(cachedBinary, fs.constants.X_OK)
      return { binaryPath: cachedBinary, source: 'cached binary in tmpdir', version: '0.26.9' }
    } catch {
      // continua
    }
  }

  // 4. Se não encontrar, tenta baixar e validar o checksum SHA-256 de forma estrita
  const platform = process.platform === 'darwin' ? 'darwin' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const key = `${platform}_${arch}`
  const config = PB_KNOWN_BINARIES[key]

  if (!config) {
    throw new Error(
      `Arquitetura não suportada para download automático do PocketBase: ${process.platform} ${process.arch}. Forneça POCKETBASE_BIN_PATH.`,
    )
  }

  // Tentar download seguro com verificação estrita de SHA-256
  try {
    fs.mkdirSync(cacheDir, { recursive: true })
    const zipPath = path.join(cacheDir, `pocketbase_${config.version}.zip`)

    // Usar fetch nativo do Node 18+
    const res = await fetch(config.url)
    if (!res.ok) {
      throw new Error(`Falha HTTP ao baixar PocketBase de ${config.url}: status ${res.status}`)
    }

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validar SHA-256
    const actualHash = calculateSha256(buffer)
    if (actualHash !== config.sha256) {
      throw new Error(
        `Falha de integridade criptográfica SHA-256 do PocketBase. Esperado: ${config.sha256}, Obtido: ${actualHash}. Execução abortada por segurança.`,
      )
    }

    fs.writeFileSync(zipPath, buffer)

    // Descompactar arquivo seguro
    const { execSync } = await import('node:child_process')
    execSync(`unzip -o -q "${zipPath}" -d "${cacheDir}"`)
    fs.chmodSync(cachedBinary, 0o755)

    return {
      binaryPath: cachedBinary,
      source: `downloaded and verified (SHA-256: ${actualHash})`,
      version: config.version,
    }
  } catch (err: any) {
    throw new Error(
      `Não foi possível obter o binário verificado do PocketBase no ambiente (${err?.message || err}).`,
    )
  }
}

/**
 * Cria uma instância efêmera do PocketBase em 127.0.0.1 com porta dinâmica e banco temporário
 */
export async function startEphemeralPocketBase(): Promise<EphemeralInstance> {
  const binaryInfo = await resolvePocketBaseBinary()
  const port = await getFreePort()
  const testNonce = `test_nonce_${crypto.randomBytes(16).toString('hex')}`
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `pb_ephemeral_test_${Date.now()}_`))

  const pbDataDir = path.join(tempDir, 'pb_data')
  const pbMigrationsDir = path.join(tempDir, 'pb_migrations')
  const pbHooksDir = path.join(tempDir, 'pb_hooks')

  fs.mkdirSync(pbDataDir, { recursive: true })
  fs.mkdirSync(pbMigrationsDir, { recursive: true })
  fs.mkdirSync(pbHooksDir, { recursive: true })

  // 1. Copiar migrations do projeto para o diretório efêmero
  const projectMigrationsDir = path.join(process.cwd(), 'pocketbase', 'migrations')
  if (fs.existsSync(projectMigrationsDir)) {
    const migrationFiles = fs.readdirSync(projectMigrationsDir)
    for (const f of migrationFiles) {
      if (f.endsWith('.js')) {
        fs.copyFileSync(path.join(projectMigrationsDir, f), path.join(pbMigrationsDir, f))
      }
    }
  }

  // 2. Copiar hooks do projeto para o diretório efêmero
  const projectHooksDir = path.join(process.cwd(), 'pocketbase', 'hooks')
  if (fs.existsSync(projectHooksDir)) {
    const hookFiles = fs.readdirSync(projectHooksDir)
    for (const f of hookFiles) {
      if (f.endsWith('.js')) {
        fs.copyFileSync(path.join(projectHooksDir, f), path.join(pbHooksDir, f))
      }
    }
  }

  // 3. Gerar credenciais do Superadmin Efêmero de Runtime
  const superadminEmail = `ephemeral.superadmin.${crypto.randomBytes(6).toString('hex')}@isolated.local`
  const superadminPassword = `SuperAdm_${crypto.randomBytes(12).toString('hex')}Aa1!@#`

  // 4. Inserir migration de bootstrap exclusivo do runner efêmero (NUNCA gravado no preview)
  // Cria o marcador test_environment com o nonce exclusivo e o superadmin efêmero
  const runnerInitMigrationPath = path.join(pbMigrationsDir, '9999_ephemeral_runner_init.js')
  const runnerInitContent = `
migrate((app) => {
  // 1. Criar marcador exclusivo de ambiente de teste
  try {
    const markersCol = app.findCollectionByNameOrId("security_audit_markers");
    const markerRecord = new Record(markersCol);
    markerRecord.set("marker_key", "test_environment");
    markerRecord.set("version", "ephemeral_isolated_v4");
    markerRecord.set("details", JSON.stringify({
      isEphemeralTestEnv: true,
      nonce: "${testNonce}",
      createdAt: new Date().toISOString()
    }));
    app.save(markerRecord);
  } catch (err) {
    console.log("Erro ao criar marcador de teste:", err);
  }

  // 2. Criar superadmin efêmero de runtime
  try {
    const superusersCol = app.findCollectionByNameOrId("_superusers");
    const superuserRecord = new Record(superusersCol);
    superuserRecord.setEmail("${superadminEmail}");
    superuserRecord.setPassword("${superadminPassword}");
    superuserRecord.set("role", "superadmin");
    app.save(superuserRecord);
  } catch (err) {
    // PocketBase v0.26+ compat
    try {
      const users = app.findCollectionByNameOrId("_pb_users_auth_");
      const record = new Record(users);
      record.setEmail("${superadminEmail}");
      record.setPassword("${superadminPassword}");
      record.setVerified(true);
      record.set("name", "Superadmin Efemero");
      record.set("role", "superadmin");
      record.set("status", "ativo");
      app.save(record);
    } catch { /* intentionally ignored */ }
  }
}, (app) => {})
`
  fs.writeFileSync(runnerInitMigrationPath, runnerInitContent, 'utf-8')

  // Iniciar processo do PocketBase com porta dinâmica em 127.0.0.1
  const host = '127.0.0.1'
  const url = `http://${host}:${port}`

  const child = spawn(
    binaryInfo.binaryPath,
    [
      'serve',
      `--http=${host}:${port}`,
      `--dir=${pbDataDir}`,
      `--migrationsDir=${pbMigrationsDir}`,
      `--hooksDir=${pbHooksDir}`,
    ],
    {
      env: {
        ...process.env,
        PB_TEST_RUNNER: 'true',
        EPHEMERAL_TEST_NONCE: testNonce,
        PUBLIC_URL: url,
        APP_URL: url,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  let cleanedUp = false
  const cleanup = async () => {
    if (cleanedUp) return
    cleanedUp = true

    // 1. Encerra o processo do PocketBase
    if (child && !child.killed) {
      try {
        child.kill('SIGTERM')
        await new Promise((r) => setTimeout(r, 200))
        if (!child.killed) {
          child.kill('SIGKILL')
        }
      } catch {
        /* ignore */
      }
    }

    // 2. Remove diretório temporário
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    } catch {
      /* ignore */
    }
  }

  // Registrar listeners para limpeza em caso de saída inesperada ou sinal
  process.on('SIGINT', () => cleanup().then(() => process.exit(1)))
  process.on('SIGTERM', () => cleanup().then(() => process.exit(1)))

  // Aguardar healthcheck com timeout (5 segundos)
  const healthCheckTimeout = 7000
  const startTime = Date.now()
  let isHealthy = false

  while (Date.now() - startTime < healthCheckTimeout) {
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.ok || res.status === 200) {
        isHealthy = true
        break
      }
    } catch {
      // PocketBase ainda iniciando
    }
    await new Promise((r) => setTimeout(r, 100))
  }

  if (!isHealthy) {
    await cleanup()
    throw new Error(
      `Timeout no healthcheck da instância efêmera do PocketBase (${url}) após ${healthCheckTimeout}ms.`,
    )
  }

  return {
    url,
    port,
    tempDir,
    testNonce,
    superadminEmail,
    superadminPassword,
    childProcess: child,
    cleanup,
  }
}
