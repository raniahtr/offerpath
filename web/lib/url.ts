/** Only link to web addresses: a stored "javascript:..." URL would run code when clicked. */
export function safeHref(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}
