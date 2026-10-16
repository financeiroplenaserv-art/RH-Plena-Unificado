// Limpeza dos anexos órfãos do bucket ocorrencia-anexos (16/10/2026)
//
// --baixar   : baixa TODOS os 29 órfãos para dados-locais/backup_anexos_orfaos_2026-10-16/
//              (backup antes de qualquer remoção) + os 2 anexos do Antonio Marcos
//              para conferência visual.
// --apagar   : remove do bucket os 20 objetos classificados como lixo
//              (dry-run por padrão; só remove de verdade com --aplicar).
//
// Classificação (queries em dados-locais, 16/10/2026):
//   - 9 órfãos "únicos" são RECUPERADOS como anexos (INSERT via SQL) — não entram aqui
//   - 20 lixo: 10 duplicatas exatas de anexos registrados, 4 cópias repetidas de
//     recuperados, 5 de ocorrências de teste de junho (inexistentes), 1 arquivo smoke

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const linha of readFileSync(join(raiz, '.env'), 'utf8').split('\n')) {
  const m = linha.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BUCKET = 'ocorrencia-anexos'
const BACKUP_DIR = join(raiz, 'dados-locais', 'backup_anexos_orfaos_2026-10-16')

const ORFAOS = [
  '7b7dd702-dd99-4325-821c-596803aadd37/1781562127665_lk1bbxv2.pdf',
  'a3aea332-a370-46c3-bfbd-19f15123b1a8/1782486843016_6mzxtrzd.xlsx',
  '27623878-e174-49ed-b1a3-663647748ae1/1782513331982_izfoavr3.pdf',
  '27623878-e174-49ed-b1a3-663647748ae1/1782513347430_apo231c9.pdf',
  '6671ec0f-5b3a-4ae0-8d6e-507f5c1747b1/1782737117016_ykx4q324.pdf',
  '91754076-507d-47a6-8979-f0756bf543d6/1785772789588_jv5bejjz.jpeg',
  '5b368e1d-a3aa-48bc-b776-bf49f4d83480/1786452129894_rzrgsz2g.docx',
  'ec504138-9412-4454-85ca-bf23127702e5/1787059098390_rj4w7tns.pdf',
  'ec504138-9412-4454-85ca-bf23127702e5/1787059166400_62fl9zm0.pdf',
  '2d30f991-89cc-4f83-927d-79565120b461/1787070738511_e0m7ktfk.pdf',
  '2d30f991-89cc-4f83-927d-79565120b461/1787070835172_n5s6kfty.pdf',
  'e9148cd3-1aeb-457e-8d6e-81e212871276/1787947588391_mue5lsup.pdf',
  'b158cfd0-2da2-405b-af6e-fe8911708126/1789137263685_jwy74844.pdf',
  'b158cfd0-2da2-405b-af6e-fe8911708126/1789137335298_mttqgo84.pdf',
  'b158cfd0-2da2-405b-af6e-fe8911708126/1789137372735_7f4h5gzl.pdf',
  '55d26702-4cac-4e5f-9b74-e77218d22cb3/1789137661646_kgf72f10.pdf',
  '55d26702-4cac-4e5f-9b74-e77218d22cb3/1789137682081_61b3p7nu.pdf',
  'b158cfd0-2da2-405b-af6e-fe8911708126/1789492225198_mog4kt4k.pdf',
  '755f7bb2-0533-4319-805f-1a2049d953db/1789507374171_jdu86rn4.pdf',
  'aac74b4f-fded-4c3a-918f-f4c8dc2d69b5/1789736111716_f572jlhs.pdf',
  'aac74b4f-fded-4c3a-918f-f4c8dc2d69b5/1789736127292_vcgj4409.pdf',
  'aac74b4f-fded-4c3a-918f-f4c8dc2d69b5/1789736259652_tkgcfnre.pdf',
  'd0748497-e0f6-420b-863f-375b01450f4e/1790097331923_21e33v1b.pdf',
  'ec504138-9412-4454-85ca-bf23127702e5/1790268639989_0791w52l.docx',
  'bf3de243-8c0e-4a51-ae40-7bd38882a331/1791645339636_bsg690yl.pdf',
  'bf3de243-8c0e-4a51-ae40-7bd38882a331/1791645361474_y2ldx86n.pdf',
  'bf3de243-8c0e-4a51-ae40-7bd38882a331/1791645381586_gqv59cu0.pdf',
  'bf3de243-8c0e-4a51-ae40-7bd38882a331/1791714062013_eq7ne27n.pdf',
  'smoke/1781391330978_teste.txt',
]

const ANTONIO = [
  '0a69e4e6-39f8-4def-b1f5-2f06e33b42d8/1785266607150_ceikkh17.jpeg',
  '0a69e4e6-39f8-4def-b1f5-2f06e33b42d8/1785266612796_3sosn4lf.jpeg',
]

// 20 objetos a remover: 10 duplicatas de registrados, 4 cópias de recuperados,
// 5 de ocorrências de teste inexistentes, 1 smoke
const LIXO = [
  '7b7dd702-dd99-4325-821c-596803aadd37/1781562127665_lk1bbxv2.pdf',
  'a3aea332-a370-46c3-bfbd-19f15123b1a8/1782486843016_6mzxtrzd.xlsx',
  '27623878-e174-49ed-b1a3-663647748ae1/1782513331982_izfoavr3.pdf',
  '27623878-e174-49ed-b1a3-663647748ae1/1782513347430_apo231c9.pdf',
  '6671ec0f-5b3a-4ae0-8d6e-507f5c1747b1/1782737117016_ykx4q324.pdf',
  '91754076-507d-47a6-8979-f0756bf543d6/1785772789588_jv5bejjz.jpeg',
  'ec504138-9412-4454-85ca-bf23127702e5/1787059098390_rj4w7tns.pdf',
  'ec504138-9412-4454-85ca-bf23127702e5/1787059166400_62fl9zm0.pdf',
  '2d30f991-89cc-4f83-927d-79565120b461/1787070738511_e0m7ktfk.pdf',
  '2d30f991-89cc-4f83-927d-79565120b461/1787070835172_n5s6kfty.pdf',
  'b158cfd0-2da2-405b-af6e-fe8911708126/1789137263685_jwy74844.pdf',
  'b158cfd0-2da2-405b-af6e-fe8911708126/1789137335298_mttqgo84.pdf',
  'b158cfd0-2da2-405b-af6e-fe8911708126/1789137372735_7f4h5gzl.pdf',
  '55d26702-4cac-4e5f-9b74-e77218d22cb3/1789137682081_61b3p7nu.pdf',
  'aac74b4f-fded-4c3a-918f-f4c8dc2d69b5/1789736111716_f572jlhs.pdf',
  'aac74b4f-fded-4c3a-918f-f4c8dc2d69b5/1789736259652_tkgcfnre.pdf',
  'bf3de243-8c0e-4a51-ae40-7bd38882a331/1791645361474_y2ldx86n.pdf',
  'bf3de243-8c0e-4a51-ae40-7bd38882a331/1791645381586_gqv59cu0.pdf',
  'bf3de243-8c0e-4a51-ae40-7bd38882a331/1791714062013_eq7ne27n.pdf',
  'smoke/1781391330978_teste.txt',
]

async function baixar(path, destino) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) {
    console.log('  ERRO ao baixar', path, '-', error.message)
    return false
  }
  writeFileSync(destino, Buffer.from(await data.arrayBuffer()))
  return true
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--baixar')) {
    mkdirSync(BACKUP_DIR, { recursive: true })
    let ok = 0
    for (const path of [...ORFAOS, ...ANTONIO]) {
      const destino = join(BACKUP_DIR, path.replaceAll('/', '__'))
      if (await baixar(path, destino)) ok++
    }
    console.log(`baixados ${ok} de ${ORFAOS.length + ANTONIO.length} para ${BACKUP_DIR}`)
    return
  }
  if (args.includes('--apagar')) {
    const aplicar = args.includes('--aplicar')
    console.log(aplicar ? 'MODO APLICAR — removendo de verdade' : 'DRY-RUN — nada será removido')
    if (!aplicar) {
      console.log(`${LIXO.length} objetos seriam removidos:`)
      for (const path of LIXO) console.log('  -', path)
      return
    }
    const { data, error } = await supabase.storage.from(BUCKET).remove(LIXO)
    if (error) {
      console.log('ERRO ao remover:', error.message)
      process.exit(1)
    }
    console.log(`removidos: ${data?.length ?? 0} de ${LIXO.length}`)
    return
  }
  console.log('uso: node scripts/limpar-anexos-orfaos.mjs --baixar | --apagar [--aplicar]')
}

main()
