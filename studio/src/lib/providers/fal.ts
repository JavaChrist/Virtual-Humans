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
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | string;
  videoUrl?: string;
}

/** Check a fal job; when completed, extract the output video URL. */
export async function checkJob(model: string, requestId: string): Promise<JobStatus> {
  ensureConfig();
  const status = await fal.queue.status(model, { requestId });
  if (status.status !== "COMPLETED") return { status: status.status };

  const result = await fal.queue.result(model, { requestId });
  const data = result.data as {
    video?: { url?: string };
    videos?: { url?: string }[];
  };
  const videoUrl = data.video?.url ?? data.videos?.[0]?.url;
  return { status: "COMPLETED", videoUrl };
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
