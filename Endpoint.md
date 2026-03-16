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

- `token` é obrigatório e é validado pelo backend com `firebase-admin` (`admin.auth().verifyIdToken`) no handshake.
- `protocolVersion` é recomendado.
- Se `protocolVersion` estiver ausente, o servidor usa compatibilidade mínima com `legacy-v1`.
- Após autenticar, o servidor popula `socket.user.uid` e esse valor é a única identidade usada nas ações (qualquer `userId` enviado no payload é ignorado).
- Se o token estiver ausente/inválido/expirado, o servidor emite `erro_partida` e desconecta o socket.

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


## 📏 Regras oficiais de deck (validadas no `buscar_partida`)

Antes da emissão de `partida_encontrada`, o backend valida os dois baralhos:

- **Tamanho obrigatório**: exatamente **30 cartas**.
- **Limite por carta**: no máximo **3 cópias** do mesmo ID.
- **Catálogo válido**: todo ID enviado no deck precisa existir em `cartas_mestras`.

Se alguma validação falhar, a sala recém-criada recebe `erro_partida` com `motivo` descritivo (por exemplo: tamanho inválido, limite de cópias excedido ou IDs ausentes em `cartas_mestras`) e a partida não é iniciada.

