import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AUTH_COOKIE, gateEnabled, verifySession } from "@/lib/auth";

export const metadata = { title: "Silly Goose Mutual — sign in" };
export const dynamic = "force-dynamic";

export default async function PasswordGate({
  searchParams,
}: {
  searchParams: { next?: string; wrong?: string; rate?: string; nogate?: string };
}) {
  // Synthetic demo content — not an insurance contract or coverage advice.
  if (gateEnabled() && (await verifySession(cookies().get(AUTH_COOKIE)?.value))) {
    redirect(searchParams.next ?? "/");
  }
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">Silly Goose Mutual</h1>
      <p className="text-sm text-neutral-500">Enter the demo password to continue.</p>
      <form action="/api/pw" method="post" className="flex w-full gap-2">
        <input type="hidden" name="next" value={searchParams.next ?? "/"} />
        <input
          type="password"
          name="password"
          autoFocus
          required
          placeholder="Password"
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white">
          Unlock
        </button>
      </form>
      {searchParams.wrong ? <p className="text-sm text-red-600">Wrong password — try again.</p> : null}
      {searchParams.rate ? <p className="text-sm text-red-600">Too many attempts — wait a few minutes.</p> : null}
      {searchParams.nogate ? <p className="text-sm text-amber-600">Access is required — ask the administrator for the demo password.</p> : null}
      <p className="text-xs text-neutral-400">Synthetic demo content — not an insurance contract or coverage advice.</p>
    </main>
  );
}
