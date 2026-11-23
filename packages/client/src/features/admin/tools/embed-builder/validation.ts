import {
  COMPONENTS_V2_MAX_COMPONENTS,
  COMPONENTS_V2_MAX_TEXT,
  findAttachmentRef,
  measureComponentsV2,
} from "@createrington/shared/api/embed";
import type {
  ComponentButton,
  ComponentNode,
  MessagePayload,
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

function findSizeIssue(nodes: ComponentNode[]): string | null {
  const { count, text } = measureComponentsV2(nodes);
  if (count > COMPONENTS_V2_MAX_COMPONENTS) {
    return `The message has ${count} components. Discord allows at most ${COMPONENTS_V2_MAX_COMPONENTS}, counting nested ones.`;
  }
  if (text > COMPONENTS_V2_MAX_TEXT) {
    return `The message has ${text} characters of text. Discord allows at most ${COMPONENTS_V2_MAX_TEXT}.`;
  }
  return null;
}

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

export function findPayloadIssue(payload: MessagePayload): string | null {
  if (payload.kind === "embed") {
    const incomplete = getIncompleteFieldIndexes(payload.embed.fields);
    return incomplete.length > 0 ? incompleteFieldsMessage(incomplete) : null;
  }
  const nodes = payload.components.components;
  return findSizeIssue(nodes) ?? findComponentIssue(nodes);
}
