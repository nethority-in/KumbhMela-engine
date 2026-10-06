"use strict";

/* The answer engine.
   Pure functions: (message, data, lang) -> { intent, text }.
   No network, no Meta, no LLM. Every fact is read from the JSON artifacts.
   If a fact is not in the JSON, the bot says so instead of guessing. */

const { T, DATES } = require("./i18n");

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function detectLang(text) {
  const t = text.toLowerCase();
  if (/[ऀ-ॿ]/.test(text)) {
    /* Hindi-exclusive forms first: "kitni" is Hindi, "kiti" is Marathi, and
       shared words like "bheed" tell us nothing on their own. */
    const hiOnly = [
      "कितनी",
      "क्या",
      "कैसे",
      "कौन",
      "क्यों",
      "कब",
      "और",
      "मुझे",
      "बताइए",
      "बताएं",
      "जानना",
      "चाहिए",
      "कितने",
    ];
    if (hiOnly.some((w) => t.includes(w))) return "hi";
    const mrOnly = [
      "किती",
      "आहे",
      "आहेत",
      "काय",
      "कुठे",
      "कुठला",
      "कुठली",
      "नमस्कार",
      "मेळा",
      "भेड",
      "भीड",
      "स्नानाचे",
      "स्नानाचा",
      "दिवसाचे",
      "आणि",
      "आणीबाणी",
      "आणिबाणी",
      "क्रमांक",
      "माहिती",
      "सांग",
      "दिले",
      "नाही",
      "पोहोच",
      "अंदाज",
      "स्वागत",
    ];
    if (mrOnly.some((w) => t.includes(w))) return "mr";
    return "hi";
  }
  return "en";
}

/* Keep Devanagari combining marks (\p{M}) - stripping them destroys Hindi and
   Marathi words, which would silently break every intent match in those languages. */
function norm(s) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Order matters: the first match wins, so the more specific intents come first.
   "reach" precedes "waters" because a Hindi question like "कैसे पहुंचें नाशिक"
   contains नाशिक, and would otherwise be answered about the water instead of travel. */
const INTENTS = [
  {
    id: "thanks",
    any: ["thanks", "thank you", "dhanyavad", "धन्यवाद", "आभारी"],
  },
  {
    id: "helpline",
    any: [
      "emergency",
      "helpline",
      "help",
      "112",
      "police",
      "ambulance",
      "आपात",
      "मदद",
      "112",
      "पोलीस",
      "अंबुलेंस",
      "आणीबाणी",
      "आणिबाणी",
      "मदत",
    ],
  },
  {
    id: "akhara",
    any: [
      "akhara",
      "sadhu",
      "order",
      "sect",
      "अखारा",
      "साधु",
      "संप्रदाय",
      "अखारे",
      "संत",
    ],
  },
  /* "कुठे" is deliberately absent: it is a bare "where", so "त्रिम्बकेश्वर कुठे"
     is a question about the site, not about travel. Travel needs पोहोचे/गाडी. */
  {
    id: "reach",
    any: [
      "reach",
      "how to go",
      "train",
      "bus",
      "road",
      "airport",
      "station",
      "कैसे",
      "कसे",
      "पहुंच",
      "पोहोच",
      "ट्रेन",
      "बस",
      "सड़क",
      "सडक",
      "हवाई",
      "स्टेशन",
      "पोहोचे",
      "गाडी",
    ],
  },
  {
    id: "quiet",
    any: [
      "quiet",
      "less crowd",
      "less crowded",
      "fewer people",
      "calm",
      "peaceful",
      "low crowd",
      "शांत",
      "कम भीड़",
      "कम लोग",
      "शांत दिन",
      "शांतता",
      "शांत",
      "कमी भीड",
      "कमी लोक",
      "स्वच्छ",
    ],
  },
  {
    id: "crowd",
    any: [
      "crowd",
      "crowded",
      "busy",
      "how many people",
      "भीड़",
      "कितने लोग",
      "भिड",
      "भीड",
      "किती लोक",
    ],
  },
  {
    id: "waters",
    any: [
      "ramkund",
      "ram kund",
      "kushavarta",
      "trimbak",
      "nashik river",
      "which water",
      "where to bath",
      "रामकुंड",
      "कुषावर्त",
      "त्रिम्बकेश्वर",
      "नाशिक",
      "कौन सा जल",
      "पाणी",
      "स्नान",
    ],
  },
  {
    id: "dates",
    any: [
      "which day",
      "what day",
      "dates",
      "list",
      "all days",
      "auspicious",
      "कौन से दिन",
      "कौनसा दिन",
      "तारीख",
      "सभी दिन",
      "सूची",
      "शुभ दिन",
      "कोणते दिवस",
      "कोणता दिवस",
      "तारीखा",
      "सर्व दिवस",
      "यादी",
      "शुभ दिवस",
    ],
  },
  {
    id: "greet",
    any: [
      "hi",
      "hello",
      "hey",
      "namaste",
      "namaskar",
      "start",
      "नमस्ते",
      "नमस्कार",
      "शुरू",
      "मदद",
      "हेलो",
      "नमस्",
    ],
  },
];

/* Explicit date request, e.g. "2 august", "aug 31", "11 september", "31/8/2027".
   The month token allows trailing letters so "august" and "september" match their
   three-letter prefix; a trailing \b would reject them, because "aug" is not a word
   boundary inside "august". */
const MAP = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const DAY_THEN_MONTH = new RegExp(
  "\\b(\\d{1,2})\\s*((?:" + Object.keys(MAP).join("|") + ")[a-z]*)",
);
const MONTH_THEN_DAY = new RegExp(
  "\\b((?:" + Object.keys(MAP).join("|") + ")[a-z]*)\\s*(\\d{1,2})",
);

function parseDate(raw) {
  const lower = raw.toLowerCase();
  const t = norm(lower);
  let m = t.match(DAY_THEN_MONTH);
  if (m) return { d: +m[1], m: MAP[m[2].slice(0, 3)] };
  m = t.match(MONTH_THEN_DAY);
  if (m) return { d: +m[2], m: MAP[m[1].slice(0, 3)] };
  /* slashed form must be matched on the raw text, since norm() flattens the slashes */
  m = lower.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) return { d: +m[1], m: +m[2], y: m[3] };
  return null;
}

function fmtDay(iso, lang) {
  const dt = new Date(iso + "T12:00:00+05:30");
  const months = {
    en: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    hi: [
      "जनवरी",
      "फ़रवरी",
      "मार्च",
      "अप्रैल",
      "मई",
      "जून",
      "जुलाई",
      "अगस्त",
      "सितंबर",
      "अक्तूबर",
      "नवंबर",
      "दिसंबर",
    ],
    mr: [
      "जानेवारी",
      "फेब्रुवारी",
      "मार्च",
      "एप्रिल",
      "मे",
      "जून",
      "जुलै",
      "ऑगस्ट",
      "सप्टेंबर",
      "ऑक्टोबर",
      "नोव्हेंबर",
      "डिसेंबर",
    ],
  };
  return `${dt.getDate()} ${months[lang][dt.getMonth()]} ${dt.getFullYear()}`;
}

function tagFor(day, lang) {
  const D = DATES[lang];
  if (day.classification === "amrit_snan") return D.royalTag;
  if (day.classification === "parva_snan_major") return D.majorTag;
  return D.minorTag;
}

function build(t, lines) {
  return lines.concat(["", t.tail]).join("\n");
}

function quietDays(days, n) {
  return days
    .filter((d) => d.classification !== "amrit_snan")
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, n);
}

function royalDays(days) {
  return days
    .filter((d) => d.classification === "amrit_snan")
    .sort((a, b) => a.score - b.score);
}

function answer(message, data, langIn) {
  const lang = langIn || detectLang(message);
  const t = T[lang];
  const D = DATES[lang];
  const days = (data.calendar && data.calendar.days) || [];

  if (!days.length) return { intent: "nodata", lang, text: t.noData };

  const text = norm(message);
  if (!text) return { intent: "greet", lang, text: t.greet };

  /* a specific date always wins over a keyword */
  const pd = parseDate(message);
  if (pd) {
    const hit = days.find(
      (d) =>
        +d.gregorian_date.slice(8, 10) === pd.d &&
        +d.gregorian_date.slice(5, 7) === pd.m,
    );
    if (hit) {
      const lines = [
        `${fmtDay(hit.gregorian_date, lang)} - ${tagFor(hit, lang)}`,
        `${D.bandLine(hit.band)} · ${t.estimateWord.toLowerCase()}`,
        hit.headline_reason,
      ];
      if (hit.panchang) lines.push("", D.panchang(hit.panchang));
      return { intent: "day_detail", lang, text: build(t, lines) };
    }
  }

  let intent = null;
  for (const i of INTENTS) {
    if (i.any.some((k) => text.includes(k))) {
      intent = i.id;
      break;
    }
  }

  switch (intent) {
    case "thanks":
      return { intent, lang, text: t.thanks };

    case "greet":
      return { intent, lang, text: t.greet };

    case "helpline": {
      const nums =
        (data.golden.helplines && data.golden.helplines.numbers) || [];
      const lines = [t.helplineHeadline, ""];
      for (const n of nums) {
        if (n.confidence === "confirmed")
          lines.push(`${n.label_en}: ${n.number}`);
      }
      lines.push("", t.helplineMela);
      return { intent, lang, text: build(t, lines) };
    }

    case "akhara":
      return {
        intent,
        lang,
        text: build(t, [t.watersHeadline, "", t.akharaNote]),
      };

    case "waters":
      return {
        intent,
        lang,
        text: build(t, [
          t.watersHeadline,
          "",
          `· ${t.watersRam}`,
          `· ${t.watersKush}`,
          "",
          t.watersNote,
        ]),
      };

    case "quiet": {
      const picks = quietDays(days, 3);
      const lines = [t.quietHeadline, "", t.quietIntro, ""];
      for (const d of picks) {
        lines.push(`· ${fmtDay(d.gregorian_date, lang)} - ${D.estTag(d.band)}`);
      }
      lines.push("", `${D.quietNote} ${t.quietWhy}`);
      return { intent, lang, text: build(t, lines) };
    }

    case "crowd": {
      const royals = royalDays(days);
      const lines = [t.crowdHeadline, "", t.crowdBands, "", t.crowdPeak, ""];
      for (const d of royals) {
        lines.push(
          `· ${fmtDay(d.gregorian_date, lang)} - ${D.bandLine(d.band)} (${t.estimateWord.toLowerCase()})`,
        );
      }
      return { intent, lang, text: build(t, lines) };
    }

    case "reach":
      return {
        intent,
        lang,
        text: build(t, [t.reachMsg, "", t.reachNoGuess]),
      };

    case "dates": {
      const royals = royalDays(days);
      const lines = [t.royalHeadline, "", t.royalIntro, ""];
      for (const d of royals)
        lines.push(
          `· ${fmtDay(d.gregorian_date, lang)} - ${D.bandLine(d.band)} (${t.estimateWord.toLowerCase()})`,
        );
      lines.push(
        "",
        t.allDaysIntro,
        "",
        `· ${days.length} days in total, from ${fmtDay(days[0].gregorian_date, lang)} to ${fmtDay(days[days.length - 1].gregorian_date, lang)}.`,
      );
      lines.push(
        "Ask for quieter days and I will list the least crowded ones.",
      );
      return { intent, lang, text: build(t, lines) };
    }

    default:
      return { intent: "unknown", lang, text: t.unknown };
  }
}

module.exports = {
  answer,
  detectLang,
  parseDate,
  fmtDay,
  quietDays,
  royalDays,
};
