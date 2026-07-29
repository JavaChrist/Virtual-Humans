import { hasSupabase, supabase, PRODUCT_SCREENS_BUCKET } from "@/lib/supabase";

/**
 * Products (apps to promote) — global library shared across characters.
 * Backed by Supabase: metadata in table `vh_products`, screenshots in the
 * private Storage bucket `product-screens` under `<productId>/<filename>`.
 */

export interface Product {
  id: string;
  name: string;
  pitch?: string;
  color?: string;
  url?: string;
  screens: string[]; // file names stored under product-screens/<id>/
}

interface ProductRow {
  id: string;
  name: string;
  pitch: string | null;
  color: string | null;
  url: string | null;
}

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export function safeId(input: string): string {
  return input.replace(/[^a-z0-9_-]/gi, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "app";
}

/** List screenshot file names stored for a product. */
async function listScreens(productId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase().storage.from(PRODUCT_SCREENS_BUCKET).list(productId, {
      limit: 100,
      sortBy: { column: "name", order: "asc" },
    });
    if (error || !data) return [];
    return data
      .filter((o) => IMAGE_EXT.has((o.name.split(".").pop() ?? "").toLowerCase()))
      .map((o) => o.name);
  } catch {
    return [];
  }
}

export async function listProducts(): Promise<Product[]> {
  if (!hasSupabase()) return [];
  try {
    const { data, error } = await supabase()
      .from("vh_products")
      .select("id, name, pitch, color, url")
      .order("name", { ascending: true });
    if (error) throw error;
    const rows = (data as ProductRow[]) ?? [];
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        name: r.name,
        pitch: r.pitch ?? undefined,
        color: r.color ?? undefined,
        url: r.url ?? undefined,
        screens: await listScreens(r.id),
      })),
    );
  } catch (e) {
    console.error("listProducts failed:", e);
    return [];
  }
}

export async function saveProduct(input: {
  id?: string;
  name: string;
  pitch?: string;
  color?: string;
  url?: string;
}): Promise<Product> {
  const id = safeId(input.id || input.name);
  const row = {
    id,
    name: input.name.trim() || id,
    pitch: input.pitch ?? "",
    color: input.color ?? "",
    url: input.url ?? "",
  };
  const { error } = await supabase().from("vh_products").upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return { id, name: row.name, pitch: row.pitch, color: row.color, url: row.url, screens: await listScreens(id) };
}

export async function addProductScreens(productId: string, dataUrls: string[]): Promise<string[]> {
  const id = safeId(productId);
  const saved: string[] = [];
  for (let i = 0; i < dataUrls.length; i++) {
    const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i.exec(dataUrls[i]);
    if (!m) continue;
    const raw = m[1].toLowerCase();
    const ext = raw === "jpeg" ? "jpg" : raw;
    const buf = Buffer.from(m[2], "base64");
    const fname = `screen-${Date.now()}-${i}.${ext}`;
    const { error } = await supabase()
      .storage.from(PRODUCT_SCREENS_BUCKET)
      .upload(`${id}/${fname}`, buf, { contentType: MIME[ext] ?? "image/png", upsert: false });
    if (!error) saved.push(fname);
  }
  return saved;
}

function validName(name: string): boolean {
  // No path traversal, must be an image file.
  if (name.includes("/") || name.includes("\\") || name.includes("..")) return false;
  return IMAGE_EXT.has((name.split(".").pop() ?? "").toLowerCase());
}

export async function readProductScreen(
  productId: string,
  name: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  if (!hasSupabase() || !validName(name)) return null;
  try {
    const { data, error } = await supabase()
      .storage.from(PRODUCT_SCREENS_BUCKET)
      .download(`${safeId(productId)}/${name}`);
    if (error || !data) return null;
    const buffer = Buffer.from(await data.arrayBuffer());
    const ext = (name.split(".").pop() ?? "").toLowerCase();
    return { buffer, mime: MIME[ext] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

/** Delete an entire product: its DB row and all its screenshots. */
export async function deleteProduct(productId: string): Promise<boolean> {
  if (!hasSupabase()) return false;
  const id = safeId(productId);
  try {
    // Remove all stored screenshots first (Storage isn't cascade-deleted with the row).
    const names = await listScreens(id);
    if (names.length) {
      await supabase()
        .storage.from(PRODUCT_SCREENS_BUCKET)
        .remove(names.map((n) => `${id}/${n}`));
    }
    const { error } = await supabase().from("vh_products").delete().eq("id", id);
    return !error;
  } catch (e) {
    console.error("deleteProduct failed:", e);
    return false;
  }
}

/** Delete a single product screenshot. Returns true when a file was removed. */
export async function deleteProductScreen(productId: string, name: string): Promise<boolean> {
  if (!hasSupabase() || !validName(name)) return false;
  try {
    const { error } = await supabase()
      .storage.from(PRODUCT_SCREENS_BUCKET)
      .remove([`${safeId(productId)}/${name}`]);
    return !error;
  } catch {
    return false;
  }
}
