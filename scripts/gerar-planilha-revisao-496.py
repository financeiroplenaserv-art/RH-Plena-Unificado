# -*- coding: utf-8 -*-
"""
Gera planilha de revisão dos 496 nomes não identificados.
Planilha com matches sugeridos organizados por nível de confiança.
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client
import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

load_dotenv(Path.cwd() / '.env')
URL = os.getenv('VITE_SUPABASE_URL')
KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
supabase = create_client(URL, KEY)

arquivo = 'public/Ocorrências de advertência e suspensão para CORH em sem cpf 15jul26.xlsx'
df = pd.read_excel(arquivo, dtype=str)
df.columns = [str(c).strip() for c in df.columns]
nomes_planilha = sorted(set(str(n).strip().upper() for n in df['Funcionário'].dropna() if str(n).strip()))
print(f'Total de nomes únicos na planilha: {len(nomes_planilha)}')

print('Buscando todos os colaboradores no banco...')
colaboradores = []
pagina = 0
while True:
    resp = supabase.table('colaboradores').select('id, matricula, nome_completo, empresa_id, status, cpf').range(pagina * 1000, (pagina + 1) * 1000 - 1).execute()
    if not resp.data:
        break
    colaboradores.extend(resp.data)
    if len(resp.data) < 1000:
        break
    pagina += 1
print(f'Total de colaboradores no banco: {len(colaboradores)}')


def norm(s):
    return (
        str(s or '').strip().upper()
        .replace('Á', 'A').replace('É', 'E').replace('Í', 'I')
        .replace('Ó', 'O').replace('Ú', 'U').replace('Ã', 'A')
        .replace('Õ', 'O').replace('Ç', 'C').replace('Â', 'A')
        .replace('Ê', 'E').replace('Ô', 'O').replace('À', 'A')
        .replace('Ü', 'U')
    )


def tokens(texto):
    return [t for t in norm(texto).split() if len(t) > 2]


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


registros = []

for nome in nomes_planilha:
    n = norm(nome)
    tok = tokens(nome)

    # 1. Exato
    exatos = [c for c in colaboradores if norm(c['nome_completo']) == n]
    if exatos:
        for c in exatos:
            registros.append({
                'nome_planilha': nome,
                'match_sugerido': c['nome_completo'],
                'colaborador_id': c['id'],
                'matricula': c['matricula'],
                'status': c['status'],
                'cpf': c.get('cpf'),
                'nivel_confianca': 'Exato',
                'tokens_comum': len(tok),
                'score_similaridade': 1.0,
                'acao': 'Já identificado',
                'observacao': '',
            })
        continue

    # 2. Todos os tokens do nome da planilha estão no nome do colaborador
    contem_todos = []
    for c in colaboradores:
        ct = tokens(c['nome_completo'])
        if all(t in ct for t in tok):
            contem_todos.append(c)
    if contem_todos:
        for c in contem_todos:
            registros.append({
                'nome_planilha': nome,
                'match_sugerido': c['nome_completo'],
                'colaborador_id': c['id'],
                'matricula': c['matricula'],
                'status': c['status'],
                'cpf': c.get('cpf'),
                'nivel_confianca': 'Alto - Tokens',
                'tokens_comum': len(tok),
                'score_similaridade': '',
                'acao': '',
                'observacao': '',
            })
        continue

    # 3. Busca por primeiro e último nome
    partes = n.split()
    encontrado_extremos = False
    if len(partes) >= 2:
        primeiro = partes[0]
        ultimo = partes[-1]
        por_extremos = [c for c in colaboradores if norm(c['nome_completo']).startswith(primeiro + ' ') and norm(c['nome_completo']).endswith(' ' + ultimo)]
        if por_extremos:
            for c in por_extremos:
                registros.append({
                    'nome_planilha': nome,
                    'match_sugerido': c['nome_completo'],
                    'colaborador_id': c['id'],
                    'matricula': c['matricula'],
                    'status': c['status'],
                    'cpf': c.get('cpf'),
                    'nivel_confianca': 'Alto - Primeiro+Ultimo',
                    'tokens_comum': len(tok),
                    'score_similaridade': '',
                    'acao': '',
                    'observacao': '',
                })
            encontrado_extremos = True
    if encontrado_extremos:
        continue

    # 4. Busca por substring (pelo menos 2 tokens grandes do nome estiverem contidos no colaborador)
    por_substring = []
    for c in colaboradores:
        nc = norm(c['nome_completo'])
        matches_tokens = sum(1 for t in tok if t in nc)
        if matches_tokens >= 2:
            por_substring.append((c, matches_tokens))
    if por_substring:
        por_substring.sort(key=lambda x: (-x[1], x[0]['nome_completo']))
        for c, mt in por_substring[:5]:
            registros.append({
                'nome_planilha': nome,
                'match_sugerido': c['nome_completo'],
                'colaborador_id': c['id'],
                'matricula': c['matricula'],
                'status': c['status'],
                'cpf': c.get('cpf'),
                'nivel_confianca': 'Médio - Substring',
                'tokens_comum': mt,
                'score_similaridade': '',
                'acao': '',
                'observacao': '',
            })
        continue

    # 5. Levenshtein com threshold 0.6
    melhores = []
    for c in colaboradores:
        nc = norm(c['nome_completo'])
        max_len = max(len(n), len(nc))
        score = 1 - levenshtein(n, nc) / max_len if max_len > 0 else 0
        if score >= 0.6:
            melhores.append((c, score))
    if melhores:
        melhores.sort(key=lambda x: -x[1])
        for c, score in melhores[:5]:
            registros.append({
                'nome_planilha': nome,
                'match_sugerido': c['nome_completo'],
                'colaborador_id': c['id'],
                'matricula': c['matricula'],
                'status': c['status'],
                'cpf': c.get('cpf'),
                'nivel_confianca': 'Médio - Similaridade',
                'tokens_comum': '',
                'score_similaridade': round(score, 2),
                'acao': '',
                'observacao': '',
            })
        continue

    # Não encontrado
    registros.append({
        'nome_planilha': nome,
        'match_sugerido': '',
        'colaborador_id': '',
        'matricula': '',
        'status': '',
        'cpf': '',
        'nivel_confianca': 'Não encontrado',
        'tokens_comum': '',
        'score_similaridade': '',
        'acao': '',
        'observacao': '',
    })

# Criar DataFrame
planilha = pd.DataFrame(registros)

# Ordem de confiança para ordenação
ordem_confianca = {
    'Exato': 1,
    'Alto - Tokens': 2,
    'Alto - Primeiro+Ultimo': 3,
    'Médio - Substring': 4,
    'Médio - Similaridade': 5,
    'Não encontrado': 6,
}
planilha['ordem_confianca'] = planilha['nivel_confianca'].map(ordem_confianca)
planilha = planilha.sort_values(['ordem_confianca', 'nome_planilha', 'score_similaridade'], ascending=[True, True, False])
planilha = planilha.drop(columns=['ordem_confianca'])

# Salvar Excel
saida = Path('dados-locais/revisao_496_nomes.xlsx')
with pd.ExcelWriter(saida, engine='openpyxl') as writer:
    planilha.to_excel(writer, sheet_name='Revisao', index=False)

print(f'\nPlanilha de revisão gerada: {saida}')
print(f'Total de linhas: {len(planilha)}')
print('\nDistribuição por nível de confiança:')
print(planilha['nivel_confianca'].value_counts())
