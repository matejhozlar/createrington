import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { trpcError } from "@/trpc/utils";
import { getService, Services } from "@/services";
import config from "@/config";
import { createRateLimit } from "@/trpc/middleware/rate-limit";

const aiAssistLimit = createRateLimit({
  name: "admin.ai.assist",
  limit: 30,
  windowMs: 60 * 60 * 1000,
  key: (ctx) => ctx.user!.discordId,
});

const ASSIST_ACTIONS = [
  "rewrite",
  "shorten",
  "punchier",
  "grammar",
  "translate-en",
] as const;

type AssistAction = (typeof ASSIST_ACTIONS)[number];

const SYSTEM_PROMPT = `You are an expert copy editor for the Createrington Minecraft community's Discord server. You edit short admin-facing copy: announcements, embed bodies, field values, button labels, and similar UI text. The audience is gamers (mostly teens and young adults), the tone is friendly, clear, and confident.

OUTPUT RULES (follow exactly, every time):
- Return ONLY the rewritten text. No preface ("Here is..."), no explanation, no surrounding quotes, no markdown code fences.
- Preserve Discord syntax verbatim wherever it appears: user mentions (<@123>, <@!123>), role mentions (<@&123>), channel mentions (<#123>), timestamps (<t:1234567890:R>, <t:...:F> etc.), custom emoji (<:name:123>, <a:name:123>), and unicode emoji.
- Preserve markdown formatting unless the requested action is specifically about formatting: **bold**, *italic*, _italic_, __underline__, ~~strikethrough~~, ||spoiler||, \`inline code\`, \`\`\`code blocks\`\`\`, > blockquotes, # / ## / ### headings, - / 1. lists, [text](url) links.
- Preserve placeholders exactly as written: {user}, {username}, {date}, {server}, and any other {curly_token}.
- Preserve URLs verbatim.
- Match the original tone unless the action explicitly asks to change it. Don't add hype, emojis, or filler that wasn't there.
- Don't translate proper nouns (Createrington, Minecraft, server names, player names).
- Output must respect the same paragraph/line structure as the input unless the action implies a structural change.`;

const ACTION_PROMPTS: Record<AssistAction, string> = {
  rewrite: `Rewrite the following text for clarity and flow. Keep approximately the same length and the same meaning. Improve word choice and sentence structure without changing what is being said.

Text:
`,
  shorten: `Shorten the following text. Cut filler, redundancy, and obvious phrases. Keep the core meaning and any concrete details (names, numbers, links, mentions). Aim for noticeably tighter copy without losing information.

Text:
`,
  punchier: `Rewrite the following text to feel more punchy and energetic. Use stronger verbs, tighter sentences, and a more confident voice. Keep the same meaning and approximate length. Don't add hype words or marketing fluff that isn't grounded in the input.

Text:
`,
  grammar: `Fix grammar, spelling, punctuation, and capitalization in the following text. Make the SMALLEST possible edits. Do not rewrite for style, do not change word choice, do not reorder sentences, do not change tone. If the text is already correct, return it unchanged.

Text:
`,
  "translate-en": `Translate the following text to English. Apply these rules in order:

1. Detect the language of the input.
2. If the input is ENTIRELY in English, return it VERBATIM. Do not fix grammar, spelling, punctuation, capitalization, or word choice. Do not "improve" anything. Output the exact string you received, character for character.
3. If the input is in another language, translate it to natural, fluent English.
4. If the input mixes English and another language, translate only the non-English parts; leave the English parts verbatim.

Always preserve formatting, mentions, timestamps, custom emoji, placeholders, URLs, and proper nouns exactly as written. Do not add commentary about the translation.

Text:
`,
};

const TEMPERATURES: Record<AssistAction, number> = {
  rewrite: 0.4,
  shorten: 0.3,
  punchier: 0.6,
  grammar: 0.1,
  "translate-en": 0,
};

export const adminAiRouter = router({
  assist: adminProcedure
    .use(aiAssistLimit)
    .meta({
      description:
        "Run a small editing action (rewrite, shorten, grammar, translate to English, etc.) on a piece of admin-authored text using the OpenAI chat completion service.",
    })
    .input(
      z.object({
        action: z.enum(ASSIST_ACTIONS),
        text: z.string().trim().min(1).max(8000),
      }),
    )
    .mutation(async ({ input }) => {
      if (!config.ai.enabled) {
        throw trpcError.badRequest(
          "AI assist is not available: OpenAI API key is not configured.",
        );
      }

      const aiService = await getService(Services.AI_SERVICE);
      const prompt = ACTION_PROMPTS[input.action] + input.text;

      const result = await aiService.complete({
        system: SYSTEM_PROMPT,
        prompt,
        temperature: TEMPERATURES[input.action],
        maxTokens: 2048,
      });

      return { text: result };
    }),
});
