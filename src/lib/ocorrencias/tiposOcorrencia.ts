export interface TipoOcorrencia {
  tipo: string
  macroGrupo: string
  gravidade: string
  baseLegal: string
  exigeAnexo: boolean
  texto: string
}

export const TIPOS_OCORRENCIA: TipoOcorrencia[] = [
  {
    macroGrupo: '1. Jornada e Ponto',
    tipo: 'Atraso',
    gravidade: 'Leve',
    baseLegal: 'Art. 482, alínea "e" CLT — desídia no desempenho das funções.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, o(a) colaborador(a) registrou entrada às ___h___, com atraso de ___ minutos em relação ao horário estabelecido de ___h___.\n\nTal conduta configura desídia no desempenho das funções (Art. 482, alínea "e", CLT). Solicitamos pontualidade no cumprimento do horário de trabalho. Em caso de reincidência, medidas disciplinares mais severas poderão ser adotadas.',
  },
  {
    macroGrupo: '1. Jornada e Ponto',
    tipo: 'Falta Injustificada',
    gravidade: 'Moderada',
    baseLegal: 'Art. 473, §1º CLT — faltas injustificadas acarretam desconto em dias e anotação disciplinar.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nRegistra-se que o(a) colaborador(a) faltou ao trabalho no dia ___/___/_____, sem apresentar justificativa prévia ou atestado médico, conforme registro de frequência.\n\nEsta é a ___ª ocorrência do tipo nos últimos 12 meses. A reincidência poderá acarretar medidas disciplinares mais severas, conforme Art. 482, alínea "e" da CLT.',
  },
  {
    macroGrupo: '1. Jornada e Ponto',
    tipo: 'Falta Justificada (atestado)',
    gravidade: 'Leve',
    baseLegal: 'Art. 473, II CLT — atestado médico comprova a justificativa da ausência.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) ausentou-se do trabalho no dia ___/___/_____, apresentando atestado médico em anexo.\n\nA ausência encontra-se devidamente justificada nos termos do Art. 473, II da CLT. O atestado foi conferido e arquivado para fins de registro interno.',
  },
  {
    macroGrupo: '1. Jornada e Ponto',
    tipo: 'Horas Extras não autorizadas',
    gravidade: 'Moderada',
    baseLegal: 'Art. 59 CLT — horas extras devem ser autorizadas prévia e expressamente.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, o(a) colaborador(a) permaneceu na empresa além do horário estabelecido, registrando saída às ___h___, sem autorização prévia da chefia imediata.\n\nConforme Art. 59 da CLT, horas extras devem ser autorizadas prévia e expressamente. Solicitamos que não permaneça além do horário sem comunicação e aprovação.',
  },
  {
    macroGrupo: '1. Jornada e Ponto',
    tipo: 'Esquecimento de Marcação',
    gravidade: 'Leve',
    baseLegal: 'Portaria 1.510/2009 — registro de ponto obrigatório.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) não registrou o ponto de [entrada/saída] no dia ___/___/_____.\n\nConforme Portaria 1.510/2009 e normas internas da empresa, o registro de ponto é obrigatório. Fica registrado o esquecimento e a correção será lançada manualmente após confirmação. Reincidências poderão gerar anotação disciplinar.',
  },
  {
    macroGrupo: '1. Jornada e Ponto',
    tipo: 'Saída Antecipada',
    gravidade: 'Leve',
    baseLegal: 'Art. 482, alínea "e" CLT — desídia no cumprimento do horário.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, o(a) colaborador(a) deixou o local de trabalho às ___h___, antes do horário estabelecido de término às ___h___, sem autorização prévia.\n\nTal conduta configura desídia no desempenho das funções (Art. 482, alínea "e", CLT). Solicitamos comunicação prévia em caso de necessidade de ausentar-se antes do horário.',
  },
  {
    macroGrupo: '1. Jornada e Ponto',
    tipo: 'Atraso Autorizado',
    gravidade: 'Leve',
    baseLegal: 'Regimento interno e controle de jornada — atraso previamente comunicado e autorizado pela chefia imediata.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, o(a) colaborador(a) registrou entrada às ___h___, com atraso de ___ minutos em relação ao horário estabelecido de ___h___.\n\nO atraso foi previamente comunicado e autorizado pela chefia imediata, conforme registro interno, não caracterizando desídia no desempenho das funções. Fica registrado para fins de controle de jornada e frequência.',
  },
  {
    macroGrupo: '1. Jornada e Ponto',
    tipo: 'Falta Abonada',
    gravidade: 'Leve',
    baseLegal: 'Art. 473 CLT — faltas abonadas por motivos previstos em lei, convenção coletiva ou acordo individual.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nRegistra-se que o(a) colaborador(a) faltou ao trabalho no dia ___/___/_____, por motivo de _________________, conforme solicitação apresentada e documentação comprobatória em anexo.\n\nA falta encontra-se abonada nos termos do Art. 473 da CLT, legislação aplicável, convenção coletiva ou acordo individual, não acarretando desconto em remuneração ou benefícios. A documentação foi conferida e arquivada no RH.',
  },
  {
    macroGrupo: '2. Conduta e Disciplina',
    tipo: 'Advertência Verbal',
    gravidade: 'Leve',
    baseLegal: 'Art. 482, alínea "e" CLT — desídia. Primeira notificação.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) foi notificado(a) verbalmente sobre sua conduta no dia ___/___/_____.\n\nFato ocorrido: [DESCREVER A CONDUTA]\n\nSolicitamos adequação do comportamento às normas internas da empresa. Esta notificação serve como registro para fins de acompanhamento.',
  },
  {
    macroGrupo: '2. Conduta e Disciplina',
    tipo: 'Advertência Escrita',
    gravidade: 'Moderada',
    baseLegal: 'Art. 482, alínea "e" CLT — desídia. Reincidência.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nVimos, pela presente, aplicar-lhe advertência disciplinar pelo fato de [DESCREVER O FATO], no dia ___/___/_____, agindo assim com desídia no desempenho de suas funções, na forma do art. 482, alínea "e", da CLT.\n\nSolicitamos adequar seu comportamento às normas e costumes desta empresa. Esclarecemos que a reincidência poderá ensejar suspensão disciplinar ou extinção do contrato por justa causa.',
  },
  {
    macroGrupo: '2. Conduta e Disciplina',
    tipo: 'Suspensão 1 (1ª ocorrência)',
    gravidade: 'Grave',
    baseLegal: 'Art. 474 CLT — suspensão por 1 a 30 dias.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nVimos pela presente aplicar-lhe a pena de suspensão disciplinar (1ª ocorrência), por ___ dias a partir de ___/___/_____, em razão da seguinte ocorrência:\n\n[DESCREVER MINUCIOSAMENTE A FALTA COMETIDA]\n\nA presente medida fundamenta-se no Art. 474 da CLT e no Regimento Interno da empresa. Esclarecemos que a reincidência poderá configurar justa causa.\n\nReassumirá suas funções em ___/___/_____.',
  },
  {
    macroGrupo: '2. Conduta e Disciplina',
    tipo: 'Suspensão 2 (reincidência)',
    gravidade: 'Grave',
    baseLegal: 'Art. 474 CLT — suspensão disciplinar. Segunda ocorrência.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nVimos pela presente aplicar-lhe a pena de suspensão disciplinar (2ª ocorrência — reincidência), por ___ dias a partir de ___/___/_____, em razão da seguinte ocorrência:\n\n[DESCREVER MINUCIOSAMENTE A FALTA COMETIDA]\n\nA presente medida fundamenta-se no Art. 474 da CLT. Trata-se de reincidência. Esclarecemos que nova ocorrência poderá configurar justa causa.\n\nReassumirá suas funções em ___/___/_____.',
  },
  {
    macroGrupo: '2. Conduta e Disciplina',
    tipo: 'Suspensão 3 (3ª ocorrência)',
    gravidade: 'Grave',
    baseLegal: 'Art. 474 + Art. 482 CLT — terceira suspensão, configura justa causa.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nVimos pela presente aplicar-lhe a pena de suspensão disciplinar (3ª ocorrência), por ___ dias a partir de ___/___/_____, em razão da seguinte ocorrência:\n\n[DESCREVER MINUCIOSAMENTE A FALTA COMETIDA]\n\nA presente medida fundamenta-se no Art. 474 da CLT. Alertamos que esta é a terceira suspensão disciplinar, e nova ocorrência do tipo poderá ensejar a rescisão do contrato por justa causa.\n\nReassumirá suas funções em ___/___/_____.',
  },
  {
    macroGrupo: '2. Conduta e Disciplina',
    tipo: 'Justa Causa',
    gravidade: 'Gravíssima',
    baseLegal: 'Art. 482 CLT — rescisão do contrato pelo empregador por falta grave.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nVimos notificar que, em razão de [DESCREVER A FALTA GRAVE], será instaurado procedimento de rescisão do contrato de trabalho por justa causa, fundamentado no art. 482, [ALÍNEA], da CLT.\n\nA conduta em questão caracteriza falta grave, justificando a medida extrema de dispensa imediata.',
  },
  {
    macroGrupo: '2. Conduta e Disciplina',
    tipo: 'Insubordinação',
    gravidade: 'Grave',
    baseLegal: 'Art. 482, alínea "h" CLT — ato de indisciplina ou insubordinação.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, o(a) colaborador(a) [DESCREVER O ATO DE INSUBORDINAÇÃO], caracterizando ato de indisciplina no ambiente de trabalho, na forma do art. 482, alínea "h", da CLT.\n\nEsclarecemos que a reincidência poderá ensejar medidas mais severas, incluindo suspensão ou justa causa.',
  },
  {
    macroGrupo: '2. Conduta e Disciplina',
    tipo: 'Abandono de Emprego',
    gravidade: 'Gravíssima',
    baseLegal: 'Art. 482, alínea "i" CLT — abandono de emprego.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nRegistra-se que o(a) colaborador(a) abandonou o posto de trabalho no dia ___/___/_____, ausentando-se sem autorização prévia e sem comunicação à empresa por mais de ___ dias consecutivos.\n\nTal conduta caracteriza abandono de emprego, na forma do art. 482, alínea "i", da CLT, podendo ensejar a rescisão do contrato por justa causa.',
  },
  {
    macroGrupo: '3. Saúde e Segurança (SST)',
    tipo: 'Infração de Segurança',
    gravidade: 'Grave',
    baseLegal: 'Art. 482, alínea "e" + Normas Regulamentadoras.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, o(a) colaborador(a) descumpriu normas de segurança do trabalho ao [DESCREVER A INFRAÇÃO], expondo a si e a terceiros a riscos ocupacionais.\n\nTal conduta fere as Normas Regulamentares vigentes e o Regimento Interno da empresa.',
  },
  {
    macroGrupo: '3. Saúde e Segurança (SST)',
    tipo: 'Acidente de Trabalho (CAT)',
    gravidade: 'Grave',
    baseLegal: 'Lei 8.213/91, Art. 19 — acidente de trabalho deve ser comunicado.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, às ___h___, ocorreu acidente de trabalho com o(a) colaborador(a) no local [LOCAL].\n\nDescrição do ocorrido: [DESCREVER O ACIDENTE]\n\nFoi emitida a Comunicação de Acidente de Trabalho (CAT) em anexo. O colaborador foi encaminhado para atendimento médico. Medidas preventivas serão adotadas conforme NR-1 e NR-9.',
  },
  {
    macroGrupo: '3. Saúde e Segurança (SST)',
    tipo: 'Ocorrência Simples Atendimento (OSA)',
    gravidade: 'Moderada',
    baseLegal: 'NR-4, NR-7, NR-9 — registros de saúde ocupacional.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, o(a) colaborador(a) foi atendido(a) pelo SESMT/Serviço Médico por motivo de [DESCREVER MOTIVO].\n\nTrata-se de Ocorrência de Simples Atendimento (OSA), sem caracterização de acidente de trabalho. Registro feito conforme NR-7 (PCMSO) para fins de controle de saúde ocupacional.',
  },
  {
    macroGrupo: '3. Saúde e Segurança (SST)',
    tipo: 'Desvio de Norma de Segurança',
    gravidade: 'Moderada',
    baseLegal: 'NR-6 a NR-36 — normas regulamentadoras de segurança.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, foi identificado desvio da norma de segurança [NORMA/NR] por parte do(a) colaborador(a), consistente em: [DESCREVER O DESVIO].\n\nTal desvio expõe o colaborador e terceiros a riscos ocupacionais, violando as Normas Regulamentadoras vigentes. Foi realizado orientação no local e medidas corretivas serão adotadas.',
  },
  {
    macroGrupo: '4. Afastamentos e Licenças',
    tipo: 'Licença Médica (até 15 dias)',
    gravidade: 'Leve',
    baseLegal: 'Art. 473, II CLT — ausência por doença com atestado.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) apresentou atestado médico para o período de ___/___/_____ a ___/___/_____, totalizando ___ dias de ausência.\n\nConforme Art. 473, II da CLT, o atestado médico é documento hábil para justificar a ausência. O período será abonado nos registros de ponto.',
  },
  {
    macroGrupo: '4. Afastamentos e Licenças',
    tipo: 'Licença Médica (acima 15 dias — INSS)',
    gravidade: 'Moderada',
    baseLegal: 'Art. 473, II + Lei 8.213/91 — perícia médica do INSS.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) encontra-se afastado(a) por período superior a 15 dias, de ___/___/_____ a ___/___/_____, por motivo de doença.\n\nAtestado médico e documentação foram encaminhados ao INSS para perícia médica conforme Lei 8.213/91. O afastamento será acompanhado pelo RH até o retorno ou deferimento do auxílio-doença.',
  },
  {
    macroGrupo: '4. Afastamentos e Licenças',
    tipo: 'Licença Maternidade',
    gravidade: 'Leve',
    baseLegal: 'Lei 11.770/2008 — licença maternidade de 120 a 180 dias.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) solicita licença maternidade pelo período de ___/___/_____ a ___/___/_____.\n\nConforme Lei 11.770/2008, o benefício é assegurado pelo período de [120/180] dias. A documentação (certidão de nascimento, declaração da maternidade) foi arquivada no RH.',
  },
  {
    macroGrupo: '4. Afastamentos e Licenças',
    tipo: 'Licença Paternidade',
    gravidade: 'Leve',
    baseLegal: 'Lei 13.257/2016 — licença paternidade de 20 dias.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) solicita licença paternidade pelo período de ___/___/_____ a ___/___/_____.\n\nConforme Lei 13.257/2016, o benefício é assegurado pelo período de 20 dias. A certidão de nascimento foi arquivada no RH.',
  },
  {
    macroGrupo: '4. Afastamentos e Licenças',
    tipo: 'Licença Casamento',
    gravidade: 'Leve',
    baseLegal: 'Art. 473, IV CLT — licença por casamento (3 dias).',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) solicita licença por casamento para o período de ___/___/_____ a ___/___/_____.\n\nConforme Art. 473, IV da CLT, são assegurados 3 dias consecutivos de licença. A certidão de casamento foi arquivada no RH.',
  },
  {
    macroGrupo: '4. Afastamentos e Licenças',
    tipo: 'Licença Luto',
    gravidade: 'Leve',
    baseLegal: 'Art. 473, VI CLT — licença por falecimento (2 dias).',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) solicita licença luto pelo período de ___/___/_____ a ___/___/_____, em razão do falecimento de [GRAU DE PARENTESCO].\n\nConforme Art. 473, VI da CLT, são assegurados 2 dias consecutivos de licença por falecimento de cônjuge, companheiro, parente consanguíneo ou afim. A certidão de óbito foi arquivada no RH.',
  },
  {
    macroGrupo: '4. Afastamentos e Licenças',
    tipo: 'Afastamento por Acidente de Trabalho',
    gravidade: 'Grave',
    baseLegal: 'Lei 8.213/91, Art. 29 — auxílio-acidente.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) foi afastado(a) em ___/___/_____ em razão de acidente de trabalho ocorrido em [DESCREVER CIRCUNSTÂNCIAS].\n\nA CAT foi emitida e encaminhada ao INSS. O afastamento será acompanhado pelo RH e pelo SESMT até o retorno do colaborador ou deferimento do benefício previdenciário.',
  },
  {
    macroGrupo: '5. Desempenho e Produtividade',
    tipo: 'Não Cumprimento de Metas',
    gravidade: 'Moderada',
    baseLegal: 'Metas estabelecidas em acordo individual ou coletivo.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) não atingiu as metas estabelecidas para o período de [MÊS/ANO], conforme plano de metas acordado.\n\nMeta estabelecida: [META]\nResultado alcançado: [RESULTADO]\n\nSolicitamos adequação do desempenho ao nível esperado para a função. Será realizada reunião de acompanhamento para definir plano de ação.',
  },
  {
    macroGrupo: '5. Desempenho e Produtividade',
    tipo: 'Ausência de Treinamento Obrigatório',
    gravidade: 'Moderada',
    baseLegal: 'NR-1 + Norma interna — treinamentos obrigatórios de segurança.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) não compareceu ao treinamento obrigatório de [NOME DO TREINAMENTO], realizado em ___/___/_____.\n\nConforme NR-1 e normas internas, o treinamento é obrigatório para o exercício da função. Nova data será agendada e a ausência será registrada no prontuário do colaborador.',
  },
  {
    macroGrupo: '5. Desempenho e Produtividade',
    tipo: 'Baixa Produtividade',
    gravidade: 'Moderada',
    baseLegal: 'Avaliação de desempenho documentada.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) apresenta baixa produtividade no exercício de suas funções, evidenciada por [DESCREVER INDICADORES].\n\nFoi realizada reunião de feedback em ___/___/_____ para identificar causas e definir plano de melhoria. O acompanhamento será realizado pelo prazo de ___ dias.',
  },
  {
    macroGrupo: '5. Desempenho e Produtividade',
    tipo: 'Recusa de Tarefa',
    gravidade: 'Grave',
    baseLegal: 'Art. 482, alínea "h" CLT — recusa injustificada de serviço.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, o(a) colaborador(a) recusou-se a executar a tarefa de [DESCREVER TAREFA], determinada pelo superior hierárquico.\n\nTal recusa injustificada configura insubordinação, na forma do art. 482, alínea "h", da CLT. A reincidência poderá ensejar medidas disciplinares mais severas.',
  },
  {
    macroGrupo: '6. Relacionamento Interpessoal',
    tipo: 'Assédio Moral',
    gravidade: 'Gravíssima',
    baseLegal: 'Lei 14.457/2022 + Art. 482, alíneas "b" e "j" CLT.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, o(a) colaborador(a) [DESCREVER A CONDUTA DE ASSÉDIO], expondo o(a) colega [NOME] a situação humilhante e constrangedora no ambiente de trabalho.\n\nTal conduta configura assédio moral, vedado pela Lei 14.457/2022 e pelo art. 482, alíneas "b" e "j", da CLT. A reincidência ensejará a rescisão do contrato por justa causa.',
  },
  {
    macroGrupo: '6. Relacionamento Interpessoal',
    tipo: 'Conduta Inadequada',
    gravidade: 'Grave',
    baseLegal: 'Art. 482, alínea "b" CLT — incontinência de conduta.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, o(a) colaborador(a) [DESCREVER A CONDUTA INADEQUADA], caracterizando incontinência de conduta no ambiente de trabalho, na forma do art. 482, alínea "b", da CLT.\n\nSolicitamos adequação do comportamento às normas de convivência e respeito mútuo entre os colaboradores.',
  },
  {
    macroGrupo: '6. Relacionamento Interpessoal',
    tipo: 'Assédio Sexual',
    gravidade: 'Gravíssima',
    baseLegal: 'Art. 216-A CP + Lei 14.457/2022.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, o(a) colaborador(a) [DESCREVER A CONDUTA], caracterizando assédio sexual no ambiente de trabalho.\n\nTal conduta configura crime tipificado no Art. 216-A do Código Penal e violação da Lei 14.457/2022. O fato será reportado às autoridades competentes e ensejará a rescisão do contrato por justa causa.',
  },
  {
    macroGrupo: '6. Relacionamento Interpessoal',
    tipo: 'Discriminação',
    gravidade: 'Gravíssima',
    baseLegal: 'Lei 9.029/95 + Art. 5º CF.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, foi constatado ato discriminatório por parte do(a) colaborador(a) [NOME], consistente em [DESCREVER O ATO].\n\nA empresa repudia qualquer forma de discriminação, conforme Lei 9.029/95 e Art. 5º da Constituição Federal. Medidas disciplinares serão adotadas, podendo incluir a rescisão do contrato.',
  },
  {
    macroGrupo: '6. Relacionamento Interpessoal',
    tipo: 'Conflito entre Colegas',
    gravidade: 'Moderada',
    baseLegal: 'Norma interna de convivência.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, ocorreu conflito entre os colaboradores [NOME 1] e [NOME 2], consistente em [DESCREVER O CONFLITO].\n\nFoi realizada mediação entre as partes e advertência verbal. Reincidências poderão ensejar medidas disciplinares formais.',
  },
  {
    macroGrupo: '7. Patrimonial',
    tipo: 'Uso Indevido de Recursos',
    gravidade: 'Moderada',
    baseLegal: 'Art. 482, alínea "g" CLT — violação de segredo.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, constatou-se o uso indevido de [DESCREVER O RECURSO E O USO], em desacordo com as normas internas da empresa e a função exercida.\n\nTal conduta caracteriza violação das diretrizes organizacionais e poderá acarretar medidas disciplinares conforme gravidade do caso.',
  },
  {
    macroGrupo: '7. Patrimonial',
    tipo: 'Dano ao Patrimônio',
    gravidade: 'Grave',
    baseLegal: 'Art. 462 CLT — responsabilidade civil do empregado.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, o(a) colaborador(a) causou dano ao patrimônio da empresa, consistente em [DESCREVER O DANO], estimado em R$ ______.\n\nConforme Art. 462 da CLT, o empregado responde civilmente pelos danos causados por dolo ou culpa. O fato será registrado e medidas de ressarcimento serão avaliadas.',
  },
  {
    macroGrupo: '7. Patrimonial',
    tipo: 'Furto/Roubo',
    gravidade: 'Gravíssima',
    baseLegal: 'Art. 155/157 CP + Art. 482 CLT.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, foi constatado [furto/roubo] de [DESCREVER OBJETO(S)] envolvendo o(a) colaborador(a).\n\nTal conduta configura crime previsto nos Art. 155/157 do Código Penal e justifica a rescisão do contrato por justa causa. O Boletim de Ocorrência foi registrado e o fato será reportado às autoridades.',
  },
  {
    macroGrupo: '7. Patrimonial',
    tipo: 'Violação de Sigilo',
    gravidade: 'Grave',
    baseLegal: 'Art. 482, alínea "g" CLT + LGPD (Lei 13.709/18).',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nNo dia ___/___/_____, o(a) colaborador(a) violou o sigilo [profissional/comercial/de dados], consistente em [DESCREVER A VIOLAÇÃO].\n\nTal conduta fere o Art. 482, alínea "g" da CLT e a Lei Geral de Proteção de Dados (LGPD). Medidas disciplinares serão adotadas, podendo incluir a rescisão do contrato.',
  },
  {
    macroGrupo: '8. Administrativas',
    tipo: 'Transferência de Setor',
    gravidade: 'Leve',
    baseLegal: 'Art. 468 a 471 CLT — alteração contratual.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) será transferido(a) do setor [SETOR ORIGEM] para o setor [SETOR DESTINO], a partir de ___/___/_____.\n\nConforme Art. 468 a 471 da CLT, a transferência observa as necessidades do serviço e os interesses do colaborador. Não haverá prejuízo salarial ou de função.',
  },
  {
    macroGrupo: '8. Administrativas',
    tipo: 'Promoção',
    gravidade: 'Leve',
    baseLegal: 'Regimento interno — progressão na carreira.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) será promovido(a) ao cargo de [NOVO CARGO], a partir de ___/___/_____, em reconhecimento ao seu desempenho e dedicação.\n\nA promoção segue os critérios do Regimento Interno e Política de Cargos e Salários da empresa.',
  },
  {
    macroGrupo: '8. Administrativas',
    tipo: 'Mudança de Função',
    gravidade: 'Leve',
    baseLegal: 'Art. 468 CLT — mudança de função por necessidade de serviço.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) será realocado(a) para a função de [NOVA FUNÇÃO], a partir de ___/___/_____, em razão de necessidade de serviço.\n\nConforme Art. 468 da CLT, a mudança de função observa a necessidade do serviço e não acarreta prejuízo ao colaborador. O período de adaptação será acompanhado.',
  },
  {
    macroGrupo: '8. Administrativas',
    tipo: 'Demissão/Desligamento',
    gravidade: 'Leve',
    baseLegal: 'Art. 477 CLT — extinção do contrato de trabalho.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) terá seu contrato de trabalho rescindido em ___/___/_____, conforme Art. 477 da CLT.\n\nTipo de rescisão: [SEM JUSTA CAUSA / COM JUSTA CAUSA / PEDIDO DE DEMISSÃO / TÉRMINO DE CONTRATO]\n\nAs verbas rescisórias serão calculadas e o pagamento será efetuado no prazo legal. A homologação será agendada conforme necessidade.',
  },
  {
    macroGrupo: '9. Registro do RH',
    tipo: 'Elogio / Atitude Louvável',
    gravidade: 'Positiva',
    baseLegal: 'Registro interno de reconhecimento.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nRegistramos o reconhecimento ao(a) colaborador(a) pela seguinte atitude louvável ocorrida em ___/___/_____:\n\n[DESCREVER A ATITUDE / AÇÃO / COMPORTAMENTO DESTACÁVEL]\n\nTal conduta demonstra comprometimento, profissionalismo e alinhamento com os valores da empresa. O presente registro será arquivado no prontuário do colaborador para fins de avaliação de desempenho e progressão na carreira.',
  },
  {
    macroGrupo: '9. Registro do RH',
    tipo: 'Conclusão de Curso / Treinamento',
    gravidade: 'Positiva',
    baseLegal: 'Registro de capacitação profissional.',
    exigeAnexo: true,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) concluiu com êxito o curso/treinamento de [NOME DO CURSO], realizado no período de ___/___/_____ a ___/___/_____, com carga horária de ___ horas.\n\nO certificado/comprovante de conclusão encontra-se anexo ao presente registro. Esta capacitação contribui para o desenvolvimento profissional do colaborador e será considerada em futuras avaliações de desempenho.',
  },
  {
    macroGrupo: '9. Registro do RH',
    tipo: 'Indicação para Promoção',
    gravidade: 'Positiva',
    baseLegal: 'Política de cargos e salários / Avaliação de desempenho.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) está sendo indicado(a) para promoção ao cargo de [NOVO CARGO], em reconhecimento ao seu desempenho exemplar e dedicação demonstrada no exercício de suas funções.\n\nJustificativa da indicação: [DESCREVER MOTIVOS — METAS ATINGIDAS, PROJETOS EXECUTADOS, LIDERANÇA, ETC.]\n\nA promoção segue os critérios estabelecidos na Política de Cargos e Salários da empresa e será submetida à aprovação da diretoria.',
  },
  {
    macroGrupo: '9. Registro do RH',
    tipo: 'Ação de Destaque em Equipe',
    gravidade: 'Positiva',
    baseLegal: 'Registro de reconhecimento em equipe.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nO(A) colaborador(a) demonstrou ação de destaque em equipe no dia ___/___/_____, conforme descrito a seguir:\n\n[DESCREVER A AÇÃO — COLABORAÇÃO EXCEPCIONAL, RESOLUÇÃO DE CONFLITO, AJUDA A COLEGAS, LIDERANÇA NATURAL, ETC.]\n\nO espírito de equipe e colaboração demonstrados são valores fundamentais da empresa e serão registrados no prontuário do colaborador.',
  },
  {
    macroGrupo: '9. Registro do RH',
    tipo: 'Outro Registro Positivo',
    gravidade: 'Positiva',
    baseLegal: 'Registro interno diversos.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nRegistramos a seguinte ocorrência positiva referente ao(a) colaborador(a) em ___/___/_____:\n\n[DESCREVER A OCORRÊNCIA — QUALQUER FATO POSITIVO QUE NÃO SE ENCAIXE NOS TIPOS ANTERIORES: ANIVERSÁRIO DE EMPRESA, TEMPO DE CASA, PREMIAÇÃO, MENÇÃO HONROSA, ETC.]\n\nEste registro será mantido no prontuário do colaborador para fins de histórico e avaliação.',
  },
  {
    macroGrupo: '9. Registro do RH',
    tipo: 'Outros',
    gravidade: 'Leve',
    baseLegal: 'Registro interno geral — uso para fatos que não se enquadram nos demais tipos.',
    exigeAnexo: false,
    texto:
      '[EMPRESA] — CNPJ: [CNPJ]\n\nRegistramos o seguinte fato referente ao(a) colaborador(a) em ___/___/_____:\n\n[DESCREVER A OCORRÊNCIA — QUALQUER INFORMAÇÃO, COMUNICAÇÃO OU REGISTRO QUE NÃO SE ENCAIXE NOS TIPOS ANTERIORES]\n\nEste registro será mantido no prontuário do colaborador para fins de histórico e controle interno do RH.',
  },
]

export const MACRO_GRUPOS = [...new Set(TIPOS_OCORRENCIA.map((t) => t.macroGrupo))]

export const TIPOS_COM_DOCUMENTO_OBRIGATORIO = TIPOS_OCORRENCIA.filter((t) => t.exigeAnexo).map(
  (t) => t.tipo
)

export function exigeDocumento(tipo: string): boolean {
  return TIPOS_COM_DOCUMENTO_OBRIGATORIO.includes(tipo)
}
