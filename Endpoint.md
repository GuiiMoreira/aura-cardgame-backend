# Endpoints & Eventos Socket.IO

Este backend não expõe uma API REST tradicional para gameplay. O contrato Socket.IO final está centralizado em:

- **`docs/socket-contract.md`**

## Resumo rápido

### Handshake obrigatório

```js
const socket = io('http://localhost:3000', {
  auth: {
    token: firebaseIdToken,
    protocolVersion: '1.1.0',
  },
});
```

- `token` é obrigatório.
- `protocolVersion` é recomendado.
- Se `protocolVersion` estiver ausente, o servidor usa compatibilidade mínima com `legacy-v1`.

### Eventos cliente → servidor

- `buscar_partida` `{ deckId }`
- `passar_turno` `{ sala }`
- `jogar_carta` `{ sala, cartaId }`
- `atacar_fortaleza` `{ sala, atacantesIds }`
- `declarar_ataque` `{ sala, atacanteId, alvoId }`
- `reconectar_partida` `{ sala? }`

### Eventos servidor → cliente

- `status_matchmaking`
- `partida_encontrada`
- `estado_atualizado`
- `fim_de_jogo`
- `erro_partida`

> Todos os payloads servidor → cliente incluem `protocolVersion`.

Para campos obrigatórios/opcionais e exemplos completos de payload, consulte `docs/socket-contract.md`.
