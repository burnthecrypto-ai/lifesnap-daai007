const NEBIUS_BASE_URL = process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1";
const MODEL_ID = process.env.NEBIUS_MODEL_ID || "MODEL_ID";

const URGENT_WORDS = [
  "suicide",
  "self-harm",
  "self harm",
  "emergency",
  "can't breathe",
  "cant breathe",
  "immediate danger",
  "abuse",
  "unsafe",
  "crisis",
  "kill myself",
  "hurt myself",
  "not safe"
];

function hasUrgentLanguage(text = "") {
  const lowered = text.toLowerCase();
  return URGENT_WORDS.some((word) => lowered.includes(word));
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON body" });
  }

  const rawInput = String(body.rawInput || "").trim();
  const mode = String(body.mode || "General LifeSnap").trim();
  const answers = Array.isArray(body.answers) ? body.answers : [];

  if (!rawInput) {
    return sendJson(res, 400, { error: "rawInput is required" });
  }

  if (hasUrgentLanguage(rawInput)) {
    return sendJson(res, 200, {
      mode: "safety",
      snapshot: {
        title: "Immediate support may be needed",
        vertical: "Safety Notice",
        summary:
          "This tool is not equipped for emergencies. If there is immediate danger, self-harm risk, abuse risk, severe medical symptoms, or urgent crisis, contact local emergency services or a qualified professional now.",
        nextSteps: [
          "Contact local emergency services if immediate danger exists.",
          "Contact a trusted person now if safe to do so.",
          "Do not use LifeSnap as a substitute for emergency support."
        ]
      }
    });
  }

  if (!process.env.NEBIUS_API_KEY) {
    return sendJson(res, 200, {
      mode: "fallback",
      snapshot: null,
      warning: "NEBIUS_API_KEY is not configured. Frontend should use local fallback generation."
    });
  }

  const systemPrompt = `
You are LifeSnap Brain by DAAI007.

Mission:
Turn messy personal information into structured organisational outputs.

Hard boundaries:
- Do not diagnose, treat, prescribe, or claim medical certainty.
- Do not provide legal, financial, therapy, probate, executor, banking, or emergency advice.
- Do not ask for raw passwords, PINs, private keys, card numbers, banking logins, or secret credentials.
- If urgent danger or self-harm appears, return mode "safety" and stop normal workflow.
- Keep output practical, calm, organised, and consent-first.
- Return JSON only.

Output schema:
{
  "mode": "snapshot",
  "snapshot": {
    "title": string,
    "vertical": string,
    "userGoal": string,
    "plainLanguageSummary": string,
    "keyFacts": string[],
    "timelineOrEvents": string[],
    "documentsMentioned": string[],
    "concernsOrPriorities": string[],
    "missingInformation": string[],
    "suggestedOrganisingSteps": string[],
    "questionsToAsk": string[],
    "boundaryNote": string,
    "nextReviewDate": string
  }
}`;

  try {
    const response = await fetch(`${NEBIUS_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NEBIUS_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify({ rawInput, mode, answers }) }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const details = await response.text();
      return sendJson(res, 502, {
        error: "Nebius backend request failed",
        details
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    try {
      return sendJson(res, 200, JSON.parse(content));
    } catch {
      return sendJson(res, 200, {
        mode: "raw",
        snapshot: null,
        raw: content
      });
    }
  } catch (error) {
    return sendJson(res, 500, {
      error: "LifeSnap Brain server error",
      message: error.message
    });
  }
}
