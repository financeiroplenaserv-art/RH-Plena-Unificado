# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys

# Garante stdout UTF-8
sys.stdout.reconfigure(encoding='utf-8')

# Carrega palavras do dicionário
dic_path = Path('scripts/frequency_dictionary_pt_BR.txt')
palavras = set()
with dic_path.open('r', encoding='utf-8') as f:
    for linha in f:
        partes = linha.strip().split()
        if partes:
            palavras.add(partes[0].lower())
print('Palavras carregadas:', len(palavras))

# Verifica palavras acentuadas
for p in ['insubordinação', 'advertido', 'faltado', 'desídia', 'com', 'trabalho']:
    print(p, p in palavras)


def segmentar(texto, palavras_set, min_len=2):
    n = len(texto)
    if n == 0:
        return []
    dp = [None] * (n + 1)
    dp[0] = []
    for i in range(1, n + 1):
        for j in range(max(0, i - 25), i):
            if dp[j] is not None:
                trecho = texto[j:i]
                trecho_lower = trecho.lower()
                if trecho_lower in palavras_set and len(trecho) >= min_len:
                    nova = dp[j] + [trecho]
                    if dp[i] is None or len(nova) < len(dp[i]):
                        dp[i] = nova
    return dp[n] if dp[n] else [texto]


def corrigir_token(token, palavras_set):
    if not token or token.isdigit():
        return token
    # Preserva pontuação no final
    match = re.match(r'^(\w+)([^\w]*)$', token)
    if not match:
        return token
    palavra, pontuacao = match.groups()
    if palavra.lower() in palavras_set:
        return token
    # Tenta segmentar
    seg = segmentar(palavra, palavras_set)
    if len(seg) > 1:
        return ' '.join(seg) + pontuacao
    # Tenta correção com distância 1 (somente se palavra tiver 4+ letras)
    if len(palavra) >= 4:
        candidatos = []
        palavra_lower = palavra.lower()
        for p in palavras_set:
            if abs(len(p) - len(palavra)) <= 1 and len(p) >= 4:
                dist = sum(1 for a, b in zip(p, palavra_lower) if a != b) + abs(len(p) - len(palavra_lower))
                if dist == 1:
                    candidatos.append(p)
        if len(candidatos) == 1:
            return candidatos[0] + pontuacao
    return token


def corrigir_texto(texto):
    if not texto:
        return ''
    tokens = texto.split()
    corrigidos = []
    for tok in tokens:
        corrigidos.append(corrigir_token(tok, palavras))
    return ' '.join(corrigidos)


testes = [
    'Advertido por insubordinaçãocom seu Encarregado',
    'Por ter faltado ao serviço no dia 20/06/2026 sem justificativas.',
    'Por desidea no desempenho das funções. Colaborador dormindo em horario de trabalho conforme registro da central de monitoramento.',
    'Por ter se recusado a cumprir as ordens de seu superior hierárquico',
]
for t in testes:
    print('ORIGINAL:', t)
    print('CORRIGIDO:', corrigir_texto(t))
    print()
