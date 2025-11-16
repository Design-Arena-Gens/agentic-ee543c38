 "use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RegisterState {
  name: string;
  password: string;
  confirm: string;
}

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterState>({
    name: "",
    password: "",
    confirm: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (form.password !== form.confirm) {
      setError("Konfirmasi password tidak cocok.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          password: form.password,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Registrasi gagal.");
      }

      const data = await response.json();
      const newCode = data?.user?.userCode;
      setSuccess(
        newCode
          ? `Registrasi berhasil! ID PrivaT Anda: ${newCode}`
          : "Registrasi berhasil! Mengalihkan ke dashboard...",
      );

      setTimeout(() => {
        router.replace("/dashboard");
        router.refresh();
      }, 1500);
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
          Nama Lengkap
        </label>
        <input
          name="name"
          type="text"
          placeholder="Masukkan nama Anda"
          value={form.name}
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
          placeholder="Minimal 6 karakter"
          value={form.password}
          onChange={handleChange}
          className="mt-2 w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white focus:border-indigo-400 focus:outline-none"
          required
          minLength={6}
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-white/80">
          Konfirmasi Password
        </label>
        <input
          name="confirm"
          type="password"
          placeholder="Ulangi password"
          value={form.confirm}
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
      {success ? (
        <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full items-center justify-center rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-500/40"
      >
        {isLoading ? "Memproses..." : "Daftar"}
      </button>
    </form>
  );
}
