# Aura Cardgame Frontend (React + Vite)

Frontend inicial para consumir os eventos Socket.IO do backend.

## Módulos implementados

- Login
- Lobby
- Matchmaking
- Sala de Partida

## Eventos consumidos

- `partida_encontrada`
- `estado_atualizado`
- `fim_de_jogo`
- `erro_partida`

## Contrato de payloads

As tipagens estão centralizadas em `packages/shared-contracts/src/index.ts`.

## Modo mock server

Por padrão o app inicia com `mockMode=true`, permitindo desenvolvimento visual sem backend online.

## Executar

```bash
cd frontend
npm install
npm run dev
```

Para backend online, desative o checkbox "Ativar mock server" na tela de Login e use:

```bash
VITE_API_URL=http://localhost:3000 npm run dev
```


Também é possível criar `frontend/.env.local` com `VITE_API_URL=http://localhost:3000`.
