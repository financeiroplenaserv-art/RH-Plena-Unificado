import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

// O validador é um script Python. Em ambientes sem Python no PATH (ex.: erro
// 9009 no Windows) o teste é pulado em vez de falhar — a falha indicaria
// problema de ambiente, não de RLS. Com Python instalado, roda normalmente.
const pythonCheck = spawnSync('python', ['--version'], { encoding: 'utf-8' })
const pythonDisponivel = !pythonCheck.error && pythonCheck.status === 0

describe('Validador de RLS', () => {
  it.skipIf(!pythonDisponivel)('nao encontra policies abertas ou conflitantes nas migrations', () => {
    const result = spawnSync('python', ['scripts/validar_rls.py'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const output = result.stdout + result.stderr

    expect(
      result.status,
      `Validador de RLS detectou policies conflitantes ou abertas.\n\nSaída:\n${output}`
    ).toBe(0)
    expect(output).toContain('OK - Nenhum problema critico de RLS encontrado.')
  })
})
