# -*- coding: utf-8 -*-
"""
Reassocia ocorrências do placeholder que têm match exato ou alto-token no cadastro.
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client
import sys

sys.stdout.reconfigure(encoding='utf-8')

load_dotenv(Path.cwd() / '.env')
URL = os.getenv('VITE_SUPABASE_URL')
KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
supabase = create_client(URL, KEY)

PLACEHOLDER_ID = 'af8cb17e-8065-445b-89e5-a29e9b7e822f'


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


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='Não salva no banco')
    args = parser.parse_args()

    print('=== Reassociação de Ocorrências do Placeholder ===')
    print('Modo:', 'DRY-RUN' if args.dry_run else 'REAL')
    print()

    # Buscar colaboradores
    print('Buscando colaboradores...')
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
    print(f'Total colaboradores: {len(colaboradores)}')

    # Buscar ocorrências do placeholder
    print('Buscando ocorrências do placeholder...')
    ocorrencias_placeholder = []
    pagina = 0
    while True:
        resp = supabase.table('ocorrencias').select('id, colaborador_nome, titulo, data_ocorrencia, descricao').eq('colaborador_id', PLACEHOLDER_ID).range(pagina * 1000, (pagina + 1) * 1000 - 1).execute()
        if not resp.data:
            break
        ocorrencias_placeholder.extend(resp.data)
        if len(resp.data) < 1000:
            break
        pagina += 1
    print(f'Total ocorrências no placeholder: {len(ocorrencias_placeholder)}')

    reassociacoes = []

    for occ in ocorrencias_placeholder:
        nome = str(occ.get('colaborador_nome') or '').strip().upper()
        n = norm(nome)
        tok = tokens(nome)

        # Exato
        matches_exatos = [c for c in colaboradores if norm(c['nome_completo']) == n]
        if matches_exatos:
            # Prioriza ativo, depois nome mais curto
            matches_exatos.sort(key=lambda c: (0 if c.get('status') == 'Ativo' else 1, len(tokens(c['nome_completo']))))
            escolhido = matches_exatos[0]
            reassociacoes.append({
                'ocorrencia_id': occ['id'],
                'nome_planilha': nome,
                'colaborador': escolhido,
                'metodo': 'exato',
            })
            continue

        # Alto-token
        matches_tokens = [c for c in colaboradores if tok and all(t in tokens(c['nome_completo']) for t in tok)]
        if matches_tokens:
            matches_tokens.sort(key=lambda c: (0 if c.get('status') == 'Ativo' else 1, len(tokens(c['nome_completo']))))
            escolhido = matches_tokens[0]
            reassociacoes.append({
                'ocorrencia_id': occ['id'],
                'nome_planilha': nome,
                'colaborador': escolhido,
                'metodo': 'alto-token',
            })

    print(f'\nOcorrências a reassociar: {len(reassociacoes)}')
    for r in reassociacoes:
        c = r['colaborador']
        print(f'  [{r["metodo"]}] {r["nome_planilha"]} -> {c["nome_completo"]} (mat={c["matricula"]}, status={c["status"]}, id={c["id"][:8]})')

    if args.dry_run:
        print('\nDRY-RUN: nenhuma alteração foi feita.')
        return

    if not reassociacoes:
        print('\nNenhuma reassociação a fazer.')
        return

    print('\nAplicando reassociações...')
    atualizados = 0
    for r in reassociacoes:
        c = r['colaborador']
        resp = supabase.table('ocorrencias').update({
            'colaborador_id': c['id'],
            'empresa_id': c.get('empresa_id'),
            'colaborador_nome': c['nome_completo'],
        }).eq('id', r['ocorrencia_id']).execute()
        if resp.data:
            atualizados += 1
        else:
            print(f'  ⚠️ Erro ao atualizar ocorrência {r["ocorrencia_id"]}')

    print(f'\nTotal de ocorrências reassociadas: {atualizados}')


if __name__ == '__main__':
    main()
