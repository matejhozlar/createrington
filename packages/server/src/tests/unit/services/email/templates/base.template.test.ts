import { describe, it, expect } from "vitest";
import { BaseEmailTemplate } from "@/services/email/templates/base.template";
import type { EmailAttachment } from "@/services/email/types";

interface TestData {
  name: string;
}

class TestTemplate extends BaseEmailTemplate<TestData> {
  protected getSubject(data: TestData): string {
    return `Hello ${data.name}`;
  }
  protected getHtml(data: TestData): string {
    return `<p>Hi ${data.name}</p>`;
  }
  protected getText(data: TestData): string {
    return `Hi ${data.name}`;
  }
}

class TemplateWithAttachments extends BaseEmailTemplate<TestData> {
  protected getSubject() {
    return "subject";
  }
  protected getHtml() {
    return "<p>html</p>";
  }
  protected getText() {
    return "text";
  }
  protected override getAttachments(data: TestData): EmailAttachment[] {
    return [
      {
        filename: `${data.name}.txt`,
        content: "payload",
        contentType: "text/plain",
      },
    ];
  }
}

describe("BaseEmailTemplate.render", () => {
  it("composes subject, html, and text from the abstract methods", () => {
    const rendered = new TestTemplate().render({ name: "Alice" });
    expect(rendered.subject).toBe("Hello Alice");
    expect(rendered.html).toBe("<p>Hi Alice</p>");
    expect(rendered.text).toBe("Hi Alice");
  });

  it("defaults attachments to an empty array when not overridden", () => {
    expect(new TestTemplate().render({ name: "x" }).attachments).toEqual([]);
  });

  it("includes attachments returned by an override", () => {
    const rendered = new TemplateWithAttachments().render({ name: "Bob" });
    expect(rendered.attachments).toEqual([
      {
        filename: "Bob.txt",
        content: "payload",
        contentType: "text/plain",
      },
    ]);
  });

  it("passes the same data to every template method", () => {
    const seen: TestData[] = [];

    class CapturingTemplate extends BaseEmailTemplate<TestData> {
      protected getSubject(data: TestData) {
        seen.push(data);
        return "s";
      }
      protected getHtml(data: TestData) {
        seen.push(data);
        return "h";
      }
      protected getText(data: TestData) {
        seen.push(data);
        return "t";
      }
      protected override getAttachments(data: TestData) {
        seen.push(data);
        return [];
      }
    }

    const data = { name: "Carol" };
    new CapturingTemplate().render(data);

    expect(seen).toHaveLength(4);
    for (const captured of seen) expect(captured).toBe(data);
  });
});
