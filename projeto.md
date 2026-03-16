# Plano de Desenvolvimento Digital para Aura

O desenvolvimento de um card game online envolve diversas camadas de tecnologia e design. Nosso objetivo é criar uma experiência fluida, responsiva e engajadora para os jogadores, mantendo a rica narrativa de Aura.

---

# 1. Estrutura Geral do Projeto Digital

Para um card game online, a arquitetura geralmente se divide em três grandes componentes:

### Frontend (Cliente)

É o que o jogador vê e com o que interage no navegador.

Inclui:

- Interface do usuário (menus, coleção de cartas, construtor de baralhos)
- Tabuleiro de jogo
- Cartas
- Animações
- Efeitos visuais e sonoros

### Backend (Servidor)

É o **"cérebro" do jogo**.

Responsabilidades:

- Lógica do jogo
- Regras de turno
- Resolução de combates
- Habilidades de cartas
- Autenticação de usuários
- Matchmaking
- Persistência de dados
- Comunicação em tempo real

⚠️ **A lógica do jogo deve ficar no backend para evitar trapaças.**

### Banco de Dados

Armazena todas as informações persistentes:

- Contas de usuários
- Coleções de cartas
- Estado de partidas
- Histórico de partidas
- Dados das cartas

---

# 2. Tecnologias Sugeridas

Para uma versão **online acessível via navegador**, sugere-se uma stack web moderna.

---

# 2.1 Frontend (O Jogo no Navegador)

### Linguagens Primárias

- JavaScript
- HTML
- CSS

### Framework de Interface

**React**

Vantagens:

- Componentização
- Reuso de código
- Ideal para interfaces complexas

Exemplos de uso:

- coleção de cartas
- menus
- construtor de baralhos

---

### Renderização do Tabuleiro

#### Canvas API (HTML5)

Permite:

- animações fluidas
- efeitos visuais
- controle pixel-a-pixel

#### Bibliotecas opcionais

Caso o jogo cresça em complexidade visual:

- **PixiJS**
- **Phaser**

---

### Estilização

**Tailwind CSS**

Vantagens:

- desenvolvimento rápido
- design responsivo
- menor necessidade de CSS customizado

---

### Ícones

Sugestões:

- lucide-react
- Font Awesome
- Phosphor Icons

---

# 2.2 Backend (Servidor)

### Runtime

**Node.js**

Opcionalmente:

- TypeScript (para projetos maiores)

Benefícios:

- alta performance em aplicações em tempo real
- mesma linguagem do frontend

---

### Comunicação em Tempo Real

**Socket.IO**

Usado para:

- sincronizar partidas
- enviar ações entre jogadores
- atualizar estado do jogo

---

### APIs REST

Framework sugerido:

**Express.js**

Usado para:

- login
- registro
- consulta de coleção de cartas
- serviços auxiliares

---

# 2.3 Banco de Dados

### Firestore (Firebase)

Banco de dados NoSQL baseado em documentos.

Benefícios:

- sincronização em tempo real
- escalabilidade automática
- integração com Firebase
- modelagem flexível

Ideal para:

- cartas
- coleções de jogadores
- partidas em andamento

---

### Autenticação

**Firebase Authentication**

Gerencia:

- login
- registro
- sessões

---

# 2.4 Hospedagem

Plataforma recomendada:

**Firebase + Google Cloud**

### Serviços usados

**Firebase Hosting**

- hospeda o frontend React

**Cloud Functions / Cloud Run**

- executa backend Node.js
- escala automaticamente

---

# 3. Implementação das Mecânicas de Jogo

---

## Definição de Cartas

Todas as cartas ficam no Firestore como documentos contendo:

- nome
- tipo
- atributos
- habilidades
- lore

---

## Fortaleza e Recursos

O backend controla:

- vida da fortaleza
- geração de recursos

No início de cada turno:

1. backend calcula geração
2. envia atualização via Socket.IO

---

## Fluxo de Turnos

O backend controla:

- fase atual
- jogador ativo
- avanço das fases

O frontend **apenas exibe o estado.**

---

## Jogar Cartas e Habilidades

Fluxo:

1. jogador envia ação
2. backend valida
3. backend atualiza estado
4. backend notifica jogadores

---

## Combate (Guerra dos Véus)

O backend calcula:

- força
- vida
- habilidades
- efeitos globais

O frontend apenas mostra as animações.

---

## Mecânicas Globais

Exemplos:

- Instável
- Sacrifício
- Resíduo

Implementadas como lógica de backend.

---

## Construção de Baralho

Interface frontend com **drag and drop**.

Baralho salvo no Firestore:

```
/usuarios/{userId}/baralhos/{deckId}
```

---

## Multiplayer

Socket.IO cria **salas de jogo**.

Cada ação:

- enviada ao servidor
- processada
- retransmitida ao oponente

---

## Condições de Vitória

O backend monitora continuamente:

- vida da fortaleza
- objetivos especiais

---

# 4. Fases de Desenvolvimento

---

# 4.1 MVP (Produto Mínimo Viável)

Objetivo:

Ter **um jogo 1x1 funcional**.

---

## 4.1.1 Estrutura Básica

### Backend

**Firebase Authentication**

Login simples:

- email/senha
- ou anônimo

---

### Firestore – Cartas Mestras

Coleção:

```
/cartas_mestras
```

Armazena as **250 cartas da expansão**.

---

### Firestore – Usuários

Coleção:

```
/usuarios/{userId}/colecao_cartas
```

---

### Frontend

- tela de coleção
- construtor de baralhos simples
- login integrado

---

# 4.1.2 Gameplay Essencial

Backend mantém:

- mãos
- baralhos
- cemitério
- campo
- recursos
- vida da fortaleza
- fase do turno
- jogador ativo

---

## Fluxo de Turnos

Fases:

1. Ritual de Geração
2. Revelação
3. Manifestação
4. Guerra dos Véus
5. Silêncio Final

---

## Validação de Ações

Backend verifica:

- custo
- alvos
- fase correta

---

## Mecânicas básicas do MVP

- Recarregável
- Instável
- Sacrifício

---

## Frontend do jogo

- tabuleiro básico
- mão do jogador
- recursos
- fortaleza

Interações:

- drag and drop
- declarar ataques
- passar turno

---

# 4.1.3 UI Mínima

- layout funcional
- cores básicas
- feedback simples

---

# 4.1.4 Multiplayer Básico

- matchmaking simples
- botão **Encontrar Partida**
- reconexão simples

---

# 4.2 Refinamento e Conteúdo

---

## Implementação das 250 Cartas

Backend implementa:

- habilidades
- interações
- mecânicas completas

---

### Mecânicas adicionais

- Resíduo
- Alquimia
- Antimagia

---

### Sistema de Habilidades

Possíveis abordagens:

#### Palavras-chave

Ex:

```
"Causar Dano"
"Comprar Carta"
"Invocar Unidade"
```

---

#### DSL (Domain Specific Language)

Sistema de script interno para habilidades complexas.

---

# Melhorias de UI/UX

### Tabuleiro mais elaborado

Visual:

- mundo quebrado
- poluição mágica
- efeitos visuais

---

### Melhorias na coleção

Filtros:

- Senda
- tipo
- raridade
- custo
- palavra-chave

---

### Construtor de baralho

- estatísticas
- curva de custo
- múltiplos decks

---

### Navegação

Menu principal:

- Jogar
- Coleção
- Loja
- Perfil
- Configurações

---

# Sincronização Avançada

- reconexão robusta
- tratamento de latência
- logs de backend
- logs de frontend

---

# 4.3 Recursos Avançados

---

# Modos de Jogo

## Campanha

- narrativa
- IA
- progressão
- recompensas

---

## Dominação (Multiplayer)

- múltiplos jogadores
- controle de território

---

## Draft

- escolha de cartas
- deck temporário

---

# Sistema de Progressão

- níveis
- missões diárias
- conquistas

---

# Loja

Opcional:

- pacotes de cartas
- cosméticos
- decks prontos

---

# Polimento Visual

- arte final das cartas
- animações profissionais
- trilha sonora
- efeitos sonoros

---

# Infraestrutura

- otimização de performance
- testes de carga
- balanceamento
- analytics
- monitoramento

---

# Comunidade

- chat
- sistema de report
- integração social
- wiki

---

# Considerações Importantes

### Arte e Som

Grande investimento necessário.

---

### Balanceamento

Card games exigem **balanceamento constante**.

---

### Segurança

Manter lógica no backend reduz trapaças.

---

### Comunidade

Discord e redes sociais são essenciais.

---

# Modelagem de Dados das Cartas (Firestore)

Coleção principal:

```
/cartas_mestras
```

Documento:

```
cartas_mestras/id_da_carta
```

---

# Campos de Carta

### id

Identificador único.

Ex:

```
instavel_explosao
```

---

### nome

Nome da carta.

---

### expansao

Ex:

```
O Início do Fim
```

---

### senda

Facção da carta.

---

### tipo

Exemplos:

- Personagem
- Construção
- Feitiço
- Equipamento
- Evento Global

---

### raridade

- Comum
- Incomum
- Rara
- Lendária

---

### classe

Array de classes.

Ex:

```
["Alquimista", "Combatente"]
```

---

### custo

Objeto:

```json
{
  "comida": 0,
  "material": 1,
  "ouro": 1,
  "aura": 0
}
```

---

### vida

Opcional.

---

### forca

Opcional.

---

### descricao

Texto da habilidade.

---

### mecanicas

Ex:

```
["Instável", "Sacrifício"]
```

---

### flavor

Texto narrativo.

---

### imagem_url

URL da arte.

---

# Exemplo de Carta

```json
{
  "id": "lenza_forjadora_ruptura_001",
  "nome": "Lenza, Forjadora da Ruptura",
  "expansao": "O Início do Fim",
  "senda": "A Arte Ígnea",
  "tipo": "Personagem",
  "raridade": "Lendária",
  "classe": ["Alquimista", "Humana"],
  "custo": {
    "comida": 20,
    "material": 10,
    "ouro": 20,
    "aura": 30
  },
  "vida": 90,
  "forca": 40,
  "descricao": "Alquimia (4): Consuma 4 cartas do cemitério...",
  "mecanicas": ["Alquimia"],
  "flavor": "A magia falhou. Ela a reinventou com coragem.",
  "imagem_url": "https://placehold.co/200x300/F06060/FFFFFF?text=Lenza"
}
```

---

# Outro Exemplo

```json
{
  "id": "explosao_instavel_001",
  "nome": "Estopim Volátil",
  "expansao": "O Início do Fim",
  "senda": "A Arte Ígnea",
  "tipo": "Personagem",
  "raridade": "Comum",
  "classe": ["Alquimista", "Combatente"],
  "custo": {
    "comida": 0,
    "material": 1,
    "ouro": 1,
    "aura": 0
  },
  "vida": 2,
  "forca": 1,
  "descricao": "Ao ser jogado, cause 2 de dano...",
  "mecanicas": ["Instável"]
}
```

---

# Exemplo de Feitiço

```json
{
  "id": "ritual_cura_005",
  "nome": "Bênção Imaculada",
  "expansao": "O Início do Fim",
  "senda": "A Teurgia Imaculada",
  "tipo": "Feitiço",
  "raridade": "Incomum",
  "classe": ["Ritual Menor"],
  "custo": {
    "comida": 0,
    "material": 0,
    "ouro": 0,
    "aura": 2
  },
  "descricao": "Cure 3 pontos de vida de uma unidade aliada...",
  "mecanicas": ["Antimagia"],
  "imagem_url": "https://placehold.co/200x300/6060F0/FFFFFF?text=Bencao+Imaculada"
}
```
