# Endpoints & Eventos Socket.IO

Este backend não expõe uma API REST tradicional. A comunicação acontece via **Socket.IO** (WebSocket + fallback) entre cliente e servidor. Abaixo estão todos os eventos (`emit` e `on`) utilizados pelo servidor e o formato esperado dos dados.

---

## ✅ Evento: `buscar_partida`
**Descrição:** Envia a intenção de encontrar um adversário e iniciar um jogo.

### Cliente → Servidor
- **Evento:** `buscar_partida`
- **Payload (objeto):**
  - `userId` (string) - identificador do jogador.
  - `deckId` (string|number) - identificador do baralho que o jogador deseja usar.

### Servidor → Cliente (resposta)
- `status_matchmaking` (string) — indica que o jogador está na fila.
- `partida_encontrada` (objeto) — enviado quando o matchmaking forma uma partida.
- `erro_partida` (objeto) — enviado se houve erro ao criar a partida.

### Observações
- O servidor faz uma fila simples (1 vs 1). Se já houver alguém na fila, a partida é iniciada.

---

## ✅ Evento: `status_matchmaking`
**Descrição:** Mensagem informativa enviada pelo servidor para clientes em busca de partida.

### Servidor → Cliente
- **Evento:** `status_matchmaking`
- **Payload:** string (mensagem de status)

---

## ✅ Evento: `partida_encontrada`
**Descrição:** Enviado quando uma partida foi criada com sucesso.

### Servidor → Cliente
- **Evento:** `partida_encontrada`
- **Payload (objeto):**
  - `sala` (string) - nome da sala Socket.IO onde os dois jogadores serão reunidos.
  - `estado` (objeto) - estado inicial do jogo (jogadores, turno, campo, etc).

---

## ✅ Evento: `estado_atualizado`
**Descrição:** Enviado sempre que o estado do jogo é alterado (passar turno, jogar carta, ataque etc.).

### Servidor → Cliente
- **Evento:** `estado_atualizado`
- **Payload:** objeto com o estado atual do jogo (mesmo formato de `estado` em `partida_encontrada`).

---

## ✅ Evento: `fim_de_jogo`
**Descrição:** Indica que um jogador venceu (vida do oponente <= 0).

### Servidor → Cliente
- **Evento:** `fim_de_jogo`
- **Payload (objeto):**
  - `vencedor` (string) - `userId` do jogador que venceu.

---

## ✅ Evento: `erro_partida`
**Descrição:** Em caso de falha ao inicializar a partida (por exemplo, baralho faltando).

### Servidor → Cliente
- **Evento:** `erro_partida`
- **Payload (objeto):**
  - `mensagem` (string) - descrição do erro.

---

## ✅ Evento: `passar_turno`
**Descrição:** Cliente indica que deseja encerrar seu turno.

### Cliente → Servidor
- **Evento:** `passar_turno`
- **Payload (objeto):**
  - `sala` (string) - nome da sala retornado em `partida_encontrada`.

### Comportamento do servidor
- Valida se é o turno do jogador que enviou.
- Passa o turno para o adversário.
- Compra 1 carta para o jogador ativo (se existir no baralho).
- Atualiza recursos baseados em geração e limites máximos.
- Remove exaustão das cartas no campo do jogador que agora é ativo.

---

## ✅ Evento: `jogar_carta`
**Descrição:** Cliente joga uma carta da mão para o campo.

### Cliente → Servidor
- **Evento:** `jogar_carta`
- **Payload (objeto):**
  - `sala` (string) - nome da sala.
  - `cartaId` (string) - id da carta que o jogador deseja jogar.

### Comportamento do servidor
- Valida turno e recursos suficientes (C, M, O, A).
- Remove a carta da mão e adiciona ao campo.
- Define `carta.exaustao = true`.
- Atualiza recursos do jogador.

---

## ✅ Evento: `atacar_fortaleza`
**Descrição:** Realiza ataque direto à vida do oponente usando cartas no campo.

### Cliente → Servidor
- **Evento:** `atacar_fortaleza`
- **Payload (objeto):**
  - `sala` (string) - nome da sala.
  - `atacantesIds` (array) - lista de `id`s das cartas que atacarão.

### Comportamento do servidor
- Valida turno e se cada carta não está exausta.
- Soma `Força` das cartas válidas e aplica como dano direto na vida do oponente.
- Marca as cartas como exaustas.

---

## ✅ Evento: `declarar_ataque`
**Descrição:** Declara ataque de uma carta para atacar outra carta no campo inimigo.

### Cliente → Servidor
- **Evento:** `declarar_ataque`
- **Payload (objeto):**
  - `sala` (string) - nome da sala.
  - `atacanteId` (string) - id da carta atacante.
  - `alvoId` (string) - id da carta alvo.

### Comportamento do servidor
- Valida turno, existência das cartas e que a atacante não esteja exausta.
- Aplica mecânica `Instável` (se houver) causando dano extra baseado no valor definido.
- Faz troca de dano (ataque vs vida) entre atacante e alvo.
- Remove cartas cujo `Vida <= 0` do campo e as envia ao cemitério (`cemiterio`).
- Marca atacante como exausta.

---

## 🧠 Estado do jogo (formato geral)

O objeto de `estado` enviado em `partida_encontrada` e `estado_atualizado` inclui (entre outros):

- `jogadores`: objeto com key `userId` → dados do jogador (vida, recursos, mão, baralho, cemitério, etc.)
- `turno`: `userId` de quem possui o turno atualmente
- `fase`: string (por enquanto sempre `Manifestação`)
- `campo`: objeto com key `userId` → array de cartas em campo

---

## 🧩 Cabeçalhos / Headers (Sockets)

Socket.IO utiliza o handshake padrão via HTTP/WS. Em geral não há cabeçalhos específicos obrigatórios além de:

- `Origin` (controlado pelo browser)
- `Cookie` (se você usar autenticação baseada em sessão)

Para autenticação customizada, você pode utilizar o campo `auth` no cliente Socket.IO (não implementado por padrão neste repositório).
