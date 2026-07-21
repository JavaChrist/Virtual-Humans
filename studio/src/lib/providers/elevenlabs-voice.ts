export interface VoiceResult {
  dataUrl: string;
  mime: string;
}

/** Synthesize speech with ElevenLabs TTS. Returns an mp3 data URL. */
export async function generateVoice(opts: {
  text: string;
  voiceId?: string;
  modelId?: string;
}): Promise<VoiceResult> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");

  const voiceId = opts.voiceId || process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) throw new Error("No voice id (set ELEVENLABS_VOICE_ID or pass one)");

  const modelId = opts.modelId || "eleven_multilingual_v2";

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: opts.text,
        model_id: modelId,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`ElevenLabs error (${res.status}): ${detail.slice(0, 500)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return { dataUrl: `data:audio/mpeg;base64,${buf.toString("base64")}`, mime: "audio/mpeg" };
}
