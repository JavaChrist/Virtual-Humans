/**
 * Gate for VHS-115 local Supabase validation.
 * Exits 0 only when Docker (or Podman) is available for `supabase start`.
 * Never contacts a remote Supabase project.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

// Ensure Docker Desktop user install is visible even if the shell PATH is stale.
const dockerUserBin = join(
  process.env.LOCALAPPDATA ?? "",
  "Programs",
  "DockerDesktop",
  "resources",
  "bin"
);
if (existsSync(join(dockerUserBin, "docker.exe"))) {
  process.env.PATH = `${dockerUserBin}${delimiter}${process.env.PATH ?? ""}`;
}

function hasCmd(cmd, args = ["--version"]) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: true });
  return r.status === 0;
}

const docker = hasCmd("docker", ["version", "--format", "{{.Server.Version}}"]);
const podman = !docker && hasCmd("podman", ["version"]);

if (!docker && !podman) {
  console.error(`
VHS-115 bloqué par prérequis local

Prérequis manquants :
  - Docker Desktop (ou Podman) introuvable sur PATH
  - Sans moteur de conteneurs, supabase start / db reset / test db sont impossibles

Disponible :
  - npx supabase (CLI via npx) — version typique 2.111.x
  - Ports locaux configurés dans supabase/config.toml (API 54921 / DB 54922 — hors plages Hyper-V)

Actions autorisées pour débloquer (à faire par un humain) :
  1. Installer Docker Desktop pour Windows (+ WSL2 si requis)
  2. Redémarrer le shell pour que docker soit sur PATH
  3. Depuis studio/ :
       npx supabase start
       npx supabase db reset
       npx supabase test db
       npm run test:integration:db

Interdit dans cet incrément :
  supabase link / db push / migration up --linked / db remote commit
`);
  process.exit(1);
}

console.log(
  `Local container engine OK (${docker ? "docker" : "podman"}). Proceed with supabase start.`
);
process.exit(0);
