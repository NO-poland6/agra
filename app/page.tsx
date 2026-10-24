import { Suspense } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { EtykietyApp } from "@/components/etykiety-app";

async function ModuleApp({ searchParams }: PageProps<"/">) {
  const query = await searchParams;
  const [bold, display] = await Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/SourceSans3-Bold.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/Fraunces-SemiBold.ttf")),
  ]);
  return (
    <EtykietyApp
      initialModule={query.modul === "cena" ? "cena" : "etykiety"}
      priceFonts={{
        bold: bold.toString("base64"),
        display: display.toString("base64"),
      }}
    />
  );
}

export default function Home(props: PageProps<"/">) {
  return (
    <Suspense
      fallback={<p className="p-6 text-muted-foreground">Wczytywanie…</p>}
    >
      <ModuleApp {...props} />
    </Suspense>
  );
}
