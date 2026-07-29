import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="login-shell">
      <section className="login-card">
        <span className="login-logo" aria-hidden="true">
          <img src="/nivaro-logo.png" alt="" />
        </span>
        <div className="eyebrow">MAPMINT BY NIVARO</div>
        <h1>Welcome to<br /><em>MapMint.</em></h1>
        <p>Sign in or create your free account to start building business lists.</p>
        <LoginForm />
        <p className="login-note">A free-only lead tool by Nivaro</p>
      </section>
    </main>
  );
}
