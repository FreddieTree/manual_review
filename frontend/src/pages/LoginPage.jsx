import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginReviewer } from "../api";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [emailPrefix, setEmailPrefix] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const email = `${emailPrefix}@bristol.ac.uk`;
    if (!name.trim() || !/^[a-zA-Z\s\-'.]+$/.test(name)) {
      setError("Please enter a valid name.");
      setLoading(false);
      return;
    }
    if (!/^[a-zA-Z0-9._%+-]+$/.test(emailPrefix)) {
      setError("Invalid email prefix.");
      setLoading(false);
      return;
    }

    try {
      const res = await loginReviewer({ name, email });
      navigate(res.is_admin ? "/admin" : res.no_more_tasks ? "/no_more_tasks" : "/review");
    } catch (err) {
      setError(err.message || "Login failed, try again.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-tr from-blue-50 via-blue-100 to-indigo-100 px-4">
      <div className="bg-white shadow-card rounded-3xl p-10 w-full max-w-sm animate-fadeIn">
        <h2 className="text-3xl font-semibold text-primary text-center mb-6">
          Reviewer Login
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block mb-1 font-medium text-gray-600">Name</label>
            <input
              ref={nameRef}
              className="w-full px-4 py-2 rounded-xl shadow-input border focus:ring-primary focus:border-primary transition"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-gray-600">Bristol Email</label>
            <div className="flex items-center rounded-xl shadow-input overflow-hidden">
              <input
                className="flex-1 px-4 py-2 border-none focus:ring-0"
                placeholder="Email prefix"
                value={emailPrefix}
                onChange={e => setEmailPrefix(e.target.value)}
                required
              />
              <span className="px-3 py-2 bg-primary-light text-white">@bristol.ac.uk</span>
            </div>
          </div>
          {error && <div className="text-red-600 text-sm text-center">{error}</div>}
          <button
            className={`w-full py-2.5 rounded-xl shadow-btn font-semibold transition ${loading ? "bg-gray-300" : "bg-primary hover:bg-primary-dark text-white"
              }`}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <p className="mt-4 text-xs text-center text-gray-500">Authorized access only.</p>
      </div>
    </div>
  );
}