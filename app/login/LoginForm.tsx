"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export default function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setMessage("Supabase is not connected yet.");
    setLoading(true);
    setMessage("");
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/callback?next=/`,
        });
        if (error) throw error;
        setMessage("Password reset email sent.");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) throw error;
        setMessage("Account created. Check your email to confirm it.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.assign("/");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="auth-tabs">
        <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
        <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Create account</button>
      </div>
      <form onSubmit={submit}>
        <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
        {mode !== "reset" && (
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} required /></label>
        )}
        <button className="primary" type="submit" disabled={loading}>
          {loading ? "Please wait…" : mode === "signup" ? "Create MapMint account" : mode === "reset" ? "Send reset email" : "Sign in to MapMint"} <span>→</span>
        </button>
      </form>
      <button className="forgot-link" type="button" onClick={() => setMode(mode === "reset" ? "login" : "reset")}>
        {mode === "reset" ? "Back to sign in" : "Forgot password?"}
      </button>
      {message && <p className="auth-message">{message}</p>}
    </>
  );
}
