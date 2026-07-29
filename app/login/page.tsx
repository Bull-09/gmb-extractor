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
        <div className="eyebrow">NIVARO INTERNAL ACCESS</div>
        <h1>Welcome to<br /><em>MapMint.</em></h1>
        <p>Enter the team access key to continue to the business extractor.</p>
        <form action="/api/auth/login" method="post">
          <label>
            Access key
            <input
              name="password"
              type="password"
              placeholder="Enter your access key"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="primary" type="submit">Sign in to MapMint <span>→</span></button>
        </form>
        <p className="login-note">Private tool by Nivaro · Authorized users only</p>
      </section>
    </main>
  );
}
