#!/usr/bin/env python3
"""
Validador de RLS para o projeto RH Plena Unificado.

Analisa as migrations em supabase/migrations/ e simula o estado final das
policies RLS para detectar policies conflitantes ou SELECT abertos
(USING (true)) em tabelas sensiveis.

Uso:
    python scripts/validar_rls.py

O script sai com codigo 0 se nenhum problema for encontrado, ou 1 caso
contrario.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Set, Tuple


MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "supabase" / "migrations"

TABELAS_SENSIVEIS: Set[str] = {
    "perfis",
    "configuracoes",
    "auditoria",
    "log_auditoria",
    "colaboradores",
    "ocorrencias",
    "ocorrencia_anexos",
    "ocorrencia_testemunhas",
    "ocorrencia_aprovacoes",
    "ocorrencia_defesas",
    "recibos_extras",
    "projetos_vr",
    "resultados_vr",
    "contratos_adicionais",
    "vinculos_adicionais",
    "calendario_adicionais",
    "empresas",
    "departamentos",
    "historico_importacoes_econtador",
}

# Tabelas onde SELECT aberto (USING true) e uma decisao de negocio aceita.
# Vazio desde a migration 063/064: empresas e departamentos passaram a ser
# restritas por perfil (pode_ver_empresas/pode_ver_departamentos).
TABELAS_SELECT_ABERTO_PERMITIDO: Set[str] = set()


@dataclass
class Policy:
    nome: str
    tabela: str
    comando: str
    usando: str = ""
    with_check: str = ""
    migration: str = ""


@dataclass
class EstadoRLS:
    policies: Dict[Tuple[str, str], Policy] = field(default_factory=dict)

    def criar(self, policy: Policy) -> None:
        self.policies[(policy.tabela, policy.nome)] = policy

    def remover(self, tabela: str, nome: str) -> None:
        self.policies.pop((tabela, nome), None)

    def policies_por_tabela(self, tabela: str) -> List[Policy]:
        return [p for (t, _), p in self.policies.items() if t == tabela]


def normalizar_expression(expr: str) -> str:
    expr = re.sub(r"--[^\n]*", "", expr)
    expr = re.sub(r"/\*.*?\*/", "", expr, flags=re.DOTALL)
    expr = " ".join(expr.split())
    return expr.strip()


def extrair_parenteses_balanceados(s: str, start: int) -> str:
    if start >= len(s) or s[start] != "(":
        return ""
    profundidade = 1
    i = start + 1
    while i < len(s) and profundidade > 0:
        if s[i] == "(":
            profundidade += 1
        elif s[i] == ")":
            profundidade -= 1
        i += 1
    return s[start + 1 : i - 1]


def extrair_argumentos_format(args_str: str) -> List[str]:
    args: List[str] = []
    profundidade = 0
    atual = ""
    in_string = False
    string_char = ""

    for char in args_str:
        if char in ("'", '"'):
            if not in_string:
                in_string = True
                string_char = char
            elif char == string_char:
                if len(atual) > 0 and atual[-1] == string_char:
                    pass
                else:
                    in_string = False
                    string_char = ""
            atual += char
            continue

        if in_string:
            atual += char
            continue

        if char == "(":
            profundidade += 1
            atual += char
        elif char == ")":
            if profundidade == 0:
                if atual.strip():
                    args.append(atual.strip())
                break
            profundidade -= 1
            atual += char
        elif char == "," and profundidade == 0:
            if atual.strip():
                args.append(atual.strip())
            atual = ""
        else:
            atual += char

    if atual.strip():
        args.append(atual.strip())

    for i, arg in enumerate(args):
        # Remove aspas externas de literais string
        if (arg.startswith("'") and arg.endswith("'")) or (arg.startswith('"') and arg.endswith('"')):
            args[i] = arg[1:-1]

    return args


def expandir_format(template: str, args: List[str]) -> str:
    """Substitui placeholders %I, %s, %L pelos argumentos correspondentes."""
    result = template
    for arg in args:
        if not arg:
            continue
        placeholder = re.search(r"%[IsL]", result)
        if not placeholder:
            break
        ph = placeholder.group(0)
        if ph == "%I":
            val = arg.replace("public.", "").strip()
            val = val.strip('"')
            result = result.replace(ph, f'"{val}"', 1)
        elif ph == "%L":
            result = result.replace(ph, arg, 1)
        else:
            result = result.replace(ph, arg, 1)
    return result


def extrair_blocos_execute_format(sql: str) -> List[str]:
    resultados: List[str] = []
    pattern = re.compile(r"EXECUTE\s+format\s*\(", re.IGNORECASE)

    for m in pattern.finditer(sql):
        start = m.end()
        profundidade = 1
        in_string = False
        string_char = ""
        i = start

        while i < len(sql) and profundidade > 0:
            char = sql[i]
            if char in ("'", '"'):
                if not in_string:
                    in_string = True
                    string_char = char
                elif char == string_char:
                    if i + 1 < len(sql) and sql[i + 1] == string_char:
                        i += 1
                    else:
                        in_string = False
                        string_char = ""
            elif not in_string:
                if char == "(":
                    profundidade += 1
                elif char == ")":
                    profundidade -= 1
            i += 1

        if profundidade != 0:
            continue

        args_str = sql[start : i - 1]
        regex_template = re.compile(r"'((?:[^']|'')*)'")
        tm = regex_template.search(args_str)
        if not tm:
            continue
        template = tm.group(1).replace("''", "'")
        restante = args_str[tm.end() :]
        args = extrair_argumentos_format(restante)
        args = [a for a in args if a]
        expanded = expandir_format(template, args)
        resultados.append(expanded)

    return resultados


def parse_create_policy(sql: str, migration: str) -> List[Policy]:
    policies: List[Policy] = []

    regex_create = re.compile(r"CREATE\s+POLICY\s+", re.IGNORECASE)
    for m in regex_create.finditer(sql):
        resto = sql[m.end() :]

        nm = re.match(r'(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))\s*', resto)
        if not nm:
            continue
        nome = nm.group(1) if nm.group(1) else nm.group(2)
        resto = resto[nm.end() :]

        tm = re.search(r"ON\s+(?:public\.)?(?:\s*)?(?:\"([^\"]+)\"|([a-zA-Z_][a-zA-Z0-9_]*))\s*", resto, re.IGNORECASE)
        if not tm:
            continue
        tabela = tm.group(1) if tm.group(1) else tm.group(2)
        resto = resto[tm.end() :]

        fm = re.search(r"FOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\s*", resto, re.IGNORECASE)
        comando = fm.group(1).upper() if fm else "ALL"
        if fm:
            resto = resto[fm.end() :]

        usando = ""
        um = re.search(r"USING\s*\(", resto, re.IGNORECASE)
        if um:
            pos = um.end() - 1
            usando = normalizar_expression(extrair_parenteses_balanceados(resto, pos))

        with_check = ""
        wm = re.search(r"WITH\s+CHECK\s*\(", resto, re.IGNORECASE)
        if wm:
            pos = wm.end() - 1
            with_check = normalizar_expression(extrair_parenteses_balanceados(resto, pos))

        policies.append(
            Policy(
                nome=nome,
                tabela=tabela,
                comando=comando,
                usando=usando,
                with_check=with_check,
                migration=migration,
            )
        )

    for bloco in extrair_blocos_execute_format(sql):
        policies.extend(parse_create_policy(bloco, migration))

    return policies


def parse_drop_policy(sql: str, migration: str) -> List[Tuple[str, str]]:
    removidas: List[Tuple[str, str]] = []
    pattern = re.compile(
        r"DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?['\"]?([^'\"]+)['\"]?\s+"
        r"ON\s+(?:public\.)?['\"]?([^'\"\s;]+)['\"]?;?",
        re.IGNORECASE,
    )
    for m in pattern.finditer(sql):
        removidas.append((m.group(2).strip(), m.group(1).strip()))

    for bloco in extrair_blocos_execute_format(sql):
        for m in pattern.finditer(bloco):
            removidas.append((m.group(2).strip(), m.group(1).strip()))

    return removidas


# ============================================================================
# Expansao de funcoes PL/pgSQL que aplicam RLS
# ============================================================================


def extrair_funcoes_plpgsql(sql: str) -> Dict[str, str]:
    """Extrai funcoes PL/pgSQL que contem 'rls' no nome e retorna corpo."""
    funcoes: Dict[str, str] = {}
    pattern = re.compile(
        r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.(aplicar_rls_[a-zA-Z0-9_]+)\s*\([^)]*\)\s*"
        r"RETURNS\s+[^\$]+AS\s*\$\$",
        re.IGNORECASE | re.DOTALL,
    )

    for m in pattern.finditer(sql):
        nome_func = m.group(1)
        start = m.end()
        # Encontra o fechamento $$ correspondente
        end_marker = "$$"
        pos = sql.find(end_marker, start)
        if pos == -1:
            continue
        corpo = sql[start:pos]
        funcoes[nome_func] = corpo

    return funcoes


def expandir_chamadas_funcoes(sql: str, funcoes: Dict[str, str]) -> str:
    """Expande chamadas SELECT public.aplicar_rls_*('tabela') em SQL concreto."""
    expanded_sql = sql

    # Chamadas simples: SELECT public.aplicar_rls_xxx('tabela');
    pattern_simples = re.compile(
        r"SELECT\s+public\.(aplicar_rls_[a-zA-Z0-9_]+)\s*\(\s*'([^']+)'\s*\)\s*;",
        re.IGNORECASE,
    )
    for m in pattern_simples.finditer(sql):
        func_name = m.group(1)
        tabela = m.group(2)
        if func_name in funcoes:
            corpo = funcoes[func_name]
            # Substitui parametro p_tabela e variavel v_tabela pela tabela
            corpo_exp = corpo.replace("p_tabela", f"'{tabela}'")
            corpo_exp = re.sub(r"\bv_tabela\b", f"'{tabela}'", corpo_exp)
            expanded_sql += "\n" + corpo_exp + "\n"

    # Chamadas em loop: FOREACH v_tabela IN ARRAY ... SELECT public.aplicar_rls_xxx(v_tabela)
    # Simplificacao: procura arrays literais nas proximidades
    pattern_foreach = re.compile(
        r"FOREACH\s+v_tabela\s+IN\s+ARRAY\s*(?:\$?\w+\$)?\s*\[\s*([^\]]+)\s*\]\s*\$?\w+\$?\s*LOOP\s*"
        r"SELECT\s+public\.(aplicar_rls_[a-zA-Z0-9_]+)\s*\(\s*v_tabela\s*\)\s*;\s*END\s+LOOP",
        re.IGNORECASE | re.DOTALL,
    )
    for m in pattern_foreach.finditer(sql):
        func_name = m.group(2)
        array_str = m.group(1)
        tabelas = [t.strip().strip("'") for t in array_str.split(",")]
        if func_name in funcoes:
            for tabela in tabelas:
                corpo = funcoes[func_name]
                corpo_exp = corpo.replace("p_tabela", f"'{tabela}'")
                corpo_exp = re.sub(r"\bv_tabela\b", f"'{tabela}'", corpo_exp)
                expanded_sql += "\n" + corpo_exp + "\n"

    return expanded_sql


def simular_estado_final() -> EstadoRLS:
    estado = EstadoRLS()

    if not MIGRATIONS_DIR.exists():
        print(f"Erro: diretorio de migrations nao encontrado: {MIGRATIONS_DIR}")
        sys.exit(1)

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not migration_files:
        print(f"Nenhuma migration encontrada em {MIGRATIONS_DIR}")
        sys.exit(1)

    # Primeira passagem: coleta todas as funcoes RLS de todas as migrations
    todas_funcoes: Dict[str, str] = {}
    for path in migration_files:
        sql = path.read_text(encoding="utf-8")
        funcoes = extrair_funcoes_plpgsql(sql)
        # Atualiza com as funcoes mais recentes (sobrescreve)
        todas_funcoes.update(funcoes)

    # Segunda passagem: processa migrations em ordem, expandindo chamadas
    for path in migration_files:
        sql = path.read_text(encoding="utf-8")
        migration_name = path.name

        # Coleta funcoes desta migration para uso na expansao
        funcoes_atuais = extrair_funcoes_plpgsql(sql)
        todas_funcoes.update(funcoes_atuais)

        # Expande chamadas de funcoes
        sql_expandido = expandir_chamadas_funcoes(sql, todas_funcoes)

        # Processa SQL direto
        for tabela, nome in parse_drop_policy(sql, migration_name):
            estado.remover(tabela, nome)
        for policy in parse_create_policy(sql, migration_name):
            estado.criar(policy)

        # Processa SQL expandido (funcoes)
        for tabela, nome in parse_drop_policy(sql_expandido, migration_name):
            estado.remover(tabela, nome)
        for policy in parse_create_policy(sql_expandido, migration_name):
            estado.criar(policy)

    return estado


def validar(estado: EstadoRLS) -> List[str]:
    problemas: List[str] = []

    for tabela in sorted(TABELAS_SENSIVEIS):
        policies = estado.policies_por_tabela(tabela)
        selects = [p for p in policies if p.comando in ("SELECT", "ALL")]

        if not policies:
            problemas.append(
                f"[ALERTA] Tabela sensivel '{tabela}' nao tem nenhuma policy no estado final. "
                f"Verifique se RLS esta habilitado."
            )
            continue

        if not selects:
            problemas.append(
                f"[ALERTA] Tabela sensivel '{tabela}' nao tem policy de SELECT. "
                f"Isso pode bloquear leitura legitima."
            )
            continue

        for p in selects:
            if p.usando == "true":
                problemas.append(
                    f"[CRITICO] Tabela sensivel '{tabela}' tem policy SELECT aberto "
                    f"(USING (true)): '{p.nome}' (migration: {p.migration})"
                )

        if len(selects) > 1:
            problemas.append(
                f"[CRITICO] Tabela sensivel '{tabela}' tem {len(selects)} policies de SELECT. "
                f"O PostgreSQL avalia com OR, o que pode anular protecao. "
                f"Policies: {[p.nome for p in selects]}"
            )

    for tabela in sorted(TABELAS_SELECT_ABERTO_PERMITIDO):
        policies = estado.policies_por_tabela(tabela)
        selects = [p for p in policies if p.comando in ("SELECT", "ALL")]
        abertas = [p for p in selects if p.usando == "true"]
        if selects and not abertas:
            problemas.append(
                f"[INFO] Tabela '{tabela}' tem SELECT restrito, mas por decisao de negocio "
                f"esperava-se SELECT aberto. Revisar se a intencao mudou."
            )

    return problemas


def main() -> int:
    print("=" * 60)
    print("Validador de RLS - RH Plena Unificado")
    print("=" * 60)
    print(f"Migrations analisadas: {MIGRATIONS_DIR}")
    print()

    estado = simular_estado_final()
    problemas = validar(estado)

    total_policies = len(estado.policies)
    print(f"Total de policies no estado final: {total_policies}")
    print(f"Tabelas sensiveis verificadas: {len(TABELAS_SENSIVEIS)}")
    print()

    if not problemas:
        print("OK - Nenhum problema critico de RLS encontrado.")
        return 0

    print(f"ATENCAO: {len(problemas)} problema(s) encontrado(s):\n")
    for i, problema in enumerate(problemas, 1):
        print(f"{i}. {problema}")
    print()
    print(
        "Recomendacao: revise as migrations indicadas e garanta que tabelas "
        "sensiveis nao tenham policies SELECT abertas ou multiplas policies "
        "permissivas conflitantes."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
