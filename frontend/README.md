# Aura Cardgame Frontend (React + Vite)

Frontend para consumir os eventos Socket.IO do backend com fluxo completo de partida.

## Módulos implementados

- Login
- Lobby / Matchmaking
- Partida
- Resultado

## Camadas principais

- `src/services/socketClient.ts`: encapsula conexão, assinatura de eventos e comandos de jogo.
- `src/features/partida`: componentes de mão/campo/carta com base para habilidades especiais.

## Eventos sincronizados na UI

- `partida_encontrada`
- `estado_atualizado`
- `fim_de_jogo`
- `erro_partida`
- reconexão (`disconnect`, `reconnect_attempt`, `reconnect`, `reconnect_failed`)

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
