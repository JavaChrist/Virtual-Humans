import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// Téléchargement + upload d'un clip (jusqu'à 50 Mo) : on laisse du temps.
export const maxDuration = 120;

/**
 * Envoi d'un clip généré vers AI Command Center OS (Médiathèque).
 *
 * Flux en trois temps, côté serveur pour ne jamais exposer le jeton :
 * 1. POST {AICCOS_URL}/api/clips/import        → URL d'upload signée Supabase
 * 2. PUT  {signedUrl}                          → binaire de la vidéo
 * 3. POST {AICCOS_URL}/api/clips/import/complete → clip enregistré en Médiathèque
 */

const MAX_BYTES = 50 * 1024 * 1024; // limite AICCOS (plan Supabase)

interface SendBody {
  videoUrl?: unknown;
  title?: unknown;
  productSlug?: unknown;
}

function fileNameFromUrl(videoUrl: string): string {
  try {
    const last = new URL(videoUrl).pathname.split("/").pop() ?? "";
    if (/\.(mp4|webm|mov)$/i.test(last)) return last;
  } catch {
    // URL invalide déjà rejetée plus haut — on retombe sur un nom générique.
  }
  return `clip-${Date.now()}.mp4`;
}

export async function POST(req: NextRequest) {
  const aiccosUrl = (process.env.AICCOS_URL ?? "https://aicommandcenteros.app").replace(/\/+$/, "");
  const importToken = process.env.AICCOS_IMPORT_TOKEN;

  if (!importToken) {
    return NextResponse.json(
      { error: "AICCOS_IMPORT_TOKEN manquant dans .env.local — impossible d'envoyer vers AICCOS." },
      { status: 500 },
    );
  }

  let body: SendBody;
  try {
    body = (await req.json()) as SendBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const productSlug =
    typeof body.productSlug === "string" && body.productSlug.trim() ? body.productSlug.trim() : null;

  if (!videoUrl || !/^https?:\/\//i.test(videoUrl)) {
    return NextResponse.json({ error: "URL de vidéo invalide." }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "Un titre est requis." }, { status: 400 });
  }

  // 0. Récupération de la vidéo générée (URL fal.ai ou équivalente).
  const download = await fetch(videoUrl);
  if (!download.ok) {
    return NextResponse.json(
      { error: `Téléchargement de la vidéo impossible (${download.status}).` },
      { status: 502 },
    );
  }
  const buffer = await download.arrayBuffer();
  const mimeType = download.headers.get("content-type")?.split(";")[0] || "video/mp4";
  const sizeBytes = buffer.byteLength;

  if (sizeBytes === 0) {
    return NextResponse.json({ error: "La vidéo téléchargée est vide." }, { status: 502 });
  }
  if (sizeBytes > MAX_BYTES) {
    return NextResponse.json(
      { error: `Vidéo trop lourde pour AICCOS : ${(sizeBytes / 1024 / 1024).toFixed(1)} Mo (max 50 Mo).` },
      { status: 400 },
    );
  }

  const authHeaders = {
    Authorization: `Bearer ${importToken}`,
    "Content-Type": "application/json",
  };

  // 1. Préparation de l'upload signé côté AICCOS.
  const prepareRes = await fetch(`${aiccosUrl}/api/clips/import`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      fileName: fileNameFromUrl(videoUrl),
      mimeType,
      sizeBytes,
      productSlug,
    }),
  });
  const prepare = (await prepareRes.json().catch(() => ({}))) as {
    error?: string;
    path?: string;
    signedUrl?: string;
  };
  if (!prepareRes.ok || !prepare.path || !prepare.signedUrl) {
    return NextResponse.json(
      { error: prepare.error ?? `AICCOS a refusé la préparation (${prepareRes.status}).` },
      { status: 502 },
    );
  }

  // 2. Upload direct du binaire vers Supabase Storage (URL signée).
  const uploadRes = await fetch(prepare.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType, "x-upsert": "true" },
    body: buffer,
  });
  if (!uploadRes.ok) {
    const detail = await uploadRes.text().catch(() => "");
    return NextResponse.json(
      { error: `L'upload du clip a échoué (${uploadRes.status}). ${detail.slice(0, 200)}` },
      { status: 502 },
    );
  }

  // 3. Enregistrement du clip dans la Médiathèque AICCOS.
  const completeRes = await fetch(`${aiccosUrl}/api/clips/import/complete`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      filePath: prepare.path,
      mimeType,
      sizeBytes,
      title,
      productSlug,
    }),
  });
  const complete = (await completeRes.json().catch(() => ({}))) as {
    clip?: { id: string; publicUrl: string; title: string };
    error?: string;
  };
  if (!completeRes.ok || !complete.clip) {
    return NextResponse.json(
      { error: complete.error ?? `AICCOS a refusé l'enregistrement (${completeRes.status}).` },
      { status: 502 },
    );
  }

  return NextResponse.json({ clip: complete.clip });
}
