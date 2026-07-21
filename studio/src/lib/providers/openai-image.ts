import type { ImageQuality, ImageSize } from "@/lib/pricing";

export interface ImageResult {
  dataUrl: string;
  size: ImageSize;
  quality: ImageQuality;
}

/** Generate an image with OpenAI's gpt-image-1 model. Returns a data URL. */
export async function generateImage(opts: {
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
}): Promise<ImageResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: opts.prompt,
      size: opts.size,
      quality: opts.quality,
      n: 1,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI image error (${res.status}): ${detail.slice(0, 500)}`);
  }

  const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  const item = json.data?.[0];
  if (item?.b64_json) {
    return { dataUrl: `data:image/png;base64,${item.b64_json}`, size: opts.size, quality: opts.quality };
  }
  if (item?.url) {
    return { dataUrl: item.url, size: opts.size, quality: opts.quality };
  }
  throw new Error("OpenAI image error: empty response");
}
