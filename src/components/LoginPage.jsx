export default function LoginPage({
  password,
  onPasswordChange,
  onSubmit,
  errorMessage,
}) {
  return (
    <main className="login-page">
      <section className="login-card">
        <p className="hero-badge">Student Access</p>
        <h1>Mobile Comparison Login</h1>
        <p className="login-text">
          Enter the project password to open the mobile comparison dashboard.
        </p>

        <form className="login-form" onSubmit={onSubmit}>
          <label className="search-box">
            <span className="search-label">Password</span>
            <input
              type="password"
              className="search-input"
              placeholder="Enter password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </label>

          <button type="submit" className="compare-button login-button">
            Open App
          </button>
        </form>

        <p className="login-hint">Demo password: `1234`</p>

        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </section>
    </main>
  );
}
