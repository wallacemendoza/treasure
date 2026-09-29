import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, Input } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import treasureLogo from "../../assets/treasure-logo.png";

function UpdatePassword() {
  const { isLoading, session } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      navigate("/dashboard", { replace: true });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <Card className="login-card">
        <div className="login-brand">
          <img className="login-logo" src={treasureLogo} alt="Treasure USA Chapter logo" />
          <div>
            <h1 className="login-title"><span className="login-title-accent">BALAIOS</span> <span className="login-title-accent">MC</span></h1>
            <p className="login-chapter">USA CHAPTER</p>
            <p className="login-subtitle">Set your portal password</p>
          </div>
        </div>
        {isLoading ? <p>Validating your link...</p> : !session ? (
          <div className="stack-md">
            <p className="form-error">This password link is invalid or expired. Request a new one from the sign-in page.</p>
            <Link to="/login">Back to sign in</Link>
          </div>
        ) : (
          <form className="stack-lg" onSubmit={handleSubmit}>
            <label htmlFor="new_password" className="field-label">New Password</label>
            <Input id="new_password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
            <label htmlFor="confirm_password" className="field-label">Confirm Password</label>
            <Input id="confirm_password" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            {error ? <p className="form-error">{error}</p> : null}
            <Button type="submit" disabled={loading}>{loading ? "Updating..." : "Set Password"}</Button>
          </form>
        )}
      </Card>
    </main>
  );
}

export default UpdatePassword;
