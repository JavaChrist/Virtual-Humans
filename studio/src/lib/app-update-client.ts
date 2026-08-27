/**
 * Testable app-update client logic (no React). Used by PwaRegister.
 */
import {
  APP_VERSION_UNAVAILABLE,
  isNewerAppVersion,
  parseAppVersionPayload,
  resolveAppVersionIdentity,
  type AppVersion,
} from "@/lib/app-version";

export const APP_VERSION_POLL_MS = 120_000;
export const APP_VERSION_FETCH_CACHE = "no-store" as const;
export const APP_VERSION_FETCH_CREDENTIALS = "omit" as const;
export const APP_UPDATE_CHANNEL = "vhs-app-update";
export const APP_UPDATE_SKIP_WAITING = "SKIP_WAITING";
export const APP_UPDATE_ACK_WAIT_MS = 300;
export const APP_UPDATE_BASELINE_KEY = "vh-app-version-baseline";
export const APP_UPDATE_DISMISSED_KEY = "vh-app-version-dismissed";
export const APP_UPDATE_STORAGE_FALLBACK_KEY = "vhs-app-update";
export const APP_UPDATE_SW_SENTINEL = "sw-waiting";

export type AppUpdateUxState =
  | "idle"
  | "checking"
  | "available"
  | "preparing"
  | "installing"
  | "deferred"
  | "blocked"
  | "offline"
  | "check-error"
  | "applied";

export type AppUpdateChannelMessage = {
  type: "available" | "later" | "applying" | "blocked" | "applied";
  identity?: string;
};

export type MemoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function createMemoryStorage(seed: Record<string, string> = {}): MemoryStorage {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

export function safeStorageGet(storage: MemoryStorage | undefined, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSet(
  storage: MemoryStorage | undefined,
  key: string,
  value: string,
): void {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    /* private mode / quota */
  }
}

export function fetchAppVersionInit(): RequestInit {
  return {
    cache: APP_VERSION_FETCH_CACHE,
    credentials: APP_VERSION_FETCH_CREDENTIALS,
  };
}

export type AppUpdateSession = {
  poll: () => Promise<void>;
  defer: () => void;
  apply: () => Promise<boolean>;
  setWaiting: (worker: { postMessage: (data: string) => void } | null) => void;
  onControllerChange: () => void;
  handleChannel: (msg: AppUpdateChannelMessage) => void;
  getState: () => {
    ux: AppUpdateUxState;
    baseline: AppVersion | null;
    remote: AppVersion | null;
    identity: string | null;
    blockedReasons: string[];
    skipWaitingSent: boolean;
    reloaded: boolean;
    updateCalledForIdentity: string | null;
    waiting: boolean;
  };
};

export function createAppUpdateSession(opts: {
  fetchVersion: () => Promise<unknown>;
  isOnline: () => boolean;
  getBlockers: () => { id: string; reason: string }[];
  reload: () => void;
  storage?: MemoryStorage;
  memoryFallback?: { baseline?: string; dismissed?: string };
  updateRegistration?: () => Promise<void>;
  skipWaiting?: (worker: { postMessage: (data: string) => void }) => void;
  broadcast?: (msg: AppUpdateChannelMessage) => void;
  waitForBlockedAck?: (ms: number) => Promise<boolean>;
}): AppUpdateSession {
  let baseline: AppVersion | null = null;
  let remote: AppVersion | null = null;
  let ux: AppUpdateUxState = "idle";
  let blockedReasons: string[] = [];
  let skipWaitingSent = false;
  let reloaded = false;
  let updateCalledForIdentity: string | null = null;
  let waitingWorker: { postMessage: (data: string) => void } | null = null;
  let inflight: Promise<void> | null = null;
  const memory = opts.memoryFallback ?? {};

  function identityOf(payload: AppVersion | null): string | null {
    if (!payload) return waitingWorker ? APP_UPDATE_SW_SENTINEL : null;
    return resolveAppVersionIdentity(payload);
  }

  function readDismissed(): string | null {
    return safeStorageGet(opts.storage, APP_UPDATE_DISMISSED_KEY) ?? memory.dismissed ?? null;
  }

  function writeDismissed(value: string): void {
    memory.dismissed = value;
    safeStorageSet(opts.storage, APP_UPDATE_DISMISSED_KEY, value);
  }

  function writeBaseline(value: string): void {
    memory.baseline = value;
    safeStorageSet(opts.storage, APP_UPDATE_BASELINE_KEY, value);
  }

  function refreshUx(): void {
    if (ux === "installing" || ux === "applied" || ux === "blocked") return;
    const identity = identityOf(remote) ?? (waitingWorker ? APP_UPDATE_SW_SENTINEL : null);
    const dismissed = readDismissed();
    if (identity && dismissed === identity) {
      ux = "deferred";
      return;
    }
    const newer = baseline && remote ? isNewerAppVersion(baseline, remote) : false;
    if (newer && waitingWorker) {
      ux = "available";
      return;
    }
    if (newer && !waitingWorker) {
      ux = "preparing";
      return;
    }
    if (waitingWorker) {
      ux = "available";
      return;
    }
    if (ux === "offline" || ux === "check-error") return;
    ux = "idle";
  }

  async function pollOnce(): Promise<void> {
    if (!opts.isOnline()) {
      ux = "offline";
      return;
    }
    ux = ux === "available" || ux === "preparing" || ux === "blocked" ? ux : "checking";
    let parsed: AppVersion | null = null;
    try {
      parsed = parseAppVersionPayload(await opts.fetchVersion());
    } catch {
      ux = "check-error";
      return;
    }
    if (!parsed) {
      ux = "check-error";
      refreshUx();
      return;
    }
    remote = parsed;
    const identity = resolveAppVersionIdentity(parsed);
    if (!baseline) {
      baseline = parsed;
      if (identity) writeBaseline(identity);
      ux = "idle";
      refreshUx();
      return;
    }
    const newer = isNewerAppVersion(baseline, parsed);
    if (newer && identity && updateCalledForIdentity !== identity) {
      updateCalledForIdentity = identity;
      try {
        await opts.updateRegistration?.();
      } catch {
        /* SW update is complementary */
      }
    }
    refreshUx();
    if (ux === "available" || ux === "preparing") {
      opts.broadcast?.({ type: "available", identity: identity ?? undefined });
    }
  }

  async function poll(): Promise<void> {
    if (inflight) return inflight;
    inflight = pollOnce().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  function defer(): void {
    const identity = identityOf(remote) ?? APP_UPDATE_SW_SENTINEL;
    writeDismissed(identity);
    ux = "deferred";
    waitingWorker = null;
    opts.broadcast?.({ type: "later", identity });
  }

  async function apply(): Promise<boolean> {
    const blockers = opts.getBlockers();
    if (blockers.length > 0) {
      blockedReasons = blockers.map((b) => b.reason);
      ux = "blocked";
      opts.broadcast?.({
        type: "blocked",
        identity: identityOf(remote) ?? undefined,
      });
      return false;
    }
    const identity = identityOf(remote) ?? undefined;
    opts.broadcast?.({ type: "applying", identity });
    const blockedByPeer = opts.waitForBlockedAck
      ? await opts.waitForBlockedAck(APP_UPDATE_ACK_WAIT_MS)
      : false;
    if (blockedByPeer) {
      blockedReasons = ["Une autre fenêtre a une action en cours."];
      ux = "blocked";
      return false;
    }
    if (waitingWorker) {
      if (skipWaitingSent) return false;
      skipWaitingSent = true;
      ux = "installing";
      (opts.skipWaiting ?? ((w) => w.postMessage(APP_UPDATE_SKIP_WAITING)))(waitingWorker);
      return true;
    }
    if (reloaded) return false;
    reloaded = true;
    ux = "applied";
    opts.broadcast?.({ type: "applied", identity });
    opts.reload();
    return true;
  }

  return {
    poll,
    defer,
    apply,
    setWaiting: (worker) => {
      waitingWorker = worker;
      refreshUx();
    },
    onControllerChange: () => {
      if (reloaded) return;
      reloaded = true;
      ux = "applied";
      opts.reload();
    },
    handleChannel: (msg) => {
      if (msg.type === "later" && msg.identity) {
        writeDismissed(msg.identity);
        if (identityOf(remote) === msg.identity || (!remote && msg.identity === APP_UPDATE_SW_SENTINEL)) {
          ux = "deferred";
          waitingWorker = null;
        }
        return;
      }
      if (msg.type === "applying") {
        const blockers = opts.getBlockers();
        if (blockers.length > 0) {
          opts.broadcast?.({ type: "blocked", identity: msg.identity });
          blockedReasons = blockers.map((b) => b.reason);
          ux = "blocked";
          return;
        }
        if (ux === "available" || ux === "preparing") ux = "idle";
      }
      if (msg.type === "applied") {
        ux = "applied";
      }
    },
    getState: () => ({
      ux,
      baseline,
      remote,
      identity: identityOf(remote),
      blockedReasons,
      skipWaitingSent,
      reloaded,
      updateCalledForIdentity,
      waiting: Boolean(waitingWorker),
    }),
  };
}

export { APP_VERSION_UNAVAILABLE, isNewerAppVersion, parseAppVersionPayload };
