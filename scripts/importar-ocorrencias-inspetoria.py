# -*- coding: utf-8 -*-
"""
Importa ocorrências da inspetoria do arquivo ocorrencias_inspetoria_classificado.xlsx.
Associa colaboradores pelo nome completo. Usa placeholder para não identificados.
"""
import os
import re
import unicodedata
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
ARQUIVO = Path('public/ocorrencias_inspetoria_classificado.xlsx')
ABA = 'Ocorrências'
PLACEHOLDER_MATRICULA = '999999'


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
    m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', s)
    if not m:
        return None
    dia, mes, ano = m.groups()
    try:
        return f'{int(ano):04d}-{int(mes):02d}-{int(dia):02d}'
    except ValueError:
        return None


def limpar_texto(texto):
    if not texto:
        return ''
    s = str(texto).strip()
    s = re.sub(r'\s+', ' ', s)
    if s:
        s = s[0].upper() + s[1:]
    return s


def mapear_macro_grupo(macro):
    mapa = {
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
    return mapa.get(str(macro).strip(), macro)


def mapear_tipo_ocorrencia(tipo):
    # Mantém os valores conforme cadastrados no sistema
    return str(tipo).strip()


def obter_gravidade_e_base_legal(macro_grupo, tipo_ocorrencia):
    """
    Retorna gravidade e base legal com base na documentação docs/ocorrencias-grupos-tipos.md.
    """
    mapa = {
        ('1. Jornada e Ponto', 'Atraso'): {
            'gravidade': 'Leve',
            'base_legal': 'Art. 482, alínea "e" CLT — desídia no desempenho das funções.',
        },
        ('1. Jornada e Ponto', 'Falta Injustificada'): {
            'gravidade': 'Moderada',
            'base_legal': 'Art. 473, §1º CLT — faltas injustificadas acarretam desconto em dias e anotação disciplinar.',
        },
        ('2. Conduta e Disciplina', 'Suspensão 1 (1ª ocorrência)'): {
            'gravidade': 'Grave',
            'base_legal': 'Art. 474 CLT — suspensão por 1 a 30 dias.',
        },
        ('2. Conduta e Disciplina', 'Conduta Inadequada'): {
            'gravidade': 'Grave',
            'base_legal': 'Art. 482, alínea "b" CLT — incontinência de conduta.',
        },
        ('5. Desempenho e Produtividade', 'Baixa Produtividade'): {
            'gravidade': 'Moderada',
            'base_legal': 'Avaliação de desempenho documentada.',
        },
        ('6. Relacionamento Interpessoal', 'Conflito entre Colegas'): {
            'gravidade': 'Moderada',
            'base_legal': 'Norma interna de convivência.',
        },
        ('8. Administrativas', 'Mudança de Função'): {
            'gravidade': 'Leve',
            'base_legal': 'Art. 468 CLT — mudança de função por necessidade de serviço.',
        },
        ('8. Administrativas', 'Outros'): {
            'gravidade': 'Leve',
            'base_legal': 'Registro interno geral — uso para fatos que não se enquadram nos demais tipos.',
        },
    }
    return mapa.get((macro_grupo, tipo_ocorrencia), {'gravidade': 'Moderada', 'base_legal': 'Não informado — importação da inspetoria.'})


def buscar_placeholder():
    resp = supabase.table('colaboradores').select('id, nome_completo, empresa_id').eq('matricula', PLACEHOLDER_MATRICULA).limit(1).execute()
    if not resp.data:
        raise Exception(f'Placeholder com matrícula {PLACEHOLDER_MATRICULA} não encontrado.')
    return resp.data[0]


def buscar_usuario_admin():
    resp = supabase.table('perfis').select('id').eq('nivel_acesso', 'adm').limit(1).execute()
    if not resp.data:
        # tenta legado 'admin'
        resp = supabase.table('perfis').select('id').eq('nivel_acesso', 'admin').limit(1).execute()
    if not resp.data:
        raise Exception('Não foi possível encontrar um usuário administrador.')
    return resp.data[0]['id']


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='Não salva no banco')
    args = parser.parse_args()

    print('=== Importação de Ocorrências da Inspetoria ===')
    print('Modo:', 'DRY-RUN' if args.dry_run else 'REAL')
    print()

    # Lê planilha
    df = pd.read_excel(ARQUIVO, sheet_name=ABA, dtype=str)
    df.columns = [str(c).strip() for c in df.columns]
    print('Total de ocorrências na planilha:', len(df))

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

    ocorrencias_para_inserir = []
    resumo = {'identificados': 0, 'nao_identificados': 0, 'multiplos': 0}

    for idx, row in df.iterrows():
        numero = str(row.get('Seq.', '')).strip()
        nome_planilha = str(row.get('Funcionário', '')).strip()
        macro_planilha = str(row.get('MACRO', '')).strip()
        tipo_planilha = str(row.get('TIPO', '')).strip()
        local = str(row.get('Local', '')).strip()
        descricao_planilha = str(row.get('Descrição do Ocorrido', '')).strip()
        resumo_planilha = str(row.get('Resumo', '')).strip()
        data_str = row.get('Data ', row.get('Data', ''))

        macro_grupo = mapear_macro_grupo(macro_planilha)
        tipo_ocorrencia = mapear_tipo_ocorrencia(tipo_planilha)
        data_ocorrencia = parse_data(data_str)

        match = encontrar_colaborador(nome_planilha, colaboradores)

        colaborador_id = placeholder['id']
        colaborador_nome = nome_planilha
        empresa_id = placeholder.get('empresa_id')
        identificado = False

        if match:
            colaborador_id = match['colaborador']['id']
            colaborador_nome = match['colaborador']['nome_completo']
            empresa_id = match['colaborador'].get('empresa_id') or empresa_id
            identificado = True
            resumo['identificados'] += 1
            if match.get('todos') and len(match['todos']) > 1:
                resumo['multiplos'] += 1
                print(f'[MULTIPLO] Ocorrência {numero} - {nome_planilha} -> {match["colaborador"]["nome_completo"]} ({match["metodo"]})')
        else:
            resumo['nao_identificados'] += 1
            print(f'[NAO IDENTIFICADO] Ocorrência {numero} - {nome_planilha}')

        info = obter_gravidade_e_base_legal(macro_grupo, tipo_ocorrencia)

        titulo = f'[{numero}] {limpar_texto(resumo_planilha) or tipo_ocorrencia}'
        descricao = (
            f'Ocorrência nº {numero} registrada pela inspetoria.\n\n'
            f'Colaborador na planilha: {nome_planilha}\n\n'
            f'Descrição do ocorrido:\n{limpar_texto(descricao_planilha) or "Não informada."}'
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
            'defesa_funcionario': 'Não informada — importação da inspetoria.',
            'medida_corretiva': 'Não informada — importação da inspetoria.',
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

    if args.dry_run:
        print('\nDRY-RUN: não foi inserido nenhum registro.')
        print('Ocorrências preparadas:')
        for o in ocorrencias_para_inserir:
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
    for o in inseridos:
        print('  -', o['id'], o['titulo'], '|', o['colaborador_nome'], '|', o['status'])


if __name__ == '__main__':
    main()
