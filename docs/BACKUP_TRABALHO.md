# Como evitar perda de trabalho

> Guia para quem trabalha no projeto e tem problema de fechamento inesperado do VS Code.

## O que foi configurado no projeto

O arquivo `.vscode/settings.json` já ativa automaticamente:

- **Auto Save**: salva arquivos 2 segundos depois de parar de digitar.
- **Hot Exit**: restaura abas e edições não salvas ao reabrir o VS Code.
- **Desativa formatOnSave**: evita travamentos em PCs mais fracos.
- **Desativa autofetch do git**: evita requisições desnecessárias.

Não é preciso fazer nada — essas configurações valem automaticamente para quem abrir este projeto no VS Code.

## Hábito recomendado: commit frequente

Auto Save protege contra fechamento do editor, mas **o git é a proteção definitiva**.

Sempre que terminar uma parte do trabalho (ou a cada 20-30 minutos), faça um commit:

```bash
git add .
git commit -m "wip: descrição rápida do que estou fazendo"
```

`wip` significa *work in progress* (trabalho em andamento). Não tem problema commitar código incompleto — é só para não perder.

## Script de backup rápido

Para facilitar, criamos scripts que mostram o que vai ser commitado e pedem a mensagem:

### No Windows (Prompt de Comando/PowerShell)
```cmd
scripts\backup-rapido.bat
```

### No Git Bash
```bash
./scripts/backup-rapido.sh
```

## Dicas extras para PC fraco

1. **Feche abas que não está usando** no VS Code.
2. **Desative extensões que não usa**: `Ctrl+Shift+X` → clique com direito em extensões → **Disable**.
3. **Não deixe o navegador com muitas abas abertas** ao desenvolver.
4. **Reinicie o VS Code** de vez em quando para liberar memória.
5. Se possível, aumente a memória virtual (arquivo de paginação) do Windows.

## Recuperação

Se o VS Code fechar:
1. Reabra o projeto — o Auto Save e Hot Exit devem restaurar os arquivos.
2. Se algum arquivo sumir, verifique o histórico do git com `git reflog`.
3. Se precisar de ajuda, chame o assistente para verificar o estado do projeto.
