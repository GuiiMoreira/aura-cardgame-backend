# Release, versionamento e changelog

## Estratégia de versionamento

Este projeto usa **Semantic Versioning (SemVer)**:

- **MAJOR**: mudanças incompatíveis no contrato/API/eventos.
- **MINOR**: funcionalidades novas compatíveis.
- **PATCH**: correções e ajustes compatíveis.

Formato da tag: `vX.Y.Z`.

## Changelog

Usamos o padrão **Keep a Changelog** em `CHANGELOG.md`.

Seções recomendadas por versão:

- `Added`
- `Changed`
- `Deprecated`
- `Removed`
- `Fixed`
- `Security`

## Fluxo de release

1. Garantir PR aprovado e CI verde.
2. Atualizar `CHANGELOG.md` movendo itens de `Unreleased` para a nova versão.
3. Rodar validações locais:
   - `npm ci`
   - `npm run check`
4. Criar commit de release (`chore(release): vX.Y.Z`).
5. Criar tag anotada (`git tag -a vX.Y.Z -m "vX.Y.Z"`).
6. Publicar release no GitHub usando as notas do `CHANGELOG.md`.

## Meta de cobertura progressiva

A cobertura mínima é validada no CI via `npm run coverage:check`.

Baseline atual:

- lines: **45%**
- functions: **45%**
- statements: **45%**
- branches: **35%**

Meta progressiva recomendada:

- elevar **+5 pontos percentuais** por ciclo de release enquanto houver folga de estabilidade.
- nunca reduzir threshold sem justificativa técnica registrada no PR.
