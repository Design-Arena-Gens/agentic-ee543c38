 "use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LoginFormState {
  userCode: string;
  password: string;
}

export function LoginForm() {
  const router = useRouter();
  const [form, setForm] = useState<LoginFormState>({
    userCode: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Login gagal.");
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full space-y-5 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur"
    >
      <div>
        <label className="text-sm font-semibold text-white/80">
          ID PrivaT
        </label>
        <input
          name="userCode"
          type="text"
          placeholder="Contoh: PT-1A2B3C4D"
          value={form.userCode}
          onChange={handleChange}
          className="mt-2 w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white focus:border-indigo-400 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-white/80">
          Password
        </label>
        <input
          name="password"
          type="password"
          placeholder="Masukkan password"
          value={form.password}
          onChange={handleChange}
          className="mt-2 w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white focus:border-indigo-400 focus:outline-none"
          required
          minLength={6}
        />
      </div>
      {error ? (
        <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full items-center justify-center rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-500/40"
      >
        {isLoading ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}
