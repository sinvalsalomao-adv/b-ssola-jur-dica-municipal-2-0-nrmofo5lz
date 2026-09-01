/**
 * Static Security Test: PocketBase Hook Filter Parameterization Validator
 *
 * Scans active PocketBase backend hooks and ensures zero dynamic value concatenation/interpolation
 * in queries passed to findRecordsByFilter, findFirstRecordByFilter, etc.
 *
 * Requirements:
 * 1. Reads all active pocketbase/hooks/*.js files.
 * 2. Distinguishes safe literal placeholder building (e.g. `filter += ' && status = {:status}'`)
 *    from dangerous variable interpolation/concatenation (e.g. `'tenant = "' + tenantId + '"'` or `` `tenant = "${tenantId}"` ``).
 * 3. Includes internal positive fixtures (insecure patterns) and negative fixtures (safe {:param} patterns)
 *    to prove that the detector catches unsafe patterns and accepts safe ones.
 * 4. Fails with exit code 1 if any violation is detected or if fixture tests fail.
 */

import fs from 'node:fs'
import path from 'node:path'

export interface Finding {
  file: string
  line: number
  code: string
  reason: string
}

export interface SecurityAnalysisResult {
  passed: boolean
  scannedFiles: string[]
  findings: Finding[]
  fixtureTests: {
    passed: boolean
    positiveCasesTested: number
    negativeCasesTested: number
    details: string[]
  }
}

/**
 * List of active backend hooks as registered in the Skip Cloud / PocketBase instance.
 */
export const ACTIVE_HOOK_NAMES = [
  'activate_invitation',
  'audit_log_create',
  'check_bottlenecks',
  'create_tenant',
  'deliver_scheduled_notifications',
  'generate_document',
  'generate_recurring_notifications',
  'invitations_actions',
  'invite_user',
  'mask_settings_secrets',
  'mention_security_guard',
  'organizacoes_public',
  'password_policy',
  'public_register',
  'rate_limiter',
  'sanitize_hook',
  'security_headers',
  'tenant_user_create',
  'tenant_user_management',
  'user_security_guard',
  'academia_security_guard',
]

/**
 * Checks a line/code snippet for dynamic string interpolation/concatenation inside filter expressions.
 */
export function analyzeFilterCode(code: string, fileName = 'inline'): Finding[] {
  const findings: Finding[] = []
  const lines = code.split('\n')

  // Check 1: Direct find(Records|FirstRecord)ByFilter calls with template literals containing expressions
  // e.g. findRecordsByFilter('col', `tenant = "${tenantId}"`, ...)
  const templateLiteralFilterRegex =
    /(?:findRecordsByFilter|findFirstRecordByFilter)\s*\([^,]+,\s*`([^`]*\$\{[^}]+\}[^`]*)`/g

  // Check 2: Direct find(Records|FirstRecord)ByFilter calls with binary concatenation with identifiers/calls
  // e.g. findRecordsByFilter('col', 'tenant = "' + tenantId + '"', ...)
  // Note: we check if the 2nd argument contains a '+' that concatenates a non-literal expression.
  const concatFilterCallRegex =
    /(?:findRecordsByFilter|findFirstRecordByFilter)\s*\(\s*['"][^'"]+['"]\s*,\s*([^,]+),/g

  // Check 3: Variable declarations or assignments that assemble dynamic SQL/filter strings with non-literal concatenation
  // e.g. const filter = 'tenant = "' + tenantId
  // e.g. let filter = `tenant = "${tenantId}"`
  // SAFE: let filter = 'tenant = {:tenantId}'
  // SAFE: filter += ' && status = {:status}' (pure literal string addition)
  // SAFE: const filter = "status = 'ativa'"
  // UNSAFE: filter += ' && status = "' + status + '"'
  // UNSAFE: filter += ` && status = "${status}"`
  // UNSAFE: const filter = `user = "${userId}"`
  // UNSAFE: const filter = "user = '" + userId + "'"

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // 1. Template literal with interpolation inside filter context or filter variables
    // Match template literal expressions like `...${var}...`
    const templateMatch = line.match(/`([^`]*\$\{[^}]+\}[^`]*)`/)
    if (templateMatch) {
      const templateContent = templateMatch[1]
      // Check if template contains filter operators or appears in filter assignment/call
      const isFilterContext =
        /filter|where|findRecordsByFilter|findFirstRecordByFilter/i.test(line) ||
        /[=><~!]=?|&&|\|\|/.test(templateContent)
      if (isFilterContext) {
        findings.push({
          file: fileName,
          line: lineNum,
          code: line.trim(),
          reason:
            'Interpolação de template literal com expressão dinâmica detectada em filtro. Use placeholders {:param} com map de parâmetros.',
        })
        continue
      }
    }

    // 2. Filter variable assignment or function argument concatenating non-literal dynamic values
    // Examples of unsafe patterns:
    // filter += ' && status = "' + st + '"'
    // filter = 'user = "' + uId + '"'
    // findFirstRecordByFilter('col', 'tenant = "' + tenantId + '"')
    // We look for (+) operations involving quotes followed/preceded by variables or function calls.
    const isFilterLine =
      /(?:findRecordsByFilter|findFirstRecordByFilter|Filter|filter|checkFilter|memFilter|invFilter|rlDbFilter)\s*(?:\(|=|\+=)/.test(
        line,
      )

    if (isFilterLine) {
      // Check if the line has string concatenation with a variable (e.g. + varName or + obj.prop or + fn())
      // We exclude pure string literal concatenation like 'a' + 'b' or multiline literal formatting
      // Unsafe pattern: quotes + identifier + quotes or quotes + identifier
      const hasUnsafeConcat =
        /(?:['"][^'"]*['"]\s*\+\s*[a-zA-Z_$][a-zA-Z0-9_$.()[\]]*)|(?:[a-zA-Z_$][a-zA-Z0-9_$.()[\]]*\s*\+\s*['"][^'"]*['"])/.test(
          line,
        )

      // Distinguish from safe cases:
      // Safe: filter += ' && status = {:status}' (no + operand with non-literals, only literal string on RHS)
      // Safe: const filter = 'a' + 'b' (all operands are string literals)
      if (hasUnsafeConcat) {
        // Double check if all operands on the line are literal strings or safe numbers
        // If there's an actual variable/property interpolated into the string:
        const cleanLiterals = line
          .replace(/`[^`]*`/g, '""')
          .replace(/'(?:\\.|[^'\\])*'/g, '""')
          .replace(/"(?:\\.|[^"\\])*"/g, '""')
        // In cleanLiterals, all string literals are replaced with "".
        // If there is still a "+" remaining that is not just between "" + "", it means dynamic values are involved.
        const nonLiteralConcat = /\+\s*[a-zA-Z_$]|\b[a-zA-Z_$][a-zA-Z0-9_$.]*\s*\+/.test(
          cleanLiterals,
        )

        // Exclude innocent log messages or normal string math that don't look like filter definitions
        const looksLikeFilterExpression =
          /(?:findRecordsByFilter|findFirstRecordByFilter|Filter|filter|where)\b/i.test(line) &&
          /(?:=|<|>|~|&&|\|\||tenant|user|email|status|project)/.test(line)

        if (nonLiteralConcat && looksLikeFilterExpression) {
          findings.push({
            file: fileName,
            line: lineNum,
            code: line.trim(),
            reason:
              'Concatenação dinâmica de valor/variável detectada na montagem do filtro. Use placeholders {:param} com map de parâmetros.',
          })
          continue
        }
      }
    }

    // 3. Direct function calls with concatenated arguments (including calls with only 2 arguments)
    if (line.includes('findRecordsByFilter') || line.includes('findFirstRecordByFilter')) {
      const callMatch = line.match(/(?:findRecordsByFilter|findFirstRecordByFilter)\s*\(([^)]*)\)/)
      if (callMatch) {
        const argsInside = callMatch[1]
        const cleanArgs = argsInside
          .replace(/'(?:\\.|[^'\\])*'/g, '""')
          .replace(/"(?:\\.|[^"\\])*"/g, '""')
        const argParts = cleanArgs.split(',')
        if (argParts.length >= 2) {
          const secondArg = argParts[1]
          if (
            secondArg.includes('+') &&
            !secondArg.includes('"" + ""') &&
            (/\+\s*[a-zA-Z_$]/.test(secondArg) || /[a-zA-Z_$][a-zA-Z0-9_$.]*\s*\+/.test(secondArg))
          ) {
            findings.push({
              file: fileName,
              line: lineNum,
              code: line.trim(),
              reason:
                'Concatenação dinâmica detectada diretamente no argumento de findRecordsByFilter/findFirstRecordByFilter.',
            })
            continue
          }
        }
      }

      const cleanLine = line.replace(/'(?:\\.|[^'\\])*'/g, '""').replace(/"(?:\\.|[^"\\])*"/g, '""')
      if (
        cleanLine.includes('+') &&
        !cleanLine.includes('"" + ""') &&
        (/\+\s*[a-zA-Z_$]/.test(cleanLine) || /[a-zA-Z_$][a-zA-Z0-9_$.]*\s*\+/.test(cleanLine))
      ) {
        findings.push({
          file: fileName,
          line: lineNum,
          code: line.trim(),
          reason:
            'Concatenação dinâmica detectada diretamente no argumento de findRecordsByFilter/findFirstRecordByFilter.',
        })
      }
    }
  }

  return findings
}

/**
 * Internal fixtures (positive & negative) to mathematically prove detector accuracy.
 */
export function runDetectorFixtureTests(): {
  passed: boolean
  positiveCasesTested: number
  negativeCasesTested: number
  details: string[]
} {
  const details: string[] = []

  // Positive fixtures (insecure patterns that MUST be flagged and rejected)
  const positiveFixtures = [
    {
      name: 'Unsafe template literal with tenantId',
      code: 'const filter = `tenant = "${tenantId}" && status = "pending"`',
      expectedFindingCount: 1,
    },
    {
      name: 'Unsafe string concatenation in filter variable',
      code: "const memFilter = 'user = \"' + u.id + '\" && tenant = \"' + tenantId + '\"'",
      expectedFindingCount: 1,
    },
    {
      name: 'Unsafe string concatenation in findFirstRecordByFilter call',
      code: 'var matchingProj = app.findFirstRecordByFilter("projects", "tenant = \'" + dfdTenant + "\'")',
      expectedFindingCount: 1,
    },
    {
      name: 'Unsafe += concatenation with variable',
      code: 'let filter = "status = \'ativo\'";\nfilter += " && user = \'" + userId + "\'"',
      expectedFindingCount: 1,
    },
    {
      name: 'Unsafe direct template interpolation in findRecordsByFilter',
      code: 'const recs = $app.findRecordsByFilter("users", `email = "${email}"`, "-created", 1, 0)',
      expectedFindingCount: 1,
    },
  ]

  // Negative fixtures (safe patterns that MUST be accepted without false positives)
  const negativeFixtures = [
    {
      name: 'Safe literal placeholder {:tenantId} with map',
      code: "const checkFilter = 'user = {:userId} && tenant = {:tenantId} && role = \\'admin\\' && status = \\'ativo\\'';\nconst checkParams = { userId: authId, tenantId: requestedTenant };\nconst adminMems = $app.findRecordsByFilter('user_memberships', checkFilter, '', 1, 0, checkParams);",
    },
    {
      name: 'Safe conditional literal appending (filter += literal placeholder)',
      code: "let memFilter = \"id != ''\";\nconst memParams = {};\nif (effectiveTenantId) {\n  memFilter = 'tenant = {:tenantId}';\n  memParams.tenantId = effectiveTenantId;\n}\nif (statusFilter) {\n  memFilter += ' && status = {:status}';\n  memParams.status = statusFilter;\n}",
    },
    {
      name: 'Safe static filter string without dynamic values',
      code: "var records = $app.findRecordsByFilter('tenants', \"status = 'ativa'\", 'name', 0, 0)",
    },
    {
      name: 'Safe recurring notifications query',
      code: "allRecurring = $app.findRecordsByFilter('notifications', \"recorrencia != 'nenhuma' && recorrencia_ativa = true && delivery_status = 'enviada'\", '-created', 500, 0)",
    },
    {
      name: 'Safe empty filter string',
      code: "const psList = $app.findRecordsByFilter('platform_settings', '', '', 1, 0)",
    },
  ]

  let allPassed = true

  // Test positive fixtures
  for (const fixture of positiveFixtures) {
    const findings = analyzeFilterCode(fixture.code, 'fixture_positive.js')
    if (findings.length < fixture.expectedFindingCount) {
      allPassed = false
      details.push(
        `FALHA: Fixture positiva [${fixture.name}] deveria ter sido reprovada pelo detector, mas passou sem flag.`,
      )
    } else {
      details.push(
        `SUCESSO: Fixture positiva [${fixture.name}] detectada corretamente como insegura (${findings.length} flags).`,
      )
    }
  }

  // Test negative fixtures
  for (const fixture of negativeFixtures) {
    const findings = analyzeFilterCode(fixture.code, 'fixture_negative.js')
    if (findings.length > 0) {
      allPassed = false
      details.push(
        `FALHA: Fixture negativa [${fixture.name}] é segura ({:param}), mas foi reprovada indevidamente: ${JSON.stringify(findings)}`,
      )
    } else {
      details.push(
        `SUCESSO: Fixture negativa [${fixture.name}] aprovada corretamente sem falsos positivos.`,
      )
    }
  }

  return {
    passed: allPassed,
    positiveCasesTested: positiveFixtures.length,
    negativeCasesTested: negativeFixtures.length,
    details,
  }
}

/**
 * Scans all active hooks in the project.
 */
export function runStaticHooksSecurityAnalysis(
  hooksDir = 'pocketbase/hooks',
): SecurityAnalysisResult {
  const fixtureResults = runDetectorFixtureTests()
  const scannedFiles: string[] = []
  const findings: Finding[] = []

  for (const hookName of ACTIVE_HOOK_NAMES) {
    const filePath = path.join(hooksDir, `${hookName}.js`)
    if (!fs.existsSync(filePath)) {
      continue
    }

    scannedFiles.push(filePath)
    const content = fs.readFileSync(filePath, 'utf-8')
    const fileFindings = analyzeFilterCode(content, filePath)
    findings.push(...fileFindings)
  }

  const passed = fixtureResults.passed && findings.length === 0

  return {
    passed,
    scannedFiles,
    findings,
    fixtureTests: fixtureResults,
  }
}

import { pathToFileURL } from 'node:url'

// Standalone CLI execution
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log('='.repeat(80))
  console.log('🔍 TESTE ESTÁTICO DE SEGURANÇA: VALIDAÇÃO DE PARAMETRIZAÇÃO EM HOOKS')
  console.log('='.repeat(80))

  const analysis = runStaticHooksSecurityAnalysis()

  console.log('\n[1/2] Teste de Fixtures do Detector (Positivas e Negativas):')
  for (const d of analysis.fixtureTests.details) {
    console.log('  ' + d)
  }

  console.log(
    `\nResultado Fixtures: ${analysis.fixtureTests.passed ? 'APROVADO ✅' : 'REPROVADO ❌'} (${analysis.fixtureTests.positiveCasesTested} positivas, ${analysis.fixtureTests.negativeCasesTested} negativas)`,
  )

  console.log('\n[2/2] Varredura dos Hooks Ativos em pocketbase/hooks/*.js:')
  console.log(`  Arquivos ativos inspecionados: ${analysis.scannedFiles.length}`)
  for (const file of analysis.scannedFiles) {
    console.log(`  - ${file}`)
  }

  if (analysis.findings.length > 0) {
    console.error('\n❌ VIOLAÇÕES DE SEGURANÇA DETECTADAS:')
    for (const f of analysis.findings) {
      console.error(`  Arquivo: ${f.file}:${f.line}`)
      console.error(`  Código:  ${f.code}`)
      console.error(`  Motivo:  ${f.reason}`)
      console.error('-'.repeat(60))
    }
  } else {
    console.log('\n✅ Zero concatenações dinâmicas detectadas em todos os hooks ativos.')
  }

  console.log('='.repeat(80))
  console.log(`STATUS FINAL DO TESTE ESTÁTICO: ${analysis.passed ? 'PASSOU (0)' : 'FALHOU (1)'}`)
  console.log('='.repeat(80))

  if (!analysis.passed) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}
