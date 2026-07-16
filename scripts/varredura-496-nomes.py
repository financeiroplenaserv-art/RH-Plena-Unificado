# -*- coding: utf-8 -*-
"""
Varredura dos 496 nomes não identificados da importação de 15/07/2026.
Busca correspondências no cadastro de colaboradores do CORH com várias estratégias.
"""
import os
import re
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
print(f'Total de ocorrências na planilha: {len(df)}')
print(f'Nomes únicos na planilha: {len(nomes_planilha)}')

print('\nBuscando todos os colaboradores no banco...')
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


resultados = {
    'exato': [],
    'tokens': [],
    'extremos': [],
    'substring': [],
    'similaridade': [],
    'nao_encontrado': [],
}

for nome in nomes_planilha:
    n = norm(nome)
    tok = tokens(nome)

    # 1. Exato
    exatos = [c for c in colaboradores if norm(c['nome_completo']) == n]
    if exatos:
        resultados['exato'].append({'nome_planilha': nome, 'matches': exatos})
        continue

    # 2. Todos os tokens do nome da planilha estão no nome do colaborador
    contem_todos = []
    for c in colaboradores:
        ct = tokens(c['nome_completo'])
        if all(t in ct for t in tok):
            contem_todos.append(c)
    if contem_todos:
        resultados['tokens'].append({'nome_planilha': nome, 'matches': contem_todos})
        continue

    # 3. Busca por primeiro e último nome
    partes = n.split()
    encontrado_extremos = False
    if len(partes) >= 2:
        primeiro = partes[0]
        ultimo = partes[-1]
        por_extremos = [c for c in colaboradores if norm(c['nome_completo']).startswith(primeiro + ' ') and norm(c['nome_completo']).endswith(' ' + ultimo)]
        if por_extremos:
            resultados['extremos'].append({'nome_planilha': nome, 'matches': por_extremos})
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
        resultados['substring'].append({'nome_planilha': nome, 'matches': por_substring[:5]})
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
        resultados['similaridade'].append({'nome_planilha': nome, 'matches': melhores[:5]})
        continue

    resultados['nao_encontrado'].append(nome)

# Estatísticas
print('\n=== ESTATÍSTICAS ===')
print(f'Exato: {len(resultados["exato"])}')
print(f'Tokens (todos os tokens do planilha no colaborador): {len(resultados["tokens"])}')
print(f'Primeiro + Último nome: {len(resultados["extremos"])}')
print(f'Substring (>=2 tokens em comum): {len(resultados["substring"])}')
print(f'Similaridade (>=60%): {len(resultados["similaridade"])}')
print(f'Não encontrado: {len(resultados["nao_encontrado"])}')

print('\n=== EXATOS ===')
for r in resultados['exato'][:10]:
    print(f'{r["nome_planilha"]}')
    for c in r['matches']:
        print(f'  -> {c["nome_completo"]} | status={c["status"]} | mat={c["matricula"]}')

print('\n=== TOKENS (primeiros 10) ===')
for r in resultados['tokens'][:10]:
    print(f'{r["nome_planilha"]}')
    for c in r['matches']:
        print(f'  -> {c["nome_completo"]} | status={c["status"]} | mat={c["matricula"]}')

print('\n=== PRIMEIRO + ULTIMO (primeiros 10) ===')
for r in resultados['extremos'][:10]:
    print(f'{r["nome_planilha"]}')
    for c in r['matches']:
        print(f'  -> {c["nome_completo"]} | status={c["status"]} | mat={c["matricula"]}')

print('\n=== SUBSTRING (primeiros 10 casos) ===')
for r in resultados['substring'][:10]:
    print(f'{r["nome_planilha"]}')
    for c, mt in r['matches']:
        print(f'  -> {c["nome_completo"]} | status={c["status"]} | mat={c["matricula"]} (tokens: {mt})')

print('\n=== SIMILARIDADE (primeiros 10 casos) ===')
for r in resultados['similaridade'][:10]:
    print(f'{r["nome_planilha"]}')
    for c, score in r['matches']:
        print(f'  -> {c["nome_completo"]} | status={c["status"]} | mat={c["matricula"]} (score: {score:.2f})')

print('\n=== NÃO ENCONTRADOS (primeiros 30) ===')
for nome in resultados['nao_encontrado'][:30]:
    print(f'  - {nome}')

# Salvar relatório completo
relatorio_path = Path('docs/agentes/relatorio_varredura_496_nomes.md')
with open(relatorio_path, 'w', encoding='utf-8') as f:
    f.write('# Relatório de Varredura — 496 Nomes Não Identificados (15/07/2026)\n\n')
    f.write(f'**Arquivo fonte:** `{arquivo}`\n\n')
    f.write(f'**Total de nomes únicos analisados:** {len(nomes_planilha)}\n\n')
    f.write(f'**Total de colaboradores no banco:** {len(colaboradores)}\n\n')
    f.write('## Estatísticas\n\n')
    f.write(f'- Exato: {len(resultados["exato"])}\n')
    f.write(f'- Tokens (todos os tokens do planilha no colaborador): {len(resultados["tokens"])}\n')
    f.write(f'- Primeiro + Último nome: {len(resultados["extremos"])}\n')
    f.write(f'- Substring (>=2 tokens em comum): {len(resultados["substring"])}\n')
    f.write(f'- Similaridade (>=60%): {len(resultados["similaridade"])}\n')
    f.write(f'- Não encontrado: {len(resultados["nao_encontrado"])}\n\n')

    f.write('## Matches Exatos\n\n')
    for r in resultados['exato']:
        f.write(f'**{r["nome_planilha"]}**\n')
        for c in r['matches']:
            f.write(f'- {c["nome_completo"]} | status={c["status"]} | mat={c["matricula"]}\n')
        f.write('\n')

    f.write('## Matches por Tokens\n\n')
    for r in resultados['tokens']:
        f.write(f'**{r["nome_planilha"]}**\n')
        for c in r['matches']:
            f.write(f'- {c["nome_completo"]} | status={c["status"]} | mat={c["matricula"]}\n')
        f.write('\n')

    f.write('## Matches por Primeiro + Último Nome\n\n')
    for r in resultados['extremos']:
        f.write(f'**{r["nome_planilha"]}**\n')
        for c in r['matches']:
            f.write(f'- {c["nome_completo"]} | status={c["status"]} | mat={c["matricula"]}\n')
        f.write('\n')

    f.write('## Matches por Substring (>=2 tokens em comum)\n\n')
    for r in resultados['substring']:
        f.write(f'**{r["nome_planilha"]}**\n')
        for c, mt in r['matches']:
            f.write(f'- {c["nome_completo"]} | status={c["status"]} | mat={c["matricula"]} (tokens: {mt})\n')
        f.write('\n')

    f.write('## Matches por Similaridade (>=60%)\n\n')
    for r in resultados['similaridade']:
        f.write(f'**{r["nome_planilha"]}**\n')
        for c, score in r['matches']:
            f.write(f'- {c["nome_completo"]} | status={c["status"]} | mat={c["matricula"]} (score: {score:.2f})\n')
        f.write('\n')

    f.write('## Não Encontrados\n\n')
    for nome in resultados['nao_encontrado']:
        f.write(f'- {nome}\n')

print(f'\nRelatório completo salvo em: {relatorio_path}')
