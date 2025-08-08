import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  memo,
} from "react";
import PropTypes from "prop-types";
import { useNavigate, useLocation } from "react-router-dom";
import clsx from "clsx";
import Button from "../components/ui/Button";
import { loginReviewer } from "../api/auth";
import { useDebouncedValue } from "../hooks/useDebounce";
import Card from "../components/ui/Card";
import Section from "../components/ui/Section";

const EMAIL_DOMAIN = import.meta.env.VITE_EMAIL_DOMAIN || "bristol.ac.uk";
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const NAME_REGEX = /^[a-zA-Z\s\-'.]{2,100}$/;
const PREFIX_REGEX = /^[a-zA-Z0-9._%+-]{1,64}$/;

function HelpModal({ open, onClose, lockoutSeconds }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur px-4"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <Card className="max-w-sm w-full p-8 flex flex-col gap-6">
        <div className="flex justify-between items-start">
          <div id="help-title" className="text-lg font-bold text-gray-900">
            Need help?
          </div>
          <button
            type="button"
            aria-label="Close help"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 ml-2 text-xl font-bold"
          >
            ×
          </button>
        </div>
        <div className="text-sm text-gray-700 space-y-2">
          {lockoutSeconds > 0 && (
            <div>
              You're temporarily locked out. Try again in <strong>{lockoutSeconds}s</strong>.
            </div>
          )}
          <div>If you believe this is a mistake, email the admin:</div>
          <a
            href="mailto:review-admin@bristol.ac.uk"
            className="text-indigo-600 underline break-all"
          >
            review-admin@bristol.ac.uk
          </a>
          <div className="text-xs text-gray-500">
            Include your full name and attempted email for faster support.
          </div>
        </div>
        <Button fullWidth size="sm" variant="primary" onClick={onClose}>
          Close
        </Button>
      </Card>
    </div>
  );
}

function LoginPageImpl(_, ref) {
  const location = useLocation();
  const navigate = useNavigate();
  const nameRef = useRef(null);

  const [name, setName] = useState(() => sessionStorage.getItem("login_name") || "");
  const [emailPrefix, setEmailPrefix] = useState(
    () => sessionStorage.getItem("login_email_prefix") || ""
  );
  const debouncedEmailPrefix = useDebouncedValue(emailPrefix, 120);

  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({ name: false, emailPrefix: false });
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  const [tick, setTick] = useState(Date.now());
  const lockoutActive = lockedUntil > tick;
  const lockoutSeconds = lockoutActive ? Math.ceil((lockedUntil - tick) / 1000) : 0;

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => sessionStorage.setItem("login_name", name), [name]);
  useEffect(() => sessionStorage.setItem("login_email_prefix", emailPrefix), [emailPrefix]);

  useEffect(() => {
    if (lockoutActive) {
      const iv = setInterval(() => setTick(Date.now()), 1000);
      return () => clearInterval(iv);
    }
  }, [lockoutActive]);

  useEffect(() => {
    if (lockedUntil && tick > lockedUntil) {
      setLockedUntil(0);
      setAttempts(0);
      setGlobalError("");
    }
  }, [tick, lockedUntil]);

  const validateFields = useCallback(() => {
    const errs = {};
    if (!name.trim()) errs.name = "Full name is required.";
    else if (!NAME_REGEX.test(name.trim())) errs.name = "Invalid name.";
    if (!emailPrefix.trim()) errs.emailPrefix = "Email prefix is required.";
    else if (!PREFIX_REGEX.test(emailPrefix.trim())) errs.emailPrefix = "Invalid email prefix.";
    return errs;
  }, [name, emailPrefix]);

  useEffect(() => {
    const errs = validateFields();
    // only surface errors for touched fields
    setFieldErrors(
      Object.fromEntries(
        Object.entries(errs).filter(([k]) => touched[k])
      )
    );
  }, [name, debouncedEmailPrefix, touched, validateFields]);

  const showNameError = touched.name && !!validateFields().name;
  const showEmailError = touched.emailPrefix && !!validateFields().emailPrefix;

  const canSubmit = !loading && !lockoutActive && Object.keys(validateFields()).length === 0;

  const noteFailedAttempt = useCallback(() => {
    setAttempts((prev) => {
      const next = prev + 1;
      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_DURATION_MS);
      }
      return next;
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setGlobalError("");
    setTouched({ name: true, emailPrefix: true });

    if (lockoutActive) {
      setGlobalError("Too many failed attempts. Please wait.");
      return;
    }

    const errs = validateFields();
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      setGlobalError("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    try {
      const email = `${emailPrefix.trim()}@${EMAIL_DOMAIN}`.toLowerCase();
      const res = await loginReviewer(
        {
          name: name.trim(),
          email,
        },
        {}
      );

      if (!res || typeof res !== "object") {
        setGlobalError("Server error: Unexpected response.");
        noteFailedAttempt();
        return;
      }

      if (!res.success) {
        setGlobalError(res.message || "Login failed.");
        noteFailedAttempt();
        return;
      }

      // Success: reset state
      setAttempts(0);
      setLockedUntil(0);
      sessionStorage.removeItem("login_name");
      sessionStorage.removeItem("login_email_prefix");

      const params = new URLSearchParams(location.search);
      const next = params.get("next");

      if (res.is_admin) {
        navigate(next || "/admin", { replace: true });
      } else if (res.no_more_tasks) {
        navigate("/no_more_tasks", { replace: true });
      } else {
        navigate(next || "/review", { replace: true });
      }
    } catch (err) {
      const status = err?.status ?? err?.response?.status;
      // Respect server rate-limit signal
      if (status === 429) {
        const retryAfter = Number(err?.response?.data?.retry_after || err?.response?.headers?.["retry-after"] || 0);
        if (retryAfter > 0) {
          setLockedUntil(Date.now() + retryAfter * 1000);
          setGlobalError("Too many failed attempts. Please wait.");
        } else {
          noteFailedAttempt();
          setGlobalError(err?.message || "Temporarily rate limited.");
        }
      } else {
        const msg = err?.response?.data?.message || err?.message || "Network/server error. Please try again.";
        setGlobalError(msg);
        noteFailedAttempt();
      }
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && canSubmit) handleSubmit(e);
    if (e.key === "Escape" && helpOpen) setHelpOpen(false);
  };

  return (
    <div
      ref={ref}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] via-[#eef3fb] to-[#e5ebfa] px-4"
    >
      <style>{`
        input:-webkit-autofill {
          box-shadow: 0 0 0 1000px #fff inset !important;
          -webkit-text-fill-color: #0f172a !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      <div className="relative w-full max-w-[36rem] mx-auto z-10">
        <Card className="p-10 sm:p-12 space-y-10">
          <Section
            title="Assertion Review System"
            description="Sign in with your Bristol email to continue reviewing."
          >
            <div className="hidden" />
          </Section>

            {(lockoutActive || globalError) && (
              <div
                role="alert"
                aria-live="assertive"
                className={clsx(
                  "flex items-start gap-3 rounded-xl px-4 py-3 ring-1",
                  lockoutActive
                    ? "bg-amber-50 text-amber-900 ring-amber-200"
                    : "bg-rose-50 text-rose-800 ring-rose-200"
                )}
              >
                <div className="flex-1 text-[14px]">
                  {lockoutActive ? (
                    <>Too many failed attempts. Try again in <strong>{lockoutSeconds}s</strong>.</>
                  ) : (
                    <>{globalError}</>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {lockoutActive && (
                    <button
                      type="button"
                      onClick={() => setHelpOpen(true)}
                      className="text-indigo-600 text-xs font-semibold underline"
                    >
                      Help
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => {
                      setLockedUntil(0);
                      setAttempts(0);
                      setGlobalError("");
                    }}
                    className="text-slate-400 hover:text-slate-700 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              noValidate
              autoComplete="on"
              onKeyDown={onKeyDown}
              className="space-y-7"
            >
              {/* Full Name */}
              <div className="space-y-2">
                <label
                  htmlFor="name"
                  className="block text-[18px] font-bold text-slate-700"
                >
                  Full Name
                </label>
                <input
                  id="name"
                  ref={nameRef}
                  type="text"
                  placeholder="Freddie"
                  className={clsx(
                    "w-full rounded-xl px-4 py-3 text-[15px] font-medium",
                    "bg-white/95 placeholder-slate-400",
                    showNameError
                      ? "ring-2 ring-rose-300 focus:ring-rose-400"
                      : "ring ring-slate-200 focus:ring-2 focus:ring-indigo-300",
                    "focus:outline-none transition-shadow"
                  )}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                  disabled={loading || lockoutActive}
                  aria-invalid={!!validateFields().name}
                  aria-describedby={showNameError ? "name-error" : undefined}
                  autoComplete="name"
                />
                {showNameError ? (
                  <p
                    id="name-error"
                    className="text-[12px] text-rose-600/90 font-medium"
                  >
                    {validateFields().name}
                  </p>
                ) : (
                  <p className="text-[12px] text-slate-400">
                    Use your real name as it appears in the reviewer list.
                  </p>
                )}
              </div>

              {/* Bristol Email */}
              <div className="space-y-2">
                <label
                  htmlFor="emailPrefix"
                  className="block text-[18px] font-bold text-slate-700"
                >
                  Bristol Email
                </label>
                <div
                  className={clsx(
                    "flex items-stretch rounded-xl bg-white/95 overflow-hidden",
                    showEmailError
                      ? "ring-2 ring-rose-300 focus-within:ring-rose-400"
                      : "ring ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-300",
                    "transition-shadow"
                  )}
                >
                  <input
                    id="emailPrefix"
                    type="text"
                    placeholder="ab12345"
                    className="flex-1 px-4 py-3 text-[15px] font-medium bg-transparent placeholder-slate-400 outline-none"
                    value={emailPrefix}
                    onChange={(e) => setEmailPrefix(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, emailPrefix: true }))}
                    disabled={loading || lockoutActive}
                    aria-invalid={!!validateFields().emailPrefix}
                    aria-describedby={showEmailError ? "email-error" : "email-hint"}
                    autoComplete="username"
                  />
                  <span className="flex items-center px-4 text-slate-500 font-mono text-[15px] select-none">
                    @{EMAIL_DOMAIN}
                  </span>
                </div>
                {showEmailError ? (
                  <p
                    id="email-error"
                    className="text-[12px] text-rose-600/90 font-medium"
                  >
                    {validateFields().emailPrefix}
                  </p>
                ) : (
                  <p id="email-hint" className="text-[12px] text-slate-400">
                    Enter only the ID part before “@”. We’ll append the domain.
                  </p>
                )}
              </div>

              {/* Submit */}
              <div className="pt-2">
                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  variant="primary"
                  loading={loading}
                  disabled={!canSubmit}
                  aria-label="Login"
                  spinnerPosition="start"
                  className="rounded-xl font-semibold text-lg tracking-wide"
                  style={{ minHeight: 56 }}
                >
                  {lockoutActive
                    ? `Try again in ${lockoutSeconds}s`
                    : loading
                      ? "Logging in…"
                      : "Login"}
                </Button>
              </div>
            </form>

            <footer className="text-center">
              <p className="text-[12px] text-slate-500">
                Only approved Bristol reviewers may log in.
              </p>
              <p className="text-[12px] text-slate-400 mt-1">
                Your session is private and secure.
              </p>
            </footer>
        </Card>

        <HelpModal
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          lockoutSeconds={lockoutSeconds}
        />
      </div>
    </div>
  );
}

if (process.env.NODE_ENV !== "production") {
  LoginPageImpl.propTypes = {};
}

export default memo(forwardRef(LoginPageImpl));