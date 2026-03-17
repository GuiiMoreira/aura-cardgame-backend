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
  onGoToRegister: () => void;
  onSubmit: () => void;
};

const cardStyle = {
  background: 'linear-gradient(135deg, #111827, #1f2937)',
  border: '1px solid #374151',
  borderRadius: 16,
  color: '#f3f4f6',
  padding: 24,
};

export function LoginView(props: LoginViewProps) {
  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>Bem-vindo ao Aura Cardgame</h2>
      <p style={{ color: '#d1d5db' }}>
        Monte seu deck, dispute partidas 1v1 em tempo real e evolua sua coleção em um mundo pós-
        cataclismo mágico.
      </p>

      {props.isAuthenticated ? (
        <p>
          Usuário autenticado: <strong>{props.userId}</strong>
        </p>
      ) : (
        <>
          <label style={{ display: 'block', marginBottom: 8 }}>
            E-mail
            <input
              type="email"
              value={props.email}
              onChange={(e) => props.onEmailChange(e.target.value)}
              placeholder="voce@dominio.com"
              style={{ width: '100%', marginTop: 4 }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Senha
            <input
              type="password"
              value={props.password}
              onChange={(e) => props.onPasswordChange(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', marginTop: 4 }}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button onClick={props.onEmailPasswordLogin} disabled={!props.canUseFirebaseAuth}>
              Entrar com e-mail/senha
            </button>
            <button onClick={props.onAnonymousLogin} disabled={!props.canUseFirebaseAuth}>
              Entrar anônimo
            </button>
            <button onClick={props.onGoToRegister}>Criar conta</button>
          </div>
        </>
      )}

      {props.canUseMockMode ? (
        <label style={{ display: 'block', marginTop: 12 }}>
          <input
            type="checkbox"
            checked={props.mockMode}
            onChange={(e) => props.onMockToggle(e.target.checked)}
          />{' '}
          Ativar mock server (somente dev)
        </label>
      ) : null}

      {!props.canUseFirebaseAuth ? (
        <p style={{ color: '#f59e0b' }}>
          Firebase Auth não configurado. Defina as variáveis VITE_FIREBASE_* para autenticação real.
        </p>
      ) : null}

      {props.authError ? <p style={{ color: '#fca5a5' }}>Erro de autenticação: {props.authError}</p> : null}

      <button onClick={props.onSubmit} disabled={!props.isAuthenticated} style={{ marginTop: 12 }}>
        Continuar para o HUB
      </button>
    </section>
  );
}
