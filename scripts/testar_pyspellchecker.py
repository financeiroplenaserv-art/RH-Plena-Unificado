# -*- coding: utf-8 -*-
from spellchecker import SpellChecker
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

spell = SpellChecker(language='pt')
print('Palavras no dicionário pt:', len(spell.word_frequency.dictionary))

# Verifica palavras
for p in ['insubordinação', 'advertido', 'faltado', 'desídia', 'com', 'trabalho', 'serviço']:
    print(p, '->', spell.known([p]))

def corrigir_palavra(palavra, spellchecker):
    if not palavra or palavra.isdigit():
        return palavra
    if list(spellchecker.known([palavra.lower()])):
        return palavra
    candidatos = spellchecker.candidates(palavra.lower())
    if candidatos:
        return list(candidatos)[0]
    return palavra

def segmentar(texto, spellchecker, min_len=2):
    """Tenta segmentar uma string sem espaços em palavras do dicionário."""
    n = len(texto)
    if n == 0:
        return []
    dp = [None] * (n + 1)
    dp[0] = []
    for i in range(1, n + 1):
        for j in range(max(0, i - 20), i):
            if dp[j] is not None:
                trecho = texto[j:i]
                if len(trecho) >= min_len and list(spellchecker.known([trecho.lower()])):
                    nova = dp[j] + [trecho]
                    if dp[i] is None or len(nova) < len(dp[i]):
                        dp[i] = nova
    return dp[n] if dp[n] else [texto]

def corrigir_token(token, spellchecker):
    if not token or token.isdigit():
        return token
    # Preserva pontuação
    match = re.match(r'^(\w+)([^\w]*)$', token)
    if not match:
        return token
    palavra, pontuacao = match.groups()
    if list(spellchecker.known([palavra.lower()])):
        return token
    # Tenta segmentar
    seg = segmentar(palavra, spellchecker)
    if len(seg) > 1:
        return ' '.join(seg) + pontuacao
    # Tenta correção
    corrigida = corrigir_palavra(palavra, spellchecker)
    if corrigida != palavra.lower():
        return corrigida + pontuacao
    return token

def corrigir_texto(texto, spellchecker):
    if not texto:
        return ''
    tokens = texto.split()
    return ' '.join(corrigir_token(tok, spellchecker) for tok in tokens)

testes = [
    'Advertido por insubordinaçãocom seu Encarregado',
    'Por ter faltado ao serviço no dia 20/06/2026 sem justificativas.',
    'Por desidea no desempenho das funções. Colaborador dormindo em horario de trabalho conforme registro da central de monitoramento.',
    'Por ter se recusado a cumprir as ordens de seu superior hierárquico',
]
for t in testes:
    print('ORIGINAL:', t)
    print('CORRIGIDO:', corrigir_texto(t, spell))
    print()
