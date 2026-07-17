# -*- coding: utf-8 -*-
"""
Importa ocorrências da planilha OCO_Funcionarios_170726 -occs menores tratada_final.xlsx.
Associa colaboradores pelo nome completo. Usa placeholder para não identificados.
Faz double-check de consistência entre Macro e Tipo.
A coluna Matrícula é ignorada conforme orientação.
Origem: sistema antigo - ocorrências menores.
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
ARQUIVO = Path('public/OCO_Funcionarios_170726 -occs menores tratada_final.xlsx')
ABA = 'Plan1'
PLACEHOLDER_MATRICULA = '999999'
ORIGEM = 'sistema antigo - ocorrências menores'


# Mapa de tipo para macro grupo e formato padronizado do sistema
MAPEAMENTO_TIPO_MACRO = {
    'Falta Injustificada': '1. Jornada e Ponto',
    'Falta Justificada (atestado)': '1. Jornada e Ponto',
    'Falta Abonada': '1. Jornada e Ponto',
    'Licença Luto': '4. Afastamentos e Licenças',
    'Licença Casamento': '4. Afastamentos e Licenças',
    'Licença Médica (acima 15 dias é INSS)': '4. Afastamentos e Licenças',
    'Licença Médica (acima 15 dias — INSS)': '4. Afastamentos e Licenças',
    'Licença Paternidade': '4. Afastamentos e Licenças',
}


# Mapa de (macro, tipo) para gravidade e base legal — baseado em docs/ocorrencias-grupos-tipos.md
MAPEAMENTO_GRAVIDADE_BASE = {
    # 1. Jornada e Ponto
    ('1. Jornada e Ponto', 'Falta Injustificada'): {'gravidade': 'Moderada', 'base_legal': 'Art. 473, §1º CLT — faltas injustificadas acarretam desconto em dias e anotação disciplinar.'},
    ('1. Jornada e Ponto', 'Falta Justificada (atestado)'): {'gravidade': 'Leve', 'base_legal': 'Art. 473, II CLT — atestado médico comprova a justificativa da ausência.'},
    ('1. Jornada e Ponto', 'Falta Abonada'): {'gravidade': 'Leve', 'base_legal': 'Art. 473 CLT — faltas abonadas por motivos previstos em lei, convenção coletiva ou acordo individual.'},
    # 4. Afastamentos e Licenças
    ('4. Afastamentos e Licenças', 'Licença Médica (acima 15 dias — INSS)'): {'gravidade': 'Moderada', 'base_legal': 'Art. 473, II + Lei 8.213/91 — perícia médica do INSS.'},
    ('4. Afastamentos e Licenças', 'Licença Paternidade'): {'gravidade': 'Leve', 'base_legal': 'Lei 13.257/2016 — licença paternidade de 20 dias.'},
    ('4. Afastamentos e Licenças', 'Licença Casamento'): {'gravidade': 'Leve', 'base_legal': 'Art. 473, IV CLT — licença por casamento (3 dias).'},
    ('4. Afastamentos e Licenças', 'Licença Luto'): {'gravidade': 'Leve', 'base_legal': 'Art. 473, VI CLT — licença por falecimento (2 dias).'},
}


# Tipos permitidos por macro grupo (para double-check)
TIPOS_POR_MACRO = {
    '1. Jornada e Ponto': ['Atraso', 'Falta Injustificada', 'Falta Justificada (atestado)', 'Horas Extras não autorizadas', 'Esquecimento de Marcação', 'Saída Antecipada', 'Atraso Autorizado', 'Falta Abonada'],
    '4. Afastamentos e Licenças': ['Licença Médica (até 15 dias)', 'Licença Médica (acima 15 dias — INSS)', 'Licença Maternidade', 'Licença Paternidade', 'Licença Casamento', 'Licença Luto', 'Afastamento por Acidente de Trabalho'],
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
        return f'{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}'
    # Tenta formato dd/mm/yyyy
    m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', s)
    if m:
        return f'{int(m.group(3)):04d}-{int(m.group(2)):02d}-{int(m.group(1)):02d}'
    return None


def limpar_texto(texto):
    s = str(texto).strip()
    s = re.sub(r'\s+', ' ', s)
    if s:
        s = s[0].upper() + s[1:]
    return s


def mapear_macro(tipo):
    return MAPEAMENTO_TIPO_MACRO.get(str(tipo).strip(), '1. Jornada e Ponto')


def mapear_tipo(tipo):
    t = str(tipo).strip()
    if t == 'Licença Médica (acima 15 dias é INSS)':
        return 'Licença Médica (acima 15 dias — INSS)'
    return t


def obter_gravidade_e_base_legal(macro_grupo, tipo_ocorrencia):
    return MAPEAMENTO_GRAVIDADE_BASE.get(
        (macro_grupo, tipo_ocorrencia),
        {'gravidade': 'Moderada', 'base_legal': f'Não informado — importação {ORIGEM}.'}
    )


def verificar_consistencia(seq, macro, tipo):
    macro_padrao = mapear_macro(tipo)
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

    print(f'=== Importação de Ocorrências - Faltas ({ORIGEM}) ===')
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
    resumo = {'identificados': 0, 'nao_identificados': 0, 'multiplos': 0, 'inconsistencias': 0, 'ignorados_multiplo': 0}
    inconsistencias = []
    ignorados_multiplo = []

    for idx, row in df_importar.iterrows():
        numero = str(row.get('Seq', '')).strip()
        nome_planilha = str(row.get('Funcionário', '')).strip()
        tipo_planilha = str(row.get('Tipo', '')).strip()
        local = str(row.get('Local', '')).strip()
        titulo_planilha = str(row.get('Título', '')).strip()
        descricao_planilha = str(row.get('Descrição', '')).strip()
        data_str = row.get('Data', '') or row.get('Data Lançamento', '')

        tipo_ocorrencia = mapear_tipo(tipo_planilha)
        macro_grupo = mapear_macro(tipo_ocorrencia)
        data_ocorrencia = parse_data(data_str)

        # Double-check de consistência Macro vs Tipo
        if not verificar_consistencia(numero, macro_grupo, tipo_ocorrencia):
            resumo['inconsistencias'] += 1
            inconsistencias.append({
                'seq': numero,
                'funcionario': nome_planilha,
                'tipo': tipo_ocorrencia,
            })
            print(f'[INCONSISTÊNCIA] Seq {numero} - Tipo "{tipo_ocorrencia}" não pertence ao macro "{macro_grupo}"')

        match = encontrar_colaborador(nome_planilha, colaboradores)

        colaborador_id = placeholder['id']
        colaborador_nome = nome_planilha
        empresa_id = placeholder.get('empresa_id')

        if match:
            if match.get('todos') and len(match['todos']) > 1:
                resumo['multiplos'] += 1
                resumo['ignorados_multiplo'] += 1
                ignorados_multiplo.append({
                    'seq': numero,
                    'nome_planilha': nome_planilha,
                    'nome_banco': match['colaborador']['nome_completo'],
                })
                print(f'[MULTIPLO - IGNORADO] Seq {numero} - {nome_planilha} -> {match["colaborador"]["nome_completo"]} ({match["metodo"]})')
                continue
            colaborador_id = match['colaborador']['id']
            colaborador_nome = match['colaborador']['nome_completo']
            empresa_id = match['colaborador'].get('empresa_id') or empresa_id
            resumo['identificados'] += 1
        else:
            resumo['nao_identificados'] += 1
            print(f'[NAO IDENTIFICADO] Seq {numero} - {nome_planilha}')

        info = obter_gravidade_e_base_legal(macro_grupo, tipo_ocorrencia)

        titulo = f'[{numero}] {limpar_texto(titulo_planilha) or tipo_ocorrencia}'
        descricao = (
            f'Ocorrência nº {numero} registrada no {ORIGEM}.\n\n'
            f'Colaborador no {ORIGEM}: {nome_planilha}\n\n'
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
            'defesa_funcionario': f'Não informada — importação {ORIGEM}.',
            'medida_corretiva': f'Não informada — importação {ORIGEM}.',
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
    print('Ignorados por múltiplo match:', resumo['ignorados_multiplo'])
    print('Inconsistências Macro/Tipo:', resumo['inconsistencias'])

    if resumo['inconsistencias'] > 0:
        print('\n=== Lista de inconsistências ===')
        for inc in inconsistencias:
            print(inc)

    if resumo['ignorados_multiplo'] > 0:
        print('\n=== Lista de ignorados por múltiplo match ===')
        for item in ignorados_multiplo:
            print(item)

    if not args.real:
        print('\n=== DRY-RUN: nenhuma ocorrência foi inserida. ===')
        print('Para inserir de verdade, rode com --real')
        return

    # Inserção em lotes
    print('\nInserindo ocorrências...')
    lote = 500
    total_inserido = 0
    for i in range(0, len(ocorrencias_para_inserir), lote):
        chunk = ocorrencias_para_inserir[i:i+lote]
        resp = supabase.table('ocorrencias').insert(chunk).execute()
        inseridos = len(resp.data) if resp.data else 0
        total_inserido += inseridos
        print(f'  Inseridos {i + inseridos}/{len(ocorrencias_para_inserir)}')
        if hasattr(resp, 'error') and resp.error:
            print('  Erro:', resp.error)

    print(f'\n=== Importação concluída ===')
    print(f'Total inserido: {total_inserido}')


if __name__ == '__main__':
    main()
