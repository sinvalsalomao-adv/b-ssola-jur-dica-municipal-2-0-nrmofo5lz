import fs from 'node:fs'
const p = './reports/security-isolated-execution-artifact.json'
console.log('EXISTS:', fs.existsSync(p))
if (fs.existsSync(p)) {
  console.log('CONTENT:\n', fs.readFileSync(p, 'utf-8'))
}
