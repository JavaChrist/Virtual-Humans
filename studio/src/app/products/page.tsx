"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client";
import { PageHeader } from "@/components/page-header";

interface Product {
  id: string;
  name: string;
  pitch?: string;
  color?: string;
  url?: string;
  screens: string[];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ProductsStudio() {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [pending, setPending] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiGet<{ products: Product[] }>("/api/products").then((d) => setProducts(d.products)).catch(() => {});
  }
  useEffect(load, []);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const urls = await Promise.all(Array.from(files).map(fileToDataUrl));
    setPending((p) => [...p, ...urls]);
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost<{ product: Product }>("/api/products", { name, pitch, url, color, screens: pending });
      setName("");
      setPitch("");
      setUrl("");
      setPending([]);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function addScreens(productId: string, productName: string, files: FileList | null) {
    if (!files) return;
    const urls = await Promise.all(Array.from(files).map(fileToDataUrl));
    await apiPost("/api/products", { id: productId, name: productName, screens: urls });
    load();
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Produits / Apps"
        subtitle="Ta bibliothèque d'applications à promouvoir — captures d'écran réutilisées dans les scènes publicitaires"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Ajouter une application</h3>
          <div className="space-y-3">
            <div>
              <label className="label">Nom</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : BudgetZen" />
            </div>
            <div>
              <label className="label">Pitch (1 phrase)</label>
              <input className="input" value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="Gère ton budget en 30 secondes par jour." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Lien (bio / store)</label>
                <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div>
                <label className="label">Couleur d&apos;accent</label>
                <input className="input h-10 p-1" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Captures d&apos;écran</label>
              <input className="input" type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} />
              {pending.length > 0 && (
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {pending.map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={p} alt={`capture ${i + 1}`} className="h-24 w-full object-cover rounded-lg border border-[var(--border)]" />
                  ))}
                </div>
              )}
            </div>
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <button className="btn btn-primary w-full" disabled={!name.trim() || saving} onClick={save}>
              {saving ? "Enregistrement…" : "Enregistrer l'application"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {products.length === 0 && (
            <div className="card p-8 text-center text-sm text-[var(--muted)]">
              Aucune application pour l&apos;instant. Ajoute ta première app à gauche.
            </div>
          )}
          {products.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full border border-[var(--border)]" style={{ background: p.color || "transparent" }} />
                <div className="flex-1">
                  <div className="font-semibold">{p.name}</div>
                  {p.pitch && <div className="text-xs text-[var(--muted)]">{p.pitch}</div>}
                </div>
                <span className="badge">{p.screens.length} capture{p.screens.length > 1 ? "s" : ""}</span>
              </div>
              {p.screens.length > 0 && (
                <div className="grid grid-cols-6 gap-2 mt-3">
                  {p.screens.map((s) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={s}
                      src={`/api/product-screen?product=${encodeURIComponent(p.id)}&name=${encodeURIComponent(s)}`}
                      alt={s}
                      className="h-24 w-full object-cover rounded-lg border border-[var(--border)]"
                    />
                  ))}
                </div>
              )}
              <label className="btn btn-ghost mt-3 inline-block cursor-pointer">
                + Ajouter des captures
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addScreens(p.id, p.name, e.target.files)}
                />
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
