type RegisterViewProps = {
  email: string;
  password: string;
  confirmPassword: string;
  authError?: string;
  canUseFirebaseAuth: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onRegister: () => void;
  onBackToLogin: () => void;
};

export function RegisterView(props: RegisterViewProps) {
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, background: '#fafafa' }}>
      <h2 style={{ marginTop: 0 }}>Cadastro</h2>
      <p>Crie sua conta para salvar decks, coleção e progresso.</p>

      <label style={{ display: 'block', marginBottom: 8 }}>
        E-mail
        <input
          type="email"
          value={props.email}
          onChange={(e) => props.onEmailChange(e.target.value)}
          style={{ width: '100%', marginTop: 4 }}
        />
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Senha
        <input
          type="password"
          value={props.password}
          onChange={(e) => props.onPasswordChange(e.target.value)}
          style={{ width: '100%', marginTop: 4 }}
        />
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Confirmar senha
        <input
          type="password"
          value={props.confirmPassword}
          onChange={(e) => props.onConfirmPasswordChange(e.target.value)}
          style={{ width: '100%', marginTop: 4 }}
        />
      </label>

      {!props.canUseFirebaseAuth ? (
        <p style={{ color: 'darkorange' }}>Firebase Auth não configurado para cadastro.</p>
      ) : null}

      {props.authError ? <p style={{ color: 'crimson' }}>{props.authError}</p> : null}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={props.onRegister} disabled={!props.canUseFirebaseAuth}>
          Criar conta
        </button>
        <button onClick={props.onBackToLogin}>Voltar ao login</button>
      </div>
    </section>
  );
}
