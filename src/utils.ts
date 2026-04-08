export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url, window.location.origin);
  } catch {
    return null;
  }
}

export function pathname(url: string): string {
  return safeParseUrl(url)?.pathname ?? url;
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatJson(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function tryParseJson(raw: string | undefined): { parsed: unknown; isJson: boolean } {
  if (!raw) return { parsed: undefined, isJson: false };
  try {
    return { parsed: JSON.parse(raw), isJson: true };
  } catch {
    return { parsed: raw, isJson: false };
  }
}

export function copyToClipboard(el: HTMLElement, text: string): void {
  navigator.clipboard.writeText(text).then(() => {
    el.classList.add("copied");
    setTimeout(() => el.classList.remove("copied"), 1500);
  });
}

export function isLocalUrl(url: string): boolean {
  const h = safeParseUrl(url)?.hostname;
  return h === "localhost" || h === "127.0.0.1";
}
