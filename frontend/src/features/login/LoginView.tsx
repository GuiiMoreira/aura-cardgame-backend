type LoginViewProps = {
  token: string;
  userId: string;
  mockMode: boolean;
  onTokenChange: (value: string) => void;
  onUserIdChange: (value: string) => void;
  onMockToggle: (value: boolean) => void;
  onSubmit: () => void;
};

export function LoginView(props: LoginViewProps) {
  return (
    <section>
      <h2>Login</h2>
      <label>
        Token Firebase
        <input value={props.token} onChange={(e) => props.onTokenChange(e.target.value)} />
      </label>
      <label>
        User ID (mock)
        <input value={props.userId} onChange={(e) => props.onUserIdChange(e.target.value)} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={props.mockMode}
          onChange={(e) => props.onMockToggle(e.target.checked)}
        />
        Ativar mock server
      </label>
      <button onClick={props.onSubmit}>Entrar</button>
    </section>
  );
}
