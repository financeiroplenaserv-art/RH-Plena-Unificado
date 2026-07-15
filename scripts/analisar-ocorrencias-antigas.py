import os
import re
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path.cwd() / '.env')

url = os.getenv('VITE_SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')

if not url or not key:
    raise ValueError('Variáveis VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias')

supabase = create_client(url, key)


def normalizar(texto):
    return (
        str(texto or '')
        .encode('latin1', errors='ignore')
        .decode('utf-8', errors='ignore')
        .strip()
        .upper()
        .replace('Á', 'A')
        .replace('É', 'E')
        .replace('Í', 'I')
        .replace('Ó', 'O')
        .replace('Ú', 'U')
        .replace('Ã', 'A')
        .replace('Õ', 'O')
        .replace('Ç', 'C')
        .replace('Â', 'A')
        .replace('Ê', 'E')
        .replace('Ô', 'O')
        .replace('À', 'A')
    )


def parse_date(valor):
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


def main():
    print('=== Análise de Ocorrências Antigas ===\n')

    # 1. Lê planilha
    arquivo = Path('public/Ocorrências de advertência e suspensão para CORH em sem cpf 15jul26.xlsx')
    df = pd.read_excel(arquivo, dtype=str)
    df.columns = [normalizar(c) for c in df.columns]
    print('Colunas:', df.columns.tolist())
    print('Total de ocorrências na planilha:', len(df))

    # 2. Estatísticas básicas
    macros = df['MACRO'].dropna().astype(str).str.strip().unique().tolist()
    tipos = df['TIPO'].dropna().astype(str).str.strip().unique().tolist()
    nomes_unicos = df['FUNCIONARIO'].dropna().astype(str).str.strip().unique().tolist()

    print('Macro grupos:', macros)
    print('Tipos de ocorrência:', tipos)
    print('Funcionários únicos:', len(nomes_unicos))

    # 3. Valida datas
    df['DATA_OCORRIDO_PARSED'] = df['DATA DO OCORRIDO'].apply(parse_date)
    df['DATA_REGISTRO_PARSED'] = df['DATA DO REGISTRO'].apply(parse_date)
    datas_invalidas = df[(df['DATA_OCORRIDO_PARSED'].isna()) | (df['DATA_REGISTRO_PARSED'].isna())]
    print('Ocorrências com datas inválidas:', len(datas_invalidas))
    if len(datas_invalidas) > 0:
        print(datas_invalidas[['# DA OCORRENCIA', 'FUNCIONARIO', 'DATA DO OCORRIDO', 'DATA DO REGISTRO']].head().to_string(index=False))

    # 4. Busca colaboradores no banco
    print('\nBuscando colaboradores no banco...')
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

    print('Total de colaboradores no banco:', len(colaboradores))

    # 5. Faz matching por nome
    mapa_nomes = {}
    for c in colaboradores:
        nome_norm = normalizar(c['nome_completo'])
        mapa_nomes.setdefault(nome_norm, []).append(c)

    encontrados = 0
    nao_encontrados = 0
    ambiguos = 0
    nomes_nao_encontrados = []

    for nome in nomes_unicos:
        nome_norm = normalizar(nome)
        matches = mapa_nomes.get(nome_norm)
        if not matches:
            nao_encontrados += 1
            nomes_nao_encontrados.append(nome)
        elif len(matches) > 1:
            ambiguos += 1
            print(f'Nome ambíguo ({len(matches)} colaboradores): {nome}')
        else:
            encontrados += 1

    print('\n=== Resultado do Matching por Nome ===')
    print('Funcionários encontrados (único):', encontrados)
    print('Funcionários ambíguos:', ambiguos)
    print('Funcionários não encontrados:', nao_encontrados)

    if nomes_nao_encontrados:
        print('\nExemplos de nomes não encontrados:')
        for nome in nomes_nao_encontrados[:30]:
            print('  -', nome)

    # 6. Mapeamento de tipos
    print('\n=== Mapeamento de Tipos ===')
    tipos_sistema = [
        'Advertência Verbal',
        'Advertência Escrita',
        'Suspensão 1 (1ª ocorrência)',
        'Suspensão 2 (reincidência)',
        'Suspensão 3 (3ª ocorrência)',
    ]
    for tipo_planilha in tipos:
        match = next((t for t in tipos_sistema if normalizar(t) == normalizar(tipo_planilha)), None)
        print(f'  "{tipo_planilha}" -> {match or "NÃO ENCONTRADO"}')


if __name__ == '__main__':
    main()
