export function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  text: string,
  onChange: (next: string) => void,
): void {
  const pos = el?.selectionStart ?? value.length;
  onChange(value.slice(0, pos) + text + value.slice(pos));
  requestAnimationFrame(() => {
    if (!el) return;
    const after = pos + text.length;
    el.selectionStart = el.selectionEnd = after;
    el.focus();
  });
}
