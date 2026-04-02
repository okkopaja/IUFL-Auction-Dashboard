import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-pitch-950 p-6">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900/20 blur-[120px] rounded-full pointer-events-none" />

      <SignIn
        fallbackRedirectUrl="/v1/private/dashboard"
        appearance={{
          elements: {
            rootBox: "z-10",
            cardBox: "shadow-2xl border border-slate-800",
          },
        }}
      />
    </div>
  );
}
