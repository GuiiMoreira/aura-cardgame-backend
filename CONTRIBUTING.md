# Contribuindo

## Convenções de branch

Use o padrão abaixo para manter o histórico previsível:

- `feature/<descricao-curta>` para novas funcionalidades.
- `fix/<descricao-curta>` para correções.
- `chore/<descricao-curta>` para tarefas de manutenção (CI, deps, docs).
- `hotfix/<descricao-curta>` para correções urgentes em produção.

Exemplos:

- `feature/matchmaking-rematch`
- `fix/validacao-custo-carta`
- `chore/ci-lint-prettier`

## Convenções de commit

Este repositório usa **Conventional Commits**.

Formato:

```text
<tipo>(<escopo-opcional>): <mensagem>
```

Tipos recomendados:

- `feat`: nova funcionalidade.
- `fix`: correção de bug.
- `chore`: manutenção sem alteração funcional.
- `docs`: documentação.
- `refactor`: refatoração sem mudança de comportamento.
- `test`: inclusão/ajuste de testes.
- `ci`: mudanças em pipeline/workflows.

Exemplos:

- `feat(matchmaking): adicionar timeout de busca`
- `fix(actions): bloquear ataque fora do turno`
- `ci(github-actions): adicionar lint e format check`

## Regras de Pull Request

- Abra PR sempre para `main`.
- Garanta que o workflow **CI** esteja verde (lint, format e testes).
- Mantenha PR pequeno e com escopo único.
- Atualize documentação quando mudar contrato/evento/regra de domínio.

## Checklist de release

Antes de criar release/tag:

- [ ] `npm ci`
- [ ] `npm run check`
- [ ] Cobertura mínima atendida (`npm run coverage:check`).
- [ ] Revisar/atualizar changelog (formato Keep a Changelog).
- [ ] Validar variáveis de ambiente em produção (`GOOGLE_CREDENTIALS_BASE64`, `PORT`, CORS).
- [ ] Confirmar compatibilidade de eventos Socket.IO com o frontend.
- [ ] Confirmar política de rollback (tag anterior disponível).
- [ ] Criar tag semântica (`vX.Y.Z`) e publicar release notes.


## Versionamento e changelog

- Seguimos **SemVer** (`MAJOR.MINOR.PATCH`).
- O processo de release está detalhado em [`docs/release-versioning.md`](./docs/release-versioning.md).
- Toda release deve atualizar [`CHANGELOG.md`](./CHANGELOG.md).
