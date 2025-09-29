export type AppVersion = { version: string; build?: string; commit?: string };

export async function getAppVersion(): Promise<AppVersion> {
  // fetch from /public: works in Next.js server/components; cache & revalidate as you like
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/version.json`, {
    // If you deploy behind a domain, omit BASE_URL and just fetch("/version.json") in a Client component
    // For Server Components, you can control caching:
    next: { revalidate: 60 }, // refresh once a minute
    cache: "force-cache",
  }).catch(() => null);

  if (!res || !res.ok) return { version: "dev" };
  const data = (await res.json()) as AppVersion;
  return { version: data.version ?? "dev", build: data.build, commit: data.commit };
}
