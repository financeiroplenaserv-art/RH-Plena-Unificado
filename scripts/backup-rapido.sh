#!/bin/bash
# Backup rápido do trabalho não commitado
# Uso: ./scripts/backup-rapido.sh

cd "$(dirname "$0")/.." || exit 1

echo "=========================================="
echo " Backup rápido do trabalho não commitado"
echo "=========================================="
echo ""

git add .
git diff --cached --stat

echo ""
echo "Para confirmar o commit, digite uma mensagem e pressione Enter."
echo "Para cancelar, pressione Ctrl+C."
echo ""

read -r -p "Mensagem do commit: " MENSAGEM

if [ -z "$MENSAGEM" ]; then
  echo "⚠️ Mensagem vazia. Cancelado."
  exit 1
fi

git commit -m "$MENSAGEM"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Backup salvo com sucesso!"
else
  echo ""
  echo "⚠️ Não foi possível commitar. Verifique se há alterações para salvar."
fi
