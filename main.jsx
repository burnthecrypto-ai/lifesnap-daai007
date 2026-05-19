import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const MODES = [
  "Talk through my day",
  "Just sort tasks",
  "Prepare for an appointment",
  "Record a health note",
  "Capture a memory",
  "Draft a letter",
  "Sort life admin",
  "Update Legacy Vault",
  "Just chat"
];

const MODE_QUESTIONS = {
  "Talk through my day": [
    "What happened today?",
    "What is sitting heaviest in your head?",
    "What needs remembering?",
    "What would help tomorrow?"
  ],
  "Just sort tasks": [
    "What tasks are floating around?",
    "Which ones are urgent?",
    "Which ones can wait?",
    "What should be on tomorrow’s list?"
  ],
  "Prepare for an appointment": [
    "What is the appointment for?",
    "What background does the person need?",
    "What documents or dates matter?",
    "What do you want to ask?"
  ],
  "Record a health note": [
    "What changed or happened?",
    "When did it start?",
    "What symptoms or concerns matter?",
    "What do you want to ask a professional next?"
  ],
  "Capture a memory": [
    "What do you want to remember?",
    "Who was involved?",
    "Where did it happen?",
    "Why does it matter?"
  ],
  "Draft a letter": [
    "Who is the letter for?",
    "What outcome do you want?",
    "What facts must be included?",
    "What tone should it use?"
  ],
  "Sort life admin": [
    "Which area of admin is messy?",
    "Which accounts, bills, providers or documents are involved?",
    "Are there dates or deadlines?",
    "What is the next action?"
  ],
  "Update Legacy Vault": [
    "What should trusted people know?",
    "Where are the important documents kept?",
    "Who should be contacted?",
    "What should not be forgotten?"
  ],
  "Just chat": [
    "What do you want to talk through?",
    "What part feels most tangled?",
    "What would make this clearer?",
    "What should I put in order for you?"
  ]
};

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

function hasUrgentLanguage(text) {
  const lowered = text.toLowerCase();
  return URGENT_WORDS.some((word) => lowered.includes(word));
}

function extractDates(text) {
  const matches = text.match(/\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|20\d{2}|19\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi);
  return matches ? [...new Set(matches)].slice(0, 8) : [];
}

function fallbackSnapshot({ mode, rawInput, answers }) {
  const date = new Date().toLocaleDateString();
  const combined = [rawInput, ...answers.map((item) => item.answer)].join(" ");
  const dates = extractDates(combined);
  const answerBlock = answers
    .map((item, index) => `${index + 1}. ${item.question}\n${item.answer || "[Skipped]"}`)
    .join("\n\n");

  return `LifeSnap Snapshot
Generated: ${date}
Mode: ${mode}

USER GOAL
${answers[0]?.answer || "Put this into order."}

PLAIN-LANGUAGE SUMMARY
${rawInput}

KEY FACTS CAPTURED
${answerBlock}

TIMELINE OR KEY EVENTS
${dates.length ? dates.map((item) => `- ${item}`).join("\n") : "- No clear dates detected yet. Add dates if they matter."}

DOCUMENTS / ITEMS MENTIONED
- Add any documents, photos, accounts, bills, letters, reports or reference numbers mentioned.
- Do not add raw passwords, private keys, card numbers or banking logins.

CONCERNS OR PRIORITIES
- Clarify what needs action first.
- Identify deadlines.
- Separate facts from assumptions.

MISSING INFORMATION
- Exact dates
- Names of organisations or professionals
- Document locations
- Reference numbers
- What has already been tried or completed

SUGGESTED ORGANISING STEPS
1. Add missing dates.
2. List documents or evidence in one place.
3. Identify the next person or organisation to contact.
4. Prepare questions before the next call, appointment or meeting.
5. Review this snapshot after new information arrives.

QUESTIONS TO ASK A RELEVANT PROFESSIONAL OR SUPPORT PERSON
- What information do you need from me?
- What document or reference number matters most?
- What is the next step?
- What deadline should I know about?
- Who should I contact if this is not the right department?

BOUNDARY NOTE
LifeSnap is an organisational tool. It does not provide medical, legal, financial, therapeutic, emergency, probate, executor, banking, diagnosis, treatment or credential-storage services.

NEXT REVIEW DATE
Review this snapshot within 7 days, or sooner if you receive new information.`;
}

function App() {
  const [mode, setMode] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [stage, setStage] = useState("choose");
  const [answers, setAnswers] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [snapshot, setSnapshot] = useState("");
  const [copied, setCopied] = useState(false);
  const [backendStatus, setBackendStatus] = useState("Local fallback ready");

  const questions = useMemo(() => MODE_QUESTIONS[mode] || [], [mode]);

  function reset() {
    setMode("");
    setRawInput("");
    setStage("choose");
    setAnswers([]);
    setQuestionIndex(0);
    setDraft("");
    setSnapshot("");
    setCopied(false);
    setBackendStatus("Local fallback ready");
  }

  function startSelectedMode(selectedMode) {
    setMode(selectedMode);
    setStage("input");
  }

  function organiseInput() {
    if (!rawInput.trim()) return;

    if (hasUrgentLanguage(rawInput)) {
      setStage("safety");
      return;
    }

    setAnswers([]);
    setQuestionIndex(0);
    setDraft("");
    setStage("questions");
  }

  function saveAnswer(skip = false) {
    const nextAnswers = [
      ...answers,
      {
        question: questions[questionIndex],
        answer: skip ? "" : draft.trim()
      }
    ];

    setAnswers(nextAnswers);
    setDraft("");

    if (questionIndex >= questions.length - 1) {
      generateFinal(nextAnswers);
      return;
    }

    setQuestionIndex(questionIndex + 1);
  }

  async function generateFinal(finalAnswers) {
    const local = fallbackSnapshot({ mode, rawInput, answers: finalAnswers });
    setSnapshot(local);
    setStage("snapshot");

    try {
      const response = await fetch("/api/lifesnap-brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, rawInput, answers: finalAnswers })
      });

      if (!response.ok) {
        setBackendStatus("Backend unavailable. Using local fallback.");
        return;
      }

      const data = await response.json();

      if (data?.mode === "snapshot" && data?.snapshot) {
        const remote = formatRemoteSnapshot(data.snapshot);
        setSnapshot(remote);
        setBackendStatus("LifeSnap Brain response loaded.");
      } else if (data?.mode === "fallback") {
        setBackendStatus("Nebius key not configured. Using local fallback.");
      } else {
        setBackendStatus("Backend returned non-standard output. Using local fallback.");
      }
    } catch {
      setBackendStatus("Backend route not connected yet. Using local fallback.");
    }
  }

  function formatRemoteSnapshot(s) {
    return `LifeSnap Snapshot
Title: ${s.title || "LifeSnap Snapshot"}
Vertical: ${s.vertical || mode}

USER GOAL
${s.userGoal || ""}

PLAIN-LANGUAGE SUMMARY
${s.plainLanguageSummary || ""}

KEY FACTS
${(s.keyFacts || []).map((item) => `- ${item}`).join("\n")}

TIMELINE OR EVENTS
${(s.timelineOrEvents || []).map((item) => `- ${item}`).join("\n")}

DOCUMENTS MENTIONED
${(s.documentsMentioned || []).map((item) => `- ${item}`).join("\n")}

CONCERNS OR PRIORITIES
${(s.concernsOrPriorities || []).map((item) => `- ${item}`).join("\n")}

MISSING INFORMATION
${(s.missingInformation || []).map((item) => `- ${item}`).join("\n")}

SUGGESTED ORGANISING STEPS
${(s.suggestedOrganisingSteps || []).map((item, i) => `${i + 1}. ${item}`).join("\n")}

QUESTIONS TO ASK
${(s.questionsToAsk || []).map((item) => `- ${item}`).join("\n")}

BOUNDARY NOTE
${s.boundaryNote || "LifeSnap is an organisational tool."}

NEXT REVIEW DATE
${s.nextReviewDate || "Review within 7 days."}`;
  }

  async function copySnapshot() {
    try {
      await navigator.clipboard.writeText(snapshot);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      window.alert("Copy failed. Select and copy manually.");
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="mark">DA</div>
          <div>
            <strong>LifeSnap</strong>
            <span>by DAAI007</span>
          </div>
        </div>
        <a href="#founder" className="navBtn">Founder Pilot</a>
      </header>

      <main>
        <section className="hero">
          <p className="kicker">Everything sorted. Everything in order.</p>
          <h1>Talk it out.<br />We put it in order.</h1>
          <p className="lede">
            LifeSnap is a daily AI companion for diary, tasks, appointment prep, health notes,
            memories, admin, letters and legacy organisation.
          </p>
        </section>

        <section className="appCard">
          {stage === "choose" && (
            <>
              <p className="pill">Start here</p>
              <h2>What do you want to do today?</h2>
              <div className="modeGrid">
                {MODES.map((item) => (
                  <button key={item} className={item === "Talk through my day" ? "mode primaryMode" : "mode"} onClick={() => startSelectedMode(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </>
          )}

          {stage === "input" && (
            <div className="panel">
              <p className="pill">{mode}</p>
              <h2>Talk it out</h2>
              <textarea
                value={rawInput}
                onChange={(event) => setRawInput(event.target.value)}
                rows="9"
                placeholder="Type the messy version here..."
              />
              <div className="row">
                <button className="button primary" onClick={organiseInput}>Put it in order</button>
                <button className="button ghost" onClick={reset}>Start over</button>
              </div>
            </div>
          )}

          {stage === "safety" && (
            <div className="panel danger">
              <h2>Immediate support may be needed</h2>
              <p>
                LifeSnap is not equipped for emergencies. If there is immediate danger, self-harm risk,
                abuse risk, severe medical symptoms, or urgent crisis, contact local emergency services or a qualified professional now.
              </p>
              <button className="button secondary" onClick={reset}>Start over</button>
            </div>
          )}

          {stage === "questions" && (
            <div className="panel">
              <p className="pill">Question {questionIndex + 1} of {questions.length}</p>
              <div className="bar"><span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div>
              <h2>{questions[questionIndex]}</h2>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows="5" placeholder="Answer in your own words..." />
              <div className="row">
                <button className="button primary" onClick={() => saveAnswer(false)}>
                  {questionIndex === questions.length - 1 ? "Generate Snapshot" : "Next"}
                </button>
                <button className="button secondary" onClick={() => saveAnswer(true)}>Skip</button>
              </div>
            </div>
          )}

          {stage === "snapshot" && (
            <div className="panel">
              <div className="snapHead">
                <div>
                  <p className="pill">Snapshot ready</p>
                  <h2>Your LifeSnap Snapshot</h2>
                  <p>{backendStatus}</p>
                </div>
                <div className="row">
                  <button className="button secondary" onClick={copySnapshot}>{copied ? "Copied" : "Copy"}</button>
                  <button className="button secondary" onClick={() => window.print()}>Print / Save PDF</button>
                  <button className="button ghost" onClick={reset}>New</button>
                </div>
              </div>
              <pre>{snapshot}</pre>
            </div>
          )}
        </section>

        <section id="founder" className="salesCard">
          <p className="pill">Founder Pilot</p>
          <h2>LifeSnap Companion Founder Pilot</h2>
          <p>$39 for the first month. Limited early-access pilot for daily or near-daily check-ins, private diary/task entry, task extraction, tomorrow list, weekly summary and early app access.</p>
          <ul>
            <li>Daily or near-daily companion check-in</li>
            <li>Private diary or task entry</li>
            <li>Task extraction and tomorrow reminder list</li>
            <li>Weekly LifeSnap summary</li>
            <li>Early access to the app build</li>
          </ul>
          <p className="small">Not therapy. Not medical advice. Not legal, financial, diagnostic or emergency support.</p>
        </section>

        <section className="boundary">
          <h2>Boundary</h2>
          <p>
            LifeSnap is an organisational tool. It does not provide medical, legal, financial,
            therapeutic, emergency, probate, executor, banking, diagnosis, treatment or credential-storage services.
          </p>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
