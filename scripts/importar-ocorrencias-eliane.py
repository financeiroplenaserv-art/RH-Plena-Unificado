# -*- coding: utf-8 -*-
"""
Importa ocorrências da planilha ELIANE_OCO_Funcionarios_160726 occ rh tratada_final.xlsx.
Associa colaboradores pelo nome completo. Usa placeholder para não identificados.
Faz double-check de consistência entre Macro e Tipo.
A coluna Matrícula é ignorada conforme orientação.
"""
import os
import re
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Carrega variáveis de ambiente
load_dotenv(Path.cwd() / '.env')
URL = os.getenv('VITE_SUPABASE_URL')
KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')

if not URL or not KEY:
    raise ValueError('VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias')

supabase = create_client(URL, KEY)

# Configurações
ARQUIVO = Path('public/ELIANE_OCO_Funcionarios_160726 occ rh tratada_final.xlsx')
ABA = 'Plan1'
PLACEHOLDER_MATRICULA = '999999'


# Mapa de macro grupo para formato padronizado do sistema
MAPEAMENTO_MACRO = {
    'Jornada e Ponto': '1. Jornada e Ponto',
    'Conduta e Disciplina': '2. Conduta e Disciplina',
    'Saúde e Segurança (SST)': '3. Saúde e Segurança (SST)',
    'Afastamentos e Licenças': '4. Afastamentos e Licenças',
    'Desempenho e Produtividade': '5. Desempenho e Produtividade',
    'Relacionamento Interpessoal': '6. Relacionamento Interpessoal',
    'Patrimonial': '7. Patrimonial',
    'Administrativas': '8. Administrativas',
    'Registro do RH': '9. Registro do RH',
}


# Mapa de (macro, tipo) para gravidade e base legal — baseado em docs/ocorrencias-grupos-tipos.md
MAPEAMENTO_GRAVIDADE_BASE = {
    # 1. Jornada e Ponto
    ('1. Jornada e Ponto', 'Atraso'): {'gravidade': 'Leve', 'base_legal': 'Art. 482, alínea "e" CLT — desídia no desempenho das funções.'},
    ('1. Jornada e Ponto', 'Falta Injustificada'): {'gravidade': 'Moderada', 'base_legal': 'Art. 473, §1º CLT — faltas injustificadas acarretam desconto em dias e anotação disciplinar.'},
    ('1. Jornada e Ponto', 'Falta Justificada (atestado)'): {'gravidade': 'Leve', 'base_legal': 'Art. 473, II CLT — atestado médico comprova a justificativa da ausência.'},
    ('1. Jornada e Ponto', 'Horas Extras não autorizadas'): {'gravidade': 'Moderada', 'base_legal': 'Art. 59 CLT — horas extras devem ser autorizadas prévia e expressamente.'},
    ('1. Jornada e Ponto', 'Esquecimento de Marcação'): {'gravidade': 'Leve', 'base_legal': 'Portaria 1.510/2009 — registro de ponto obrigatório.'},
    ('1. Jornada e Ponto', 'Saída Antecipada'): {'gravidade': 'Leve', 'base_legal': 'Art. 482, alínea "e" CLT — desídia no cumprimento do horário.'},
    ('1. Jornada e Ponto', 'Atraso Autorizado'): {'gravidade': 'Leve', 'base_legal': 'Regimento interno e controle de jornada — atraso previamente comunicado e autorizado pela chefia imediata.'},
    ('1. Jornada e Ponto', 'Falta Abonada'): {'gravidade': 'Leve', 'base_legal': 'Art. 473 CLT — faltas abonadas por motivos previstos em lei, convenção coletiva ou acordo individual.'},
    # 2. Conduta e Disciplina
    ('2. Conduta e Disciplina', 'Advertência Verbal'): {'gravidade': 'Leve', 'base_legal': 'Art. 482, alínea "e" CLT — desídia. Primeira notificação.'},
    ('2. Conduta e Disciplina', 'Advertência Escrita'): {'gravidade': 'Moderada', 'base_legal': 'Art. 482, alínea "e" CLT — desídia. Reincidência.'},
    ('2. Conduta e Disciplina', 'Suspensão 1 (1ª ocorrência)'): {'gravidade': 'Grave', 'base_legal': 'Art. 474 CLT — suspensão por 1 a 30 dias.'},
    ('2. Conduta e Disciplina', 'Suspensão 2 (reincidência)'): {'gravidade': 'Grave', 'base_legal': 'Art. 474 CLT — suspensão disciplinar. Segunda ocorrência.'},
    ('2. Conduta e Disciplina', 'Suspensão 3 (3ª ocorrência)'): {'gravidade': 'Grave', 'base_legal': 'Art. 474 + Art. 482 CLT — terceira suspensão, configura justa causa.'},
    ('2. Conduta e Disciplina', 'Justa Causa'): {'gravidade': 'Gravíssima', 'base_legal': 'Art. 482 CLT — rescisão do contrato pelo empregador por falta grave.'},
    ('2. Conduta e Disciplina', 'Insubordinação'): {'gravidade': 'Grave', 'base_legal': 'Art. 482, alínea "h" CLT — ato de indisciplina ou insubordinação.'},
    ('2. Conduta e Disciplina', 'Abandono de Emprego'): {'gravidade': 'Gravíssima', 'base_legal': 'Art. 482, alínea "i" CLT — abandono de emprego.'},
    # 3. Saúde e Segurança (SST)
    ('3. Saúde e Segurança (SST)', 'Infração de Segurança'): {'gravidade': 'Grave', 'base_legal': 'Art. 482, alínea "e" + Normas Regulamentadoras.'},
    ('3. Saúde e Segurança (SST)', 'Acidente de Trabalho (CAT)'): {'gravidade': 'Grave', 'base_legal': 'Lei 8.213/91, Art. 19 — acidente de trabalho deve ser comunicado.'},
    ('3. Saúde e Segurança (SST)', 'Ocorrência Simples Atendimento (OSA)'): {'gravidade': 'Moderada', 'base_legal': 'NR-4, NR-7, NR-9 — registros de saúde ocupacional.'},
    ('3. Saúde e Segurança (SST)', 'Desvio de Norma de Segurança'): {'gravidade': 'Moderada', 'base_legal': 'NR-6 a NR-36 — normas regulamentadoras de segurança.'},
    # 4. Afastamentos e Licenças
    ('4. Afastamentos e Licenças', 'Licença Médica (até 15 dias)'): {'gravidade': 'Leve', 'base_legal': 'Art. 473, II CLT — ausência por doença com atestado.'},
    ('4. Afastamentos e Licenças', 'Licença Médica (acima 15 dias — INSS)'): {'gravidade': 'Moderada', 'base_legal': 'Art. 473, II + Lei 8.213/91 — perícia médica do INSS.'},
    ('4. Afastamentos e Licenças', 'Licença Maternidade'): {'gravidade': 'Leve', 'base_legal': 'Lei 11.770/2008 — licença maternidade de 120 a 180 dias.'},
    ('4. Afastamentos e Licenças', 'Licença Paternidade'): {'gravidade': 'Leve', 'base_legal': 'Lei 13.257/2016 — licença paternidade de 20 dias.'},
    ('4. Afastamentos e Licenças', 'Licença Casamento'): {'gravidade': 'Leve', 'base_legal': 'Art. 473, IV CLT — licença por casamento (3 dias).'},
    ('4. Afastamentos e Licenças', 'Licença Luto'): {'gravidade': 'Leve', 'base_legal': 'Art. 473, VI CLT — licença por falecimento (2 dias).'},
    ('4. Afastamentos e Licenças', 'Afastamento por Acidente de Trabalho'): {'gravidade': 'Grave', 'base_legal': 'Lei 8.213/91, Art. 29 — auxílio-acidente.'},
    # 5. Desempenho e Produtividade
    ('5. Desempenho e Produtividade', 'Não Cumprimento de Metas'): {'gravidade': 'Moderada', 'base_legal': 'Metas estabelecidas em acordo individual ou coletivo.'},
    ('5. Desempenho e Produtividade', 'Ausência de Treinamento Obrigatório'): {'gravidade': 'Moderada', 'base_legal': 'NR-1 + Norma interna — treinamentos obrigatórios de segurança.'},
    ('5. Desempenho e Produtividade', 'Baixa Produtividade'): {'gravidade': 'Moderada', 'base_legal': 'Avaliação de desempenho documentada.'},
    ('5. Desempenho e Produtividade', 'Recusa de Tarefa'): {'gravidade': 'Grave', 'base_legal': 'Art. 482, alínea "h" CLT — recusa injustificada de serviço.'},
    # 6. Relacionamento Interpessoal
    ('6. Relacionamento Interpessoal', 'Assédio Moral'): {'gravidade': 'Gravíssima', 'base_legal': 'Lei 14.457/2022 + Art. 482, alíneas "b" e "j" CLT.'},
    ('6. Relacionamento Interpessoal', 'Conduta Inadequada'): {'gravidade': 'Grave', 'base_legal': 'Art. 482, alínea "b" CLT — incontinência de conduta.'},
    ('6. Relacionamento Interpessoal', 'Assédio Sexual'): {'gravidade': 'Gravíssima', 'base_legal': 'Art. 216-A CP + Lei 14.457/2022.'},
    ('6. Relacionamento Interpessoal', 'Discriminação'): {'gravidade': 'Gravíssima', 'base_legal': 'Lei 9.029/95 + Art. 5º CF.'},
    ('6. Relacionamento Interpessoal', 'Conflito entre Colegas'): {'gravidade': 'Moderada', 'base_legal': 'Norma interna de convivência.'},
    # 7. Patrimonial
    ('7. Patrimonial', 'Uso Indevido de Recursos'): {'gravidade': 'Moderada', 'base_legal': 'Art. 482, alínea "g" CLT — violação de segredo.'},
    ('7. Patrimonial', 'Dano ao Patrimônio'): {'gravidade': 'Grave', 'base_legal': 'Art. 462 CLT — responsabilidade civil do empregado.'},
    ('7. Patrimonial', 'Furto/Roubo'): {'gravidade': 'Gravíssima', 'base_legal': 'Art. 155/157 CP + Art. 482 CLT.'},
    ('7. Patrimonial', 'Violação de Sigilo'): {'gravidade': 'Grave', 'base_legal': 'Art. 482, alínea "g" CLT + LGPD (Lei 13.709/18).'},
    # 8. Administrativas
    ('8. Administrativas', 'Transferência de Setor'): {'gravidade': 'Leve', 'base_legal': 'Art. 468 a 471 CLT — alteração contratual.'},
    ('8. Administrativas', 'Promoção'): {'gravidade': 'Leve', 'base_legal': 'Regimento interno — progressão na carreira.'},
    ('8. Administrativas', 'Mudança de Função'): {'gravidade': 'Leve', 'base_legal': 'Art. 468 CLT — mudança de função por necessidade de serviço.'},
    ('8. Administrativas', 'Demissão/Desligamento'): {'gravidade': 'Leve', 'base_legal': 'Art. 477 CLT — extinção do contrato de trabalho.'},
    # 9. Registro do RH
    ('9. Registro do RH', 'Elogio / Atitude Louvável'): {'gravidade': 'Positiva', 'base_legal': 'Registro interno de reconhecimento.'},
    ('9. Registro do RH', 'Conclusão de Curso / Treinamento'): {'gravidade': 'Positiva', 'base_legal': 'Registro de capacitação profissional.'},
    ('9. Registro do RH', 'Indicação para Promoção'): {'gravidade': 'Positiva', 'base_legal': 'Política de cargos e salários / Avaliação de desempenho.'},
    ('9. Registro do RH', 'Ação de Destaque em Equipe'): {'gravidade': 'Positiva', 'base_legal': 'Registro de reconhecimento em equipe.'},
    ('9. Registro do RH', 'Outro Registro Positivo'): {'gravidade': 'Positiva', 'base_legal': 'Registro interno diversos.'},
    ('9. Registro do RH', 'Outros'): {'gravidade': 'Leve', 'base_legal': 'Registro interno geral — uso para fatos que não se enquadram nos demais tipos.'},
}


# Tipos permitidos por macro grupo (para double-check)
TIPOS_POR_MACRO = {
    '1. Jornada e Ponto': ['Atraso', 'Falta Injustificada', 'Falta Justificada (atestado)', 'Horas Extras não autorizadas', 'Esquecimento de Marcação', 'Saída Antecipada', 'Atraso Autorizado', 'Falta Abonada'],
    '2. Conduta e Disciplina': ['Advertência Verbal', 'Advertência Escrita', 'Suspensão 1 (1ª ocorrência)', 'Suspensão 2 (reincidência)', 'Suspensão 3 (3ª ocorrência)', 'Justa Causa', 'Insubordinação', 'Abandono de Emprego'],
    '3. Saúde e Segurança (SST)': ['Infração de Segurança', 'Acidente de Trabalho (CAT)', 'Ocorrência Simples Atendimento (OSA)', 'Desvio de Norma de Segurança'],
    '4. Afastamentos e Licenças': ['Licença Médica (até 15 dias)', 'Licença Médica (acima 15 dias — INSS)', 'Licença Maternidade', 'Licença Paternidade', 'Licença Casamento', 'Licença Luto', 'Afastamento por Acidente de Trabalho'],
    '5. Desempenho e Produtividade': ['Não Cumprimento de Metas', 'Ausência de Treinamento Obrigatório', 'Baixa Produtividade', 'Recusa de Tarefa'],
    '6. Relacionamento Interpessoal': ['Assédio Moral', 'Conduta Inadequada', 'Assédio Sexual', 'Discriminação', 'Conflito entre Colegas'],
    '7. Patrimonial': ['Uso Indevido de Recursos', 'Dano ao Patrimônio', 'Furto/Roubo', 'Violação de Sigilo'],
    '8. Administrativas': ['Transferência de Setor', 'Promoção', 'Mudança de Função', 'Demissão/Desligamento'],
    '9. Registro do RH': ['Elogio / Atitude Louvável', 'Conclusão de Curso / Treinamento', 'Indicação para Promoção', 'Ação de Destaque em Equipe', 'Outro Registro Positivo', 'Outros'],
}


def normalizar(texto):
    return (
        str(texto or '')
        .strip()
        .upper()
        .replace('Á', 'A').replace('É', 'E').replace('Í', 'I')
        .replace('Ó', 'O').replace('Ú', 'U').replace('Ã', 'A')
        .replace('Õ', 'O').replace('Ç', 'C').replace('Â', 'A')
        .replace('Ê', 'E').replace('Ô', 'O').replace('À', 'A')
        .replace('Ü', 'U')
    )


def tokens(texto):
    return [t for t in normalizar(texto).split(' ') if t]


def encontrar_colaborador(nome_planilha, colaboradores):
    nome_norm = normalizar(nome_planilha)
    tok_planilha = tokens(nome_planilha)

    # 1. Exato
    exatos = [c for c in colaboradores if normalizar(c['nome_completo']) == nome_norm]
    if len(exatos) == 1:
        return {'colaborador': exatos[0], 'metodo': 'exato'}
    if len(exatos) > 1:
        exatos.sort(key=lambda c: 0 if c.get('status') == 'Ativo' else 1)
        return {'colaborador': exatos[0], 'metodo': 'exato_multiplo', 'todos': exatos}

    # 2. Todos os tokens da planilha estão no nome do colaborador
    contem_todos = [c for c in colaboradores if all(t in tokens(c['nome_completo']) for t in tok_planilha)]
    if len(contem_todos) == 1:
        return {'colaborador': contem_todos[0], 'metodo': 'tokens_planilha_em_colaborador'}
    if len(contem_todos) > 1:
        contem_todos.sort(key=lambda c: (len(tokens(c['nome_completo'])), 0 if c.get('status') == 'Ativo' else 1))
        return {'colaborador': contem_todos[0], 'metodo': 'tokens_planilha_em_colaborador_multiplo', 'todos': contem_todos}

    # 3. Todos os tokens do colaborador estão no nome da planilha
    contem_todos_inv = [c for c in colaboradores if tokens(c['nome_completo']) and all(t in tok_planilha for t in tokens(c['nome_completo']))]
    if len(contem_todos_inv) == 1:
        return {'colaborador': contem_todos_inv[0], 'metodo': 'tokens_colaborador_em_planilha'}
    if len(contem_todos_inv) > 1:
        contem_todos_inv.sort(key=lambda c: (len(tokens(c['nome_completo'])), 0 if c.get('status') == 'Ativo' else 1))
        return {'colaborador': contem_todos_inv[0], 'metodo': 'tokens_colaborador_em_planilha_multiplo', 'todos': contem_todos_inv}

    return None


def parse_data(valor):
    if not valor or pd.isna(valor):
        return None
    s = str(valor).strip()
    # Tenta formato ISO com hora: 2026-07-15 00:00:00
    m = re.match(r'(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+\d{2}:\d{2}:\d{2})?', s)
    if m:
        ano, mes, dia = m.groups()
        try:
            return f'{int(ano):04d}-{int(mes):02d}-{int(dia):02d}'
        except ValueError:
            return None
    # Tenta formato brasileiro: 15/07/2026
    m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', s)
    if m:
        dia, mes, ano = m.groups()
        try:
            return f'{int(ano):04d}-{int(mes):02d}-{int(dia):02d}'
        except ValueError:
            return None
    return None


def limpar_texto(texto):
    if not texto:
        return ''
    s = str(texto).strip()
    s = re.sub(r'\s+', ' ', s)
    if s:
        s = s[0].upper() + s[1:]
    return s


def mapear_macro(macro):
    return MAPEAMENTO_MACRO.get(str(macro).strip(), str(macro).strip())


def mapear_tipo(tipo):
    return str(tipo).strip()


def obter_gravidade_e_base_legal(macro_grupo, tipo_ocorrencia):
    return MAPEAMENTO_GRAVIDADE_BASE.get(
        (macro_grupo, tipo_ocorrencia),
        {'gravidade': 'Moderada', 'base_legal': 'Não informado — importação do Gesoper.'}
    )


def verificar_consistencia(seq, macro, tipo):
    macro_padrao = mapear_macro(macro)
    tipo_padrao = mapear_tipo(tipo)
    permitidos = TIPOS_POR_MACRO.get(macro_padrao, [])
    if permitidos and tipo_padrao not in permitidos:
        return False
    return True


def buscar_placeholder():
    resp = supabase.table('colaboradores').select('id, nome_completo, empresa_id').eq('matricula', PLACEHOLDER_MATRICULA).limit(1).execute()
    if not resp.data:
        raise Exception(f'Placeholder com matrícula {PLACEHOLDER_MATRICULA} não encontrado.')
    return resp.data[0]


def buscar_usuario_admin():
    resp = supabase.table('perfis').select('id').eq('nivel_acesso', 'adm').limit(1).execute()
    if not resp.data:
        resp = supabase.table('perfis').select('id').eq('nivel_acesso', 'admin').limit(1).execute()
    if not resp.data:
        raise Exception('Não foi possível encontrar um usuário administrador.')
    return resp.data[0]['id']


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--real', action='store_true', help='Executa a inserção real no banco. Sem esta flag, executa em DRY-RUN.')
    parser.add_argument('--limite', type=int, help='Limite de ocorrências para teste')
    args = parser.parse_args()

    print('=== Importação de Ocorrências - Gesoper ===')
    print('Modo:', 'REAL' if args.real else 'DRY-RUN')
    if args.limite:
        print(f'Limite: {args.limite} ocorrências')
    print()

    # Lê planilha
    df = pd.read_excel(ARQUIVO, sheet_name=ABA, dtype=str)
    df.columns = [str(c).strip() for c in df.columns]
    print('Total de ocorrências na planilha:', len(df))
    print('Colunas:', df.columns.tolist())
    print()

    # Busca colaboradores
    print('Buscando colaboradores no banco...')
    colaboradores = []
    pagina = 0
    while True:
        resp = supabase.table('colaboradores').select('id, matricula, nome_completo, empresa_id, status').range(pagina * 1000, (pagina + 1) * 1000 - 1).execute()
        if not resp.data:
            break
        colaboradores.extend(resp.data)
        if len(resp.data) < 1000:
            break
        pagina += 1
    print('Colaboradores no banco:', len(colaboradores))

    placeholder = buscar_placeholder()
    print('Placeholder:', placeholder['nome_completo'], placeholder['id'])

    usuario_id = buscar_usuario_admin()
    print('Usuário admin:', usuario_id)
    print()

    df_importar = df.head(args.limite) if args.limite else df

    ocorrencias_para_inserir = []
    resumo = {'identificados': 0, 'nao_identificados': 0, 'multiplos': 0, 'inconsistencias': 0}
    inconsistencias = []

    for idx, row in df_importar.iterrows():
        numero = str(row.get('Seq', '')).strip()
        nome_planilha = str(row.get('Funcionário', '')).strip()
        macro_planilha = str(row.get('Macro', '')).strip()
        tipo_planilha = str(row.get('Tipo', '')).strip()
        local = str(row.get('Local', '')).strip()
        descricao_planilha = str(row.get('Descrição', '')).strip()
        resumo_planilha = str(row.get('Resumo', '')).strip()
        data_str = row.get('Data', '') or row.get('Data Lançamento', '')

        macro_grupo = mapear_macro(macro_planilha)
        tipo_ocorrencia = mapear_tipo(tipo_planilha)
        data_ocorrencia = parse_data(data_str)

        # Double-check de consistência Macro vs Tipo
        if not verificar_consistencia(numero, macro_planilha, tipo_planilha):
            resumo['inconsistencias'] += 1
            inconsistencias.append({
                'seq': numero,
                'funcionario': nome_planilha,
                'macro': macro_planilha,
                'tipo': tipo_planilha,
            })
            print(f'[INCONSISTÊNCIA] Seq {numero} - Macro "{macro_planilha}" vs Tipo "{tipo_planilha}"')

        match = encontrar_colaborador(nome_planilha, colaboradores)

        colaborador_id = placeholder['id']
        colaborador_nome = nome_planilha
        empresa_id = placeholder.get('empresa_id')

        if match:
            colaborador_id = match['colaborador']['id']
            colaborador_nome = match['colaborador']['nome_completo']
            empresa_id = match['colaborador'].get('empresa_id') or empresa_id
            resumo['identificados'] += 1
            if match.get('todos') and len(match['todos']) > 1:
                resumo['multiplos'] += 1
                print(f'[MULTIPLO] Seq {numero} - {nome_planilha} -> {match["colaborador"]["nome_completo"]} ({match["metodo"]})')
        else:
            resumo['nao_identificados'] += 1
            print(f'[NAO IDENTIFICADO] Seq {numero} - {nome_planilha}')

        info = obter_gravidade_e_base_legal(macro_grupo, tipo_ocorrencia)

        titulo = f'[{numero}] {limpar_texto(resumo_planilha) or tipo_ocorrencia}'
        descricao = (
            f'Ocorrência nº {numero} registrada no Gesoper.\n\n'
            f'Colaborador no Gesoper: {nome_planilha}\n\n'
            f'Descrição:\n{limpar_texto(descricao_planilha) or "Não informada."}'
        )

        ocorrencias_para_inserir.append({
            'colaborador_id': colaborador_id,
            'empresa_id': empresa_id,
            'colaborador_nome': colaborador_nome,
            'tipo_ocorrencia': tipo_ocorrencia,
            'macro_grupo': macro_grupo,
            'titulo': titulo,
            'data_ocorrencia': data_ocorrencia,
            'descricao': descricao,
            'status': 'Ativa',
            'tipo_penalidade': tipo_ocorrencia,
            'base_legal': info['base_legal'],
            'gravidade': info['gravidade'],
            'data_hora_ocorrido': data_ocorrencia,
            'local_ocorrido': limpar_texto(local) or None,
            'defesa_funcionario': 'Não informada — importação do Gesoper.',
            'medida_corretiva': 'Não informada — importação do Gesoper.',
            'prazo_acompanhamento': None,
            'testemunha_1_nome': None,
            'testemunha_1_cargo': None,
            'testemunha_2_nome': None,
            'testemunha_2_cargo': None,
            'usuario_id': usuario_id,
        })

    print('\n=== Resumo antes da inserção ===')
    print('Identificados:', resumo['identificados'])
    print('Não identificados:', resumo['nao_identificados'])
    print('Múltiplos matches:', resumo['multiplos'])
    print('Inconsistências Macro/Tipo:', resumo['inconsistencias'])

    if resumo['inconsistencias'] > 0:
        print('\n=== Lista de inconsistências ===')
        for inc in inconsistencias:
            print(f"  - Seq {inc['seq']} | {inc['funcionario']} | Macro: {inc['macro']} | Tipo: {inc['tipo']}")

    if not args.real:
        print('\nDRY-RUN: não foi inserido nenhum registro.')
        print('Primeiras ocorrências preparadas:')
        for o in ocorrencias_para_inserir[:10]:
            print('  -', o['titulo'], '->', o['colaborador_nome'])
            print('    Macro:', o['macro_grupo'], '| Tipo:', o['tipo_ocorrencia'], '| Data:', o['data_ocorrencia'])
            print('    Local:', o['local_ocorrido'])
            print('    Desc:', o['descricao'][:120] + '...')
        return

    if not ocorrencias_para_inserir:
        print('Nenhuma ocorrência para importar.')
        return

    print('\nInserindo ocorrências...')
    resp = supabase.table('ocorrencias').insert(ocorrencias_para_inserir).execute()
    inseridos = resp.data or []

    print('\n=== Resultado ===')
    print('Ocorrências inseridas:', len(inseridos))
    for o in inseridos[:10]:
        print('  -', o['id'], o['titulo'], '|', o['colaborador_nome'], '|', o['status'])


if __name__ == '__main__':
    main()
