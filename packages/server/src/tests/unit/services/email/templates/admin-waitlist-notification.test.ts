import { describe, it, expect } from "vitest";
import { AdminWaitlistNotificationTemplate } from "@/services/email/templates/admin-waitlist-notification.template";

const template = new AdminWaitlistNotificationTemplate();

describe("AdminWaitlistNotificationTemplate", () => {
  it("subject uses the discord name when present", () => {
    const { subject } = template.render({
      id: 7,
      email: "alice@example.com",
      discordName: "alice#1234",
    });
    expect(subject).toBe("New Waitlist Submission: alice#1234");
  });

  it("subject falls back to the email when discord name is null", () => {
    const { subject } = template.render({
      id: 7,
      email: "alice@example.com",
      discordName: null,
    });
    expect(subject).toBe("New Waitlist Submission: alice@example.com");
  });

  it("html body interpolates id, discord name, and email", () => {
    const { html } = template.render({
      id: 42,
      email: "bob@example.com",
      discordName: "bob#5678",
    });
    expect(html).toContain("42");
    expect(html).toContain("bob@example.com");
    expect(html).toContain("bob#5678");
  });

  it("text body uses 'N/A' for null discord name", () => {
    const { text } = template.render({
      id: 9,
      email: "x@y.z",
      discordName: null,
    });
    expect(text).toContain("Discord: N/A");
    expect(text).toContain("Email: x@y.z");
    expect(text).toContain("ID: 9");
  });

  it("text body includes the discord name when present", () => {
    const { text } = template.render({
      id: 1,
      email: "x@y.z",
      discordName: "carol",
    });
    expect(text).toContain("Discord: carol");
  });

  it("renders with no attachments by default", () => {
    const { attachments } = template.render({
      id: 1,
      email: "x@y.z",
      discordName: null,
    });
    expect(attachments).toEqual([]);
  });
});
