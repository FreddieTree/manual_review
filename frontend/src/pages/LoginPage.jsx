import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { loginReviewer } from "../api";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [emailPrefix, setEmailPrefix] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const nameRef = useRef(null);

  // 聚焦第一个输入框
  // useEffect(() => { nameRef.current?.focus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const email = `${emailPrefix}@bristol.ac.uk`;
    // 严格校验 name 只允许正常字符
    if (!name.trim() || !/^[a-zA-Z0-9\s\-'.]+$/.test(name)) {
      setError("Please enter your real name (letters only).");
      setLoading(false);
      return;
    }
    if (!/^[a-zA-Z0-9._%+-]+$/.test(emailPrefix)) {
      setError("Email prefix can only contain letters, digits or . _ % + -");
      setLoading(false);
      return;
    }
    try {
      const res = await loginReviewer({ name, email });
      if (res.is_admin) {
        navigate("/admin");
      } else if (res.no_more_tasks) {
        navigate("/no_more_tasks");
      } else {
        navigate("/review");
      }
    } catch (err) {
      setError(err?.message || "Login failed, please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[60vh] flex flex-col justify-center items-center px-3">
      <div className="w-full max-w-md bg-white/80 rounded-2xl shadow-2xl px-8 py-9 border border-gray-100">
        <h1 className="text-2xl sm:text-3xl font-bold mb-8 text-center text-blue-900 drop-shadow-sm">
          <span className="inline-block align-middle mr-2">🔒</span>
          Reviewer Login
        </h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-gray-600 font-medium mb-1">
              Name
            </label>
            <input
              ref={nameRef}
              id="name"
              className="w-full border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-base transition"
              placeholder="Your Name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="username"
              maxLength={40}
            />
          </div>
          <div>
            <label htmlFor="emailPrefix" className="block text-gray-600 font-medium mb-1">
              Email
            </label>
            <div className="flex items-center rounded-lg overflow-hidden border bg-gray-50">
              <input
                id="emailPrefix"
                className="flex-1 bg-transparent border-none px-3 py-2 focus:ring-0 focus:outline-none text-base"
                placeholder="Email prefix"
                value={emailPrefix}
                onChange={e => setEmailPrefix(e.target.value)}
                pattern="^[a-zA-Z0-9._%+-]+$"
                autoComplete="username"
                required
                maxLength={32}
                aria-label="Bristol email prefix"
              />
              <span className="bg-gray-100 text-gray-500 px-2 text-sm font-mono"> @bristol.ac.uk </span>
            </div>
          </div>
          {error &&
            <div className="bg-red-50 border border-red-200 text-red-700 py-2 px-3 rounded text-center text-sm animate-pulse">
              {error}
            </div>
          }
          <button
            className={`w-full py-2 rounded-lg font-semibold text-white text-base shadow transition
              ${loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-700 hover:bg-blue-800 active:bg-blue-900"
              }`}
            type="submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <div className="mt-7 text-gray-400 text-xs text-center">
          For authorized reviewers only. All operations are logged.
        </div>
      </div>
    </div>
  );
}