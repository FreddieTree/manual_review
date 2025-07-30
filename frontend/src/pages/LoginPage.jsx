import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginReviewer } from "../api";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.endsWith("@bristol.ac.uk")) {
      setError("Please enter your name and @bristol.ac.uk email.");
      return;
    }
    // 调API登录，后端会自动分配abstract或跳admin
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
      setError(err.message || "Login failed.");
    }
  };

  return (
    <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6 mt-16">
      <h1 className="text-2xl font-bold mb-6 text-center">Reviewer Login</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full border p-2 rounded"
          placeholder="Your Name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded"
          placeholder="Your @bristol.ac.uk Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          type="email"
          pattern=".+@bristol\.ac\.uk"
          required
        />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button
          className="w-full bg-blue-700 text-white rounded py-2 mt-2 hover:bg-blue-800 font-semibold"
          type="submit"
        >Login</button>
      </form>
    </div>
  );
}