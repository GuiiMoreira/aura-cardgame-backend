# Aura Cardgame Frontend (React + Vite)

Frontend para consumir os eventos Socket.IO do backend com fluxo completo de partida.

## Módulos implementados

- Login (Firebase Auth: e-mail/senha ou anônimo)
- Lobby / Matchmaking
- Coleção + Deck Builder (persistência de baralhos em Firestore)
- Partida
- Resultado

## Camadas principais

- `src/services/socketClient.ts`: encapsula conexão, assinatura de eventos e comandos de jogo.
- `src/services/firebaseAuth.ts`: integração com Firebase Auth para sessão real.
- `src/features/partida`: componentes de mão/campo/carta com base para habilidades especiais.

## Eventos sincronizados na UI

- `partida_encontrada`
- `estado_atualizado`
- `fim_de_jogo`
- `erro_partida`
- reconexão (`disconnect`, `reconnect_attempt`, `reconnect`, `reconnect_failed`)

## Auth Firebase

Configure as variáveis abaixo para login real:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

## Modo mock server

O mock só pode ser habilitado em desenvolvimento e quando a flag explícita estiver ativa:

```bash
VITE_ENABLE_MOCK_MODE=true
```

## Executar

```bash
cd frontend
npm install
npm run dev
```

Para backend online:

```bash
VITE_API_URL=http://localhost:3000 npm run dev
```


## Deck builder e coleção

- Catálogo carregado de `cartas_mestras`.
- Baralhos em `usuarios/{userId}/baralhos/{deckId}` com campo `cartas`.
- Validação local: exatamente 30 cartas e no máximo 3 cópias por ID.
- Lobby exibe seletor de baralhos salvos (sem input livre de `deckId`).
