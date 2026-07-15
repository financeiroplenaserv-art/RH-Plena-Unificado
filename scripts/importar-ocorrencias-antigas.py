# -*- coding: utf-8 -*-
"""
Importa ocorrências antigas (advertências e suspensões) do programa anterior.
Associa colaboradores pelo nome completo. Cria placeholder para não identificados.
Corrige descrições com pyspellchecker e limpa nomes de locais.
"""
import os
import re
import unicodedata
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client
from spellchecker import SpellChecker
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
ARQUIVO = Path('public/Ocorrências de advertência e suspensão para CORH em sem cpf 15jul26.xlsx')
PLACEHOLDER_MATRICULA = '999999'
PLACEHOLDER_NOME = 'OCORRENCIAS HISTORICAS - NAO IDENTIFICADO'

# Palavras extras para o corretor ortográfico
EXTRAS = [
    'desídia', 'desídias',
    'registro', 'registrar', 'registrado', 'registrando', 'registradas', 'registros',
    'advertência', 'advertências', 'advertido', 'advertida', 'advertidos', 'advertidas',
    'condomínio', 'condomínios', 'condôminos',
    'horário', 'horários',
    'monitoramento',
    'justificativa', 'justificativas',
    'câmera', 'câmeras',
    'plantão', 'plantões',
    'cftv',
    'epi',
    'clt',
    'suspensão', 'suspensões', 'suspenso', 'suspensa', 'suspensos', 'suspensas',
    'síndico', 'síndicos',
    'comentários', 'comentário',
    'princípios', 'princípio',
    'cabíveis', 'cabível',
    'incompatível',
    'funções', 'função',
    'ocorrências', 'ocorrência',
    'trabalho', 'trabalhos',
    'empresa', 'empresas',
    'cliente', 'clientes',
    'excessivo', 'excessiva',
    'transtorno', 'transtornos',
    'reclamações', 'reclamação',
    'solicitou',
    'insatisfação',
    'alcoólica', 'alcoólico',
    'blazer', 'blazers',
    'transferido', 'transferida', 'transferidos', 'transferidas',
    'contato', 'contatos',
    'líder', 'líderes',
    'planilha', 'planilhas',
    'flagrado', 'flagrada',
    'chegar', 'chegado', 'chegando',
    'abaeté',
    'expediente',
    'também',
]

# Inicializa corretor ortográfico
spell = SpellChecker(language='pt')
for palavra in EXTRAS:
    spell.word_frequency.add(palavra)
    spell.word_frequency.dictionary[palavra] = 1000000


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


def levenshtein(a, b):
    m, n = len(a), len(b)
    if m == 0:
        return n
    if n == 0:
        return m
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            custo = 0 if a[i - 1] == b[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + custo)
    return dp[m][n]


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

    # 4. Levenshtein para nomes curtos
    if len(tok_planilha) <= 4:
        melhor = None
        melhor_score = 0
        for c in colaboradores:
            score = 1 - levenshtein(nome_norm, normalizar(c['nome_completo'])) / max(len(nome_norm), 1)
            if score > melhor_score:
                melhor_score = score
                melhor = c
        if melhor and melhor_score >= 0.85:
            return {'colaborador': melhor, 'metodo': 'levenshtein', 'score': melhor_score}

    return None


def corrigir_palavra(palavra):
    if not palavra or palavra.isdigit():
        return palavra
    if list(spell.known([palavra.lower()])):
        return palavra
    correcao = spell.correction(palavra.lower())
    if correcao:
        return correcao
    return palavra


def segmentar(texto, min_len=3):
    n = len(texto)
    if n == 0:
        return []
    dp = [None] * (n + 1)
    dp[0] = []
    for i in range(1, n + 1):
        for j in range(max(0, i - 22), i):
            if dp[j] is not None:
                trecho = texto[j:i]
                if len(trecho) >= min_len and list(spell.known([trecho.lower()])):
                    nova = dp[j] + [trecho]
                    if dp[i] is None or len(nova) < len(dp[i]):
                        dp[i] = nova
    return dp[n] if dp[n] else [texto]


def corrigir_token(token):
    if not token or token.isdigit():
        return token
    match = re.match(r'^(\w+)([^\w]*)$', token)
    if not match:
        return token
    palavra, pontuacao = match.groups()
    if len(palavra) <= 2:
        return token
    if list(spell.known([palavra.lower()])):
        return token
    # Correção primeiro
    corrigida = corrigir_palavra(palavra)
    if corrigida != palavra.lower():
        return corrigida + pontuacao
    # Segmentação depois
    seg = segmentar(palavra)
    if len(seg) > 1:
        return ' '.join(seg) + pontuacao
    return token


def corrigir_texto(texto):
    if not texto:
        return ''
    s = str(texto)
    # Adiciona espaço após pontuação seguida de letra
    s = re.sub(r'([a-zA-Z\u00C0-\u00FF])(\.|,|;|:|\?|!)([a-zA-Z\u00C0-\u00FF])', r'\1\2 \3', s)
    tokens = s.split()
    corrigidos = [corrigir_token(tok) for tok in tokens]
    resultado = ' '.join(corrigidos)
    resultado = re.sub(r'\s+', ' ', resultado).strip()
    if resultado:
        resultado = resultado[0].upper() + resultado[1:]
    return resultado


def limpar_local(local):
    if not local:
        return None
    blacklist = [
        'LIMPEZA', 'LIMPE', 'LIMP', 'ZA',
        'ENCARREGADO', 'ENCARREGADA', 'ENCARREG',
        'PORTARIA',
        'VIGIA', 'VIGIAS',
        'GUARDIAO', 'GUARDIOES', 'GUARDIÕES', 'GUARDIA',
        'JARDINAGEM',
        'INSALUBRIDADE', 'INSALUB', 'INSALUBR',
        'PERICULOSIDADE', 'PERICUL', 'PERIC',
        'DESAT',
        'AUX', 'MANUT', 'MANUTENCAO', 'MANUTENÇÃO',
        'ADMINISTRAT', 'ADMINISTRATIVO', 'ADMINSTRATIVO',
        'ESCRITORIO',
        'ASG',
        'COM', 'SEM',
        'PLENO', 'JR', 'JUNIOR', 'JÚNIOR',
        'ZELADOR',
        'I', 'II', 'III', 'IV', 'V',
        '1', '2', '3', '4', '5', '6', '12X36', '5X2', '6X1',
    ]
    stopwords_inicio_fim = ['DE', 'DO', 'DA', 'DOS', 'DAS', 'E']

    s = unicodedata.normalize('NFKD', str(local)).encode('ascii', 'ignore').decode('ascii')
    s = s.upper()
    s = re.sub(r'[\-/]', ' ', s)
    s = re.sub(r'[^A-Z0-9\s]', ' ', s)
    tokens = [t for t in s.split() if t]
    tokens_limpos = [t for t in tokens if t not in blacklist]

    while tokens_limpos and tokens_limpos[0] in stopwords_inicio_fim:
        tokens_limpos.pop(0)
    while tokens_limpos and tokens_limpos[-1] in stopwords_inicio_fim:
        tokens_limpos.pop()

    resultado = ' '.join(tokens_limpos).strip()
    return resultado if resultado else None


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


def mapear_tipo(tipo_planilha):
    mapa = {
        'Advertência Escrita': 'Advertência Escrita',
        'Advertência Verbal': 'Advertência Verbal',
        'Suspensão 1 (1ª ocorrência)': 'Suspensão 1 (1ª ocorrência)',
        'Suspensão 2 (reincidência)': 'Suspensão 2 (reincidência)',
        'Suspensão 3 (3ª ocorrência)': 'Suspensão 3 (3ª ocorrência)',
    }
    return mapa.get(str(tipo_planilha).strip(), 'Outros')


def obter_gravidade_e_base_legal(tipo_ocorrencia):
    mapa = {
        'Advertência Verbal': {'gravidade': 'Leve', 'base_legal': 'Art. 482, alínea "e" CLT — desídia. Primeira notificação.'},
        'Advertência Escrita': {'gravidade': 'Moderada', 'base_legal': 'Art. 482, alínea "e" CLT — desídia. Reincidência.'},
        'Suspensão 1 (1ª ocorrência)': {'gravidade': 'Grave', 'base_legal': 'Art. 474 CLT — suspensão por 1 a 30 dias.'},
        'Suspensão 2 (reincidência)': {'gravidade': 'Grave', 'base_legal': 'Art. 474 CLT — suspensão disciplinar. Segunda ocorrência.'},
        'Suspensão 3 (3ª ocorrência)': {'gravidade': 'Grave', 'base_legal': 'Art. 474 + Art. 482 CLT — terceira suspensão, configura justa causa.'},
    }
    return mapa.get(tipo_ocorrencia, {'gravidade': 'Moderada', 'base_legal': 'Não informado — importação histórica do sistema anterior.'})


def buscar_ou_criar_placeholder(empresa_id):
    resp = supabase.table('colaboradores').select('id').eq('matricula', PLACEHOLDER_MATRICULA).limit(1).execute()
    if resp.data:
        print('Placeholder já existe:', resp.data[0]['id'])
        return resp.data[0]['id']
    novo = supabase.table('colaboradores').insert({
        'nome_completo': PLACEHOLDER_NOME,
        'matricula': PLACEHOLDER_MATRICULA,
        'status': 'Inativo',
        'empresa_id': empresa_id,
        'dados_completos': {'origem': 'placeholder_importacao_ocorrencias'},
    }).execute()
    print('Placeholder criado:', novo.data[0]['id'])
    return novo.data[0]['id']


def buscar_usuario_admin():
    resp = supabase.table('perfis').select('id').eq('nivel_acesso', 'adm').limit(1).execute()
    if not resp.data:
        raise Exception('Não foi possível encontrar um usuário administrador.')
    return resp.data[0]['id']


def buscar_empresa_padrao():
    resp = supabase.table('empresas').select('id, nome').limit(1).execute()
    if not resp.data:
        raise Exception('Não foi possível encontrar uma empresa padrão.')
    return resp.data[0]


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--limite', type=int, help='Limite de ocorrências para teste')
    parser.add_argument('--dry-run', action='store_true', help='Não salva no banco')
    args = parser.parse_args()

    print('=== Importação de Ocorrências Antigas ===')
    print('Modo:', 'DRY-RUN' if args.dry_run else 'REAL')
    if args.limite:
        print(f'Limite: {args.limite} ocorrências')
    print()

    # Lê planilha
    df = pd.read_excel(ARQUIVO, dtype=str)
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

    empresa_padrao = buscar_empresa_padrao()
    print('Empresa padrão:', empresa_padrao['nome'], empresa_padrao['id'])

    placeholder_id = buscar_ou_criar_placeholder(empresa_padrao['id'])
    usuario_id = buscar_usuario_admin()
    print('Usuário admin:', usuario_id)

    df_importar = df.head(args.limite) if args.limite else df
    print('Ocorrências a importar:', len(df_importar))

    ocorrencias_para_inserir = []
    resumo = {'identificados': 0, 'nao_identificados': 0, 'multiplos': 0}

    for idx, row in df_importar.iterrows():
        numero = str(row.get('# da ocorrência', '')).strip()
        nome_planilha = str(row.get('Funcionário', '')).strip()
        macro = '2. Conduta e Disciplina'
        titulo_planilha = str(row.get('TÍTULO DA OCORRÊNCIA', '') or row.get('TÃTULO DA OCORRÃNCIA', '')).strip()
        tipo = mapear_tipo(row.get('TIPO', ''))
        data_ocorrido = parse_data(row.get('Data do Ocorrido', ''))
        data_registro = parse_data(row.get('Data do Registro', ''))
        local = str(row.get('Local', '')).strip()
        descricao_planilha = str(row.get('6. Descrição do Fato', '')).strip()

        match = encontrar_colaborador(nome_planilha, colaboradores)

        colaborador_id = placeholder_id
        colaborador_nome = nome_planilha
        empresa_id = empresa_padrao['id']
        identificado = False

        if match:
            colaborador_id = match['colaborador']['id']
            colaborador_nome = match['colaborador']['nome_completo']
            empresa_id = match['colaborador'].get('empresa_id') or empresa_padrao['id']
            identificado = True
            resumo['identificados'] += 1
            if match.get('todos') and len(match['todos']) > 1:
                resumo['multiplos'] += 1
                print(f'[MULTIPLO] Ocorrência {numero} - {nome_planilha} -> {match["colaborador"]["nome_completo"]} ({match["metodo"]})')
        else:
            resumo['nao_identificados'] += 1
            print(f'[NAO IDENTIFICADO] Ocorrência {numero} - {nome_planilha}')

        info = obter_gravidade_e_base_legal(tipo)

        titulo = f'[{numero}] {corrigir_texto(titulo_planilha) or tipo}'
        descricao = f'Ocorrência nº {numero} do sistema anterior.\n\nColaborador na planilha: {nome_planilha}\n\nDescrição do fato:\n{corrigir_texto(descricao_planilha) or "Não informada."}'
        local_limpo = limpar_local(local)

        ocorrencias_para_inserir.append({
            'colaborador_id': colaborador_id,
            'empresa_id': empresa_id,
            'colaborador_nome': colaborador_nome,
            'tipo_ocorrencia': tipo,
            'macro_grupo': macro,
            'titulo': titulo,
            'data_ocorrencia': data_registro or data_ocorrido,
            'descricao': descricao,
            'status': 'Ativa',
            'tipo_penalidade': tipo,
            'base_legal': info['base_legal'],
            'gravidade': info['gravidade'],
            'data_hora_ocorrido': data_ocorrido,
            'local_ocorrido': local_limpo,
            'defesa_funcionario': 'Não informada — importação histórica do sistema anterior.',
            'medida_corretiva': 'Não informada — importação histórica do sistema anterior.',
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
        print('Primeiras ocorrências preparadas:')
        for o in ocorrencias_para_inserir[:5]:
            print('  -', o['titulo'], '->', o['colaborador_nome'])
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
