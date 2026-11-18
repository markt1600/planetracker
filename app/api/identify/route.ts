import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { catalogMeta, matchGuess } from "@/lib/catalog";
import { FACTS } from "@/lib/facts";

export const maxDuration = 120;

const Guess = z.object({
  is_model_aircraft: z.boolean().describe("True when the photo shows a model or real aircraft that can be described."),
  airline: z.string().nullable().describe("Airline or operator painted on the aircraft, e.g. 'Singapore Airlines'."),
  aircraft: z.string().nullable().describe("Aircraft type as specific as the photo allows, e.g. 'A350-900', '747-400', '737-800'."),
  family: z.string().nullable().describe("The closest entry from the supplied family list, or null."),
  registration: z.string().nullable().describe("Registration only if it is actually legible in the photo, e.g. '9V-SKA'."),
  livery: z.string().nullable().describe("Special livery or distinguishing markings, e.g. 'Star Alliance', 'retro livery'."),
  brand: z.string().nullable().describe("Model manufacturer only if printed on a visible box, stand or underside."),
  scale: z.string().nullable().describe("Scale such as '1:400' only if printed somewhere visible."),
  keywords: z.array(z.string()).describe("Up to 4 short lowercase search words that would appear in a product title for this exact model."),
  confidence: z.enum(["high", "medium", "low"]),
  summary: z.string().describe("One friendly sentence for a 12-year-old collector saying what you think it is and what gave it away."),
});

const MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Photo identification isn't set up yet — add ANTHROPIC_API_KEY in the Vercel project settings." }, { status: 503 });
  }
  const { image, mediaType } = (await request.json().catch(() => ({}))) as { image?: string; mediaType?: string };
  if (!image || !mediaType || !MEDIA.has(mediaType) || image.length > 5_500_000) {
    return Response.json({ error: "Please send a JPEG, PNG or WebP photo." }, { status: 400 });
  }

  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(Guess) },
      system:
        "You identify die-cast model airliners from a collector's photo. Work from what is visible: livery colours and titles, tail logo, " +
        "engine count and position, fuselage length, wingtip shape, window line, any registration, and any text on a box or stand. " +
        "Only report a registration, brand or scale you can actually read. If unsure of the exact variant give the family-level type. " +
        `Family list: ${Object.keys(FACTS).join("; ")}. Model brands in the catalogue: ${catalogMeta().brands.join(", ")}.`,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: image } },
            { type: "text", text: "Which aircraft model is this?" },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "I couldn't work out what's in that photo. Try another angle with the tail and side visible." }, { status: 422 });
    }
    const guess = response.parsed_output;
    const matches = guess.is_model_aircraft
      ? matchGuess({ ...guess, keywords: [...guess.keywords, ...(guess.livery ? guess.livery.split(/\s+/) : [])] })
      : [];
    return Response.json({ guess, matches: matches.map((m) => ({ ...m.model, score: Math.round(m.score) })) });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY." }, { status: 503 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Too many requests right now — try again in a minute." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("identify failed", error.status, error.message);
      return Response.json({ error: "The identification service had a problem. Please try again." }, { status: 502 });
    }
    throw error;
  }
}
