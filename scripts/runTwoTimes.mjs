import { runIsolatedIntegrationSuite } from './src/lib/runIsolatedSuite.js'

console.log('--- EXECUTING REAL RUN 1 ---')
const res1 = await runIsolatedIntegrationSuite()
console.log('RUN 1 EXIT:', res1.exitCode, 'SUCCESS:', res1.success)

console.log('--- EXECUTING REAL RUN 2 (Different port/nonce) ---')
const res2 = await runIsolatedIntegrationSuite()
console.log('RUN 2 EXIT:', res2.exitCode, 'SUCCESS:', res2.success)

if (res1.exitCode !== 0 || res2.exitCode !== 0) {
  process.exit(1)
}
