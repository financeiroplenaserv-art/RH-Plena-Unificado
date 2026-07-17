import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

describe('Validador de RLS', () => {
  it('nao encontra policies abertas ou conflitantes nas migrations', () => {
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
