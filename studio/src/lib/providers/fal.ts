import { fal } from "@fal-ai/client";

let configured = false;
function ensureConfig() {
  if (configured) return;
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set");
  fal.config({ credentials: key });
  configured = true;
}

/** Submit a job to the fal queue and return its request id. */
export async function submitJob(model: string, input: Record<string, unknown>): Promise<string> {
  ensureConfig();
  const { request_id } = await fal.queue.submit(model, { input });
  return request_id;
}

export interface JobStatus {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | string;
  videoUrl?: string;
  error?: string;
}

function extractFalError(e: unknown): string {
  const err = e as { body?: { detail?: unknown; message?: string }; message?: string };
  const detail = err?.body?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const item = d as { loc?: unknown[]; msg?: string };
        const loc = Array.isArray(item?.loc) ? item.loc.join(".") : "";
        return [loc, item?.msg].filter(Boolean).join(": ");
      })
      .filter(Boolean)
      .join(" | ");
  }
  return err?.body?.message ?? err?.message ?? "Erreur inconnue";
}

/** Check a fal job; when completed, extract the output video URL. */
export async function checkJob(model: string, requestId: string): Promise<JobStatus> {
  ensureConfig();
  try {
    const status = await fal.queue.status(model, { requestId });
    if (status.status !== "COMPLETED") return { status: status.status };

    const result = await fal.queue.result(model, { requestId });
    const data = result.data as {
      video?: { url?: string };
      videos?: { url?: string }[];
    };
    const videoUrl = data.video?.url ?? data.videos?.[0]?.url;
    return { status: "COMPLETED", videoUrl };
  } catch (e) {
    // A failed job surfaces here (e.g. fal 422 validation on the model runner).
    console.error("[fal] job failed", model, requestId, JSON.stringify((e as { body?: unknown })?.body));
    return { status: "FAILED", error: extractFalError(e) };
  }
}

/** Upload a data URL (data:<mime>;base64,<...>) to fal storage and return a public URL. */
export async function uploadDataUrl(dataUrl: string, fallbackName = "file"): Promise<string> {
  ensureConfig();
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) {
    // Already a normal URL — return as-is.
    if (/^https?:\/\//.test(dataUrl)) return dataUrl;
    throw new Error("Unsupported data URL");
  }
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const ext = mime.split("/")[1] ?? "bin";
  const blob = new Blob([buffer], { type: mime });
  // The client accepts a Blob/File; name is derived from type when omitted.
  return fal.storage.upload(new File([blob], `${fallbackName}.${ext}`, { type: mime }));
}

/** Upload several data URLs / URLs, returning public URLs in order. */
export async function uploadMany(items: string[], prefix = "ref"): Promise<string[]> {
  return Promise.all(items.map((it, i) => uploadDataUrl(it, `${prefix}-${i}`)));
}

/**
 * Identity-preserving still image: place a character (from a face/reference URL)
 * into a scene described by `prompt`, keeping the same identity.
 * Uses PuLID Flux (best face fidelity, not moderated for our AI characters).
 */
export async function generateIdentityImage(
  referenceImageUrl: string,
  prompt: string,
  imageSize = "portrait_16_9",
): Promise<string> {
  ensureConfig();
  const result = await fal.subscribe("fal-ai/flux-pulid", {
    input: {
      prompt,
      reference_image_url: referenceImageUrl,
      id_weight: 1,
      image_size: imageSize as "portrait_16_9",
    },
  });
  const data = result.data as { images?: { url?: string }[] };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("Aucune image générée par le modèle d'identité");
  return url;
}

/** Upload raw bytes (e.g. an SDK asset read from disk) to fal storage. */
export async function uploadBuffer(buffer: Buffer, mime: string, name = "asset"): Promise<string> {
  ensureConfig();
  const ext = mime.split("/")[1] ?? "bin";
  const blob = new Blob([new Uint8Array(buffer)], { type: mime });
  return fal.storage.upload(new File([blob], `${name}.${ext}`, { type: mime }));
}
