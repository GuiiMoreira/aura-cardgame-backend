type LoginViewProps = {
  email: string;
  password: string;
  isAuthenticated: boolean;
  userId?: string;
  authError?: string;
  mockMode: boolean;
  canUseMockMode: boolean;
  canUseFirebaseAuth: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onMockToggle: (value: boolean) => void;
  onEmailPasswordLogin: () => void;
  onAnonymousLogin: () => void;
  onSubmit: () => void;
};

export function LoginView(props: LoginViewProps) {
  return (
    <section>
      <h2>Login</h2>

      {props.isAuthenticated ? (
        <p>
          Usuário autenticado: <strong>{props.userId}</strong>
        </p>
      ) : (
        <>
          <label>
            E-mail
            <input
              type="email"
              value={props.email}
              onChange={(e) => props.onEmailChange(e.target.value)}
              placeholder="voce@dominio.com"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={props.password}
              onChange={(e) => props.onPasswordChange(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={props.onEmailPasswordLogin} disabled={!props.canUseFirebaseAuth}>
              Entrar com e-mail/senha
            </button>
            <button onClick={props.onAnonymousLogin} disabled={!props.canUseFirebaseAuth}>
              Entrar anônimo
            </button>
          </div>
        </>
      )}

      {props.canUseMockMode ? (
        <label style={{ display: 'block', marginTop: 12 }}>
          <input
            type="checkbox"
            checked={props.mockMode}
            onChange={(e) => props.onMockToggle(e.target.checked)}
          />
          Ativar mock server (somente dev)
        </label>
      ) : null}

      {!props.canUseFirebaseAuth ? (
        <p style={{ color: 'darkorange' }}>
          Firebase Auth não configurado. Defina as variáveis VITE_FIREBASE_* para autenticação real.
        </p>
      ) : null}

      {props.authError ? <p style={{ color: 'crimson' }}>Erro de autenticação: {props.authError}</p> : null}

      <button onClick={props.onSubmit} disabled={!props.isAuthenticated} style={{ marginTop: 8 }}>
        Continuar para lobby
      </button>
    </section>
  );
}
