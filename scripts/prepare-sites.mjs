import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const workerOutput = resolve(root, 'dist', 'jhow_fit')
const serverOutput = resolve(root, 'dist', 'server')
const hostingSource = resolve(root, '.openai', 'hosting.json')
const hostingOutput = resolve(root, 'dist', '.openai')

if (!existsSync(resolve(workerOutput, 'index.js'))) {
  throw new Error('A saída Cloudflare do vinext não foi encontrada.')
}

mkdirSync(serverOutput, { recursive: true })
cpSync(workerOutput, serverOutput, { recursive: true, force: true })
mkdirSync(hostingOutput, { recursive: true })
cpSync(hostingSource, resolve(hostingOutput, 'hosting.json'), { force: true })

console.log('Sites artifact ready: dist/server/index.js')
