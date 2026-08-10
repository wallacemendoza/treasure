import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button, Card, Input } from "../../components/ui";

function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      await signIn(identifier, password);
      navigate("/dashboard");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to sign in.";
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !loading;

  return (
    <main className="login-screen">
      <Card className="login-card">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">
            T
          </span>
          <div>
            <h1>Treasure</h1>
            <p>Chapter administration portal</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="stack-lg">
          <label htmlFor="identifier" className="field-label">
            Email or Username
          </label>
          <Input
            id="identifier"
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="name@example.com or chaptername"
            autoComplete="username"
            required
          />

          <label htmlFor="password" className="field-label">
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            required
          />

          {message ? <p className="form-error">{message}</p> : null}

          <Button type="submit" disabled={!canSubmit}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </Card>
    </main>
  );
}

export default Login;