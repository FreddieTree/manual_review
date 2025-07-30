export async function loginReviewer(name, email) {
  const resp = await fetch("/api/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ name, email }),
  });
  if (resp.ok) return { ok: true };
  const data = await resp.json().catch(() => ({}));
  if (resp.status === 404 && data.noTask) return { noTask: true };
  return { ok: false, message: data.message };
}

// 其他 fetch 见后端 API