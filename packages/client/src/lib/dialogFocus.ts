const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not(:disabled)",
  'input:not(:disabled):not([type="hidden"])',
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(", ");

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function isTextField(element: HTMLElement) {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(element.type);
  }
  return element.isContentEditable;
}

export function focusTextFieldOnOpen(event: Event) {
  if (event.defaultPrevented) return;
  event.preventDefault();
  const content = event.currentTarget;
  if (!(content instanceof HTMLElement)) return;
  const first = content.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  const target = first && isTextField(first) ? first : content;
  target.focus({ preventScroll: true });
}
