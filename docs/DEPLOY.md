# Guia de Deploy — RH Plena Unificado

> **Contexto atual (2026-07-16):** A usuária planeja finalizar mais importações de dados antes de concentrar esforços no deploy. A intenção é subir o projeto em um VPS após estabilizar essas importações. O banco de dados deve continuar no Supabase (gerenciado), e o VPS será usado apenas para servir o frontend (PWA) estático. Não migrar o PostgreSQL para o VPS sem avaliação técnica.
>
> **Pendente antes do deploy:**
> 1. Finalizar as importações de dados pendentes.
> 2. Fazer backup do banco (plano Free não tem backup automático; usar `scripts/backup_supabase_free.sql` no SQL Editor).
> 3. Aplicar a migration `supabase/migrations/058_consolidar_rls_seguro.sql` no SQL Editor do Supabase.
> 4. Testar login, colaboradores, empresas, departamentos, ocorrências, extras, VR, CEU e e-Contador.
> 5. Corrigir qualquer erro de permissão/RLS encontrado nos testes.
> 6. Após o deploy, considerar upgrade para o plano Pro do Supabase para ter backups automáticos.

Este documento descreve como realizar o deploy da aplicação em ambiente local, preview e VPS.

---

## 1. Pré-requisitos

- Node.js 20+ e npm 10+
- Supabase CLI v2.108.0+ logado
- Acesso ao projeto Supabase `jmdjdogskvybsdjtmpmb`
- Variáveis de ambiente no `.env` (não commitado)

---

## 2. Variáveis de ambiente

Crie um arquivo `.env` na raiz com pelo menos:

```env
VITE_SUPABASE_URL=https://jmdjdogskvybsdjtmpmb.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-anon-key>
VITE_USAR_EDGE_FUNCTION_ECONTADOR=true
```

> **Nunca commite o arquivo `.env`.**

---

## Decisão de arquitetura: banco no Supabase (não no VPS)

A usuária perguntou se o banco de dados não deveria ser hospedado no VPS e a responsabilidade dos dados ficar com a Hostgator. **Recomendamos manter o banco no Supabase.**

- **Supabase** oferece banco PostgreSQL gerenciado: backups automáticos, patches de segurança, RLS, autenticação, storage e monitoramento incluídos.
- **Hospedar o banco no VPS** exigiria instalar e administrar PostgreSQL, firewall, backups, réplicas e atualizações de segurança. Isso aumenta o risco de perda de dados e exige conhecimento técnico contínuo.
- **A Hostgator** (ou qualquer provedor de VPS) é responsável pela disponibilidade do servidor, **não pelos dados do seu sistema**. A responsabilidade pelos dados (backup, integridade, segurança, LGPD) continua sendo sua.
- **Portanto, o VPS será usado apenas para o frontend**: servir os arquivos estáticos de `dist/`. O banco, autenticação e storage permanecem no Supabase.

Se no futuro o volume de dados ou exigências de compliance justificarem, pode-se avaliar uma migração para um banco gerenciado próprio (RDS, Supabase Dedicated, etc.), mas não um PostgreSQL auto-gerenciado no VPS.

---

## 3. Build local

```bash
npm ci
npm run build
```

Verifique que a pasta `dist/` foi gerada sem erros.

---

## 4. Preview local

```bash
npm run preview
```

A aplicação será servida em `http://localhost:4173`.

O Vite configura automaticamente o fallback do React Router para rotas SPA. Teste as rotas:

- `/`
- `/colaboradores`
- `/rh/ocorrencias`
- `/vr/projetos`
- `/ceu/dashboard`

---

## 5. Deploy em VPS (roteiro genérico)

### 5.1 Preparar o servidor

- Instalar Node.js 20 LTS e npm.
- Opcional: instalar `pm2` ou `nginx`/`caddy`.
- Copiar o conteúdo do projeto para o servidor via `rsync`, `scp` ou Git.

### 5.2 Instalar dependências e buildar

```bash
cd /var/www/rh-plena-unificado
npm ci
npm run build
```

### 5.3 Configurar variáveis de ambiente no servidor

Crie um arquivo `.env` no servidor com as mesmas variáveis do ambiente local.

### 5.4 Servir com Node.js (preview não recomendado para produção)

```bash
npm run preview -- --host
```

Use `pm2` para manter vivo:

```bash
pm2 start "npm run preview -- --host" --name rh-plena-preview
```

### 5.5 Servir com nginx (recomendado)

Exemplo de configuração `/etc/nginx/sites-available/rh-plena`:

```nginx
server {
    listen 80;
    server_name rh-plena.exemplo.com;
    root /var/www/rh-plena-unificado/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Habilite e recarregue:

```bash
ln -s /etc/nginx/sites-available/rh-plena /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 5.6 Headers de segurança

Adicione no nginx:

```nginx
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

CSP recomendada (ajuste conforme necessário):

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://jmdjdogskvybsdjtmpmb.supabase.co;" always;
```

### 5.7 HTTPS com Let's Encrypt

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d rh-plena.exemplo.com
```

---

## 6. Edge Functions

A função `econtador` já deve estar deployada no Supabase. Para atualizar:

```bash
supabase functions deploy econtador --project-ref jmdjdogskvybsdjtmpmb
```

Confirme que a secret `ENCRYPTION_KEY` está configurada no dashboard do Supabase.

---

## 7. Migrations

Aplique migrations sempre que houver mudanças no banco:

```bash
supabase link --project-ref jmdjdogskvybsdjtmpmb
supabase db push
```

---

## 8. Testes

Antes de qualquer deploy, execute:

```bash
npm test
```

Atualmente há 19 testes passando.

---

## 9. Checklist pós-deploy

- [ ] Aplicação acessível via HTTPS
- [ ] Rotas SPA funcionando (fallback para `index.html`)
- [ ] Login funcional
- [ ] CRUD de colaboradores, empresas, departamentos
- [ ] Ocorrências, CEU, VR e e-Contador operacionais
- [ ] Headers de segurança presentes
- [ ] Backup do banco configurado
