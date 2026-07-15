# -*- coding: utf-8 -*-
from spellchecker import SpellChecker
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

spell = SpellChecker(language='pt')

# Palavras extras comuns nas descrições de ocorrências
extras = [
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
]
for palavra in extras:
    spell.word_frequency.add(palavra)
    # Dá alta frequência para palavras extras prioritárias
    spell.word_frequency.dictionary[palavra] = 1000000

print('Palavras no dicionário:', len(spell.word_frequency.dictionary))


def corrigir_palavra(palavra, spellchecker):
    if not palavra or palavra.isdigit():
        return palavra
    if list(spellchecker.known([palavra.lower()])):
        return palavra
    correcao = spellchecker.correction(palavra.lower())
    if correcao:
        return correcao
    return palavra


def segmentar(texto, spellchecker, min_len=3):
    n = len(texto)
    if n == 0:
        return []
    dp = [None] * (n + 1)
    dp[0] = []
    for i in range(1, n + 1):
        for j in range(max(0, i - 22), i):
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
    # Preserva pontuação no final
    match = re.match(r'^(\w+)([^\w]*)$', token)
    if not match:
        return token
    palavra, pontuacao = match.groups()
    if len(palavra) <= 2:
        return token
    if list(spellchecker.known([palavra.lower()])):
        return token
    # Tenta correção primeiro
    corrigida = corrigir_palavra(palavra, spellchecker)
    if corrigida != palavra.lower():
        return corrigida + pontuacao
    # Tenta segmentar
    seg = segmentar(palavra, spellchecker)
    if len(seg) > 1:
        return ' '.join(seg) + pontuacao
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
