import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-white">
      <div className="flex w-full max-w-5xl flex-col gap-12 lg:flex-row">
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="text-4xl font-semibold leading-tight">
            Selamat datang di PrivaT
          </h1>
          <p className="mt-4 max-w-md text-sm text-white/70">
            Masuk menggunakan ID unik Anda untuk melanjutkan percakapan pribadi,
            memantau grup, dan menikmati panggilan suara/video peer-to-peer.
          </p>
          <div className="mt-8 text-sm text-white/60">
            Belum punya akun?{" "}
            <Link
              href="/auth/register"
              className="font-semibold text-indigo-300 hover:text-indigo-200"
            >
              Daftar sekarang
            </Link>
          </div>
        </div>
        <div className="flex-1">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
