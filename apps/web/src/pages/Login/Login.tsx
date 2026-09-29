import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button, Card, Input } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { submitAccessRequest } from "../../services/accessRequestService";
import treasureLogo from "../../assets/treasure-logo.png";

type LoginMode = "signin" | "request" | "recovery";

function Login() {
  const [mode, setMode] = useState<LoginMode>("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    try {
      if (mode === "request") {
        await submitAccessRequest({ full_name: fullName, username, email: identifier });
        setSuccessMessage("Your access request has been sent to the chapter admins. If approved, you will receive an email with a link to set your password.");
        setMode("signin");
      } else if (mode === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim(), {
          redirectTo: `${window.location.origin}/update-password`,
        });
        if (error) throw error;
        setSuccessMessage("If an account exists for that email, a password reset link is on its way.");
        setMode("signin");
      } else {
        await signIn(identifier, password);
        navigate("/dashboard");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to complete this request.";
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = identifier.trim().length > 0 &&
    (mode !== "signin" || password.length > 0) &&
    (mode !== "request" || (fullName.trim().length > 0 && username.trim().length > 0)) &&
    !loading;

  function changeMode(nextMode: LoginMode) {
    setMode(nextMode);
    setMessage("");
    setSuccessMessage("");
  }

  return (
    <main className="login-screen">
      <div className="login-bg-emblem" aria-hidden="true" />
      <Card className="login-card">
        <div className="login-brand">
          <img className="login-logo" src={treasureLogo} alt="Treasure USA Chapter logo" />
          <div>
            <h1 className="login-title">
              <span className="login-title-accent">BALAIOS</span> <span className="login-title-accent">MC</span>
            </h1>
            <p className="login-chapter">USA CHAPTER</p>
            <p className="login-subtitle">Chapter Management Portal</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="stack-lg">
          {mode === "request" ? (
            <>
              <p className="login-subtitle">Request portal access. An admin must approve your request before an account is created.</p>
              <label htmlFor="request_full_name" className="field-label">Full Name</label>
              <Input id="request_full_name" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required />
              <label htmlFor="request_username" className="field-label">Username</label>
              <Input id="request_username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={32} required />
            </>
          ) : null}

          <label htmlFor="identifier" className="field-label">
            {mode === "signin" ? "Email or Username" : "Email"}
          </label>
          <Input
            id="identifier"
            type={mode === "signin" ? "text" : "email"}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={mode === "signin" ? "name@example.com or chaptername" : "name@example.com"}
            autoComplete={mode === "signin" ? "username" : "email"}
            required
          />

          {mode === "signin" ? (
            <>
              <label htmlFor="password" className="field-label">Password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </>
          ) : null}

          {message ? <p className="form-error">{message}</p> : null}
          {successMessage ? <p className="form-success">{successMessage}</p> : null}

          <Button type="submit" disabled={!canSubmit}>
            {loading ? "Please wait..." : mode === "signin" ? "Sign In" : mode === "request" ? "Request Access" : "Send Reset Link"}
          </Button>
          <div className="stack-sm">
            {mode === "signin" ? (
              <>
                <Button type="button" variant="ghost" onClick={() => changeMode("recovery")}>Forgot password?</Button>
                <Button type="button" variant="ghost" onClick={() => changeMode("request")}>Request an account</Button>
              </>
            ) : (
              <Button type="button" variant="ghost" onClick={() => changeMode("signin")}>Back to sign in</Button>
            )}
          </div>
        </form>
      </Card>
    </main>
  );
}

export default Login;