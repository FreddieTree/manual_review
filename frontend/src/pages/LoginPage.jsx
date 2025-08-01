// src/pages/LoginPage.jsx
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { loginReviewer } from "../api";
import clsx from "clsx";

const EMAIL_DOMAIN = "bristol.ac.uk";
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const NAME_REGEX = /^[a-zA-Z\s\-'.]{2,100}$/;
const PREFIX_REGEX = /^[a-zA-Z0-9._%+-]{1,64}$/;

// debounce hook
function useDebounce(value, delay = 150) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const tid = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(tid);
  }, [value, delay]);
  return debounced;
}

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const nameRef = useRef(null);

  // load persisted values
  const [name, setName] = useState(() => localStorage.getItem("login_name") || "");
  const [emailPrefix, setEmailPrefix] = useState(() => localStorage.getItem("login_email_prefix") || "");
  const debouncedEmailPrefix = useDebounce(emailPrefix, 150);

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);

  // Focus name input on mount
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Persist name & prefix
  useEffect(() => {
    localStorage.setItem("login_name", name);
  }, [name]);
  useEffect(() => {
    localStorage.setItem("login_email_prefix", emailPrefix);
  }, [emailPrefix]);

  // Lockout expiry
  useEffect(() => {
    if (lockedUntil && Date.now() > lockedUntil) {
      setLockedUntil(0);
      setAttempts(0);
      setError("");
    }
  }, [lockedUntil]);

  // Derived validity
  const nameValid = useMemo(() => NAME_REGEX.test(name.trim()), [name]);
  const prefixValid = useMemo(() => PREFIX_REGEX.test(debouncedEmailPrefix.trim()), [debouncedEmailPrefix]);
  const email = `${emailPrefix.trim()}@${EMAIL_DOMAIN}`;

  // Validate fields
  const validateFields = useCallback(() => {
    const errs = {};
    if (!name.trim()) errs.name = "Name is required.";
    else if (!NAME_REGEX.test(name.trim())) errs.name = "Invalid name (letters, spaces, -.' allowed).";
    if (!emailPrefix.trim()) errs.emailPrefix = "Email prefix is required.";
    else if (!PREFIX_REGEX.test(emailPrefix.trim())) errs.emailPrefix = "Invalid email prefix.";
    return errs;
  }, [name, debouncedEmailPrefix]);

  useEffect(() => {
    setFieldErrors(validateFields());
  }, [name, debouncedEmailPrefix, validateFields]);

  const canSubmit = useMemo(() => {
    return Object.keys(fieldErrors).length === 0 && !loading && Date.now() >= lockedUntil;
  }, [fieldErrors, loading, lockedUntil]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (Date.now() < lockedUntil) {
      setError("Too many failed attempts. Please wait.");
      return;
    }

    const errs = validateFields();
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      setError("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await loginReviewer({ name: name.trim(), email: email.toLowerCase() });
      // reset attempts on success
      setAttempts(0);
      setLockedUntil(0);
      // redirect logic
      const params = new URLSearchParams(location.search);
      const next = params.get("next");
      if (res.is_admin) {
        navigate(next || "/admin");
      } else if (res.no_more_tasks) {
        navigate("/no_more_tasks");
      } else {
        navigate(next || "/review");
      }
    } catch (err) {
      const msg = err?.message || "Login failed.";
      setError(msg);
      setAttempts((a) => a + 1);
      if (attempts + 1 >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_DURATION_MS);
      }
    } finally {
      setLoading(false);
    }
  };

  const clearEmailPrefix = () => setEmailPrefix("");

  const lockoutSeconds = lockedUntil > Date.now() ? Math.ceil((lockedUntil - Date.now()) / 1000) : 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-tr from-indigo-50 via-sky-50 to-white px-4">
      <div
        role="form"
        aria-labelledby="login-heading"
        className="relative w-full max-w-md bg-white shadow-2xl rounded-3xl p-10 flex flex-col gap-6"
      >
        <h1 id="login-heading" className="text-3xl font-extrabold text-indigo-700 text-center">
          Reviewer Login
        </h1>

        {lockoutSeconds > 0 && (
          <div
            role="alert"
            className="rounded-md bg-yellow-100 border border-yellow-300 p-3 text-sm flex justify-between items-center"
          >
            <div>
              Too many failed attempts. Try again in {lockoutSeconds} second{lockoutSeconds !== 1 && "s"}.
            </div>
            <button
              aria-label="Clear lockout"
              onClick={() => {
                setLockedUntil(0);
                setAttempts(0);
                setError("");
              }}
              className="text-xs underline"
            >
              Reset
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block font-medium mb-1">
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              ref={nameRef}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? "name-error" : undefined}
              className={clsx(
                "w-full px-4 py-2 rounded-xl border focus:outline-none transition shadow-sm",
                fieldErrors.name
                  ? "border-red-400 ring-1 ring-red-200"
                  : "border-gray-200 focus:ring-2 focus:ring-indigo-300"
              )}
              placeholder="e.g. Alice Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading || lockoutSeconds > 0}
              autoComplete="name"
              maxLength={100}
            />
            {fieldErrors.name && (
              <p id="name-error" className="mt-1 text-xs text-red-600">
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Email prefix */}
          <div>
            <label htmlFor="emailPrefix" className="block font-medium mb-1">
              Bristol Email
            </label>
            <div className="flex rounded-xl overflow-hidden border transition shadow-sm">
              <div className="relative flex-1">
                <input
                  id="emailPrefix"
                  name="emailPrefix"
                  type="text"
                  aria-invalid={!!fieldErrors.emailPrefix}
                  aria-describedby={fieldErrors.emailPrefix ? "email-error" : undefined}
                  className={clsx(
                    "w-full px-4 py-2 outline-none",
                    fieldErrors.emailPrefix ? "border-red-400" : "border-transparent"
                  )}
                  placeholder="yourid"
                  value={emailPrefix}
                  onChange={(e) => setEmailPrefix(e.target.value)}
                  disabled={loading || lockoutSeconds > 0}
                  autoComplete="username"
                  maxLength={64}
                />
                {emailPrefix && !loading && (
                  <button
                    type="button"
                    aria-label="Clear prefix"
                    onClick={clearEmailPrefix}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="px-3 py-2 bg-indigo-600 text-white select-none text-sm font-medium flex items-center">
                @{EMAIL_DOMAIN}
              </div>
            </div>
            {fieldErrors.emailPrefix && (
              <p id="email-error" className="mt-1 text-xs text-red-600">
                {fieldErrors.emailPrefix}
              </p>
            )}
          </div>

          {/* Global error */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700"
            >
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            className={clsx(
              "w-full flex justify-center items-center gap-2 py-3 rounded-xl font-semibold transition shadow",
              !canSubmit
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-600 to-sky-500 text-white hover:scale-[1.02]"
            )}
          >
            {loading ? (
              <>
                <span className="loader-border inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Logging in…
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>

        <div className="text-xs text-center text-gray-500">
          Only approved Bristol reviewers may log in. Your session is kept for the duration of review.
        </div>
      </div>
    </div>
  );
}