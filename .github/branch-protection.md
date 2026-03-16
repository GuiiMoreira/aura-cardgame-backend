# Proteção de branch (main)

Para **bloquear merge sem CI verde**, configure as regras da branch `main` no GitHub:

1. Vá em **Settings > Branches > Branch protection rules**.
2. Adicione/edite uma regra para `main`.
3. Habilite:
   - **Require a pull request before merging**
   - **Require status checks to pass before merging**
4. Selecione o check obrigatório do workflow: **CI / ci**.
5. (Opcional recomendado) habilite:
   - **Require branches to be up to date before merging**
   - **Require conversation resolution before merging**

> Resultado: nenhum PR poderá ser mergeado se lint/format/testes falharem.
