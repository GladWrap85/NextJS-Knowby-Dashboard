"use client";

import { useEffect, useState } from "react";

type AppVersion = { version: string; build?: string; commit?: string };

export default function VersionPill() {
  const [v, setV] = useState<AppVersion | null>(null);

  useEffect(() => {
    // client-side keeps working even if BASE_URL isn't set
    fetch("/version.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setV(d ?? { version: "dev" }))
      .catch(() => setV({ version: "dev" }));
  }, []);

  if (!v) return null;

  const title =
    `Version ${v.version}` +
    (v.build ? ` • built ${new Date(v.build).toLocaleString()}` : "") +
    (v.commit ? ` • ${v.commit.slice(0, 7)}` : "");

  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-muted-foreground">
      <span className="tabular-nums">{v.version}</span>
    </span>
  );
}
