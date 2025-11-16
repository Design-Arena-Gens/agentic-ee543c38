import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/RegisterForm";
import { getCurrentUser } from "@/lib/auth";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-white">
      <div className="flex w-full max-w-5xl flex-col gap-12 lg:flex-row">
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="text-4xl font-semibold leading-tight">
            Buat Akun PrivaT
          </h1>
          <p className="mt-4 max-w-md text-sm text-white/70">
            Dapatkan ID unik dan mulai berkomunikasi dengan aman. Anda bisa
            menambahkan teman, membuat grup, serta melakukan panggilan suara
            maupun video.
          </p>
          <div className="mt-8 text-sm text-white/60">
            Sudah punya akun?{" "}
            <Link
              href="/auth/login"
              className="font-semibold text-indigo-300 hover:text-indigo-200"
            >
              Masuk di sini
            </Link>
          </div>
        </div>
        <div className="flex-1">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
