# Aura Cardgame Backend

Backend em Node.js para um jogo de cartas online em tempo real, usando Socket.IO para comunicação de baixa latência entre clientes e servidor, e Firestore (Firebase) para persistência de dados (baralhos e cartas).

> ✅ Este repositório contém apenas a lógica do servidor. O frontend deve se conectar via WebSocket (Socket.IO) para coordenar partidas, trocar ações e atualizar estados em tempo real.

---

## 📦 Estrutura do Projeto

- `server.js` - Entrypoint do servidor. Inicializa Express, Socket.IO e conecta ao Firestore.
- `sockets/manager.js` - Gerencia conexões Socket.IO, matchmaking, criação de partidas e ações de jogo (jogar carta, atacar etc).
- `game/logic.js` - Lógica de criação do estado inicial do jogo (embaralhar, comprar cartas, gerar recursos iniciais).
- `data/mockDeck.js` - Exemplo de baralho estático usado em testes ou desenvolvimento.
- `scripts/import.js` - Script para importar cartas do JSON (`scripts/cartas.json`) para o Firestore.

---

## 🧠 Como o jogo funciona (visão geral)

1. **Autenticação + matchmaking rápido (1v1)**
   - O cliente conecta no Socket.IO enviando `auth.token` (Firebase ID Token).
   - O servidor valida o token com Firebase Auth Admin SDK e usa sempre `socket.user.uid` como identidade do jogador.
   - Depois de autenticado, o jogador envia `buscar_partida` apenas com `deckId`.
   - O servidor faz uma fila simples de um jogador. Quando há dois jogadores, forma uma sala e cria a partida.

2. **Criação do estado inicial**
   - O servidor lê os baralhos dos jogadores do Firestore (coleção `usuarios/{userId}/baralhos/{deckId}`).
   - Busca todos os dados das cartas na coleção `cartas_mestras` (para evitar consultas públicas repetidas).
   - Embaralha, dá 5 cartas iniciais para cada jogador, define recursos iniciais (C, M, O, A) e vida igual a 100.

3. **Comunicação em tempo real**
   - Os clientes recebem `partida_encontrada` com o estado inicial.
   - A partir daí, usam eventos Socket.IO (passar_turno, jogar_carta, atacar_fortaleza, declarar_ataque) para atualizar o estado.
   - O servidor valida se é o turno correto e atualiza o estado compartilhado.

4. **Fim de partida**
   - Se a vida do oponente chega a 0 ou menos, o servidor emite `fim_de_jogo` e limpa a partida.

---

## 🧩 Firestore (Firebase) - Modelo de Dados

### Coleção `cartas_mestras`
Documentos de cartas usadas pelos baralhos. Cada documento deve ter pelo menos:
- `id` (string) - identificador (usado em `mockDeck` e em baralhos)
- `Nome`, `Força`, `Vida`, `C`, `M`, `O`, `A` (atributos de custo/força/vida)
- `Mecânica`, `DescricaoMecanica` (opcional)

> O script `scripts/import.js` envia os dados de `scripts/cartas.json` para essa coleção.
> O importador usa `item.id` como ID do documento em `cartas_mestras` (upsert com merge), mantendo consistência com os IDs referenciados nos baralhos.

### Coleção `usuarios/{userId}/baralhos/{deckId}`
Cada documento representa um baralho personalizado de um usuário. Estrutura esperada:
- `cartas`: array de IDs de cartas (string) que existem em `cartas_mestras`.

### 📏 Regras oficiais de construção de deck
Ao iniciar uma partida, o backend valida o deck antes de montar o estado inicial:
- **Tamanho fixo**: exatamente **30 cartas** (mínimo = 30 e máximo = 30).
- **Cópias por carta**: no máximo **3 cópias** do mesmo ID.
- **Integridade de catálogo**: todos os IDs do deck devem existir em `cartas_mestras`.

Se alguma regra falhar, a partida é abortada e os jogadores recebem `erro_partida` com motivo explícito (ex.: tamanho inválido, excesso de cópias ou IDs ausentes). O backend também registra log de auditoria com contexto (`uid`, `deckId`, motivo e detalhes).

---

## 🚀 Configuração e Execução

### 1) Instalar dependências

```bash
npm install
```

### 2) Fornecer credenciais do Firebase

O servidor exige credenciais de serviço do Firebase (Service Account), que podem ser passadas de duas formas:

#### Opção A: via variável de ambiente (recomendada)

- Base64 encode do JSON de credenciais.
- Coloque na variável `GOOGLE_CREDENTIALS_BASE64`.

```bash
export GOOGLE_CREDENTIALS_BASE64=$(base64 -w 0 serviceAccountKey.json)
```

#### Opção B: arquivo local (desenvolvimento)

Coloque o JSON de credenciais em `./serviceAccountKey.json` (mesmo formato usado em `scripts/import.js`).

---

### 3) Executar o servidor

```bash
node server.js
```

O servidor iniciará na porta `3000` (configurável via `PORT`).

> O `cors` está configurado para permitir `http://localhost:5173` por padrão. Altere em `server.js` se precisar conectar de outro host/porta.

---

## 🔌 APIs de Socket.IO (Eventos)

### Autenticação no Socket.IO

O backend exige autenticação em toda conexão Socket.IO:

- No `io.use`, o servidor lê `socket.handshake.auth.token`.
- O token é validado via `admin.auth().verifyIdToken(token)`.
- Em caso de sucesso, o socket recebe `socket.user = { uid, ...claims }`.
- Em caso de falha/ausência de token, o servidor emite `erro_partida` com `motivo` claro e desconecta o cliente.

Exemplo de conexão no cliente:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: firebaseIdToken,
  },
});

socket.emit('buscar_partida', { deckId: 'deck-123' });
```


### Emissão do cliente → servidor
- Handshake de conexão: `auth: { token: <Firebase ID Token> }`
- `buscar_partida` { deckId }
- `passar_turno` { sala }
- `jogar_carta` { sala, cartaId }
- `atacar_fortaleza` { sala, atacantesIds: [id, ...] }
- `declarar_ataque` { sala, atacanteId, alvoId }

### Eventos do servidor → cliente
- `status_matchmaking` (status durante fila)
- `partida_encontrada` { sala, estado }
- `estado_atualizado` (emitido após cada ação válida)
- `fim_de_jogo` { vencedor }
- `erro_partida` { motivo }

---

## 🧱 Regras de domínio (módulo `game/actions.js`)

As regras críticas de partida agora ficam isoladas em funções de domínio puras:

- `passarTurno(estado, userId)`
- `jogarCarta(estado, userId, cartaId)`
- `atacarFortaleza(estado, userId, atacantesIds)`
- `declararAtaque(estado, userId, atacanteId, alvoId)`

O arquivo `sockets/manager.js` ficou focado em validar payload/socket/contexto e delegar as regras para o domínio.

## 🧪 Testes

```bash
npm test
```

Os testes cobrem fluxos críticos: consumo de recursos, exaustão de cartas, dano e condição de fim de jogo.

## 🧪 Desenvolvimento

- Use `data/mockDeck.js` se quiser testar a lógica localmente sem precisar do Firestore.
- Para atualizar as cartas, edite `scripts/cartas.json`, depois execute `node scripts/import.js`.

---

## 🛠️ Personalizações Frequemtes

- **Alterar fluxo de matchmaking**: Modifique `sockets/manager.js` para suportar matchmaking com filas maiores, salas públicas, prontos, etc.
- **Aprimorar regras de combate**: Edite `sockets/manager.js` (ações) ou mova as regras para `game/logic.js` para separar preocupações.
- **Persistir partidas**: já implementado com snapshots em `partidas_ativas` e arquivamento em `partidas_historico`.

---

## 📌 Observações

- O servidor mantém o estado em memória (`jogosAtivos`), o que significa que reiniciar o serviço cancela as partidas em andamento.
- Os identificadores de carta (`id`) devem ser únicos e consistentes entre `cartas_mestras` e os baralhos dos usuários.

---

## ✅ Licença

Coloque aqui sua licença preferida (MIT, Apache 2.0, etc.).


## 💾 Persistência de Partidas no Firestore

### Coleção `partidas_ativas` (schema mínimo + metadados)
Cada documento usa `sala` como ID e mantém:
- `sala` (string)
- `estado` (objeto completo da partida)
- `jogadores` (objeto com status de conexão por `uid`)
- `updatedAt` (Date)

Campos adicionais operacionais:
- `status` (`ativa` | `recuperavel`)
- `recuperavel` (boolean)
- `expiresAt` (Date para política TTL/limpeza)

### Fluxo de persistência
- Ao criar matchmaking: salva snapshot inicial em `partidas_ativas`.
- Após cada ação válida (`passar_turno`, `jogar_carta`, `atacar_fortaleza`, `declarar_ataque`): atualiza snapshot da sala.
- Em reconexão/desconexão: atualiza status para apoiar recuperação de sessão.
- No fim da partida: copia para `partidas_historico` e remove de `partidas_ativas`.

### Recuperação no startup
No boot (`server.js`), o backend carrega partidas de `partidas_ativas` com status não finalizado e as marca como `recuperavel`, permitindo reconexão dos jogadores.

### TTL / limpeza de partidas abandonadas
- Campo `expiresAt` é renovado a cada snapshot (janela padrão: 24h).
- Limpeza periódica no backend roda a cada 15 minutos para remover documentos expirados (`status = recuperavel`).
- Recomenda-se também habilitar **Firestore TTL** em produção usando `expiresAt` para limpeza automática server-side.

### Custo, performance e limites
- **Writes**: 1 escrita por ação válida da partida (+ escritas de status em reconexão/desconexão).
- **Reads no startup**: leitura de partidas ativas/recuperáveis para reidratar memória.
- **Documento grande**: `estado` cresce com tamanho de mão/campo/baralho; o limite do Firestore por documento é **1 MiB**.
- **Boas práticas**:
  - manter no snapshot apenas estado necessário para retomar a sessão;
  - evitar histórico de eventos ilimitado dentro do mesmo documento;
  - para auditoria detalhada, gravar eventos em subcoleção (`partidas_historico/{sala}/eventos`) em vez de inchar `partidas_ativas`.
