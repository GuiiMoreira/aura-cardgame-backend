# Sistema de habilidades

## Hooks suportados

Cada habilidade pode implementar os hooks abaixo:

- `onSummon`: dispara quando a carta entra no campo por `jogarCarta`.
- `beforeAttack`: dispara antes da troca de dano em `declararAtaque`.
- `afterAttack`: dispara após a troca de dano em `declararAtaque`.
- `onDeath`: dispara quando a carta é removida do campo por vida `<= 0`.
- `onTurnStart`: dispara no início do turno do controlador durante `passarTurno`.

## Ordem de resolução

1. **Prioridade da habilidade** (`prioridade`): maior valor resolve primeiro.
2. **Empate de prioridade**: resolve na ordem original de declaração da habilidade na carta.
3. **Ordem entre cartas em combate**:
   - `beforeAttack` do atacante;
   - `beforeAttack` do defensor;
   - dano de combate (se ambos ainda estiverem vivos);
   - `afterAttack` do atacante;
   - `afterAttack` do defensor.
4. **Resolução de mortes (`resolveDeaths`)**:
   - percorre jogadores na ordem recebida pela ação;
   - cada carta morta dispara `onDeath` antes de ir para o cemitério;
   - repete em laços até não haver mais mortes pendentes (permite cadeia de efeitos).


## Habilidade: SACRIFICIO

- **Alias aceitos no parser textual**: `SACRIFICIO` e `Sacrifício`.
- **Hook oficial**: `onSummon`.
- **Regra oficial por variante (`Sacrifício (1|2|3)`)**:
  - `Sacrifício (1)`: auto-sacrifício (sacrifica apenas o invocador).
  - `Sacrifício (2)`: sacrifica o invocador e **1 aliado**.
  - `Sacrifício (3)`: sacrifica o invocador e **2 aliados**.
- **Fonte da especificação**: `DescricaoMecanica` da carta (ex.: `Sacrifique-se.`, `Sacrifique a si e um aliado.`, `Sacrifique a si e mais dois aliados.`).

### Ordem de resolução no jogo

1. `jogarCarta` paga custos, remove da mão e coloca a carta no campo exausta;
2. para `Sacrifício (2|3)`, o cliente informa `sacrificeAllyId`/`sacrificeAllyIds`;
3. `onSummon` de `SACRIFICIO` marca invocador e aliados de custo com `Vida = 0`;
4. `resolveDeaths` processa mortes na ordem `[invocador, oponente]`;
5. cada carta com `Vida <= 0` dispara `onDeath` e só então vai para `cemiterio`.

### Exemplos das variantes

```js
// Sacrifício (1)
{
  id: 'cria_do_fim',
  'Mecânica': 'Sacrifício (1)',
  DescricaoMecanica: 'Sacrifique-se.',
}

// Sacrifício (2)
{
  id: 'cultista_da_fenda',
  'Mecânica': 'Sacrifício (2)',
  DescricaoMecanica: 'Sacrifique a si e um aliado.',
}

// Sacrifício (3)
{
  id: 'lowis',
  'Mecânica': 'Sacrifício (3)',
  DescricaoMecanica: 'Sacrifique a si e mais dois aliados.',
}
```

Se `Sacrifício (2|3)` não receber aliados válidos suficientes no payload da ação, a invocação é cancelada e o estado (mão/campo/recursos) é revertido.

## Conflitos e efeitos encadeados

- Se `beforeAttack` matar uma das cartas, o dano de combate não é aplicado.
- Efeitos que reduzem vida para `<= 0` durante qualquer hook entram na fila de morte na próxima execução de `resolveDeaths` da ação.
- Em efeitos simultâneos de morte, a ordem depende da ordem de jogadores passada pela ação (`[atacante, defensor]` em combate, `[invocador, oponente]` em invocação).

## Normalização de modelagem de habilidade

A engine prioriza estrutura normalizada em `carta.habilidades`:

```js
{
  tipo: 'IMPACTO',
  params: { valor: 3 },
  prioridade: 10,
}
```

Fallback robusto: caso a carta tenha apenas texto em `Mecânica`/`Mecanica`, é feito parser de padrões como:

- `Impacto (3)`
- `Recarregável (1)`
- múltiplas habilidades separadas por `,`, `;` ou `|`

Tokens inválidos/desconhecidos são ignorados sem quebrar a execução.
