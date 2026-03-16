# Proteção de branch (`main`)

Para bloquear merge de PR sem pipeline verde:

1. Acesse **Settings > Branches > Branch protection rules**.
2. Crie/edite regra para `main`.
3. Habilite:
   - **Require a pull request before merging**
   - **Require status checks to pass before merging**
4. Marque como obrigatórios os checks deste workflow:
   - **CI / ci (Run lint)**
   - **CI / ci (Run tests)**
   - **CI / ci (Check coverage threshold)**
5. (Recomendado) habilite também:
   - **Require branches to be up to date before merging**
   - **Require conversation resolution before merging**
   - **Do not allow bypassing the above settings**

> Resultado: nenhum PR pode ser mergeado na `main` se lint, testes ou cobertura mínima falharem.
