import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Class Portal</h1>
      <Link href="/login" className="text-sm underline underline-offset-4">
        Sign in
      </Link>
    </main>
  );
}
