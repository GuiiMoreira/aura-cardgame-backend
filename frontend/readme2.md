# Frontend Aura Cardgame — Guia de Continuidade (separação do backend)

> Documento de referência para migração do **frontend** para um repositório dedicado.

## 1) Contexto atual

O frontend está em `frontend/` dentro do repositório monolítico atual (`aura-cardgame-backend`).
Ele já cobre o fluxo principal:

- Autenticação (Firebase Auth)
- Lobby / Matchmaking
- Deck Builder + Coleção (Firestore)
- Partida em tempo real (Socket.IO)
- Tela de resultado

Stack principal:

- **React 18 + Vite + TypeScript**
- **socket.io-client** (jogo em tempo real)
- **Firebase (Auth + Firestore)**

---

## 2) Objetivo da separação

Criar um novo repositório exclusivo do frontend para:

- Evolução independente da interface
- Pipeline de CI/CD próprio
- Versionamento desacoplado do backend
- Gestão de dependências e deploy front sem impacto no servidor de jogo

---

## 3) Arquitetura atual (estado real)

### 3.1 Entrada da aplicação

- `src/main.tsx`: bootstrap React
- `src/App.tsx`: orquestra o fluxo inteiro da aplicação (estado global da sessão, conexão e steps)

### 3.2 Organização por features

- `src/features/login/*`
- `src/features/lobby/*`
- `src/features/matchmaking/*`
- `src/features/deck-builder/*`
- `src/features/partida/*`
- `src/features/resultado/*`

### 3.3 Camada de serviços

- `src/services/socketClient.ts`
  - Encapsula conexão Socket.IO
  - Assinatura de eventos (`estado_atualizado`, `fim_de_jogo`, etc.)
  - Comandos de jogo e reconexão

- `src/services/firebaseAuth.ts`
  - Login e registro por e-mail/senha
  - Login anônimo
  - Observer de autenticação

- `src/services/firestoreData.ts`
  - Leitura de catálogo (`cartas_mestras`)
  - Leitura/salvamento de baralhos do usuário

### 3.4 Contratos e tipos

- `src/contracts/socket-contracts.ts`: versão/contrato de eventos
- `src/types/app-state.ts`: tipos de estado da UI

### 3.5 Modo de desenvolvimento

- Mock disponível em `src/mock/mock-server.ts`
- Ativação por flag `VITE_ENABLE_MOCK_MODE=true` (apenas dev)

---

## 4) Dependências com backend (pontos críticos)

O frontend depende de:

1. **Socket namespace/eventos** do backend
2. **Formato do estado da partida** retornado em `partida_encontrada` e `estado_atualizado`
3. **Mensagens de erro** (`erro_partida`) usadas para UX (ex.: invalidar deck)
4. **Auth token Firebase** para autenticação no socket

### Risco principal

Mudanças de payload no backend sem versionamento de contrato quebram a UI.

### Mitigação recomendada

- Congelar e documentar o contrato em arquivo compartilhado (ou pacote versionado)
- Introduzir versionamento explícito de eventos (ex.: `SOCKET_CONTRACT_VERSION`)

---

## 5) Plano de migração para novo repositório

## Fase 1 — Extração inicial

1. Criar novo repositório (ex.: `aura-cardgame-frontend`).
2. Copiar integralmente a pasta `frontend/`.
3. Preservar histórico via `git filter-repo` (opcional) ou iniciar histórico limpo.
4. Ajustar README principal e scripts do novo repo.

## Fase 2 — Ajustes de configuração

1. Centralizar `.env.example` com variáveis obrigatórias.
2. Configurar `VITE_API_URL` por ambiente (dev/stg/prod).
3. Revisar CORS/backend para novo domínio do frontend.

## Fase 3 — Qualidade e pipeline

1. Adicionar ESLint + Prettier (se ainda não houver no frontend isolado).
2. Adicionar testes unitários e de integração de interface.
3. Criar CI (build + typecheck + lint + testes).
4. Publicar em ambiente de preview (Vercel/Netlify/Firebase Hosting).

## Fase 4 — Hardening de produção

1. Observabilidade de erros (Sentry ou similar).
2. Métricas de reconexão socket e abandono de partida.
3. Estratégia de feature flags para rollout seguro.

---

## 6) Variáveis de ambiente recomendadas

Criar `.env.example` no novo repo com:

```bash
# Backend
VITE_API_URL=http://localhost:3000

# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=

# Dev only
VITE_ENABLE_MOCK_MODE=false
```

Sugestão: documentar em README quais são obrigatórias por ambiente.

---

## 7) Roadmap funcional (futuras features)

## Curto prazo

- Melhorar UX de reconexão (banner persistente + estado detalhado)
- Melhorar feedback visual de erros por fase/evento
- Persistência local de preferências do jogador

## Médio prazo

- Histórico de partidas
- Replay básico por eventos
- Internacionalização (pt-BR/en)
- Acessibilidade (teclado, contraste, ARIA)

## Longo prazo

- Espectador da partida
- Torneios/salas privadas
- Sistema de progressão/perfil
- Dashboard de balanceamento (telemetria por carta/habilidade)

---

## 8) Melhorias técnicas sugeridas

1. **Quebrar `App.tsx`** em camadas de orquestração (hooks + providers) para reduzir acoplamento.
2. Criar **state management** mais explícito para fluxo da partida (ex.: Zustand/Redux Toolkit ou reducer dedicado).
3. Estruturar **adapters de contrato socket** para isolar parsing/normalização de payload.
4. Introduzir testes de contrato (frontend ↔ backend) com fixtures versionadas.
5. Criar pasta `src/shared/` para componentes comuns e utilitários cross-feature.

---

## 9) Estratégia de testes recomendada

- **Unitários**: utilitários de deck builder, mapeamento de mensagens e parsers de eventos.
- **Componentes**: views principais com Testing Library.
- **Integração de fluxo**: login → lobby → matchmaking → partida → resultado (com mock socket).
- **Contrato**: validação de payload de eventos em cenários críticos.

Ferramentas sugeridas no novo repo:

- Vitest
- @testing-library/react
- MSW (para APIs HTTP, se houver)

---

## 10) Checklist de “pronto para separar”

- [ ] Novo repo criado e publicado
- [ ] Código do `frontend/` migrado
- [ ] `.env.example` criado
- [ ] README principal atualizado
- [ ] Pipeline CI mínimo (typecheck + build)
- [ ] Deploy de preview funcionando
- [ ] CORS/backend aceitando domínio novo
- [ ] Contrato de eventos socket documentado
- [ ] Donos e fluxo de release definidos

---

## 11) Comandos úteis (novo repo)

```bash
npm install
npm run dev
npm run build
npm run preview
```

Para rodar contra backend local:

```bash
VITE_API_URL=http://localhost:3000 npm run dev
```

---

## 12) Decisões em aberto (para alinhar antes da migração final)

1. Estratégia de versionamento do contrato socket (semver? campo de versão no handshake?)
2. Política de compatibilidade entre versões frontend e backend
3. Plataforma de deploy oficial do frontend
4. Estratégia de autenticação para ambientes de teste/staging
5. Governance do design system (mesmo que mínimo)

---

## 13) Responsabilidades sugeridas (time)

- **Frontend owner**: arquitetura, qualidade, deploy
- **Backend owner**: contrato de eventos, estabilidade de payload
- **QA**: testes de fluxo e regressão funcional
- **Produto/Design**: priorização de roadmap e UX

---

## 14) Conclusão

O frontend já possui base funcional sólida para operar em um repositório próprio.
A prioridade para uma separação segura é formalizar contrato com backend + pipeline de qualidade + configuração por ambiente.

Com isso, o time ganha autonomia para iterar UI/UX e features sem acoplamento operacional ao backend.
