import { findAttachmentRef } from "@createrington/shared/api/embed";
import type {
  ComponentButton,
  ComponentNode,
  PresetKind,
} from "@createrington/shared/api/embed";

function getIncompleteFieldIndexes(fields: { name: string; value: string }[]) {
  const out: number[] = [];
  fields.forEach((f, i) => {
    if (!f.name.trim() || !f.value.trim()) out.push(i);
  });
  return out;
}

function incompleteFieldsMessage(indexes: number[]): string {
  const list = indexes.map((i) => `#${i + 1}`).join(", ");
  return indexes.length === 1
    ? `Field ${list} is empty. Fill in both name and value, or remove it.`
    : `Fields ${list} are empty. Fill in both name and value, or remove them.`;
}

function checkComponentButton(button: ComponentButton): string | null {
  if (!button.label.trim()) return "A button is missing a label.";
  if (!button.url.trim()) return "A button is missing a URL.";
  return null;
}

/**
 * Walk a Components V2 tree for empty required fields the Zod schema would
 * reject, returning a friendly message so the user sees that instead of a raw
 * tRPC validation error. Mirrors the classic path's incomplete-field check.
 */
function findComponentIssue(nodes: ComponentNode[]): string | null {
  const attachment = findAttachmentRef(nodes);
  if (attachment) {
    return `${attachment} points at a message attachment, which the builder cannot send.`;
  }

  for (const node of nodes) {
    switch (node.type) {
      case "text":
        if (!node.content.trim()) return "A text component is empty.";
        break;
      case "separator":
        break;
      case "media_gallery":
        if (node.items.some((item) => !item.url.trim())) {
          return "A media gallery image is missing a URL.";
        }
        break;
      case "action_row":
        for (const button of node.components) {
          const issue = checkComponentButton(button);
          if (issue) return issue;
        }
        break;
      case "section":
        if (node.components.some((text) => !text.content.trim())) {
          return "A section text is empty.";
        }
        if (node.accessory.type === "thumbnail") {
          if (!node.accessory.url.trim()) {
            return "A section thumbnail is missing an image URL.";
          }
        } else {
          const issue = checkComponentButton(node.accessory);
          if (issue) return issue;
        }
        break;
      case "container": {
        const issue = findComponentIssue(node.components);
        if (issue) return issue;
        break;
      }
    }
  }
  return null;
}

export function findPayloadIssue(
  kind: PresetKind,
  fields: { name: string; value: string }[],
  components: ComponentNode[],
): string | null {
  if (kind === "embed") {
    const incomplete = getIncompleteFieldIndexes(fields);
    return incomplete.length > 0 ? incompleteFieldsMessage(incomplete) : null;
  }
  return findComponentIssue(components);
}
