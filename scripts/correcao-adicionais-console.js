(function() {
  'use strict'

  const PDF_COLABORADORES = [
    { nome: 'Acacio', matricula: '772' },
    { nome: 'Adailton', matricula: '845' },
    { nome: 'Adalto', matricula: '846' },
    { nome: 'Adriana', matricula: '813' },
    { nome: 'Adriano', matricula: '814' },
  ]

  function mockKey(tabela) {
    return 'mock_' + tabela + '_adicionais'
  }

  function lerMock(tabela) {
    try {
      const raw = localStorage.getItem(mockKey(tabela))
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  function salvarMock(tabela, dados) {
    localStorage.setItem(mockKey(tabela), JSON.stringify(dados))
  }

  function gerarId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }

  function normalizarMatricula(m) {
    return String(m || '').replace(/\D/g, '').replace(/^0+/, '') || '0'
  }

  function carregarDados() {
    return {
      departamentos: lerMock('departamentos'),
      colaboradores: lerMock('colaboradores'),
      contratos: lerMock('contratos_adicionais'),
      vinculos: lerMock('vinculos_adicionais'),
      calendario: lerMock('calendario_adicionais'),
    }
  }

  function salvarDados(dados) {
    salvarMock('departamentos', dados.departamentos)
    salvarMock('colaboradores', dados.colaboradores)
    salvarMock('contratos_adicionais', dados.contratos)
    salvarMock('vinculos_adicionais', dados.vinculos)
    salvarMock('calendario_adicionais', dados.calendario)
  }

  function encontrarColaborador(colaboradores, matricula) {
    return colaboradores.find(function(c) {
      return normalizarMatricula(c.matricula) === normalizarMatricula(matricula)
    })
  }

  function encontrarVinculo(vinculos, colaboradorId, contratoId) {
    return vinculos.find(function(v) {
      return v.colaborador_id === colaboradorId && v.contrato_id === contratoId
    })
  }

  function listarVinculosAtivos(vinculos, colaboradores, contratos, inicio, fim) {
    console.log('\n=== Vinculos ativos de ' + inicio + ' a ' + fim + ' ===')
    const ativos = vinculos.filter(function(v) {
      return v.data_inicio <= fim && v.data_fim >= inicio
    })
    if (ativos.length === 0) {
      console.log('  Nenhum vinculo ativo no periodo.')
      return
    }
    ativos.forEach(function(v) {
      const col = colaboradores.find(function(c) { return c.id === v.colaborador_id })
      const contrato = contratos.find(function(c) { return c.id === v.contrato_id })
      const adicionais = contrato
        ? Object.entries(contrato.adicionais).filter(function(entry) { return entry[1] }).map(function(entry) { return entry[0] }).join(', ')
        : '-'
      console.log('  ' + (col ? col.nome_completo : '-') + ' | ' + (contrato ? contrato.nome : '-') + ' | adicionais: [' + adicionais + '] | ' + v.data_inicio + ' a ' + v.data_fim)
    })
  }

  function verificarColaboradoresPDF(colaboradores, contratos, vinculos) {
    console.log('\n=== Colaboradores do PDF ===')
    PDF_COLABORADORES.forEach(function(p) {
      const col = encontrarColaborador(colaboradores, p.matricula)
      if (!col) {
        console.log('  ' + p.nome + ' (' + p.matricula + '): NAO CADASTRADO')
        return
      }
      const vincs = vinculos.filter(function(v) { return v.colaborador_id === col.id })
      if (vincs.length === 0) {
        console.log('  ' + col.nome_completo + ' (' + col.matricula + '): CADASTRADO, mas SEM VINCULO')
        return
      }
      vincs.forEach(function(v) {
        const contrato = contratos.find(function(c) { return c.id === v.contrato_id })
        console.log('  ' + col.nome_completo + ' (' + col.matricula + '): vinculado a "' + (contrato ? contrato.nome : '') + '" de ' + v.data_inicio + ' a ' + v.data_fim)
      })
    })
  }

  function corrigirIntrajornadaAdailton(dados) {
    console.log('\n=== Correcao Intrajornada Adailton ===')
    const col = encontrarColaborador(dados.colaboradores, '845')
    if (!col) {
      console.log('  Adailton nao encontrado.')
      return
    }
    const vincs = dados.vinculos.filter(function(v) { return v.colaborador_id === col.id })
    if (vincs.length === 0) {
      console.log('  Adailton nao tem vinculo.')
      return
    }
    vincs.forEach(function(v) {
      const contrato = dados.contratos.find(function(c) { return c.id === v.contrato_id })
      if (!contrato) return
      console.log('  Contrato atual: ' + contrato.nome)
      console.log('  Intrajornada ativa: ' + contrato.adicionais.intrajornada)
      console.log('  Dias intrajornada: [' + contrato.dias_intrajornada.join(', ') + ']')

      if (!contrato.adicionais.intrajornada) {
        contrato.adicionais.intrajornada = true
        contrato.dias_intrajornada = [1, 2, 3, 4, 5]
        console.log('  -> Intrajornada ativada para Seg a Sex')
      }

      if (contrato.adicionais.intrajornada && contrato.dias_intrajornada.length === 0) {
        contrato.dias_intrajornada = [1, 2, 3, 4, 5]
        console.log('  -> Dias de intrajornada configurados para Seg a Sex')
      }
    })
  }

  function garantirVinculosPDF(dados) {
    console.log('\n=== Garantir vinculos dos colaboradores do PDF ===')

    const contratoInsalubridade = dados.contratos.find(function(c) { return c.adicionais.insalubridade }) || dados.contratos[0]
    const contratoNoturno = dados.contratos.find(function(c) { return c.adicionais.noturno }) || dados.contratos[0]
    const contratoIntrajornada = dados.contratos.find(function(c) { return c.adicionais.intrajornada }) || dados.contratos[0]

    const mapaVinculosEsperados = [
      { matricula: '772', contrato: contratoNoturno },
      { matricula: '845', contrato: contratoIntrajornada },
      { matricula: '846', contrato: contratoNoturno },
      { matricula: '813', contrato: contratoInsalubridade },
      { matricula: '814', contrato: contratoInsalubridade },
    ]

    mapaVinculosEsperados.forEach(function(item) {
      const col = encontrarColaborador(dados.colaboradores, item.matricula)
      if (!col) {
        console.log('  Matricula ' + item.matricula + ': colaborador nao cadastrado')
        return
      }
      const vinculo = encontrarVinculo(dados.vinculos, col.id, item.contrato.id)
      if (vinculo) {
        console.log('  ' + col.nome_completo + ': ja vinculado a "' + item.contrato.nome + '"')
      } else {
        const novo = {
          id: gerarId(),
          contrato_id: item.contrato.id,
          colaborador_id: col.id,
          data_inicio: '2026-05-20',
          data_fim: '2026-07-19',
          created_at: new Date().toISOString(),
        }
        dados.vinculos.push(novo)
        console.log('  ' + col.nome_completo + ': CRIADO vinculo com "' + item.contrato.nome + '"')
      }
    })
  }

  function removerAdilsonMuniz(dados) {
    console.log('\n=== Remover Adilson Muniz ===')
    const idx = dados.colaboradores.findIndex(function(c) {
      return c.nome_completo.toLowerCase().includes('adilson')
    })
    if (idx < 0) {
      console.log('  Adilson Muniz nao encontrado.')
      return
    }
    const col = dados.colaboradores[idx]
    dados.colaboradores.splice(idx, 1)
    dados.vinculos = dados.vinculos.filter(function(v) { return v.colaborador_id !== col.id })
    const vinculosRemovidos = dados.vinculos.length
    dados.calendario = dados.calendario.filter(function(d) {
      return !dados.vinculos.some(function(v) { return v.id === d.vinculo_id && v.colaborador_id === col.id })
    })
    console.log('  Adilson Muniz removido. Vinculos removidos: ' + vinculosRemovidos)
  }

  function calcularRelatorio(dados, mes, ano) {
    console.log('\n=== Relatorio ' + mes + '/' + ano + ' ===')
    const mesStr = ano + '-' + String(mes).padStart(2, '0')
    const inicioMes = mesStr + '-01'
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const fimMes = mesStr + '-' + String(ultimoDia).padStart(2, '0')

    const vinculosAtivos = dados.vinculos.filter(function(v) {
      return v.data_inicio <= fimMes && v.data_fim >= inicioMes
    })

    vinculosAtivos.forEach(function(v) {
      const col = dados.colaboradores.find(function(c) { return c.id === v.colaborador_id })
      const contrato = dados.contratos.find(function(c) { return c.id === v.contrato_id })
      if (!col || !contrato) return

      const dias = dados.calendario.filter(function(d) {
        return d.vinculo_id === v.id && d.data >= inicioMes && d.data <= fimMes
      })
      const trabalhou = dias.filter(function(d) { return d.status === 'trabalhou' }).length
      const folga = dias.filter(function(d) { return d.status === 'folga' || d.status === 'folga_substituicao' }).length
      const falta = dias.filter(function(d) { return d.status === 'falta' }).length
      const ferias = dias.filter(function(d) { return d.status === 'ferias' }).length
      const afastado = dias.filter(function(d) { return d.status === 'afastado' }).length

      Object.entries(contrato.adicionais)
        .filter(function(entry) { return entry[1] })
        .forEach(function(entry) {
          const adicional = entry[0]
          let intrajornada = 0
          if (adicional === 'intrajornada') {
            dias.filter(function(d) { return d.status === 'trabalhou' }).forEach(function(d) {
              const diaSemana = new Date(d.data + 'T00:00:00').getDay()
              if (contrato.dias_intrajornada.indexOf(diaSemana) !== -1) intrajornada++
            })
          }
          console.log('  ' + col.nome_completo + ' | ' + contrato.nome + ' | ' + adicional + ': trabalhados=' + trabalhou + ', folgas=' + folga + ', faltas=' + falta + ', ferias=' + ferias + ', afastados=' + afastado + ', intrajornada=' + intrajornada)
        })
    })
  }

  function main() {
    const dados = carregarDados()
    console.log('Dados carregados:')
    console.log('  Colaboradores: ' + dados.colaboradores.length)
    console.log('  Contratos: ' + dados.contratos.length)
    console.log('  Vinculos: ' + dados.vinculos.length)
    console.log('  Calendario: ' + dados.calendario.length)

    listarVinculosAtivos(dados.vinculos, dados.colaboradores, dados.contratos, '2026-05-20', '2026-06-19')
    verificarColaboradoresPDF(dados.colaboradores, dados.contratos, dados.vinculos)
    corrigirIntrajornadaAdailton(dados)
    garantirVinculosPDF(dados)
    removerAdilsonMuniz(dados)

    salvarDados(dados)
    console.log('\nDados salvos no localStorage.')

    const dadosAtualizados = carregarDados()
    calcularRelatorio(dadosAtualizados, 6, 2026)

    console.log('\n=== Resumo das correcoes ===')
    console.log('1. Vinculos ativos listados')
    console.log('2. Colaboradores do PDF verificados')
    console.log('3. Intrajornada de Adailton corrigida')
    console.log('4. Vinculos dos colaboradores do PDF garantidos')
    console.log('5. Adilson Muniz removido')
    console.log('\nRecarregue a pagina para aplicar as alteracoes na interface.')
  }

  main()
})()
