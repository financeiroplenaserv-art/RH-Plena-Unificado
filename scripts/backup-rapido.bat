@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ==========================================
echo  Backup rápido do trabalho não commitado
echo ==========================================
echo.

git add .
git diff --cached --stat

echo.
echo Para confirmar o commit, digite uma mensagem e pressione Enter.
echo Para cancelar, feche esta janela ou pressione Ctrl+C.
echo.

set /p MENSAGEM="Mensagem do commit: "

git commit -m "%MENSAGEM%"

if %errorlevel% == 0 (
  echo.
  echo ✅ Backup salvo com sucesso!
) else (
  echo.
  echo ⚠️ Não foi possível commitar. Verifique se há alterações para salvar.
)

pause
