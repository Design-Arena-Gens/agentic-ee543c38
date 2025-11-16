import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

const features = [
  {
    title: "Autentikasi Aman",
    description:
      "Gunakan ID unik dan password terenkripsi untuk masuk ke ruang obrolan pribadi.",
  },
  {
    title: "Chat & Grup",
    description:
      "Kirim pesan 1-on-1, buat grup dengan ID khusus, dan bagikan gambar atau dokumen.",
  },
  {
    title: "Panggilan P2P",
    description:
      "Nikmati panggilan suara dan video peer-to-peer dengan teknologi WebRTC.",
  },
  {
    title: "Panel Admin",
    description:
      "Kelola pengguna, grup, dan laporan demi menjaga komunitas tetap aman.",
  },
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.35),_transparent)] blur-3xl" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 pt-24 text-center sm:items-start sm:text-left">
          <div className="rounded-full border border-white/20 px-4 py-1 text-sm uppercase tracking-[0.2em] text-white/70">
            PrivaT
          </div>
          <h1 className="mt-6 text-balance text-4xl font-semibold leading-tight sm:text-6xl">
            Chatting pribadi seaman berbicara langsung.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/70 sm:text-xl">
            Kelola percakapan pribadi, grup, dan panggilan video dari satu
            dashboard. Semua terenkripsi, realtime, dan mudah dikendalikan oleh
            Anda.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/auth/register"
              className="flex items-center justify-center rounded-full bg-indigo-500 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-600"
            >
              Buat Akun PrivaT
            </Link>
            <Link
              href="/auth/login"
              className="flex items-center justify-center rounded-full border border-white/30 px-8 py-3 text-base font-semibold text-white/80 transition hover:bg-white/10"
            >
              Masuk dengan ID
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur"
            >
              <h3 className="text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm text-white/70">{feature.description}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t border-white/10 py-10 text-center text-xs text-white/40">
        © {new Date().getFullYear()} PrivaT. Semua hak dilindungi.
      </footer>
    </div>
  );
}
