# Plena EA — Sistema Institucional Unificado

Plataforma web institucional que unifica os sistemas **RH Ocorrências**, **CEU (Crachá, Equipamento e Uniforme)** e **VR (Vale Refeição)** em uma única experiência com dados mestres compartilhados, autenticação única e segurança por nível de acesso.

## Stack

- React 19 + TypeScript 5
- Vite
- Tailwind CSS 4 + shadcn/ui
- Supabase (Auth + PostgreSQL + RLS)
- React Router DOM
- Sonner (toast)
- Lucide React

## Estrutura de pastas

```
src/
├── main.tsx
├── App.tsx
├── index.css
├── lib/
│   ├── supabase.ts
│   ├── auth.ts
│   ├── utils.ts
│   ├── importar.ts
│   ├── pdf.ts
│   └── vr/
│       ├── calculoVR.ts
│       ├── pdfParser.ts
│       ├── excelParser.ts
│       ├── pdfExtractor.ts
│       ├── comprovanteVR.ts
│       └── storageVR.ts
├── types/
│   ├── database.ts
│   ├── econtador.ts
│   ├── vr.ts
│   └── index.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useColaboradores.ts
│   ├── useDepartamentos.ts
│   ├── useEmpresas.ts
│   ├── useEContador.ts
│   ├── useOcorrencias.ts
