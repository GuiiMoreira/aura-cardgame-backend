# Contrato Socket.IO (único)

Versão do protocolo do servidor: `1.1.0`.

## Handshake

Cliente deve conectar com:

```ts
{
  auth: {
    token: "<Firebase ID Token>",
    protocolVersion: "1.1.0" // opcional para legado
  }
}
```

- `token` **obrigatório**.
- `protocolVersion` **opcional** (quando ausente, servidor assume `legacy-v1` para compatibilidade mínima).

## Compatibilidade retroativa mínima

1. `protocolVersion` ausente continua aceito (`legacy-v1`).
2. Eventos existentes não foram renomeados.
3. Payloads ganharam somente campo aditivo `protocolVersion` no servidor→cliente.
4. Frontends legados podem ignorar campos desconhecidos sem quebrar o fluxo.

---

## Cliente → Servidor

### `buscar_partida`
- Payload:
  - `deckId` (**obrigatório**, `string | number`)
- Exemplo:
```json
{ "deckId": "deck-iniciante" }
```

### `passar_turno`
- Regras de fase:
  - Avança a `estado.fase` para a próxima fase da sequência: `Ritual de Geração` → `Revelação` → `Manifestação` → `Guerra dos Véus` → `Silêncio Final` → `Ritual de Geração`.
  - `estado.turno` só troca ao sair de `Silêncio Final` para `Ritual de Geração`.
- Payload:
  - `sala` (**obrigatório**, `string`)
- Exemplo:
```json
{ "sala": "sala_sockA_sockB" }
```

### `jogar_carta`
- Regras de fase:
  - Permitido somente em `Manifestação`.
  - Fora dessa fase, servidor emite `erro_partida` com `codigo: "ACAO_FASE_INVALIDA"` e não altera o estado.
- Payload:
  - `sala` (**obrigatório**, `string`)
  - `cartaId` (**obrigatório**, `string`)
- Exemplo:
```json
{ "sala": "sala_sockA_sockB", "cartaId": "carta-123" }
```

### `atacar_fortaleza`
- Regras de fase:
  - Permitido somente em `Guerra dos Véus`.
  - Fora dessa fase, servidor emite `erro_partida` com `codigo: "ACAO_FASE_INVALIDA"` e não altera o estado.
- Payload:
  - `sala` (**obrigatório**, `string`)
  - `atacantesIds` (**obrigatório**, `string[]`)
- Exemplo:
```json
{ "sala": "sala_sockA_sockB", "atacantesIds": ["carta-10", "carta-11"] }
```

### `declarar_ataque`
- Regras de fase:
  - Permitido somente em `Guerra dos Véus`.
  - Fora dessa fase, servidor emite `erro_partida` com `codigo: "ACAO_FASE_INVALIDA"` e não altera o estado.
- Payload:
  - `sala` (**obrigatório**, `string`)
  - `atacanteId` (**obrigatório**, `string`)
  - `alvoId` (**obrigatório**, `string`)
- Exemplo:
```json
{ "sala": "sala_sockA_sockB", "atacanteId": "carta-10", "alvoId": "carta-99" }
```

### `reconectar_partida`
- Payload:
  - `sala` (**opcional**, `string`)
- Exemplo:
```json
{ "sala": "sala_sockA_sockB" }
```
ou
```json
{}
```

---

## Servidor → Cliente

> Todos os eventos abaixo incluem `protocolVersion` (`string`) no payload.

### `status_matchmaking`
- Campos:
  - `protocolVersion` (**obrigatório**)
  - `mensagem` (**obrigatório**)
  - `requestId`, `userId` (**opcionais**)
  - `sala`, `matchId` (podem ser `null`)
- Exemplo real emitido:
```json
{
  "protocolVersion": "1.1.0",
  "mensagem": "Você está na fila, aguardando outro jogador...",
  "requestId": "req-123",
  "userId": "uid-abc",
  "sala": null,
  "matchId": null
}
```

### `partida_encontrada`
- Campos:
  - `protocolVersion`, `sala`, `matchId`, `requestId`, `estado`
- Exemplo:
```json
{
  "protocolVersion": "1.1.0",
  "sala": "sala_sockA_sockB",
  "matchId": "sala_sockA_sockB",
  "requestId": "req-124",
  "estado": { "turno": "uid-abc", "fase": "Manifestação", "jogadores": {}, "campo": {} }
}
```

### `estado_atualizado`
- Campos:
  - `protocolVersion`, `sala`, `matchId`, `requestId`, `estado`
- Exemplo:
```json
{
  "protocolVersion": "1.1.0",
  "sala": "sala_sockA_sockB",
  "matchId": "sala_sockA_sockB",
  "requestId": "req-125",
  "estado": { "turno": "uid-def", "fase": "Manifestação", "jogadores": {}, "campo": {} }
}
```

### `fim_de_jogo`
- Campos:
  - `protocolVersion`, `vencedor`, `sala`, `matchId`, `requestId`
  - opcionais por regra: `motivo`, `jogadorDesconectado`
- Exemplo:
```json
{
  "protocolVersion": "1.1.0",
  "vencedor": "uid-abc",
  "motivo": "abandono",
  "jogadorDesconectado": "uid-def",
  "sala": "sala_sockA_sockB",
  "matchId": "sala_sockA_sockB",
  "requestId": "req-126"
}
```

### `erro_partida`
- Campos:
  - `protocolVersion`, `motivo`
  - `requestId`, `userId`, `sala`, `matchId` opcionais por contexto
  - Para erros de fase inválida: `codigo`, `acao`, `faseAtual`, `fasesPermitidas`
- Exemplo:
```json
{
  "protocolVersion": "1.1.0",
  "motivo": "deckId é obrigatório para buscar_partida.",
  "requestId": "req-127",
  "userId": "uid-abc",
  "sala": null,
  "matchId": null
}
```
