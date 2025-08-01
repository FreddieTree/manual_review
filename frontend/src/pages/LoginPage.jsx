import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { loginReviewer } from "../api"; // 第2节有实现
import clsx from "clsx";
import Button from "../components/ui/Button";

const EMAIL_DOMAIN = "bristol.ac.uk";
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 2 * 60 * 1000;
const NAME_REGEX = /^[a-zA-Z\s\-'.]{2,100}$/;
const PREFIX_REGEX = /^[a-zA-Z0-9._%+-]{1,64}$/;

function useDebounce(value, delay = 150) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function HelpModal({ open, onClose, lockoutSeconds }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur px-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 flex flex-col gap-6  border-gray-200">
        <div className="flex justify-between items-start">
          <div id="help-title" className="text-lg font-bold text-gray-900">Need help?</div>
          <button aria-label="Close help" onClick={onClose}
            className="text-gray-400 hover:text-gray-700 ml-2 text-xl font-bold">×</button>
        </div>
        <div className="text-sm text-gray-700 space-y-2">
          {lockoutSeconds > 0 && (
            <div>You're temporarily locked out. Try again in <strong>{lockoutSeconds}s</strong>.</div>
          )}
          <div>If you believe this is a mistake, email the admin:</div>
          <a href="mailto:review-admin@bristol.ac.uk" className="text-indigo-600 underline break-all">
            review-admin@bristol.ac.uk
          </a>
          <div className="text-xs text-gray-500">Include your full name and attempted email for faster support.</div>
        </div>
        <Button fullWidth size="sm" variant="primary" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const nameRef = useRef(null);

  const [name, setName] = useState(() => sessionStorage.getItem("login_name") || "");
  const [emailPrefix, setEmailPrefix] = useState(() => sessionStorage.getItem("login_email_prefix") || "");
  const debouncedEmailPrefix = useDebounce(emailPrefix, 120);

  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [focusField, setFocusField] = useState(null);

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => sessionStorage.setItem("login_name", name), [name]);
  useEffect(() => sessionStorage.setItem("login_email_prefix", emailPrefix), [emailPrefix]);
  useEffect(() => {
    if (lockedUntil && Date.now() > lockedUntil) {
      setLockedUntil(0); setAttempts(0); setGlobalError("");
    }
  }, [lockedUntil]);

  const validate = useCallback(() => {
    const errs = {};
    if (!name.trim()) errs.name = "Full name is required.";
    else if (!NAME_REGEX.test(name.trim())) errs.name = "Invalid name.";
    if (!emailPrefix.trim()) errs.emailPrefix = "Email prefix is required.";
    else if (!PREFIX_REGEX.test(emailPrefix.trim())) errs.emailPrefix = "Invalid email prefix.";
    return errs;
  }, [name, emailPrefix]);

  useEffect(() => setFieldErrors(validate()), [name, debouncedEmailPrefix, validate]);

  const lockoutActive = lockedUntil > Date.now();
  const lockoutSeconds = lockoutActive ? Math.ceil((lockedUntil - Date.now()) / 1000) : 0;
  const canSubmit = useMemo(
    () => !loading && !lockoutActive && Object.keys(fieldErrors).length === 0,
    [fieldErrors, loading, lockoutActive]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");
    if (lockoutActive) {
      setGlobalError("Too many failed attempts. Please wait.");
      return;
    }
    const errs = validate();
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      setGlobalError("Please fix the highlighted fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await loginReviewer({
        name: name.trim(),
        email: `${emailPrefix.trim()}@${EMAIL_DOMAIN}`.toLowerCase(),
      });

      if (!res || typeof res !== "object") {
        setGlobalError("Server error: Unexpected response.");
        return;
      }
      if (!res.success) {
        setGlobalError(res?.message || "Login failed.");
        return;
      }

      // 成功：分流跳转
      const params = new URLSearchParams(location.search);
      const next = params.get("next");
      if (res.is_admin) navigate(next || "/admin", { replace: true });
      else if (res.no_more_tasks) navigate("/no_more_tasks", { replace: true });
      else navigate(next || "/review", { replace: true });

      setAttempts(0); setLockedUntil(0); sessionStorage.clear();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Network/server error. Please try again.";
      setGlobalError(msg);
      setAttempts((a) => a + 1);
      if (attempts + 1 >= MAX_ATTEMPTS) setLockedUntil(Date.now() + LOCKOUT_DURATION_MS);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && canSubmit) handleSubmit(e);
    if (e.key === "Escape" && helpOpen) setHelpOpen(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] via-[#eef3fb] to-[#e5ebfa] px-4">
      {/* WebKit autofill 颜色 */}
      <style>{`
        input:-webkit-autofill {
          box-shadow: 0 0 0 1000px #fff inset !important;
          -webkit-text-fill-color: #0f172a !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      {/* 容器：80vw，且不超过 36rem（约 576px） */}
      <div className="relative w-[80vw] max-w-[36rem] mx-auto z-10">
        {/* 背景柔光 */}
        <div className="pointer-events-none absolute -inset-6 -z-10">
          <div className="absolute -top-10 -left-16 w-56 h-40 rounded-full bg-indigo-100/60 blur-2xl" />
          <div className="absolute bottom-10 right-6 w-48 h-28 rounded-full bg-sky-100/50 blur-2xl" />
        </div>

        {/* 卡片外壳：不放padding，只放外观 */}
        <div
          className={clsx(
            "rounded-[1.5rem] bg-white/80 backdrop-blur-xl  border-white/70 shadow-2xl overflow-hidden",
            "ring-1 ring-black/5",
            "transition-all duration-300 hover:shadow-[0_18px_48px_rgba(43,93,215,0.16)]"
          )}
          style={{
            boxShadow:
              "0 14px 38px rgba(43,93,215,0.12), 0 2px 8px rgba(0,0,0,0.06), inset 0 0.5px 1.5px rgba(255,255,255,0.35)",
            background:
              "linear-gradient(135deg,rgba(255,255,255,0.96) 86%,rgba(242,246,255,0.92))",
          }}
        >
          {/* 卡片内层：真正的内边距与间距 */}
          <div className="p-10 sm:p-12 space-y-10">

            {/* 标题区：层级更清晰 */}
            <header className="text-center space-y-2">
              <h1 className="text-[28px]/8 sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Assertion review system
              </h1>
              <p className="text-[15px] text-slate-500">
                Sign in with Bristol email to continue reviewing.
              </p>
            </header>

            {/* 全局错误提示：与正文区分明显 */}
            {(lockoutActive || globalError) && (
              <div
                role="alert"
                aria-live="assertive"
                className={clsx(
                  "flex items-start gap-3 rounded-xl px-4 py-3",
                  "ring-1",
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
                      className="text-indigo-600 text-xs font-semibold underline underline-offset-2"
                    >
                      Help
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => { setLockedUntil(0); setAttempts(0); setGlobalError(""); }}
                    className="text-slate-400 hover:text-slate-700 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* 表单：字段间距更大，说明文字与错误提示风格化 */}
            <form
              onSubmit={handleSubmit}
              noValidate
              autoComplete="on"
              onKeyDown={onKeyDown}
              className="space-y-7"
            >
              {/* Full Name */}
              <div className="space-y-2">
                <label htmlFor="name" className="block text-[18px] font-bold text-slate-700">
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
                    "",
                    fieldErrors.name
                      ? "ring-rose-300 focus:ring-rose-400"
                      : "ring-slate-200 focus:ring-indigo-300",
                    "focus:outline-none transition-shadow"
                  )}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocusField("name")}
                  onBlur={() => setFocusField(null)}
                  disabled={loading || lockoutActive}
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                  autoComplete="name"
                />
                {/* 说明/错误分层：提示为灰、错误为红且更小更紧凑 */}
                {fieldErrors.name ? (
                  <p id="name-error" className="text-[12px] text-rose-600/90 font-medium">
                    {fieldErrors.name}
                  </p>
                ) : (
                  <p className="text-[12px] text-slate-400">
                    Use your real name as it appears in the reviewer list.
                  </p>
                )}
              </div>

              {/* Bristol Email */}
              <div className="space-y-2">
                <label htmlFor="emailPrefix" className="block text-[18px] font-bold text-slate-700">
                  Bristol Email
                </label>
                <div
                  className={clsx(
                    "flex items-stretch rounded-xl bg-white/95 overflow-hidden",
                    fieldErrors.emailPrefix
                      ? "ring-rose-300 focus-within:ring-rose-400"
                      : "ring-slate-200 focus-within:ring-indigo-300",
                    "transition-shadow"
                  )}
                >
                  <input
                    id="emailPrefix"
                    type="text"
                    placeholder="ab12345"
                    className={clsx(
                      "flex-1 px-4 py-3 text-[15px] font-medium bg-transparent outline-none",
                      "placeholder-slate-400"
                    )}
                    value={emailPrefix}
                    onChange={(e) => setEmailPrefix(e.target.value)}
                    onFocus={() => setFocusField("email")}
                    onBlur={() => setFocusField(null)}
                    disabled={loading || lockoutActive}
                    aria-invalid={!!fieldErrors.emailPrefix}
                    aria-describedby={fieldErrors.emailPrefix ? "email-error" : "email-hint"}
                    autoComplete="username"
                  />
                  <span className="flex items-center px-4 text-slate-500 font-mono text-[15px] select-none ">
                    @{EMAIL_DOMAIN}
                  </span>
                </div>
                {fieldErrors.emailPrefix ? (
                  <p id="email-error" className="text-[12px] text-rose-600/90 font-medium">
                    {fieldErrors.emailPrefix}
                  </p>
                ) : (
                  <p id="email-hint" className="text-[12px] text-slate-400">
                    Enter only the ID part before “@”. We’ll append the domain.
                  </p>
                )}
              </div>

              {/* 登录按钮 */}
              <div className="pt-2">
                <Button
                  type="submit"
                  fullWidth
                  size="xl"
                  loading={loading}
                  disabled={!canSubmit}
                  aria-label="Login"
                  className={clsx(
                    "rounded-xl font-semibold py-4 text-lg tracking-wide shadow-lg",
                    canSubmit
                      ? "bg-gradient-to-r from-indigo-500 to-sky-500 text-white hover:scale-[1.02] active:scale-[0.99]"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  )}
                  style={{
                    minHeight: "56px",
                    boxShadow:
                      "0 2px 18px rgba(99,102,241,0.12), 0 1.5px 7px rgba(0,0,0,0.05)",
                  }}
                >
                  {loading ? "Logging in…" : "Login"}
                </Button>
              </div>
            </form>

            {/* 页脚说明：更轻更小 */}
            <footer className="text-center">
              <p className="text-[12px] text-slate-500">
                Only approved Bristol reviewers may log in.
              </p>
              <p className="text-[12px] text-slate-400 mt-1">
                Your session is private and secure.
              </p>
            </footer>
          </div>
        </div>

        {/* 帮助弹窗 */}
        <HelpModal
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          lockoutSeconds={lockoutSeconds}
        />
      </div>
    </div>
  );
}