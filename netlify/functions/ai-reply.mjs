/**
 * ai-reply: generates a short, in-character reply from a demo persona.
 *
 * Shared by two surfaces so the personas sound like the same people in both:
 *   - Messaging (Twilio demo contacts: demo-kim-marks, demo-ryan-otoole, ...)
 *   - Project discussion feeds
 *
 * POST body:
 *   {
 *     identity?: "demo-kim-marks",        // resolves a built-in persona
 *     persona?:  { name, role, type },    // or supply/override one directly
 *     message:   "latest message from the user",   // required
 *     history?:  [{ from: "user" | "them", body }],// oldest first, recent turns
 *     surface?:  "messages" | "project-discussion",
 *     context?:  { projectName, rooms: [], products: [] }  // optional grounding
 *   }
 *
 * Response: { reply, source: "ai" | "canned", persona: { name, identity } }
 *
 * Demo only. No auth check, consistent with the other functions here.
 *
 * FALLBACK: if ANTHROPIC_API_KEY is unset or the API call fails, this returns a
 * canned line with source:"canned" and HTTP 200. The demo must never hard-fail
 * on a missing key or a network blip -- callers can render the reply either way.
 */

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8";
const MAX_HISTORY_TURNS = 12;

const PERSONAS = {
  "demo-kim-marks": {
    name: "Kim Marks",
    role: "Account Manager",
    type: "prosource",
    blurb:
      "You work at the ProSource showroom and are the member's main point of contact. " +
      "You handle samples, quotes, pickups, and coordinating with the member's clients. " +
      "Warm and efficient; you tend to confirm the next concrete step.",
    canned: [
      "Sure thing, let me check on that and get right back to you.",
      "I can have those set aside at the showroom for you. When are you thinking of coming by?",
      "Good question. Let me pull the details and follow up shortly.",
    ],
  },
  // The account's other account manager, at the Chicago showroom. Deliberately
  // NOT a second Kim: same job title, different person. Kim is warm and confirms
  // the next step; Denise leads with logistics and will tell you no. If these two
  // ever start sounding alike, the multi-showroom demo stops being about anything.
  "demo-denise-okafor": {
    name: "Denise Okafor",
    role: "Account Manager",
    type: "prosource",
    blurb:
      "You run the member's account out of the ProSource showroom in Chicago, the second " +
      "showroom they buy from alongside their home showroom in St. Louis. You are direct and " +
      "logistics first: you think in lead times, what is actually on the floor, truck runs, and " +
      "delivery windows. You ask for the specific number you need (square footage, a count, a " +
      "date on site) rather than talking around it, and you say plainly when something will not " +
      "make a date instead of softening it. Brisk and dependable, never chatty, no small talk.",
    canned: [
      "Let me see what is on the floor here and I will come back with a lead time.",
      "I can pull that out of Chicago. How much do you need, and what day does it have to be on site?",
      "That date is tight. Tell me when it has to land and I will work backward from it.",
    ],
  },
  "demo-bubba-beans": {
    name: "Bubba Beans",
    role: "Homeowner: Beans Kitchen Remodel",
    type: "client",
    blurb:
      "You're a homeowner remodeling your kitchen, working through a ProSource member. " +
      "You're enthusiastic but not an expert, so you ask practical questions about looks, " +
      "timing, and cost rather than using trade terminology.",
    canned: [
      "Sounds good to me! Just let me know what you need from my end.",
      "Works for me. What's the timing looking like?",
      "Okay, that makes sense. Whatever you think is best.",
    ],
  },
  "demo-ryan-otoole": {
    name: "Ryan O'Toole",
    role: "Flooring Installer",
    type: "tradepro",
    blurb:
      "You're a flooring installer. You're practical and direct, and you think in terms of " +
      "subfloor prep, square footage, waste factor, acclimation, and crew scheduling. " +
      "You flag real-world install issues before they become problems.",
    canned: [
      "Yep, can do. I'll need to see the subfloor before we schedule.",
      "That should work. Give me the square footage and I'll get you a number.",
      "Sounds good. Just make sure the material acclimates before install day.",
    ],
  },
  "demo-sarah-chen": {
    name: "Sarah Chen",
    role: "Homeowner: Chen Outdoor Patio",
    type: "client",
    blurb:
      "You're a homeowner doing an outdoor patio project through a ProSource member. " +
      "You're detail-oriented and ask about durability, weather, and maintenance.",
    canned: [
      "Thanks for the update! How does that hold up outdoors long term?",
      "That works for me. Anything you need me to decide on?",
      "Got it, appreciate you keeping me posted.",
    ],
  },
  "demo-heather-yager": {
    name: "Heather Yager",
    role: "Designer",
    type: "prosource",
    blurb:
      "You're a designer at the ProSource showroom. You think about how materials work " +
      "together (color, texture, transitions between rooms) and you offer specific, " +
      "confident design opinions rather than vague ones.",
    canned: [
      "I'd lean toward the warmer tone there. It'll tie the rooms together better.",
      "Let me put a couple of options together and walk you through them.",
      "Good instinct. I'd just be careful about the transition between those two spaces.",
    ],
  },
};

const GENERIC_CANNED = [
  "Got it, let me look into that and circle back.",
  "Sounds good, I'll follow up shortly.",
  "Thanks for the heads up!",
];

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/**
 * Belt and braces. The system prompt forbids em/en dashes, but a prompt is a
 * request, not a guarantee. This makes it a guarantee: a dash reads as
 * machine-written, and one slipping into a demo chat is exactly the tell we're
 * trying to avoid. A comma is the substitution that works across the widest
 * range of chat phrasings without needing to re-case the next word.
 */
const stripDashes = (text) =>
  String(text)
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();

/** Deterministic-ish pick so repeated identical asks don't always echo the same line. */
const pickCanned = (lines, seed) =>
  lines[Math.abs(hash(seed)) % lines.length];

const hash = (s) => {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) {
    h = (h << 5) - h + String(s).charCodeAt(i);
    h |= 0;
  }
  return h;
};

const buildSystemPrompt = (persona, surface, context) => {
  const where =
    surface === "project-discussion"
      ? "You are posting in the discussion feed of a home-remodel project, where the " +
        "whole project team can see it. Keep it on-topic for the project."
      : "You are replying in a direct one-to-one chat thread.";

  const grounding = [];
  if (context?.projectName) grounding.push(`Project: ${context.projectName}`);
  if (context?.rooms?.length) grounding.push(`Rooms: ${context.rooms.join(", ")}`);
  if (context?.products?.length)
    grounding.push(`Products selected: ${context.products.join(", ")}`);

  return [
    `You are ${persona.name}, ${persona.role}. ${persona.blurb}`,
    "",
    where,
    grounding.length ? `\nContext you already know:\n${grounding.join("\n")}` : "",
    "",
    "Rules:",
    "- Reply as a real person would in a chat app: 1-3 short sentences, usually one.",
    "- Plain conversational text only. No markdown, no bullet points, no headings, no sign-off.",
    "- NEVER use an em dash or an en dash. Not one, anywhere. People typing in a",
    "  chat app do not reach for them, and they read as machine-written. Use a",
    "  comma, a full stop, a colon, or brackets instead, or just split the",
    "  sentence in two.",
    "- Stay in character. Never mention being an AI, a model, or a demo.",
    "- Never invent hard commitments you couldn't know: no specific prices, invoice",
    "  numbers, dates, or delivery promises. Speak in terms of next steps instead.",
    "- If the message is unclear, ask one natural clarifying question.",
    "- Output ONLY the message text itself. No preamble, no explanation of your",
    "  reasoning, no quotes around it, no 'Here's my reply:'.",
  ]
    .filter(Boolean)
    .join("\n");
};

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { identity, persona: personaOverride, message, history, surface, context } = body || {};

  const base = identity ? PERSONAS[identity] : null;
  const persona = { ...(base || {}), ...(personaOverride || {}) };

  if (!persona.name) {
    return json(400, { error: "Unknown persona: pass a known `identity` or a `persona` object" });
  }
  if (!message || typeof message !== "string") {
    return json(400, { error: "`message` is required" });
  }

  const cannedLines = base?.canned || GENERIC_CANNED;
  const cannedReply = () =>
    json(200, {
      reply: pickCanned(cannedLines, message),
      source: "canned",
      persona: { name: persona.name, identity: identity || null },
    });

  // No key configured -> canned. Keeps the demo working out of the box.
  if (!process.env.ANTHROPIC_API_KEY) {
    return cannedReply();
  }

  const turns = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : [];
  const messages = [
    // Map prior turns onto the chat roles: "them" is this persona speaking.
    ...turns
      .filter((t) => t && typeof t.body === "string" && t.body.trim())
      .map((t) => ({
        role: t.from === "them" ? "assistant" : "user",
        content: t.body,
      })),
    { role: "user", content: message },
  ];

  // The API requires the first message to be from the user.
  while (messages.length && messages[0].role === "assistant") messages.shift();

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      // Thinking omitted: on Opus 4.8 that runs without thinking, which is what a
      // fast chat reply wants. The system prompt's "output ONLY the message text"
      // rule keeps reasoning from leaking into the visible response.
      output_config: { effort: "low" },
      system: buildSystemPrompt(persona, surface, context),
      messages,
    });

    if (response.stop_reason === "refusal") {
      return cannedReply();
    }

    const text = stripDashes(
      response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
    );

    if (!text) return cannedReply();

    return json(200, {
      reply: text,
      source: "ai",
      persona: { name: persona.name, identity: identity || null },
    });
  } catch (err) {
    // Fall back rather than fail: a demo walkthrough should never hit a dead chat.
    if (err instanceof Anthropic.RateLimitError) {
      console.warn("ai-reply: rate limited, using canned reply");
    } else if (err instanceof Anthropic.AuthenticationError) {
      console.warn("ai-reply: ANTHROPIC_API_KEY rejected, using canned reply");
    } else if (err instanceof Anthropic.APIConnectionError) {
      console.warn("ai-reply: connection error, using canned reply");
    } else if (err instanceof Anthropic.APIError) {
      console.warn(`ai-reply: API error ${err.status}: ${err.message}`);
    } else {
      console.warn("ai-reply: unexpected error", err);
    }
    return cannedReply();
  }
}

// Routing note: this project routes /api/* via [[redirects]] in netlify.toml
// (see the entries for otp-send, user-data, etc.). The redirect for
// /api/ai-reply is added there alongside them.
