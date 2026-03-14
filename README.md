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

1. **Matchmaking rápido (1v1)**
   - Um jogador envia `buscar_partida` com `userId` e `deckId`.
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

### Coleção `usuarios/{userId}/baralhos/{deckId}`
Cada documento representa um baralho personalizado de um usuário. Estrutura esperada:
- `cartas`: array de IDs de cartas (string) que existem em `cartas_mestras`.

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

### Emissão do cliente → servidor
- `buscar_partida` { userId, deckId }
- `passar_turno` { sala }
- `jogar_carta` { sala, cartaId }
- `atacar_fortaleza` { sala, atacantesIds: [id, ...] }
- `declarar_ataque` { sala, atacanteId, alvoId }

### Eventos do servidor → cliente
- `status_matchmaking` (status durante fila)
- `partida_encontrada` { sala, estado }
- `estado_atualizado` (emitido após cada ação válida)
- `fim_de_jogo` { vencedor }
- `erro_partida` { mensagem }

---

## 🧪 Desenvolvimento

- Use `data/mockDeck.js` se quiser testar a lógica localmente sem precisar do Firestore.
- Para atualizar as cartas, edite `scripts/cartas.json`, depois execute `node scripts/import.js`.

---

## 🛠️ Personalizações Frequemtes

- **Alterar fluxo de matchmaking**: Modifique `sockets/manager.js` para suportar matchmaking com filas maiores, salas públicas, prontos, etc.
- **Aprimorar regras de combate**: Edite `sockets/manager.js` (ações) ou mova as regras para `game/logic.js` para separar preocupações.
- **Persistir partidas**: Adicione gravação da posição atual no Firestore para permitir reconexão.

---

## 📌 Observações

- O servidor mantém o estado em memória (`jogosAtivos`), o que significa que reiniciar o serviço cancela as partidas em andamento.
- Os identificadores de carta (`id`) devem ser únicos e consistentes entre `cartas_mestras` e os baralhos dos usuários.

---

## ✅ Licença

Coloque aqui sua licença preferida (MIT, Apache 2.0, etc.).
