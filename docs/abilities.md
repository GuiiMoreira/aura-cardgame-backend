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
- **Regra oficial**: ao entrar no campo, a carta perde `X` de `Vida` (`Sacrifício (X)`).
- **Determinismo com `resolveDeaths`**:
  - a perda de vida acontece imediatamente durante `jogarCarta`;
  - em seguida, `resolveDeaths` é executado na ordem `[invocador, oponente]`;
  - se a carta ficar com `Vida <= 0`, ela é enviada ao cemitério no mesmo fluxo da invocação.

### Exemplo de carta e resolução

Carta exemplo:

```js
{
  id: 'fanatico_do_veu',
  Força: 6,
  Vida: 5,
  'Mecânica': 'Sacrifício (5)',
}
```

Ordem de resolução ao usar `jogarCarta`:

1. carta entra no campo exausta;
2. `onSummon` de `SACRIFICIO` reduz `Vida` em `5`;
3. `resolveDeaths` verifica o controlador primeiro;
4. com `Vida <= 0`, a carta dispara `onDeath` (se existir), depois vai ao cemitério.

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
