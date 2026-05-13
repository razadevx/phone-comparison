export default function LoginPage({
  authMode,
  formData,
  onFieldChange,
  onSubmit,
  onModeChange,
  errorMessage,
  successMessage,
}) {
  const isRegisterMode = authMode === "register";

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="hero-badge">Student Access</p>
        <h1>{isRegisterMode ? "Create Your Account" : "Welcome Back"}</h1>
        <p className="login-text">
          {isRegisterMode
            ? "Register once on this browser, then log in anytime without a backend."
            : "Sign in to open the mobile comparison dashboard."}
        </p>

        <div className="auth-toggle">
          <button
            type="button"
            className={`auth-tab ${!isRegisterMode ? "auth-tab-active" : ""}`}
            onClick={() => onModeChange("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={`auth-tab ${isRegisterMode ? "auth-tab-active" : ""}`}
            onClick={() => onModeChange("register")}
          >
            Register
          </button>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          {isRegisterMode && (
            <label className="search-box">
              <span className="search-label">Full Name</span>
              <input
                type="text"
                className="search-input"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={(event) => onFieldChange("name", event.target.value)}
              />
            </label>
          )}

          <label className="search-box">
            <span className="search-label">Email</span>
            <input
              type="email"
              className="search-input"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(event) => onFieldChange("email", event.target.value)}
            />
          </label>

          <label className="search-box">
            <span className="search-label">Password</span>
            <input
              type="password"
              className="search-input"
              placeholder="Enter your password"
              value={formData.password}
              onChange={(event) =>
                onFieldChange("password", event.target.value)
              }
            />
          </label>

          {isRegisterMode && (
            <label className="search-box">
              <span className="search-label">Confirm Password</span>
              <input
                type="password"
                className="search-input"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(event) =>
                  onFieldChange("confirmPassword", event.target.value)
                }
              />
            </label>
          )}

          <button type="submit" className="compare-button login-button">
            {isRegisterMode ? "Create Account" : "Login"}
          </button>
        </form>

        {successMessage && <p className="success-message">{successMessage}</p>}
        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </section>
    </main>
  );
}
