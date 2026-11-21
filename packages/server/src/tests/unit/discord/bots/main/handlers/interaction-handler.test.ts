import { beforeEach, describe, expect, it, vi } from "vitest";
import { Collection, MessageFlags } from "discord.js";
import type { Client, Interaction } from "discord.js";

const { createUsage } = vi.hoisted(() => ({
  createUsage: vi.fn(async () => ({})),
}));

vi.mock("@/db", () => ({
  Q: { discord: { command: { usage: { create: createUsage } } } },
}));
vi.mock("@/discord/embeds", () => ({
  EmbedPresets: {
    error: (title: string, description?: string) => ({
      build: () => ({ title, description }),
    }),
  },
}));
vi.mock("@/discord/utils/admin-guard", () => ({
  requireAdmin: vi.fn(async () => true),
  requireOwner: vi.fn(async () => true),
}));
import { registerInteractionHandler } from "@/discord/bots/main/handlers/interaction-handler";
import { InteractionError } from "@/discord/utils/interaction-error";
import type { CommandModule } from "@/discord/bots/common/loaders/command-loader";
import type { ButtonModule } from "@/discord/bots/common/loaders/component-loader";
import { defineCustomId } from "@/discord/utils/custom-id";

type Execute = (interaction: never) => Promise<void>;

function dispatcher(options: {
  command?: Execute;
  button?: Execute;
}): (interaction: Interaction) => void {
  const commands = new Collection<string, CommandModule>();
  if (options.command) {
    commands.set("money", {
      execute: options.command,
    } as unknown as CommandModule);
  }
  const buttons: ButtonModule[] = [];
  if (options.button) {
    buttons.push({
      customId: defineCustomId("panel:toggle"),
      execute: options.button as ButtonModule["execute"],
    });
  }

  let listener: ((interaction: Interaction) => void) | undefined;
  const client = {
    on: (_event: string, handler: (interaction: Interaction) => void) => {
      listener = handler;
    },
  } as unknown as Client;
  registerInteractionHandler(client, { commands, buttons, modals: [] });

  return (interaction) => listener?.(interaction);
}

function fakeInteraction(kind: "command" | "button", state = {}) {
  const fake = {
    commandName: "money",
    customId: "panel:toggle",
    user: { tag: "steve#0001", id: "100000000000000001" },
    replied: false,
    deferred: false,
    ...state,
    isChatInputCommand: () => kind === "command",
    isAutocomplete: () => false,
    isButton: () => kind === "button",
    isModalSubmit: () => false,
    reply: vi.fn(async () => {}),
    followUp: vi.fn(async () => {}),
  };
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, "info").mockImplementation(() => logger);
});

describe("interaction dispatcher failures", () => {
  it("answers a failed command with the generic error embed and records the failure", async () => {
    const errorLog = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const failure = new Error("connection reset");
    const interaction = fakeInteraction("command");

    dispatcher({
      command: async () => {
        throw failure;
      },
    })(interaction as unknown as Interaction);

    await vi.waitFor(() =>
      expect(interaction.reply).toHaveBeenCalledWith({
        embeds: [
          {
            title: "Something Went Wrong",
            description:
              "Please try again in a moment, and contact staff if it keeps happening.",
          },
        ],
        flags: MessageFlags.Ephemeral,
      }),
    );
    expect(errorLog).toHaveBeenCalledWith("/money failed:", failure);
    await vi.waitFor(() =>
      expect(createUsage).toHaveBeenCalledWith({
        commandName: "money",
        discordId: "100000000000000001",
        success: false,
      }),
    );
  });

  it("shows the title and description of an InteractionError and logs its cause", async () => {
    const errorLog = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const cause = new Error("upstream 500");
    const interaction = fakeInteraction("command", { deferred: true });

    dispatcher({
      command: async () => {
        throw new InteractionError("Render Error", "Could not render it.", {
          cause,
        });
      },
    })(interaction as unknown as Interaction);

    await vi.waitFor(() =>
      expect(interaction.followUp).toHaveBeenCalledWith({
        embeds: [
          { title: "Render Error", description: "Could not render it." },
        ],
        flags: MessageFlags.Ephemeral,
      }),
    );
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith("/money failed:", cause);
  });

  it("records a command that finished as a success", async () => {
    const interaction = fakeInteraction("command");

    dispatcher({
      command: async () => {},
    })(interaction as unknown as Interaction);

    await vi.waitFor(() =>
      expect(createUsage).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      ),
    );
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("follows up on a deferred button instead of editing the message it sits on", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => logger);
    const interaction = fakeInteraction("button", { deferred: true });

    dispatcher({
      button: async () => {
        throw new Error("role hierarchy");
      },
    })(interaction as unknown as Interaction);

    await vi.waitFor(() =>
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: [expect.objectContaining({ title: "Something Went Wrong" })],
          flags: MessageFlags.Ephemeral,
        }),
      ),
    );
    expect(createUsage).not.toHaveBeenCalled();
  });
});
