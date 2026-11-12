import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all2) => {
  for (var name2 in all2)
    __defProp(target, name2, { get: all2[name2], enumerable: true });
};

// src/host/store.ts
import { mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
function dataDir() {
  const base = process.env.DSH_HOME || join(homedir(), ".dsh");
  const dir = join(base, "telleru-whiteboard");
  mkdirSync(join(dir, "boards"), { recursive: true });
  return dir;
}
function newBoardId() {
  return "wb_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function loadBoard(id) {
  if (!ID_RE.test(id)) return null;
  const hit = cache.get(id);
  if (hit) return hit;
  const f = fileOf(id);
  if (!existsSync(f)) return null;
  try {
    const b = JSON.parse(readFileSync(f, "utf8"));
    cache.set(id, b);
    return b;
  } catch {
    return null;
  }
}
function saveBoard(b, immediate = false) {
  b.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  cache.set(b.id, b);
  const write = () => {
    timers.delete(b.id);
    const f = fileOf(b.id);
    writeFileSync(f + ".tmp", JSON.stringify(b));
    renameSync(f + ".tmp", f);
  };
  const t = timers.get(b.id);
  if (t) clearTimeout(t);
  if (immediate) write();
  else timers.set(b.id, setTimeout(write, 300));
}
function flushAll() {
  for (const [id, t] of timers) {
    clearTimeout(t);
    const b = cache.get(id);
    if (b) saveBoard(b, true);
  }
}
function boardsOfSession(sessionId) {
  const out = [];
  for (const f of readdirSync(join(dataDir(), "boards"))) {
    if (!f.endsWith(".json")) continue;
    const b = loadBoard(f.slice(0, -5));
    if (b && b.sessionId === sessionId) out.push(b);
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
function sectionRef(sid) {
  const m = /^(wb_[a-z0-9]+)~(\d{1,2})$/.exec(sid);
  if (!m) return null;
  const board = loadBoard(m[1]);
  const section = board?.sections[Number(m[2])];
  return board && section ? { board, section } : null;
}
function chunkSource(text2) {
  const paras = text2.replace(/\r/g, "").split(/\n{1,}/).map((x) => x.trim()).filter(Boolean);
  const chunks = [];
  let buf = "";
  const push = () => {
    if (buf.trim()) chunks.push({ id: `src${chunks.length + 1}`, idx: chunks.length, heading: null, text: buf.trim() });
    buf = "";
  };
  for (const p of paras) {
    if (buf && buf.length + p.length > 360) push();
    buf += (buf ? "\n" : "") + p;
  }
  push();
  return chunks;
}
var cache, fileOf, ID_RE, timers, sidOf;
var init_store = __esm({
  "src/host/store.ts"() {
    cache = /* @__PURE__ */ new Map();
    fileOf = (id) => join(dataDir(), "boards", `${id}.json`);
    ID_RE = /^wb_[a-z0-9]{6,24}$/;
    timers = /* @__PURE__ */ new Map();
    sidOf = (boardId, index) => `${boardId}~${index}`;
  }
});

// src/host/shims/db.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join2 } from "node:path";
function putRow(table, row) {
  mkdirSync2(join2(dataDir(), table), { recursive: true });
  writeFileSync2(rowFile(table, String(row.id)), JSON.stringify(row));
}
function getRow(table, id) {
  const f = rowFile(table, String(id));
  try {
    return existsSync2(f) ? JSON.parse(readFileSync2(f, "utf8")) : void 0;
  } catch {
    return void 0;
  }
}
function withSource(s, fn) {
  return scoped.run(s, fn);
}
function get(sql, ...args) {
  const t = /FROM (lesson_html|lesson_images) WHERE id=\?/.exec(sql);
  if (t) return getRow(t[1], args[0]);
  const s = scoped.getStore();
  if (!s) return void 0;
  if (/FROM runs WHERE id=\? AND user_id=\?/.test(sql)) return args[0] === s.setId ? { ok: 1 } : void 0;
  if (/FROM web_sources WHERE run_id=\? AND url=\?/.test(sql)) return args[0] === s.setId && args[1] === s.url ? { id: s.setId + ":src", title: s.title } : void 0;
  return void 0;
}
function all(sql, ...args) {
  const s = scoped.getStore();
  if (!s) return [];
  if (/FROM web_chunks c JOIN web_sources s/.test(sql) && args[0] === s.setId + ":src")
    return s.chunks.map((c) => ({ ...c, title: s.title, url: s.url, site: "\u5BF9\u8BDD", authoritative: 1 }));
  return [];
}
function run(sql, ...args) {
  const m = /INSERT INTO (lesson_html|lesson_images)\(([^)]+)\)/.exec(sql);
  if (m) {
    const cols = m[2].split(",").map((x) => x.trim());
    putRow(m[1], Object.fromEntries(cols.map((c, i) => [c, args[i]])));
    return { changes: 1 };
  }
  return { changes: 0 };
}
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function track(..._a) {
}
var scoped, rowFile, DATA_DIR;
var init_db = __esm({
  "src/host/shims/db.ts"() {
    init_store();
    scoped = new AsyncLocalStorage();
    rowFile = (table, id) => join2(dataDir(), table, `${id.replace(/[^a-z0-9_]/gi, "")}.json`);
    DATA_DIR = "";
  }
});

// ../../src/lib/textwidth.ts
function tlen(s) {
  const cjk = (s.match(CJK) ?? []).length;
  return cjk + Math.ceil((s.length - cjk) / 2);
}
function isLatinText(s) {
  const t = s.replace(/\s+/g, "");
  if (!t) return false;
  return (t.match(CJK) ?? []).length < t.length * 0.05;
}
function detectLang(s) {
  const t = s.replace(/[\s\d\p{P}\p{S}]+/gu, "");
  if (t.length < 2) return null;
  return isLatinText(t) ? "en" : "zh";
}
var CJK;
var init_textwidth = __esm({
  "../../src/lib/textwidth.ts"() {
    CJK = /[㐀-鿿豈-﫿]/g;
  }
});

// ../../src/lib/lang.ts
import { AsyncLocalStorage as AsyncLocalStorage2 } from "node:async_hooks";
function withLang(lang, fn) {
  return als.run(lang === "en" ? "en" : "zh", fn);
}
function contentLang() {
  return als.getStore() ?? "zh";
}
function langDirective() {
  if (contentLang() !== "en") return null;
  return [
    "OUTPUT LANGUAGE \u2014 this course is taught in ENGLISH.",
    "Write every learner-facing string in natural, clear English: titles, narration (say text), board text / labels / captions / table cells, quiz prompts, options and explanations, check questions, expected answers and common errors, feedback, summaries, glossary, hints, image panel lines and labels, everything the learner sees or hears \u2014 even though the instructions and examples above are written in Chinese.",
    "Keep JSON keys, enum values (type, kind, variant, shape, style, role, etc.), ids and chunk ids exactly as specified. Do not translate code, formulas or quoted source text: quote source material verbatim in its original language.",
    "Length limits written as\u300C\u2264 N \u5B57\u300Dmean N Chinese characters; for English allow about 2 characters per \u5B57 (e.g. \u2264 80 \u5B57 \u2192 \u2264 160 characters, about 25 words).",
    'Address the learner as "you". Use English punctuation.'
  ].join("\n");
}
var als, L;
var init_lang = __esm({
  "../../src/lib/lang.ts"() {
    init_db();
    init_textwidth();
    init_textwidth();
    als = new AsyncLocalStorage2();
    L = (zh, en) => contentLang() === "en" ? en : zh;
  }
});

// src/host/shims/llm.ts
var llm_exports = {};
__export(llm_exports, {
  LLMError: () => LLMError,
  chat: () => chat,
  chatJSON: () => chatJSON,
  chatStream: () => chatStream,
  hasLLM: () => hasLLM,
  isModelUnavailable: () => isModelUnavailable,
  localize: () => localize,
  providerLabel: () => providerLabel,
  setBridge: () => setBridge,
  withBridge: () => withBridge
});
import { AsyncLocalStorage as AsyncLocalStorage3 } from "node:async_hooks";
function setBridge(b) {
  bridge = b;
}
function withBridge(b, fn) {
  return scoped2.run(b, fn);
}
function current() {
  return scoped2.getStore() ?? bridge;
}
function hasLLM() {
  return !!current();
}
function providerLabel() {
  return "host";
}
function isModelUnavailable(e) {
  return e instanceof LLMError && e.code === "MODEL_UNAVAILABLE";
}
function localize(messages) {
  const d = langDirective();
  if (!d) return messages;
  const out = messages.map((m) => ({ ...m }));
  const sys = out.find((m) => m.role === "system");
  if (sys) sys.content += `

${d}`;
  else out.unshift({ role: "system", content: d });
  for (let i = out.length - 1; i >= 0; i--) if (out[i].role === "user") {
    out[i].content += "\n\n(Write all learner-facing text in English.)";
    break;
  }
  return out;
}
function flatten(messages) {
  const m = localize(messages);
  const system = m.filter((x) => x.role === "system").map((x) => x.content).join("\n\n");
  const rest = m.filter((x) => x.role !== "system");
  const user = rest.length === 1 ? rest[0].content : rest.map((x) => x.role === "assistant" ? `\u3010\u4F60\u4E0A\u4E00\u8F6E\u7684\u8F93\u51FA\u3011
${x.content}` : x.content).join("\n\n");
  return { system, user };
}
async function chat(messages, opts = {}) {
  const b = current();
  if (!b) throw new LLMError("MODEL_UNAVAILABLE", "\u5BBF\u4E3B\u6A21\u578B\u4E0D\u53EF\u7528");
  const { system, user } = flatten(messages);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12e4);
  try {
    let out = "";
    for await (const piece of b({ system, user, temperature: opts.temperature ?? 0.4, maxTokens: opts.maxTokens ?? 4096, signal: ctrl.signal })) out += piece;
    if (!out) throw new LLMError("MODEL_ERROR", "empty completion");
    return out;
  } catch (e) {
    if (e instanceof LLMError) throw e;
    throw new LLMError("MODEL_ERROR", e.message);
  } finally {
    clearTimeout(timer);
  }
}
function extractJson(text2) {
  const fenced = text2.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text2;
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  if (start < 0 || end < start) throw new LLMError("MODEL_BAD_JSON", "no json found");
  return JSON.parse(body.slice(start, end + 1));
}
async function chatJSON(system, user, validate, opts = {}) {
  const messages = [
    { role: "system", content: system + "\n\n\u53EA\u8F93\u51FA\u4E00\u4E2A JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u8F93\u51FA\u4EFB\u4F55\u89E3\u91CA\u6216 Markdown\u3002" },
    { role: "user", content: user }
  ];
  let lastErr = "";
  for (let i = 0; i < 3; i++) {
    const raw = await chat(messages, { json: true, ...opts });
    try {
      const v = extractJson(raw);
      const problem = validate(v);
      if (!problem) return v;
      lastErr = problem;
    } catch (e) {
      lastErr = e.message;
    }
    messages.push({ role: "assistant", content: raw }, { role: "user", content: `\u4E0A\u9762\u7684\u8F93\u51FA\u4E0D\u5408\u683C\uFF1A${lastErr}\u3002\u8BF7\u4FEE\u6B63\u540E\u91CD\u65B0\u8F93\u51FA\u5B8C\u6574 JSON\u3002` });
  }
  throw new LLMError("MODEL_BAD_JSON", lastErr);
}
async function* chatStream(messages, opts = {}, signal) {
  const b = current();
  if (!b) throw new LLMError("MODEL_UNAVAILABLE", "\u5BBF\u4E3B\u6A21\u578B\u4E0D\u53EF\u7528");
  const { system, user } = flatten(messages);
  yield* b({ system, user, temperature: opts.temperature ?? 0.4, maxTokens: opts.maxTokens ?? 1200, signal });
}
var bridge, scoped2, LLMError;
var init_llm = __esm({
  "src/host/shims/llm.ts"() {
    init_lang();
    bridge = null;
    scoped2 = new AsyncLocalStorage3();
    LLMError = class extends Error {
      constructor(code, msg) {
        super(msg);
        this.code = code;
      }
    };
  }
});

// src/host/index.ts
import Schema from "@deepseek-ai/schemastery";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { readFileSync as readFileSync6, existsSync as existsSync6 } from "node:fs";
import { extname, join as join6, normalize } from "node:path";
import { fileURLToPath } from "node:url";

// ../../src/lib/ai/tasks.ts
init_lang();
init_llm();

// ../../src/lib/types.ts
var DEPTHS = ["\u5EFA\u7ACB\u76F4\u89C9", "\u6B63\u5F0F\u5B9A\u4E49", "\u516C\u5F0F\u63A8\u5BFC", "\u8FDB\u9636\u7406\u8BBA", "\u5E94\u7528\u5B9E\u64CD"];
var IMAGE_ROLES = ["concrete", "metaphor", "scene", "contrast", "story", "panorama", "hook", "mood"];

// ../../src/lib/materials.ts
init_db();
init_lang();

// stub:/home/claude/stm/src/lib/docparse.ts
var __stub = (n) => new Proxy(function() {
}, { apply() {
  return void 0;
}, get(t, k) {
  return k === Symbol.toPrimitive ? () => "" : k === "then" ? void 0 : __stub(n + "." + String(k));
} });
var LOGICAL_PAGE_CHARS = __stub("LOGICAL_PAGE_CHARS");
var decodeXml = __stub("decodeXml");
var docxHeadingStyles = __stub("docxHeadingStyles");
var docxBlocks = __stub("docxBlocks");
var splitLogical = __stub("splitLogical");
var parseDocxZip = __stub("parseDocxZip");
var slideTexts = __stub("slideTexts");
var parsePptxZip = __stub("parsePptxZip");
var parseOffice = __stub("parseOffice");
var pageText = __stub("pageText");

// stub:/home/claude/stm/src/lib/zip.ts
var __stub2 = (n) => new Proxy(function() {
}, { apply() {
  return void 0;
}, get(t, k) {
  return k === Symbol.toPrimitive ? () => "" : k === "then" ? void 0 : __stub2(n + "." + String(k));
} });
var isZip = __stub2("isZip");
var readZip = __stub2("readZip");
var zipText = __stub2("zipText");
var writeZip = __stub2("writeZip");

// stub:/home/claude/stm/src/lib/ocr.ts
var __stub3 = (n) => new Proxy(function() {
}, { apply() {
  return void 0;
}, get(t, k) {
  return k === Symbol.toPrimitive ? () => "" : k === "then" ? void 0 : __stub3(n + "." + String(k));
} });
var OCR_MIN_CONF = __stub3("OCR_MIN_CONF");
var tessdataDir = __stub3("tessdataDir");
var ocrAvailable = __stub3("ocrAvailable");
var enqueueOcr = __stub3("enqueueOcr");
var shutdownOcr = __stub3("shutdownOcr");
var cleanOcrText = __stub3("cleanOcrText");
var recognizeImage = __stub3("recognizeImage");
var imageSize = __stub3("imageSize");
var exifOrientation = __stub3("exifOrientation");
var encodePng = __stub3("encodePng");
var loadCanvas = __stub3("loadCanvas");
var prepareImage = __stub3("prepareImage");
var pdfPageImages = __stub3("pdfPageImages");

// stub:/home/claude/stm/src/lib/repo/index.ts
var __stub4 = (n) => new Proxy(function() {
}, { apply() {
  return void 0;
}, get(t, k) {
  return k === Symbol.toPrimitive ? () => "" : k === "then" ? void 0 : __stub4(n + "." + String(k));
} });
var REPO_LIMITS = __stub4("REPO_LIMITS");
var RepoError = __stub4("RepoError");
var parseRepoUrl = __stub4("parseRepoUrl");
var setRepoFetcherForTests = __stub4("setRepoFetcherForTests");
var filterRepo = __stub4("filterRepo");
var indexFile = __stub4("indexFile");
var chunkFile = __stub4("chunkFile");
var repoQuote = __stub4("repoQuote");
var repoMeta = __stub4("repoMeta");
var repoLabel = __stub4("repoLabel");
var blobUrl = __stub4("blobUrl");
var prepareRepo = __stub4("prepareRepo");
var repoQuoteView = __stub4("repoQuoteView");
var deleteRepoMaterial = __stub4("deleteRepoMaterial");
var confirmRepo = __stub4("confirmRepo");
var finalizeRepo = __stub4("finalizeRepo");
var repoView = __stub4("repoView");

// ../../src/lib/materials.ts
var MAX_FILE_BYTES = 100 * 1024 * 1024;
var RADICAL_SUPPLEMENT = {
  "\u2E81": "\u5382",
  "\u2E87": "\u51E0",
  "\u2E8C": "\u5C0F",
  "\u2E8D": "\u5C0F",
  "\u2E95": "\u5F50",
  "\u2E9F": "\u6BCD",
  "\u2EA0": "\u6C11",
  "\u2EA2": "\u6C34",
  "\u2EA9": "\u738B",
  "\u2EAE": "\u7AF9",
  "\u2EB6": "\u7F8A",
  "\u2EBB": "\u807F",
  "\u2EC1": "\u864E",
  "\u2EC4": "\u897F",
  "\u2EC5": "\u89C1",
  "\u2EC6": "\u89D2",
  "\u2EC9": "\u8D1D",
  "\u2ECB": "\u8F66",
  "\u2ED4": "\u95E8",
  "\u2ED3": "\u957F",
  "\u2ED8": "\u9752",
  "\u2ED9": "\u97E6",
  "\u2EDA": "\u9875",
  "\u2EDB": "\u98CE",
  "\u2EDC": "\u98DE",
  "\u2EDD": "\u98DF",
  "\u2EE2": "\u9A6C",
  "\u2EE3": "\u9AA8",
  "\u2EE4": "\u9B3C",
  "\u2EE5": "\u9C7C",
  "\u2EE6": "\u9E1F",
  "\u2EE8": "\u9EA6",
  "\u2EE9": "\u9EC4",
  "\u2EEC": "\u9F50",
  "\u2EEE": "\u9F7F",
  "\u2EF0": "\u9F99",
  "\u2EF3": "\u9F9F"
};
function normalizeText(raw) {
  let s = raw.replace(/[⼀-⿟豈-﫿]/g, (ch) => ch.normalize("NFKC"));
  s = s.replace(/[⺀-⻿]/g, (ch) => RADICAL_SUPPLEMENT[ch] ?? ch);
  s = s.replace(/\r/g, "");
  s = s.replace(/([^\n])\n(?=[^\n])/g, (m, a, off, full) => {
    const b = full[off + 2];
    const isCjk = (ch) => /[　-鿿＀-￯]/.test(ch);
    if (isCjk(a) || b && isCjk(b)) return a;
    return a + " ";
  });
  return s;
}
var G = globalThis;
var parsing = G.__matParsing ??= /* @__PURE__ */ new Set();
var ocrProgress = G.__matOcr ??= /* @__PURE__ */ new Map();
function grams(s) {
  const t = normalizeText(s).toLowerCase().replace(/[\s，。、；：！？（）()“”"'《》·\-—]/g, "");
  const out = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  const words = normalizeText(s).toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  return out.concat(words);
}
function scoreOverlap(query, text2) {
  const q = new Set(grams(query));
  if (q.size === 0) return 0;
  const tg = new Set(grams(text2));
  let hit = 0;
  q.forEach((g2) => tg.has(g2) && hit++);
  return hit / q.size;
}

// ../../src/lib/class-context.ts
init_db();
function contextBlock(history) {
  return history ? `

\u672C\u8282\u8BFE\u524D\u9762\u7684\u5BF9\u8BDD\uFF08\u6309\u65F6\u95F4\u5148\u540E\uFF0C\u6700\u540E\u4E00\u6761\u6700\u8FD1\uFF09\uFF1A
${history}
\u5B66\u751F\u8FD9\u6B21\u8BF4\u7684\u8BDD\uFF0C\u53EF\u80FD\u662F\u5BF9\u524D\u9762\u67D0\u53E5\u7684\u8865\u5145\u3001\u8FFD\u95EE\u6216\u7EA0\u6B63\uFF1A\u7ED3\u5408\u4E0A\u4E0B\u6587\u7406\u89E3\uFF0C\u4E0D\u8981\u628A\u5B83\u5F53\u6210\u5B64\u7ACB\u7684\u4E00\u53E5\u3002` : "";
}

// ../../src/lib/game.ts
init_textwidth();
var GAME_LIMITS = { label: 24, title: 24, instructions: 60, sortItems: [4, 10], buckets: [2, 4], orderItems: [3, 7], pairs: [3, 6] };
var nonEmpty = (s) => typeof s === "string" && s.trim().length > 0;
var idOk = (s) => nonEmpty(s) && /^[A-Za-z0-9_-]{1,24}$/.test(s);
function validateGame(v) {
  const g2 = v;
  if (!g2 || typeof g2 !== "object") return "game \u5FC5\u987B\u662F\u5BF9\u8C61";
  if (!nonEmpty(g2.title) || tlen(g2.title) > GAME_LIMITS.title) return `game.title \u5FC5\u987B\u662F 1\u2013${GAME_LIMITS.title} \u5B57`;
  if (!nonEmpty(g2.instructions) || tlen(g2.instructions) > GAME_LIMITS.instructions) return `game.instructions \u5FC5\u987B\u662F 1\u2013${GAME_LIMITS.instructions} \u5B57`;
  const labelOk = (s) => nonEmpty(s) && tlen(s) <= GAME_LIMITS.label;
  const uniq = (xs) => new Set(xs).size === xs.length;
  if (g2.type === "sort") {
    const [bMin, bMax] = GAME_LIMITS.buckets, [iMin, iMax] = GAME_LIMITS.sortItems;
    if (!Array.isArray(g2.buckets) || g2.buckets.length < bMin || g2.buckets.length > bMax) return `sort.buckets \u5FC5\u987B\u662F ${bMin}\u2013${bMax} \u4E2A\u7C7B\u522B`;
    if (!Array.isArray(g2.items) || g2.items.length < iMin || g2.items.length > iMax) return `sort.items \u5FC5\u987B\u662F ${iMin}\u2013${iMax} \u4E2A\u6761\u76EE`;
    for (const b of g2.buckets) if (!b || !idOk(b.id) || !labelOk(b.label)) return "sort \u6BCF\u4E2A\u7C7B\u522B\u9700\u8981 id\uFF08\u5B57\u6BCD\u6570\u5B57\uFF09\u4E0E \u2264 24 \u5B57\u7684 label";
    const bids = new Set(g2.buckets.map((b) => b.id));
    for (const it of g2.items) {
      if (!it || !idOk(it.id) || !labelOk(it.label)) return "sort \u6BCF\u4E2A\u6761\u76EE\u9700\u8981 id \u4E0E \u2264 24 \u5B57\u7684 label";
      if (!bids.has(it.bucket)) return `\u6761\u76EE\u300C${it.label}\u300D\u7684 bucket \u4E0D\u662F\u5DF2\u6709\u7C7B\u522B`;
    }
    if (!uniq([...g2.buckets.map((b) => b.id), ...g2.items.map((i) => i.id)])) return "sort \u7684 id \u4E0D\u80FD\u91CD\u590D";
    if (!uniq(g2.items.map((i) => i.label))) return "sort \u6761\u76EE label \u4E0D\u80FD\u91CD\u590D";
    for (const b of g2.buckets) if (!g2.items.some((i) => i.bucket === b.id)) return `\u7C7B\u522B\u300C${b.label}\u300D\u6CA1\u6709\u4EFB\u4F55\u6761\u76EE`;
    return null;
  }
  if (g2.type === "order") {
    const [mn, mx] = GAME_LIMITS.orderItems;
    if (!Array.isArray(g2.items) || g2.items.length < mn || g2.items.length > mx) return `order.items \u5FC5\u987B\u662F ${mn}\u2013${mx} \u6B65`;
    for (const it of g2.items) if (!it || !idOk(it.id) || !labelOk(it.label)) return "order \u6BCF\u6B65\u9700\u8981 id \u4E0E \u2264 24 \u5B57\u7684 label";
    if (!uniq(g2.items.map((i) => i.id)) || !uniq(g2.items.map((i) => i.label))) return "order \u7684 id / label \u4E0D\u80FD\u91CD\u590D";
    return null;
  }
  if (g2.type === "match") {
    const [mn, mx] = GAME_LIMITS.pairs;
    if (!Array.isArray(g2.pairs) || g2.pairs.length < mn || g2.pairs.length > mx) return `match.pairs \u5FC5\u987B\u662F ${mn}\u2013${mx} \u5BF9`;
    for (const p of g2.pairs) if (!p || !idOk(p.id) || !labelOk(p.left) || !nonEmpty(p.right) || p.right.length > 40) return "match \u6BCF\u5BF9\u9700\u8981 id\u3001\u2264 24 \u5B57\u7684 left \u4E0E \u2264 40 \u5B57\u7684 right";
    if (!uniq(g2.pairs.map((p) => p.id)) || !uniq(g2.pairs.map((p) => p.left)) || !uniq(g2.pairs.map((p) => p.right))) return "match \u7684 id / left / right \u4E0D\u80FD\u91CD\u590D";
    return null;
  }
  return `\u672A\u77E5\u7684 game.type\uFF1A${String(g2.type)}`;
}
function gameAnswer(g2) {
  if (g2.type === "sort") return Object.fromEntries(g2.items.map((i) => [i.id, i.bucket]));
  if (g2.type === "order") return g2.items.map((i) => i.id);
  return Object.fromEntries(g2.pairs.map((p) => [p.id, `r_${p.id}`]));
}
function seeded(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ h >>> 15, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
function shuffle(xs, seed) {
  const r = seeded(seed), a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(r() * (i + 1));
    [a[i], a[k]] = [a[k], a[i]];
  }
  if (a.length > 1 && a.every((x, i) => x === xs[i])) a.push(a.shift());
  return a;
}
function publicGame(g2, seed = g2.title) {
  if (g2.type === "sort") return { type: "sort", title: g2.title, instructions: g2.instructions, buckets: g2.buckets, items: shuffle(g2.items.map(({ id, label }) => ({ id, label })), seed) };
  if (g2.type === "order") return { type: "order", title: g2.title, instructions: g2.instructions, items: shuffle(g2.items, seed) };
  return {
    type: "match",
    title: g2.title,
    instructions: g2.instructions,
    left: g2.pairs.map((p) => ({ id: p.id, label: p.left })),
    right: shuffle(g2.pairs.map((p) => ({ id: `r_${p.id}`, label: p.right })), seed)
  };
}
var OPERATION_WORDS = /拖|拽|点击|点选|点一下|戳|连线|连起来|方向键|按键|键盘|滑动|移到|放进|放到|放入|送进|扔进/;
var GAME_PASS = 0.8;
function judgeMove(g2, m) {
  const mv = m ?? {};
  if (g2.type === "sort") {
    const it = g2.items.find((x) => x.id === mv.item);
    if (!it || !g2.buckets.some((b) => b.id === mv.bucket)) return null;
    return { correct: it.bucket === mv.bucket, key: it.id, reveal: it.bucket };
  }
  if (g2.type === "order") {
    const prefix = Array.isArray(mv.prefix) ? mv.prefix.map(String) : [];
    if (prefix.length >= g2.items.length || prefix.some((id, i) => g2.items[i].id !== id)) return null;
    if (!g2.items.some((x) => x.id === mv.item) || prefix.includes(String(mv.item))) return null;
    return { correct: g2.items[prefix.length].id === mv.item, key: `pos${prefix.length}` };
  }
  const left = String(mv.left ?? ""), right = String(mv.right ?? "");
  if (!g2.pairs.some((p) => p.id === left) || !g2.pairs.some((p) => `r_${p.id}` === right)) return null;
  return { correct: right === `r_${left}`, key: left };
}
function gradeFirstTries(g2, firsts) {
  const keys = g2.type === "sort" ? g2.items.map((i) => i.id) : g2.type === "order" ? g2.items.map((_, i) => `pos${i}`) : g2.pairs.map((p) => p.id);
  const idOf = (k) => g2.type === "order" ? g2.items[Number(k.slice(3))].id : k;
  const wrongIds = keys.filter((k) => firsts.get(k) !== true).map(idOf);
  const right = keys.length - wrongIds.length;
  const accuracy = keys.length ? right / keys.length : 0;
  return { correct: accuracy >= GAME_PASS, right, total: keys.length, wrongIds, accuracy };
}

// ../../src/lib/board-validate.ts
init_textwidth();

// ../../../st/node_modules/katex/dist/katex.mjs
var SourceLocation = class _SourceLocation {
  // The + prefix indicates that these fields aren't writeable
  // Lexer holding the input string.
  // Start offset, zero-based inclusive.
  // End offset, zero-based exclusive.
  constructor(lexer, start, end) {
    this.lexer = void 0;
    this.start = void 0;
    this.end = void 0;
    this.lexer = lexer;
    this.start = start;
    this.end = end;
  }
  /**
   * Merges two `SourceLocation`s from location providers, given they are
   * provided in order of appearance.
   * - Returns the first one's location if only the first is provided.
   * - Returns a merged range of the first and the last if both are provided
   *   and their lexers match.
   * - Otherwise, returns null.
   */
  static range(first, second) {
    if (!second) {
      return first && first.loc;
    } else if (!first || !first.loc || !second.loc || first.loc.lexer !== second.loc.lexer) {
      return null;
    } else {
      return new _SourceLocation(first.loc.lexer, first.loc.start, second.loc.end);
    }
  }
};
var Token = class _Token {
  // don't expand the token
  // used in \noexpand
  constructor(text2, loc) {
    this.text = void 0;
    this.loc = void 0;
    this.noexpand = void 0;
    this.treatAsRelax = void 0;
    this.text = text2;
    this.loc = loc;
  }
  /**
   * Given a pair of tokens (this and endToken), compute a `Token` encompassing
   * the whole input range enclosed by these two.
   */
  range(endToken, text2) {
    return new _Token(text2, SourceLocation.range(this, endToken));
  }
};
var ParseError = class _ParseError {
  // Error start position based on passed-in Token or ParseNode.
  // Length of affected text based on passed-in Token or ParseNode.
  // The underlying error message without any context added.
  constructor(message, token) {
    this.name = void 0;
    this.position = void 0;
    this.length = void 0;
    this.rawMessage = void 0;
    var error = "KaTeX parse error: " + message;
    var start;
    var end;
    var loc = token && token.loc;
    if (loc && loc.start <= loc.end) {
      var input = loc.lexer.input;
      start = loc.start;
      end = loc.end;
      if (start === input.length) {
        error += " at end of input: ";
      } else {
        error += " at position " + (start + 1) + ": ";
      }
      var underlined = input.slice(start, end).replace(/[^]/g, "$&\u0332");
      var left;
      if (start > 15) {
        left = "\u2026" + input.slice(start - 15, start);
      } else {
        left = input.slice(0, start);
      }
      var right;
      if (end + 15 < input.length) {
        right = input.slice(end, end + 15) + "\u2026";
      } else {
        right = input.slice(end);
      }
      error += left + underlined + right;
    }
    var self = new Error(error);
    self.name = "ParseError";
    self.__proto__ = _ParseError.prototype;
    self.position = start;
    if (start != null && end != null) {
      self.length = end - start;
    }
    self.rawMessage = message;
    return self;
  }
};
ParseError.prototype.__proto__ = Error.prototype;
var contains = function contains2(list, elem) {
  return list.indexOf(elem) !== -1;
};
var deflt = function deflt2(setting, defaultIfUndefined) {
  return setting === void 0 ? defaultIfUndefined : setting;
};
var uppercase = /([A-Z])/g;
var hyphenate = function hyphenate2(str) {
  return str.replace(uppercase, "-$1").toLowerCase();
};
var ESCAPE_LOOKUP = {
  "&": "&amp;",
  ">": "&gt;",
  "<": "&lt;",
  '"': "&quot;",
  "'": "&#x27;"
};
var ESCAPE_REGEX = /[&><"']/g;
function escape(text2) {
  return String(text2).replace(ESCAPE_REGEX, (match) => ESCAPE_LOOKUP[match]);
}
var getBaseElem = function getBaseElem2(group) {
  if (group.type === "ordgroup") {
    if (group.body.length === 1) {
      return getBaseElem2(group.body[0]);
    } else {
      return group;
    }
  } else if (group.type === "color") {
    if (group.body.length === 1) {
      return getBaseElem2(group.body[0]);
    } else {
      return group;
    }
  } else if (group.type === "font") {
    return getBaseElem2(group.body);
  } else {
    return group;
  }
};
var isCharacterBox = function isCharacterBox2(group) {
  var baseElem = getBaseElem(group);
  return baseElem.type === "mathord" || baseElem.type === "textord" || baseElem.type === "atom";
};
var assert = function assert2(value) {
  if (!value) {
    throw new Error("Expected non-null, but got " + String(value));
  }
  return value;
};
var protocolFromUrl = function protocolFromUrl2(url) {
  var protocol = /^[\x00-\x20]*([^\\/#?]*?)(:|&#0*58|&#x0*3a|&colon)/i.exec(url);
  if (!protocol) {
    return "_relative";
  }
  if (protocol[2] !== ":") {
    return null;
  }
  if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*$/.test(protocol[1])) {
    return null;
  }
  return protocol[1].toLowerCase();
};
var utils = {
  contains,
  deflt,
  escape,
  hyphenate,
  getBaseElem,
  isCharacterBox,
  protocolFromUrl
};
var SETTINGS_SCHEMA = {
  displayMode: {
    type: "boolean",
    description: "Render math in display mode, which puts the math in display style (so \\int and \\sum are large, for example), and centers the math on the page on its own line.",
    cli: "-d, --display-mode"
  },
  output: {
    type: {
      enum: ["htmlAndMathml", "html", "mathml"]
    },
    description: "Determines the markup language of the output.",
    cli: "-F, --format <type>"
  },
  leqno: {
    type: "boolean",
    description: "Render display math in leqno style (left-justified tags)."
  },
  fleqn: {
    type: "boolean",
    description: "Render display math flush left."
  },
  throwOnError: {
    type: "boolean",
    default: true,
    cli: "-t, --no-throw-on-error",
    cliDescription: "Render errors (in the color given by --error-color) instead of throwing a ParseError exception when encountering an error."
  },
  errorColor: {
    type: "string",
    default: "#cc0000",
    cli: "-c, --error-color <color>",
    cliDescription: "A color string given in the format 'rgb' or 'rrggbb' (no #). This option determines the color of errors rendered by the -t option.",
    cliProcessor: (color) => "#" + color
  },
  macros: {
    type: "object",
    cli: "-m, --macro <def>",
    cliDescription: "Define custom macro of the form '\\foo:expansion' (use multiple -m arguments for multiple macros).",
    cliDefault: [],
    cliProcessor: (def, defs) => {
      defs.push(def);
      return defs;
    }
  },
  minRuleThickness: {
    type: "number",
    description: "Specifies a minimum thickness, in ems, for fraction lines, `\\sqrt` top lines, `{array}` vertical lines, `\\hline`, `\\hdashline`, `\\underline`, `\\overline`, and the borders of `\\fbox`, `\\boxed`, and `\\fcolorbox`.",
    processor: (t) => Math.max(0, t),
    cli: "--min-rule-thickness <size>",
    cliProcessor: parseFloat
  },
  colorIsTextColor: {
    type: "boolean",
    description: "Makes \\color behave like LaTeX's 2-argument \\textcolor, instead of LaTeX's one-argument \\color mode change.",
    cli: "-b, --color-is-text-color"
  },
  strict: {
    type: [{
      enum: ["warn", "ignore", "error"]
    }, "boolean", "function"],
    description: "Turn on strict / LaTeX faithfulness mode, which throws an error if the input uses features that are not supported by LaTeX.",
    cli: "-S, --strict",
    cliDefault: false
  },
  trust: {
    type: ["boolean", "function"],
    description: "Trust the input, enabling all HTML features such as \\url.",
    cli: "-T, --trust"
  },
  maxSize: {
    type: "number",
    default: Infinity,
    description: "If non-zero, all user-specified sizes, e.g. in \\rule{500em}{500em}, will be capped to maxSize ems. Otherwise, elements and spaces can be arbitrarily large",
    processor: (s) => Math.max(0, s),
    cli: "-s, --max-size <n>",
    cliProcessor: parseInt
  },
  maxExpand: {
    type: "number",
    default: 1e3,
    description: "Limit the number of macro expansions to the specified number, to prevent e.g. infinite macro loops. If set to Infinity, the macro expander will try to fully expand as in LaTeX.",
    processor: (n) => Math.max(0, n),
    cli: "-e, --max-expand <n>",
    cliProcessor: (n) => n === "Infinity" ? Infinity : parseInt(n)
  },
  globalGroup: {
    type: "boolean",
    cli: false
  }
};
function getDefaultValue(schema) {
  if (schema.default) {
    return schema.default;
  }
  var type = schema.type;
  var defaultType = Array.isArray(type) ? type[0] : type;
  if (typeof defaultType !== "string") {
    return defaultType.enum[0];
  }
  switch (defaultType) {
    case "boolean":
      return false;
    case "string":
      return "";
    case "number":
      return 0;
    case "object":
      return {};
  }
}
var Settings = class {
  constructor(options) {
    this.displayMode = void 0;
    this.output = void 0;
    this.leqno = void 0;
    this.fleqn = void 0;
    this.throwOnError = void 0;
    this.errorColor = void 0;
    this.macros = void 0;
    this.minRuleThickness = void 0;
    this.colorIsTextColor = void 0;
    this.strict = void 0;
    this.trust = void 0;
    this.maxSize = void 0;
    this.maxExpand = void 0;
    this.globalGroup = void 0;
    options = options || {};
    for (var prop in SETTINGS_SCHEMA) {
      if (SETTINGS_SCHEMA.hasOwnProperty(prop)) {
        var schema = SETTINGS_SCHEMA[prop];
        this[prop] = options[prop] !== void 0 ? schema.processor ? schema.processor(options[prop]) : options[prop] : getDefaultValue(schema);
      }
    }
  }
  /**
   * Report nonstrict (non-LaTeX-compatible) input.
   * Can safely not be called if `this.strict` is false in JavaScript.
   */
  reportNonstrict(errorCode, errorMsg, token) {
    var strict = this.strict;
    if (typeof strict === "function") {
      strict = strict(errorCode, errorMsg, token);
    }
    if (!strict || strict === "ignore") {
      return;
    } else if (strict === true || strict === "error") {
      throw new ParseError("LaTeX-incompatible input and strict mode is set to 'error': " + (errorMsg + " [" + errorCode + "]"), token);
    } else if (strict === "warn") {
      typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to 'warn': " + (errorMsg + " [" + errorCode + "]"));
    } else {
      typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to " + ("unrecognized '" + strict + "': " + errorMsg + " [" + errorCode + "]"));
    }
  }
  /**
   * Check whether to apply strict (LaTeX-adhering) behavior for unusual
   * input (like `\\`).  Unlike `nonstrict`, will not throw an error;
   * instead, "error" translates to a return value of `true`, while "ignore"
   * translates to a return value of `false`.  May still print a warning:
   * "warn" prints a warning and returns `false`.
   * This is for the second category of `errorCode`s listed in the README.
   */
  useStrictBehavior(errorCode, errorMsg, token) {
    var strict = this.strict;
    if (typeof strict === "function") {
      try {
        strict = strict(errorCode, errorMsg, token);
      } catch (error) {
        strict = "error";
      }
    }
    if (!strict || strict === "ignore") {
      return false;
    } else if (strict === true || strict === "error") {
      return true;
    } else if (strict === "warn") {
      typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to 'warn': " + (errorMsg + " [" + errorCode + "]"));
      return false;
    } else {
      typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to " + ("unrecognized '" + strict + "': " + errorMsg + " [" + errorCode + "]"));
      return false;
    }
  }
  /**
   * Check whether to test potentially dangerous input, and return
   * `true` (trusted) or `false` (untrusted).  The sole argument `context`
   * should be an object with `command` field specifying the relevant LaTeX
   * command (as a string starting with `\`), and any other arguments, etc.
   * If `context` has a `url` field, a `protocol` field will automatically
   * get added by this function (changing the specified object).
   */
  isTrusted(context) {
    if (context.url && !context.protocol) {
      var protocol = utils.protocolFromUrl(context.url);
      if (protocol == null) {
        return false;
      }
      context.protocol = protocol;
    }
    var trust = typeof this.trust === "function" ? this.trust(context) : this.trust;
    return Boolean(trust);
  }
};
var Style = class {
  constructor(id, size, cramped) {
    this.id = void 0;
    this.size = void 0;
    this.cramped = void 0;
    this.id = id;
    this.size = size;
    this.cramped = cramped;
  }
  /**
   * Get the style of a superscript given a base in the current style.
   */
  sup() {
    return styles[sup[this.id]];
  }
  /**
   * Get the style of a subscript given a base in the current style.
   */
  sub() {
    return styles[sub[this.id]];
  }
  /**
   * Get the style of a fraction numerator given the fraction in the current
   * style.
   */
  fracNum() {
    return styles[fracNum[this.id]];
  }
  /**
   * Get the style of a fraction denominator given the fraction in the current
   * style.
   */
  fracDen() {
    return styles[fracDen[this.id]];
  }
  /**
   * Get the cramped version of a style (in particular, cramping a cramped style
   * doesn't change the style).
   */
  cramp() {
    return styles[cramp[this.id]];
  }
  /**
   * Get a text or display version of this style.
   */
  text() {
    return styles[text$1[this.id]];
  }
  /**
   * Return true if this style is tightly spaced (scriptstyle/scriptscriptstyle)
   */
  isTight() {
    return this.size >= 2;
  }
};
var D = 0;
var Dc = 1;
var T = 2;
var Tc = 3;
var S = 4;
var Sc = 5;
var SS = 6;
var SSc = 7;
var styles = [new Style(D, 0, false), new Style(Dc, 0, true), new Style(T, 1, false), new Style(Tc, 1, true), new Style(S, 2, false), new Style(Sc, 2, true), new Style(SS, 3, false), new Style(SSc, 3, true)];
var sup = [S, Sc, S, Sc, SS, SSc, SS, SSc];
var sub = [Sc, Sc, Sc, Sc, SSc, SSc, SSc, SSc];
var fracNum = [T, Tc, S, Sc, SS, SSc, SS, SSc];
var fracDen = [Tc, Tc, Sc, Sc, SSc, SSc, SSc, SSc];
var cramp = [Dc, Dc, Tc, Tc, Sc, Sc, SSc, SSc];
var text$1 = [D, Dc, T, Tc, T, Tc, T, Tc];
var Style$1 = {
  DISPLAY: styles[D],
  TEXT: styles[T],
  SCRIPT: styles[S],
  SCRIPTSCRIPT: styles[SS]
};
var scriptData = [{
  // Latin characters beyond the Latin-1 characters we have metrics for.
  // Needed for Czech, Hungarian and Turkish text, for example.
  name: "latin",
  blocks: [
    [256, 591],
    // Latin Extended-A and Latin Extended-B
    [768, 879]
    // Combining Diacritical marks
  ]
}, {
  // The Cyrillic script used by Russian and related languages.
  // A Cyrillic subset used to be supported as explicitly defined
  // symbols in symbols.js
  name: "cyrillic",
  blocks: [[1024, 1279]]
}, {
  // Armenian
  name: "armenian",
  blocks: [[1328, 1423]]
}, {
  // The Brahmic scripts of South and Southeast Asia
  // Devanagari (0900–097F)
  // Bengali (0980–09FF)
  // Gurmukhi (0A00–0A7F)
  // Gujarati (0A80–0AFF)
  // Oriya (0B00–0B7F)
  // Tamil (0B80–0BFF)
  // Telugu (0C00–0C7F)
  // Kannada (0C80–0CFF)
  // Malayalam (0D00–0D7F)
  // Sinhala (0D80–0DFF)
  // Thai (0E00–0E7F)
  // Lao (0E80–0EFF)
  // Tibetan (0F00–0FFF)
  // Myanmar (1000–109F)
  name: "brahmic",
  blocks: [[2304, 4255]]
}, {
  name: "georgian",
  blocks: [[4256, 4351]]
}, {
  // Chinese and Japanese.
  // The "k" in cjk is for Korean, but we've separated Korean out
  name: "cjk",
  blocks: [
    [12288, 12543],
    // CJK symbols and punctuation, Hiragana, Katakana
    [19968, 40879],
    // CJK ideograms
    [65280, 65376]
    // Fullwidth punctuation
    // TODO: add halfwidth Katakana and Romanji glyphs
  ]
}, {
  // Korean
  name: "hangul",
  blocks: [[44032, 55215]]
}];
function scriptFromCodepoint(codepoint) {
  for (var i = 0; i < scriptData.length; i++) {
    var script = scriptData[i];
    for (var _i = 0; _i < script.blocks.length; _i++) {
      var block = script.blocks[_i];
      if (codepoint >= block[0] && codepoint <= block[1]) {
        return script.name;
      }
    }
  }
  return null;
}
var allBlocks = [];
scriptData.forEach((s) => s.blocks.forEach((b) => allBlocks.push(...b)));
function supportedCodepoint(codepoint) {
  for (var i = 0; i < allBlocks.length; i += 2) {
    if (codepoint >= allBlocks[i] && codepoint <= allBlocks[i + 1]) {
      return true;
    }
  }
  return false;
}
var hLinePad = 80;
var sqrtMain = function sqrtMain2(extraVinculum, hLinePad2) {
  return "M95," + (622 + extraVinculum + hLinePad2) + "\nc-2.7,0,-7.17,-2.7,-13.5,-8c-5.8,-5.3,-9.5,-10,-9.5,-14\nc0,-2,0.3,-3.3,1,-4c1.3,-2.7,23.83,-20.7,67.5,-54\nc44.2,-33.3,65.8,-50.3,66.5,-51c1.3,-1.3,3,-2,5,-2c4.7,0,8.7,3.3,12,10\ns173,378,173,378c0.7,0,35.3,-71,104,-213c68.7,-142,137.5,-285,206.5,-429\nc69,-144,104.5,-217.7,106.5,-221\nl" + extraVinculum / 2.075 + " -" + extraVinculum + "\nc5.3,-9.3,12,-14,20,-14\nH400000v" + (40 + extraVinculum) + "H845.2724\ns-225.272,467,-225.272,467s-235,486,-235,486c-2.7,4.7,-9,7,-19,7\nc-6,0,-10,-1,-12,-3s-194,-422,-194,-422s-65,47,-65,47z\nM" + (834 + extraVinculum) + " " + hLinePad2 + "h400000v" + (40 + extraVinculum) + "h-400000z";
};
var sqrtSize1 = function sqrtSize12(extraVinculum, hLinePad2) {
  return "M263," + (601 + extraVinculum + hLinePad2) + "c0.7,0,18,39.7,52,119\nc34,79.3,68.167,158.7,102.5,238c34.3,79.3,51.8,119.3,52.5,120\nc340,-704.7,510.7,-1060.3,512,-1067\nl" + extraVinculum / 2.084 + " -" + extraVinculum + "\nc4.7,-7.3,11,-11,19,-11\nH40000v" + (40 + extraVinculum) + "H1012.3\ns-271.3,567,-271.3,567c-38.7,80.7,-84,175,-136,283c-52,108,-89.167,185.3,-111.5,232\nc-22.3,46.7,-33.8,70.3,-34.5,71c-4.7,4.7,-12.3,7,-23,7s-12,-1,-12,-1\ns-109,-253,-109,-253c-72.7,-168,-109.3,-252,-110,-252c-10.7,8,-22,16.7,-34,26\nc-22,17.3,-33.3,26,-34,26s-26,-26,-26,-26s76,-59,76,-59s76,-60,76,-60z\nM" + (1001 + extraVinculum) + " " + hLinePad2 + "h400000v" + (40 + extraVinculum) + "h-400000z";
};
var sqrtSize2 = function sqrtSize22(extraVinculum, hLinePad2) {
  return "M983 " + (10 + extraVinculum + hLinePad2) + "\nl" + extraVinculum / 3.13 + " -" + extraVinculum + "\nc4,-6.7,10,-10,18,-10 H400000v" + (40 + extraVinculum) + "\nH1013.1s-83.4,268,-264.1,840c-180.7,572,-277,876.3,-289,913c-4.7,4.7,-12.7,7,-24,7\ns-12,0,-12,0c-1.3,-3.3,-3.7,-11.7,-7,-25c-35.3,-125.3,-106.7,-373.3,-214,-744\nc-10,12,-21,25,-33,39s-32,39,-32,39c-6,-5.3,-15,-14,-27,-26s25,-30,25,-30\nc26.7,-32.7,52,-63,76,-91s52,-60,52,-60s208,722,208,722\nc56,-175.3,126.3,-397.3,211,-666c84.7,-268.7,153.8,-488.2,207.5,-658.5\nc53.7,-170.3,84.5,-266.8,92.5,-289.5z\nM" + (1001 + extraVinculum) + " " + hLinePad2 + "h400000v" + (40 + extraVinculum) + "h-400000z";
};
var sqrtSize3 = function sqrtSize32(extraVinculum, hLinePad2) {
  return "M424," + (2398 + extraVinculum + hLinePad2) + "\nc-1.3,-0.7,-38.5,-172,-111.5,-514c-73,-342,-109.8,-513.3,-110.5,-514\nc0,-2,-10.7,14.3,-32,49c-4.7,7.3,-9.8,15.7,-15.5,25c-5.7,9.3,-9.8,16,-12.5,20\ns-5,7,-5,7c-4,-3.3,-8.3,-7.7,-13,-13s-13,-13,-13,-13s76,-122,76,-122s77,-121,77,-121\ns209,968,209,968c0,-2,84.7,-361.7,254,-1079c169.3,-717.3,254.7,-1077.7,256,-1081\nl" + extraVinculum / 4.223 + " -" + extraVinculum + "c4,-6.7,10,-10,18,-10 H400000\nv" + (40 + extraVinculum) + "H1014.6\ns-87.3,378.7,-272.6,1166c-185.3,787.3,-279.3,1182.3,-282,1185\nc-2,6,-10,9,-24,9\nc-8,0,-12,-0.7,-12,-2z M" + (1001 + extraVinculum) + " " + hLinePad2 + "\nh400000v" + (40 + extraVinculum) + "h-400000z";
};
var sqrtSize4 = function sqrtSize42(extraVinculum, hLinePad2) {
  return "M473," + (2713 + extraVinculum + hLinePad2) + "\nc339.3,-1799.3,509.3,-2700,510,-2702 l" + extraVinculum / 5.298 + " -" + extraVinculum + "\nc3.3,-7.3,9.3,-11,18,-11 H400000v" + (40 + extraVinculum) + "H1017.7\ns-90.5,478,-276.2,1466c-185.7,988,-279.5,1483,-281.5,1485c-2,6,-10,9,-24,9\nc-8,0,-12,-0.7,-12,-2c0,-1.3,-5.3,-32,-16,-92c-50.7,-293.3,-119.7,-693.3,-207,-1200\nc0,-1.3,-5.3,8.7,-16,30c-10.7,21.3,-21.3,42.7,-32,64s-16,33,-16,33s-26,-26,-26,-26\ns76,-153,76,-153s77,-151,77,-151c0.7,0.7,35.7,202,105,604c67.3,400.7,102,602.7,104,\n606zM" + (1001 + extraVinculum) + " " + hLinePad2 + "h400000v" + (40 + extraVinculum) + "H1017.7z";
};
var phasePath = function phasePath2(y) {
  var x = y / 2;
  return "M400000 " + y + " H0 L" + x + " 0 l65 45 L145 " + (y - 80) + " H400000z";
};
var sqrtTall = function sqrtTall2(extraVinculum, hLinePad2, viewBoxHeight) {
  var vertSegment = viewBoxHeight - 54 - hLinePad2 - extraVinculum;
  return "M702 " + (extraVinculum + hLinePad2) + "H400000" + (40 + extraVinculum) + "\nH742v" + vertSegment + "l-4 4-4 4c-.667.7 -2 1.5-4 2.5s-4.167 1.833-6.5 2.5-5.5 1-9.5 1\nh-12l-28-84c-16.667-52-96.667 -294.333-240-727l-212 -643 -85 170\nc-4-3.333-8.333-7.667-13 -13l-13-13l77-155 77-156c66 199.333 139 419.667\n219 661 l218 661zM702 " + hLinePad2 + "H400000v" + (40 + extraVinculum) + "H742z";
};
var sqrtPath = function sqrtPath2(size, extraVinculum, viewBoxHeight) {
  extraVinculum = 1e3 * extraVinculum;
  var path3 = "";
  switch (size) {
    case "sqrtMain":
      path3 = sqrtMain(extraVinculum, hLinePad);
      break;
    case "sqrtSize1":
      path3 = sqrtSize1(extraVinculum, hLinePad);
      break;
    case "sqrtSize2":
      path3 = sqrtSize2(extraVinculum, hLinePad);
      break;
    case "sqrtSize3":
      path3 = sqrtSize3(extraVinculum, hLinePad);
      break;
    case "sqrtSize4":
      path3 = sqrtSize4(extraVinculum, hLinePad);
      break;
    case "sqrtTall":
      path3 = sqrtTall(extraVinculum, hLinePad, viewBoxHeight);
  }
  return path3;
};
var innerPath = function innerPath2(name2, height) {
  switch (name2) {
    case "\u239C":
      return "M291 0 H417 V" + height + " H291z M291 0 H417 V" + height + " H291z";
    case "\u2223":
      return "M145 0 H188 V" + height + " H145z M145 0 H188 V" + height + " H145z";
    case "\u2225":
      return "M145 0 H188 V" + height + " H145z M145 0 H188 V" + height + " H145z" + ("M367 0 H410 V" + height + " H367z M367 0 H410 V" + height + " H367z");
    case "\u239F":
      return "M457 0 H583 V" + height + " H457z M457 0 H583 V" + height + " H457z";
    case "\u23A2":
      return "M319 0 H403 V" + height + " H319z M319 0 H403 V" + height + " H319z";
    case "\u23A5":
      return "M263 0 H347 V" + height + " H263z M263 0 H347 V" + height + " H263z";
    case "\u23AA":
      return "M384 0 H504 V" + height + " H384z M384 0 H504 V" + height + " H384z";
    case "\u23D0":
      return "M312 0 H355 V" + height + " H312z M312 0 H355 V" + height + " H312z";
    case "\u2016":
      return "M257 0 H300 V" + height + " H257z M257 0 H300 V" + height + " H257z" + ("M478 0 H521 V" + height + " H478z M478 0 H521 V" + height + " H478z");
    default:
      return "";
  }
};
var path = {
  // The doubleleftarrow geometry is from glyph U+21D0 in the font KaTeX Main
  doubleleftarrow: "M262 157\nl10-10c34-36 62.7-77 86-123 3.3-8 5-13.3 5-16 0-5.3-6.7-8-20-8-7.3\n 0-12.2.5-14.5 1.5-2.3 1-4.8 4.5-7.5 10.5-49.3 97.3-121.7 169.3-217 216-28\n 14-57.3 25-88 33-6.7 2-11 3.8-13 5.5-2 1.7-3 4.2-3 7.5s1 5.8 3 7.5\nc2 1.7 6.3 3.5 13 5.5 68 17.3 128.2 47.8 180.5 91.5 52.3 43.7 93.8 96.2 124.5\n 157.5 9.3 8 15.3 12.3 18 13h6c12-.7 18-4 18-10 0-2-1.7-7-5-15-23.3-46-52-87\n-86-123l-10-10h399738v-40H218c328 0 0 0 0 0l-10-8c-26.7-20-65.7-43-117-69 2.7\n-2 6-3.7 10-5 36.7-16 72.3-37.3 107-64l10-8h399782v-40z\nm8 0v40h399730v-40zm0 194v40h399730v-40z",
  // doublerightarrow is from glyph U+21D2 in font KaTeX Main
  doublerightarrow: "M399738 392l\n-10 10c-34 36-62.7 77-86 123-3.3 8-5 13.3-5 16 0 5.3 6.7 8 20 8 7.3 0 12.2-.5\n 14.5-1.5 2.3-1 4.8-4.5 7.5-10.5 49.3-97.3 121.7-169.3 217-216 28-14 57.3-25 88\n-33 6.7-2 11-3.8 13-5.5 2-1.7 3-4.2 3-7.5s-1-5.8-3-7.5c-2-1.7-6.3-3.5-13-5.5-68\n-17.3-128.2-47.8-180.5-91.5-52.3-43.7-93.8-96.2-124.5-157.5-9.3-8-15.3-12.3-18\n-13h-6c-12 .7-18 4-18 10 0 2 1.7 7 5 15 23.3 46 52 87 86 123l10 10H0v40h399782\nc-328 0 0 0 0 0l10 8c26.7 20 65.7 43 117 69-2.7 2-6 3.7-10 5-36.7 16-72.3 37.3\n-107 64l-10 8H0v40zM0 157v40h399730v-40zm0 194v40h399730v-40z",
  // leftarrow is from glyph U+2190 in font KaTeX Main
  leftarrow: "M400000 241H110l3-3c68.7-52.7 113.7-120\n 135-202 4-14.7 6-23 6-25 0-7.3-7-11-21-11-8 0-13.2.8-15.5 2.5-2.3 1.7-4.2 5.8\n-5.5 12.5-1.3 4.7-2.7 10.3-4 17-12 48.7-34.8 92-68.5 130S65.3 228.3 18 247\nc-10 4-16 7.7-18 11 0 8.7 6 14.3 18 17 47.3 18.7 87.8 47 121.5 85S196 441.3 208\n 490c.7 2 1.3 5 2 9s1.2 6.7 1.5 8c.3 1.3 1 3.3 2 6s2.2 4.5 3.5 5.5c1.3 1 3.3\n 1.8 6 2.5s6 1 10 1c14 0 21-3.7 21-11 0-2-2-10.3-6-25-20-79.3-65-146.7-135-202\n l-3-3h399890zM100 241v40h399900v-40z",
  // overbrace is from glyphs U+23A9/23A8/23A7 in font KaTeX_Size4-Regular
  leftbrace: "M6 548l-6-6v-35l6-11c56-104 135.3-181.3 238-232 57.3-28.7 117\n-45 179-50h399577v120H403c-43.3 7-81 15-113 26-100.7 33-179.7 91-237 174-2.7\n 5-6 9-10 13-.7 1-7.3 1-20 1H6z",
  leftbraceunder: "M0 6l6-6h17c12.688 0 19.313.3 20 1 4 4 7.313 8.3 10 13\n 35.313 51.3 80.813 93.8 136.5 127.5 55.688 33.7 117.188 55.8 184.5 66.5.688\n 0 2 .3 4 1 18.688 2.7 76 4.3 172 5h399450v120H429l-6-1c-124.688-8-235-61.7\n-331-161C60.687 138.7 32.312 99.3 7 54L0 41V6z",
  // overgroup is from the MnSymbol package (public domain)
  leftgroup: "M400000 80\nH435C64 80 168.3 229.4 21 260c-5.9 1.2-18 0-18 0-2 0-3-1-3-3v-38C76 61 257 0\n 435 0h399565z",
  leftgroupunder: "M400000 262\nH435C64 262 168.3 112.6 21 82c-5.9-1.2-18 0-18 0-2 0-3 1-3 3v38c76 158 257 219\n 435 219h399565z",
  // Harpoons are from glyph U+21BD in font KaTeX Main
  leftharpoon: "M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3\n-3.3 10.2-9.5 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5\n-18.3 3-21-1.3-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7\n-196 228-6.7 4.7-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40z",
  leftharpoonplus: "M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3-3.3 10.2-9.5\n 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5-18.3 3-21-1.3\n-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7-196 228-6.7 4.7\n-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40zM0 435v40h400000v-40z\nm0 0v40h400000v-40z",
  leftharpoondown: "M7 241c-4 4-6.333 8.667-7 14 0 5.333.667 9 2 11s5.333\n 5.333 12 10c90.667 54 156 130 196 228 3.333 10.667 6.333 16.333 9 17 2 .667 5\n 1 9 1h5c10.667 0 16.667-2 18-6 2-2.667 1-9.667-3-21-32-87.333-82.667-157.667\n-152-211l-3-3h399907v-40zM93 281 H400000 v-40L7 241z",
  leftharpoondownplus: "M7 435c-4 4-6.3 8.7-7 14 0 5.3.7 9 2 11s5.3 5.3 12\n 10c90.7 54 156 130 196 228 3.3 10.7 6.3 16.3 9 17 2 .7 5 1 9 1h5c10.7 0 16.7\n-2 18-6 2-2.7 1-9.7-3-21-32-87.3-82.7-157.7-152-211l-3-3h399907v-40H7zm93 0\nv40h399900v-40zM0 241v40h399900v-40zm0 0v40h399900v-40z",
  // hook is from glyph U+21A9 in font KaTeX Main
  lefthook: "M400000 281 H103s-33-11.2-61-33.5S0 197.3 0 164s14.2-61.2 42.5\n-83.5C70.8 58.2 104 47 142 47 c16.7 0 25 6.7 25 20 0 12-8.7 18.7-26 20-40 3.3\n-68.7 15.7-86 37-10 12-15 25.3-15 40 0 22.7 9.8 40.7 29.5 54 19.7 13.3 43.5 21\n 71.5 23h399859zM103 281v-40h399897v40z",
  leftlinesegment: "M40 281 V428 H0 V94 H40 V241 H400000 v40z\nM40 281 V428 H0 V94 H40 V241 H400000 v40z",
  leftmapsto: "M40 281 V448H0V74H40V241H400000v40z\nM40 281 V448H0V74H40V241H400000v40z",
  // tofrom is from glyph U+21C4 in font KaTeX AMS Regular
  leftToFrom: "M0 147h400000v40H0zm0 214c68 40 115.7 95.7 143 167h22c15.3 0 23\n-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69-70-101l-7-8h399905v-40H95l7-8\nc28.7-32 52-65.7 70-101 10.7-23.3 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 265.3\n 68 321 0 361zm0-174v-40h399900v40zm100 154v40h399900v-40z",
  longequal: "M0 50 h400000 v40H0z m0 194h40000v40H0z\nM0 50 h400000 v40H0z m0 194h40000v40H0z",
  midbrace: "M200428 334\nc-100.7-8.3-195.3-44-280-108-55.3-42-101.7-93-139-153l-9-14c-2.7 4-5.7 8.7-9 14\n-53.3 86.7-123.7 153-211 199-66.7 36-137.3 56.3-212 62H0V214h199568c178.3-11.7\n 311.7-78.3 403-201 6-8 9.7-12 11-12 .7-.7 6.7-1 18-1s17.3.3 18 1c1.3 0 5 4 11\n 12 44.7 59.3 101.3 106.3 170 141s145.3 54.3 229 60h199572v120z",
  midbraceunder: "M199572 214\nc100.7 8.3 195.3 44 280 108 55.3 42 101.7 93 139 153l9 14c2.7-4 5.7-8.7 9-14\n 53.3-86.7 123.7-153 211-199 66.7-36 137.3-56.3 212-62h199568v120H200432c-178.3\n 11.7-311.7 78.3-403 201-6 8-9.7 12-11 12-.7.7-6.7 1-18 1s-17.3-.3-18-1c-1.3 0\n-5-4-11-12-44.7-59.3-101.3-106.3-170-141s-145.3-54.3-229-60H0V214z",
  oiintSize1: "M512.6 71.6c272.6 0 320.3 106.8 320.3 178.2 0 70.8-47.7 177.6\n-320.3 177.6S193.1 320.6 193.1 249.8c0-71.4 46.9-178.2 319.5-178.2z\nm368.1 178.2c0-86.4-60.9-215.4-368.1-215.4-306.4 0-367.3 129-367.3 215.4 0 85.8\n60.9 214.8 367.3 214.8 307.2 0 368.1-129 368.1-214.8z",
  oiintSize2: "M757.8 100.1c384.7 0 451.1 137.6 451.1 230 0 91.3-66.4 228.8\n-451.1 228.8-386.3 0-452.7-137.5-452.7-228.8 0-92.4 66.4-230 452.7-230z\nm502.4 230c0-111.2-82.4-277.2-502.4-277.2s-504 166-504 277.2\nc0 110 84 276 504 276s502.4-166 502.4-276z",
  oiiintSize1: "M681.4 71.6c408.9 0 480.5 106.8 480.5 178.2 0 70.8-71.6 177.6\n-480.5 177.6S202.1 320.6 202.1 249.8c0-71.4 70.5-178.2 479.3-178.2z\nm525.8 178.2c0-86.4-86.8-215.4-525.7-215.4-437.9 0-524.7 129-524.7 215.4 0\n85.8 86.8 214.8 524.7 214.8 438.9 0 525.7-129 525.7-214.8z",
  oiiintSize2: "M1021.2 53c603.6 0 707.8 165.8 707.8 277.2 0 110-104.2 275.8\n-707.8 275.8-606 0-710.2-165.8-710.2-275.8C311 218.8 415.2 53 1021.2 53z\nm770.4 277.1c0-131.2-126.4-327.6-770.5-327.6S248.4 198.9 248.4 330.1\nc0 130 128.8 326.4 772.7 326.4s770.5-196.4 770.5-326.4z",
  rightarrow: "M0 241v40h399891c-47.3 35.3-84 78-110 128\n-16.7 32-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20\n 11 8 0 13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7\n 39-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85\n-40.5-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5\n-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67\n 151.7 139 205zm0 0v40h399900v-40z",
  rightbrace: "M400000 542l\n-6 6h-17c-12.7 0-19.3-.3-20-1-4-4-7.3-8.3-10-13-35.3-51.3-80.8-93.8-136.5-127.5\ns-117.2-55.8-184.5-66.5c-.7 0-2-.3-4-1-18.7-2.7-76-4.3-172-5H0V214h399571l6 1\nc124.7 8 235 61.7 331 161 31.3 33.3 59.7 72.7 85 118l7 13v35z",
  rightbraceunder: "M399994 0l6 6v35l-6 11c-56 104-135.3 181.3-238 232-57.3\n 28.7-117 45-179 50H-300V214h399897c43.3-7 81-15 113-26 100.7-33 179.7-91 237\n-174 2.7-5 6-9 10-13 .7-1 7.3-1 20-1h17z",
  rightgroup: "M0 80h399565c371 0 266.7 149.4 414 180 5.9 1.2 18 0 18 0 2 0\n 3-1 3-3v-38c-76-158-257-219-435-219H0z",
  rightgroupunder: "M0 262h399565c371 0 266.7-149.4 414-180 5.9-1.2 18 0 18\n 0 2 0 3 1 3 3v38c-76 158-257 219-435 219H0z",
  rightharpoon: "M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3\n-3.7-15.3-11-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2\n-10.7 0-16.7 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58\n 69.2 92 94.5zm0 0v40h399900v-40z",
  rightharpoonplus: "M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3-3.7-15.3-11\n-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2-10.7 0-16.7\n 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58 69.2 92 94.5z\nm0 0v40h399900v-40z m100 194v40h399900v-40zm0 0v40h399900v-40z",
  rightharpoondown: "M399747 511c0 7.3 6.7 11 20 11 8 0 13-.8 15-2.5s4.7-6.8\n 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3 8.5-5.8 9.5\n-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3-64.7 57-92 95\n-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 241v40h399900v-40z",
  rightharpoondownplus: "M399747 705c0 7.3 6.7 11 20 11 8 0 13-.8\n 15-2.5s4.7-6.8 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3\n 8.5-5.8 9.5-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3\n-64.7 57-92 95-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 435v40h399900v-40z\nm0-194v40h400000v-40zm0 0v40h400000v-40z",
  righthook: "M399859 241c-764 0 0 0 0 0 40-3.3 68.7-15.7 86-37 10-12 15-25.3\n 15-40 0-22.7-9.8-40.7-29.5-54-19.7-13.3-43.5-21-71.5-23-17.3-1.3-26-8-26-20 0\n-13.3 8.7-20 26-20 38 0 71 11.2 99 33.5 0 0 7 5.6 21 16.7 14 11.2 21 33.5 21\n 66.8s-14 61.2-42 83.5c-28 22.3-61 33.5-99 33.5L0 241z M0 281v-40h399859v40z",
  rightlinesegment: "M399960 241 V94 h40 V428 h-40 V281 H0 v-40z\nM399960 241 V94 h40 V428 h-40 V281 H0 v-40z",
  rightToFrom: "M400000 167c-70.7-42-118-97.7-142-167h-23c-15.3 0-23 .3-23\n 1 0 1.3 5.3 13.7 16 37 18 35.3 41.3 69 70 101l7 8H0v40h399905l-7 8c-28.7 32\n-52 65.7-70 101-10.7 23.3-16 35.7-16 37 0 .7 7.7 1 23 1h23c24-69.3 71.3-125 142\n-167z M100 147v40h399900v-40zM0 341v40h399900v-40z",
  // twoheadleftarrow is from glyph U+219E in font KaTeX AMS Regular
  twoheadleftarrow: "M0 167c68 40\n 115.7 95.7 143 167h22c15.3 0 23-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69\n-70-101l-7-8h125l9 7c50.7 39.3 85 86 103 140h46c0-4.7-6.3-18.7-19-42-18-35.3\n-40-67.3-66-96l-9-9h399716v-40H284l9-9c26-28.7 48-60.7 66-96 12.7-23.333 19\n-37.333 19-42h-46c-18 54-52.3 100.7-103 140l-9 7H95l7-8c28.7-32 52-65.7 70-101\n 10.7-23.333 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 71.3 68 127 0 167z",
  twoheadrightarrow: "M400000 167\nc-68-40-115.7-95.7-143-167h-22c-15.3 0-23 .3-23 1 0 1.3 5.3 13.7 16 37 18 35.3\n 41.3 69 70 101l7 8h-125l-9-7c-50.7-39.3-85-86-103-140h-46c0 4.7 6.3 18.7 19 42\n 18 35.3 40 67.3 66 96l9 9H0v40h399716l-9 9c-26 28.7-48 60.7-66 96-12.7 23.333\n-19 37.333-19 42h46c18-54 52.3-100.7 103-140l9-7h125l-7 8c-28.7 32-52 65.7-70\n 101-10.7 23.333-16 35.7-16 37 0 .7 7.7 1 23 1h22c27.3-71.3 75-127 143-167z",
  // tilde1 is a modified version of a glyph from the MnSymbol package
  tilde1: "M200 55.538c-77 0-168 73.953-177 73.953-3 0-7\n-2.175-9-5.437L2 97c-1-2-2-4-2-6 0-4 2-7 5-9l20-12C116 12 171 0 207 0c86 0\n 114 68 191 68 78 0 168-68 177-68 4 0 7 2 9 5l12 19c1 2.175 2 4.35 2 6.525 0\n 4.35-2 7.613-5 9.788l-19 13.05c-92 63.077-116.937 75.308-183 76.128\n-68.267.847-113-73.952-191-73.952z",
  // ditto tilde2, tilde3, & tilde4
  tilde2: "M344 55.266c-142 0-300.638 81.316-311.5 86.418\n-8.01 3.762-22.5 10.91-23.5 5.562L1 120c-1-2-1-3-1-4 0-5 3-9 8-10l18.4-9C160.9\n 31.9 283 0 358 0c148 0 188 122 331 122s314-97 326-97c4 0 8 2 10 7l7 21.114\nc1 2.14 1 3.21 1 4.28 0 5.347-3 9.626-7 10.696l-22.3 12.622C852.6 158.372 751\n 181.476 676 181.476c-149 0-189-126.21-332-126.21z",
  tilde3: "M786 59C457 59 32 175.242 13 175.242c-6 0-10-3.457\n-11-10.37L.15 138c-1-7 3-12 10-13l19.2-6.4C378.4 40.7 634.3 0 804.3 0c337 0\n 411.8 157 746.8 157 328 0 754-112 773-112 5 0 10 3 11 9l1 14.075c1 8.066-.697\n 16.595-6.697 17.492l-21.052 7.31c-367.9 98.146-609.15 122.696-778.15 122.696\n -338 0-409-156.573-744-156.573z",
  tilde4: "M786 58C457 58 32 177.487 13 177.487c-6 0-10-3.345\n-11-10.035L.15 143c-1-7 3-12 10-13l22-6.7C381.2 35 637.15 0 807.15 0c337 0 409\n 177 744 177 328 0 754-127 773-127 5 0 10 3 11 9l1 14.794c1 7.805-3 13.38-9\n 14.495l-20.7 5.574c-366.85 99.79-607.3 139.372-776.3 139.372-338 0-409\n -175.236-744-175.236z",
  // vec is from glyph U+20D7 in font KaTeX Main
  vec: "M377 20c0-5.333 1.833-10 5.5-14S391 0 397 0c4.667 0 8.667 1.667 12 5\n3.333 2.667 6.667 9 10 19 6.667 24.667 20.333 43.667 41 57 7.333 4.667 11\n10.667 11 18 0 6-1 10-3 12s-6.667 5-14 9c-28.667 14.667-53.667 35.667-75 63\n-1.333 1.333-3.167 3.5-5.5 6.5s-4 4.833-5 5.5c-1 .667-2.5 1.333-4.5 2s-4.333 1\n-7 1c-4.667 0-9.167-1.833-13.5-5.5S337 184 337 178c0-12.667 15.667-32.333 47-59\nH213l-171-1c-8.667-6-13-12.333-13-19 0-4.667 4.333-11.333 13-20h359\nc-16-25.333-24-45-24-59z",
  // widehat1 is a modified version of a glyph from the MnSymbol package
  widehat1: "M529 0h5l519 115c5 1 9 5 9 10 0 1-1 2-1 3l-4 22\nc-1 5-5 9-11 9h-2L532 67 19 159h-2c-5 0-9-4-11-9l-5-22c-1-6 2-12 8-13z",
  // ditto widehat2, widehat3, & widehat4
  widehat2: "M1181 0h2l1171 176c6 0 10 5 10 11l-2 23c-1 6-5 10\n-11 10h-1L1182 67 15 220h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z",
  widehat3: "M1181 0h2l1171 236c6 0 10 5 10 11l-2 23c-1 6-5 10\n-11 10h-1L1182 67 15 280h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z",
  widehat4: "M1181 0h2l1171 296c6 0 10 5 10 11l-2 23c-1 6-5 10\n-11 10h-1L1182 67 15 340h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z",
  // widecheck paths are all inverted versions of widehat
  widecheck1: "M529,159h5l519,-115c5,-1,9,-5,9,-10c0,-1,-1,-2,-1,-3l-4,-22c-1,\n-5,-5,-9,-11,-9h-2l-512,92l-513,-92h-2c-5,0,-9,4,-11,9l-5,22c-1,6,2,12,8,13z",
  widecheck2: "M1181,220h2l1171,-176c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,\n-11,-10h-1l-1168,153l-1167,-153h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z",
  widecheck3: "M1181,280h2l1171,-236c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,\n-11,-10h-1l-1168,213l-1167,-213h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z",
  widecheck4: "M1181,340h2l1171,-296c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,\n-11,-10h-1l-1168,273l-1167,-273h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z",
  // The next ten paths support reaction arrows from the mhchem package.
  // Arrows for \ce{<-->} are offset from xAxis by 0.22ex, per mhchem in LaTeX
  // baraboveleftarrow is mostly from glyph U+2190 in font KaTeX Main
  baraboveleftarrow: "M400000 620h-399890l3 -3c68.7 -52.7 113.7 -120 135 -202\nc4 -14.7 6 -23 6 -25c0 -7.3 -7 -11 -21 -11c-8 0 -13.2 0.8 -15.5 2.5\nc-2.3 1.7 -4.2 5.8 -5.5 12.5c-1.3 4.7 -2.7 10.3 -4 17c-12 48.7 -34.8 92 -68.5 130\ns-74.2 66.3 -121.5 85c-10 4 -16 7.7 -18 11c0 8.7 6 14.3 18 17c47.3 18.7 87.8 47\n121.5 85s56.5 81.3 68.5 130c0.7 2 1.3 5 2 9s1.2 6.7 1.5 8c0.3 1.3 1 3.3 2 6\ns2.2 4.5 3.5 5.5c1.3 1 3.3 1.8 6 2.5s6 1 10 1c14 0 21 -3.7 21 -11\nc0 -2 -2 -10.3 -6 -25c-20 -79.3 -65 -146.7 -135 -202l-3 -3h399890z\nM100 620v40h399900v-40z M0 241v40h399900v-40zM0 241v40h399900v-40z",
  // rightarrowabovebar is mostly from glyph U+2192, KaTeX Main
  rightarrowabovebar: "M0 241v40h399891c-47.3 35.3-84 78-110 128-16.7 32\n-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20 11 8 0\n13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7 39\n-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85-40.5\n-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5\n-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67\n151.7 139 205zm96 379h399894v40H0zm0 0h399904v40H0z",
  // The short left harpoon has 0.5em (i.e. 500 units) kern on the left end.
  // Ref from mhchem.sty: \rlap{\raisebox{-.22ex}{$\kern0.5em
  baraboveshortleftharpoon: "M507,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11\nc1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17\nc2,0.7,5,1,9,1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21\nc-32,-87.3,-82.7,-157.7,-152,-211c0,0,-3,-3,-3,-3l399351,0l0,-40\nc-398570,0,-399437,0,-399437,0z M593 435 v40 H399500 v-40z\nM0 281 v-40 H399908 v40z M0 281 v-40 H399908 v40z",
  rightharpoonaboveshortbar: "M0,241 l0,40c399126,0,399993,0,399993,0\nc4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,\n-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6\nc-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z\nM0 241 v40 H399908 v-40z M0 475 v-40 H399500 v40z M0 475 v-40 H399500 v40z",
  shortbaraboveleftharpoon: "M7,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11\nc1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17c2,0.7,5,1,9,\n1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21c-32,-87.3,-82.7,-157.7,\n-152,-211c0,0,-3,-3,-3,-3l399907,0l0,-40c-399126,0,-399993,0,-399993,0z\nM93 435 v40 H400000 v-40z M500 241 v40 H400000 v-40z M500 241 v40 H400000 v-40z",
  shortrightharpoonabovebar: "M53,241l0,40c398570,0,399437,0,399437,0\nc4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,\n-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6\nc-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z\nM500 241 v40 H399408 v-40z M500 435 v40 H400000 v-40z"
};
var tallDelim = function tallDelim2(label, midHeight) {
  switch (label) {
    case "lbrack":
      return "M403 1759 V84 H666 V0 H319 V1759 v" + midHeight + " v1759 h347 v-84\nH403z M403 1759 V0 H319 V1759 v" + midHeight + " v1759 h84z";
    case "rbrack":
      return "M347 1759 V0 H0 V84 H263 V1759 v" + midHeight + " v1759 H0 v84 H347z\nM347 1759 V0 H263 V1759 v" + midHeight + " v1759 h84z";
    case "vert":
      return "M145 15 v585 v" + midHeight + " v585 c2.667,10,9.667,15,21,15\nc10,0,16.667,-5,20,-15 v-585 v" + -midHeight + " v-585 c-2.667,-10,-9.667,-15,-21,-15\nc-10,0,-16.667,5,-20,15z M188 15 H145 v585 v" + midHeight + " v585 h43z";
    case "doublevert":
      return "M145 15 v585 v" + midHeight + " v585 c2.667,10,9.667,15,21,15\nc10,0,16.667,-5,20,-15 v-585 v" + -midHeight + " v-585 c-2.667,-10,-9.667,-15,-21,-15\nc-10,0,-16.667,5,-20,15z M188 15 H145 v585 v" + midHeight + " v585 h43z\nM367 15 v585 v" + midHeight + " v585 c2.667,10,9.667,15,21,15\nc10,0,16.667,-5,20,-15 v-585 v" + -midHeight + " v-585 c-2.667,-10,-9.667,-15,-21,-15\nc-10,0,-16.667,5,-20,15z M410 15 H367 v585 v" + midHeight + " v585 h43z";
    case "lfloor":
      return "M319 602 V0 H403 V602 v" + midHeight + " v1715 h263 v84 H319z\nMM319 602 V0 H403 V602 v" + midHeight + " v1715 H319z";
    case "rfloor":
      return "M319 602 V0 H403 V602 v" + midHeight + " v1799 H0 v-84 H319z\nMM319 602 V0 H403 V602 v" + midHeight + " v1715 H319z";
    case "lceil":
      return "M403 1759 V84 H666 V0 H319 V1759 v" + midHeight + " v602 h84z\nM403 1759 V0 H319 V1759 v" + midHeight + " v602 h84z";
    case "rceil":
      return "M347 1759 V0 H0 V84 H263 V1759 v" + midHeight + " v602 h84z\nM347 1759 V0 h-84 V1759 v" + midHeight + " v602 h84z";
    case "lparen":
      return "M863,9c0,-2,-2,-5,-6,-9c0,0,-17,0,-17,0c-12.7,0,-19.3,0.3,-20,1\nc-5.3,5.3,-10.3,11,-15,17c-242.7,294.7,-395.3,682,-458,1162c-21.3,163.3,-33.3,349,\n-36,557 l0," + (midHeight + 84) + "c0.2,6,0,26,0,60c2,159.3,10,310.7,24,454c53.3,528,210,\n949.7,470,1265c4.7,6,9.7,11.7,15,17c0.7,0.7,7,1,19,1c0,0,18,0,18,0c4,-4,6,-7,6,-9\nc0,-2.7,-3.3,-8.7,-10,-18c-135.3,-192.7,-235.5,-414.3,-300.5,-665c-65,-250.7,-102.5,\n-544.7,-112.5,-882c-2,-104,-3,-167,-3,-189\nl0,-" + (midHeight + 92) + "c0,-162.7,5.7,-314,17,-454c20.7,-272,63.7,-513,129,-723c65.3,\n-210,155.3,-396.3,270,-559c6.7,-9.3,10,-15.3,10,-18z";
    case "rparen":
      return "M76,0c-16.7,0,-25,3,-25,9c0,2,2,6.3,6,13c21.3,28.7,42.3,60.3,\n63,95c96.7,156.7,172.8,332.5,228.5,527.5c55.7,195,92.8,416.5,111.5,664.5\nc11.3,139.3,17,290.7,17,454c0,28,1.7,43,3.3,45l0," + (midHeight + 9) + "\nc-3,4,-3.3,16.7,-3.3,38c0,162,-5.7,313.7,-17,455c-18.7,248,-55.8,469.3,-111.5,664\nc-55.7,194.7,-131.8,370.3,-228.5,527c-20.7,34.7,-41.7,66.3,-63,95c-2,3.3,-4,7,-6,11\nc0,7.3,5.7,11,17,11c0,0,11,0,11,0c9.3,0,14.3,-0.3,15,-1c5.3,-5.3,10.3,-11,15,-17\nc242.7,-294.7,395.3,-681.7,458,-1161c21.3,-164.7,33.3,-350.7,36,-558\nl0,-" + (midHeight + 144) + "c-2,-159.3,-10,-310.7,-24,-454c-53.3,-528,-210,-949.7,\n-470,-1265c-4.7,-6,-9.7,-11.7,-15,-17c-0.7,-0.7,-6.7,-1,-18,-1z";
    default:
      throw new Error("Unknown stretchy delimiter.");
  }
};
var DocumentFragment = class {
  // HtmlDomNode
  // Never used; needed for satisfying interface.
  constructor(children) {
    this.children = void 0;
    this.classes = void 0;
    this.height = void 0;
    this.depth = void 0;
    this.maxFontSize = void 0;
    this.style = void 0;
    this.children = children;
    this.classes = [];
    this.height = 0;
    this.depth = 0;
    this.maxFontSize = 0;
    this.style = {};
  }
  hasClass(className) {
    return utils.contains(this.classes, className);
  }
  /** Convert the fragment into a node. */
  toNode() {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < this.children.length; i++) {
      frag.appendChild(this.children[i].toNode());
    }
    return frag;
  }
  /** Convert the fragment into HTML markup. */
  toMarkup() {
    var markup = "";
    for (var i = 0; i < this.children.length; i++) {
      markup += this.children[i].toMarkup();
    }
    return markup;
  }
  /**
   * Converts the math node into a string, similar to innerText. Applies to
   * MathDomNode's only.
   */
  toText() {
    var toText = (child) => child.toText();
    return this.children.map(toText).join("");
  }
};
var fontMetricsData = {
  "AMS-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "65": [0, 0.68889, 0, 0, 0.72222],
    "66": [0, 0.68889, 0, 0, 0.66667],
    "67": [0, 0.68889, 0, 0, 0.72222],
    "68": [0, 0.68889, 0, 0, 0.72222],
    "69": [0, 0.68889, 0, 0, 0.66667],
    "70": [0, 0.68889, 0, 0, 0.61111],
    "71": [0, 0.68889, 0, 0, 0.77778],
    "72": [0, 0.68889, 0, 0, 0.77778],
    "73": [0, 0.68889, 0, 0, 0.38889],
    "74": [0.16667, 0.68889, 0, 0, 0.5],
    "75": [0, 0.68889, 0, 0, 0.77778],
    "76": [0, 0.68889, 0, 0, 0.66667],
    "77": [0, 0.68889, 0, 0, 0.94445],
    "78": [0, 0.68889, 0, 0, 0.72222],
    "79": [0.16667, 0.68889, 0, 0, 0.77778],
    "80": [0, 0.68889, 0, 0, 0.61111],
    "81": [0.16667, 0.68889, 0, 0, 0.77778],
    "82": [0, 0.68889, 0, 0, 0.72222],
    "83": [0, 0.68889, 0, 0, 0.55556],
    "84": [0, 0.68889, 0, 0, 0.66667],
    "85": [0, 0.68889, 0, 0, 0.72222],
    "86": [0, 0.68889, 0, 0, 0.72222],
    "87": [0, 0.68889, 0, 0, 1],
    "88": [0, 0.68889, 0, 0, 0.72222],
    "89": [0, 0.68889, 0, 0, 0.72222],
    "90": [0, 0.68889, 0, 0, 0.66667],
    "107": [0, 0.68889, 0, 0, 0.55556],
    "160": [0, 0, 0, 0, 0.25],
    "165": [0, 0.675, 0.025, 0, 0.75],
    "174": [0.15559, 0.69224, 0, 0, 0.94666],
    "240": [0, 0.68889, 0, 0, 0.55556],
    "295": [0, 0.68889, 0, 0, 0.54028],
    "710": [0, 0.825, 0, 0, 2.33334],
    "732": [0, 0.9, 0, 0, 2.33334],
    "770": [0, 0.825, 0, 0, 2.33334],
    "771": [0, 0.9, 0, 0, 2.33334],
    "989": [0.08167, 0.58167, 0, 0, 0.77778],
    "1008": [0, 0.43056, 0.04028, 0, 0.66667],
    "8245": [0, 0.54986, 0, 0, 0.275],
    "8463": [0, 0.68889, 0, 0, 0.54028],
    "8487": [0, 0.68889, 0, 0, 0.72222],
    "8498": [0, 0.68889, 0, 0, 0.55556],
    "8502": [0, 0.68889, 0, 0, 0.66667],
    "8503": [0, 0.68889, 0, 0, 0.44445],
    "8504": [0, 0.68889, 0, 0, 0.66667],
    "8513": [0, 0.68889, 0, 0, 0.63889],
    "8592": [-0.03598, 0.46402, 0, 0, 0.5],
    "8594": [-0.03598, 0.46402, 0, 0, 0.5],
    "8602": [-0.13313, 0.36687, 0, 0, 1],
    "8603": [-0.13313, 0.36687, 0, 0, 1],
    "8606": [0.01354, 0.52239, 0, 0, 1],
    "8608": [0.01354, 0.52239, 0, 0, 1],
    "8610": [0.01354, 0.52239, 0, 0, 1.11111],
    "8611": [0.01354, 0.52239, 0, 0, 1.11111],
    "8619": [0, 0.54986, 0, 0, 1],
    "8620": [0, 0.54986, 0, 0, 1],
    "8621": [-0.13313, 0.37788, 0, 0, 1.38889],
    "8622": [-0.13313, 0.36687, 0, 0, 1],
    "8624": [0, 0.69224, 0, 0, 0.5],
    "8625": [0, 0.69224, 0, 0, 0.5],
    "8630": [0, 0.43056, 0, 0, 1],
    "8631": [0, 0.43056, 0, 0, 1],
    "8634": [0.08198, 0.58198, 0, 0, 0.77778],
    "8635": [0.08198, 0.58198, 0, 0, 0.77778],
    "8638": [0.19444, 0.69224, 0, 0, 0.41667],
    "8639": [0.19444, 0.69224, 0, 0, 0.41667],
    "8642": [0.19444, 0.69224, 0, 0, 0.41667],
    "8643": [0.19444, 0.69224, 0, 0, 0.41667],
    "8644": [0.1808, 0.675, 0, 0, 1],
    "8646": [0.1808, 0.675, 0, 0, 1],
    "8647": [0.1808, 0.675, 0, 0, 1],
    "8648": [0.19444, 0.69224, 0, 0, 0.83334],
    "8649": [0.1808, 0.675, 0, 0, 1],
    "8650": [0.19444, 0.69224, 0, 0, 0.83334],
    "8651": [0.01354, 0.52239, 0, 0, 1],
    "8652": [0.01354, 0.52239, 0, 0, 1],
    "8653": [-0.13313, 0.36687, 0, 0, 1],
    "8654": [-0.13313, 0.36687, 0, 0, 1],
    "8655": [-0.13313, 0.36687, 0, 0, 1],
    "8666": [0.13667, 0.63667, 0, 0, 1],
    "8667": [0.13667, 0.63667, 0, 0, 1],
    "8669": [-0.13313, 0.37788, 0, 0, 1],
    "8672": [-0.064, 0.437, 0, 0, 1.334],
    "8674": [-0.064, 0.437, 0, 0, 1.334],
    "8705": [0, 0.825, 0, 0, 0.5],
    "8708": [0, 0.68889, 0, 0, 0.55556],
    "8709": [0.08167, 0.58167, 0, 0, 0.77778],
    "8717": [0, 0.43056, 0, 0, 0.42917],
    "8722": [-0.03598, 0.46402, 0, 0, 0.5],
    "8724": [0.08198, 0.69224, 0, 0, 0.77778],
    "8726": [0.08167, 0.58167, 0, 0, 0.77778],
    "8733": [0, 0.69224, 0, 0, 0.77778],
    "8736": [0, 0.69224, 0, 0, 0.72222],
    "8737": [0, 0.69224, 0, 0, 0.72222],
    "8738": [0.03517, 0.52239, 0, 0, 0.72222],
    "8739": [0.08167, 0.58167, 0, 0, 0.22222],
    "8740": [0.25142, 0.74111, 0, 0, 0.27778],
    "8741": [0.08167, 0.58167, 0, 0, 0.38889],
    "8742": [0.25142, 0.74111, 0, 0, 0.5],
    "8756": [0, 0.69224, 0, 0, 0.66667],
    "8757": [0, 0.69224, 0, 0, 0.66667],
    "8764": [-0.13313, 0.36687, 0, 0, 0.77778],
    "8765": [-0.13313, 0.37788, 0, 0, 0.77778],
    "8769": [-0.13313, 0.36687, 0, 0, 0.77778],
    "8770": [-0.03625, 0.46375, 0, 0, 0.77778],
    "8774": [0.30274, 0.79383, 0, 0, 0.77778],
    "8776": [-0.01688, 0.48312, 0, 0, 0.77778],
    "8778": [0.08167, 0.58167, 0, 0, 0.77778],
    "8782": [0.06062, 0.54986, 0, 0, 0.77778],
    "8783": [0.06062, 0.54986, 0, 0, 0.77778],
    "8785": [0.08198, 0.58198, 0, 0, 0.77778],
    "8786": [0.08198, 0.58198, 0, 0, 0.77778],
    "8787": [0.08198, 0.58198, 0, 0, 0.77778],
    "8790": [0, 0.69224, 0, 0, 0.77778],
    "8791": [0.22958, 0.72958, 0, 0, 0.77778],
    "8796": [0.08198, 0.91667, 0, 0, 0.77778],
    "8806": [0.25583, 0.75583, 0, 0, 0.77778],
    "8807": [0.25583, 0.75583, 0, 0, 0.77778],
    "8808": [0.25142, 0.75726, 0, 0, 0.77778],
    "8809": [0.25142, 0.75726, 0, 0, 0.77778],
    "8812": [0.25583, 0.75583, 0, 0, 0.5],
    "8814": [0.20576, 0.70576, 0, 0, 0.77778],
    "8815": [0.20576, 0.70576, 0, 0, 0.77778],
    "8816": [0.30274, 0.79383, 0, 0, 0.77778],
    "8817": [0.30274, 0.79383, 0, 0, 0.77778],
    "8818": [0.22958, 0.72958, 0, 0, 0.77778],
    "8819": [0.22958, 0.72958, 0, 0, 0.77778],
    "8822": [0.1808, 0.675, 0, 0, 0.77778],
    "8823": [0.1808, 0.675, 0, 0, 0.77778],
    "8828": [0.13667, 0.63667, 0, 0, 0.77778],
    "8829": [0.13667, 0.63667, 0, 0, 0.77778],
    "8830": [0.22958, 0.72958, 0, 0, 0.77778],
    "8831": [0.22958, 0.72958, 0, 0, 0.77778],
    "8832": [0.20576, 0.70576, 0, 0, 0.77778],
    "8833": [0.20576, 0.70576, 0, 0, 0.77778],
    "8840": [0.30274, 0.79383, 0, 0, 0.77778],
    "8841": [0.30274, 0.79383, 0, 0, 0.77778],
    "8842": [0.13597, 0.63597, 0, 0, 0.77778],
    "8843": [0.13597, 0.63597, 0, 0, 0.77778],
    "8847": [0.03517, 0.54986, 0, 0, 0.77778],
    "8848": [0.03517, 0.54986, 0, 0, 0.77778],
    "8858": [0.08198, 0.58198, 0, 0, 0.77778],
    "8859": [0.08198, 0.58198, 0, 0, 0.77778],
    "8861": [0.08198, 0.58198, 0, 0, 0.77778],
    "8862": [0, 0.675, 0, 0, 0.77778],
    "8863": [0, 0.675, 0, 0, 0.77778],
    "8864": [0, 0.675, 0, 0, 0.77778],
    "8865": [0, 0.675, 0, 0, 0.77778],
    "8872": [0, 0.69224, 0, 0, 0.61111],
    "8873": [0, 0.69224, 0, 0, 0.72222],
    "8874": [0, 0.69224, 0, 0, 0.88889],
    "8876": [0, 0.68889, 0, 0, 0.61111],
    "8877": [0, 0.68889, 0, 0, 0.61111],
    "8878": [0, 0.68889, 0, 0, 0.72222],
    "8879": [0, 0.68889, 0, 0, 0.72222],
    "8882": [0.03517, 0.54986, 0, 0, 0.77778],
    "8883": [0.03517, 0.54986, 0, 0, 0.77778],
    "8884": [0.13667, 0.63667, 0, 0, 0.77778],
    "8885": [0.13667, 0.63667, 0, 0, 0.77778],
    "8888": [0, 0.54986, 0, 0, 1.11111],
    "8890": [0.19444, 0.43056, 0, 0, 0.55556],
    "8891": [0.19444, 0.69224, 0, 0, 0.61111],
    "8892": [0.19444, 0.69224, 0, 0, 0.61111],
    "8901": [0, 0.54986, 0, 0, 0.27778],
    "8903": [0.08167, 0.58167, 0, 0, 0.77778],
    "8905": [0.08167, 0.58167, 0, 0, 0.77778],
    "8906": [0.08167, 0.58167, 0, 0, 0.77778],
    "8907": [0, 0.69224, 0, 0, 0.77778],
    "8908": [0, 0.69224, 0, 0, 0.77778],
    "8909": [-0.03598, 0.46402, 0, 0, 0.77778],
    "8910": [0, 0.54986, 0, 0, 0.76042],
    "8911": [0, 0.54986, 0, 0, 0.76042],
    "8912": [0.03517, 0.54986, 0, 0, 0.77778],
    "8913": [0.03517, 0.54986, 0, 0, 0.77778],
    "8914": [0, 0.54986, 0, 0, 0.66667],
    "8915": [0, 0.54986, 0, 0, 0.66667],
    "8916": [0, 0.69224, 0, 0, 0.66667],
    "8918": [0.0391, 0.5391, 0, 0, 0.77778],
    "8919": [0.0391, 0.5391, 0, 0, 0.77778],
    "8920": [0.03517, 0.54986, 0, 0, 1.33334],
    "8921": [0.03517, 0.54986, 0, 0, 1.33334],
    "8922": [0.38569, 0.88569, 0, 0, 0.77778],
    "8923": [0.38569, 0.88569, 0, 0, 0.77778],
    "8926": [0.13667, 0.63667, 0, 0, 0.77778],
    "8927": [0.13667, 0.63667, 0, 0, 0.77778],
    "8928": [0.30274, 0.79383, 0, 0, 0.77778],
    "8929": [0.30274, 0.79383, 0, 0, 0.77778],
    "8934": [0.23222, 0.74111, 0, 0, 0.77778],
    "8935": [0.23222, 0.74111, 0, 0, 0.77778],
    "8936": [0.23222, 0.74111, 0, 0, 0.77778],
    "8937": [0.23222, 0.74111, 0, 0, 0.77778],
    "8938": [0.20576, 0.70576, 0, 0, 0.77778],
    "8939": [0.20576, 0.70576, 0, 0, 0.77778],
    "8940": [0.30274, 0.79383, 0, 0, 0.77778],
    "8941": [0.30274, 0.79383, 0, 0, 0.77778],
    "8994": [0.19444, 0.69224, 0, 0, 0.77778],
    "8995": [0.19444, 0.69224, 0, 0, 0.77778],
    "9416": [0.15559, 0.69224, 0, 0, 0.90222],
    "9484": [0, 0.69224, 0, 0, 0.5],
    "9488": [0, 0.69224, 0, 0, 0.5],
    "9492": [0, 0.37788, 0, 0, 0.5],
    "9496": [0, 0.37788, 0, 0, 0.5],
    "9585": [0.19444, 0.68889, 0, 0, 0.88889],
    "9586": [0.19444, 0.74111, 0, 0, 0.88889],
    "9632": [0, 0.675, 0, 0, 0.77778],
    "9633": [0, 0.675, 0, 0, 0.77778],
    "9650": [0, 0.54986, 0, 0, 0.72222],
    "9651": [0, 0.54986, 0, 0, 0.72222],
    "9654": [0.03517, 0.54986, 0, 0, 0.77778],
    "9660": [0, 0.54986, 0, 0, 0.72222],
    "9661": [0, 0.54986, 0, 0, 0.72222],
    "9664": [0.03517, 0.54986, 0, 0, 0.77778],
    "9674": [0.11111, 0.69224, 0, 0, 0.66667],
    "9733": [0.19444, 0.69224, 0, 0, 0.94445],
    "10003": [0, 0.69224, 0, 0, 0.83334],
    "10016": [0, 0.69224, 0, 0, 0.83334],
    "10731": [0.11111, 0.69224, 0, 0, 0.66667],
    "10846": [0.19444, 0.75583, 0, 0, 0.61111],
    "10877": [0.13667, 0.63667, 0, 0, 0.77778],
    "10878": [0.13667, 0.63667, 0, 0, 0.77778],
    "10885": [0.25583, 0.75583, 0, 0, 0.77778],
    "10886": [0.25583, 0.75583, 0, 0, 0.77778],
    "10887": [0.13597, 0.63597, 0, 0, 0.77778],
    "10888": [0.13597, 0.63597, 0, 0, 0.77778],
    "10889": [0.26167, 0.75726, 0, 0, 0.77778],
    "10890": [0.26167, 0.75726, 0, 0, 0.77778],
    "10891": [0.48256, 0.98256, 0, 0, 0.77778],
    "10892": [0.48256, 0.98256, 0, 0, 0.77778],
    "10901": [0.13667, 0.63667, 0, 0, 0.77778],
    "10902": [0.13667, 0.63667, 0, 0, 0.77778],
    "10933": [0.25142, 0.75726, 0, 0, 0.77778],
    "10934": [0.25142, 0.75726, 0, 0, 0.77778],
    "10935": [0.26167, 0.75726, 0, 0, 0.77778],
    "10936": [0.26167, 0.75726, 0, 0, 0.77778],
    "10937": [0.26167, 0.75726, 0, 0, 0.77778],
    "10938": [0.26167, 0.75726, 0, 0, 0.77778],
    "10949": [0.25583, 0.75583, 0, 0, 0.77778],
    "10950": [0.25583, 0.75583, 0, 0, 0.77778],
    "10955": [0.28481, 0.79383, 0, 0, 0.77778],
    "10956": [0.28481, 0.79383, 0, 0, 0.77778],
    "57350": [0.08167, 0.58167, 0, 0, 0.22222],
    "57351": [0.08167, 0.58167, 0, 0, 0.38889],
    "57352": [0.08167, 0.58167, 0, 0, 0.77778],
    "57353": [0, 0.43056, 0.04028, 0, 0.66667],
    "57356": [0.25142, 0.75726, 0, 0, 0.77778],
    "57357": [0.25142, 0.75726, 0, 0, 0.77778],
    "57358": [0.41951, 0.91951, 0, 0, 0.77778],
    "57359": [0.30274, 0.79383, 0, 0, 0.77778],
    "57360": [0.30274, 0.79383, 0, 0, 0.77778],
    "57361": [0.41951, 0.91951, 0, 0, 0.77778],
    "57366": [0.25142, 0.75726, 0, 0, 0.77778],
    "57367": [0.25142, 0.75726, 0, 0, 0.77778],
    "57368": [0.25142, 0.75726, 0, 0, 0.77778],
    "57369": [0.25142, 0.75726, 0, 0, 0.77778],
    "57370": [0.13597, 0.63597, 0, 0, 0.77778],
    "57371": [0.13597, 0.63597, 0, 0, 0.77778]
  },
  "Caligraphic-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "65": [0, 0.68333, 0, 0.19445, 0.79847],
    "66": [0, 0.68333, 0.03041, 0.13889, 0.65681],
    "67": [0, 0.68333, 0.05834, 0.13889, 0.52653],
    "68": [0, 0.68333, 0.02778, 0.08334, 0.77139],
    "69": [0, 0.68333, 0.08944, 0.11111, 0.52778],
    "70": [0, 0.68333, 0.09931, 0.11111, 0.71875],
    "71": [0.09722, 0.68333, 0.0593, 0.11111, 0.59487],
    "72": [0, 0.68333, 965e-5, 0.11111, 0.84452],
    "73": [0, 0.68333, 0.07382, 0, 0.54452],
    "74": [0.09722, 0.68333, 0.18472, 0.16667, 0.67778],
    "75": [0, 0.68333, 0.01445, 0.05556, 0.76195],
    "76": [0, 0.68333, 0, 0.13889, 0.68972],
    "77": [0, 0.68333, 0, 0.13889, 1.2009],
    "78": [0, 0.68333, 0.14736, 0.08334, 0.82049],
    "79": [0, 0.68333, 0.02778, 0.11111, 0.79611],
    "80": [0, 0.68333, 0.08222, 0.08334, 0.69556],
    "81": [0.09722, 0.68333, 0, 0.11111, 0.81667],
    "82": [0, 0.68333, 0, 0.08334, 0.8475],
    "83": [0, 0.68333, 0.075, 0.13889, 0.60556],
    "84": [0, 0.68333, 0.25417, 0, 0.54464],
    "85": [0, 0.68333, 0.09931, 0.08334, 0.62583],
    "86": [0, 0.68333, 0.08222, 0, 0.61278],
    "87": [0, 0.68333, 0.08222, 0.08334, 0.98778],
    "88": [0, 0.68333, 0.14643, 0.13889, 0.7133],
    "89": [0.09722, 0.68333, 0.08222, 0.08334, 0.66834],
    "90": [0, 0.68333, 0.07944, 0.13889, 0.72473],
    "160": [0, 0, 0, 0, 0.25]
  },
  "Fraktur-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69141, 0, 0, 0.29574],
    "34": [0, 0.69141, 0, 0, 0.21471],
    "38": [0, 0.69141, 0, 0, 0.73786],
    "39": [0, 0.69141, 0, 0, 0.21201],
    "40": [0.24982, 0.74947, 0, 0, 0.38865],
    "41": [0.24982, 0.74947, 0, 0, 0.38865],
    "42": [0, 0.62119, 0, 0, 0.27764],
    "43": [0.08319, 0.58283, 0, 0, 0.75623],
    "44": [0, 0.10803, 0, 0, 0.27764],
    "45": [0.08319, 0.58283, 0, 0, 0.75623],
    "46": [0, 0.10803, 0, 0, 0.27764],
    "47": [0.24982, 0.74947, 0, 0, 0.50181],
    "48": [0, 0.47534, 0, 0, 0.50181],
    "49": [0, 0.47534, 0, 0, 0.50181],
    "50": [0, 0.47534, 0, 0, 0.50181],
    "51": [0.18906, 0.47534, 0, 0, 0.50181],
    "52": [0.18906, 0.47534, 0, 0, 0.50181],
    "53": [0.18906, 0.47534, 0, 0, 0.50181],
    "54": [0, 0.69141, 0, 0, 0.50181],
    "55": [0.18906, 0.47534, 0, 0, 0.50181],
    "56": [0, 0.69141, 0, 0, 0.50181],
    "57": [0.18906, 0.47534, 0, 0, 0.50181],
    "58": [0, 0.47534, 0, 0, 0.21606],
    "59": [0.12604, 0.47534, 0, 0, 0.21606],
    "61": [-0.13099, 0.36866, 0, 0, 0.75623],
    "63": [0, 0.69141, 0, 0, 0.36245],
    "65": [0, 0.69141, 0, 0, 0.7176],
    "66": [0, 0.69141, 0, 0, 0.88397],
    "67": [0, 0.69141, 0, 0, 0.61254],
    "68": [0, 0.69141, 0, 0, 0.83158],
    "69": [0, 0.69141, 0, 0, 0.66278],
    "70": [0.12604, 0.69141, 0, 0, 0.61119],
    "71": [0, 0.69141, 0, 0, 0.78539],
    "72": [0.06302, 0.69141, 0, 0, 0.7203],
    "73": [0, 0.69141, 0, 0, 0.55448],
    "74": [0.12604, 0.69141, 0, 0, 0.55231],
    "75": [0, 0.69141, 0, 0, 0.66845],
    "76": [0, 0.69141, 0, 0, 0.66602],
    "77": [0, 0.69141, 0, 0, 1.04953],
    "78": [0, 0.69141, 0, 0, 0.83212],
    "79": [0, 0.69141, 0, 0, 0.82699],
    "80": [0.18906, 0.69141, 0, 0, 0.82753],
    "81": [0.03781, 0.69141, 0, 0, 0.82699],
    "82": [0, 0.69141, 0, 0, 0.82807],
    "83": [0, 0.69141, 0, 0, 0.82861],
    "84": [0, 0.69141, 0, 0, 0.66899],
    "85": [0, 0.69141, 0, 0, 0.64576],
    "86": [0, 0.69141, 0, 0, 0.83131],
    "87": [0, 0.69141, 0, 0, 1.04602],
    "88": [0, 0.69141, 0, 0, 0.71922],
    "89": [0.18906, 0.69141, 0, 0, 0.83293],
    "90": [0.12604, 0.69141, 0, 0, 0.60201],
    "91": [0.24982, 0.74947, 0, 0, 0.27764],
    "93": [0.24982, 0.74947, 0, 0, 0.27764],
    "94": [0, 0.69141, 0, 0, 0.49965],
    "97": [0, 0.47534, 0, 0, 0.50046],
    "98": [0, 0.69141, 0, 0, 0.51315],
    "99": [0, 0.47534, 0, 0, 0.38946],
    "100": [0, 0.62119, 0, 0, 0.49857],
    "101": [0, 0.47534, 0, 0, 0.40053],
    "102": [0.18906, 0.69141, 0, 0, 0.32626],
    "103": [0.18906, 0.47534, 0, 0, 0.5037],
    "104": [0.18906, 0.69141, 0, 0, 0.52126],
    "105": [0, 0.69141, 0, 0, 0.27899],
    "106": [0, 0.69141, 0, 0, 0.28088],
    "107": [0, 0.69141, 0, 0, 0.38946],
    "108": [0, 0.69141, 0, 0, 0.27953],
    "109": [0, 0.47534, 0, 0, 0.76676],
    "110": [0, 0.47534, 0, 0, 0.52666],
    "111": [0, 0.47534, 0, 0, 0.48885],
    "112": [0.18906, 0.52396, 0, 0, 0.50046],
    "113": [0.18906, 0.47534, 0, 0, 0.48912],
    "114": [0, 0.47534, 0, 0, 0.38919],
    "115": [0, 0.47534, 0, 0, 0.44266],
    "116": [0, 0.62119, 0, 0, 0.33301],
    "117": [0, 0.47534, 0, 0, 0.5172],
    "118": [0, 0.52396, 0, 0, 0.5118],
    "119": [0, 0.52396, 0, 0, 0.77351],
    "120": [0.18906, 0.47534, 0, 0, 0.38865],
    "121": [0.18906, 0.47534, 0, 0, 0.49884],
    "122": [0.18906, 0.47534, 0, 0, 0.39054],
    "160": [0, 0, 0, 0, 0.25],
    "8216": [0, 0.69141, 0, 0, 0.21471],
    "8217": [0, 0.69141, 0, 0, 0.21471],
    "58112": [0, 0.62119, 0, 0, 0.49749],
    "58113": [0, 0.62119, 0, 0, 0.4983],
    "58114": [0.18906, 0.69141, 0, 0, 0.33328],
    "58115": [0.18906, 0.69141, 0, 0, 0.32923],
    "58116": [0.18906, 0.47534, 0, 0, 0.50343],
    "58117": [0, 0.69141, 0, 0, 0.33301],
    "58118": [0, 0.62119, 0, 0, 0.33409],
    "58119": [0, 0.47534, 0, 0, 0.50073]
  },
  "Main-Bold": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0, 0, 0.35],
    "34": [0, 0.69444, 0, 0, 0.60278],
    "35": [0.19444, 0.69444, 0, 0, 0.95833],
    "36": [0.05556, 0.75, 0, 0, 0.575],
    "37": [0.05556, 0.75, 0, 0, 0.95833],
    "38": [0, 0.69444, 0, 0, 0.89444],
    "39": [0, 0.69444, 0, 0, 0.31944],
    "40": [0.25, 0.75, 0, 0, 0.44722],
    "41": [0.25, 0.75, 0, 0, 0.44722],
    "42": [0, 0.75, 0, 0, 0.575],
    "43": [0.13333, 0.63333, 0, 0, 0.89444],
    "44": [0.19444, 0.15556, 0, 0, 0.31944],
    "45": [0, 0.44444, 0, 0, 0.38333],
    "46": [0, 0.15556, 0, 0, 0.31944],
    "47": [0.25, 0.75, 0, 0, 0.575],
    "48": [0, 0.64444, 0, 0, 0.575],
    "49": [0, 0.64444, 0, 0, 0.575],
    "50": [0, 0.64444, 0, 0, 0.575],
    "51": [0, 0.64444, 0, 0, 0.575],
    "52": [0, 0.64444, 0, 0, 0.575],
    "53": [0, 0.64444, 0, 0, 0.575],
    "54": [0, 0.64444, 0, 0, 0.575],
    "55": [0, 0.64444, 0, 0, 0.575],
    "56": [0, 0.64444, 0, 0, 0.575],
    "57": [0, 0.64444, 0, 0, 0.575],
    "58": [0, 0.44444, 0, 0, 0.31944],
    "59": [0.19444, 0.44444, 0, 0, 0.31944],
    "60": [0.08556, 0.58556, 0, 0, 0.89444],
    "61": [-0.10889, 0.39111, 0, 0, 0.89444],
    "62": [0.08556, 0.58556, 0, 0, 0.89444],
    "63": [0, 0.69444, 0, 0, 0.54305],
    "64": [0, 0.69444, 0, 0, 0.89444],
    "65": [0, 0.68611, 0, 0, 0.86944],
    "66": [0, 0.68611, 0, 0, 0.81805],
    "67": [0, 0.68611, 0, 0, 0.83055],
    "68": [0, 0.68611, 0, 0, 0.88194],
    "69": [0, 0.68611, 0, 0, 0.75555],
    "70": [0, 0.68611, 0, 0, 0.72361],
    "71": [0, 0.68611, 0, 0, 0.90416],
    "72": [0, 0.68611, 0, 0, 0.9],
    "73": [0, 0.68611, 0, 0, 0.43611],
    "74": [0, 0.68611, 0, 0, 0.59444],
    "75": [0, 0.68611, 0, 0, 0.90138],
    "76": [0, 0.68611, 0, 0, 0.69166],
    "77": [0, 0.68611, 0, 0, 1.09166],
    "78": [0, 0.68611, 0, 0, 0.9],
    "79": [0, 0.68611, 0, 0, 0.86388],
    "80": [0, 0.68611, 0, 0, 0.78611],
    "81": [0.19444, 0.68611, 0, 0, 0.86388],
    "82": [0, 0.68611, 0, 0, 0.8625],
    "83": [0, 0.68611, 0, 0, 0.63889],
    "84": [0, 0.68611, 0, 0, 0.8],
    "85": [0, 0.68611, 0, 0, 0.88472],
    "86": [0, 0.68611, 0.01597, 0, 0.86944],
    "87": [0, 0.68611, 0.01597, 0, 1.18888],
    "88": [0, 0.68611, 0, 0, 0.86944],
    "89": [0, 0.68611, 0.02875, 0, 0.86944],
    "90": [0, 0.68611, 0, 0, 0.70277],
    "91": [0.25, 0.75, 0, 0, 0.31944],
    "92": [0.25, 0.75, 0, 0, 0.575],
    "93": [0.25, 0.75, 0, 0, 0.31944],
    "94": [0, 0.69444, 0, 0, 0.575],
    "95": [0.31, 0.13444, 0.03194, 0, 0.575],
    "97": [0, 0.44444, 0, 0, 0.55902],
    "98": [0, 0.69444, 0, 0, 0.63889],
    "99": [0, 0.44444, 0, 0, 0.51111],
    "100": [0, 0.69444, 0, 0, 0.63889],
    "101": [0, 0.44444, 0, 0, 0.52708],
    "102": [0, 0.69444, 0.10903, 0, 0.35139],
    "103": [0.19444, 0.44444, 0.01597, 0, 0.575],
    "104": [0, 0.69444, 0, 0, 0.63889],
    "105": [0, 0.69444, 0, 0, 0.31944],
    "106": [0.19444, 0.69444, 0, 0, 0.35139],
    "107": [0, 0.69444, 0, 0, 0.60694],
    "108": [0, 0.69444, 0, 0, 0.31944],
    "109": [0, 0.44444, 0, 0, 0.95833],
    "110": [0, 0.44444, 0, 0, 0.63889],
    "111": [0, 0.44444, 0, 0, 0.575],
    "112": [0.19444, 0.44444, 0, 0, 0.63889],
    "113": [0.19444, 0.44444, 0, 0, 0.60694],
    "114": [0, 0.44444, 0, 0, 0.47361],
    "115": [0, 0.44444, 0, 0, 0.45361],
    "116": [0, 0.63492, 0, 0, 0.44722],
    "117": [0, 0.44444, 0, 0, 0.63889],
    "118": [0, 0.44444, 0.01597, 0, 0.60694],
    "119": [0, 0.44444, 0.01597, 0, 0.83055],
    "120": [0, 0.44444, 0, 0, 0.60694],
    "121": [0.19444, 0.44444, 0.01597, 0, 0.60694],
    "122": [0, 0.44444, 0, 0, 0.51111],
    "123": [0.25, 0.75, 0, 0, 0.575],
    "124": [0.25, 0.75, 0, 0, 0.31944],
    "125": [0.25, 0.75, 0, 0, 0.575],
    "126": [0.35, 0.34444, 0, 0, 0.575],
    "160": [0, 0, 0, 0, 0.25],
    "163": [0, 0.69444, 0, 0, 0.86853],
    "168": [0, 0.69444, 0, 0, 0.575],
    "172": [0, 0.44444, 0, 0, 0.76666],
    "176": [0, 0.69444, 0, 0, 0.86944],
    "177": [0.13333, 0.63333, 0, 0, 0.89444],
    "184": [0.17014, 0, 0, 0, 0.51111],
    "198": [0, 0.68611, 0, 0, 1.04166],
    "215": [0.13333, 0.63333, 0, 0, 0.89444],
    "216": [0.04861, 0.73472, 0, 0, 0.89444],
    "223": [0, 0.69444, 0, 0, 0.59722],
    "230": [0, 0.44444, 0, 0, 0.83055],
    "247": [0.13333, 0.63333, 0, 0, 0.89444],
    "248": [0.09722, 0.54167, 0, 0, 0.575],
    "305": [0, 0.44444, 0, 0, 0.31944],
    "338": [0, 0.68611, 0, 0, 1.16944],
    "339": [0, 0.44444, 0, 0, 0.89444],
    "567": [0.19444, 0.44444, 0, 0, 0.35139],
    "710": [0, 0.69444, 0, 0, 0.575],
    "711": [0, 0.63194, 0, 0, 0.575],
    "713": [0, 0.59611, 0, 0, 0.575],
    "714": [0, 0.69444, 0, 0, 0.575],
    "715": [0, 0.69444, 0, 0, 0.575],
    "728": [0, 0.69444, 0, 0, 0.575],
    "729": [0, 0.69444, 0, 0, 0.31944],
    "730": [0, 0.69444, 0, 0, 0.86944],
    "732": [0, 0.69444, 0, 0, 0.575],
    "733": [0, 0.69444, 0, 0, 0.575],
    "915": [0, 0.68611, 0, 0, 0.69166],
    "916": [0, 0.68611, 0, 0, 0.95833],
    "920": [0, 0.68611, 0, 0, 0.89444],
    "923": [0, 0.68611, 0, 0, 0.80555],
    "926": [0, 0.68611, 0, 0, 0.76666],
    "928": [0, 0.68611, 0, 0, 0.9],
    "931": [0, 0.68611, 0, 0, 0.83055],
    "933": [0, 0.68611, 0, 0, 0.89444],
    "934": [0, 0.68611, 0, 0, 0.83055],
    "936": [0, 0.68611, 0, 0, 0.89444],
    "937": [0, 0.68611, 0, 0, 0.83055],
    "8211": [0, 0.44444, 0.03194, 0, 0.575],
    "8212": [0, 0.44444, 0.03194, 0, 1.14999],
    "8216": [0, 0.69444, 0, 0, 0.31944],
    "8217": [0, 0.69444, 0, 0, 0.31944],
    "8220": [0, 0.69444, 0, 0, 0.60278],
    "8221": [0, 0.69444, 0, 0, 0.60278],
    "8224": [0.19444, 0.69444, 0, 0, 0.51111],
    "8225": [0.19444, 0.69444, 0, 0, 0.51111],
    "8242": [0, 0.55556, 0, 0, 0.34444],
    "8407": [0, 0.72444, 0.15486, 0, 0.575],
    "8463": [0, 0.69444, 0, 0, 0.66759],
    "8465": [0, 0.69444, 0, 0, 0.83055],
    "8467": [0, 0.69444, 0, 0, 0.47361],
    "8472": [0.19444, 0.44444, 0, 0, 0.74027],
    "8476": [0, 0.69444, 0, 0, 0.83055],
    "8501": [0, 0.69444, 0, 0, 0.70277],
    "8592": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8593": [0.19444, 0.69444, 0, 0, 0.575],
    "8594": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8595": [0.19444, 0.69444, 0, 0, 0.575],
    "8596": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8597": [0.25, 0.75, 0, 0, 0.575],
    "8598": [0.19444, 0.69444, 0, 0, 1.14999],
    "8599": [0.19444, 0.69444, 0, 0, 1.14999],
    "8600": [0.19444, 0.69444, 0, 0, 1.14999],
    "8601": [0.19444, 0.69444, 0, 0, 1.14999],
    "8636": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8637": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8640": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8641": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8656": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8657": [0.19444, 0.69444, 0, 0, 0.70277],
    "8658": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8659": [0.19444, 0.69444, 0, 0, 0.70277],
    "8660": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8661": [0.25, 0.75, 0, 0, 0.70277],
    "8704": [0, 0.69444, 0, 0, 0.63889],
    "8706": [0, 0.69444, 0.06389, 0, 0.62847],
    "8707": [0, 0.69444, 0, 0, 0.63889],
    "8709": [0.05556, 0.75, 0, 0, 0.575],
    "8711": [0, 0.68611, 0, 0, 0.95833],
    "8712": [0.08556, 0.58556, 0, 0, 0.76666],
    "8715": [0.08556, 0.58556, 0, 0, 0.76666],
    "8722": [0.13333, 0.63333, 0, 0, 0.89444],
    "8723": [0.13333, 0.63333, 0, 0, 0.89444],
    "8725": [0.25, 0.75, 0, 0, 0.575],
    "8726": [0.25, 0.75, 0, 0, 0.575],
    "8727": [-0.02778, 0.47222, 0, 0, 0.575],
    "8728": [-0.02639, 0.47361, 0, 0, 0.575],
    "8729": [-0.02639, 0.47361, 0, 0, 0.575],
    "8730": [0.18, 0.82, 0, 0, 0.95833],
    "8733": [0, 0.44444, 0, 0, 0.89444],
    "8734": [0, 0.44444, 0, 0, 1.14999],
    "8736": [0, 0.69224, 0, 0, 0.72222],
    "8739": [0.25, 0.75, 0, 0, 0.31944],
    "8741": [0.25, 0.75, 0, 0, 0.575],
    "8743": [0, 0.55556, 0, 0, 0.76666],
    "8744": [0, 0.55556, 0, 0, 0.76666],
    "8745": [0, 0.55556, 0, 0, 0.76666],
    "8746": [0, 0.55556, 0, 0, 0.76666],
    "8747": [0.19444, 0.69444, 0.12778, 0, 0.56875],
    "8764": [-0.10889, 0.39111, 0, 0, 0.89444],
    "8768": [0.19444, 0.69444, 0, 0, 0.31944],
    "8771": [222e-5, 0.50222, 0, 0, 0.89444],
    "8773": [0.027, 0.638, 0, 0, 0.894],
    "8776": [0.02444, 0.52444, 0, 0, 0.89444],
    "8781": [222e-5, 0.50222, 0, 0, 0.89444],
    "8801": [222e-5, 0.50222, 0, 0, 0.89444],
    "8804": [0.19667, 0.69667, 0, 0, 0.89444],
    "8805": [0.19667, 0.69667, 0, 0, 0.89444],
    "8810": [0.08556, 0.58556, 0, 0, 1.14999],
    "8811": [0.08556, 0.58556, 0, 0, 1.14999],
    "8826": [0.08556, 0.58556, 0, 0, 0.89444],
    "8827": [0.08556, 0.58556, 0, 0, 0.89444],
    "8834": [0.08556, 0.58556, 0, 0, 0.89444],
    "8835": [0.08556, 0.58556, 0, 0, 0.89444],
    "8838": [0.19667, 0.69667, 0, 0, 0.89444],
    "8839": [0.19667, 0.69667, 0, 0, 0.89444],
    "8846": [0, 0.55556, 0, 0, 0.76666],
    "8849": [0.19667, 0.69667, 0, 0, 0.89444],
    "8850": [0.19667, 0.69667, 0, 0, 0.89444],
    "8851": [0, 0.55556, 0, 0, 0.76666],
    "8852": [0, 0.55556, 0, 0, 0.76666],
    "8853": [0.13333, 0.63333, 0, 0, 0.89444],
    "8854": [0.13333, 0.63333, 0, 0, 0.89444],
    "8855": [0.13333, 0.63333, 0, 0, 0.89444],
    "8856": [0.13333, 0.63333, 0, 0, 0.89444],
    "8857": [0.13333, 0.63333, 0, 0, 0.89444],
    "8866": [0, 0.69444, 0, 0, 0.70277],
    "8867": [0, 0.69444, 0, 0, 0.70277],
    "8868": [0, 0.69444, 0, 0, 0.89444],
    "8869": [0, 0.69444, 0, 0, 0.89444],
    "8900": [-0.02639, 0.47361, 0, 0, 0.575],
    "8901": [-0.02639, 0.47361, 0, 0, 0.31944],
    "8902": [-0.02778, 0.47222, 0, 0, 0.575],
    "8968": [0.25, 0.75, 0, 0, 0.51111],
    "8969": [0.25, 0.75, 0, 0, 0.51111],
    "8970": [0.25, 0.75, 0, 0, 0.51111],
    "8971": [0.25, 0.75, 0, 0, 0.51111],
    "8994": [-0.13889, 0.36111, 0, 0, 1.14999],
    "8995": [-0.13889, 0.36111, 0, 0, 1.14999],
    "9651": [0.19444, 0.69444, 0, 0, 1.02222],
    "9657": [-0.02778, 0.47222, 0, 0, 0.575],
    "9661": [0.19444, 0.69444, 0, 0, 1.02222],
    "9667": [-0.02778, 0.47222, 0, 0, 0.575],
    "9711": [0.19444, 0.69444, 0, 0, 1.14999],
    "9824": [0.12963, 0.69444, 0, 0, 0.89444],
    "9825": [0.12963, 0.69444, 0, 0, 0.89444],
    "9826": [0.12963, 0.69444, 0, 0, 0.89444],
    "9827": [0.12963, 0.69444, 0, 0, 0.89444],
    "9837": [0, 0.75, 0, 0, 0.44722],
    "9838": [0.19444, 0.69444, 0, 0, 0.44722],
    "9839": [0.19444, 0.69444, 0, 0, 0.44722],
    "10216": [0.25, 0.75, 0, 0, 0.44722],
    "10217": [0.25, 0.75, 0, 0, 0.44722],
    "10815": [0, 0.68611, 0, 0, 0.9],
    "10927": [0.19667, 0.69667, 0, 0, 0.89444],
    "10928": [0.19667, 0.69667, 0, 0, 0.89444],
    "57376": [0.19444, 0.69444, 0, 0, 0]
  },
  "Main-BoldItalic": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0.11417, 0, 0.38611],
    "34": [0, 0.69444, 0.07939, 0, 0.62055],
    "35": [0.19444, 0.69444, 0.06833, 0, 0.94444],
    "37": [0.05556, 0.75, 0.12861, 0, 0.94444],
    "38": [0, 0.69444, 0.08528, 0, 0.88555],
    "39": [0, 0.69444, 0.12945, 0, 0.35555],
    "40": [0.25, 0.75, 0.15806, 0, 0.47333],
    "41": [0.25, 0.75, 0.03306, 0, 0.47333],
    "42": [0, 0.75, 0.14333, 0, 0.59111],
    "43": [0.10333, 0.60333, 0.03306, 0, 0.88555],
    "44": [0.19444, 0.14722, 0, 0, 0.35555],
    "45": [0, 0.44444, 0.02611, 0, 0.41444],
    "46": [0, 0.14722, 0, 0, 0.35555],
    "47": [0.25, 0.75, 0.15806, 0, 0.59111],
    "48": [0, 0.64444, 0.13167, 0, 0.59111],
    "49": [0, 0.64444, 0.13167, 0, 0.59111],
    "50": [0, 0.64444, 0.13167, 0, 0.59111],
    "51": [0, 0.64444, 0.13167, 0, 0.59111],
    "52": [0.19444, 0.64444, 0.13167, 0, 0.59111],
    "53": [0, 0.64444, 0.13167, 0, 0.59111],
    "54": [0, 0.64444, 0.13167, 0, 0.59111],
    "55": [0.19444, 0.64444, 0.13167, 0, 0.59111],
    "56": [0, 0.64444, 0.13167, 0, 0.59111],
    "57": [0, 0.64444, 0.13167, 0, 0.59111],
    "58": [0, 0.44444, 0.06695, 0, 0.35555],
    "59": [0.19444, 0.44444, 0.06695, 0, 0.35555],
    "61": [-0.10889, 0.39111, 0.06833, 0, 0.88555],
    "63": [0, 0.69444, 0.11472, 0, 0.59111],
    "64": [0, 0.69444, 0.09208, 0, 0.88555],
    "65": [0, 0.68611, 0, 0, 0.86555],
    "66": [0, 0.68611, 0.0992, 0, 0.81666],
    "67": [0, 0.68611, 0.14208, 0, 0.82666],
    "68": [0, 0.68611, 0.09062, 0, 0.87555],
    "69": [0, 0.68611, 0.11431, 0, 0.75666],
    "70": [0, 0.68611, 0.12903, 0, 0.72722],
    "71": [0, 0.68611, 0.07347, 0, 0.89527],
    "72": [0, 0.68611, 0.17208, 0, 0.8961],
    "73": [0, 0.68611, 0.15681, 0, 0.47166],
    "74": [0, 0.68611, 0.145, 0, 0.61055],
    "75": [0, 0.68611, 0.14208, 0, 0.89499],
    "76": [0, 0.68611, 0, 0, 0.69777],
    "77": [0, 0.68611, 0.17208, 0, 1.07277],
    "78": [0, 0.68611, 0.17208, 0, 0.8961],
    "79": [0, 0.68611, 0.09062, 0, 0.85499],
    "80": [0, 0.68611, 0.0992, 0, 0.78721],
    "81": [0.19444, 0.68611, 0.09062, 0, 0.85499],
    "82": [0, 0.68611, 0.02559, 0, 0.85944],
    "83": [0, 0.68611, 0.11264, 0, 0.64999],
    "84": [0, 0.68611, 0.12903, 0, 0.7961],
    "85": [0, 0.68611, 0.17208, 0, 0.88083],
    "86": [0, 0.68611, 0.18625, 0, 0.86555],
    "87": [0, 0.68611, 0.18625, 0, 1.15999],
    "88": [0, 0.68611, 0.15681, 0, 0.86555],
    "89": [0, 0.68611, 0.19803, 0, 0.86555],
    "90": [0, 0.68611, 0.14208, 0, 0.70888],
    "91": [0.25, 0.75, 0.1875, 0, 0.35611],
    "93": [0.25, 0.75, 0.09972, 0, 0.35611],
    "94": [0, 0.69444, 0.06709, 0, 0.59111],
    "95": [0.31, 0.13444, 0.09811, 0, 0.59111],
    "97": [0, 0.44444, 0.09426, 0, 0.59111],
    "98": [0, 0.69444, 0.07861, 0, 0.53222],
    "99": [0, 0.44444, 0.05222, 0, 0.53222],
    "100": [0, 0.69444, 0.10861, 0, 0.59111],
    "101": [0, 0.44444, 0.085, 0, 0.53222],
    "102": [0.19444, 0.69444, 0.21778, 0, 0.4],
    "103": [0.19444, 0.44444, 0.105, 0, 0.53222],
    "104": [0, 0.69444, 0.09426, 0, 0.59111],
    "105": [0, 0.69326, 0.11387, 0, 0.35555],
    "106": [0.19444, 0.69326, 0.1672, 0, 0.35555],
    "107": [0, 0.69444, 0.11111, 0, 0.53222],
    "108": [0, 0.69444, 0.10861, 0, 0.29666],
    "109": [0, 0.44444, 0.09426, 0, 0.94444],
    "110": [0, 0.44444, 0.09426, 0, 0.64999],
    "111": [0, 0.44444, 0.07861, 0, 0.59111],
    "112": [0.19444, 0.44444, 0.07861, 0, 0.59111],
    "113": [0.19444, 0.44444, 0.105, 0, 0.53222],
    "114": [0, 0.44444, 0.11111, 0, 0.50167],
    "115": [0, 0.44444, 0.08167, 0, 0.48694],
    "116": [0, 0.63492, 0.09639, 0, 0.385],
    "117": [0, 0.44444, 0.09426, 0, 0.62055],
    "118": [0, 0.44444, 0.11111, 0, 0.53222],
    "119": [0, 0.44444, 0.11111, 0, 0.76777],
    "120": [0, 0.44444, 0.12583, 0, 0.56055],
    "121": [0.19444, 0.44444, 0.105, 0, 0.56166],
    "122": [0, 0.44444, 0.13889, 0, 0.49055],
    "126": [0.35, 0.34444, 0.11472, 0, 0.59111],
    "160": [0, 0, 0, 0, 0.25],
    "168": [0, 0.69444, 0.11473, 0, 0.59111],
    "176": [0, 0.69444, 0, 0, 0.94888],
    "184": [0.17014, 0, 0, 0, 0.53222],
    "198": [0, 0.68611, 0.11431, 0, 1.02277],
    "216": [0.04861, 0.73472, 0.09062, 0, 0.88555],
    "223": [0.19444, 0.69444, 0.09736, 0, 0.665],
    "230": [0, 0.44444, 0.085, 0, 0.82666],
    "248": [0.09722, 0.54167, 0.09458, 0, 0.59111],
    "305": [0, 0.44444, 0.09426, 0, 0.35555],
    "338": [0, 0.68611, 0.11431, 0, 1.14054],
    "339": [0, 0.44444, 0.085, 0, 0.82666],
    "567": [0.19444, 0.44444, 0.04611, 0, 0.385],
    "710": [0, 0.69444, 0.06709, 0, 0.59111],
    "711": [0, 0.63194, 0.08271, 0, 0.59111],
    "713": [0, 0.59444, 0.10444, 0, 0.59111],
    "714": [0, 0.69444, 0.08528, 0, 0.59111],
    "715": [0, 0.69444, 0, 0, 0.59111],
    "728": [0, 0.69444, 0.10333, 0, 0.59111],
    "729": [0, 0.69444, 0.12945, 0, 0.35555],
    "730": [0, 0.69444, 0, 0, 0.94888],
    "732": [0, 0.69444, 0.11472, 0, 0.59111],
    "733": [0, 0.69444, 0.11472, 0, 0.59111],
    "915": [0, 0.68611, 0.12903, 0, 0.69777],
    "916": [0, 0.68611, 0, 0, 0.94444],
    "920": [0, 0.68611, 0.09062, 0, 0.88555],
    "923": [0, 0.68611, 0, 0, 0.80666],
    "926": [0, 0.68611, 0.15092, 0, 0.76777],
    "928": [0, 0.68611, 0.17208, 0, 0.8961],
    "931": [0, 0.68611, 0.11431, 0, 0.82666],
    "933": [0, 0.68611, 0.10778, 0, 0.88555],
    "934": [0, 0.68611, 0.05632, 0, 0.82666],
    "936": [0, 0.68611, 0.10778, 0, 0.88555],
    "937": [0, 0.68611, 0.0992, 0, 0.82666],
    "8211": [0, 0.44444, 0.09811, 0, 0.59111],
    "8212": [0, 0.44444, 0.09811, 0, 1.18221],
    "8216": [0, 0.69444, 0.12945, 0, 0.35555],
    "8217": [0, 0.69444, 0.12945, 0, 0.35555],
    "8220": [0, 0.69444, 0.16772, 0, 0.62055],
    "8221": [0, 0.69444, 0.07939, 0, 0.62055]
  },
  "Main-Italic": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0.12417, 0, 0.30667],
    "34": [0, 0.69444, 0.06961, 0, 0.51444],
    "35": [0.19444, 0.69444, 0.06616, 0, 0.81777],
    "37": [0.05556, 0.75, 0.13639, 0, 0.81777],
    "38": [0, 0.69444, 0.09694, 0, 0.76666],
    "39": [0, 0.69444, 0.12417, 0, 0.30667],
    "40": [0.25, 0.75, 0.16194, 0, 0.40889],
    "41": [0.25, 0.75, 0.03694, 0, 0.40889],
    "42": [0, 0.75, 0.14917, 0, 0.51111],
    "43": [0.05667, 0.56167, 0.03694, 0, 0.76666],
    "44": [0.19444, 0.10556, 0, 0, 0.30667],
    "45": [0, 0.43056, 0.02826, 0, 0.35778],
    "46": [0, 0.10556, 0, 0, 0.30667],
    "47": [0.25, 0.75, 0.16194, 0, 0.51111],
    "48": [0, 0.64444, 0.13556, 0, 0.51111],
    "49": [0, 0.64444, 0.13556, 0, 0.51111],
    "50": [0, 0.64444, 0.13556, 0, 0.51111],
    "51": [0, 0.64444, 0.13556, 0, 0.51111],
    "52": [0.19444, 0.64444, 0.13556, 0, 0.51111],
    "53": [0, 0.64444, 0.13556, 0, 0.51111],
    "54": [0, 0.64444, 0.13556, 0, 0.51111],
    "55": [0.19444, 0.64444, 0.13556, 0, 0.51111],
    "56": [0, 0.64444, 0.13556, 0, 0.51111],
    "57": [0, 0.64444, 0.13556, 0, 0.51111],
    "58": [0, 0.43056, 0.0582, 0, 0.30667],
    "59": [0.19444, 0.43056, 0.0582, 0, 0.30667],
    "61": [-0.13313, 0.36687, 0.06616, 0, 0.76666],
    "63": [0, 0.69444, 0.1225, 0, 0.51111],
    "64": [0, 0.69444, 0.09597, 0, 0.76666],
    "65": [0, 0.68333, 0, 0, 0.74333],
    "66": [0, 0.68333, 0.10257, 0, 0.70389],
    "67": [0, 0.68333, 0.14528, 0, 0.71555],
    "68": [0, 0.68333, 0.09403, 0, 0.755],
    "69": [0, 0.68333, 0.12028, 0, 0.67833],
    "70": [0, 0.68333, 0.13305, 0, 0.65277],
    "71": [0, 0.68333, 0.08722, 0, 0.77361],
    "72": [0, 0.68333, 0.16389, 0, 0.74333],
    "73": [0, 0.68333, 0.15806, 0, 0.38555],
    "74": [0, 0.68333, 0.14028, 0, 0.525],
    "75": [0, 0.68333, 0.14528, 0, 0.76888],
    "76": [0, 0.68333, 0, 0, 0.62722],
    "77": [0, 0.68333, 0.16389, 0, 0.89666],
    "78": [0, 0.68333, 0.16389, 0, 0.74333],
    "79": [0, 0.68333, 0.09403, 0, 0.76666],
    "80": [0, 0.68333, 0.10257, 0, 0.67833],
    "81": [0.19444, 0.68333, 0.09403, 0, 0.76666],
    "82": [0, 0.68333, 0.03868, 0, 0.72944],
    "83": [0, 0.68333, 0.11972, 0, 0.56222],
    "84": [0, 0.68333, 0.13305, 0, 0.71555],
    "85": [0, 0.68333, 0.16389, 0, 0.74333],
    "86": [0, 0.68333, 0.18361, 0, 0.74333],
    "87": [0, 0.68333, 0.18361, 0, 0.99888],
    "88": [0, 0.68333, 0.15806, 0, 0.74333],
    "89": [0, 0.68333, 0.19383, 0, 0.74333],
    "90": [0, 0.68333, 0.14528, 0, 0.61333],
    "91": [0.25, 0.75, 0.1875, 0, 0.30667],
    "93": [0.25, 0.75, 0.10528, 0, 0.30667],
    "94": [0, 0.69444, 0.06646, 0, 0.51111],
    "95": [0.31, 0.12056, 0.09208, 0, 0.51111],
    "97": [0, 0.43056, 0.07671, 0, 0.51111],
    "98": [0, 0.69444, 0.06312, 0, 0.46],
    "99": [0, 0.43056, 0.05653, 0, 0.46],
    "100": [0, 0.69444, 0.10333, 0, 0.51111],
    "101": [0, 0.43056, 0.07514, 0, 0.46],
    "102": [0.19444, 0.69444, 0.21194, 0, 0.30667],
    "103": [0.19444, 0.43056, 0.08847, 0, 0.46],
    "104": [0, 0.69444, 0.07671, 0, 0.51111],
    "105": [0, 0.65536, 0.1019, 0, 0.30667],
    "106": [0.19444, 0.65536, 0.14467, 0, 0.30667],
    "107": [0, 0.69444, 0.10764, 0, 0.46],
    "108": [0, 0.69444, 0.10333, 0, 0.25555],
    "109": [0, 0.43056, 0.07671, 0, 0.81777],
    "110": [0, 0.43056, 0.07671, 0, 0.56222],
    "111": [0, 0.43056, 0.06312, 0, 0.51111],
    "112": [0.19444, 0.43056, 0.06312, 0, 0.51111],
    "113": [0.19444, 0.43056, 0.08847, 0, 0.46],
    "114": [0, 0.43056, 0.10764, 0, 0.42166],
    "115": [0, 0.43056, 0.08208, 0, 0.40889],
    "116": [0, 0.61508, 0.09486, 0, 0.33222],
    "117": [0, 0.43056, 0.07671, 0, 0.53666],
    "118": [0, 0.43056, 0.10764, 0, 0.46],
    "119": [0, 0.43056, 0.10764, 0, 0.66444],
    "120": [0, 0.43056, 0.12042, 0, 0.46389],
    "121": [0.19444, 0.43056, 0.08847, 0, 0.48555],
    "122": [0, 0.43056, 0.12292, 0, 0.40889],
    "126": [0.35, 0.31786, 0.11585, 0, 0.51111],
    "160": [0, 0, 0, 0, 0.25],
    "168": [0, 0.66786, 0.10474, 0, 0.51111],
    "176": [0, 0.69444, 0, 0, 0.83129],
    "184": [0.17014, 0, 0, 0, 0.46],
    "198": [0, 0.68333, 0.12028, 0, 0.88277],
    "216": [0.04861, 0.73194, 0.09403, 0, 0.76666],
    "223": [0.19444, 0.69444, 0.10514, 0, 0.53666],
    "230": [0, 0.43056, 0.07514, 0, 0.71555],
    "248": [0.09722, 0.52778, 0.09194, 0, 0.51111],
    "338": [0, 0.68333, 0.12028, 0, 0.98499],
    "339": [0, 0.43056, 0.07514, 0, 0.71555],
    "710": [0, 0.69444, 0.06646, 0, 0.51111],
    "711": [0, 0.62847, 0.08295, 0, 0.51111],
    "713": [0, 0.56167, 0.10333, 0, 0.51111],
    "714": [0, 0.69444, 0.09694, 0, 0.51111],
    "715": [0, 0.69444, 0, 0, 0.51111],
    "728": [0, 0.69444, 0.10806, 0, 0.51111],
    "729": [0, 0.66786, 0.11752, 0, 0.30667],
    "730": [0, 0.69444, 0, 0, 0.83129],
    "732": [0, 0.66786, 0.11585, 0, 0.51111],
    "733": [0, 0.69444, 0.1225, 0, 0.51111],
    "915": [0, 0.68333, 0.13305, 0, 0.62722],
    "916": [0, 0.68333, 0, 0, 0.81777],
    "920": [0, 0.68333, 0.09403, 0, 0.76666],
    "923": [0, 0.68333, 0, 0, 0.69222],
    "926": [0, 0.68333, 0.15294, 0, 0.66444],
    "928": [0, 0.68333, 0.16389, 0, 0.74333],
    "931": [0, 0.68333, 0.12028, 0, 0.71555],
    "933": [0, 0.68333, 0.11111, 0, 0.76666],
    "934": [0, 0.68333, 0.05986, 0, 0.71555],
    "936": [0, 0.68333, 0.11111, 0, 0.76666],
    "937": [0, 0.68333, 0.10257, 0, 0.71555],
    "8211": [0, 0.43056, 0.09208, 0, 0.51111],
    "8212": [0, 0.43056, 0.09208, 0, 1.02222],
    "8216": [0, 0.69444, 0.12417, 0, 0.30667],
    "8217": [0, 0.69444, 0.12417, 0, 0.30667],
    "8220": [0, 0.69444, 0.1685, 0, 0.51444],
    "8221": [0, 0.69444, 0.06961, 0, 0.51444],
    "8463": [0, 0.68889, 0, 0, 0.54028]
  },
  "Main-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0, 0, 0.27778],
    "34": [0, 0.69444, 0, 0, 0.5],
    "35": [0.19444, 0.69444, 0, 0, 0.83334],
    "36": [0.05556, 0.75, 0, 0, 0.5],
    "37": [0.05556, 0.75, 0, 0, 0.83334],
    "38": [0, 0.69444, 0, 0, 0.77778],
    "39": [0, 0.69444, 0, 0, 0.27778],
    "40": [0.25, 0.75, 0, 0, 0.38889],
    "41": [0.25, 0.75, 0, 0, 0.38889],
    "42": [0, 0.75, 0, 0, 0.5],
    "43": [0.08333, 0.58333, 0, 0, 0.77778],
    "44": [0.19444, 0.10556, 0, 0, 0.27778],
    "45": [0, 0.43056, 0, 0, 0.33333],
    "46": [0, 0.10556, 0, 0, 0.27778],
    "47": [0.25, 0.75, 0, 0, 0.5],
    "48": [0, 0.64444, 0, 0, 0.5],
    "49": [0, 0.64444, 0, 0, 0.5],
    "50": [0, 0.64444, 0, 0, 0.5],
    "51": [0, 0.64444, 0, 0, 0.5],
    "52": [0, 0.64444, 0, 0, 0.5],
    "53": [0, 0.64444, 0, 0, 0.5],
    "54": [0, 0.64444, 0, 0, 0.5],
    "55": [0, 0.64444, 0, 0, 0.5],
    "56": [0, 0.64444, 0, 0, 0.5],
    "57": [0, 0.64444, 0, 0, 0.5],
    "58": [0, 0.43056, 0, 0, 0.27778],
    "59": [0.19444, 0.43056, 0, 0, 0.27778],
    "60": [0.0391, 0.5391, 0, 0, 0.77778],
    "61": [-0.13313, 0.36687, 0, 0, 0.77778],
    "62": [0.0391, 0.5391, 0, 0, 0.77778],
    "63": [0, 0.69444, 0, 0, 0.47222],
    "64": [0, 0.69444, 0, 0, 0.77778],
    "65": [0, 0.68333, 0, 0, 0.75],
    "66": [0, 0.68333, 0, 0, 0.70834],
    "67": [0, 0.68333, 0, 0, 0.72222],
    "68": [0, 0.68333, 0, 0, 0.76389],
    "69": [0, 0.68333, 0, 0, 0.68056],
    "70": [0, 0.68333, 0, 0, 0.65278],
    "71": [0, 0.68333, 0, 0, 0.78472],
    "72": [0, 0.68333, 0, 0, 0.75],
    "73": [0, 0.68333, 0, 0, 0.36111],
    "74": [0, 0.68333, 0, 0, 0.51389],
    "75": [0, 0.68333, 0, 0, 0.77778],
    "76": [0, 0.68333, 0, 0, 0.625],
    "77": [0, 0.68333, 0, 0, 0.91667],
    "78": [0, 0.68333, 0, 0, 0.75],
    "79": [0, 0.68333, 0, 0, 0.77778],
    "80": [0, 0.68333, 0, 0, 0.68056],
    "81": [0.19444, 0.68333, 0, 0, 0.77778],
    "82": [0, 0.68333, 0, 0, 0.73611],
    "83": [0, 0.68333, 0, 0, 0.55556],
    "84": [0, 0.68333, 0, 0, 0.72222],
    "85": [0, 0.68333, 0, 0, 0.75],
    "86": [0, 0.68333, 0.01389, 0, 0.75],
    "87": [0, 0.68333, 0.01389, 0, 1.02778],
    "88": [0, 0.68333, 0, 0, 0.75],
    "89": [0, 0.68333, 0.025, 0, 0.75],
    "90": [0, 0.68333, 0, 0, 0.61111],
    "91": [0.25, 0.75, 0, 0, 0.27778],
    "92": [0.25, 0.75, 0, 0, 0.5],
    "93": [0.25, 0.75, 0, 0, 0.27778],
    "94": [0, 0.69444, 0, 0, 0.5],
    "95": [0.31, 0.12056, 0.02778, 0, 0.5],
    "97": [0, 0.43056, 0, 0, 0.5],
    "98": [0, 0.69444, 0, 0, 0.55556],
    "99": [0, 0.43056, 0, 0, 0.44445],
    "100": [0, 0.69444, 0, 0, 0.55556],
    "101": [0, 0.43056, 0, 0, 0.44445],
    "102": [0, 0.69444, 0.07778, 0, 0.30556],
    "103": [0.19444, 0.43056, 0.01389, 0, 0.5],
    "104": [0, 0.69444, 0, 0, 0.55556],
    "105": [0, 0.66786, 0, 0, 0.27778],
    "106": [0.19444, 0.66786, 0, 0, 0.30556],
    "107": [0, 0.69444, 0, 0, 0.52778],
    "108": [0, 0.69444, 0, 0, 0.27778],
    "109": [0, 0.43056, 0, 0, 0.83334],
    "110": [0, 0.43056, 0, 0, 0.55556],
    "111": [0, 0.43056, 0, 0, 0.5],
    "112": [0.19444, 0.43056, 0, 0, 0.55556],
    "113": [0.19444, 0.43056, 0, 0, 0.52778],
    "114": [0, 0.43056, 0, 0, 0.39167],
    "115": [0, 0.43056, 0, 0, 0.39445],
    "116": [0, 0.61508, 0, 0, 0.38889],
    "117": [0, 0.43056, 0, 0, 0.55556],
    "118": [0, 0.43056, 0.01389, 0, 0.52778],
    "119": [0, 0.43056, 0.01389, 0, 0.72222],
    "120": [0, 0.43056, 0, 0, 0.52778],
    "121": [0.19444, 0.43056, 0.01389, 0, 0.52778],
    "122": [0, 0.43056, 0, 0, 0.44445],
    "123": [0.25, 0.75, 0, 0, 0.5],
    "124": [0.25, 0.75, 0, 0, 0.27778],
    "125": [0.25, 0.75, 0, 0, 0.5],
    "126": [0.35, 0.31786, 0, 0, 0.5],
    "160": [0, 0, 0, 0, 0.25],
    "163": [0, 0.69444, 0, 0, 0.76909],
    "167": [0.19444, 0.69444, 0, 0, 0.44445],
    "168": [0, 0.66786, 0, 0, 0.5],
    "172": [0, 0.43056, 0, 0, 0.66667],
    "176": [0, 0.69444, 0, 0, 0.75],
    "177": [0.08333, 0.58333, 0, 0, 0.77778],
    "182": [0.19444, 0.69444, 0, 0, 0.61111],
    "184": [0.17014, 0, 0, 0, 0.44445],
    "198": [0, 0.68333, 0, 0, 0.90278],
    "215": [0.08333, 0.58333, 0, 0, 0.77778],
    "216": [0.04861, 0.73194, 0, 0, 0.77778],
    "223": [0, 0.69444, 0, 0, 0.5],
    "230": [0, 0.43056, 0, 0, 0.72222],
    "247": [0.08333, 0.58333, 0, 0, 0.77778],
    "248": [0.09722, 0.52778, 0, 0, 0.5],
    "305": [0, 0.43056, 0, 0, 0.27778],
    "338": [0, 0.68333, 0, 0, 1.01389],
    "339": [0, 0.43056, 0, 0, 0.77778],
    "567": [0.19444, 0.43056, 0, 0, 0.30556],
    "710": [0, 0.69444, 0, 0, 0.5],
    "711": [0, 0.62847, 0, 0, 0.5],
    "713": [0, 0.56778, 0, 0, 0.5],
    "714": [0, 0.69444, 0, 0, 0.5],
    "715": [0, 0.69444, 0, 0, 0.5],
    "728": [0, 0.69444, 0, 0, 0.5],
    "729": [0, 0.66786, 0, 0, 0.27778],
    "730": [0, 0.69444, 0, 0, 0.75],
    "732": [0, 0.66786, 0, 0, 0.5],
    "733": [0, 0.69444, 0, 0, 0.5],
    "915": [0, 0.68333, 0, 0, 0.625],
    "916": [0, 0.68333, 0, 0, 0.83334],
    "920": [0, 0.68333, 0, 0, 0.77778],
    "923": [0, 0.68333, 0, 0, 0.69445],
    "926": [0, 0.68333, 0, 0, 0.66667],
    "928": [0, 0.68333, 0, 0, 0.75],
    "931": [0, 0.68333, 0, 0, 0.72222],
    "933": [0, 0.68333, 0, 0, 0.77778],
    "934": [0, 0.68333, 0, 0, 0.72222],
    "936": [0, 0.68333, 0, 0, 0.77778],
    "937": [0, 0.68333, 0, 0, 0.72222],
    "8211": [0, 0.43056, 0.02778, 0, 0.5],
    "8212": [0, 0.43056, 0.02778, 0, 1],
    "8216": [0, 0.69444, 0, 0, 0.27778],
    "8217": [0, 0.69444, 0, 0, 0.27778],
    "8220": [0, 0.69444, 0, 0, 0.5],
    "8221": [0, 0.69444, 0, 0, 0.5],
    "8224": [0.19444, 0.69444, 0, 0, 0.44445],
    "8225": [0.19444, 0.69444, 0, 0, 0.44445],
    "8230": [0, 0.123, 0, 0, 1.172],
    "8242": [0, 0.55556, 0, 0, 0.275],
    "8407": [0, 0.71444, 0.15382, 0, 0.5],
    "8463": [0, 0.68889, 0, 0, 0.54028],
    "8465": [0, 0.69444, 0, 0, 0.72222],
    "8467": [0, 0.69444, 0, 0.11111, 0.41667],
    "8472": [0.19444, 0.43056, 0, 0.11111, 0.63646],
    "8476": [0, 0.69444, 0, 0, 0.72222],
    "8501": [0, 0.69444, 0, 0, 0.61111],
    "8592": [-0.13313, 0.36687, 0, 0, 1],
    "8593": [0.19444, 0.69444, 0, 0, 0.5],
    "8594": [-0.13313, 0.36687, 0, 0, 1],
    "8595": [0.19444, 0.69444, 0, 0, 0.5],
    "8596": [-0.13313, 0.36687, 0, 0, 1],
    "8597": [0.25, 0.75, 0, 0, 0.5],
    "8598": [0.19444, 0.69444, 0, 0, 1],
    "8599": [0.19444, 0.69444, 0, 0, 1],
    "8600": [0.19444, 0.69444, 0, 0, 1],
    "8601": [0.19444, 0.69444, 0, 0, 1],
    "8614": [0.011, 0.511, 0, 0, 1],
    "8617": [0.011, 0.511, 0, 0, 1.126],
    "8618": [0.011, 0.511, 0, 0, 1.126],
    "8636": [-0.13313, 0.36687, 0, 0, 1],
    "8637": [-0.13313, 0.36687, 0, 0, 1],
    "8640": [-0.13313, 0.36687, 0, 0, 1],
    "8641": [-0.13313, 0.36687, 0, 0, 1],
    "8652": [0.011, 0.671, 0, 0, 1],
    "8656": [-0.13313, 0.36687, 0, 0, 1],
    "8657": [0.19444, 0.69444, 0, 0, 0.61111],
    "8658": [-0.13313, 0.36687, 0, 0, 1],
    "8659": [0.19444, 0.69444, 0, 0, 0.61111],
    "8660": [-0.13313, 0.36687, 0, 0, 1],
    "8661": [0.25, 0.75, 0, 0, 0.61111],
    "8704": [0, 0.69444, 0, 0, 0.55556],
    "8706": [0, 0.69444, 0.05556, 0.08334, 0.5309],
    "8707": [0, 0.69444, 0, 0, 0.55556],
    "8709": [0.05556, 0.75, 0, 0, 0.5],
    "8711": [0, 0.68333, 0, 0, 0.83334],
    "8712": [0.0391, 0.5391, 0, 0, 0.66667],
    "8715": [0.0391, 0.5391, 0, 0, 0.66667],
    "8722": [0.08333, 0.58333, 0, 0, 0.77778],
    "8723": [0.08333, 0.58333, 0, 0, 0.77778],
    "8725": [0.25, 0.75, 0, 0, 0.5],
    "8726": [0.25, 0.75, 0, 0, 0.5],
    "8727": [-0.03472, 0.46528, 0, 0, 0.5],
    "8728": [-0.05555, 0.44445, 0, 0, 0.5],
    "8729": [-0.05555, 0.44445, 0, 0, 0.5],
    "8730": [0.2, 0.8, 0, 0, 0.83334],
    "8733": [0, 0.43056, 0, 0, 0.77778],
    "8734": [0, 0.43056, 0, 0, 1],
    "8736": [0, 0.69224, 0, 0, 0.72222],
    "8739": [0.25, 0.75, 0, 0, 0.27778],
    "8741": [0.25, 0.75, 0, 0, 0.5],
    "8743": [0, 0.55556, 0, 0, 0.66667],
    "8744": [0, 0.55556, 0, 0, 0.66667],
    "8745": [0, 0.55556, 0, 0, 0.66667],
    "8746": [0, 0.55556, 0, 0, 0.66667],
    "8747": [0.19444, 0.69444, 0.11111, 0, 0.41667],
    "8764": [-0.13313, 0.36687, 0, 0, 0.77778],
    "8768": [0.19444, 0.69444, 0, 0, 0.27778],
    "8771": [-0.03625, 0.46375, 0, 0, 0.77778],
    "8773": [-0.022, 0.589, 0, 0, 0.778],
    "8776": [-0.01688, 0.48312, 0, 0, 0.77778],
    "8781": [-0.03625, 0.46375, 0, 0, 0.77778],
    "8784": [-0.133, 0.673, 0, 0, 0.778],
    "8801": [-0.03625, 0.46375, 0, 0, 0.77778],
    "8804": [0.13597, 0.63597, 0, 0, 0.77778],
    "8805": [0.13597, 0.63597, 0, 0, 0.77778],
    "8810": [0.0391, 0.5391, 0, 0, 1],
    "8811": [0.0391, 0.5391, 0, 0, 1],
    "8826": [0.0391, 0.5391, 0, 0, 0.77778],
    "8827": [0.0391, 0.5391, 0, 0, 0.77778],
    "8834": [0.0391, 0.5391, 0, 0, 0.77778],
    "8835": [0.0391, 0.5391, 0, 0, 0.77778],
    "8838": [0.13597, 0.63597, 0, 0, 0.77778],
    "8839": [0.13597, 0.63597, 0, 0, 0.77778],
    "8846": [0, 0.55556, 0, 0, 0.66667],
    "8849": [0.13597, 0.63597, 0, 0, 0.77778],
    "8850": [0.13597, 0.63597, 0, 0, 0.77778],
    "8851": [0, 0.55556, 0, 0, 0.66667],
    "8852": [0, 0.55556, 0, 0, 0.66667],
    "8853": [0.08333, 0.58333, 0, 0, 0.77778],
    "8854": [0.08333, 0.58333, 0, 0, 0.77778],
    "8855": [0.08333, 0.58333, 0, 0, 0.77778],
    "8856": [0.08333, 0.58333, 0, 0, 0.77778],
    "8857": [0.08333, 0.58333, 0, 0, 0.77778],
    "8866": [0, 0.69444, 0, 0, 0.61111],
    "8867": [0, 0.69444, 0, 0, 0.61111],
    "8868": [0, 0.69444, 0, 0, 0.77778],
    "8869": [0, 0.69444, 0, 0, 0.77778],
    "8872": [0.249, 0.75, 0, 0, 0.867],
    "8900": [-0.05555, 0.44445, 0, 0, 0.5],
    "8901": [-0.05555, 0.44445, 0, 0, 0.27778],
    "8902": [-0.03472, 0.46528, 0, 0, 0.5],
    "8904": [5e-3, 0.505, 0, 0, 0.9],
    "8942": [0.03, 0.903, 0, 0, 0.278],
    "8943": [-0.19, 0.313, 0, 0, 1.172],
    "8945": [-0.1, 0.823, 0, 0, 1.282],
    "8968": [0.25, 0.75, 0, 0, 0.44445],
    "8969": [0.25, 0.75, 0, 0, 0.44445],
    "8970": [0.25, 0.75, 0, 0, 0.44445],
    "8971": [0.25, 0.75, 0, 0, 0.44445],
    "8994": [-0.14236, 0.35764, 0, 0, 1],
    "8995": [-0.14236, 0.35764, 0, 0, 1],
    "9136": [0.244, 0.744, 0, 0, 0.412],
    "9137": [0.244, 0.745, 0, 0, 0.412],
    "9651": [0.19444, 0.69444, 0, 0, 0.88889],
    "9657": [-0.03472, 0.46528, 0, 0, 0.5],
    "9661": [0.19444, 0.69444, 0, 0, 0.88889],
    "9667": [-0.03472, 0.46528, 0, 0, 0.5],
    "9711": [0.19444, 0.69444, 0, 0, 1],
    "9824": [0.12963, 0.69444, 0, 0, 0.77778],
    "9825": [0.12963, 0.69444, 0, 0, 0.77778],
    "9826": [0.12963, 0.69444, 0, 0, 0.77778],
    "9827": [0.12963, 0.69444, 0, 0, 0.77778],
    "9837": [0, 0.75, 0, 0, 0.38889],
    "9838": [0.19444, 0.69444, 0, 0, 0.38889],
    "9839": [0.19444, 0.69444, 0, 0, 0.38889],
    "10216": [0.25, 0.75, 0, 0, 0.38889],
    "10217": [0.25, 0.75, 0, 0, 0.38889],
    "10222": [0.244, 0.744, 0, 0, 0.412],
    "10223": [0.244, 0.745, 0, 0, 0.412],
    "10229": [0.011, 0.511, 0, 0, 1.609],
    "10230": [0.011, 0.511, 0, 0, 1.638],
    "10231": [0.011, 0.511, 0, 0, 1.859],
    "10232": [0.024, 0.525, 0, 0, 1.609],
    "10233": [0.024, 0.525, 0, 0, 1.638],
    "10234": [0.024, 0.525, 0, 0, 1.858],
    "10236": [0.011, 0.511, 0, 0, 1.638],
    "10815": [0, 0.68333, 0, 0, 0.75],
    "10927": [0.13597, 0.63597, 0, 0, 0.77778],
    "10928": [0.13597, 0.63597, 0, 0, 0.77778],
    "57376": [0.19444, 0.69444, 0, 0, 0]
  },
  "Math-BoldItalic": {
    "32": [0, 0, 0, 0, 0.25],
    "48": [0, 0.44444, 0, 0, 0.575],
    "49": [0, 0.44444, 0, 0, 0.575],
    "50": [0, 0.44444, 0, 0, 0.575],
    "51": [0.19444, 0.44444, 0, 0, 0.575],
    "52": [0.19444, 0.44444, 0, 0, 0.575],
    "53": [0.19444, 0.44444, 0, 0, 0.575],
    "54": [0, 0.64444, 0, 0, 0.575],
    "55": [0.19444, 0.44444, 0, 0, 0.575],
    "56": [0, 0.64444, 0, 0, 0.575],
    "57": [0.19444, 0.44444, 0, 0, 0.575],
    "65": [0, 0.68611, 0, 0, 0.86944],
    "66": [0, 0.68611, 0.04835, 0, 0.8664],
    "67": [0, 0.68611, 0.06979, 0, 0.81694],
    "68": [0, 0.68611, 0.03194, 0, 0.93812],
    "69": [0, 0.68611, 0.05451, 0, 0.81007],
    "70": [0, 0.68611, 0.15972, 0, 0.68889],
    "71": [0, 0.68611, 0, 0, 0.88673],
    "72": [0, 0.68611, 0.08229, 0, 0.98229],
    "73": [0, 0.68611, 0.07778, 0, 0.51111],
    "74": [0, 0.68611, 0.10069, 0, 0.63125],
    "75": [0, 0.68611, 0.06979, 0, 0.97118],
    "76": [0, 0.68611, 0, 0, 0.75555],
    "77": [0, 0.68611, 0.11424, 0, 1.14201],
    "78": [0, 0.68611, 0.11424, 0, 0.95034],
    "79": [0, 0.68611, 0.03194, 0, 0.83666],
    "80": [0, 0.68611, 0.15972, 0, 0.72309],
    "81": [0.19444, 0.68611, 0, 0, 0.86861],
    "82": [0, 0.68611, 421e-5, 0, 0.87235],
    "83": [0, 0.68611, 0.05382, 0, 0.69271],
    "84": [0, 0.68611, 0.15972, 0, 0.63663],
    "85": [0, 0.68611, 0.11424, 0, 0.80027],
    "86": [0, 0.68611, 0.25555, 0, 0.67778],
    "87": [0, 0.68611, 0.15972, 0, 1.09305],
    "88": [0, 0.68611, 0.07778, 0, 0.94722],
    "89": [0, 0.68611, 0.25555, 0, 0.67458],
    "90": [0, 0.68611, 0.06979, 0, 0.77257],
    "97": [0, 0.44444, 0, 0, 0.63287],
    "98": [0, 0.69444, 0, 0, 0.52083],
    "99": [0, 0.44444, 0, 0, 0.51342],
    "100": [0, 0.69444, 0, 0, 0.60972],
    "101": [0, 0.44444, 0, 0, 0.55361],
    "102": [0.19444, 0.69444, 0.11042, 0, 0.56806],
    "103": [0.19444, 0.44444, 0.03704, 0, 0.5449],
    "104": [0, 0.69444, 0, 0, 0.66759],
    "105": [0, 0.69326, 0, 0, 0.4048],
    "106": [0.19444, 0.69326, 0.0622, 0, 0.47083],
    "107": [0, 0.69444, 0.01852, 0, 0.6037],
    "108": [0, 0.69444, 88e-4, 0, 0.34815],
    "109": [0, 0.44444, 0, 0, 1.0324],
    "110": [0, 0.44444, 0, 0, 0.71296],
    "111": [0, 0.44444, 0, 0, 0.58472],
    "112": [0.19444, 0.44444, 0, 0, 0.60092],
    "113": [0.19444, 0.44444, 0.03704, 0, 0.54213],
    "114": [0, 0.44444, 0.03194, 0, 0.5287],
    "115": [0, 0.44444, 0, 0, 0.53125],
    "116": [0, 0.63492, 0, 0, 0.41528],
    "117": [0, 0.44444, 0, 0, 0.68102],
    "118": [0, 0.44444, 0.03704, 0, 0.56666],
    "119": [0, 0.44444, 0.02778, 0, 0.83148],
    "120": [0, 0.44444, 0, 0, 0.65903],
    "121": [0.19444, 0.44444, 0.03704, 0, 0.59028],
    "122": [0, 0.44444, 0.04213, 0, 0.55509],
    "160": [0, 0, 0, 0, 0.25],
    "915": [0, 0.68611, 0.15972, 0, 0.65694],
    "916": [0, 0.68611, 0, 0, 0.95833],
    "920": [0, 0.68611, 0.03194, 0, 0.86722],
    "923": [0, 0.68611, 0, 0, 0.80555],
    "926": [0, 0.68611, 0.07458, 0, 0.84125],
    "928": [0, 0.68611, 0.08229, 0, 0.98229],
    "931": [0, 0.68611, 0.05451, 0, 0.88507],
    "933": [0, 0.68611, 0.15972, 0, 0.67083],
    "934": [0, 0.68611, 0, 0, 0.76666],
    "936": [0, 0.68611, 0.11653, 0, 0.71402],
    "937": [0, 0.68611, 0.04835, 0, 0.8789],
    "945": [0, 0.44444, 0, 0, 0.76064],
    "946": [0.19444, 0.69444, 0.03403, 0, 0.65972],
    "947": [0.19444, 0.44444, 0.06389, 0, 0.59003],
    "948": [0, 0.69444, 0.03819, 0, 0.52222],
    "949": [0, 0.44444, 0, 0, 0.52882],
    "950": [0.19444, 0.69444, 0.06215, 0, 0.50833],
    "951": [0.19444, 0.44444, 0.03704, 0, 0.6],
    "952": [0, 0.69444, 0.03194, 0, 0.5618],
    "953": [0, 0.44444, 0, 0, 0.41204],
    "954": [0, 0.44444, 0, 0, 0.66759],
    "955": [0, 0.69444, 0, 0, 0.67083],
    "956": [0.19444, 0.44444, 0, 0, 0.70787],
    "957": [0, 0.44444, 0.06898, 0, 0.57685],
    "958": [0.19444, 0.69444, 0.03021, 0, 0.50833],
    "959": [0, 0.44444, 0, 0, 0.58472],
    "960": [0, 0.44444, 0.03704, 0, 0.68241],
    "961": [0.19444, 0.44444, 0, 0, 0.6118],
    "962": [0.09722, 0.44444, 0.07917, 0, 0.42361],
    "963": [0, 0.44444, 0.03704, 0, 0.68588],
    "964": [0, 0.44444, 0.13472, 0, 0.52083],
    "965": [0, 0.44444, 0.03704, 0, 0.63055],
    "966": [0.19444, 0.44444, 0, 0, 0.74722],
    "967": [0.19444, 0.44444, 0, 0, 0.71805],
    "968": [0.19444, 0.69444, 0.03704, 0, 0.75833],
    "969": [0, 0.44444, 0.03704, 0, 0.71782],
    "977": [0, 0.69444, 0, 0, 0.69155],
    "981": [0.19444, 0.69444, 0, 0, 0.7125],
    "982": [0, 0.44444, 0.03194, 0, 0.975],
    "1009": [0.19444, 0.44444, 0, 0, 0.6118],
    "1013": [0, 0.44444, 0, 0, 0.48333],
    "57649": [0, 0.44444, 0, 0, 0.39352],
    "57911": [0.19444, 0.44444, 0, 0, 0.43889]
  },
  "Math-Italic": {
    "32": [0, 0, 0, 0, 0.25],
    "48": [0, 0.43056, 0, 0, 0.5],
    "49": [0, 0.43056, 0, 0, 0.5],
    "50": [0, 0.43056, 0, 0, 0.5],
    "51": [0.19444, 0.43056, 0, 0, 0.5],
    "52": [0.19444, 0.43056, 0, 0, 0.5],
    "53": [0.19444, 0.43056, 0, 0, 0.5],
    "54": [0, 0.64444, 0, 0, 0.5],
    "55": [0.19444, 0.43056, 0, 0, 0.5],
    "56": [0, 0.64444, 0, 0, 0.5],
    "57": [0.19444, 0.43056, 0, 0, 0.5],
    "65": [0, 0.68333, 0, 0.13889, 0.75],
    "66": [0, 0.68333, 0.05017, 0.08334, 0.75851],
    "67": [0, 0.68333, 0.07153, 0.08334, 0.71472],
    "68": [0, 0.68333, 0.02778, 0.05556, 0.82792],
    "69": [0, 0.68333, 0.05764, 0.08334, 0.7382],
    "70": [0, 0.68333, 0.13889, 0.08334, 0.64306],
    "71": [0, 0.68333, 0, 0.08334, 0.78625],
    "72": [0, 0.68333, 0.08125, 0.05556, 0.83125],
    "73": [0, 0.68333, 0.07847, 0.11111, 0.43958],
    "74": [0, 0.68333, 0.09618, 0.16667, 0.55451],
    "75": [0, 0.68333, 0.07153, 0.05556, 0.84931],
    "76": [0, 0.68333, 0, 0.02778, 0.68056],
    "77": [0, 0.68333, 0.10903, 0.08334, 0.97014],
    "78": [0, 0.68333, 0.10903, 0.08334, 0.80347],
    "79": [0, 0.68333, 0.02778, 0.08334, 0.76278],
    "80": [0, 0.68333, 0.13889, 0.08334, 0.64201],
    "81": [0.19444, 0.68333, 0, 0.08334, 0.79056],
    "82": [0, 0.68333, 773e-5, 0.08334, 0.75929],
    "83": [0, 0.68333, 0.05764, 0.08334, 0.6132],
    "84": [0, 0.68333, 0.13889, 0.08334, 0.58438],
    "85": [0, 0.68333, 0.10903, 0.02778, 0.68278],
    "86": [0, 0.68333, 0.22222, 0, 0.58333],
    "87": [0, 0.68333, 0.13889, 0, 0.94445],
    "88": [0, 0.68333, 0.07847, 0.08334, 0.82847],
    "89": [0, 0.68333, 0.22222, 0, 0.58056],
    "90": [0, 0.68333, 0.07153, 0.08334, 0.68264],
    "97": [0, 0.43056, 0, 0, 0.52859],
    "98": [0, 0.69444, 0, 0, 0.42917],
    "99": [0, 0.43056, 0, 0.05556, 0.43276],
    "100": [0, 0.69444, 0, 0.16667, 0.52049],
    "101": [0, 0.43056, 0, 0.05556, 0.46563],
    "102": [0.19444, 0.69444, 0.10764, 0.16667, 0.48959],
    "103": [0.19444, 0.43056, 0.03588, 0.02778, 0.47697],
    "104": [0, 0.69444, 0, 0, 0.57616],
    "105": [0, 0.65952, 0, 0, 0.34451],
    "106": [0.19444, 0.65952, 0.05724, 0, 0.41181],
    "107": [0, 0.69444, 0.03148, 0, 0.5206],
    "108": [0, 0.69444, 0.01968, 0.08334, 0.29838],
    "109": [0, 0.43056, 0, 0, 0.87801],
    "110": [0, 0.43056, 0, 0, 0.60023],
    "111": [0, 0.43056, 0, 0.05556, 0.48472],
    "112": [0.19444, 0.43056, 0, 0.08334, 0.50313],
    "113": [0.19444, 0.43056, 0.03588, 0.08334, 0.44641],
    "114": [0, 0.43056, 0.02778, 0.05556, 0.45116],
    "115": [0, 0.43056, 0, 0.05556, 0.46875],
    "116": [0, 0.61508, 0, 0.08334, 0.36111],
    "117": [0, 0.43056, 0, 0.02778, 0.57246],
    "118": [0, 0.43056, 0.03588, 0.02778, 0.48472],
    "119": [0, 0.43056, 0.02691, 0.08334, 0.71592],
    "120": [0, 0.43056, 0, 0.02778, 0.57153],
    "121": [0.19444, 0.43056, 0.03588, 0.05556, 0.49028],
    "122": [0, 0.43056, 0.04398, 0.05556, 0.46505],
    "160": [0, 0, 0, 0, 0.25],
    "915": [0, 0.68333, 0.13889, 0.08334, 0.61528],
    "916": [0, 0.68333, 0, 0.16667, 0.83334],
    "920": [0, 0.68333, 0.02778, 0.08334, 0.76278],
    "923": [0, 0.68333, 0, 0.16667, 0.69445],
    "926": [0, 0.68333, 0.07569, 0.08334, 0.74236],
    "928": [0, 0.68333, 0.08125, 0.05556, 0.83125],
    "931": [0, 0.68333, 0.05764, 0.08334, 0.77986],
    "933": [0, 0.68333, 0.13889, 0.05556, 0.58333],
    "934": [0, 0.68333, 0, 0.08334, 0.66667],
    "936": [0, 0.68333, 0.11, 0.05556, 0.61222],
    "937": [0, 0.68333, 0.05017, 0.08334, 0.7724],
    "945": [0, 0.43056, 37e-4, 0.02778, 0.6397],
    "946": [0.19444, 0.69444, 0.05278, 0.08334, 0.56563],
    "947": [0.19444, 0.43056, 0.05556, 0, 0.51773],
    "948": [0, 0.69444, 0.03785, 0.05556, 0.44444],
    "949": [0, 0.43056, 0, 0.08334, 0.46632],
    "950": [0.19444, 0.69444, 0.07378, 0.08334, 0.4375],
    "951": [0.19444, 0.43056, 0.03588, 0.05556, 0.49653],
    "952": [0, 0.69444, 0.02778, 0.08334, 0.46944],
    "953": [0, 0.43056, 0, 0.05556, 0.35394],
    "954": [0, 0.43056, 0, 0, 0.57616],
    "955": [0, 0.69444, 0, 0, 0.58334],
    "956": [0.19444, 0.43056, 0, 0.02778, 0.60255],
    "957": [0, 0.43056, 0.06366, 0.02778, 0.49398],
    "958": [0.19444, 0.69444, 0.04601, 0.11111, 0.4375],
    "959": [0, 0.43056, 0, 0.05556, 0.48472],
    "960": [0, 0.43056, 0.03588, 0, 0.57003],
    "961": [0.19444, 0.43056, 0, 0.08334, 0.51702],
    "962": [0.09722, 0.43056, 0.07986, 0.08334, 0.36285],
    "963": [0, 0.43056, 0.03588, 0, 0.57141],
    "964": [0, 0.43056, 0.1132, 0.02778, 0.43715],
    "965": [0, 0.43056, 0.03588, 0.02778, 0.54028],
    "966": [0.19444, 0.43056, 0, 0.08334, 0.65417],
    "967": [0.19444, 0.43056, 0, 0.05556, 0.62569],
    "968": [0.19444, 0.69444, 0.03588, 0.11111, 0.65139],
    "969": [0, 0.43056, 0.03588, 0, 0.62245],
    "977": [0, 0.69444, 0, 0.08334, 0.59144],
    "981": [0.19444, 0.69444, 0, 0.08334, 0.59583],
    "982": [0, 0.43056, 0.02778, 0, 0.82813],
    "1009": [0.19444, 0.43056, 0, 0.08334, 0.51702],
    "1013": [0, 0.43056, 0, 0.05556, 0.4059],
    "57649": [0, 0.43056, 0, 0.02778, 0.32246],
    "57911": [0.19444, 0.43056, 0, 0.08334, 0.38403]
  },
  "SansSerif-Bold": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0, 0, 0.36667],
    "34": [0, 0.69444, 0, 0, 0.55834],
    "35": [0.19444, 0.69444, 0, 0, 0.91667],
    "36": [0.05556, 0.75, 0, 0, 0.55],
    "37": [0.05556, 0.75, 0, 0, 1.02912],
    "38": [0, 0.69444, 0, 0, 0.83056],
    "39": [0, 0.69444, 0, 0, 0.30556],
    "40": [0.25, 0.75, 0, 0, 0.42778],
    "41": [0.25, 0.75, 0, 0, 0.42778],
    "42": [0, 0.75, 0, 0, 0.55],
    "43": [0.11667, 0.61667, 0, 0, 0.85556],
    "44": [0.10556, 0.13056, 0, 0, 0.30556],
    "45": [0, 0.45833, 0, 0, 0.36667],
    "46": [0, 0.13056, 0, 0, 0.30556],
    "47": [0.25, 0.75, 0, 0, 0.55],
    "48": [0, 0.69444, 0, 0, 0.55],
    "49": [0, 0.69444, 0, 0, 0.55],
    "50": [0, 0.69444, 0, 0, 0.55],
    "51": [0, 0.69444, 0, 0, 0.55],
    "52": [0, 0.69444, 0, 0, 0.55],
    "53": [0, 0.69444, 0, 0, 0.55],
    "54": [0, 0.69444, 0, 0, 0.55],
    "55": [0, 0.69444, 0, 0, 0.55],
    "56": [0, 0.69444, 0, 0, 0.55],
    "57": [0, 0.69444, 0, 0, 0.55],
    "58": [0, 0.45833, 0, 0, 0.30556],
    "59": [0.10556, 0.45833, 0, 0, 0.30556],
    "61": [-0.09375, 0.40625, 0, 0, 0.85556],
    "63": [0, 0.69444, 0, 0, 0.51945],
    "64": [0, 0.69444, 0, 0, 0.73334],
    "65": [0, 0.69444, 0, 0, 0.73334],
    "66": [0, 0.69444, 0, 0, 0.73334],
    "67": [0, 0.69444, 0, 0, 0.70278],
    "68": [0, 0.69444, 0, 0, 0.79445],
    "69": [0, 0.69444, 0, 0, 0.64167],
    "70": [0, 0.69444, 0, 0, 0.61111],
    "71": [0, 0.69444, 0, 0, 0.73334],
    "72": [0, 0.69444, 0, 0, 0.79445],
    "73": [0, 0.69444, 0, 0, 0.33056],
    "74": [0, 0.69444, 0, 0, 0.51945],
    "75": [0, 0.69444, 0, 0, 0.76389],
    "76": [0, 0.69444, 0, 0, 0.58056],
    "77": [0, 0.69444, 0, 0, 0.97778],
    "78": [0, 0.69444, 0, 0, 0.79445],
    "79": [0, 0.69444, 0, 0, 0.79445],
    "80": [0, 0.69444, 0, 0, 0.70278],
    "81": [0.10556, 0.69444, 0, 0, 0.79445],
    "82": [0, 0.69444, 0, 0, 0.70278],
    "83": [0, 0.69444, 0, 0, 0.61111],
    "84": [0, 0.69444, 0, 0, 0.73334],
    "85": [0, 0.69444, 0, 0, 0.76389],
    "86": [0, 0.69444, 0.01528, 0, 0.73334],
    "87": [0, 0.69444, 0.01528, 0, 1.03889],
    "88": [0, 0.69444, 0, 0, 0.73334],
    "89": [0, 0.69444, 0.0275, 0, 0.73334],
    "90": [0, 0.69444, 0, 0, 0.67223],
    "91": [0.25, 0.75, 0, 0, 0.34306],
    "93": [0.25, 0.75, 0, 0, 0.34306],
    "94": [0, 0.69444, 0, 0, 0.55],
    "95": [0.35, 0.10833, 0.03056, 0, 0.55],
    "97": [0, 0.45833, 0, 0, 0.525],
    "98": [0, 0.69444, 0, 0, 0.56111],
    "99": [0, 0.45833, 0, 0, 0.48889],
    "100": [0, 0.69444, 0, 0, 0.56111],
    "101": [0, 0.45833, 0, 0, 0.51111],
    "102": [0, 0.69444, 0.07639, 0, 0.33611],
    "103": [0.19444, 0.45833, 0.01528, 0, 0.55],
    "104": [0, 0.69444, 0, 0, 0.56111],
    "105": [0, 0.69444, 0, 0, 0.25556],
    "106": [0.19444, 0.69444, 0, 0, 0.28611],
    "107": [0, 0.69444, 0, 0, 0.53056],
    "108": [0, 0.69444, 0, 0, 0.25556],
    "109": [0, 0.45833, 0, 0, 0.86667],
    "110": [0, 0.45833, 0, 0, 0.56111],
    "111": [0, 0.45833, 0, 0, 0.55],
    "112": [0.19444, 0.45833, 0, 0, 0.56111],
    "113": [0.19444, 0.45833, 0, 0, 0.56111],
    "114": [0, 0.45833, 0.01528, 0, 0.37222],
    "115": [0, 0.45833, 0, 0, 0.42167],
    "116": [0, 0.58929, 0, 0, 0.40417],
    "117": [0, 0.45833, 0, 0, 0.56111],
    "118": [0, 0.45833, 0.01528, 0, 0.5],
    "119": [0, 0.45833, 0.01528, 0, 0.74445],
    "120": [0, 0.45833, 0, 0, 0.5],
    "121": [0.19444, 0.45833, 0.01528, 0, 0.5],
    "122": [0, 0.45833, 0, 0, 0.47639],
    "126": [0.35, 0.34444, 0, 0, 0.55],
    "160": [0, 0, 0, 0, 0.25],
    "168": [0, 0.69444, 0, 0, 0.55],
    "176": [0, 0.69444, 0, 0, 0.73334],
    "180": [0, 0.69444, 0, 0, 0.55],
    "184": [0.17014, 0, 0, 0, 0.48889],
    "305": [0, 0.45833, 0, 0, 0.25556],
    "567": [0.19444, 0.45833, 0, 0, 0.28611],
    "710": [0, 0.69444, 0, 0, 0.55],
    "711": [0, 0.63542, 0, 0, 0.55],
    "713": [0, 0.63778, 0, 0, 0.55],
    "728": [0, 0.69444, 0, 0, 0.55],
    "729": [0, 0.69444, 0, 0, 0.30556],
    "730": [0, 0.69444, 0, 0, 0.73334],
    "732": [0, 0.69444, 0, 0, 0.55],
    "733": [0, 0.69444, 0, 0, 0.55],
    "915": [0, 0.69444, 0, 0, 0.58056],
    "916": [0, 0.69444, 0, 0, 0.91667],
    "920": [0, 0.69444, 0, 0, 0.85556],
    "923": [0, 0.69444, 0, 0, 0.67223],
    "926": [0, 0.69444, 0, 0, 0.73334],
    "928": [0, 0.69444, 0, 0, 0.79445],
    "931": [0, 0.69444, 0, 0, 0.79445],
    "933": [0, 0.69444, 0, 0, 0.85556],
    "934": [0, 0.69444, 0, 0, 0.79445],
    "936": [0, 0.69444, 0, 0, 0.85556],
    "937": [0, 0.69444, 0, 0, 0.79445],
    "8211": [0, 0.45833, 0.03056, 0, 0.55],
    "8212": [0, 0.45833, 0.03056, 0, 1.10001],
    "8216": [0, 0.69444, 0, 0, 0.30556],
    "8217": [0, 0.69444, 0, 0, 0.30556],
    "8220": [0, 0.69444, 0, 0, 0.55834],
    "8221": [0, 0.69444, 0, 0, 0.55834]
  },
  "SansSerif-Italic": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0.05733, 0, 0.31945],
    "34": [0, 0.69444, 316e-5, 0, 0.5],
    "35": [0.19444, 0.69444, 0.05087, 0, 0.83334],
    "36": [0.05556, 0.75, 0.11156, 0, 0.5],
    "37": [0.05556, 0.75, 0.03126, 0, 0.83334],
    "38": [0, 0.69444, 0.03058, 0, 0.75834],
    "39": [0, 0.69444, 0.07816, 0, 0.27778],
    "40": [0.25, 0.75, 0.13164, 0, 0.38889],
    "41": [0.25, 0.75, 0.02536, 0, 0.38889],
    "42": [0, 0.75, 0.11775, 0, 0.5],
    "43": [0.08333, 0.58333, 0.02536, 0, 0.77778],
    "44": [0.125, 0.08333, 0, 0, 0.27778],
    "45": [0, 0.44444, 0.01946, 0, 0.33333],
    "46": [0, 0.08333, 0, 0, 0.27778],
    "47": [0.25, 0.75, 0.13164, 0, 0.5],
    "48": [0, 0.65556, 0.11156, 0, 0.5],
    "49": [0, 0.65556, 0.11156, 0, 0.5],
    "50": [0, 0.65556, 0.11156, 0, 0.5],
    "51": [0, 0.65556, 0.11156, 0, 0.5],
    "52": [0, 0.65556, 0.11156, 0, 0.5],
    "53": [0, 0.65556, 0.11156, 0, 0.5],
    "54": [0, 0.65556, 0.11156, 0, 0.5],
    "55": [0, 0.65556, 0.11156, 0, 0.5],
    "56": [0, 0.65556, 0.11156, 0, 0.5],
    "57": [0, 0.65556, 0.11156, 0, 0.5],
    "58": [0, 0.44444, 0.02502, 0, 0.27778],
    "59": [0.125, 0.44444, 0.02502, 0, 0.27778],
    "61": [-0.13, 0.37, 0.05087, 0, 0.77778],
    "63": [0, 0.69444, 0.11809, 0, 0.47222],
    "64": [0, 0.69444, 0.07555, 0, 0.66667],
    "65": [0, 0.69444, 0, 0, 0.66667],
    "66": [0, 0.69444, 0.08293, 0, 0.66667],
    "67": [0, 0.69444, 0.11983, 0, 0.63889],
    "68": [0, 0.69444, 0.07555, 0, 0.72223],
    "69": [0, 0.69444, 0.11983, 0, 0.59722],
    "70": [0, 0.69444, 0.13372, 0, 0.56945],
    "71": [0, 0.69444, 0.11983, 0, 0.66667],
    "72": [0, 0.69444, 0.08094, 0, 0.70834],
    "73": [0, 0.69444, 0.13372, 0, 0.27778],
    "74": [0, 0.69444, 0.08094, 0, 0.47222],
    "75": [0, 0.69444, 0.11983, 0, 0.69445],
    "76": [0, 0.69444, 0, 0, 0.54167],
    "77": [0, 0.69444, 0.08094, 0, 0.875],
    "78": [0, 0.69444, 0.08094, 0, 0.70834],
    "79": [0, 0.69444, 0.07555, 0, 0.73611],
    "80": [0, 0.69444, 0.08293, 0, 0.63889],
    "81": [0.125, 0.69444, 0.07555, 0, 0.73611],
    "82": [0, 0.69444, 0.08293, 0, 0.64584],
    "83": [0, 0.69444, 0.09205, 0, 0.55556],
    "84": [0, 0.69444, 0.13372, 0, 0.68056],
    "85": [0, 0.69444, 0.08094, 0, 0.6875],
    "86": [0, 0.69444, 0.1615, 0, 0.66667],
    "87": [0, 0.69444, 0.1615, 0, 0.94445],
    "88": [0, 0.69444, 0.13372, 0, 0.66667],
    "89": [0, 0.69444, 0.17261, 0, 0.66667],
    "90": [0, 0.69444, 0.11983, 0, 0.61111],
    "91": [0.25, 0.75, 0.15942, 0, 0.28889],
    "93": [0.25, 0.75, 0.08719, 0, 0.28889],
    "94": [0, 0.69444, 0.0799, 0, 0.5],
    "95": [0.35, 0.09444, 0.08616, 0, 0.5],
    "97": [0, 0.44444, 981e-5, 0, 0.48056],
    "98": [0, 0.69444, 0.03057, 0, 0.51667],
    "99": [0, 0.44444, 0.08336, 0, 0.44445],
    "100": [0, 0.69444, 0.09483, 0, 0.51667],
    "101": [0, 0.44444, 0.06778, 0, 0.44445],
    "102": [0, 0.69444, 0.21705, 0, 0.30556],
    "103": [0.19444, 0.44444, 0.10836, 0, 0.5],
    "104": [0, 0.69444, 0.01778, 0, 0.51667],
    "105": [0, 0.67937, 0.09718, 0, 0.23889],
    "106": [0.19444, 0.67937, 0.09162, 0, 0.26667],
    "107": [0, 0.69444, 0.08336, 0, 0.48889],
    "108": [0, 0.69444, 0.09483, 0, 0.23889],
    "109": [0, 0.44444, 0.01778, 0, 0.79445],
    "110": [0, 0.44444, 0.01778, 0, 0.51667],
    "111": [0, 0.44444, 0.06613, 0, 0.5],
    "112": [0.19444, 0.44444, 0.0389, 0, 0.51667],
    "113": [0.19444, 0.44444, 0.04169, 0, 0.51667],
    "114": [0, 0.44444, 0.10836, 0, 0.34167],
    "115": [0, 0.44444, 0.0778, 0, 0.38333],
    "116": [0, 0.57143, 0.07225, 0, 0.36111],
    "117": [0, 0.44444, 0.04169, 0, 0.51667],
    "118": [0, 0.44444, 0.10836, 0, 0.46111],
    "119": [0, 0.44444, 0.10836, 0, 0.68334],
    "120": [0, 0.44444, 0.09169, 0, 0.46111],
    "121": [0.19444, 0.44444, 0.10836, 0, 0.46111],
    "122": [0, 0.44444, 0.08752, 0, 0.43472],
    "126": [0.35, 0.32659, 0.08826, 0, 0.5],
    "160": [0, 0, 0, 0, 0.25],
    "168": [0, 0.67937, 0.06385, 0, 0.5],
    "176": [0, 0.69444, 0, 0, 0.73752],
    "184": [0.17014, 0, 0, 0, 0.44445],
    "305": [0, 0.44444, 0.04169, 0, 0.23889],
    "567": [0.19444, 0.44444, 0.04169, 0, 0.26667],
    "710": [0, 0.69444, 0.0799, 0, 0.5],
    "711": [0, 0.63194, 0.08432, 0, 0.5],
    "713": [0, 0.60889, 0.08776, 0, 0.5],
    "714": [0, 0.69444, 0.09205, 0, 0.5],
    "715": [0, 0.69444, 0, 0, 0.5],
    "728": [0, 0.69444, 0.09483, 0, 0.5],
    "729": [0, 0.67937, 0.07774, 0, 0.27778],
    "730": [0, 0.69444, 0, 0, 0.73752],
    "732": [0, 0.67659, 0.08826, 0, 0.5],
    "733": [0, 0.69444, 0.09205, 0, 0.5],
    "915": [0, 0.69444, 0.13372, 0, 0.54167],
    "916": [0, 0.69444, 0, 0, 0.83334],
    "920": [0, 0.69444, 0.07555, 0, 0.77778],
    "923": [0, 0.69444, 0, 0, 0.61111],
    "926": [0, 0.69444, 0.12816, 0, 0.66667],
    "928": [0, 0.69444, 0.08094, 0, 0.70834],
    "931": [0, 0.69444, 0.11983, 0, 0.72222],
    "933": [0, 0.69444, 0.09031, 0, 0.77778],
    "934": [0, 0.69444, 0.04603, 0, 0.72222],
    "936": [0, 0.69444, 0.09031, 0, 0.77778],
    "937": [0, 0.69444, 0.08293, 0, 0.72222],
    "8211": [0, 0.44444, 0.08616, 0, 0.5],
    "8212": [0, 0.44444, 0.08616, 0, 1],
    "8216": [0, 0.69444, 0.07816, 0, 0.27778],
    "8217": [0, 0.69444, 0.07816, 0, 0.27778],
    "8220": [0, 0.69444, 0.14205, 0, 0.5],
    "8221": [0, 0.69444, 316e-5, 0, 0.5]
  },
  "SansSerif-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0, 0, 0.31945],
    "34": [0, 0.69444, 0, 0, 0.5],
    "35": [0.19444, 0.69444, 0, 0, 0.83334],
    "36": [0.05556, 0.75, 0, 0, 0.5],
    "37": [0.05556, 0.75, 0, 0, 0.83334],
    "38": [0, 0.69444, 0, 0, 0.75834],
    "39": [0, 0.69444, 0, 0, 0.27778],
    "40": [0.25, 0.75, 0, 0, 0.38889],
    "41": [0.25, 0.75, 0, 0, 0.38889],
    "42": [0, 0.75, 0, 0, 0.5],
    "43": [0.08333, 0.58333, 0, 0, 0.77778],
    "44": [0.125, 0.08333, 0, 0, 0.27778],
    "45": [0, 0.44444, 0, 0, 0.33333],
    "46": [0, 0.08333, 0, 0, 0.27778],
    "47": [0.25, 0.75, 0, 0, 0.5],
    "48": [0, 0.65556, 0, 0, 0.5],
    "49": [0, 0.65556, 0, 0, 0.5],
    "50": [0, 0.65556, 0, 0, 0.5],
    "51": [0, 0.65556, 0, 0, 0.5],
    "52": [0, 0.65556, 0, 0, 0.5],
    "53": [0, 0.65556, 0, 0, 0.5],
    "54": [0, 0.65556, 0, 0, 0.5],
    "55": [0, 0.65556, 0, 0, 0.5],
    "56": [0, 0.65556, 0, 0, 0.5],
    "57": [0, 0.65556, 0, 0, 0.5],
    "58": [0, 0.44444, 0, 0, 0.27778],
    "59": [0.125, 0.44444, 0, 0, 0.27778],
    "61": [-0.13, 0.37, 0, 0, 0.77778],
    "63": [0, 0.69444, 0, 0, 0.47222],
    "64": [0, 0.69444, 0, 0, 0.66667],
    "65": [0, 0.69444, 0, 0, 0.66667],
    "66": [0, 0.69444, 0, 0, 0.66667],
    "67": [0, 0.69444, 0, 0, 0.63889],
    "68": [0, 0.69444, 0, 0, 0.72223],
    "69": [0, 0.69444, 0, 0, 0.59722],
    "70": [0, 0.69444, 0, 0, 0.56945],
    "71": [0, 0.69444, 0, 0, 0.66667],
    "72": [0, 0.69444, 0, 0, 0.70834],
    "73": [0, 0.69444, 0, 0, 0.27778],
    "74": [0, 0.69444, 0, 0, 0.47222],
    "75": [0, 0.69444, 0, 0, 0.69445],
    "76": [0, 0.69444, 0, 0, 0.54167],
    "77": [0, 0.69444, 0, 0, 0.875],
    "78": [0, 0.69444, 0, 0, 0.70834],
    "79": [0, 0.69444, 0, 0, 0.73611],
    "80": [0, 0.69444, 0, 0, 0.63889],
    "81": [0.125, 0.69444, 0, 0, 0.73611],
    "82": [0, 0.69444, 0, 0, 0.64584],
    "83": [0, 0.69444, 0, 0, 0.55556],
    "84": [0, 0.69444, 0, 0, 0.68056],
    "85": [0, 0.69444, 0, 0, 0.6875],
    "86": [0, 0.69444, 0.01389, 0, 0.66667],
    "87": [0, 0.69444, 0.01389, 0, 0.94445],
    "88": [0, 0.69444, 0, 0, 0.66667],
    "89": [0, 0.69444, 0.025, 0, 0.66667],
    "90": [0, 0.69444, 0, 0, 0.61111],
    "91": [0.25, 0.75, 0, 0, 0.28889],
    "93": [0.25, 0.75, 0, 0, 0.28889],
    "94": [0, 0.69444, 0, 0, 0.5],
    "95": [0.35, 0.09444, 0.02778, 0, 0.5],
    "97": [0, 0.44444, 0, 0, 0.48056],
    "98": [0, 0.69444, 0, 0, 0.51667],
    "99": [0, 0.44444, 0, 0, 0.44445],
    "100": [0, 0.69444, 0, 0, 0.51667],
    "101": [0, 0.44444, 0, 0, 0.44445],
    "102": [0, 0.69444, 0.06944, 0, 0.30556],
    "103": [0.19444, 0.44444, 0.01389, 0, 0.5],
    "104": [0, 0.69444, 0, 0, 0.51667],
    "105": [0, 0.67937, 0, 0, 0.23889],
    "106": [0.19444, 0.67937, 0, 0, 0.26667],
    "107": [0, 0.69444, 0, 0, 0.48889],
    "108": [0, 0.69444, 0, 0, 0.23889],
    "109": [0, 0.44444, 0, 0, 0.79445],
    "110": [0, 0.44444, 0, 0, 0.51667],
    "111": [0, 0.44444, 0, 0, 0.5],
    "112": [0.19444, 0.44444, 0, 0, 0.51667],
    "113": [0.19444, 0.44444, 0, 0, 0.51667],
    "114": [0, 0.44444, 0.01389, 0, 0.34167],
    "115": [0, 0.44444, 0, 0, 0.38333],
    "116": [0, 0.57143, 0, 0, 0.36111],
    "117": [0, 0.44444, 0, 0, 0.51667],
    "118": [0, 0.44444, 0.01389, 0, 0.46111],
    "119": [0, 0.44444, 0.01389, 0, 0.68334],
    "120": [0, 0.44444, 0, 0, 0.46111],
    "121": [0.19444, 0.44444, 0.01389, 0, 0.46111],
    "122": [0, 0.44444, 0, 0, 0.43472],
    "126": [0.35, 0.32659, 0, 0, 0.5],
    "160": [0, 0, 0, 0, 0.25],
    "168": [0, 0.67937, 0, 0, 0.5],
    "176": [0, 0.69444, 0, 0, 0.66667],
    "184": [0.17014, 0, 0, 0, 0.44445],
    "305": [0, 0.44444, 0, 0, 0.23889],
    "567": [0.19444, 0.44444, 0, 0, 0.26667],
    "710": [0, 0.69444, 0, 0, 0.5],
    "711": [0, 0.63194, 0, 0, 0.5],
    "713": [0, 0.60889, 0, 0, 0.5],
    "714": [0, 0.69444, 0, 0, 0.5],
    "715": [0, 0.69444, 0, 0, 0.5],
    "728": [0, 0.69444, 0, 0, 0.5],
    "729": [0, 0.67937, 0, 0, 0.27778],
    "730": [0, 0.69444, 0, 0, 0.66667],
    "732": [0, 0.67659, 0, 0, 0.5],
    "733": [0, 0.69444, 0, 0, 0.5],
    "915": [0, 0.69444, 0, 0, 0.54167],
    "916": [0, 0.69444, 0, 0, 0.83334],
    "920": [0, 0.69444, 0, 0, 0.77778],
    "923": [0, 0.69444, 0, 0, 0.61111],
    "926": [0, 0.69444, 0, 0, 0.66667],
    "928": [0, 0.69444, 0, 0, 0.70834],
    "931": [0, 0.69444, 0, 0, 0.72222],
    "933": [0, 0.69444, 0, 0, 0.77778],
    "934": [0, 0.69444, 0, 0, 0.72222],
    "936": [0, 0.69444, 0, 0, 0.77778],
    "937": [0, 0.69444, 0, 0, 0.72222],
    "8211": [0, 0.44444, 0.02778, 0, 0.5],
    "8212": [0, 0.44444, 0.02778, 0, 1],
    "8216": [0, 0.69444, 0, 0, 0.27778],
    "8217": [0, 0.69444, 0, 0, 0.27778],
    "8220": [0, 0.69444, 0, 0, 0.5],
    "8221": [0, 0.69444, 0, 0, 0.5]
  },
  "Script-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "65": [0, 0.7, 0.22925, 0, 0.80253],
    "66": [0, 0.7, 0.04087, 0, 0.90757],
    "67": [0, 0.7, 0.1689, 0, 0.66619],
    "68": [0, 0.7, 0.09371, 0, 0.77443],
    "69": [0, 0.7, 0.18583, 0, 0.56162],
    "70": [0, 0.7, 0.13634, 0, 0.89544],
    "71": [0, 0.7, 0.17322, 0, 0.60961],
    "72": [0, 0.7, 0.29694, 0, 0.96919],
    "73": [0, 0.7, 0.19189, 0, 0.80907],
    "74": [0.27778, 0.7, 0.19189, 0, 1.05159],
    "75": [0, 0.7, 0.31259, 0, 0.91364],
    "76": [0, 0.7, 0.19189, 0, 0.87373],
    "77": [0, 0.7, 0.15981, 0, 1.08031],
    "78": [0, 0.7, 0.3525, 0, 0.9015],
    "79": [0, 0.7, 0.08078, 0, 0.73787],
    "80": [0, 0.7, 0.08078, 0, 1.01262],
    "81": [0, 0.7, 0.03305, 0, 0.88282],
    "82": [0, 0.7, 0.06259, 0, 0.85],
    "83": [0, 0.7, 0.19189, 0, 0.86767],
    "84": [0, 0.7, 0.29087, 0, 0.74697],
    "85": [0, 0.7, 0.25815, 0, 0.79996],
    "86": [0, 0.7, 0.27523, 0, 0.62204],
    "87": [0, 0.7, 0.27523, 0, 0.80532],
    "88": [0, 0.7, 0.26006, 0, 0.94445],
    "89": [0, 0.7, 0.2939, 0, 0.70961],
    "90": [0, 0.7, 0.24037, 0, 0.8212],
    "160": [0, 0, 0, 0, 0.25]
  },
  "Size1-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "40": [0.35001, 0.85, 0, 0, 0.45834],
    "41": [0.35001, 0.85, 0, 0, 0.45834],
    "47": [0.35001, 0.85, 0, 0, 0.57778],
    "91": [0.35001, 0.85, 0, 0, 0.41667],
    "92": [0.35001, 0.85, 0, 0, 0.57778],
    "93": [0.35001, 0.85, 0, 0, 0.41667],
    "123": [0.35001, 0.85, 0, 0, 0.58334],
    "125": [0.35001, 0.85, 0, 0, 0.58334],
    "160": [0, 0, 0, 0, 0.25],
    "710": [0, 0.72222, 0, 0, 0.55556],
    "732": [0, 0.72222, 0, 0, 0.55556],
    "770": [0, 0.72222, 0, 0, 0.55556],
    "771": [0, 0.72222, 0, 0, 0.55556],
    "8214": [-99e-5, 0.601, 0, 0, 0.77778],
    "8593": [1e-5, 0.6, 0, 0, 0.66667],
    "8595": [1e-5, 0.6, 0, 0, 0.66667],
    "8657": [1e-5, 0.6, 0, 0, 0.77778],
    "8659": [1e-5, 0.6, 0, 0, 0.77778],
    "8719": [0.25001, 0.75, 0, 0, 0.94445],
    "8720": [0.25001, 0.75, 0, 0, 0.94445],
    "8721": [0.25001, 0.75, 0, 0, 1.05556],
    "8730": [0.35001, 0.85, 0, 0, 1],
    "8739": [-599e-5, 0.606, 0, 0, 0.33333],
    "8741": [-599e-5, 0.606, 0, 0, 0.55556],
    "8747": [0.30612, 0.805, 0.19445, 0, 0.47222],
    "8748": [0.306, 0.805, 0.19445, 0, 0.47222],
    "8749": [0.306, 0.805, 0.19445, 0, 0.47222],
    "8750": [0.30612, 0.805, 0.19445, 0, 0.47222],
    "8896": [0.25001, 0.75, 0, 0, 0.83334],
    "8897": [0.25001, 0.75, 0, 0, 0.83334],
    "8898": [0.25001, 0.75, 0, 0, 0.83334],
    "8899": [0.25001, 0.75, 0, 0, 0.83334],
    "8968": [0.35001, 0.85, 0, 0, 0.47222],
    "8969": [0.35001, 0.85, 0, 0, 0.47222],
    "8970": [0.35001, 0.85, 0, 0, 0.47222],
    "8971": [0.35001, 0.85, 0, 0, 0.47222],
    "9168": [-99e-5, 0.601, 0, 0, 0.66667],
    "10216": [0.35001, 0.85, 0, 0, 0.47222],
    "10217": [0.35001, 0.85, 0, 0, 0.47222],
    "10752": [0.25001, 0.75, 0, 0, 1.11111],
    "10753": [0.25001, 0.75, 0, 0, 1.11111],
    "10754": [0.25001, 0.75, 0, 0, 1.11111],
    "10756": [0.25001, 0.75, 0, 0, 0.83334],
    "10758": [0.25001, 0.75, 0, 0, 0.83334]
  },
  "Size2-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "40": [0.65002, 1.15, 0, 0, 0.59722],
    "41": [0.65002, 1.15, 0, 0, 0.59722],
    "47": [0.65002, 1.15, 0, 0, 0.81111],
    "91": [0.65002, 1.15, 0, 0, 0.47222],
    "92": [0.65002, 1.15, 0, 0, 0.81111],
    "93": [0.65002, 1.15, 0, 0, 0.47222],
    "123": [0.65002, 1.15, 0, 0, 0.66667],
    "125": [0.65002, 1.15, 0, 0, 0.66667],
    "160": [0, 0, 0, 0, 0.25],
    "710": [0, 0.75, 0, 0, 1],
    "732": [0, 0.75, 0, 0, 1],
    "770": [0, 0.75, 0, 0, 1],
    "771": [0, 0.75, 0, 0, 1],
    "8719": [0.55001, 1.05, 0, 0, 1.27778],
    "8720": [0.55001, 1.05, 0, 0, 1.27778],
    "8721": [0.55001, 1.05, 0, 0, 1.44445],
    "8730": [0.65002, 1.15, 0, 0, 1],
    "8747": [0.86225, 1.36, 0.44445, 0, 0.55556],
    "8748": [0.862, 1.36, 0.44445, 0, 0.55556],
    "8749": [0.862, 1.36, 0.44445, 0, 0.55556],
    "8750": [0.86225, 1.36, 0.44445, 0, 0.55556],
    "8896": [0.55001, 1.05, 0, 0, 1.11111],
    "8897": [0.55001, 1.05, 0, 0, 1.11111],
    "8898": [0.55001, 1.05, 0, 0, 1.11111],
    "8899": [0.55001, 1.05, 0, 0, 1.11111],
    "8968": [0.65002, 1.15, 0, 0, 0.52778],
    "8969": [0.65002, 1.15, 0, 0, 0.52778],
    "8970": [0.65002, 1.15, 0, 0, 0.52778],
    "8971": [0.65002, 1.15, 0, 0, 0.52778],
    "10216": [0.65002, 1.15, 0, 0, 0.61111],
    "10217": [0.65002, 1.15, 0, 0, 0.61111],
    "10752": [0.55001, 1.05, 0, 0, 1.51112],
    "10753": [0.55001, 1.05, 0, 0, 1.51112],
    "10754": [0.55001, 1.05, 0, 0, 1.51112],
    "10756": [0.55001, 1.05, 0, 0, 1.11111],
    "10758": [0.55001, 1.05, 0, 0, 1.11111]
  },
  "Size3-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "40": [0.95003, 1.45, 0, 0, 0.73611],
    "41": [0.95003, 1.45, 0, 0, 0.73611],
    "47": [0.95003, 1.45, 0, 0, 1.04445],
    "91": [0.95003, 1.45, 0, 0, 0.52778],
    "92": [0.95003, 1.45, 0, 0, 1.04445],
    "93": [0.95003, 1.45, 0, 0, 0.52778],
    "123": [0.95003, 1.45, 0, 0, 0.75],
    "125": [0.95003, 1.45, 0, 0, 0.75],
    "160": [0, 0, 0, 0, 0.25],
    "710": [0, 0.75, 0, 0, 1.44445],
    "732": [0, 0.75, 0, 0, 1.44445],
    "770": [0, 0.75, 0, 0, 1.44445],
    "771": [0, 0.75, 0, 0, 1.44445],
    "8730": [0.95003, 1.45, 0, 0, 1],
    "8968": [0.95003, 1.45, 0, 0, 0.58334],
    "8969": [0.95003, 1.45, 0, 0, 0.58334],
    "8970": [0.95003, 1.45, 0, 0, 0.58334],
    "8971": [0.95003, 1.45, 0, 0, 0.58334],
    "10216": [0.95003, 1.45, 0, 0, 0.75],
    "10217": [0.95003, 1.45, 0, 0, 0.75]
  },
  "Size4-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "40": [1.25003, 1.75, 0, 0, 0.79167],
    "41": [1.25003, 1.75, 0, 0, 0.79167],
    "47": [1.25003, 1.75, 0, 0, 1.27778],
    "91": [1.25003, 1.75, 0, 0, 0.58334],
    "92": [1.25003, 1.75, 0, 0, 1.27778],
    "93": [1.25003, 1.75, 0, 0, 0.58334],
    "123": [1.25003, 1.75, 0, 0, 0.80556],
    "125": [1.25003, 1.75, 0, 0, 0.80556],
    "160": [0, 0, 0, 0, 0.25],
    "710": [0, 0.825, 0, 0, 1.8889],
    "732": [0, 0.825, 0, 0, 1.8889],
    "770": [0, 0.825, 0, 0, 1.8889],
    "771": [0, 0.825, 0, 0, 1.8889],
    "8730": [1.25003, 1.75, 0, 0, 1],
    "8968": [1.25003, 1.75, 0, 0, 0.63889],
    "8969": [1.25003, 1.75, 0, 0, 0.63889],
    "8970": [1.25003, 1.75, 0, 0, 0.63889],
    "8971": [1.25003, 1.75, 0, 0, 0.63889],
    "9115": [0.64502, 1.155, 0, 0, 0.875],
    "9116": [1e-5, 0.6, 0, 0, 0.875],
    "9117": [0.64502, 1.155, 0, 0, 0.875],
    "9118": [0.64502, 1.155, 0, 0, 0.875],
    "9119": [1e-5, 0.6, 0, 0, 0.875],
    "9120": [0.64502, 1.155, 0, 0, 0.875],
    "9121": [0.64502, 1.155, 0, 0, 0.66667],
    "9122": [-99e-5, 0.601, 0, 0, 0.66667],
    "9123": [0.64502, 1.155, 0, 0, 0.66667],
    "9124": [0.64502, 1.155, 0, 0, 0.66667],
    "9125": [-99e-5, 0.601, 0, 0, 0.66667],
    "9126": [0.64502, 1.155, 0, 0, 0.66667],
    "9127": [1e-5, 0.9, 0, 0, 0.88889],
    "9128": [0.65002, 1.15, 0, 0, 0.88889],
    "9129": [0.90001, 0, 0, 0, 0.88889],
    "9130": [0, 0.3, 0, 0, 0.88889],
    "9131": [1e-5, 0.9, 0, 0, 0.88889],
    "9132": [0.65002, 1.15, 0, 0, 0.88889],
    "9133": [0.90001, 0, 0, 0, 0.88889],
    "9143": [0.88502, 0.915, 0, 0, 1.05556],
    "10216": [1.25003, 1.75, 0, 0, 0.80556],
    "10217": [1.25003, 1.75, 0, 0, 0.80556],
    "57344": [-499e-5, 0.605, 0, 0, 1.05556],
    "57345": [-499e-5, 0.605, 0, 0, 1.05556],
    "57680": [0, 0.12, 0, 0, 0.45],
    "57681": [0, 0.12, 0, 0, 0.45],
    "57682": [0, 0.12, 0, 0, 0.45],
    "57683": [0, 0.12, 0, 0, 0.45]
  },
  "Typewriter-Regular": {
    "32": [0, 0, 0, 0, 0.525],
    "33": [0, 0.61111, 0, 0, 0.525],
    "34": [0, 0.61111, 0, 0, 0.525],
    "35": [0, 0.61111, 0, 0, 0.525],
    "36": [0.08333, 0.69444, 0, 0, 0.525],
    "37": [0.08333, 0.69444, 0, 0, 0.525],
    "38": [0, 0.61111, 0, 0, 0.525],
    "39": [0, 0.61111, 0, 0, 0.525],
    "40": [0.08333, 0.69444, 0, 0, 0.525],
    "41": [0.08333, 0.69444, 0, 0, 0.525],
    "42": [0, 0.52083, 0, 0, 0.525],
    "43": [-0.08056, 0.53055, 0, 0, 0.525],
    "44": [0.13889, 0.125, 0, 0, 0.525],
    "45": [-0.08056, 0.53055, 0, 0, 0.525],
    "46": [0, 0.125, 0, 0, 0.525],
    "47": [0.08333, 0.69444, 0, 0, 0.525],
    "48": [0, 0.61111, 0, 0, 0.525],
    "49": [0, 0.61111, 0, 0, 0.525],
    "50": [0, 0.61111, 0, 0, 0.525],
    "51": [0, 0.61111, 0, 0, 0.525],
    "52": [0, 0.61111, 0, 0, 0.525],
    "53": [0, 0.61111, 0, 0, 0.525],
    "54": [0, 0.61111, 0, 0, 0.525],
    "55": [0, 0.61111, 0, 0, 0.525],
    "56": [0, 0.61111, 0, 0, 0.525],
    "57": [0, 0.61111, 0, 0, 0.525],
    "58": [0, 0.43056, 0, 0, 0.525],
    "59": [0.13889, 0.43056, 0, 0, 0.525],
    "60": [-0.05556, 0.55556, 0, 0, 0.525],
    "61": [-0.19549, 0.41562, 0, 0, 0.525],
    "62": [-0.05556, 0.55556, 0, 0, 0.525],
    "63": [0, 0.61111, 0, 0, 0.525],
    "64": [0, 0.61111, 0, 0, 0.525],
    "65": [0, 0.61111, 0, 0, 0.525],
    "66": [0, 0.61111, 0, 0, 0.525],
    "67": [0, 0.61111, 0, 0, 0.525],
    "68": [0, 0.61111, 0, 0, 0.525],
    "69": [0, 0.61111, 0, 0, 0.525],
    "70": [0, 0.61111, 0, 0, 0.525],
    "71": [0, 0.61111, 0, 0, 0.525],
    "72": [0, 0.61111, 0, 0, 0.525],
    "73": [0, 0.61111, 0, 0, 0.525],
    "74": [0, 0.61111, 0, 0, 0.525],
    "75": [0, 0.61111, 0, 0, 0.525],
    "76": [0, 0.61111, 0, 0, 0.525],
    "77": [0, 0.61111, 0, 0, 0.525],
    "78": [0, 0.61111, 0, 0, 0.525],
    "79": [0, 0.61111, 0, 0, 0.525],
    "80": [0, 0.61111, 0, 0, 0.525],
    "81": [0.13889, 0.61111, 0, 0, 0.525],
    "82": [0, 0.61111, 0, 0, 0.525],
    "83": [0, 0.61111, 0, 0, 0.525],
    "84": [0, 0.61111, 0, 0, 0.525],
    "85": [0, 0.61111, 0, 0, 0.525],
    "86": [0, 0.61111, 0, 0, 0.525],
    "87": [0, 0.61111, 0, 0, 0.525],
    "88": [0, 0.61111, 0, 0, 0.525],
    "89": [0, 0.61111, 0, 0, 0.525],
    "90": [0, 0.61111, 0, 0, 0.525],
    "91": [0.08333, 0.69444, 0, 0, 0.525],
    "92": [0.08333, 0.69444, 0, 0, 0.525],
    "93": [0.08333, 0.69444, 0, 0, 0.525],
    "94": [0, 0.61111, 0, 0, 0.525],
    "95": [0.09514, 0, 0, 0, 0.525],
    "96": [0, 0.61111, 0, 0, 0.525],
    "97": [0, 0.43056, 0, 0, 0.525],
    "98": [0, 0.61111, 0, 0, 0.525],
    "99": [0, 0.43056, 0, 0, 0.525],
    "100": [0, 0.61111, 0, 0, 0.525],
    "101": [0, 0.43056, 0, 0, 0.525],
    "102": [0, 0.61111, 0, 0, 0.525],
    "103": [0.22222, 0.43056, 0, 0, 0.525],
    "104": [0, 0.61111, 0, 0, 0.525],
    "105": [0, 0.61111, 0, 0, 0.525],
    "106": [0.22222, 0.61111, 0, 0, 0.525],
    "107": [0, 0.61111, 0, 0, 0.525],
    "108": [0, 0.61111, 0, 0, 0.525],
    "109": [0, 0.43056, 0, 0, 0.525],
    "110": [0, 0.43056, 0, 0, 0.525],
    "111": [0, 0.43056, 0, 0, 0.525],
    "112": [0.22222, 0.43056, 0, 0, 0.525],
    "113": [0.22222, 0.43056, 0, 0, 0.525],
    "114": [0, 0.43056, 0, 0, 0.525],
    "115": [0, 0.43056, 0, 0, 0.525],
    "116": [0, 0.55358, 0, 0, 0.525],
    "117": [0, 0.43056, 0, 0, 0.525],
    "118": [0, 0.43056, 0, 0, 0.525],
    "119": [0, 0.43056, 0, 0, 0.525],
    "120": [0, 0.43056, 0, 0, 0.525],
    "121": [0.22222, 0.43056, 0, 0, 0.525],
    "122": [0, 0.43056, 0, 0, 0.525],
    "123": [0.08333, 0.69444, 0, 0, 0.525],
    "124": [0.08333, 0.69444, 0, 0, 0.525],
    "125": [0.08333, 0.69444, 0, 0, 0.525],
    "126": [0, 0.61111, 0, 0, 0.525],
    "127": [0, 0.61111, 0, 0, 0.525],
    "160": [0, 0, 0, 0, 0.525],
    "176": [0, 0.61111, 0, 0, 0.525],
    "184": [0.19445, 0, 0, 0, 0.525],
    "305": [0, 0.43056, 0, 0, 0.525],
    "567": [0.22222, 0.43056, 0, 0, 0.525],
    "711": [0, 0.56597, 0, 0, 0.525],
    "713": [0, 0.56555, 0, 0, 0.525],
    "714": [0, 0.61111, 0, 0, 0.525],
    "715": [0, 0.61111, 0, 0, 0.525],
    "728": [0, 0.61111, 0, 0, 0.525],
    "730": [0, 0.61111, 0, 0, 0.525],
    "770": [0, 0.61111, 0, 0, 0.525],
    "771": [0, 0.61111, 0, 0, 0.525],
    "776": [0, 0.61111, 0, 0, 0.525],
    "915": [0, 0.61111, 0, 0, 0.525],
    "916": [0, 0.61111, 0, 0, 0.525],
    "920": [0, 0.61111, 0, 0, 0.525],
    "923": [0, 0.61111, 0, 0, 0.525],
    "926": [0, 0.61111, 0, 0, 0.525],
    "928": [0, 0.61111, 0, 0, 0.525],
    "931": [0, 0.61111, 0, 0, 0.525],
    "933": [0, 0.61111, 0, 0, 0.525],
    "934": [0, 0.61111, 0, 0, 0.525],
    "936": [0, 0.61111, 0, 0, 0.525],
    "937": [0, 0.61111, 0, 0, 0.525],
    "8216": [0, 0.61111, 0, 0, 0.525],
    "8217": [0, 0.61111, 0, 0, 0.525],
    "8242": [0, 0.61111, 0, 0, 0.525],
    "9251": [0.11111, 0.21944, 0, 0, 0.525]
  }
};
var sigmasAndXis = {
  slant: [0.25, 0.25, 0.25],
  // sigma1
  space: [0, 0, 0],
  // sigma2
  stretch: [0, 0, 0],
  // sigma3
  shrink: [0, 0, 0],
  // sigma4
  xHeight: [0.431, 0.431, 0.431],
  // sigma5
  quad: [1, 1.171, 1.472],
  // sigma6
  extraSpace: [0, 0, 0],
  // sigma7
  num1: [0.677, 0.732, 0.925],
  // sigma8
  num2: [0.394, 0.384, 0.387],
  // sigma9
  num3: [0.444, 0.471, 0.504],
  // sigma10
  denom1: [0.686, 0.752, 1.025],
  // sigma11
  denom2: [0.345, 0.344, 0.532],
  // sigma12
  sup1: [0.413, 0.503, 0.504],
  // sigma13
  sup2: [0.363, 0.431, 0.404],
  // sigma14
  sup3: [0.289, 0.286, 0.294],
  // sigma15
  sub1: [0.15, 0.143, 0.2],
  // sigma16
  sub2: [0.247, 0.286, 0.4],
  // sigma17
  supDrop: [0.386, 0.353, 0.494],
  // sigma18
  subDrop: [0.05, 0.071, 0.1],
  // sigma19
  delim1: [2.39, 1.7, 1.98],
  // sigma20
  delim2: [1.01, 1.157, 1.42],
  // sigma21
  axisHeight: [0.25, 0.25, 0.25],
  // sigma22
  // These font metrics are extracted from TeX by using tftopl on cmex10.tfm;
  // they correspond to the font parameters of the extension fonts (family 3).
  // See the TeXbook, page 441. In AMSTeX, the extension fonts scale; to
  // match cmex7, we'd use cmex7.tfm values for script and scriptscript
  // values.
  defaultRuleThickness: [0.04, 0.049, 0.049],
  // xi8; cmex7: 0.049
  bigOpSpacing1: [0.111, 0.111, 0.111],
  // xi9
  bigOpSpacing2: [0.166, 0.166, 0.166],
  // xi10
  bigOpSpacing3: [0.2, 0.2, 0.2],
  // xi11
  bigOpSpacing4: [0.6, 0.611, 0.611],
  // xi12; cmex7: 0.611
  bigOpSpacing5: [0.1, 0.143, 0.143],
  // xi13; cmex7: 0.143
  // The \sqrt rule width is taken from the height of the surd character.
  // Since we use the same font at all sizes, this thickness doesn't scale.
  sqrtRuleThickness: [0.04, 0.04, 0.04],
  // This value determines how large a pt is, for metrics which are defined
  // in terms of pts.
  // This value is also used in katex.scss; if you change it make sure the
  // values match.
  ptPerEm: [10, 10, 10],
  // The space between adjacent `|` columns in an array definition. From
  // `\showthe\doublerulesep` in LaTeX. Equals 2.0 / ptPerEm.
  doubleRuleSep: [0.2, 0.2, 0.2],
  // The width of separator lines in {array} environments. From
  // `\showthe\arrayrulewidth` in LaTeX. Equals 0.4 / ptPerEm.
  arrayRuleWidth: [0.04, 0.04, 0.04],
  // Two values from LaTeX source2e:
  fboxsep: [0.3, 0.3, 0.3],
  //        3 pt / ptPerEm
  fboxrule: [0.04, 0.04, 0.04]
  // 0.4 pt / ptPerEm
};
var extraCharacterMap = {
  // Latin-1
  "\xC5": "A",
  "\xD0": "D",
  "\xDE": "o",
  "\xE5": "a",
  "\xF0": "d",
  "\xFE": "o",
  // Cyrillic
  "\u0410": "A",
  "\u0411": "B",
  "\u0412": "B",
  "\u0413": "F",
  "\u0414": "A",
  "\u0415": "E",
  "\u0416": "K",
  "\u0417": "3",
  "\u0418": "N",
  "\u0419": "N",
  "\u041A": "K",
  "\u041B": "N",
  "\u041C": "M",
  "\u041D": "H",
  "\u041E": "O",
  "\u041F": "N",
  "\u0420": "P",
  "\u0421": "C",
  "\u0422": "T",
  "\u0423": "y",
  "\u0424": "O",
  "\u0425": "X",
  "\u0426": "U",
  "\u0427": "h",
  "\u0428": "W",
  "\u0429": "W",
  "\u042A": "B",
  "\u042B": "X",
  "\u042C": "B",
  "\u042D": "3",
  "\u042E": "X",
  "\u042F": "R",
  "\u0430": "a",
  "\u0431": "b",
  "\u0432": "a",
  "\u0433": "r",
  "\u0434": "y",
  "\u0435": "e",
  "\u0436": "m",
  "\u0437": "e",
  "\u0438": "n",
  "\u0439": "n",
  "\u043A": "n",
  "\u043B": "n",
  "\u043C": "m",
  "\u043D": "n",
  "\u043E": "o",
  "\u043F": "n",
  "\u0440": "p",
  "\u0441": "c",
  "\u0442": "o",
  "\u0443": "y",
  "\u0444": "b",
  "\u0445": "x",
  "\u0446": "n",
  "\u0447": "n",
  "\u0448": "w",
  "\u0449": "w",
  "\u044A": "a",
  "\u044B": "m",
  "\u044C": "a",
  "\u044D": "e",
  "\u044E": "m",
  "\u044F": "r"
};
function setFontMetrics(fontName, metrics) {
  fontMetricsData[fontName] = metrics;
}
function getCharacterMetrics(character, font, mode) {
  if (!fontMetricsData[font]) {
    throw new Error("Font metrics not found for font: " + font + ".");
  }
  var ch = character.charCodeAt(0);
  var metrics = fontMetricsData[font][ch];
  if (!metrics && character[0] in extraCharacterMap) {
    ch = extraCharacterMap[character[0]].charCodeAt(0);
    metrics = fontMetricsData[font][ch];
  }
  if (!metrics && mode === "text") {
    if (supportedCodepoint(ch)) {
      metrics = fontMetricsData[font][77];
    }
  }
  if (metrics) {
    return {
      depth: metrics[0],
      height: metrics[1],
      italic: metrics[2],
      skew: metrics[3],
      width: metrics[4]
    };
  }
}
var fontMetricsBySizeIndex = {};
function getGlobalMetrics(size) {
  var sizeIndex;
  if (size >= 5) {
    sizeIndex = 0;
  } else if (size >= 3) {
    sizeIndex = 1;
  } else {
    sizeIndex = 2;
  }
  if (!fontMetricsBySizeIndex[sizeIndex]) {
    var metrics = fontMetricsBySizeIndex[sizeIndex] = {
      cssEmPerMu: sigmasAndXis.quad[sizeIndex] / 18
    };
    for (var key in sigmasAndXis) {
      if (sigmasAndXis.hasOwnProperty(key)) {
        metrics[key] = sigmasAndXis[key][sizeIndex];
      }
    }
  }
  return fontMetricsBySizeIndex[sizeIndex];
}
var sizeStyleMap = [
  // Each element contains [textsize, scriptsize, scriptscriptsize].
  // The size mappings are taken from TeX with \normalsize=10pt.
  [1, 1, 1],
  // size1: [5, 5, 5]              \tiny
  [2, 1, 1],
  // size2: [6, 5, 5]
  [3, 1, 1],
  // size3: [7, 5, 5]              \scriptsize
  [4, 2, 1],
  // size4: [8, 6, 5]              \footnotesize
  [5, 2, 1],
  // size5: [9, 6, 5]              \small
  [6, 3, 1],
  // size6: [10, 7, 5]             \normalsize
  [7, 4, 2],
  // size7: [12, 8, 6]             \large
  [8, 6, 3],
  // size8: [14.4, 10, 7]          \Large
  [9, 7, 6],
  // size9: [17.28, 12, 10]        \LARGE
  [10, 8, 7],
  // size10: [20.74, 14.4, 12]     \huge
  [11, 10, 9]
  // size11: [24.88, 20.74, 17.28] \HUGE
];
var sizeMultipliers = [
  // fontMetrics.js:getGlobalMetrics also uses size indexes, so if
  // you change size indexes, change that function.
  0.5,
  0.6,
  0.7,
  0.8,
  0.9,
  1,
  1.2,
  1.44,
  1.728,
  2.074,
  2.488
];
var sizeAtStyle = function sizeAtStyle2(size, style) {
  return style.size < 2 ? size : sizeStyleMap[size - 1][style.size - 1];
};
var Options = class _Options {
  // A font family applies to a group of fonts (i.e. SansSerif), while a font
  // represents a specific font (i.e. SansSerif Bold).
  // See: https://tex.stackexchange.com/questions/22350/difference-between-textrm-and-mathrm
  /**
   * The base size index.
   */
  constructor(data) {
    this.style = void 0;
    this.color = void 0;
    this.size = void 0;
    this.textSize = void 0;
    this.phantom = void 0;
    this.font = void 0;
    this.fontFamily = void 0;
    this.fontWeight = void 0;
    this.fontShape = void 0;
    this.sizeMultiplier = void 0;
    this.maxSize = void 0;
    this.minRuleThickness = void 0;
    this._fontMetrics = void 0;
    this.style = data.style;
    this.color = data.color;
    this.size = data.size || _Options.BASESIZE;
    this.textSize = data.textSize || this.size;
    this.phantom = !!data.phantom;
    this.font = data.font || "";
    this.fontFamily = data.fontFamily || "";
    this.fontWeight = data.fontWeight || "";
    this.fontShape = data.fontShape || "";
    this.sizeMultiplier = sizeMultipliers[this.size - 1];
    this.maxSize = data.maxSize;
    this.minRuleThickness = data.minRuleThickness;
    this._fontMetrics = void 0;
  }
  /**
   * Returns a new options object with the same properties as "this".  Properties
   * from "extension" will be copied to the new options object.
   */
  extend(extension) {
    var data = {
      style: this.style,
      size: this.size,
      textSize: this.textSize,
      color: this.color,
      phantom: this.phantom,
      font: this.font,
      fontFamily: this.fontFamily,
      fontWeight: this.fontWeight,
      fontShape: this.fontShape,
      maxSize: this.maxSize,
      minRuleThickness: this.minRuleThickness
    };
    for (var key in extension) {
      if (extension.hasOwnProperty(key)) {
        data[key] = extension[key];
      }
    }
    return new _Options(data);
  }
  /**
   * Return an options object with the given style. If `this.style === style`,
   * returns `this`.
   */
  havingStyle(style) {
    if (this.style === style) {
      return this;
    } else {
      return this.extend({
        style,
        size: sizeAtStyle(this.textSize, style)
      });
    }
  }
  /**
   * Return an options object with a cramped version of the current style. If
   * the current style is cramped, returns `this`.
   */
  havingCrampedStyle() {
    return this.havingStyle(this.style.cramp());
  }
  /**
   * Return an options object with the given size and in at least `\textstyle`.
   * Returns `this` if appropriate.
   */
  havingSize(size) {
    if (this.size === size && this.textSize === size) {
      return this;
    } else {
      return this.extend({
        style: this.style.text(),
        size,
        textSize: size,
        sizeMultiplier: sizeMultipliers[size - 1]
      });
    }
  }
  /**
   * Like `this.havingSize(BASESIZE).havingStyle(style)`. If `style` is omitted,
   * changes to at least `\textstyle`.
   */
  havingBaseStyle(style) {
    style = style || this.style.text();
    var wantSize = sizeAtStyle(_Options.BASESIZE, style);
    if (this.size === wantSize && this.textSize === _Options.BASESIZE && this.style === style) {
      return this;
    } else {
      return this.extend({
        style,
        size: wantSize
      });
    }
  }
  /**
   * Remove the effect of sizing changes such as \Huge.
   * Keep the effect of the current style, such as \scriptstyle.
   */
  havingBaseSizing() {
    var size;
    switch (this.style.id) {
      case 4:
      case 5:
        size = 3;
        break;
      case 6:
      case 7:
        size = 1;
        break;
      default:
        size = 6;
    }
    return this.extend({
      style: this.style.text(),
      size
    });
  }
  /**
   * Create a new options object with the given color.
   */
  withColor(color) {
    return this.extend({
      color
    });
  }
  /**
   * Create a new options object with "phantom" set to true.
   */
  withPhantom() {
    return this.extend({
      phantom: true
    });
  }
  /**
   * Creates a new options object with the given math font or old text font.
   * @type {[type]}
   */
  withFont(font) {
    return this.extend({
      font
    });
  }
  /**
   * Create a new options objects with the given fontFamily.
   */
  withTextFontFamily(fontFamily) {
    return this.extend({
      fontFamily,
      font: ""
    });
  }
  /**
   * Creates a new options object with the given font weight
   */
  withTextFontWeight(fontWeight) {
    return this.extend({
      fontWeight,
      font: ""
    });
  }
  /**
   * Creates a new options object with the given font weight
   */
  withTextFontShape(fontShape) {
    return this.extend({
      fontShape,
      font: ""
    });
  }
  /**
   * Return the CSS sizing classes required to switch from enclosing options
   * `oldOptions` to `this`. Returns an array of classes.
   */
  sizingClasses(oldOptions) {
    if (oldOptions.size !== this.size) {
      return ["sizing", "reset-size" + oldOptions.size, "size" + this.size];
    } else {
      return [];
    }
  }
  /**
   * Return the CSS sizing classes required to switch to the base size. Like
   * `this.havingSize(BASESIZE).sizingClasses(this)`.
   */
  baseSizingClasses() {
    if (this.size !== _Options.BASESIZE) {
      return ["sizing", "reset-size" + this.size, "size" + _Options.BASESIZE];
    } else {
      return [];
    }
  }
  /**
   * Return the font metrics for this size.
   */
  fontMetrics() {
    if (!this._fontMetrics) {
      this._fontMetrics = getGlobalMetrics(this.size);
    }
    return this._fontMetrics;
  }
  /**
   * Gets the CSS color of the current options object
   */
  getColor() {
    if (this.phantom) {
      return "transparent";
    } else {
      return this.color;
    }
  }
};
Options.BASESIZE = 6;
var ptPerUnit = {
  // https://en.wikibooks.org/wiki/LaTeX/Lengths and
  // https://tex.stackexchange.com/a/8263
  "pt": 1,
  // TeX point
  "mm": 7227 / 2540,
  // millimeter
  "cm": 7227 / 254,
  // centimeter
  "in": 72.27,
  // inch
  "bp": 803 / 800,
  // big (PostScript) points
  "pc": 12,
  // pica
  "dd": 1238 / 1157,
  // didot
  "cc": 14856 / 1157,
  // cicero (12 didot)
  "nd": 685 / 642,
  // new didot
  "nc": 1370 / 107,
  // new cicero (12 new didot)
  "sp": 1 / 65536,
  // scaled point (TeX's internal smallest unit)
  // https://tex.stackexchange.com/a/41371
  "px": 803 / 800
  // \pdfpxdimen defaults to 1 bp in pdfTeX and LuaTeX
};
var relativeUnit = {
  "ex": true,
  "em": true,
  "mu": true
};
var validUnit = function validUnit2(unit) {
  if (typeof unit !== "string") {
    unit = unit.unit;
  }
  return unit in ptPerUnit || unit in relativeUnit || unit === "ex";
};
var calculateSize = function calculateSize2(sizeValue, options) {
  var scale;
  if (sizeValue.unit in ptPerUnit) {
    scale = ptPerUnit[sizeValue.unit] / options.fontMetrics().ptPerEm / options.sizeMultiplier;
  } else if (sizeValue.unit === "mu") {
    scale = options.fontMetrics().cssEmPerMu;
  } else {
    var unitOptions;
    if (options.style.isTight()) {
      unitOptions = options.havingStyle(options.style.text());
    } else {
      unitOptions = options;
    }
    if (sizeValue.unit === "ex") {
      scale = unitOptions.fontMetrics().xHeight;
    } else if (sizeValue.unit === "em") {
      scale = unitOptions.fontMetrics().quad;
    } else {
      throw new ParseError("Invalid unit: '" + sizeValue.unit + "'");
    }
    if (unitOptions !== options) {
      scale *= unitOptions.sizeMultiplier / options.sizeMultiplier;
    }
  }
  return Math.min(sizeValue.number * scale, options.maxSize);
};
var makeEm = function makeEm2(n) {
  return +n.toFixed(4) + "em";
};
var createClass = function createClass2(classes) {
  return classes.filter((cls) => cls).join(" ");
};
var initNode = function initNode2(classes, options, style) {
  this.classes = classes || [];
  this.attributes = {};
  this.height = 0;
  this.depth = 0;
  this.maxFontSize = 0;
  this.style = style || {};
  if (options) {
    if (options.style.isTight()) {
      this.classes.push("mtight");
    }
    var color = options.getColor();
    if (color) {
      this.style.color = color;
    }
  }
};
var toNode = function toNode2(tagName) {
  var node = document.createElement(tagName);
  node.className = createClass(this.classes);
  for (var style in this.style) {
    if (this.style.hasOwnProperty(style)) {
      node.style[style] = this.style[style];
    }
  }
  for (var attr in this.attributes) {
    if (this.attributes.hasOwnProperty(attr)) {
      node.setAttribute(attr, this.attributes[attr]);
    }
  }
  for (var i = 0; i < this.children.length; i++) {
    node.appendChild(this.children[i].toNode());
  }
  return node;
};
var invalidAttributeNameRegex = /[\s"'>/=\x00-\x1f]/;
var toMarkup = function toMarkup2(tagName) {
  var markup = "<" + tagName;
  if (this.classes.length) {
    markup += ' class="' + utils.escape(createClass(this.classes)) + '"';
  }
  var styles2 = "";
  for (var style in this.style) {
    if (this.style.hasOwnProperty(style)) {
      styles2 += utils.hyphenate(style) + ":" + this.style[style] + ";";
    }
  }
  if (styles2) {
    markup += ' style="' + utils.escape(styles2) + '"';
  }
  for (var attr in this.attributes) {
    if (this.attributes.hasOwnProperty(attr)) {
      if (invalidAttributeNameRegex.test(attr)) {
        throw new ParseError("Invalid attribute name '" + attr + "'");
      }
      markup += " " + attr + '="' + utils.escape(this.attributes[attr]) + '"';
    }
  }
  markup += ">";
  for (var i = 0; i < this.children.length; i++) {
    markup += this.children[i].toMarkup();
  }
  markup += "</" + tagName + ">";
  return markup;
};
var Span = class {
  constructor(classes, children, options, style) {
    this.children = void 0;
    this.attributes = void 0;
    this.classes = void 0;
    this.height = void 0;
    this.depth = void 0;
    this.width = void 0;
    this.maxFontSize = void 0;
    this.style = void 0;
    initNode.call(this, classes, options, style);
    this.children = children || [];
  }
  /**
   * Sets an arbitrary attribute on the span. Warning: use this wisely. Not
   * all browsers support attributes the same, and having too many custom
   * attributes is probably bad.
   */
  setAttribute(attribute, value) {
    this.attributes[attribute] = value;
  }
  hasClass(className) {
    return utils.contains(this.classes, className);
  }
  toNode() {
    return toNode.call(this, "span");
  }
  toMarkup() {
    return toMarkup.call(this, "span");
  }
};
var Anchor = class {
  constructor(href, classes, children, options) {
    this.children = void 0;
    this.attributes = void 0;
    this.classes = void 0;
    this.height = void 0;
    this.depth = void 0;
    this.maxFontSize = void 0;
    this.style = void 0;
    initNode.call(this, classes, options);
    this.children = children || [];
    this.setAttribute("href", href);
  }
  setAttribute(attribute, value) {
    this.attributes[attribute] = value;
  }
  hasClass(className) {
    return utils.contains(this.classes, className);
  }
  toNode() {
    return toNode.call(this, "a");
  }
  toMarkup() {
    return toMarkup.call(this, "a");
  }
};
var Img = class {
  constructor(src, alt, style) {
    this.src = void 0;
    this.alt = void 0;
    this.classes = void 0;
    this.height = void 0;
    this.depth = void 0;
    this.maxFontSize = void 0;
    this.style = void 0;
    this.alt = alt;
    this.src = src;
    this.classes = ["mord"];
    this.style = style;
  }
  hasClass(className) {
    return utils.contains(this.classes, className);
  }
  toNode() {
    var node = document.createElement("img");
    node.src = this.src;
    node.alt = this.alt;
    node.className = "mord";
    for (var style in this.style) {
      if (this.style.hasOwnProperty(style)) {
        node.style[style] = this.style[style];
      }
    }
    return node;
  }
  toMarkup() {
    var markup = '<img src="' + utils.escape(this.src) + '"' + (' alt="' + utils.escape(this.alt) + '"');
    var styles2 = "";
    for (var style in this.style) {
      if (this.style.hasOwnProperty(style)) {
        styles2 += utils.hyphenate(style) + ":" + this.style[style] + ";";
      }
    }
    if (styles2) {
      markup += ' style="' + utils.escape(styles2) + '"';
    }
    markup += "'/>";
    return markup;
  }
};
var iCombinations = {
  "\xEE": "\u0131\u0302",
  "\xEF": "\u0131\u0308",
  "\xED": "\u0131\u0301",
  // 'ī': '\u0131\u0304', // enable when we add Extended Latin
  "\xEC": "\u0131\u0300"
};
var SymbolNode = class {
  constructor(text2, height, depth, italic, skew, width, classes, style) {
    this.text = void 0;
    this.height = void 0;
    this.depth = void 0;
    this.italic = void 0;
    this.skew = void 0;
    this.width = void 0;
    this.maxFontSize = void 0;
    this.classes = void 0;
    this.style = void 0;
    this.text = text2;
    this.height = height || 0;
    this.depth = depth || 0;
    this.italic = italic || 0;
    this.skew = skew || 0;
    this.width = width || 0;
    this.classes = classes || [];
    this.style = style || {};
    this.maxFontSize = 0;
    var script = scriptFromCodepoint(this.text.charCodeAt(0));
    if (script) {
      this.classes.push(script + "_fallback");
    }
    if (/[îïíì]/.test(this.text)) {
      this.text = iCombinations[this.text];
    }
  }
  hasClass(className) {
    return utils.contains(this.classes, className);
  }
  /**
   * Creates a text node or span from a symbol node. Note that a span is only
   * created if it is needed.
   */
  toNode() {
    var node = document.createTextNode(this.text);
    var span = null;
    if (this.italic > 0) {
      span = document.createElement("span");
      span.style.marginRight = makeEm(this.italic);
    }
    if (this.classes.length > 0) {
      span = span || document.createElement("span");
      span.className = createClass(this.classes);
    }
    for (var style in this.style) {
      if (this.style.hasOwnProperty(style)) {
        span = span || document.createElement("span");
        span.style[style] = this.style[style];
      }
    }
    if (span) {
      span.appendChild(node);
      return span;
    } else {
      return node;
    }
  }
  /**
   * Creates markup for a symbol node.
   */
  toMarkup() {
    var needsSpan = false;
    var markup = "<span";
    if (this.classes.length) {
      needsSpan = true;
      markup += ' class="';
      markup += utils.escape(createClass(this.classes));
      markup += '"';
    }
    var styles2 = "";
    if (this.italic > 0) {
      styles2 += "margin-right:" + this.italic + "em;";
    }
    for (var style in this.style) {
      if (this.style.hasOwnProperty(style)) {
        styles2 += utils.hyphenate(style) + ":" + this.style[style] + ";";
      }
    }
    if (styles2) {
      needsSpan = true;
      markup += ' style="' + utils.escape(styles2) + '"';
    }
    var escaped = utils.escape(this.text);
    if (needsSpan) {
      markup += ">";
      markup += escaped;
      markup += "</span>";
      return markup;
    } else {
      return escaped;
    }
  }
};
var SvgNode = class {
  constructor(children, attributes) {
    this.children = void 0;
    this.attributes = void 0;
    this.children = children || [];
    this.attributes = attributes || {};
  }
  toNode() {
    var svgNS = "http://www.w3.org/2000/svg";
    var node = document.createElementNS(svgNS, "svg");
    for (var attr in this.attributes) {
      if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
        node.setAttribute(attr, this.attributes[attr]);
      }
    }
    for (var i = 0; i < this.children.length; i++) {
      node.appendChild(this.children[i].toNode());
    }
    return node;
  }
  toMarkup() {
    var markup = '<svg xmlns="http://www.w3.org/2000/svg"';
    for (var attr in this.attributes) {
      if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
        markup += " " + attr + '="' + utils.escape(this.attributes[attr]) + '"';
      }
    }
    markup += ">";
    for (var i = 0; i < this.children.length; i++) {
      markup += this.children[i].toMarkup();
    }
    markup += "</svg>";
    return markup;
  }
};
var PathNode = class {
  constructor(pathName, alternate) {
    this.pathName = void 0;
    this.alternate = void 0;
    this.pathName = pathName;
    this.alternate = alternate;
  }
  toNode() {
    var svgNS = "http://www.w3.org/2000/svg";
    var node = document.createElementNS(svgNS, "path");
    if (this.alternate) {
      node.setAttribute("d", this.alternate);
    } else {
      node.setAttribute("d", path[this.pathName]);
    }
    return node;
  }
  toMarkup() {
    if (this.alternate) {
      return '<path d="' + utils.escape(this.alternate) + '"/>';
    } else {
      return '<path d="' + utils.escape(path[this.pathName]) + '"/>';
    }
  }
};
var LineNode = class {
  constructor(attributes) {
    this.attributes = void 0;
    this.attributes = attributes || {};
  }
  toNode() {
    var svgNS = "http://www.w3.org/2000/svg";
    var node = document.createElementNS(svgNS, "line");
    for (var attr in this.attributes) {
      if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
        node.setAttribute(attr, this.attributes[attr]);
      }
    }
    return node;
  }
  toMarkup() {
    var markup = "<line";
    for (var attr in this.attributes) {
      if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
        markup += " " + attr + '="' + utils.escape(this.attributes[attr]) + '"';
      }
    }
    markup += "/>";
    return markup;
  }
};
function assertSymbolDomNode(group) {
  if (group instanceof SymbolNode) {
    return group;
  } else {
    throw new Error("Expected symbolNode but got " + String(group) + ".");
  }
}
function assertSpan(group) {
  if (group instanceof Span) {
    return group;
  } else {
    throw new Error("Expected span<HtmlDomNode> but got " + String(group) + ".");
  }
}
var ATOMS = {
  "bin": 1,
  "close": 1,
  "inner": 1,
  "open": 1,
  "punct": 1,
  "rel": 1
};
var NON_ATOMS = {
  "accent-token": 1,
  "mathord": 1,
  "op-token": 1,
  "spacing": 1,
  "textord": 1
};
var symbols = {
  "math": {},
  "text": {}
};
function defineSymbol(mode, font, group, replace, name2, acceptUnicodeChar) {
  symbols[mode][name2] = {
    font,
    group,
    replace
  };
  if (acceptUnicodeChar && replace) {
    symbols[mode][replace] = symbols[mode][name2];
  }
}
var math = "math";
var text = "text";
var main = "main";
var ams = "ams";
var accent = "accent-token";
var bin = "bin";
var close = "close";
var inner = "inner";
var mathord = "mathord";
var op = "op-token";
var open = "open";
var punct = "punct";
var rel = "rel";
var spacing = "spacing";
var textord = "textord";
defineSymbol(math, main, rel, "\u2261", "\\equiv", true);
defineSymbol(math, main, rel, "\u227A", "\\prec", true);
defineSymbol(math, main, rel, "\u227B", "\\succ", true);
defineSymbol(math, main, rel, "\u223C", "\\sim", true);
defineSymbol(math, main, rel, "\u22A5", "\\perp");
defineSymbol(math, main, rel, "\u2AAF", "\\preceq", true);
defineSymbol(math, main, rel, "\u2AB0", "\\succeq", true);
defineSymbol(math, main, rel, "\u2243", "\\simeq", true);
defineSymbol(math, main, rel, "\u2223", "\\mid", true);
defineSymbol(math, main, rel, "\u226A", "\\ll", true);
defineSymbol(math, main, rel, "\u226B", "\\gg", true);
defineSymbol(math, main, rel, "\u224D", "\\asymp", true);
defineSymbol(math, main, rel, "\u2225", "\\parallel");
defineSymbol(math, main, rel, "\u22C8", "\\bowtie", true);
defineSymbol(math, main, rel, "\u2323", "\\smile", true);
defineSymbol(math, main, rel, "\u2291", "\\sqsubseteq", true);
defineSymbol(math, main, rel, "\u2292", "\\sqsupseteq", true);
defineSymbol(math, main, rel, "\u2250", "\\doteq", true);
defineSymbol(math, main, rel, "\u2322", "\\frown", true);
defineSymbol(math, main, rel, "\u220B", "\\ni", true);
defineSymbol(math, main, rel, "\u221D", "\\propto", true);
defineSymbol(math, main, rel, "\u22A2", "\\vdash", true);
defineSymbol(math, main, rel, "\u22A3", "\\dashv", true);
defineSymbol(math, main, rel, "\u220B", "\\owns");
defineSymbol(math, main, punct, ".", "\\ldotp");
defineSymbol(math, main, punct, "\u22C5", "\\cdotp");
defineSymbol(math, main, textord, "#", "\\#");
defineSymbol(text, main, textord, "#", "\\#");
defineSymbol(math, main, textord, "&", "\\&");
defineSymbol(text, main, textord, "&", "\\&");
defineSymbol(math, main, textord, "\u2135", "\\aleph", true);
defineSymbol(math, main, textord, "\u2200", "\\forall", true);
defineSymbol(math, main, textord, "\u210F", "\\hbar", true);
defineSymbol(math, main, textord, "\u2203", "\\exists", true);
defineSymbol(math, main, textord, "\u2207", "\\nabla", true);
defineSymbol(math, main, textord, "\u266D", "\\flat", true);
defineSymbol(math, main, textord, "\u2113", "\\ell", true);
defineSymbol(math, main, textord, "\u266E", "\\natural", true);
defineSymbol(math, main, textord, "\u2663", "\\clubsuit", true);
defineSymbol(math, main, textord, "\u2118", "\\wp", true);
defineSymbol(math, main, textord, "\u266F", "\\sharp", true);
defineSymbol(math, main, textord, "\u2662", "\\diamondsuit", true);
defineSymbol(math, main, textord, "\u211C", "\\Re", true);
defineSymbol(math, main, textord, "\u2661", "\\heartsuit", true);
defineSymbol(math, main, textord, "\u2111", "\\Im", true);
defineSymbol(math, main, textord, "\u2660", "\\spadesuit", true);
defineSymbol(math, main, textord, "\xA7", "\\S", true);
defineSymbol(text, main, textord, "\xA7", "\\S");
defineSymbol(math, main, textord, "\xB6", "\\P", true);
defineSymbol(text, main, textord, "\xB6", "\\P");
defineSymbol(math, main, textord, "\u2020", "\\dag");
defineSymbol(text, main, textord, "\u2020", "\\dag");
defineSymbol(text, main, textord, "\u2020", "\\textdagger");
defineSymbol(math, main, textord, "\u2021", "\\ddag");
defineSymbol(text, main, textord, "\u2021", "\\ddag");
defineSymbol(text, main, textord, "\u2021", "\\textdaggerdbl");
defineSymbol(math, main, close, "\u23B1", "\\rmoustache", true);
defineSymbol(math, main, open, "\u23B0", "\\lmoustache", true);
defineSymbol(math, main, close, "\u27EF", "\\rgroup", true);
defineSymbol(math, main, open, "\u27EE", "\\lgroup", true);
defineSymbol(math, main, bin, "\u2213", "\\mp", true);
defineSymbol(math, main, bin, "\u2296", "\\ominus", true);
defineSymbol(math, main, bin, "\u228E", "\\uplus", true);
defineSymbol(math, main, bin, "\u2293", "\\sqcap", true);
defineSymbol(math, main, bin, "\u2217", "\\ast");
defineSymbol(math, main, bin, "\u2294", "\\sqcup", true);
defineSymbol(math, main, bin, "\u25EF", "\\bigcirc", true);
defineSymbol(math, main, bin, "\u2219", "\\bullet", true);
defineSymbol(math, main, bin, "\u2021", "\\ddagger");
defineSymbol(math, main, bin, "\u2240", "\\wr", true);
defineSymbol(math, main, bin, "\u2A3F", "\\amalg");
defineSymbol(math, main, bin, "&", "\\And");
defineSymbol(math, main, rel, "\u27F5", "\\longleftarrow", true);
defineSymbol(math, main, rel, "\u21D0", "\\Leftarrow", true);
defineSymbol(math, main, rel, "\u27F8", "\\Longleftarrow", true);
defineSymbol(math, main, rel, "\u27F6", "\\longrightarrow", true);
defineSymbol(math, main, rel, "\u21D2", "\\Rightarrow", true);
defineSymbol(math, main, rel, "\u27F9", "\\Longrightarrow", true);
defineSymbol(math, main, rel, "\u2194", "\\leftrightarrow", true);
defineSymbol(math, main, rel, "\u27F7", "\\longleftrightarrow", true);
defineSymbol(math, main, rel, "\u21D4", "\\Leftrightarrow", true);
defineSymbol(math, main, rel, "\u27FA", "\\Longleftrightarrow", true);
defineSymbol(math, main, rel, "\u21A6", "\\mapsto", true);
defineSymbol(math, main, rel, "\u27FC", "\\longmapsto", true);
defineSymbol(math, main, rel, "\u2197", "\\nearrow", true);
defineSymbol(math, main, rel, "\u21A9", "\\hookleftarrow", true);
defineSymbol(math, main, rel, "\u21AA", "\\hookrightarrow", true);
defineSymbol(math, main, rel, "\u2198", "\\searrow", true);
defineSymbol(math, main, rel, "\u21BC", "\\leftharpoonup", true);
defineSymbol(math, main, rel, "\u21C0", "\\rightharpoonup", true);
defineSymbol(math, main, rel, "\u2199", "\\swarrow", true);
defineSymbol(math, main, rel, "\u21BD", "\\leftharpoondown", true);
defineSymbol(math, main, rel, "\u21C1", "\\rightharpoondown", true);
defineSymbol(math, main, rel, "\u2196", "\\nwarrow", true);
defineSymbol(math, main, rel, "\u21CC", "\\rightleftharpoons", true);
defineSymbol(math, ams, rel, "\u226E", "\\nless", true);
defineSymbol(math, ams, rel, "\uE010", "\\@nleqslant");
defineSymbol(math, ams, rel, "\uE011", "\\@nleqq");
defineSymbol(math, ams, rel, "\u2A87", "\\lneq", true);
defineSymbol(math, ams, rel, "\u2268", "\\lneqq", true);
defineSymbol(math, ams, rel, "\uE00C", "\\@lvertneqq");
defineSymbol(math, ams, rel, "\u22E6", "\\lnsim", true);
defineSymbol(math, ams, rel, "\u2A89", "\\lnapprox", true);
defineSymbol(math, ams, rel, "\u2280", "\\nprec", true);
defineSymbol(math, ams, rel, "\u22E0", "\\npreceq", true);
defineSymbol(math, ams, rel, "\u22E8", "\\precnsim", true);
defineSymbol(math, ams, rel, "\u2AB9", "\\precnapprox", true);
defineSymbol(math, ams, rel, "\u2241", "\\nsim", true);
defineSymbol(math, ams, rel, "\uE006", "\\@nshortmid");
defineSymbol(math, ams, rel, "\u2224", "\\nmid", true);
defineSymbol(math, ams, rel, "\u22AC", "\\nvdash", true);
defineSymbol(math, ams, rel, "\u22AD", "\\nvDash", true);
defineSymbol(math, ams, rel, "\u22EA", "\\ntriangleleft");
defineSymbol(math, ams, rel, "\u22EC", "\\ntrianglelefteq", true);
defineSymbol(math, ams, rel, "\u228A", "\\subsetneq", true);
defineSymbol(math, ams, rel, "\uE01A", "\\@varsubsetneq");
defineSymbol(math, ams, rel, "\u2ACB", "\\subsetneqq", true);
defineSymbol(math, ams, rel, "\uE017", "\\@varsubsetneqq");
defineSymbol(math, ams, rel, "\u226F", "\\ngtr", true);
defineSymbol(math, ams, rel, "\uE00F", "\\@ngeqslant");
defineSymbol(math, ams, rel, "\uE00E", "\\@ngeqq");
defineSymbol(math, ams, rel, "\u2A88", "\\gneq", true);
defineSymbol(math, ams, rel, "\u2269", "\\gneqq", true);
defineSymbol(math, ams, rel, "\uE00D", "\\@gvertneqq");
defineSymbol(math, ams, rel, "\u22E7", "\\gnsim", true);
defineSymbol(math, ams, rel, "\u2A8A", "\\gnapprox", true);
defineSymbol(math, ams, rel, "\u2281", "\\nsucc", true);
defineSymbol(math, ams, rel, "\u22E1", "\\nsucceq", true);
defineSymbol(math, ams, rel, "\u22E9", "\\succnsim", true);
defineSymbol(math, ams, rel, "\u2ABA", "\\succnapprox", true);
defineSymbol(math, ams, rel, "\u2246", "\\ncong", true);
defineSymbol(math, ams, rel, "\uE007", "\\@nshortparallel");
defineSymbol(math, ams, rel, "\u2226", "\\nparallel", true);
defineSymbol(math, ams, rel, "\u22AF", "\\nVDash", true);
defineSymbol(math, ams, rel, "\u22EB", "\\ntriangleright");
defineSymbol(math, ams, rel, "\u22ED", "\\ntrianglerighteq", true);
defineSymbol(math, ams, rel, "\uE018", "\\@nsupseteqq");
defineSymbol(math, ams, rel, "\u228B", "\\supsetneq", true);
defineSymbol(math, ams, rel, "\uE01B", "\\@varsupsetneq");
defineSymbol(math, ams, rel, "\u2ACC", "\\supsetneqq", true);
defineSymbol(math, ams, rel, "\uE019", "\\@varsupsetneqq");
defineSymbol(math, ams, rel, "\u22AE", "\\nVdash", true);
defineSymbol(math, ams, rel, "\u2AB5", "\\precneqq", true);
defineSymbol(math, ams, rel, "\u2AB6", "\\succneqq", true);
defineSymbol(math, ams, rel, "\uE016", "\\@nsubseteqq");
defineSymbol(math, ams, bin, "\u22B4", "\\unlhd");
defineSymbol(math, ams, bin, "\u22B5", "\\unrhd");
defineSymbol(math, ams, rel, "\u219A", "\\nleftarrow", true);
defineSymbol(math, ams, rel, "\u219B", "\\nrightarrow", true);
defineSymbol(math, ams, rel, "\u21CD", "\\nLeftarrow", true);
defineSymbol(math, ams, rel, "\u21CF", "\\nRightarrow", true);
defineSymbol(math, ams, rel, "\u21AE", "\\nleftrightarrow", true);
defineSymbol(math, ams, rel, "\u21CE", "\\nLeftrightarrow", true);
defineSymbol(math, ams, rel, "\u25B3", "\\vartriangle");
defineSymbol(math, ams, textord, "\u210F", "\\hslash");
defineSymbol(math, ams, textord, "\u25BD", "\\triangledown");
defineSymbol(math, ams, textord, "\u25CA", "\\lozenge");
defineSymbol(math, ams, textord, "\u24C8", "\\circledS");
defineSymbol(math, ams, textord, "\xAE", "\\circledR");
defineSymbol(text, ams, textord, "\xAE", "\\circledR");
defineSymbol(math, ams, textord, "\u2221", "\\measuredangle", true);
defineSymbol(math, ams, textord, "\u2204", "\\nexists");
defineSymbol(math, ams, textord, "\u2127", "\\mho");
defineSymbol(math, ams, textord, "\u2132", "\\Finv", true);
defineSymbol(math, ams, textord, "\u2141", "\\Game", true);
defineSymbol(math, ams, textord, "\u2035", "\\backprime");
defineSymbol(math, ams, textord, "\u25B2", "\\blacktriangle");
defineSymbol(math, ams, textord, "\u25BC", "\\blacktriangledown");
defineSymbol(math, ams, textord, "\u25A0", "\\blacksquare");
defineSymbol(math, ams, textord, "\u29EB", "\\blacklozenge");
defineSymbol(math, ams, textord, "\u2605", "\\bigstar");
defineSymbol(math, ams, textord, "\u2222", "\\sphericalangle", true);
defineSymbol(math, ams, textord, "\u2201", "\\complement", true);
defineSymbol(math, ams, textord, "\xF0", "\\eth", true);
defineSymbol(text, main, textord, "\xF0", "\xF0");
defineSymbol(math, ams, textord, "\u2571", "\\diagup");
defineSymbol(math, ams, textord, "\u2572", "\\diagdown");
defineSymbol(math, ams, textord, "\u25A1", "\\square");
defineSymbol(math, ams, textord, "\u25A1", "\\Box");
defineSymbol(math, ams, textord, "\u25CA", "\\Diamond");
defineSymbol(math, ams, textord, "\xA5", "\\yen", true);
defineSymbol(text, ams, textord, "\xA5", "\\yen", true);
defineSymbol(math, ams, textord, "\u2713", "\\checkmark", true);
defineSymbol(text, ams, textord, "\u2713", "\\checkmark");
defineSymbol(math, ams, textord, "\u2136", "\\beth", true);
defineSymbol(math, ams, textord, "\u2138", "\\daleth", true);
defineSymbol(math, ams, textord, "\u2137", "\\gimel", true);
defineSymbol(math, ams, textord, "\u03DD", "\\digamma", true);
defineSymbol(math, ams, textord, "\u03F0", "\\varkappa");
defineSymbol(math, ams, open, "\u250C", "\\@ulcorner", true);
defineSymbol(math, ams, close, "\u2510", "\\@urcorner", true);
defineSymbol(math, ams, open, "\u2514", "\\@llcorner", true);
defineSymbol(math, ams, close, "\u2518", "\\@lrcorner", true);
defineSymbol(math, ams, rel, "\u2266", "\\leqq", true);
defineSymbol(math, ams, rel, "\u2A7D", "\\leqslant", true);
defineSymbol(math, ams, rel, "\u2A95", "\\eqslantless", true);
defineSymbol(math, ams, rel, "\u2272", "\\lesssim", true);
defineSymbol(math, ams, rel, "\u2A85", "\\lessapprox", true);
defineSymbol(math, ams, rel, "\u224A", "\\approxeq", true);
defineSymbol(math, ams, bin, "\u22D6", "\\lessdot");
defineSymbol(math, ams, rel, "\u22D8", "\\lll", true);
defineSymbol(math, ams, rel, "\u2276", "\\lessgtr", true);
defineSymbol(math, ams, rel, "\u22DA", "\\lesseqgtr", true);
defineSymbol(math, ams, rel, "\u2A8B", "\\lesseqqgtr", true);
defineSymbol(math, ams, rel, "\u2251", "\\doteqdot");
defineSymbol(math, ams, rel, "\u2253", "\\risingdotseq", true);
defineSymbol(math, ams, rel, "\u2252", "\\fallingdotseq", true);
defineSymbol(math, ams, rel, "\u223D", "\\backsim", true);
defineSymbol(math, ams, rel, "\u22CD", "\\backsimeq", true);
defineSymbol(math, ams, rel, "\u2AC5", "\\subseteqq", true);
defineSymbol(math, ams, rel, "\u22D0", "\\Subset", true);
defineSymbol(math, ams, rel, "\u228F", "\\sqsubset", true);
defineSymbol(math, ams, rel, "\u227C", "\\preccurlyeq", true);
defineSymbol(math, ams, rel, "\u22DE", "\\curlyeqprec", true);
defineSymbol(math, ams, rel, "\u227E", "\\precsim", true);
defineSymbol(math, ams, rel, "\u2AB7", "\\precapprox", true);
defineSymbol(math, ams, rel, "\u22B2", "\\vartriangleleft");
defineSymbol(math, ams, rel, "\u22B4", "\\trianglelefteq");
defineSymbol(math, ams, rel, "\u22A8", "\\vDash", true);
defineSymbol(math, ams, rel, "\u22AA", "\\Vvdash", true);
defineSymbol(math, ams, rel, "\u2323", "\\smallsmile");
defineSymbol(math, ams, rel, "\u2322", "\\smallfrown");
defineSymbol(math, ams, rel, "\u224F", "\\bumpeq", true);
defineSymbol(math, ams, rel, "\u224E", "\\Bumpeq", true);
defineSymbol(math, ams, rel, "\u2267", "\\geqq", true);
defineSymbol(math, ams, rel, "\u2A7E", "\\geqslant", true);
defineSymbol(math, ams, rel, "\u2A96", "\\eqslantgtr", true);
defineSymbol(math, ams, rel, "\u2273", "\\gtrsim", true);
defineSymbol(math, ams, rel, "\u2A86", "\\gtrapprox", true);
defineSymbol(math, ams, bin, "\u22D7", "\\gtrdot");
defineSymbol(math, ams, rel, "\u22D9", "\\ggg", true);
defineSymbol(math, ams, rel, "\u2277", "\\gtrless", true);
defineSymbol(math, ams, rel, "\u22DB", "\\gtreqless", true);
defineSymbol(math, ams, rel, "\u2A8C", "\\gtreqqless", true);
defineSymbol(math, ams, rel, "\u2256", "\\eqcirc", true);
defineSymbol(math, ams, rel, "\u2257", "\\circeq", true);
defineSymbol(math, ams, rel, "\u225C", "\\triangleq", true);
defineSymbol(math, ams, rel, "\u223C", "\\thicksim");
defineSymbol(math, ams, rel, "\u2248", "\\thickapprox");
defineSymbol(math, ams, rel, "\u2AC6", "\\supseteqq", true);
defineSymbol(math, ams, rel, "\u22D1", "\\Supset", true);
defineSymbol(math, ams, rel, "\u2290", "\\sqsupset", true);
defineSymbol(math, ams, rel, "\u227D", "\\succcurlyeq", true);
defineSymbol(math, ams, rel, "\u22DF", "\\curlyeqsucc", true);
defineSymbol(math, ams, rel, "\u227F", "\\succsim", true);
defineSymbol(math, ams, rel, "\u2AB8", "\\succapprox", true);
defineSymbol(math, ams, rel, "\u22B3", "\\vartriangleright");
defineSymbol(math, ams, rel, "\u22B5", "\\trianglerighteq");
defineSymbol(math, ams, rel, "\u22A9", "\\Vdash", true);
defineSymbol(math, ams, rel, "\u2223", "\\shortmid");
defineSymbol(math, ams, rel, "\u2225", "\\shortparallel");
defineSymbol(math, ams, rel, "\u226C", "\\between", true);
defineSymbol(math, ams, rel, "\u22D4", "\\pitchfork", true);
defineSymbol(math, ams, rel, "\u221D", "\\varpropto");
defineSymbol(math, ams, rel, "\u25C0", "\\blacktriangleleft");
defineSymbol(math, ams, rel, "\u2234", "\\therefore", true);
defineSymbol(math, ams, rel, "\u220D", "\\backepsilon");
defineSymbol(math, ams, rel, "\u25B6", "\\blacktriangleright");
defineSymbol(math, ams, rel, "\u2235", "\\because", true);
defineSymbol(math, ams, rel, "\u22D8", "\\llless");
defineSymbol(math, ams, rel, "\u22D9", "\\gggtr");
defineSymbol(math, ams, bin, "\u22B2", "\\lhd");
defineSymbol(math, ams, bin, "\u22B3", "\\rhd");
defineSymbol(math, ams, rel, "\u2242", "\\eqsim", true);
defineSymbol(math, main, rel, "\u22C8", "\\Join");
defineSymbol(math, ams, rel, "\u2251", "\\Doteq", true);
defineSymbol(math, ams, bin, "\u2214", "\\dotplus", true);
defineSymbol(math, ams, bin, "\u2216", "\\smallsetminus");
defineSymbol(math, ams, bin, "\u22D2", "\\Cap", true);
defineSymbol(math, ams, bin, "\u22D3", "\\Cup", true);
defineSymbol(math, ams, bin, "\u2A5E", "\\doublebarwedge", true);
defineSymbol(math, ams, bin, "\u229F", "\\boxminus", true);
defineSymbol(math, ams, bin, "\u229E", "\\boxplus", true);
defineSymbol(math, ams, bin, "\u22C7", "\\divideontimes", true);
defineSymbol(math, ams, bin, "\u22C9", "\\ltimes", true);
defineSymbol(math, ams, bin, "\u22CA", "\\rtimes", true);
defineSymbol(math, ams, bin, "\u22CB", "\\leftthreetimes", true);
defineSymbol(math, ams, bin, "\u22CC", "\\rightthreetimes", true);
defineSymbol(math, ams, bin, "\u22CF", "\\curlywedge", true);
defineSymbol(math, ams, bin, "\u22CE", "\\curlyvee", true);
defineSymbol(math, ams, bin, "\u229D", "\\circleddash", true);
defineSymbol(math, ams, bin, "\u229B", "\\circledast", true);
defineSymbol(math, ams, bin, "\u22C5", "\\centerdot");
defineSymbol(math, ams, bin, "\u22BA", "\\intercal", true);
defineSymbol(math, ams, bin, "\u22D2", "\\doublecap");
defineSymbol(math, ams, bin, "\u22D3", "\\doublecup");
defineSymbol(math, ams, bin, "\u22A0", "\\boxtimes", true);
defineSymbol(math, ams, rel, "\u21E2", "\\dashrightarrow", true);
defineSymbol(math, ams, rel, "\u21E0", "\\dashleftarrow", true);
defineSymbol(math, ams, rel, "\u21C7", "\\leftleftarrows", true);
defineSymbol(math, ams, rel, "\u21C6", "\\leftrightarrows", true);
defineSymbol(math, ams, rel, "\u21DA", "\\Lleftarrow", true);
defineSymbol(math, ams, rel, "\u219E", "\\twoheadleftarrow", true);
defineSymbol(math, ams, rel, "\u21A2", "\\leftarrowtail", true);
defineSymbol(math, ams, rel, "\u21AB", "\\looparrowleft", true);
defineSymbol(math, ams, rel, "\u21CB", "\\leftrightharpoons", true);
defineSymbol(math, ams, rel, "\u21B6", "\\curvearrowleft", true);
defineSymbol(math, ams, rel, "\u21BA", "\\circlearrowleft", true);
defineSymbol(math, ams, rel, "\u21B0", "\\Lsh", true);
defineSymbol(math, ams, rel, "\u21C8", "\\upuparrows", true);
defineSymbol(math, ams, rel, "\u21BF", "\\upharpoonleft", true);
defineSymbol(math, ams, rel, "\u21C3", "\\downharpoonleft", true);
defineSymbol(math, main, rel, "\u22B6", "\\origof", true);
defineSymbol(math, main, rel, "\u22B7", "\\imageof", true);
defineSymbol(math, ams, rel, "\u22B8", "\\multimap", true);
defineSymbol(math, ams, rel, "\u21AD", "\\leftrightsquigarrow", true);
defineSymbol(math, ams, rel, "\u21C9", "\\rightrightarrows", true);
defineSymbol(math, ams, rel, "\u21C4", "\\rightleftarrows", true);
defineSymbol(math, ams, rel, "\u21A0", "\\twoheadrightarrow", true);
defineSymbol(math, ams, rel, "\u21A3", "\\rightarrowtail", true);
defineSymbol(math, ams, rel, "\u21AC", "\\looparrowright", true);
defineSymbol(math, ams, rel, "\u21B7", "\\curvearrowright", true);
defineSymbol(math, ams, rel, "\u21BB", "\\circlearrowright", true);
defineSymbol(math, ams, rel, "\u21B1", "\\Rsh", true);
defineSymbol(math, ams, rel, "\u21CA", "\\downdownarrows", true);
defineSymbol(math, ams, rel, "\u21BE", "\\upharpoonright", true);
defineSymbol(math, ams, rel, "\u21C2", "\\downharpoonright", true);
defineSymbol(math, ams, rel, "\u21DD", "\\rightsquigarrow", true);
defineSymbol(math, ams, rel, "\u21DD", "\\leadsto");
defineSymbol(math, ams, rel, "\u21DB", "\\Rrightarrow", true);
defineSymbol(math, ams, rel, "\u21BE", "\\restriction");
defineSymbol(math, main, textord, "\u2018", "`");
defineSymbol(math, main, textord, "$", "\\$");
defineSymbol(text, main, textord, "$", "\\$");
defineSymbol(text, main, textord, "$", "\\textdollar");
defineSymbol(math, main, textord, "%", "\\%");
defineSymbol(text, main, textord, "%", "\\%");
defineSymbol(math, main, textord, "_", "\\_");
defineSymbol(text, main, textord, "_", "\\_");
defineSymbol(text, main, textord, "_", "\\textunderscore");
defineSymbol(math, main, textord, "\u2220", "\\angle", true);
defineSymbol(math, main, textord, "\u221E", "\\infty", true);
defineSymbol(math, main, textord, "\u2032", "\\prime");
defineSymbol(math, main, textord, "\u25B3", "\\triangle");
defineSymbol(math, main, textord, "\u0393", "\\Gamma", true);
defineSymbol(math, main, textord, "\u0394", "\\Delta", true);
defineSymbol(math, main, textord, "\u0398", "\\Theta", true);
defineSymbol(math, main, textord, "\u039B", "\\Lambda", true);
defineSymbol(math, main, textord, "\u039E", "\\Xi", true);
defineSymbol(math, main, textord, "\u03A0", "\\Pi", true);
defineSymbol(math, main, textord, "\u03A3", "\\Sigma", true);
defineSymbol(math, main, textord, "\u03A5", "\\Upsilon", true);
defineSymbol(math, main, textord, "\u03A6", "\\Phi", true);
defineSymbol(math, main, textord, "\u03A8", "\\Psi", true);
defineSymbol(math, main, textord, "\u03A9", "\\Omega", true);
defineSymbol(math, main, textord, "A", "\u0391");
defineSymbol(math, main, textord, "B", "\u0392");
defineSymbol(math, main, textord, "E", "\u0395");
defineSymbol(math, main, textord, "Z", "\u0396");
defineSymbol(math, main, textord, "H", "\u0397");
defineSymbol(math, main, textord, "I", "\u0399");
defineSymbol(math, main, textord, "K", "\u039A");
defineSymbol(math, main, textord, "M", "\u039C");
defineSymbol(math, main, textord, "N", "\u039D");
defineSymbol(math, main, textord, "O", "\u039F");
defineSymbol(math, main, textord, "P", "\u03A1");
defineSymbol(math, main, textord, "T", "\u03A4");
defineSymbol(math, main, textord, "X", "\u03A7");
defineSymbol(math, main, textord, "\xAC", "\\neg", true);
defineSymbol(math, main, textord, "\xAC", "\\lnot");
defineSymbol(math, main, textord, "\u22A4", "\\top");
defineSymbol(math, main, textord, "\u22A5", "\\bot");
defineSymbol(math, main, textord, "\u2205", "\\emptyset");
defineSymbol(math, ams, textord, "\u2205", "\\varnothing");
defineSymbol(math, main, mathord, "\u03B1", "\\alpha", true);
defineSymbol(math, main, mathord, "\u03B2", "\\beta", true);
defineSymbol(math, main, mathord, "\u03B3", "\\gamma", true);
defineSymbol(math, main, mathord, "\u03B4", "\\delta", true);
defineSymbol(math, main, mathord, "\u03F5", "\\epsilon", true);
defineSymbol(math, main, mathord, "\u03B6", "\\zeta", true);
defineSymbol(math, main, mathord, "\u03B7", "\\eta", true);
defineSymbol(math, main, mathord, "\u03B8", "\\theta", true);
defineSymbol(math, main, mathord, "\u03B9", "\\iota", true);
defineSymbol(math, main, mathord, "\u03BA", "\\kappa", true);
defineSymbol(math, main, mathord, "\u03BB", "\\lambda", true);
defineSymbol(math, main, mathord, "\u03BC", "\\mu", true);
defineSymbol(math, main, mathord, "\u03BD", "\\nu", true);
defineSymbol(math, main, mathord, "\u03BE", "\\xi", true);
defineSymbol(math, main, mathord, "\u03BF", "\\omicron", true);
defineSymbol(math, main, mathord, "\u03C0", "\\pi", true);
defineSymbol(math, main, mathord, "\u03C1", "\\rho", true);
defineSymbol(math, main, mathord, "\u03C3", "\\sigma", true);
defineSymbol(math, main, mathord, "\u03C4", "\\tau", true);
defineSymbol(math, main, mathord, "\u03C5", "\\upsilon", true);
defineSymbol(math, main, mathord, "\u03D5", "\\phi", true);
defineSymbol(math, main, mathord, "\u03C7", "\\chi", true);
defineSymbol(math, main, mathord, "\u03C8", "\\psi", true);
defineSymbol(math, main, mathord, "\u03C9", "\\omega", true);
defineSymbol(math, main, mathord, "\u03B5", "\\varepsilon", true);
defineSymbol(math, main, mathord, "\u03D1", "\\vartheta", true);
defineSymbol(math, main, mathord, "\u03D6", "\\varpi", true);
defineSymbol(math, main, mathord, "\u03F1", "\\varrho", true);
defineSymbol(math, main, mathord, "\u03C2", "\\varsigma", true);
defineSymbol(math, main, mathord, "\u03C6", "\\varphi", true);
defineSymbol(math, main, bin, "\u2217", "*", true);
defineSymbol(math, main, bin, "+", "+");
defineSymbol(math, main, bin, "\u2212", "-", true);
defineSymbol(math, main, bin, "\u22C5", "\\cdot", true);
defineSymbol(math, main, bin, "\u2218", "\\circ", true);
defineSymbol(math, main, bin, "\xF7", "\\div", true);
defineSymbol(math, main, bin, "\xB1", "\\pm", true);
defineSymbol(math, main, bin, "\xD7", "\\times", true);
defineSymbol(math, main, bin, "\u2229", "\\cap", true);
defineSymbol(math, main, bin, "\u222A", "\\cup", true);
defineSymbol(math, main, bin, "\u2216", "\\setminus", true);
defineSymbol(math, main, bin, "\u2227", "\\land");
defineSymbol(math, main, bin, "\u2228", "\\lor");
defineSymbol(math, main, bin, "\u2227", "\\wedge", true);
defineSymbol(math, main, bin, "\u2228", "\\vee", true);
defineSymbol(math, main, textord, "\u221A", "\\surd");
defineSymbol(math, main, open, "\u27E8", "\\langle", true);
defineSymbol(math, main, open, "\u2223", "\\lvert");
defineSymbol(math, main, open, "\u2225", "\\lVert");
defineSymbol(math, main, close, "?", "?");
defineSymbol(math, main, close, "!", "!");
defineSymbol(math, main, close, "\u27E9", "\\rangle", true);
defineSymbol(math, main, close, "\u2223", "\\rvert");
defineSymbol(math, main, close, "\u2225", "\\rVert");
defineSymbol(math, main, rel, "=", "=");
defineSymbol(math, main, rel, ":", ":");
defineSymbol(math, main, rel, "\u2248", "\\approx", true);
defineSymbol(math, main, rel, "\u2245", "\\cong", true);
defineSymbol(math, main, rel, "\u2265", "\\ge");
defineSymbol(math, main, rel, "\u2265", "\\geq", true);
defineSymbol(math, main, rel, "\u2190", "\\gets");
defineSymbol(math, main, rel, ">", "\\gt", true);
defineSymbol(math, main, rel, "\u2208", "\\in", true);
defineSymbol(math, main, rel, "\uE020", "\\@not");
defineSymbol(math, main, rel, "\u2282", "\\subset", true);
defineSymbol(math, main, rel, "\u2283", "\\supset", true);
defineSymbol(math, main, rel, "\u2286", "\\subseteq", true);
defineSymbol(math, main, rel, "\u2287", "\\supseteq", true);
defineSymbol(math, ams, rel, "\u2288", "\\nsubseteq", true);
defineSymbol(math, ams, rel, "\u2289", "\\nsupseteq", true);
defineSymbol(math, main, rel, "\u22A8", "\\models");
defineSymbol(math, main, rel, "\u2190", "\\leftarrow", true);
defineSymbol(math, main, rel, "\u2264", "\\le");
defineSymbol(math, main, rel, "\u2264", "\\leq", true);
defineSymbol(math, main, rel, "<", "\\lt", true);
defineSymbol(math, main, rel, "\u2192", "\\rightarrow", true);
defineSymbol(math, main, rel, "\u2192", "\\to");
defineSymbol(math, ams, rel, "\u2271", "\\ngeq", true);
defineSymbol(math, ams, rel, "\u2270", "\\nleq", true);
defineSymbol(math, main, spacing, "\xA0", "\\ ");
defineSymbol(math, main, spacing, "\xA0", "\\space");
defineSymbol(math, main, spacing, "\xA0", "\\nobreakspace");
defineSymbol(text, main, spacing, "\xA0", "\\ ");
defineSymbol(text, main, spacing, "\xA0", " ");
defineSymbol(text, main, spacing, "\xA0", "\\space");
defineSymbol(text, main, spacing, "\xA0", "\\nobreakspace");
defineSymbol(math, main, spacing, null, "\\nobreak");
defineSymbol(math, main, spacing, null, "\\allowbreak");
defineSymbol(math, main, punct, ",", ",");
defineSymbol(math, main, punct, ";", ";");
defineSymbol(math, ams, bin, "\u22BC", "\\barwedge", true);
defineSymbol(math, ams, bin, "\u22BB", "\\veebar", true);
defineSymbol(math, main, bin, "\u2299", "\\odot", true);
defineSymbol(math, main, bin, "\u2295", "\\oplus", true);
defineSymbol(math, main, bin, "\u2297", "\\otimes", true);
defineSymbol(math, main, textord, "\u2202", "\\partial", true);
defineSymbol(math, main, bin, "\u2298", "\\oslash", true);
defineSymbol(math, ams, bin, "\u229A", "\\circledcirc", true);
defineSymbol(math, ams, bin, "\u22A1", "\\boxdot", true);
defineSymbol(math, main, bin, "\u25B3", "\\bigtriangleup");
defineSymbol(math, main, bin, "\u25BD", "\\bigtriangledown");
defineSymbol(math, main, bin, "\u2020", "\\dagger");
defineSymbol(math, main, bin, "\u22C4", "\\diamond");
defineSymbol(math, main, bin, "\u22C6", "\\star");
defineSymbol(math, main, bin, "\u25C3", "\\triangleleft");
defineSymbol(math, main, bin, "\u25B9", "\\triangleright");
defineSymbol(math, main, open, "{", "\\{");
defineSymbol(text, main, textord, "{", "\\{");
defineSymbol(text, main, textord, "{", "\\textbraceleft");
defineSymbol(math, main, close, "}", "\\}");
defineSymbol(text, main, textord, "}", "\\}");
defineSymbol(text, main, textord, "}", "\\textbraceright");
defineSymbol(math, main, open, "{", "\\lbrace");
defineSymbol(math, main, close, "}", "\\rbrace");
defineSymbol(math, main, open, "[", "\\lbrack", true);
defineSymbol(text, main, textord, "[", "\\lbrack", true);
defineSymbol(math, main, close, "]", "\\rbrack", true);
defineSymbol(text, main, textord, "]", "\\rbrack", true);
defineSymbol(math, main, open, "(", "\\lparen", true);
defineSymbol(math, main, close, ")", "\\rparen", true);
defineSymbol(text, main, textord, "<", "\\textless", true);
defineSymbol(text, main, textord, ">", "\\textgreater", true);
defineSymbol(math, main, open, "\u230A", "\\lfloor", true);
defineSymbol(math, main, close, "\u230B", "\\rfloor", true);
defineSymbol(math, main, open, "\u2308", "\\lceil", true);
defineSymbol(math, main, close, "\u2309", "\\rceil", true);
defineSymbol(math, main, textord, "\\", "\\backslash");
defineSymbol(math, main, textord, "\u2223", "|");
defineSymbol(math, main, textord, "\u2223", "\\vert");
defineSymbol(text, main, textord, "|", "\\textbar", true);
defineSymbol(math, main, textord, "\u2225", "\\|");
defineSymbol(math, main, textord, "\u2225", "\\Vert");
defineSymbol(text, main, textord, "\u2225", "\\textbardbl");
defineSymbol(text, main, textord, "~", "\\textasciitilde");
defineSymbol(text, main, textord, "\\", "\\textbackslash");
defineSymbol(text, main, textord, "^", "\\textasciicircum");
defineSymbol(math, main, rel, "\u2191", "\\uparrow", true);
defineSymbol(math, main, rel, "\u21D1", "\\Uparrow", true);
defineSymbol(math, main, rel, "\u2193", "\\downarrow", true);
defineSymbol(math, main, rel, "\u21D3", "\\Downarrow", true);
defineSymbol(math, main, rel, "\u2195", "\\updownarrow", true);
defineSymbol(math, main, rel, "\u21D5", "\\Updownarrow", true);
defineSymbol(math, main, op, "\u2210", "\\coprod");
defineSymbol(math, main, op, "\u22C1", "\\bigvee");
defineSymbol(math, main, op, "\u22C0", "\\bigwedge");
defineSymbol(math, main, op, "\u2A04", "\\biguplus");
defineSymbol(math, main, op, "\u22C2", "\\bigcap");
defineSymbol(math, main, op, "\u22C3", "\\bigcup");
defineSymbol(math, main, op, "\u222B", "\\int");
defineSymbol(math, main, op, "\u222B", "\\intop");
defineSymbol(math, main, op, "\u222C", "\\iint");
defineSymbol(math, main, op, "\u222D", "\\iiint");
defineSymbol(math, main, op, "\u220F", "\\prod");
defineSymbol(math, main, op, "\u2211", "\\sum");
defineSymbol(math, main, op, "\u2A02", "\\bigotimes");
defineSymbol(math, main, op, "\u2A01", "\\bigoplus");
defineSymbol(math, main, op, "\u2A00", "\\bigodot");
defineSymbol(math, main, op, "\u222E", "\\oint");
defineSymbol(math, main, op, "\u222F", "\\oiint");
defineSymbol(math, main, op, "\u2230", "\\oiiint");
defineSymbol(math, main, op, "\u2A06", "\\bigsqcup");
defineSymbol(math, main, op, "\u222B", "\\smallint");
defineSymbol(text, main, inner, "\u2026", "\\textellipsis");
defineSymbol(math, main, inner, "\u2026", "\\mathellipsis");
defineSymbol(text, main, inner, "\u2026", "\\ldots", true);
defineSymbol(math, main, inner, "\u2026", "\\ldots", true);
defineSymbol(math, main, inner, "\u22EF", "\\@cdots", true);
defineSymbol(math, main, inner, "\u22F1", "\\ddots", true);
defineSymbol(math, main, textord, "\u22EE", "\\varvdots");
defineSymbol(text, main, textord, "\u22EE", "\\varvdots");
defineSymbol(math, main, accent, "\u02CA", "\\acute");
defineSymbol(math, main, accent, "\u02CB", "\\grave");
defineSymbol(math, main, accent, "\xA8", "\\ddot");
defineSymbol(math, main, accent, "~", "\\tilde");
defineSymbol(math, main, accent, "\u02C9", "\\bar");
defineSymbol(math, main, accent, "\u02D8", "\\breve");
defineSymbol(math, main, accent, "\u02C7", "\\check");
defineSymbol(math, main, accent, "^", "\\hat");
defineSymbol(math, main, accent, "\u20D7", "\\vec");
defineSymbol(math, main, accent, "\u02D9", "\\dot");
defineSymbol(math, main, accent, "\u02DA", "\\mathring");
defineSymbol(math, main, mathord, "\uE131", "\\@imath");
defineSymbol(math, main, mathord, "\uE237", "\\@jmath");
defineSymbol(math, main, textord, "\u0131", "\u0131");
defineSymbol(math, main, textord, "\u0237", "\u0237");
defineSymbol(text, main, textord, "\u0131", "\\i", true);
defineSymbol(text, main, textord, "\u0237", "\\j", true);
defineSymbol(text, main, textord, "\xDF", "\\ss", true);
defineSymbol(text, main, textord, "\xE6", "\\ae", true);
defineSymbol(text, main, textord, "\u0153", "\\oe", true);
defineSymbol(text, main, textord, "\xF8", "\\o", true);
defineSymbol(text, main, textord, "\xC6", "\\AE", true);
defineSymbol(text, main, textord, "\u0152", "\\OE", true);
defineSymbol(text, main, textord, "\xD8", "\\O", true);
defineSymbol(text, main, accent, "\u02CA", "\\'");
defineSymbol(text, main, accent, "\u02CB", "\\`");
defineSymbol(text, main, accent, "\u02C6", "\\^");
defineSymbol(text, main, accent, "\u02DC", "\\~");
defineSymbol(text, main, accent, "\u02C9", "\\=");
defineSymbol(text, main, accent, "\u02D8", "\\u");
defineSymbol(text, main, accent, "\u02D9", "\\.");
defineSymbol(text, main, accent, "\xB8", "\\c");
defineSymbol(text, main, accent, "\u02DA", "\\r");
defineSymbol(text, main, accent, "\u02C7", "\\v");
defineSymbol(text, main, accent, "\xA8", '\\"');
defineSymbol(text, main, accent, "\u02DD", "\\H");
defineSymbol(text, main, accent, "\u25EF", "\\textcircled");
var ligatures = {
  "--": true,
  "---": true,
  "``": true,
  "''": true
};
defineSymbol(text, main, textord, "\u2013", "--", true);
defineSymbol(text, main, textord, "\u2013", "\\textendash");
defineSymbol(text, main, textord, "\u2014", "---", true);
defineSymbol(text, main, textord, "\u2014", "\\textemdash");
defineSymbol(text, main, textord, "\u2018", "`", true);
defineSymbol(text, main, textord, "\u2018", "\\textquoteleft");
defineSymbol(text, main, textord, "\u2019", "'", true);
defineSymbol(text, main, textord, "\u2019", "\\textquoteright");
defineSymbol(text, main, textord, "\u201C", "``", true);
defineSymbol(text, main, textord, "\u201C", "\\textquotedblleft");
defineSymbol(text, main, textord, "\u201D", "''", true);
defineSymbol(text, main, textord, "\u201D", "\\textquotedblright");
defineSymbol(math, main, textord, "\xB0", "\\degree", true);
defineSymbol(text, main, textord, "\xB0", "\\degree");
defineSymbol(text, main, textord, "\xB0", "\\textdegree", true);
defineSymbol(math, main, textord, "\xA3", "\\pounds");
defineSymbol(math, main, textord, "\xA3", "\\mathsterling", true);
defineSymbol(text, main, textord, "\xA3", "\\pounds");
defineSymbol(text, main, textord, "\xA3", "\\textsterling", true);
defineSymbol(math, ams, textord, "\u2720", "\\maltese");
defineSymbol(text, ams, textord, "\u2720", "\\maltese");
var mathTextSymbols = '0123456789/@."';
for (i = 0; i < mathTextSymbols.length; i++) {
  ch = mathTextSymbols.charAt(i);
  defineSymbol(math, main, textord, ch, ch);
}
var ch;
var i;
var textSymbols = '0123456789!@*()-=+";:?/.,';
for (_i = 0; _i < textSymbols.length; _i++) {
  _ch = textSymbols.charAt(_i);
  defineSymbol(text, main, textord, _ch, _ch);
}
var _ch;
var _i;
var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
for (_i2 = 0; _i2 < letters.length; _i2++) {
  _ch2 = letters.charAt(_i2);
  defineSymbol(math, main, mathord, _ch2, _ch2);
  defineSymbol(text, main, textord, _ch2, _ch2);
}
var _ch2;
var _i2;
defineSymbol(math, ams, textord, "C", "\u2102");
defineSymbol(text, ams, textord, "C", "\u2102");
defineSymbol(math, ams, textord, "H", "\u210D");
defineSymbol(text, ams, textord, "H", "\u210D");
defineSymbol(math, ams, textord, "N", "\u2115");
defineSymbol(text, ams, textord, "N", "\u2115");
defineSymbol(math, ams, textord, "P", "\u2119");
defineSymbol(text, ams, textord, "P", "\u2119");
defineSymbol(math, ams, textord, "Q", "\u211A");
defineSymbol(text, ams, textord, "Q", "\u211A");
defineSymbol(math, ams, textord, "R", "\u211D");
defineSymbol(text, ams, textord, "R", "\u211D");
defineSymbol(math, ams, textord, "Z", "\u2124");
defineSymbol(text, ams, textord, "Z", "\u2124");
defineSymbol(math, main, mathord, "h", "\u210E");
defineSymbol(text, main, mathord, "h", "\u210E");
var wideChar = "";
for (_i3 = 0; _i3 < letters.length; _i3++) {
  _ch3 = letters.charAt(_i3);
  wideChar = String.fromCharCode(55349, 56320 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56372 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56424 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56580 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56684 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56736 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56788 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56840 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56944 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  if (_i3 < 26) {
    wideChar = String.fromCharCode(55349, 56632 + _i3);
    defineSymbol(math, main, mathord, _ch3, wideChar);
    defineSymbol(text, main, textord, _ch3, wideChar);
    wideChar = String.fromCharCode(55349, 56476 + _i3);
    defineSymbol(math, main, mathord, _ch3, wideChar);
    defineSymbol(text, main, textord, _ch3, wideChar);
  }
}
var _ch3;
var _i3;
wideChar = String.fromCharCode(55349, 56668);
defineSymbol(math, main, mathord, "k", wideChar);
defineSymbol(text, main, textord, "k", wideChar);
for (_i4 = 0; _i4 < 10; _i4++) {
  _ch4 = _i4.toString();
  wideChar = String.fromCharCode(55349, 57294 + _i4);
  defineSymbol(math, main, mathord, _ch4, wideChar);
  defineSymbol(text, main, textord, _ch4, wideChar);
  wideChar = String.fromCharCode(55349, 57314 + _i4);
  defineSymbol(math, main, mathord, _ch4, wideChar);
  defineSymbol(text, main, textord, _ch4, wideChar);
  wideChar = String.fromCharCode(55349, 57324 + _i4);
  defineSymbol(math, main, mathord, _ch4, wideChar);
  defineSymbol(text, main, textord, _ch4, wideChar);
  wideChar = String.fromCharCode(55349, 57334 + _i4);
  defineSymbol(math, main, mathord, _ch4, wideChar);
  defineSymbol(text, main, textord, _ch4, wideChar);
}
var _ch4;
var _i4;
var extraLatin = "\xD0\xDE\xFE";
for (_i5 = 0; _i5 < extraLatin.length; _i5++) {
  _ch5 = extraLatin.charAt(_i5);
  defineSymbol(math, main, mathord, _ch5, _ch5);
  defineSymbol(text, main, textord, _ch5, _ch5);
}
var _ch5;
var _i5;
var wideLatinLetterData = [
  ["mathbf", "textbf", "Main-Bold"],
  // A-Z bold upright
  ["mathbf", "textbf", "Main-Bold"],
  // a-z bold upright
  ["mathnormal", "textit", "Math-Italic"],
  // A-Z italic
  ["mathnormal", "textit", "Math-Italic"],
  // a-z italic
  ["boldsymbol", "boldsymbol", "Main-BoldItalic"],
  // A-Z bold italic
  ["boldsymbol", "boldsymbol", "Main-BoldItalic"],
  // a-z bold italic
  // Map fancy A-Z letters to script, not calligraphic.
  // This aligns with unicode-math and math fonts (except Cambria Math).
  ["mathscr", "textscr", "Script-Regular"],
  // A-Z script
  ["", "", ""],
  // a-z script.  No font
  ["", "", ""],
  // A-Z bold script. No font
  ["", "", ""],
  // a-z bold script. No font
  ["mathfrak", "textfrak", "Fraktur-Regular"],
  // A-Z Fraktur
  ["mathfrak", "textfrak", "Fraktur-Regular"],
  // a-z Fraktur
  ["mathbb", "textbb", "AMS-Regular"],
  // A-Z double-struck
  ["mathbb", "textbb", "AMS-Regular"],
  // k double-struck
  // Note that we are using a bold font, but font metrics for regular Fraktur.
  ["mathboldfrak", "textboldfrak", "Fraktur-Regular"],
  // A-Z bold Fraktur
  ["mathboldfrak", "textboldfrak", "Fraktur-Regular"],
  // a-z bold Fraktur
  ["mathsf", "textsf", "SansSerif-Regular"],
  // A-Z sans-serif
  ["mathsf", "textsf", "SansSerif-Regular"],
  // a-z sans-serif
  ["mathboldsf", "textboldsf", "SansSerif-Bold"],
  // A-Z bold sans-serif
  ["mathboldsf", "textboldsf", "SansSerif-Bold"],
  // a-z bold sans-serif
  ["mathitsf", "textitsf", "SansSerif-Italic"],
  // A-Z italic sans-serif
  ["mathitsf", "textitsf", "SansSerif-Italic"],
  // a-z italic sans-serif
  ["", "", ""],
  // A-Z bold italic sans. No font
  ["", "", ""],
  // a-z bold italic sans. No font
  ["mathtt", "texttt", "Typewriter-Regular"],
  // A-Z monospace
  ["mathtt", "texttt", "Typewriter-Regular"]
  // a-z monospace
];
var wideNumeralData = [
  ["mathbf", "textbf", "Main-Bold"],
  // 0-9 bold
  ["", "", ""],
  // 0-9 double-struck. No KaTeX font.
  ["mathsf", "textsf", "SansSerif-Regular"],
  // 0-9 sans-serif
  ["mathboldsf", "textboldsf", "SansSerif-Bold"],
  // 0-9 bold sans-serif
  ["mathtt", "texttt", "Typewriter-Regular"]
  // 0-9 monospace
];
var wideCharacterFont = function wideCharacterFont2(wideChar2, mode) {
  var H = wideChar2.charCodeAt(0);
  var L2 = wideChar2.charCodeAt(1);
  var codePoint = (H - 55296) * 1024 + (L2 - 56320) + 65536;
  var j2 = mode === "math" ? 0 : 1;
  if (119808 <= codePoint && codePoint < 120484) {
    var i = Math.floor((codePoint - 119808) / 26);
    return [wideLatinLetterData[i][2], wideLatinLetterData[i][j2]];
  } else if (120782 <= codePoint && codePoint <= 120831) {
    var _i = Math.floor((codePoint - 120782) / 10);
    return [wideNumeralData[_i][2], wideNumeralData[_i][j2]];
  } else if (codePoint === 120485 || codePoint === 120486) {
    return [wideLatinLetterData[0][2], wideLatinLetterData[0][j2]];
  } else if (120486 < codePoint && codePoint < 120782) {
    return ["", ""];
  } else {
    throw new ParseError("Unsupported character: " + wideChar2);
  }
};
var lookupSymbol = function lookupSymbol2(value, fontName, mode) {
  if (symbols[mode][value] && symbols[mode][value].replace) {
    value = symbols[mode][value].replace;
  }
  return {
    value,
    metrics: getCharacterMetrics(value, fontName, mode)
  };
};
var makeSymbol = function makeSymbol2(value, fontName, mode, options, classes) {
  var lookup = lookupSymbol(value, fontName, mode);
  var metrics = lookup.metrics;
  value = lookup.value;
  var symbolNode;
  if (metrics) {
    var italic = metrics.italic;
    if (mode === "text" || options && options.font === "mathit") {
      italic = 0;
    }
    symbolNode = new SymbolNode(value, metrics.height, metrics.depth, italic, metrics.skew, metrics.width, classes);
  } else {
    typeof console !== "undefined" && console.warn("No character metrics " + ("for '" + value + "' in style '" + fontName + "' and mode '" + mode + "'"));
    symbolNode = new SymbolNode(value, 0, 0, 0, 0, 0, classes);
  }
  if (options) {
    symbolNode.maxFontSize = options.sizeMultiplier;
    if (options.style.isTight()) {
      symbolNode.classes.push("mtight");
    }
    var color = options.getColor();
    if (color) {
      symbolNode.style.color = color;
    }
  }
  return symbolNode;
};
var mathsym = function mathsym2(value, mode, options, classes) {
  if (classes === void 0) {
    classes = [];
  }
  if (options.font === "boldsymbol" && lookupSymbol(value, "Main-Bold", mode).metrics) {
    return makeSymbol(value, "Main-Bold", mode, options, classes.concat(["mathbf"]));
  } else if (value === "\\" || symbols[mode][value].font === "main") {
    return makeSymbol(value, "Main-Regular", mode, options, classes);
  } else {
    return makeSymbol(value, "AMS-Regular", mode, options, classes.concat(["amsrm"]));
  }
};
var boldsymbol = function boldsymbol2(value, mode, options, classes, type) {
  if (type !== "textord" && lookupSymbol(value, "Math-BoldItalic", mode).metrics) {
    return {
      fontName: "Math-BoldItalic",
      fontClass: "boldsymbol"
    };
  } else {
    return {
      fontName: "Main-Bold",
      fontClass: "mathbf"
    };
  }
};
var makeOrd = function makeOrd2(group, options, type) {
  var mode = group.mode;
  var text2 = group.text;
  var classes = ["mord"];
  var isFont = mode === "math" || mode === "text" && options.font;
  var fontOrFamily = isFont ? options.font : options.fontFamily;
  var wideFontName = "";
  var wideFontClass = "";
  if (text2.charCodeAt(0) === 55349) {
    [wideFontName, wideFontClass] = wideCharacterFont(text2, mode);
  }
  if (wideFontName.length > 0) {
    return makeSymbol(text2, wideFontName, mode, options, classes.concat(wideFontClass));
  } else if (fontOrFamily) {
    var fontName;
    var fontClasses;
    if (fontOrFamily === "boldsymbol") {
      var fontData = boldsymbol(text2, mode, options, classes, type);
      fontName = fontData.fontName;
      fontClasses = [fontData.fontClass];
    } else if (isFont) {
      fontName = fontMap[fontOrFamily].fontName;
      fontClasses = [fontOrFamily];
    } else {
      fontName = retrieveTextFontName(fontOrFamily, options.fontWeight, options.fontShape);
      fontClasses = [fontOrFamily, options.fontWeight, options.fontShape];
    }
    if (lookupSymbol(text2, fontName, mode).metrics) {
      return makeSymbol(text2, fontName, mode, options, classes.concat(fontClasses));
    } else if (ligatures.hasOwnProperty(text2) && fontName.slice(0, 10) === "Typewriter") {
      var parts = [];
      for (var i = 0; i < text2.length; i++) {
        parts.push(makeSymbol(text2[i], fontName, mode, options, classes.concat(fontClasses)));
      }
      return makeFragment(parts);
    }
  }
  if (type === "mathord") {
    return makeSymbol(text2, "Math-Italic", mode, options, classes.concat(["mathnormal"]));
  } else if (type === "textord") {
    var font = symbols[mode][text2] && symbols[mode][text2].font;
    if (font === "ams") {
      var _fontName = retrieveTextFontName("amsrm", options.fontWeight, options.fontShape);
      return makeSymbol(text2, _fontName, mode, options, classes.concat("amsrm", options.fontWeight, options.fontShape));
    } else if (font === "main" || !font) {
      var _fontName2 = retrieveTextFontName("textrm", options.fontWeight, options.fontShape);
      return makeSymbol(text2, _fontName2, mode, options, classes.concat(options.fontWeight, options.fontShape));
    } else {
      var _fontName3 = retrieveTextFontName(font, options.fontWeight, options.fontShape);
      return makeSymbol(text2, _fontName3, mode, options, classes.concat(_fontName3, options.fontWeight, options.fontShape));
    }
  } else {
    throw new Error("unexpected type: " + type + " in makeOrd");
  }
};
var canCombine = (prev, next) => {
  if (createClass(prev.classes) !== createClass(next.classes) || prev.skew !== next.skew || prev.maxFontSize !== next.maxFontSize) {
    return false;
  }
  if (prev.classes.length === 1) {
    var cls = prev.classes[0];
    if (cls === "mbin" || cls === "mord") {
      return false;
    }
  }
  for (var style in prev.style) {
    if (prev.style.hasOwnProperty(style) && prev.style[style] !== next.style[style]) {
      return false;
    }
  }
  for (var _style in next.style) {
    if (next.style.hasOwnProperty(_style) && prev.style[_style] !== next.style[_style]) {
      return false;
    }
  }
  return true;
};
var tryCombineChars = (chars) => {
  for (var i = 0; i < chars.length - 1; i++) {
    var prev = chars[i];
    var next = chars[i + 1];
    if (prev instanceof SymbolNode && next instanceof SymbolNode && canCombine(prev, next)) {
      prev.text += next.text;
      prev.height = Math.max(prev.height, next.height);
      prev.depth = Math.max(prev.depth, next.depth);
      prev.italic = next.italic;
      chars.splice(i + 1, 1);
      i--;
    }
  }
  return chars;
};
var sizeElementFromChildren = function sizeElementFromChildren2(elem) {
  var height = 0;
  var depth = 0;
  var maxFontSize = 0;
  for (var i = 0; i < elem.children.length; i++) {
    var child = elem.children[i];
    if (child.height > height) {
      height = child.height;
    }
    if (child.depth > depth) {
      depth = child.depth;
    }
    if (child.maxFontSize > maxFontSize) {
      maxFontSize = child.maxFontSize;
    }
  }
  elem.height = height;
  elem.depth = depth;
  elem.maxFontSize = maxFontSize;
};
var makeSpan$2 = function makeSpan(classes, children, options, style) {
  var span = new Span(classes, children, options, style);
  sizeElementFromChildren(span);
  return span;
};
var makeSvgSpan = (classes, children, options, style) => new Span(classes, children, options, style);
var makeLineSpan = function makeLineSpan2(className, options, thickness) {
  var line = makeSpan$2([className], [], options);
  line.height = Math.max(thickness || options.fontMetrics().defaultRuleThickness, options.minRuleThickness);
  line.style.borderBottomWidth = makeEm(line.height);
  line.maxFontSize = 1;
  return line;
};
var makeAnchor = function makeAnchor2(href, classes, children, options) {
  var anchor = new Anchor(href, classes, children, options);
  sizeElementFromChildren(anchor);
  return anchor;
};
var makeFragment = function makeFragment2(children) {
  var fragment = new DocumentFragment(children);
  sizeElementFromChildren(fragment);
  return fragment;
};
var wrapFragment = function wrapFragment2(group, options) {
  if (group instanceof DocumentFragment) {
    return makeSpan$2([], [group], options);
  }
  return group;
};
var getVListChildrenAndDepth = function getVListChildrenAndDepth2(params) {
  if (params.positionType === "individualShift") {
    var oldChildren = params.children;
    var children = [oldChildren[0]];
    var _depth = -oldChildren[0].shift - oldChildren[0].elem.depth;
    var currPos = _depth;
    for (var i = 1; i < oldChildren.length; i++) {
      var diff = -oldChildren[i].shift - currPos - oldChildren[i].elem.depth;
      var size = diff - (oldChildren[i - 1].elem.height + oldChildren[i - 1].elem.depth);
      currPos = currPos + diff;
      children.push({
        type: "kern",
        size
      });
      children.push(oldChildren[i]);
    }
    return {
      children,
      depth: _depth
    };
  }
  var depth;
  if (params.positionType === "top") {
    var bottom = params.positionData;
    for (var _i = 0; _i < params.children.length; _i++) {
      var child = params.children[_i];
      bottom -= child.type === "kern" ? child.size : child.elem.height + child.elem.depth;
    }
    depth = bottom;
  } else if (params.positionType === "bottom") {
    depth = -params.positionData;
  } else {
    var firstChild = params.children[0];
    if (firstChild.type !== "elem") {
      throw new Error('First child must have type "elem".');
    }
    if (params.positionType === "shift") {
      depth = -firstChild.elem.depth - params.positionData;
    } else if (params.positionType === "firstBaseline") {
      depth = -firstChild.elem.depth;
    } else {
      throw new Error("Invalid positionType " + params.positionType + ".");
    }
  }
  return {
    children: params.children,
    depth
  };
};
var makeVList = function makeVList2(params, options) {
  var {
    children,
    depth
  } = getVListChildrenAndDepth(params);
  var pstrutSize = 0;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child.type === "elem") {
      var elem = child.elem;
      pstrutSize = Math.max(pstrutSize, elem.maxFontSize, elem.height);
    }
  }
  pstrutSize += 2;
  var pstrut = makeSpan$2(["pstrut"], []);
  pstrut.style.height = makeEm(pstrutSize);
  var realChildren = [];
  var minPos = depth;
  var maxPos = depth;
  var currPos = depth;
  for (var _i2 = 0; _i2 < children.length; _i2++) {
    var _child = children[_i2];
    if (_child.type === "kern") {
      currPos += _child.size;
    } else {
      var _elem = _child.elem;
      var classes = _child.wrapperClasses || [];
      var style = _child.wrapperStyle || {};
      var childWrap = makeSpan$2(classes, [pstrut, _elem], void 0, style);
      childWrap.style.top = makeEm(-pstrutSize - currPos - _elem.depth);
      if (_child.marginLeft) {
        childWrap.style.marginLeft = _child.marginLeft;
      }
      if (_child.marginRight) {
        childWrap.style.marginRight = _child.marginRight;
      }
      realChildren.push(childWrap);
      currPos += _elem.height + _elem.depth;
    }
    minPos = Math.min(minPos, currPos);
    maxPos = Math.max(maxPos, currPos);
  }
  var vlist = makeSpan$2(["vlist"], realChildren);
  vlist.style.height = makeEm(maxPos);
  var rows;
  if (minPos < 0) {
    var emptySpan = makeSpan$2([], []);
    var depthStrut = makeSpan$2(["vlist"], [emptySpan]);
    depthStrut.style.height = makeEm(-minPos);
    var topStrut = makeSpan$2(["vlist-s"], [new SymbolNode("\u200B")]);
    rows = [makeSpan$2(["vlist-r"], [vlist, topStrut]), makeSpan$2(["vlist-r"], [depthStrut])];
  } else {
    rows = [makeSpan$2(["vlist-r"], [vlist])];
  }
  var vtable = makeSpan$2(["vlist-t"], rows);
  if (rows.length === 2) {
    vtable.classes.push("vlist-t2");
  }
  vtable.height = maxPos;
  vtable.depth = -minPos;
  return vtable;
};
var makeGlue = (measurement, options) => {
  var rule = makeSpan$2(["mspace"], [], options);
  var size = calculateSize(measurement, options);
  rule.style.marginRight = makeEm(size);
  return rule;
};
var retrieveTextFontName = function retrieveTextFontName2(fontFamily, fontWeight, fontShape) {
  var baseFontName = "";
  switch (fontFamily) {
    case "amsrm":
      baseFontName = "AMS";
      break;
    case "textrm":
      baseFontName = "Main";
      break;
    case "textsf":
      baseFontName = "SansSerif";
      break;
    case "texttt":
      baseFontName = "Typewriter";
      break;
    default:
      baseFontName = fontFamily;
  }
  var fontStylesName;
  if (fontWeight === "textbf" && fontShape === "textit") {
    fontStylesName = "BoldItalic";
  } else if (fontWeight === "textbf") {
    fontStylesName = "Bold";
  } else if (fontWeight === "textit") {
    fontStylesName = "Italic";
  } else {
    fontStylesName = "Regular";
  }
  return baseFontName + "-" + fontStylesName;
};
var fontMap = {
  // styles
  "mathbf": {
    variant: "bold",
    fontName: "Main-Bold"
  },
  "mathrm": {
    variant: "normal",
    fontName: "Main-Regular"
  },
  "textit": {
    variant: "italic",
    fontName: "Main-Italic"
  },
  "mathit": {
    variant: "italic",
    fontName: "Main-Italic"
  },
  "mathnormal": {
    variant: "italic",
    fontName: "Math-Italic"
  },
  "mathsfit": {
    variant: "sans-serif-italic",
    fontName: "SansSerif-Italic"
  },
  // "boldsymbol" is missing because they require the use of multiple fonts:
  // Math-BoldItalic and Main-Bold.  This is handled by a special case in
  // makeOrd which ends up calling boldsymbol.
  // families
  "mathbb": {
    variant: "double-struck",
    fontName: "AMS-Regular"
  },
  "mathcal": {
    variant: "script",
    fontName: "Caligraphic-Regular"
  },
  "mathfrak": {
    variant: "fraktur",
    fontName: "Fraktur-Regular"
  },
  "mathscr": {
    variant: "script",
    fontName: "Script-Regular"
  },
  "mathsf": {
    variant: "sans-serif",
    fontName: "SansSerif-Regular"
  },
  "mathtt": {
    variant: "monospace",
    fontName: "Typewriter-Regular"
  }
};
var svgData = {
  //   path, width, height
  vec: ["vec", 0.471, 0.714],
  // values from the font glyph
  oiintSize1: ["oiintSize1", 0.957, 0.499],
  // oval to overlay the integrand
  oiintSize2: ["oiintSize2", 1.472, 0.659],
  oiiintSize1: ["oiiintSize1", 1.304, 0.499],
  oiiintSize2: ["oiiintSize2", 1.98, 0.659]
};
var staticSvg = function staticSvg2(value, options) {
  var [pathName, width, height] = svgData[value];
  var path3 = new PathNode(pathName);
  var svgNode = new SvgNode([path3], {
    "width": makeEm(width),
    "height": makeEm(height),
    // Override CSS rule `.katex svg { width: 100% }`
    "style": "width:" + makeEm(width),
    "viewBox": "0 0 " + 1e3 * width + " " + 1e3 * height,
    "preserveAspectRatio": "xMinYMin"
  });
  var span = makeSvgSpan(["overlay"], [svgNode], options);
  span.height = height;
  span.style.height = makeEm(height);
  span.style.width = makeEm(width);
  return span;
};
var buildCommon = {
  fontMap,
  makeSymbol,
  mathsym,
  makeSpan: makeSpan$2,
  makeSvgSpan,
  makeLineSpan,
  makeAnchor,
  makeFragment,
  wrapFragment,
  makeVList,
  makeOrd,
  makeGlue,
  staticSvg,
  svgData,
  tryCombineChars
};
var thinspace = {
  number: 3,
  unit: "mu"
};
var mediumspace = {
  number: 4,
  unit: "mu"
};
var thickspace = {
  number: 5,
  unit: "mu"
};
var spacings = {
  mord: {
    mop: thinspace,
    mbin: mediumspace,
    mrel: thickspace,
    minner: thinspace
  },
  mop: {
    mord: thinspace,
    mop: thinspace,
    mrel: thickspace,
    minner: thinspace
  },
  mbin: {
    mord: mediumspace,
    mop: mediumspace,
    mopen: mediumspace,
    minner: mediumspace
  },
  mrel: {
    mord: thickspace,
    mop: thickspace,
    mopen: thickspace,
    minner: thickspace
  },
  mopen: {},
  mclose: {
    mop: thinspace,
    mbin: mediumspace,
    mrel: thickspace,
    minner: thinspace
  },
  mpunct: {
    mord: thinspace,
    mop: thinspace,
    mrel: thickspace,
    mopen: thinspace,
    mclose: thinspace,
    mpunct: thinspace,
    minner: thinspace
  },
  minner: {
    mord: thinspace,
    mop: thinspace,
    mbin: mediumspace,
    mrel: thickspace,
    mopen: thinspace,
    mpunct: thinspace,
    minner: thinspace
  }
};
var tightSpacings = {
  mord: {
    mop: thinspace
  },
  mop: {
    mord: thinspace,
    mop: thinspace
  },
  mbin: {},
  mrel: {},
  mopen: {},
  mclose: {
    mop: thinspace
  },
  mpunct: {},
  minner: {
    mop: thinspace
  }
};
var _functions = {};
var _htmlGroupBuilders = {};
var _mathmlGroupBuilders = {};
function defineFunction(_ref) {
  var {
    type,
    names,
    props,
    handler,
    htmlBuilder: htmlBuilder3,
    mathmlBuilder: mathmlBuilder3
  } = _ref;
  var data = {
    type,
    numArgs: props.numArgs,
    argTypes: props.argTypes,
    allowedInArgument: !!props.allowedInArgument,
    allowedInText: !!props.allowedInText,
    allowedInMath: props.allowedInMath === void 0 ? true : props.allowedInMath,
    numOptionalArgs: props.numOptionalArgs || 0,
    infix: !!props.infix,
    primitive: !!props.primitive,
    handler
  };
  for (var i = 0; i < names.length; ++i) {
    _functions[names[i]] = data;
  }
  if (type) {
    if (htmlBuilder3) {
      _htmlGroupBuilders[type] = htmlBuilder3;
    }
    if (mathmlBuilder3) {
      _mathmlGroupBuilders[type] = mathmlBuilder3;
    }
  }
}
function defineFunctionBuilders(_ref2) {
  var {
    type,
    htmlBuilder: htmlBuilder3,
    mathmlBuilder: mathmlBuilder3
  } = _ref2;
  defineFunction({
    type,
    names: [],
    props: {
      numArgs: 0
    },
    handler() {
      throw new Error("Should never be called.");
    },
    htmlBuilder: htmlBuilder3,
    mathmlBuilder: mathmlBuilder3
  });
}
var normalizeArgument = function normalizeArgument2(arg) {
  return arg.type === "ordgroup" && arg.body.length === 1 ? arg.body[0] : arg;
};
var ordargument = function ordargument2(arg) {
  return arg.type === "ordgroup" ? arg.body : [arg];
};
var makeSpan$1 = buildCommon.makeSpan;
var binLeftCanceller = ["leftmost", "mbin", "mopen", "mrel", "mop", "mpunct"];
var binRightCanceller = ["rightmost", "mrel", "mclose", "mpunct"];
var styleMap$1 = {
  "display": Style$1.DISPLAY,
  "text": Style$1.TEXT,
  "script": Style$1.SCRIPT,
  "scriptscript": Style$1.SCRIPTSCRIPT
};
var DomEnum = {
  mord: "mord",
  mop: "mop",
  mbin: "mbin",
  mrel: "mrel",
  mopen: "mopen",
  mclose: "mclose",
  mpunct: "mpunct",
  minner: "minner"
};
var buildExpression$1 = function buildExpression(expression, options, isRealGroup, surrounding) {
  if (surrounding === void 0) {
    surrounding = [null, null];
  }
  var groups = [];
  for (var i = 0; i < expression.length; i++) {
    var output = buildGroup$1(expression[i], options);
    if (output instanceof DocumentFragment) {
      var children = output.children;
      groups.push(...children);
    } else {
      groups.push(output);
    }
  }
  buildCommon.tryCombineChars(groups);
  if (!isRealGroup) {
    return groups;
  }
  var glueOptions = options;
  if (expression.length === 1) {
    var node = expression[0];
    if (node.type === "sizing") {
      glueOptions = options.havingSize(node.size);
    } else if (node.type === "styling") {
      glueOptions = options.havingStyle(styleMap$1[node.style]);
    }
  }
  var dummyPrev = makeSpan$1([surrounding[0] || "leftmost"], [], options);
  var dummyNext = makeSpan$1([surrounding[1] || "rightmost"], [], options);
  var isRoot = isRealGroup === "root";
  traverseNonSpaceNodes(groups, (node2, prev) => {
    var prevType = prev.classes[0];
    var type = node2.classes[0];
    if (prevType === "mbin" && utils.contains(binRightCanceller, type)) {
      prev.classes[0] = "mord";
    } else if (type === "mbin" && utils.contains(binLeftCanceller, prevType)) {
      node2.classes[0] = "mord";
    }
  }, {
    node: dummyPrev
  }, dummyNext, isRoot);
  traverseNonSpaceNodes(groups, (node2, prev) => {
    var prevType = getTypeOfDomTree(prev);
    var type = getTypeOfDomTree(node2);
    var space = prevType && type ? node2.hasClass("mtight") ? tightSpacings[prevType][type] : spacings[prevType][type] : null;
    if (space) {
      return buildCommon.makeGlue(space, glueOptions);
    }
  }, {
    node: dummyPrev
  }, dummyNext, isRoot);
  return groups;
};
var traverseNonSpaceNodes = function traverseNonSpaceNodes2(nodes, callback, prev, next, isRoot) {
  if (next) {
    nodes.push(next);
  }
  var i = 0;
  for (; i < nodes.length; i++) {
    var node = nodes[i];
    var partialGroup = checkPartialGroup(node);
    if (partialGroup) {
      traverseNonSpaceNodes2(partialGroup.children, callback, prev, null, isRoot);
      continue;
    }
    var nonspace = !node.hasClass("mspace");
    if (nonspace) {
      var result = callback(node, prev.node);
      if (result) {
        if (prev.insertAfter) {
          prev.insertAfter(result);
        } else {
          nodes.unshift(result);
          i++;
        }
      }
    }
    if (nonspace) {
      prev.node = node;
    } else if (isRoot && node.hasClass("newline")) {
      prev.node = makeSpan$1(["leftmost"]);
    }
    prev.insertAfter = /* @__PURE__ */ ((index) => (n) => {
      nodes.splice(index + 1, 0, n);
      i++;
    })(i);
  }
  if (next) {
    nodes.pop();
  }
};
var checkPartialGroup = function checkPartialGroup2(node) {
  if (node instanceof DocumentFragment || node instanceof Anchor || node instanceof Span && node.hasClass("enclosing")) {
    return node;
  }
  return null;
};
var getOutermostNode = function getOutermostNode2(node, side) {
  var partialGroup = checkPartialGroup(node);
  if (partialGroup) {
    var children = partialGroup.children;
    if (children.length) {
      if (side === "right") {
        return getOutermostNode2(children[children.length - 1], "right");
      } else if (side === "left") {
        return getOutermostNode2(children[0], "left");
      }
    }
  }
  return node;
};
var getTypeOfDomTree = function getTypeOfDomTree2(node, side) {
  if (!node) {
    return null;
  }
  if (side) {
    node = getOutermostNode(node, side);
  }
  return DomEnum[node.classes[0]] || null;
};
var makeNullDelimiter = function makeNullDelimiter2(options, classes) {
  var moreClasses = ["nulldelimiter"].concat(options.baseSizingClasses());
  return makeSpan$1(classes.concat(moreClasses));
};
var buildGroup$1 = function buildGroup(group, options, baseOptions) {
  if (!group) {
    return makeSpan$1();
  }
  if (_htmlGroupBuilders[group.type]) {
    var groupNode = _htmlGroupBuilders[group.type](group, options);
    if (baseOptions && options.size !== baseOptions.size) {
      groupNode = makeSpan$1(options.sizingClasses(baseOptions), [groupNode], options);
      var multiplier = options.sizeMultiplier / baseOptions.sizeMultiplier;
      groupNode.height *= multiplier;
      groupNode.depth *= multiplier;
    }
    return groupNode;
  } else {
    throw new ParseError("Got group of unknown type: '" + group.type + "'");
  }
};
function buildHTMLUnbreakable(children, options) {
  var body = makeSpan$1(["base"], children, options);
  var strut = makeSpan$1(["strut"]);
  strut.style.height = makeEm(body.height + body.depth);
  if (body.depth) {
    strut.style.verticalAlign = makeEm(-body.depth);
  }
  body.children.unshift(strut);
  return body;
}
function buildHTML(tree, options) {
  var tag = null;
  if (tree.length === 1 && tree[0].type === "tag") {
    tag = tree[0].tag;
    tree = tree[0].body;
  }
  var expression = buildExpression$1(tree, options, "root");
  var eqnNum;
  if (expression.length === 2 && expression[1].hasClass("tag")) {
    eqnNum = expression.pop();
  }
  var children = [];
  var parts = [];
  for (var i = 0; i < expression.length; i++) {
    parts.push(expression[i]);
    if (expression[i].hasClass("mbin") || expression[i].hasClass("mrel") || expression[i].hasClass("allowbreak")) {
      var nobreak = false;
      while (i < expression.length - 1 && expression[i + 1].hasClass("mspace") && !expression[i + 1].hasClass("newline")) {
        i++;
        parts.push(expression[i]);
        if (expression[i].hasClass("nobreak")) {
          nobreak = true;
        }
      }
      if (!nobreak) {
        children.push(buildHTMLUnbreakable(parts, options));
        parts = [];
      }
    } else if (expression[i].hasClass("newline")) {
      parts.pop();
      if (parts.length > 0) {
        children.push(buildHTMLUnbreakable(parts, options));
        parts = [];
      }
      children.push(expression[i]);
    }
  }
  if (parts.length > 0) {
    children.push(buildHTMLUnbreakable(parts, options));
  }
  var tagChild;
  if (tag) {
    tagChild = buildHTMLUnbreakable(buildExpression$1(tag, options, true));
    tagChild.classes = ["tag"];
    children.push(tagChild);
  } else if (eqnNum) {
    children.push(eqnNum);
  }
  var htmlNode = makeSpan$1(["katex-html"], children);
  htmlNode.setAttribute("aria-hidden", "true");
  if (tagChild) {
    var strut = tagChild.children[0];
    strut.style.height = makeEm(htmlNode.height + htmlNode.depth);
    if (htmlNode.depth) {
      strut.style.verticalAlign = makeEm(-htmlNode.depth);
    }
  }
  return htmlNode;
}
function newDocumentFragment(children) {
  return new DocumentFragment(children);
}
var MathNode = class {
  constructor(type, children, classes) {
    this.type = void 0;
    this.attributes = void 0;
    this.children = void 0;
    this.classes = void 0;
    this.type = type;
    this.attributes = {};
    this.children = children || [];
    this.classes = classes || [];
  }
  /**
   * Sets an attribute on a MathML node. MathML depends on attributes to convey a
   * semantic content, so this is used heavily.
   */
  setAttribute(name2, value) {
    this.attributes[name2] = value;
  }
  /**
   * Gets an attribute on a MathML node.
   */
  getAttribute(name2) {
    return this.attributes[name2];
  }
  /**
   * Converts the math node into a MathML-namespaced DOM element.
   */
  toNode() {
    var node = document.createElementNS("http://www.w3.org/1998/Math/MathML", this.type);
    for (var attr in this.attributes) {
      if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
        node.setAttribute(attr, this.attributes[attr]);
      }
    }
    if (this.classes.length > 0) {
      node.className = createClass(this.classes);
    }
    for (var i = 0; i < this.children.length; i++) {
      if (this.children[i] instanceof TextNode && this.children[i + 1] instanceof TextNode) {
        var text2 = this.children[i].toText() + this.children[++i].toText();
        while (this.children[i + 1] instanceof TextNode) {
          text2 += this.children[++i].toText();
        }
        node.appendChild(new TextNode(text2).toNode());
      } else {
        node.appendChild(this.children[i].toNode());
      }
    }
    return node;
  }
  /**
   * Converts the math node into an HTML markup string.
   */
  toMarkup() {
    var markup = "<" + this.type;
    for (var attr in this.attributes) {
      if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
        markup += " " + attr + '="';
        markup += utils.escape(this.attributes[attr]);
        markup += '"';
      }
    }
    if (this.classes.length > 0) {
      markup += ' class ="' + utils.escape(createClass(this.classes)) + '"';
    }
    markup += ">";
    for (var i = 0; i < this.children.length; i++) {
      markup += this.children[i].toMarkup();
    }
    markup += "</" + this.type + ">";
    return markup;
  }
  /**
   * Converts the math node into a string, similar to innerText, but escaped.
   */
  toText() {
    return this.children.map((child) => child.toText()).join("");
  }
};
var TextNode = class {
  constructor(text2) {
    this.text = void 0;
    this.text = text2;
  }
  /**
   * Converts the text node into a DOM text node.
   */
  toNode() {
    return document.createTextNode(this.text);
  }
  /**
   * Converts the text node into escaped HTML markup
   * (representing the text itself).
   */
  toMarkup() {
    return utils.escape(this.toText());
  }
  /**
   * Converts the text node into a string
   * (representing the text itself).
   */
  toText() {
    return this.text;
  }
};
var SpaceNode = class {
  /**
   * Create a Space node with width given in CSS ems.
   */
  constructor(width) {
    this.width = void 0;
    this.character = void 0;
    this.width = width;
    if (width >= 0.05555 && width <= 0.05556) {
      this.character = "\u200A";
    } else if (width >= 0.1666 && width <= 0.1667) {
      this.character = "\u2009";
    } else if (width >= 0.2222 && width <= 0.2223) {
      this.character = "\u2005";
    } else if (width >= 0.2777 && width <= 0.2778) {
      this.character = "\u2005\u200A";
    } else if (width >= -0.05556 && width <= -0.05555) {
      this.character = "\u200A\u2063";
    } else if (width >= -0.1667 && width <= -0.1666) {
      this.character = "\u2009\u2063";
    } else if (width >= -0.2223 && width <= -0.2222) {
      this.character = "\u205F\u2063";
    } else if (width >= -0.2778 && width <= -0.2777) {
      this.character = "\u2005\u2063";
    } else {
      this.character = null;
    }
  }
  /**
   * Converts the math node into a MathML-namespaced DOM element.
   */
  toNode() {
    if (this.character) {
      return document.createTextNode(this.character);
    } else {
      var node = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mspace");
      node.setAttribute("width", makeEm(this.width));
      return node;
    }
  }
  /**
   * Converts the math node into an HTML markup string.
   */
  toMarkup() {
    if (this.character) {
      return "<mtext>" + this.character + "</mtext>";
    } else {
      return '<mspace width="' + makeEm(this.width) + '"/>';
    }
  }
  /**
   * Converts the math node into a string, similar to innerText.
   */
  toText() {
    if (this.character) {
      return this.character;
    } else {
      return " ";
    }
  }
};
var mathMLTree = {
  MathNode,
  TextNode,
  SpaceNode,
  newDocumentFragment
};
var makeText = function makeText2(text2, mode, options) {
  if (symbols[mode][text2] && symbols[mode][text2].replace && text2.charCodeAt(0) !== 55349 && !(ligatures.hasOwnProperty(text2) && options && (options.fontFamily && options.fontFamily.slice(4, 6) === "tt" || options.font && options.font.slice(4, 6) === "tt"))) {
    text2 = symbols[mode][text2].replace;
  }
  return new mathMLTree.TextNode(text2);
};
var makeRow = function makeRow2(body) {
  if (body.length === 1) {
    return body[0];
  } else {
    return new mathMLTree.MathNode("mrow", body);
  }
};
var getVariant = function getVariant2(group, options) {
  if (options.fontFamily === "texttt") {
    return "monospace";
  } else if (options.fontFamily === "textsf") {
    if (options.fontShape === "textit" && options.fontWeight === "textbf") {
      return "sans-serif-bold-italic";
    } else if (options.fontShape === "textit") {
      return "sans-serif-italic";
    } else if (options.fontWeight === "textbf") {
      return "bold-sans-serif";
    } else {
      return "sans-serif";
    }
  } else if (options.fontShape === "textit" && options.fontWeight === "textbf") {
    return "bold-italic";
  } else if (options.fontShape === "textit") {
    return "italic";
  } else if (options.fontWeight === "textbf") {
    return "bold";
  }
  var font = options.font;
  if (!font || font === "mathnormal") {
    return null;
  }
  var mode = group.mode;
  if (font === "mathit") {
    return "italic";
  } else if (font === "boldsymbol") {
    return group.type === "textord" ? "bold" : "bold-italic";
  } else if (font === "mathbf") {
    return "bold";
  } else if (font === "mathbb") {
    return "double-struck";
  } else if (font === "mathsfit") {
    return "sans-serif-italic";
  } else if (font === "mathfrak") {
    return "fraktur";
  } else if (font === "mathscr" || font === "mathcal") {
    return "script";
  } else if (font === "mathsf") {
    return "sans-serif";
  } else if (font === "mathtt") {
    return "monospace";
  }
  var text2 = group.text;
  if (utils.contains(["\\imath", "\\jmath"], text2)) {
    return null;
  }
  if (symbols[mode][text2] && symbols[mode][text2].replace) {
    text2 = symbols[mode][text2].replace;
  }
  var fontName = buildCommon.fontMap[font].fontName;
  if (getCharacterMetrics(text2, fontName, mode)) {
    return buildCommon.fontMap[font].variant;
  }
  return null;
};
function isNumberPunctuation(group) {
  if (!group) {
    return false;
  }
  if (group.type === "mi" && group.children.length === 1) {
    var child = group.children[0];
    return child instanceof TextNode && child.text === ".";
  } else if (group.type === "mo" && group.children.length === 1 && group.getAttribute("separator") === "true" && group.getAttribute("lspace") === "0em" && group.getAttribute("rspace") === "0em") {
    var _child = group.children[0];
    return _child instanceof TextNode && _child.text === ",";
  } else {
    return false;
  }
}
var buildExpression2 = function buildExpression3(expression, options, isOrdgroup) {
  if (expression.length === 1) {
    var group = buildGroup2(expression[0], options);
    if (isOrdgroup && group instanceof MathNode && group.type === "mo") {
      group.setAttribute("lspace", "0em");
      group.setAttribute("rspace", "0em");
    }
    return [group];
  }
  var groups = [];
  var lastGroup;
  for (var i = 0; i < expression.length; i++) {
    var _group = buildGroup2(expression[i], options);
    if (_group instanceof MathNode && lastGroup instanceof MathNode) {
      if (_group.type === "mtext" && lastGroup.type === "mtext" && _group.getAttribute("mathvariant") === lastGroup.getAttribute("mathvariant")) {
        lastGroup.children.push(..._group.children);
        continue;
      } else if (_group.type === "mn" && lastGroup.type === "mn") {
        lastGroup.children.push(..._group.children);
        continue;
      } else if (isNumberPunctuation(_group) && lastGroup.type === "mn") {
        lastGroup.children.push(..._group.children);
        continue;
      } else if (_group.type === "mn" && isNumberPunctuation(lastGroup)) {
        _group.children = [...lastGroup.children, ..._group.children];
        groups.pop();
      } else if ((_group.type === "msup" || _group.type === "msub") && _group.children.length >= 1 && (lastGroup.type === "mn" || isNumberPunctuation(lastGroup))) {
        var base = _group.children[0];
        if (base instanceof MathNode && base.type === "mn") {
          base.children = [...lastGroup.children, ...base.children];
          groups.pop();
        }
      } else if (lastGroup.type === "mi" && lastGroup.children.length === 1) {
        var lastChild = lastGroup.children[0];
        if (lastChild instanceof TextNode && lastChild.text === "\u0338" && (_group.type === "mo" || _group.type === "mi" || _group.type === "mn")) {
          var child = _group.children[0];
          if (child instanceof TextNode && child.text.length > 0) {
            child.text = child.text.slice(0, 1) + "\u0338" + child.text.slice(1);
            groups.pop();
          }
        }
      }
    }
    groups.push(_group);
    lastGroup = _group;
  }
  return groups;
};
var buildExpressionRow = function buildExpressionRow2(expression, options, isOrdgroup) {
  return makeRow(buildExpression2(expression, options, isOrdgroup));
};
var buildGroup2 = function buildGroup3(group, options) {
  if (!group) {
    return new mathMLTree.MathNode("mrow");
  }
  if (_mathmlGroupBuilders[group.type]) {
    var result = _mathmlGroupBuilders[group.type](group, options);
    return result;
  } else {
    throw new ParseError("Got group of unknown type: '" + group.type + "'");
  }
};
function buildMathML(tree, texExpression, options, isDisplayMode, forMathmlOnly) {
  var expression = buildExpression2(tree, options);
  var wrapper;
  if (expression.length === 1 && expression[0] instanceof MathNode && utils.contains(["mrow", "mtable"], expression[0].type)) {
    wrapper = expression[0];
  } else {
    wrapper = new mathMLTree.MathNode("mrow", expression);
  }
  var annotation = new mathMLTree.MathNode("annotation", [new mathMLTree.TextNode(texExpression)]);
  annotation.setAttribute("encoding", "application/x-tex");
  var semantics = new mathMLTree.MathNode("semantics", [wrapper, annotation]);
  var math2 = new mathMLTree.MathNode("math", [semantics]);
  math2.setAttribute("xmlns", "http://www.w3.org/1998/Math/MathML");
  if (isDisplayMode) {
    math2.setAttribute("display", "block");
  }
  var wrapperClass = forMathmlOnly ? "katex" : "katex-mathml";
  return buildCommon.makeSpan([wrapperClass], [math2]);
}
var optionsFromSettings = function optionsFromSettings2(settings) {
  return new Options({
    style: settings.displayMode ? Style$1.DISPLAY : Style$1.TEXT,
    maxSize: settings.maxSize,
    minRuleThickness: settings.minRuleThickness
  });
};
var displayWrap = function displayWrap2(node, settings) {
  if (settings.displayMode) {
    var classes = ["katex-display"];
    if (settings.leqno) {
      classes.push("leqno");
    }
    if (settings.fleqn) {
      classes.push("fleqn");
    }
    node = buildCommon.makeSpan(classes, [node]);
  }
  return node;
};
var buildTree = function buildTree2(tree, expression, settings) {
  var options = optionsFromSettings(settings);
  var katexNode;
  if (settings.output === "mathml") {
    return buildMathML(tree, expression, options, settings.displayMode, true);
  } else if (settings.output === "html") {
    var htmlNode = buildHTML(tree, options);
    katexNode = buildCommon.makeSpan(["katex"], [htmlNode]);
  } else {
    var mathMLNode = buildMathML(tree, expression, options, settings.displayMode, false);
    var _htmlNode = buildHTML(tree, options);
    katexNode = buildCommon.makeSpan(["katex"], [mathMLNode, _htmlNode]);
  }
  return displayWrap(katexNode, settings);
};
var buildHTMLTree = function buildHTMLTree2(tree, expression, settings) {
  var options = optionsFromSettings(settings);
  var htmlNode = buildHTML(tree, options);
  var katexNode = buildCommon.makeSpan(["katex"], [htmlNode]);
  return displayWrap(katexNode, settings);
};
var stretchyCodePoint = {
  widehat: "^",
  widecheck: "\u02C7",
  widetilde: "~",
  utilde: "~",
  overleftarrow: "\u2190",
  underleftarrow: "\u2190",
  xleftarrow: "\u2190",
  overrightarrow: "\u2192",
  underrightarrow: "\u2192",
  xrightarrow: "\u2192",
  underbrace: "\u23DF",
  overbrace: "\u23DE",
  overgroup: "\u23E0",
  undergroup: "\u23E1",
  overleftrightarrow: "\u2194",
  underleftrightarrow: "\u2194",
  xleftrightarrow: "\u2194",
  Overrightarrow: "\u21D2",
  xRightarrow: "\u21D2",
  overleftharpoon: "\u21BC",
  xleftharpoonup: "\u21BC",
  overrightharpoon: "\u21C0",
  xrightharpoonup: "\u21C0",
  xLeftarrow: "\u21D0",
  xLeftrightarrow: "\u21D4",
  xhookleftarrow: "\u21A9",
  xhookrightarrow: "\u21AA",
  xmapsto: "\u21A6",
  xrightharpoondown: "\u21C1",
  xleftharpoondown: "\u21BD",
  xrightleftharpoons: "\u21CC",
  xleftrightharpoons: "\u21CB",
  xtwoheadleftarrow: "\u219E",
  xtwoheadrightarrow: "\u21A0",
  xlongequal: "=",
  xtofrom: "\u21C4",
  xrightleftarrows: "\u21C4",
  xrightequilibrium: "\u21CC",
  // Not a perfect match.
  xleftequilibrium: "\u21CB",
  // None better available.
  "\\cdrightarrow": "\u2192",
  "\\cdleftarrow": "\u2190",
  "\\cdlongequal": "="
};
var mathMLnode = function mathMLnode2(label) {
  var node = new mathMLTree.MathNode("mo", [new mathMLTree.TextNode(stretchyCodePoint[label.replace(/^\\/, "")])]);
  node.setAttribute("stretchy", "true");
  return node;
};
var katexImagesData = {
  //   path(s), minWidth, height, align
  overrightarrow: [["rightarrow"], 0.888, 522, "xMaxYMin"],
  overleftarrow: [["leftarrow"], 0.888, 522, "xMinYMin"],
  underrightarrow: [["rightarrow"], 0.888, 522, "xMaxYMin"],
  underleftarrow: [["leftarrow"], 0.888, 522, "xMinYMin"],
  xrightarrow: [["rightarrow"], 1.469, 522, "xMaxYMin"],
  "\\cdrightarrow": [["rightarrow"], 3, 522, "xMaxYMin"],
  // CD minwwidth2.5pc
  xleftarrow: [["leftarrow"], 1.469, 522, "xMinYMin"],
  "\\cdleftarrow": [["leftarrow"], 3, 522, "xMinYMin"],
  Overrightarrow: [["doublerightarrow"], 0.888, 560, "xMaxYMin"],
  xRightarrow: [["doublerightarrow"], 1.526, 560, "xMaxYMin"],
  xLeftarrow: [["doubleleftarrow"], 1.526, 560, "xMinYMin"],
  overleftharpoon: [["leftharpoon"], 0.888, 522, "xMinYMin"],
  xleftharpoonup: [["leftharpoon"], 0.888, 522, "xMinYMin"],
  xleftharpoondown: [["leftharpoondown"], 0.888, 522, "xMinYMin"],
  overrightharpoon: [["rightharpoon"], 0.888, 522, "xMaxYMin"],
  xrightharpoonup: [["rightharpoon"], 0.888, 522, "xMaxYMin"],
  xrightharpoondown: [["rightharpoondown"], 0.888, 522, "xMaxYMin"],
  xlongequal: [["longequal"], 0.888, 334, "xMinYMin"],
  "\\cdlongequal": [["longequal"], 3, 334, "xMinYMin"],
  xtwoheadleftarrow: [["twoheadleftarrow"], 0.888, 334, "xMinYMin"],
  xtwoheadrightarrow: [["twoheadrightarrow"], 0.888, 334, "xMaxYMin"],
  overleftrightarrow: [["leftarrow", "rightarrow"], 0.888, 522],
  overbrace: [["leftbrace", "midbrace", "rightbrace"], 1.6, 548],
  underbrace: [["leftbraceunder", "midbraceunder", "rightbraceunder"], 1.6, 548],
  underleftrightarrow: [["leftarrow", "rightarrow"], 0.888, 522],
  xleftrightarrow: [["leftarrow", "rightarrow"], 1.75, 522],
  xLeftrightarrow: [["doubleleftarrow", "doublerightarrow"], 1.75, 560],
  xrightleftharpoons: [["leftharpoondownplus", "rightharpoonplus"], 1.75, 716],
  xleftrightharpoons: [["leftharpoonplus", "rightharpoondownplus"], 1.75, 716],
  xhookleftarrow: [["leftarrow", "righthook"], 1.08, 522],
  xhookrightarrow: [["lefthook", "rightarrow"], 1.08, 522],
  overlinesegment: [["leftlinesegment", "rightlinesegment"], 0.888, 522],
  underlinesegment: [["leftlinesegment", "rightlinesegment"], 0.888, 522],
  overgroup: [["leftgroup", "rightgroup"], 0.888, 342],
  undergroup: [["leftgroupunder", "rightgroupunder"], 0.888, 342],
  xmapsto: [["leftmapsto", "rightarrow"], 1.5, 522],
  xtofrom: [["leftToFrom", "rightToFrom"], 1.75, 528],
  // The next three arrows are from the mhchem package.
  // In mhchem.sty, min-length is 2.0em. But these arrows might appear in the
  // document as \xrightarrow or \xrightleftharpoons. Those have
  // min-length = 1.75em, so we set min-length on these next three to match.
  xrightleftarrows: [["baraboveleftarrow", "rightarrowabovebar"], 1.75, 901],
  xrightequilibrium: [["baraboveshortleftharpoon", "rightharpoonaboveshortbar"], 1.75, 716],
  xleftequilibrium: [["shortbaraboveleftharpoon", "shortrightharpoonabovebar"], 1.75, 716]
};
var groupLength = function groupLength2(arg) {
  if (arg.type === "ordgroup") {
    return arg.body.length;
  } else {
    return 1;
  }
};
var svgSpan = function svgSpan2(group, options) {
  function buildSvgSpan_() {
    var viewBoxWidth = 4e5;
    var label = group.label.slice(1);
    if (utils.contains(["widehat", "widecheck", "widetilde", "utilde"], label)) {
      var grp = group;
      var numChars = groupLength(grp.base);
      var viewBoxHeight;
      var pathName;
      var _height;
      if (numChars > 5) {
        if (label === "widehat" || label === "widecheck") {
          viewBoxHeight = 420;
          viewBoxWidth = 2364;
          _height = 0.42;
          pathName = label + "4";
        } else {
          viewBoxHeight = 312;
          viewBoxWidth = 2340;
          _height = 0.34;
          pathName = "tilde4";
        }
      } else {
        var imgIndex = [1, 1, 2, 2, 3, 3][numChars];
        if (label === "widehat" || label === "widecheck") {
          viewBoxWidth = [0, 1062, 2364, 2364, 2364][imgIndex];
          viewBoxHeight = [0, 239, 300, 360, 420][imgIndex];
          _height = [0, 0.24, 0.3, 0.3, 0.36, 0.42][imgIndex];
          pathName = label + imgIndex;
        } else {
          viewBoxWidth = [0, 600, 1033, 2339, 2340][imgIndex];
          viewBoxHeight = [0, 260, 286, 306, 312][imgIndex];
          _height = [0, 0.26, 0.286, 0.3, 0.306, 0.34][imgIndex];
          pathName = "tilde" + imgIndex;
        }
      }
      var path3 = new PathNode(pathName);
      var svgNode = new SvgNode([path3], {
        "width": "100%",
        "height": makeEm(_height),
        "viewBox": "0 0 " + viewBoxWidth + " " + viewBoxHeight,
        "preserveAspectRatio": "none"
      });
      return {
        span: buildCommon.makeSvgSpan([], [svgNode], options),
        minWidth: 0,
        height: _height
      };
    } else {
      var spans = [];
      var data = katexImagesData[label];
      var [paths, _minWidth, _viewBoxHeight] = data;
      var _height2 = _viewBoxHeight / 1e3;
      var numSvgChildren = paths.length;
      var widthClasses;
      var aligns;
      if (numSvgChildren === 1) {
        var align1 = data[3];
        widthClasses = ["hide-tail"];
        aligns = [align1];
      } else if (numSvgChildren === 2) {
        widthClasses = ["halfarrow-left", "halfarrow-right"];
        aligns = ["xMinYMin", "xMaxYMin"];
      } else if (numSvgChildren === 3) {
        widthClasses = ["brace-left", "brace-center", "brace-right"];
        aligns = ["xMinYMin", "xMidYMin", "xMaxYMin"];
      } else {
        throw new Error("Correct katexImagesData or update code here to support\n                    " + numSvgChildren + " children.");
      }
      for (var i = 0; i < numSvgChildren; i++) {
        var _path = new PathNode(paths[i]);
        var _svgNode = new SvgNode([_path], {
          "width": "400em",
          "height": makeEm(_height2),
          "viewBox": "0 0 " + viewBoxWidth + " " + _viewBoxHeight,
          "preserveAspectRatio": aligns[i] + " slice"
        });
        var _span = buildCommon.makeSvgSpan([widthClasses[i]], [_svgNode], options);
        if (numSvgChildren === 1) {
          return {
            span: _span,
            minWidth: _minWidth,
            height: _height2
          };
        } else {
          _span.style.height = makeEm(_height2);
          spans.push(_span);
        }
      }
      return {
        span: buildCommon.makeSpan(["stretchy"], spans, options),
        minWidth: _minWidth,
        height: _height2
      };
    }
  }
  var {
    span,
    minWidth,
    height
  } = buildSvgSpan_();
  span.height = height;
  span.style.height = makeEm(height);
  if (minWidth > 0) {
    span.style.minWidth = makeEm(minWidth);
  }
  return span;
};
var encloseSpan = function encloseSpan2(inner2, label, topPad, bottomPad, options) {
  var img;
  var totalHeight = inner2.height + inner2.depth + topPad + bottomPad;
  if (/fbox|color|angl/.test(label)) {
    img = buildCommon.makeSpan(["stretchy", label], [], options);
    if (label === "fbox") {
      var color = options.color && options.getColor();
      if (color) {
        img.style.borderColor = color;
      }
    }
  } else {
    var lines = [];
    if (/^[bx]cancel$/.test(label)) {
      lines.push(new LineNode({
        "x1": "0",
        "y1": "0",
        "x2": "100%",
        "y2": "100%",
        "stroke-width": "0.046em"
      }));
    }
    if (/^x?cancel$/.test(label)) {
      lines.push(new LineNode({
        "x1": "0",
        "y1": "100%",
        "x2": "100%",
        "y2": "0",
        "stroke-width": "0.046em"
      }));
    }
    var svgNode = new SvgNode(lines, {
      "width": "100%",
      "height": makeEm(totalHeight)
    });
    img = buildCommon.makeSvgSpan([], [svgNode], options);
  }
  img.height = totalHeight;
  img.style.height = makeEm(totalHeight);
  return img;
};
var stretchy = {
  encloseSpan,
  mathMLnode,
  svgSpan
};
function assertNodeType(node, type) {
  if (!node || node.type !== type) {
    throw new Error("Expected node of type " + type + ", but got " + (node ? "node of type " + node.type : String(node)));
  }
  return node;
}
function assertSymbolNodeType(node) {
  var typedNode = checkSymbolNodeType(node);
  if (!typedNode) {
    throw new Error("Expected node of symbol group type, but got " + (node ? "node of type " + node.type : String(node)));
  }
  return typedNode;
}
function checkSymbolNodeType(node) {
  if (node && (node.type === "atom" || NON_ATOMS.hasOwnProperty(node.type))) {
    return node;
  }
  return null;
}
var htmlBuilder$a = (grp, options) => {
  var base;
  var group;
  var supSubGroup;
  if (grp && grp.type === "supsub") {
    group = assertNodeType(grp.base, "accent");
    base = group.base;
    grp.base = base;
    supSubGroup = assertSpan(buildGroup$1(grp, options));
    grp.base = group;
  } else {
    group = assertNodeType(grp, "accent");
    base = group.base;
  }
  var body = buildGroup$1(base, options.havingCrampedStyle());
  var mustShift = group.isShifty && utils.isCharacterBox(base);
  var skew = 0;
  if (mustShift) {
    var baseChar = utils.getBaseElem(base);
    var baseGroup = buildGroup$1(baseChar, options.havingCrampedStyle());
    skew = assertSymbolDomNode(baseGroup).skew;
  }
  var accentBelow = group.label === "\\c";
  var clearance = accentBelow ? body.height + body.depth : Math.min(body.height, options.fontMetrics().xHeight);
  var accentBody;
  if (!group.isStretchy) {
    var accent2;
    var width;
    if (group.label === "\\vec") {
      accent2 = buildCommon.staticSvg("vec", options);
      width = buildCommon.svgData.vec[1];
    } else {
      accent2 = buildCommon.makeOrd({
        mode: group.mode,
        text: group.label
      }, options, "textord");
      accent2 = assertSymbolDomNode(accent2);
      accent2.italic = 0;
      width = accent2.width;
      if (accentBelow) {
        clearance += accent2.depth;
      }
    }
    accentBody = buildCommon.makeSpan(["accent-body"], [accent2]);
    var accentFull = group.label === "\\textcircled";
    if (accentFull) {
      accentBody.classes.push("accent-full");
      clearance = body.height;
    }
    var left = skew;
    if (!accentFull) {
      left -= width / 2;
    }
    accentBody.style.left = makeEm(left);
    if (group.label === "\\textcircled") {
      accentBody.style.top = ".2em";
    }
    accentBody = buildCommon.makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: body
      }, {
        type: "kern",
        size: -clearance
      }, {
        type: "elem",
        elem: accentBody
      }]
    }, options);
  } else {
    accentBody = stretchy.svgSpan(group, options);
    accentBody = buildCommon.makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: body
      }, {
        type: "elem",
        elem: accentBody,
        wrapperClasses: ["svg-align"],
        wrapperStyle: skew > 0 ? {
          width: "calc(100% - " + makeEm(2 * skew) + ")",
          marginLeft: makeEm(2 * skew)
        } : void 0
      }]
    }, options);
  }
  var accentWrap = buildCommon.makeSpan(["mord", "accent"], [accentBody], options);
  if (supSubGroup) {
    supSubGroup.children[0] = accentWrap;
    supSubGroup.height = Math.max(accentWrap.height, supSubGroup.height);
    supSubGroup.classes[0] = "mord";
    return supSubGroup;
  } else {
    return accentWrap;
  }
};
var mathmlBuilder$9 = (group, options) => {
  var accentNode = group.isStretchy ? stretchy.mathMLnode(group.label) : new mathMLTree.MathNode("mo", [makeText(group.label, group.mode)]);
  var node = new mathMLTree.MathNode("mover", [buildGroup2(group.base, options), accentNode]);
  node.setAttribute("accent", "true");
  return node;
};
var NON_STRETCHY_ACCENT_REGEX = new RegExp(["\\acute", "\\grave", "\\ddot", "\\tilde", "\\bar", "\\breve", "\\check", "\\hat", "\\vec", "\\dot", "\\mathring"].map((accent2) => "\\" + accent2).join("|"));
defineFunction({
  type: "accent",
  names: ["\\acute", "\\grave", "\\ddot", "\\tilde", "\\bar", "\\breve", "\\check", "\\hat", "\\vec", "\\dot", "\\mathring", "\\widecheck", "\\widehat", "\\widetilde", "\\overrightarrow", "\\overleftarrow", "\\Overrightarrow", "\\overleftrightarrow", "\\overgroup", "\\overlinesegment", "\\overleftharpoon", "\\overrightharpoon"],
  props: {
    numArgs: 1
  },
  handler: (context, args) => {
    var base = normalizeArgument(args[0]);
    var isStretchy = !NON_STRETCHY_ACCENT_REGEX.test(context.funcName);
    var isShifty = !isStretchy || context.funcName === "\\widehat" || context.funcName === "\\widetilde" || context.funcName === "\\widecheck";
    return {
      type: "accent",
      mode: context.parser.mode,
      label: context.funcName,
      isStretchy,
      isShifty,
      base
    };
  },
  htmlBuilder: htmlBuilder$a,
  mathmlBuilder: mathmlBuilder$9
});
defineFunction({
  type: "accent",
  names: ["\\'", "\\`", "\\^", "\\~", "\\=", "\\u", "\\.", '\\"', "\\c", "\\r", "\\H", "\\v", "\\textcircled"],
  props: {
    numArgs: 1,
    allowedInText: true,
    allowedInMath: true,
    // unless in strict mode
    argTypes: ["primitive"]
  },
  handler: (context, args) => {
    var base = args[0];
    var mode = context.parser.mode;
    if (mode === "math") {
      context.parser.settings.reportNonstrict("mathVsTextAccents", "LaTeX's accent " + context.funcName + " works only in text mode");
      mode = "text";
    }
    return {
      type: "accent",
      mode,
      label: context.funcName,
      isStretchy: false,
      isShifty: true,
      base
    };
  },
  htmlBuilder: htmlBuilder$a,
  mathmlBuilder: mathmlBuilder$9
});
defineFunction({
  type: "accentUnder",
  names: ["\\underleftarrow", "\\underrightarrow", "\\underleftrightarrow", "\\undergroup", "\\underlinesegment", "\\utilde"],
  props: {
    numArgs: 1
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var base = args[0];
    return {
      type: "accentUnder",
      mode: parser.mode,
      label: funcName,
      base
    };
  },
  htmlBuilder: (group, options) => {
    var innerGroup = buildGroup$1(group.base, options);
    var accentBody = stretchy.svgSpan(group, options);
    var kern = group.label === "\\utilde" ? 0.12 : 0;
    var vlist = buildCommon.makeVList({
      positionType: "top",
      positionData: innerGroup.height,
      children: [{
        type: "elem",
        elem: accentBody,
        wrapperClasses: ["svg-align"]
      }, {
        type: "kern",
        size: kern
      }, {
        type: "elem",
        elem: innerGroup
      }]
    }, options);
    return buildCommon.makeSpan(["mord", "accentunder"], [vlist], options);
  },
  mathmlBuilder: (group, options) => {
    var accentNode = stretchy.mathMLnode(group.label);
    var node = new mathMLTree.MathNode("munder", [buildGroup2(group.base, options), accentNode]);
    node.setAttribute("accentunder", "true");
    return node;
  }
});
var paddedNode = (group) => {
  var node = new mathMLTree.MathNode("mpadded", group ? [group] : []);
  node.setAttribute("width", "+0.6em");
  node.setAttribute("lspace", "0.3em");
  return node;
};
defineFunction({
  type: "xArrow",
  names: [
    "\\xleftarrow",
    "\\xrightarrow",
    "\\xLeftarrow",
    "\\xRightarrow",
    "\\xleftrightarrow",
    "\\xLeftrightarrow",
    "\\xhookleftarrow",
    "\\xhookrightarrow",
    "\\xmapsto",
    "\\xrightharpoondown",
    "\\xrightharpoonup",
    "\\xleftharpoondown",
    "\\xleftharpoonup",
    "\\xrightleftharpoons",
    "\\xleftrightharpoons",
    "\\xlongequal",
    "\\xtwoheadrightarrow",
    "\\xtwoheadleftarrow",
    "\\xtofrom",
    // The next 3 functions are here to support the mhchem extension.
    // Direct use of these functions is discouraged and may break someday.
    "\\xrightleftarrows",
    "\\xrightequilibrium",
    "\\xleftequilibrium",
    // The next 3 functions are here only to support the {CD} environment.
    "\\\\cdrightarrow",
    "\\\\cdleftarrow",
    "\\\\cdlongequal"
  ],
  props: {
    numArgs: 1,
    numOptionalArgs: 1
  },
  handler(_ref, args, optArgs) {
    var {
      parser,
      funcName
    } = _ref;
    return {
      type: "xArrow",
      mode: parser.mode,
      label: funcName,
      body: args[0],
      below: optArgs[0]
    };
  },
  // Flow is unable to correctly infer the type of `group`, even though it's
  // unambiguously determined from the passed-in `type` above.
  htmlBuilder(group, options) {
    var style = options.style;
    var newOptions = options.havingStyle(style.sup());
    var upperGroup = buildCommon.wrapFragment(buildGroup$1(group.body, newOptions, options), options);
    var arrowPrefix = group.label.slice(0, 2) === "\\x" ? "x" : "cd";
    upperGroup.classes.push(arrowPrefix + "-arrow-pad");
    var lowerGroup;
    if (group.below) {
      newOptions = options.havingStyle(style.sub());
      lowerGroup = buildCommon.wrapFragment(buildGroup$1(group.below, newOptions, options), options);
      lowerGroup.classes.push(arrowPrefix + "-arrow-pad");
    }
    var arrowBody = stretchy.svgSpan(group, options);
    var arrowShift = -options.fontMetrics().axisHeight + 0.5 * arrowBody.height;
    var upperShift = -options.fontMetrics().axisHeight - 0.5 * arrowBody.height - 0.111;
    if (upperGroup.depth > 0.25 || group.label === "\\xleftequilibrium") {
      upperShift -= upperGroup.depth;
    }
    var vlist;
    if (lowerGroup) {
      var lowerShift = -options.fontMetrics().axisHeight + lowerGroup.height + 0.5 * arrowBody.height + 0.111;
      vlist = buildCommon.makeVList({
        positionType: "individualShift",
        children: [{
          type: "elem",
          elem: upperGroup,
          shift: upperShift
        }, {
          type: "elem",
          elem: arrowBody,
          shift: arrowShift
        }, {
          type: "elem",
          elem: lowerGroup,
          shift: lowerShift
        }]
      }, options);
    } else {
      vlist = buildCommon.makeVList({
        positionType: "individualShift",
        children: [{
          type: "elem",
          elem: upperGroup,
          shift: upperShift
        }, {
          type: "elem",
          elem: arrowBody,
          shift: arrowShift
        }]
      }, options);
    }
    vlist.children[0].children[0].children[1].classes.push("svg-align");
    return buildCommon.makeSpan(["mrel", "x-arrow"], [vlist], options);
  },
  mathmlBuilder(group, options) {
    var arrowNode = stretchy.mathMLnode(group.label);
    arrowNode.setAttribute("minsize", group.label.charAt(0) === "x" ? "1.75em" : "3.0em");
    var node;
    if (group.body) {
      var upperNode = paddedNode(buildGroup2(group.body, options));
      if (group.below) {
        var lowerNode = paddedNode(buildGroup2(group.below, options));
        node = new mathMLTree.MathNode("munderover", [arrowNode, lowerNode, upperNode]);
      } else {
        node = new mathMLTree.MathNode("mover", [arrowNode, upperNode]);
      }
    } else if (group.below) {
      var _lowerNode = paddedNode(buildGroup2(group.below, options));
      node = new mathMLTree.MathNode("munder", [arrowNode, _lowerNode]);
    } else {
      node = paddedNode();
      node = new mathMLTree.MathNode("mover", [arrowNode, node]);
    }
    return node;
  }
});
var makeSpan2 = buildCommon.makeSpan;
function htmlBuilder$9(group, options) {
  var elements = buildExpression$1(group.body, options, true);
  return makeSpan2([group.mclass], elements, options);
}
function mathmlBuilder$8(group, options) {
  var node;
  var inner2 = buildExpression2(group.body, options);
  if (group.mclass === "minner") {
    node = new mathMLTree.MathNode("mpadded", inner2);
  } else if (group.mclass === "mord") {
    if (group.isCharacterBox) {
      node = inner2[0];
      node.type = "mi";
    } else {
      node = new mathMLTree.MathNode("mi", inner2);
    }
  } else {
    if (group.isCharacterBox) {
      node = inner2[0];
      node.type = "mo";
    } else {
      node = new mathMLTree.MathNode("mo", inner2);
    }
    if (group.mclass === "mbin") {
      node.attributes.lspace = "0.22em";
      node.attributes.rspace = "0.22em";
    } else if (group.mclass === "mpunct") {
      node.attributes.lspace = "0em";
      node.attributes.rspace = "0.17em";
    } else if (group.mclass === "mopen" || group.mclass === "mclose") {
      node.attributes.lspace = "0em";
      node.attributes.rspace = "0em";
    } else if (group.mclass === "minner") {
      node.attributes.lspace = "0.0556em";
      node.attributes.width = "+0.1111em";
    }
  }
  return node;
}
defineFunction({
  type: "mclass",
  names: ["\\mathord", "\\mathbin", "\\mathrel", "\\mathopen", "\\mathclose", "\\mathpunct", "\\mathinner"],
  props: {
    numArgs: 1,
    primitive: true
  },
  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    var body = args[0];
    return {
      type: "mclass",
      mode: parser.mode,
      mclass: "m" + funcName.slice(5),
      // TODO(kevinb): don't prefix with 'm'
      body: ordargument(body),
      isCharacterBox: utils.isCharacterBox(body)
    };
  },
  htmlBuilder: htmlBuilder$9,
  mathmlBuilder: mathmlBuilder$8
});
var binrelClass = (arg) => {
  var atom = arg.type === "ordgroup" && arg.body.length ? arg.body[0] : arg;
  if (atom.type === "atom" && (atom.family === "bin" || atom.family === "rel")) {
    return "m" + atom.family;
  } else {
    return "mord";
  }
};
defineFunction({
  type: "mclass",
  names: ["\\@binrel"],
  props: {
    numArgs: 2
  },
  handler(_ref2, args) {
    var {
      parser
    } = _ref2;
    return {
      type: "mclass",
      mode: parser.mode,
      mclass: binrelClass(args[0]),
      body: ordargument(args[1]),
      isCharacterBox: utils.isCharacterBox(args[1])
    };
  }
});
defineFunction({
  type: "mclass",
  names: ["\\stackrel", "\\overset", "\\underset"],
  props: {
    numArgs: 2
  },
  handler(_ref3, args) {
    var {
      parser,
      funcName
    } = _ref3;
    var baseArg = args[1];
    var shiftedArg = args[0];
    var mclass;
    if (funcName !== "\\stackrel") {
      mclass = binrelClass(baseArg);
    } else {
      mclass = "mrel";
    }
    var baseOp = {
      type: "op",
      mode: baseArg.mode,
      limits: true,
      alwaysHandleSupSub: true,
      parentIsSupSub: false,
      symbol: false,
      suppressBaseShift: funcName !== "\\stackrel",
      body: ordargument(baseArg)
    };
    var supsub = {
      type: "supsub",
      mode: shiftedArg.mode,
      base: baseOp,
      sup: funcName === "\\underset" ? null : shiftedArg,
      sub: funcName === "\\underset" ? shiftedArg : null
    };
    return {
      type: "mclass",
      mode: parser.mode,
      mclass,
      body: [supsub],
      isCharacterBox: utils.isCharacterBox(supsub)
    };
  },
  htmlBuilder: htmlBuilder$9,
  mathmlBuilder: mathmlBuilder$8
});
defineFunction({
  type: "pmb",
  names: ["\\pmb"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    return {
      type: "pmb",
      mode: parser.mode,
      mclass: binrelClass(args[0]),
      body: ordargument(args[0])
    };
  },
  htmlBuilder(group, options) {
    var elements = buildExpression$1(group.body, options, true);
    var node = buildCommon.makeSpan([group.mclass], elements, options);
    node.style.textShadow = "0.02em 0.01em 0.04px";
    return node;
  },
  mathmlBuilder(group, style) {
    var inner2 = buildExpression2(group.body, style);
    var node = new mathMLTree.MathNode("mstyle", inner2);
    node.setAttribute("style", "text-shadow: 0.02em 0.01em 0.04px");
    return node;
  }
});
var cdArrowFunctionName = {
  ">": "\\\\cdrightarrow",
  "<": "\\\\cdleftarrow",
  "=": "\\\\cdlongequal",
  "A": "\\uparrow",
  "V": "\\downarrow",
  "|": "\\Vert",
  ".": "no arrow"
};
var newCell = () => {
  return {
    type: "styling",
    body: [],
    mode: "math",
    style: "display"
  };
};
var isStartOfArrow = (node) => {
  return node.type === "textord" && node.text === "@";
};
var isLabelEnd = (node, endChar) => {
  return (node.type === "mathord" || node.type === "atom") && node.text === endChar;
};
function cdArrow(arrowChar, labels, parser) {
  var funcName = cdArrowFunctionName[arrowChar];
  switch (funcName) {
    case "\\\\cdrightarrow":
    case "\\\\cdleftarrow":
      return parser.callFunction(funcName, [labels[0]], [labels[1]]);
    case "\\uparrow":
    case "\\downarrow": {
      var leftLabel = parser.callFunction("\\\\cdleft", [labels[0]], []);
      var bareArrow = {
        type: "atom",
        text: funcName,
        mode: "math",
        family: "rel"
      };
      var sizedArrow = parser.callFunction("\\Big", [bareArrow], []);
      var rightLabel = parser.callFunction("\\\\cdright", [labels[1]], []);
      var arrowGroup = {
        type: "ordgroup",
        mode: "math",
        body: [leftLabel, sizedArrow, rightLabel]
      };
      return parser.callFunction("\\\\cdparent", [arrowGroup], []);
    }
    case "\\\\cdlongequal":
      return parser.callFunction("\\\\cdlongequal", [], []);
    case "\\Vert": {
      var arrow = {
        type: "textord",
        text: "\\Vert",
        mode: "math"
      };
      return parser.callFunction("\\Big", [arrow], []);
    }
    default:
      return {
        type: "textord",
        text: " ",
        mode: "math"
      };
  }
}
function parseCD(parser) {
  var parsedRows = [];
  parser.gullet.beginGroup();
  parser.gullet.macros.set("\\cr", "\\\\\\relax");
  parser.gullet.beginGroup();
  while (true) {
    parsedRows.push(parser.parseExpression(false, "\\\\"));
    parser.gullet.endGroup();
    parser.gullet.beginGroup();
    var next = parser.fetch().text;
    if (next === "&" || next === "\\\\") {
      parser.consume();
    } else if (next === "\\end") {
      if (parsedRows[parsedRows.length - 1].length === 0) {
        parsedRows.pop();
      }
      break;
    } else {
      throw new ParseError("Expected \\\\ or \\cr or \\end", parser.nextToken);
    }
  }
  var row = [];
  var body = [row];
  for (var i = 0; i < parsedRows.length; i++) {
    var rowNodes = parsedRows[i];
    var cell = newCell();
    for (var j2 = 0; j2 < rowNodes.length; j2++) {
      if (!isStartOfArrow(rowNodes[j2])) {
        cell.body.push(rowNodes[j2]);
      } else {
        row.push(cell);
        j2 += 1;
        var arrowChar = assertSymbolNodeType(rowNodes[j2]).text;
        var labels = new Array(2);
        labels[0] = {
          type: "ordgroup",
          mode: "math",
          body: []
        };
        labels[1] = {
          type: "ordgroup",
          mode: "math",
          body: []
        };
        if ("=|.".indexOf(arrowChar) > -1) ;
        else if ("<>AV".indexOf(arrowChar) > -1) {
          for (var labelNum = 0; labelNum < 2; labelNum++) {
            var inLabel = true;
            for (var k = j2 + 1; k < rowNodes.length; k++) {
              if (isLabelEnd(rowNodes[k], arrowChar)) {
                inLabel = false;
                j2 = k;
                break;
              }
              if (isStartOfArrow(rowNodes[k])) {
                throw new ParseError("Missing a " + arrowChar + " character to complete a CD arrow.", rowNodes[k]);
              }
              labels[labelNum].body.push(rowNodes[k]);
            }
            if (inLabel) {
              throw new ParseError("Missing a " + arrowChar + " character to complete a CD arrow.", rowNodes[j2]);
            }
          }
        } else {
          throw new ParseError('Expected one of "<>AV=|." after @', rowNodes[j2]);
        }
        var arrow = cdArrow(arrowChar, labels, parser);
        var wrappedArrow = {
          type: "styling",
          body: [arrow],
          mode: "math",
          style: "display"
          // CD is always displaystyle.
        };
        row.push(wrappedArrow);
        cell = newCell();
      }
    }
    if (i % 2 === 0) {
      row.push(cell);
    } else {
      row.shift();
    }
    row = [];
    body.push(row);
  }
  parser.gullet.endGroup();
  parser.gullet.endGroup();
  var cols = new Array(body[0].length).fill({
    type: "align",
    align: "c",
    pregap: 0.25,
    // CD package sets \enskip between columns.
    postgap: 0.25
    // So pre and post each get half an \enskip, i.e. 0.25em.
  });
  return {
    type: "array",
    mode: "math",
    body,
    arraystretch: 1,
    addJot: true,
    rowGaps: [null],
    cols,
    colSeparationType: "CD",
    hLinesBeforeRow: new Array(body.length + 1).fill([])
  };
}
defineFunction({
  type: "cdlabel",
  names: ["\\\\cdleft", "\\\\cdright"],
  props: {
    numArgs: 1
  },
  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    return {
      type: "cdlabel",
      mode: parser.mode,
      side: funcName.slice(4),
      label: args[0]
    };
  },
  htmlBuilder(group, options) {
    var newOptions = options.havingStyle(options.style.sup());
    var label = buildCommon.wrapFragment(buildGroup$1(group.label, newOptions, options), options);
    label.classes.push("cd-label-" + group.side);
    label.style.bottom = makeEm(0.8 - label.depth);
    label.height = 0;
    label.depth = 0;
    return label;
  },
  mathmlBuilder(group, options) {
    var label = new mathMLTree.MathNode("mrow", [buildGroup2(group.label, options)]);
    label = new mathMLTree.MathNode("mpadded", [label]);
    label.setAttribute("width", "0");
    if (group.side === "left") {
      label.setAttribute("lspace", "-1width");
    }
    label.setAttribute("voffset", "0.7em");
    label = new mathMLTree.MathNode("mstyle", [label]);
    label.setAttribute("displaystyle", "false");
    label.setAttribute("scriptlevel", "1");
    return label;
  }
});
defineFunction({
  type: "cdlabelparent",
  names: ["\\\\cdparent"],
  props: {
    numArgs: 1
  },
  handler(_ref2, args) {
    var {
      parser
    } = _ref2;
    return {
      type: "cdlabelparent",
      mode: parser.mode,
      fragment: args[0]
    };
  },
  htmlBuilder(group, options) {
    var parent = buildCommon.wrapFragment(buildGroup$1(group.fragment, options), options);
    parent.classes.push("cd-vert-arrow");
    return parent;
  },
  mathmlBuilder(group, options) {
    return new mathMLTree.MathNode("mrow", [buildGroup2(group.fragment, options)]);
  }
});
defineFunction({
  type: "textord",
  names: ["\\@char"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    var arg = assertNodeType(args[0], "ordgroup");
    var group = arg.body;
    var number = "";
    for (var i = 0; i < group.length; i++) {
      var node = assertNodeType(group[i], "textord");
      number += node.text;
    }
    var code = parseInt(number);
    var text2;
    if (isNaN(code)) {
      throw new ParseError("\\@char has non-numeric argument " + number);
    } else if (code < 0 || code >= 1114111) {
      throw new ParseError("\\@char with invalid code point " + number);
    } else if (code <= 65535) {
      text2 = String.fromCharCode(code);
    } else {
      code -= 65536;
      text2 = String.fromCharCode((code >> 10) + 55296, (code & 1023) + 56320);
    }
    return {
      type: "textord",
      mode: parser.mode,
      text: text2
    };
  }
});
var htmlBuilder$8 = (group, options) => {
  var elements = buildExpression$1(group.body, options.withColor(group.color), false);
  return buildCommon.makeFragment(elements);
};
var mathmlBuilder$7 = (group, options) => {
  var inner2 = buildExpression2(group.body, options.withColor(group.color));
  var node = new mathMLTree.MathNode("mstyle", inner2);
  node.setAttribute("mathcolor", group.color);
  return node;
};
defineFunction({
  type: "color",
  names: ["\\textcolor"],
  props: {
    numArgs: 2,
    allowedInText: true,
    argTypes: ["color", "original"]
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    var color = assertNodeType(args[0], "color-token").color;
    var body = args[1];
    return {
      type: "color",
      mode: parser.mode,
      color,
      body: ordargument(body)
    };
  },
  htmlBuilder: htmlBuilder$8,
  mathmlBuilder: mathmlBuilder$7
});
defineFunction({
  type: "color",
  names: ["\\color"],
  props: {
    numArgs: 1,
    allowedInText: true,
    argTypes: ["color"]
  },
  handler(_ref2, args) {
    var {
      parser,
      breakOnTokenText
    } = _ref2;
    var color = assertNodeType(args[0], "color-token").color;
    parser.gullet.macros.set("\\current@color", color);
    var body = parser.parseExpression(true, breakOnTokenText);
    return {
      type: "color",
      mode: parser.mode,
      color,
      body
    };
  },
  htmlBuilder: htmlBuilder$8,
  mathmlBuilder: mathmlBuilder$7
});
defineFunction({
  type: "cr",
  names: ["\\\\"],
  props: {
    numArgs: 0,
    numOptionalArgs: 0,
    allowedInText: true
  },
  handler(_ref, args, optArgs) {
    var {
      parser
    } = _ref;
    var size = parser.gullet.future().text === "[" ? parser.parseSizeGroup(true) : null;
    var newLine = !parser.settings.displayMode || !parser.settings.useStrictBehavior("newLineInDisplayMode", "In LaTeX, \\\\ or \\newline does nothing in display mode");
    return {
      type: "cr",
      mode: parser.mode,
      newLine,
      size: size && assertNodeType(size, "size").value
    };
  },
  // The following builders are called only at the top level,
  // not within tabular/array environments.
  htmlBuilder(group, options) {
    var span = buildCommon.makeSpan(["mspace"], [], options);
    if (group.newLine) {
      span.classes.push("newline");
      if (group.size) {
        span.style.marginTop = makeEm(calculateSize(group.size, options));
      }
    }
    return span;
  },
  mathmlBuilder(group, options) {
    var node = new mathMLTree.MathNode("mspace");
    if (group.newLine) {
      node.setAttribute("linebreak", "newline");
      if (group.size) {
        node.setAttribute("height", makeEm(calculateSize(group.size, options)));
      }
    }
    return node;
  }
});
var globalMap = {
  "\\global": "\\global",
  "\\long": "\\\\globallong",
  "\\\\globallong": "\\\\globallong",
  "\\def": "\\gdef",
  "\\gdef": "\\gdef",
  "\\edef": "\\xdef",
  "\\xdef": "\\xdef",
  "\\let": "\\\\globallet",
  "\\futurelet": "\\\\globalfuture"
};
var checkControlSequence = (tok) => {
  var name2 = tok.text;
  if (/^(?:[\\{}$&#^_]|EOF)$/.test(name2)) {
    throw new ParseError("Expected a control sequence", tok);
  }
  return name2;
};
var getRHS = (parser) => {
  var tok = parser.gullet.popToken();
  if (tok.text === "=") {
    tok = parser.gullet.popToken();
    if (tok.text === " ") {
      tok = parser.gullet.popToken();
    }
  }
  return tok;
};
var letCommand = (parser, name2, tok, global) => {
  var macro = parser.gullet.macros.get(tok.text);
  if (macro == null) {
    tok.noexpand = true;
    macro = {
      tokens: [tok],
      numArgs: 0,
      // reproduce the same behavior in expansion
      unexpandable: !parser.gullet.isExpandable(tok.text)
    };
  }
  parser.gullet.macros.set(name2, macro, global);
};
defineFunction({
  type: "internal",
  names: [
    "\\global",
    "\\long",
    "\\\\globallong"
    // can’t be entered directly
  ],
  props: {
    numArgs: 0,
    allowedInText: true
  },
  handler(_ref) {
    var {
      parser,
      funcName
    } = _ref;
    parser.consumeSpaces();
    var token = parser.fetch();
    if (globalMap[token.text]) {
      if (funcName === "\\global" || funcName === "\\\\globallong") {
        token.text = globalMap[token.text];
      }
      return assertNodeType(parser.parseFunction(), "internal");
    }
    throw new ParseError("Invalid token after macro prefix", token);
  }
});
defineFunction({
  type: "internal",
  names: ["\\def", "\\gdef", "\\edef", "\\xdef"],
  props: {
    numArgs: 0,
    allowedInText: true,
    primitive: true
  },
  handler(_ref2) {
    var {
      parser,
      funcName
    } = _ref2;
    var tok = parser.gullet.popToken();
    var name2 = tok.text;
    if (/^(?:[\\{}$&#^_]|EOF)$/.test(name2)) {
      throw new ParseError("Expected a control sequence", tok);
    }
    var numArgs = 0;
    var insert;
    var delimiters2 = [[]];
    while (parser.gullet.future().text !== "{") {
      tok = parser.gullet.popToken();
      if (tok.text === "#") {
        if (parser.gullet.future().text === "{") {
          insert = parser.gullet.future();
          delimiters2[numArgs].push("{");
          break;
        }
        tok = parser.gullet.popToken();
        if (!/^[1-9]$/.test(tok.text)) {
          throw new ParseError('Invalid argument number "' + tok.text + '"');
        }
        if (parseInt(tok.text) !== numArgs + 1) {
          throw new ParseError('Argument number "' + tok.text + '" out of order');
        }
        numArgs++;
        delimiters2.push([]);
      } else if (tok.text === "EOF") {
        throw new ParseError("Expected a macro definition");
      } else {
        delimiters2[numArgs].push(tok.text);
      }
    }
    var {
      tokens
    } = parser.gullet.consumeArg();
    if (insert) {
      tokens.unshift(insert);
    }
    if (funcName === "\\edef" || funcName === "\\xdef") {
      tokens = parser.gullet.expandTokens(tokens);
      tokens.reverse();
    }
    parser.gullet.macros.set(name2, {
      tokens,
      numArgs,
      delimiters: delimiters2
    }, funcName === globalMap[funcName]);
    return {
      type: "internal",
      mode: parser.mode
    };
  }
});
defineFunction({
  type: "internal",
  names: [
    "\\let",
    "\\\\globallet"
    // can’t be entered directly
  ],
  props: {
    numArgs: 0,
    allowedInText: true,
    primitive: true
  },
  handler(_ref3) {
    var {
      parser,
      funcName
    } = _ref3;
    var name2 = checkControlSequence(parser.gullet.popToken());
    parser.gullet.consumeSpaces();
    var tok = getRHS(parser);
    letCommand(parser, name2, tok, funcName === "\\\\globallet");
    return {
      type: "internal",
      mode: parser.mode
    };
  }
});
defineFunction({
  type: "internal",
  names: [
    "\\futurelet",
    "\\\\globalfuture"
    // can’t be entered directly
  ],
  props: {
    numArgs: 0,
    allowedInText: true,
    primitive: true
  },
  handler(_ref4) {
    var {
      parser,
      funcName
    } = _ref4;
    var name2 = checkControlSequence(parser.gullet.popToken());
    var middle = parser.gullet.popToken();
    var tok = parser.gullet.popToken();
    letCommand(parser, name2, tok, funcName === "\\\\globalfuture");
    parser.gullet.pushToken(tok);
    parser.gullet.pushToken(middle);
    return {
      type: "internal",
      mode: parser.mode
    };
  }
});
var getMetrics = function getMetrics2(symbol, font, mode) {
  var replace = symbols.math[symbol] && symbols.math[symbol].replace;
  var metrics = getCharacterMetrics(replace || symbol, font, mode);
  if (!metrics) {
    throw new Error("Unsupported symbol " + symbol + " and font size " + font + ".");
  }
  return metrics;
};
var styleWrap = function styleWrap2(delim, toStyle, options, classes) {
  var newOptions = options.havingBaseStyle(toStyle);
  var span = buildCommon.makeSpan(classes.concat(newOptions.sizingClasses(options)), [delim], options);
  var delimSizeMultiplier = newOptions.sizeMultiplier / options.sizeMultiplier;
  span.height *= delimSizeMultiplier;
  span.depth *= delimSizeMultiplier;
  span.maxFontSize = newOptions.sizeMultiplier;
  return span;
};
var centerSpan = function centerSpan2(span, options, style) {
  var newOptions = options.havingBaseStyle(style);
  var shift = (1 - options.sizeMultiplier / newOptions.sizeMultiplier) * options.fontMetrics().axisHeight;
  span.classes.push("delimcenter");
  span.style.top = makeEm(shift);
  span.height -= shift;
  span.depth += shift;
};
var makeSmallDelim = function makeSmallDelim2(delim, style, center, options, mode, classes) {
  var text2 = buildCommon.makeSymbol(delim, "Main-Regular", mode, options);
  var span = styleWrap(text2, style, options, classes);
  if (center) {
    centerSpan(span, options, style);
  }
  return span;
};
var mathrmSize = function mathrmSize2(value, size, mode, options) {
  return buildCommon.makeSymbol(value, "Size" + size + "-Regular", mode, options);
};
var makeLargeDelim = function makeLargeDelim2(delim, size, center, options, mode, classes) {
  var inner2 = mathrmSize(delim, size, mode, options);
  var span = styleWrap(buildCommon.makeSpan(["delimsizing", "size" + size], [inner2], options), Style$1.TEXT, options, classes);
  if (center) {
    centerSpan(span, options, Style$1.TEXT);
  }
  return span;
};
var makeGlyphSpan = function makeGlyphSpan2(symbol, font, mode) {
  var sizeClass;
  if (font === "Size1-Regular") {
    sizeClass = "delim-size1";
  } else {
    sizeClass = "delim-size4";
  }
  var corner = buildCommon.makeSpan(["delimsizinginner", sizeClass], [buildCommon.makeSpan([], [buildCommon.makeSymbol(symbol, font, mode)])]);
  return {
    type: "elem",
    elem: corner
  };
};
var makeInner = function makeInner2(ch, height, options) {
  var width = fontMetricsData["Size4-Regular"][ch.charCodeAt(0)] ? fontMetricsData["Size4-Regular"][ch.charCodeAt(0)][4] : fontMetricsData["Size1-Regular"][ch.charCodeAt(0)][4];
  var path3 = new PathNode("inner", innerPath(ch, Math.round(1e3 * height)));
  var svgNode = new SvgNode([path3], {
    "width": makeEm(width),
    "height": makeEm(height),
    // Override CSS rule `.katex svg { width: 100% }`
    "style": "width:" + makeEm(width),
    "viewBox": "0 0 " + 1e3 * width + " " + Math.round(1e3 * height),
    "preserveAspectRatio": "xMinYMin"
  });
  var span = buildCommon.makeSvgSpan([], [svgNode], options);
  span.height = height;
  span.style.height = makeEm(height);
  span.style.width = makeEm(width);
  return {
    type: "elem",
    elem: span
  };
};
var lapInEms = 8e-3;
var lap = {
  type: "kern",
  size: -1 * lapInEms
};
var verts = ["|", "\\lvert", "\\rvert", "\\vert"];
var doubleVerts = ["\\|", "\\lVert", "\\rVert", "\\Vert"];
var makeStackedDelim = function makeStackedDelim2(delim, heightTotal, center, options, mode, classes) {
  var top;
  var middle;
  var repeat;
  var bottom;
  var svgLabel = "";
  var viewBoxWidth = 0;
  top = repeat = bottom = delim;
  middle = null;
  var font = "Size1-Regular";
  if (delim === "\\uparrow") {
    repeat = bottom = "\u23D0";
  } else if (delim === "\\Uparrow") {
    repeat = bottom = "\u2016";
  } else if (delim === "\\downarrow") {
    top = repeat = "\u23D0";
  } else if (delim === "\\Downarrow") {
    top = repeat = "\u2016";
  } else if (delim === "\\updownarrow") {
    top = "\\uparrow";
    repeat = "\u23D0";
    bottom = "\\downarrow";
  } else if (delim === "\\Updownarrow") {
    top = "\\Uparrow";
    repeat = "\u2016";
    bottom = "\\Downarrow";
  } else if (utils.contains(verts, delim)) {
    repeat = "\u2223";
    svgLabel = "vert";
    viewBoxWidth = 333;
  } else if (utils.contains(doubleVerts, delim)) {
    repeat = "\u2225";
    svgLabel = "doublevert";
    viewBoxWidth = 556;
  } else if (delim === "[" || delim === "\\lbrack") {
    top = "\u23A1";
    repeat = "\u23A2";
    bottom = "\u23A3";
    font = "Size4-Regular";
    svgLabel = "lbrack";
    viewBoxWidth = 667;
  } else if (delim === "]" || delim === "\\rbrack") {
    top = "\u23A4";
    repeat = "\u23A5";
    bottom = "\u23A6";
    font = "Size4-Regular";
    svgLabel = "rbrack";
    viewBoxWidth = 667;
  } else if (delim === "\\lfloor" || delim === "\u230A") {
    repeat = top = "\u23A2";
    bottom = "\u23A3";
    font = "Size4-Regular";
    svgLabel = "lfloor";
    viewBoxWidth = 667;
  } else if (delim === "\\lceil" || delim === "\u2308") {
    top = "\u23A1";
    repeat = bottom = "\u23A2";
    font = "Size4-Regular";
    svgLabel = "lceil";
    viewBoxWidth = 667;
  } else if (delim === "\\rfloor" || delim === "\u230B") {
    repeat = top = "\u23A5";
    bottom = "\u23A6";
    font = "Size4-Regular";
    svgLabel = "rfloor";
    viewBoxWidth = 667;
  } else if (delim === "\\rceil" || delim === "\u2309") {
    top = "\u23A4";
    repeat = bottom = "\u23A5";
    font = "Size4-Regular";
    svgLabel = "rceil";
    viewBoxWidth = 667;
  } else if (delim === "(" || delim === "\\lparen") {
    top = "\u239B";
    repeat = "\u239C";
    bottom = "\u239D";
    font = "Size4-Regular";
    svgLabel = "lparen";
    viewBoxWidth = 875;
  } else if (delim === ")" || delim === "\\rparen") {
    top = "\u239E";
    repeat = "\u239F";
    bottom = "\u23A0";
    font = "Size4-Regular";
    svgLabel = "rparen";
    viewBoxWidth = 875;
  } else if (delim === "\\{" || delim === "\\lbrace") {
    top = "\u23A7";
    middle = "\u23A8";
    bottom = "\u23A9";
    repeat = "\u23AA";
    font = "Size4-Regular";
  } else if (delim === "\\}" || delim === "\\rbrace") {
    top = "\u23AB";
    middle = "\u23AC";
    bottom = "\u23AD";
    repeat = "\u23AA";
    font = "Size4-Regular";
  } else if (delim === "\\lgroup" || delim === "\u27EE") {
    top = "\u23A7";
    bottom = "\u23A9";
    repeat = "\u23AA";
    font = "Size4-Regular";
  } else if (delim === "\\rgroup" || delim === "\u27EF") {
    top = "\u23AB";
    bottom = "\u23AD";
    repeat = "\u23AA";
    font = "Size4-Regular";
  } else if (delim === "\\lmoustache" || delim === "\u23B0") {
    top = "\u23A7";
    bottom = "\u23AD";
    repeat = "\u23AA";
    font = "Size4-Regular";
  } else if (delim === "\\rmoustache" || delim === "\u23B1") {
    top = "\u23AB";
    bottom = "\u23A9";
    repeat = "\u23AA";
    font = "Size4-Regular";
  }
  var topMetrics = getMetrics(top, font, mode);
  var topHeightTotal = topMetrics.height + topMetrics.depth;
  var repeatMetrics = getMetrics(repeat, font, mode);
  var repeatHeightTotal = repeatMetrics.height + repeatMetrics.depth;
  var bottomMetrics = getMetrics(bottom, font, mode);
  var bottomHeightTotal = bottomMetrics.height + bottomMetrics.depth;
  var middleHeightTotal = 0;
  var middleFactor = 1;
  if (middle !== null) {
    var middleMetrics = getMetrics(middle, font, mode);
    middleHeightTotal = middleMetrics.height + middleMetrics.depth;
    middleFactor = 2;
  }
  var minHeight = topHeightTotal + bottomHeightTotal + middleHeightTotal;
  var repeatCount = Math.max(0, Math.ceil((heightTotal - minHeight) / (middleFactor * repeatHeightTotal)));
  var realHeightTotal = minHeight + repeatCount * middleFactor * repeatHeightTotal;
  var axisHeight = options.fontMetrics().axisHeight;
  if (center) {
    axisHeight *= options.sizeMultiplier;
  }
  var depth = realHeightTotal / 2 - axisHeight;
  var stack = [];
  if (svgLabel.length > 0) {
    var midHeight = realHeightTotal - topHeightTotal - bottomHeightTotal;
    var viewBoxHeight = Math.round(realHeightTotal * 1e3);
    var pathStr = tallDelim(svgLabel, Math.round(midHeight * 1e3));
    var path3 = new PathNode(svgLabel, pathStr);
    var width = (viewBoxWidth / 1e3).toFixed(3) + "em";
    var height = (viewBoxHeight / 1e3).toFixed(3) + "em";
    var svg = new SvgNode([path3], {
      "width": width,
      "height": height,
      "viewBox": "0 0 " + viewBoxWidth + " " + viewBoxHeight
    });
    var wrapper = buildCommon.makeSvgSpan([], [svg], options);
    wrapper.height = viewBoxHeight / 1e3;
    wrapper.style.width = width;
    wrapper.style.height = height;
    stack.push({
      type: "elem",
      elem: wrapper
    });
  } else {
    stack.push(makeGlyphSpan(bottom, font, mode));
    stack.push(lap);
    if (middle === null) {
      var innerHeight = realHeightTotal - topHeightTotal - bottomHeightTotal + 2 * lapInEms;
      stack.push(makeInner(repeat, innerHeight, options));
    } else {
      var _innerHeight = (realHeightTotal - topHeightTotal - bottomHeightTotal - middleHeightTotal) / 2 + 2 * lapInEms;
      stack.push(makeInner(repeat, _innerHeight, options));
      stack.push(lap);
      stack.push(makeGlyphSpan(middle, font, mode));
      stack.push(lap);
      stack.push(makeInner(repeat, _innerHeight, options));
    }
    stack.push(lap);
    stack.push(makeGlyphSpan(top, font, mode));
  }
  var newOptions = options.havingBaseStyle(Style$1.TEXT);
  var inner2 = buildCommon.makeVList({
    positionType: "bottom",
    positionData: depth,
    children: stack
  }, newOptions);
  return styleWrap(buildCommon.makeSpan(["delimsizing", "mult"], [inner2], newOptions), Style$1.TEXT, options, classes);
};
var vbPad = 80;
var emPad = 0.08;
var sqrtSvg = function sqrtSvg2(sqrtName, height, viewBoxHeight, extraVinculum, options) {
  var path3 = sqrtPath(sqrtName, extraVinculum, viewBoxHeight);
  var pathNode = new PathNode(sqrtName, path3);
  var svg = new SvgNode([pathNode], {
    // Note: 1000:1 ratio of viewBox to document em width.
    "width": "400em",
    "height": makeEm(height),
    "viewBox": "0 0 400000 " + viewBoxHeight,
    "preserveAspectRatio": "xMinYMin slice"
  });
  return buildCommon.makeSvgSpan(["hide-tail"], [svg], options);
};
var makeSqrtImage = function makeSqrtImage2(height, options) {
  var newOptions = options.havingBaseSizing();
  var delim = traverseSequence("\\surd", height * newOptions.sizeMultiplier, stackLargeDelimiterSequence, newOptions);
  var sizeMultiplier = newOptions.sizeMultiplier;
  var extraVinculum = Math.max(0, options.minRuleThickness - options.fontMetrics().sqrtRuleThickness);
  var span;
  var spanHeight = 0;
  var texHeight = 0;
  var viewBoxHeight = 0;
  var advanceWidth;
  if (delim.type === "small") {
    viewBoxHeight = 1e3 + 1e3 * extraVinculum + vbPad;
    if (height < 1) {
      sizeMultiplier = 1;
    } else if (height < 1.4) {
      sizeMultiplier = 0.7;
    }
    spanHeight = (1 + extraVinculum + emPad) / sizeMultiplier;
    texHeight = (1 + extraVinculum) / sizeMultiplier;
    span = sqrtSvg("sqrtMain", spanHeight, viewBoxHeight, extraVinculum, options);
    span.style.minWidth = "0.853em";
    advanceWidth = 0.833 / sizeMultiplier;
  } else if (delim.type === "large") {
    viewBoxHeight = (1e3 + vbPad) * sizeToMaxHeight[delim.size];
    texHeight = (sizeToMaxHeight[delim.size] + extraVinculum) / sizeMultiplier;
    spanHeight = (sizeToMaxHeight[delim.size] + extraVinculum + emPad) / sizeMultiplier;
    span = sqrtSvg("sqrtSize" + delim.size, spanHeight, viewBoxHeight, extraVinculum, options);
    span.style.minWidth = "1.02em";
    advanceWidth = 1 / sizeMultiplier;
  } else {
    spanHeight = height + extraVinculum + emPad;
    texHeight = height + extraVinculum;
    viewBoxHeight = Math.floor(1e3 * height + extraVinculum) + vbPad;
    span = sqrtSvg("sqrtTall", spanHeight, viewBoxHeight, extraVinculum, options);
    span.style.minWidth = "0.742em";
    advanceWidth = 1.056;
  }
  span.height = texHeight;
  span.style.height = makeEm(spanHeight);
  return {
    span,
    advanceWidth,
    // Calculate the actual line width.
    // This actually should depend on the chosen font -- e.g. \boldmath
    // should use the thicker surd symbols from e.g. KaTeX_Main-Bold, and
    // have thicker rules.
    ruleWidth: (options.fontMetrics().sqrtRuleThickness + extraVinculum) * sizeMultiplier
  };
};
var stackLargeDelimiters = ["(", "\\lparen", ")", "\\rparen", "[", "\\lbrack", "]", "\\rbrack", "\\{", "\\lbrace", "\\}", "\\rbrace", "\\lfloor", "\\rfloor", "\u230A", "\u230B", "\\lceil", "\\rceil", "\u2308", "\u2309", "\\surd"];
var stackAlwaysDelimiters = ["\\uparrow", "\\downarrow", "\\updownarrow", "\\Uparrow", "\\Downarrow", "\\Updownarrow", "|", "\\|", "\\vert", "\\Vert", "\\lvert", "\\rvert", "\\lVert", "\\rVert", "\\lgroup", "\\rgroup", "\u27EE", "\u27EF", "\\lmoustache", "\\rmoustache", "\u23B0", "\u23B1"];
var stackNeverDelimiters = ["<", ">", "\\langle", "\\rangle", "/", "\\backslash", "\\lt", "\\gt"];
var sizeToMaxHeight = [0, 1.2, 1.8, 2.4, 3];
var makeSizedDelim = function makeSizedDelim2(delim, size, options, mode, classes) {
  if (delim === "<" || delim === "\\lt" || delim === "\u27E8") {
    delim = "\\langle";
  } else if (delim === ">" || delim === "\\gt" || delim === "\u27E9") {
    delim = "\\rangle";
  }
  if (utils.contains(stackLargeDelimiters, delim) || utils.contains(stackNeverDelimiters, delim)) {
    return makeLargeDelim(delim, size, false, options, mode, classes);
  } else if (utils.contains(stackAlwaysDelimiters, delim)) {
    return makeStackedDelim(delim, sizeToMaxHeight[size], false, options, mode, classes);
  } else {
    throw new ParseError("Illegal delimiter: '" + delim + "'");
  }
};
var stackNeverDelimiterSequence = [{
  type: "small",
  style: Style$1.SCRIPTSCRIPT
}, {
  type: "small",
  style: Style$1.SCRIPT
}, {
  type: "small",
  style: Style$1.TEXT
}, {
  type: "large",
  size: 1
}, {
  type: "large",
  size: 2
}, {
  type: "large",
  size: 3
}, {
  type: "large",
  size: 4
}];
var stackAlwaysDelimiterSequence = [{
  type: "small",
  style: Style$1.SCRIPTSCRIPT
}, {
  type: "small",
  style: Style$1.SCRIPT
}, {
  type: "small",
  style: Style$1.TEXT
}, {
  type: "stack"
}];
var stackLargeDelimiterSequence = [{
  type: "small",
  style: Style$1.SCRIPTSCRIPT
}, {
  type: "small",
  style: Style$1.SCRIPT
}, {
  type: "small",
  style: Style$1.TEXT
}, {
  type: "large",
  size: 1
}, {
  type: "large",
  size: 2
}, {
  type: "large",
  size: 3
}, {
  type: "large",
  size: 4
}, {
  type: "stack"
}];
var delimTypeToFont = function delimTypeToFont2(type) {
  if (type.type === "small") {
    return "Main-Regular";
  } else if (type.type === "large") {
    return "Size" + type.size + "-Regular";
  } else if (type.type === "stack") {
    return "Size4-Regular";
  } else {
    throw new Error("Add support for delim type '" + type.type + "' here.");
  }
};
var traverseSequence = function traverseSequence2(delim, height, sequence, options) {
  var start = Math.min(2, 3 - options.style.size);
  for (var i = start; i < sequence.length; i++) {
    if (sequence[i].type === "stack") {
      break;
    }
    var metrics = getMetrics(delim, delimTypeToFont(sequence[i]), "math");
    var heightDepth = metrics.height + metrics.depth;
    if (sequence[i].type === "small") {
      var newOptions = options.havingBaseStyle(sequence[i].style);
      heightDepth *= newOptions.sizeMultiplier;
    }
    if (heightDepth > height) {
      return sequence[i];
    }
  }
  return sequence[sequence.length - 1];
};
var makeCustomSizedDelim = function makeCustomSizedDelim2(delim, height, center, options, mode, classes) {
  if (delim === "<" || delim === "\\lt" || delim === "\u27E8") {
    delim = "\\langle";
  } else if (delim === ">" || delim === "\\gt" || delim === "\u27E9") {
    delim = "\\rangle";
  }
  var sequence;
  if (utils.contains(stackNeverDelimiters, delim)) {
    sequence = stackNeverDelimiterSequence;
  } else if (utils.contains(stackLargeDelimiters, delim)) {
    sequence = stackLargeDelimiterSequence;
  } else {
    sequence = stackAlwaysDelimiterSequence;
  }
  var delimType = traverseSequence(delim, height, sequence, options);
  if (delimType.type === "small") {
    return makeSmallDelim(delim, delimType.style, center, options, mode, classes);
  } else if (delimType.type === "large") {
    return makeLargeDelim(delim, delimType.size, center, options, mode, classes);
  } else {
    return makeStackedDelim(delim, height, center, options, mode, classes);
  }
};
var makeLeftRightDelim = function makeLeftRightDelim2(delim, height, depth, options, mode, classes) {
  var axisHeight = options.fontMetrics().axisHeight * options.sizeMultiplier;
  var delimiterFactor = 901;
  var delimiterExtend = 5 / options.fontMetrics().ptPerEm;
  var maxDistFromAxis = Math.max(height - axisHeight, depth + axisHeight);
  var totalHeight = Math.max(
    // In real TeX, calculations are done using integral values which are
    // 65536 per pt, or 655360 per em. So, the division here truncates in
    // TeX but doesn't here, producing different results. If we wanted to
    // exactly match TeX's calculation, we could do
    //   Math.floor(655360 * maxDistFromAxis / 500) *
    //    delimiterFactor / 655360
    // (To see the difference, compare
    //    x^{x^{\left(\rule{0.1em}{0.68em}\right)}}
    // in TeX and KaTeX)
    maxDistFromAxis / 500 * delimiterFactor,
    2 * maxDistFromAxis - delimiterExtend
  );
  return makeCustomSizedDelim(delim, totalHeight, true, options, mode, classes);
};
var delimiter = {
  sqrtImage: makeSqrtImage,
  sizedDelim: makeSizedDelim,
  sizeToMaxHeight,
  customSizedDelim: makeCustomSizedDelim,
  leftRightDelim: makeLeftRightDelim
};
var delimiterSizes = {
  "\\bigl": {
    mclass: "mopen",
    size: 1
  },
  "\\Bigl": {
    mclass: "mopen",
    size: 2
  },
  "\\biggl": {
    mclass: "mopen",
    size: 3
  },
  "\\Biggl": {
    mclass: "mopen",
    size: 4
  },
  "\\bigr": {
    mclass: "mclose",
    size: 1
  },
  "\\Bigr": {
    mclass: "mclose",
    size: 2
  },
  "\\biggr": {
    mclass: "mclose",
    size: 3
  },
  "\\Biggr": {
    mclass: "mclose",
    size: 4
  },
  "\\bigm": {
    mclass: "mrel",
    size: 1
  },
  "\\Bigm": {
    mclass: "mrel",
    size: 2
  },
  "\\biggm": {
    mclass: "mrel",
    size: 3
  },
  "\\Biggm": {
    mclass: "mrel",
    size: 4
  },
  "\\big": {
    mclass: "mord",
    size: 1
  },
  "\\Big": {
    mclass: "mord",
    size: 2
  },
  "\\bigg": {
    mclass: "mord",
    size: 3
  },
  "\\Bigg": {
    mclass: "mord",
    size: 4
  }
};
var delimiters = ["(", "\\lparen", ")", "\\rparen", "[", "\\lbrack", "]", "\\rbrack", "\\{", "\\lbrace", "\\}", "\\rbrace", "\\lfloor", "\\rfloor", "\u230A", "\u230B", "\\lceil", "\\rceil", "\u2308", "\u2309", "<", ">", "\\langle", "\u27E8", "\\rangle", "\u27E9", "\\lt", "\\gt", "\\lvert", "\\rvert", "\\lVert", "\\rVert", "\\lgroup", "\\rgroup", "\u27EE", "\u27EF", "\\lmoustache", "\\rmoustache", "\u23B0", "\u23B1", "/", "\\backslash", "|", "\\vert", "\\|", "\\Vert", "\\uparrow", "\\Uparrow", "\\downarrow", "\\Downarrow", "\\updownarrow", "\\Updownarrow", "."];
function checkDelimiter(delim, context) {
  var symDelim = checkSymbolNodeType(delim);
  if (symDelim && utils.contains(delimiters, symDelim.text)) {
    return symDelim;
  } else if (symDelim) {
    throw new ParseError("Invalid delimiter '" + symDelim.text + "' after '" + context.funcName + "'", delim);
  } else {
    throw new ParseError("Invalid delimiter type '" + delim.type + "'", delim);
  }
}
defineFunction({
  type: "delimsizing",
  names: ["\\bigl", "\\Bigl", "\\biggl", "\\Biggl", "\\bigr", "\\Bigr", "\\biggr", "\\Biggr", "\\bigm", "\\Bigm", "\\biggm", "\\Biggm", "\\big", "\\Big", "\\bigg", "\\Bigg"],
  props: {
    numArgs: 1,
    argTypes: ["primitive"]
  },
  handler: (context, args) => {
    var delim = checkDelimiter(args[0], context);
    return {
      type: "delimsizing",
      mode: context.parser.mode,
      size: delimiterSizes[context.funcName].size,
      mclass: delimiterSizes[context.funcName].mclass,
      delim: delim.text
    };
  },
  htmlBuilder: (group, options) => {
    if (group.delim === ".") {
      return buildCommon.makeSpan([group.mclass]);
    }
    return delimiter.sizedDelim(group.delim, group.size, options, group.mode, [group.mclass]);
  },
  mathmlBuilder: (group) => {
    var children = [];
    if (group.delim !== ".") {
      children.push(makeText(group.delim, group.mode));
    }
    var node = new mathMLTree.MathNode("mo", children);
    if (group.mclass === "mopen" || group.mclass === "mclose") {
      node.setAttribute("fence", "true");
    } else {
      node.setAttribute("fence", "false");
    }
    node.setAttribute("stretchy", "true");
    var size = makeEm(delimiter.sizeToMaxHeight[group.size]);
    node.setAttribute("minsize", size);
    node.setAttribute("maxsize", size);
    return node;
  }
});
function assertParsed(group) {
  if (!group.body) {
    throw new Error("Bug: The leftright ParseNode wasn't fully parsed.");
  }
}
defineFunction({
  type: "leftright-right",
  names: ["\\right"],
  props: {
    numArgs: 1,
    primitive: true
  },
  handler: (context, args) => {
    var color = context.parser.gullet.macros.get("\\current@color");
    if (color && typeof color !== "string") {
      throw new ParseError("\\current@color set to non-string in \\right");
    }
    return {
      type: "leftright-right",
      mode: context.parser.mode,
      delim: checkDelimiter(args[0], context).text,
      color
      // undefined if not set via \color
    };
  }
});
defineFunction({
  type: "leftright",
  names: ["\\left"],
  props: {
    numArgs: 1,
    primitive: true
  },
  handler: (context, args) => {
    var delim = checkDelimiter(args[0], context);
    var parser = context.parser;
    ++parser.leftrightDepth;
    var body = parser.parseExpression(false);
    --parser.leftrightDepth;
    parser.expect("\\right", false);
    var right = assertNodeType(parser.parseFunction(), "leftright-right");
    return {
      type: "leftright",
      mode: parser.mode,
      body,
      left: delim.text,
      right: right.delim,
      rightColor: right.color
    };
  },
  htmlBuilder: (group, options) => {
    assertParsed(group);
    var inner2 = buildExpression$1(group.body, options, true, ["mopen", "mclose"]);
    var innerHeight = 0;
    var innerDepth = 0;
    var hadMiddle = false;
    for (var i = 0; i < inner2.length; i++) {
      if (inner2[i].isMiddle) {
        hadMiddle = true;
      } else {
        innerHeight = Math.max(inner2[i].height, innerHeight);
        innerDepth = Math.max(inner2[i].depth, innerDepth);
      }
    }
    innerHeight *= options.sizeMultiplier;
    innerDepth *= options.sizeMultiplier;
    var leftDelim;
    if (group.left === ".") {
      leftDelim = makeNullDelimiter(options, ["mopen"]);
    } else {
      leftDelim = delimiter.leftRightDelim(group.left, innerHeight, innerDepth, options, group.mode, ["mopen"]);
    }
    inner2.unshift(leftDelim);
    if (hadMiddle) {
      for (var _i = 1; _i < inner2.length; _i++) {
        var middleDelim = inner2[_i];
        var isMiddle = middleDelim.isMiddle;
        if (isMiddle) {
          inner2[_i] = delimiter.leftRightDelim(isMiddle.delim, innerHeight, innerDepth, isMiddle.options, group.mode, []);
        }
      }
    }
    var rightDelim;
    if (group.right === ".") {
      rightDelim = makeNullDelimiter(options, ["mclose"]);
    } else {
      var colorOptions = group.rightColor ? options.withColor(group.rightColor) : options;
      rightDelim = delimiter.leftRightDelim(group.right, innerHeight, innerDepth, colorOptions, group.mode, ["mclose"]);
    }
    inner2.push(rightDelim);
    return buildCommon.makeSpan(["minner"], inner2, options);
  },
  mathmlBuilder: (group, options) => {
    assertParsed(group);
    var inner2 = buildExpression2(group.body, options);
    if (group.left !== ".") {
      var leftNode = new mathMLTree.MathNode("mo", [makeText(group.left, group.mode)]);
      leftNode.setAttribute("fence", "true");
      inner2.unshift(leftNode);
    }
    if (group.right !== ".") {
      var rightNode = new mathMLTree.MathNode("mo", [makeText(group.right, group.mode)]);
      rightNode.setAttribute("fence", "true");
      if (group.rightColor) {
        rightNode.setAttribute("mathcolor", group.rightColor);
      }
      inner2.push(rightNode);
    }
    return makeRow(inner2);
  }
});
defineFunction({
  type: "middle",
  names: ["\\middle"],
  props: {
    numArgs: 1,
    primitive: true
  },
  handler: (context, args) => {
    var delim = checkDelimiter(args[0], context);
    if (!context.parser.leftrightDepth) {
      throw new ParseError("\\middle without preceding \\left", delim);
    }
    return {
      type: "middle",
      mode: context.parser.mode,
      delim: delim.text
    };
  },
  htmlBuilder: (group, options) => {
    var middleDelim;
    if (group.delim === ".") {
      middleDelim = makeNullDelimiter(options, []);
    } else {
      middleDelim = delimiter.sizedDelim(group.delim, 1, options, group.mode, []);
      var isMiddle = {
        delim: group.delim,
        options
      };
      middleDelim.isMiddle = isMiddle;
    }
    return middleDelim;
  },
  mathmlBuilder: (group, options) => {
    var textNode = group.delim === "\\vert" || group.delim === "|" ? makeText("|", "text") : makeText(group.delim, group.mode);
    var middleNode = new mathMLTree.MathNode("mo", [textNode]);
    middleNode.setAttribute("fence", "true");
    middleNode.setAttribute("lspace", "0.05em");
    middleNode.setAttribute("rspace", "0.05em");
    return middleNode;
  }
});
var htmlBuilder$7 = (group, options) => {
  var inner2 = buildCommon.wrapFragment(buildGroup$1(group.body, options), options);
  var label = group.label.slice(1);
  var scale = options.sizeMultiplier;
  var img;
  var imgShift = 0;
  var isSingleChar = utils.isCharacterBox(group.body);
  if (label === "sout") {
    img = buildCommon.makeSpan(["stretchy", "sout"]);
    img.height = options.fontMetrics().defaultRuleThickness / scale;
    imgShift = -0.5 * options.fontMetrics().xHeight;
  } else if (label === "phase") {
    var lineWeight = calculateSize({
      number: 0.6,
      unit: "pt"
    }, options);
    var clearance = calculateSize({
      number: 0.35,
      unit: "ex"
    }, options);
    var newOptions = options.havingBaseSizing();
    scale = scale / newOptions.sizeMultiplier;
    var angleHeight = inner2.height + inner2.depth + lineWeight + clearance;
    inner2.style.paddingLeft = makeEm(angleHeight / 2 + lineWeight);
    var viewBoxHeight = Math.floor(1e3 * angleHeight * scale);
    var path3 = phasePath(viewBoxHeight);
    var svgNode = new SvgNode([new PathNode("phase", path3)], {
      "width": "400em",
      "height": makeEm(viewBoxHeight / 1e3),
      "viewBox": "0 0 400000 " + viewBoxHeight,
      "preserveAspectRatio": "xMinYMin slice"
    });
    img = buildCommon.makeSvgSpan(["hide-tail"], [svgNode], options);
    img.style.height = makeEm(angleHeight);
    imgShift = inner2.depth + lineWeight + clearance;
  } else {
    if (/cancel/.test(label)) {
      if (!isSingleChar) {
        inner2.classes.push("cancel-pad");
      }
    } else if (label === "angl") {
      inner2.classes.push("anglpad");
    } else {
      inner2.classes.push("boxpad");
    }
    var topPad = 0;
    var bottomPad = 0;
    var ruleThickness = 0;
    if (/box/.test(label)) {
      ruleThickness = Math.max(
        options.fontMetrics().fboxrule,
        // default
        options.minRuleThickness
        // User override.
      );
      topPad = options.fontMetrics().fboxsep + (label === "colorbox" ? 0 : ruleThickness);
      bottomPad = topPad;
    } else if (label === "angl") {
      ruleThickness = Math.max(options.fontMetrics().defaultRuleThickness, options.minRuleThickness);
      topPad = 4 * ruleThickness;
      bottomPad = Math.max(0, 0.25 - inner2.depth);
    } else {
      topPad = isSingleChar ? 0.2 : 0;
      bottomPad = topPad;
    }
    img = stretchy.encloseSpan(inner2, label, topPad, bottomPad, options);
    if (/fbox|boxed|fcolorbox/.test(label)) {
      img.style.borderStyle = "solid";
      img.style.borderWidth = makeEm(ruleThickness);
    } else if (label === "angl" && ruleThickness !== 0.049) {
      img.style.borderTopWidth = makeEm(ruleThickness);
      img.style.borderRightWidth = makeEm(ruleThickness);
    }
    imgShift = inner2.depth + bottomPad;
    if (group.backgroundColor) {
      img.style.backgroundColor = group.backgroundColor;
      if (group.borderColor) {
        img.style.borderColor = group.borderColor;
      }
    }
  }
  var vlist;
  if (group.backgroundColor) {
    vlist = buildCommon.makeVList({
      positionType: "individualShift",
      children: [
        // Put the color background behind inner;
        {
          type: "elem",
          elem: img,
          shift: imgShift
        },
        {
          type: "elem",
          elem: inner2,
          shift: 0
        }
      ]
    }, options);
  } else {
    var classes = /cancel|phase/.test(label) ? ["svg-align"] : [];
    vlist = buildCommon.makeVList({
      positionType: "individualShift",
      children: [
        // Write the \cancel stroke on top of inner.
        {
          type: "elem",
          elem: inner2,
          shift: 0
        },
        {
          type: "elem",
          elem: img,
          shift: imgShift,
          wrapperClasses: classes
        }
      ]
    }, options);
  }
  if (/cancel/.test(label)) {
    vlist.height = inner2.height;
    vlist.depth = inner2.depth;
  }
  if (/cancel/.test(label) && !isSingleChar) {
    return buildCommon.makeSpan(["mord", "cancel-lap"], [vlist], options);
  } else {
    return buildCommon.makeSpan(["mord"], [vlist], options);
  }
};
var mathmlBuilder$6 = (group, options) => {
  var fboxsep = 0;
  var node = new mathMLTree.MathNode(group.label.indexOf("colorbox") > -1 ? "mpadded" : "menclose", [buildGroup2(group.body, options)]);
  switch (group.label) {
    case "\\cancel":
      node.setAttribute("notation", "updiagonalstrike");
      break;
    case "\\bcancel":
      node.setAttribute("notation", "downdiagonalstrike");
      break;
    case "\\phase":
      node.setAttribute("notation", "phasorangle");
      break;
    case "\\sout":
      node.setAttribute("notation", "horizontalstrike");
      break;
    case "\\fbox":
      node.setAttribute("notation", "box");
      break;
    case "\\angl":
      node.setAttribute("notation", "actuarial");
      break;
    case "\\fcolorbox":
    case "\\colorbox":
      fboxsep = options.fontMetrics().fboxsep * options.fontMetrics().ptPerEm;
      node.setAttribute("width", "+" + 2 * fboxsep + "pt");
      node.setAttribute("height", "+" + 2 * fboxsep + "pt");
      node.setAttribute("lspace", fboxsep + "pt");
      node.setAttribute("voffset", fboxsep + "pt");
      if (group.label === "\\fcolorbox") {
        var thk = Math.max(
          options.fontMetrics().fboxrule,
          // default
          options.minRuleThickness
          // user override
        );
        node.setAttribute("style", "border: " + thk + "em solid " + String(group.borderColor));
      }
      break;
    case "\\xcancel":
      node.setAttribute("notation", "updiagonalstrike downdiagonalstrike");
      break;
  }
  if (group.backgroundColor) {
    node.setAttribute("mathbackground", group.backgroundColor);
  }
  return node;
};
defineFunction({
  type: "enclose",
  names: ["\\colorbox"],
  props: {
    numArgs: 2,
    allowedInText: true,
    argTypes: ["color", "text"]
  },
  handler(_ref, args, optArgs) {
    var {
      parser,
      funcName
    } = _ref;
    var color = assertNodeType(args[0], "color-token").color;
    var body = args[1];
    return {
      type: "enclose",
      mode: parser.mode,
      label: funcName,
      backgroundColor: color,
      body
    };
  },
  htmlBuilder: htmlBuilder$7,
  mathmlBuilder: mathmlBuilder$6
});
defineFunction({
  type: "enclose",
  names: ["\\fcolorbox"],
  props: {
    numArgs: 3,
    allowedInText: true,
    argTypes: ["color", "color", "text"]
  },
  handler(_ref2, args, optArgs) {
    var {
      parser,
      funcName
    } = _ref2;
    var borderColor = assertNodeType(args[0], "color-token").color;
    var backgroundColor = assertNodeType(args[1], "color-token").color;
    var body = args[2];
    return {
      type: "enclose",
      mode: parser.mode,
      label: funcName,
      backgroundColor,
      borderColor,
      body
    };
  },
  htmlBuilder: htmlBuilder$7,
  mathmlBuilder: mathmlBuilder$6
});
defineFunction({
  type: "enclose",
  names: ["\\fbox"],
  props: {
    numArgs: 1,
    argTypes: ["hbox"],
    allowedInText: true
  },
  handler(_ref3, args) {
    var {
      parser
    } = _ref3;
    return {
      type: "enclose",
      mode: parser.mode,
      label: "\\fbox",
      body: args[0]
    };
  }
});
defineFunction({
  type: "enclose",
  names: ["\\cancel", "\\bcancel", "\\xcancel", "\\sout", "\\phase"],
  props: {
    numArgs: 1
  },
  handler(_ref4, args) {
    var {
      parser,
      funcName
    } = _ref4;
    var body = args[0];
    return {
      type: "enclose",
      mode: parser.mode,
      label: funcName,
      body
    };
  },
  htmlBuilder: htmlBuilder$7,
  mathmlBuilder: mathmlBuilder$6
});
defineFunction({
  type: "enclose",
  names: ["\\angl"],
  props: {
    numArgs: 1,
    argTypes: ["hbox"],
    allowedInText: false
  },
  handler(_ref5, args) {
    var {
      parser
    } = _ref5;
    return {
      type: "enclose",
      mode: parser.mode,
      label: "\\angl",
      body: args[0]
    };
  }
});
var _environments = {};
function defineEnvironment(_ref) {
  var {
    type,
    names,
    props,
    handler,
    htmlBuilder: htmlBuilder3,
    mathmlBuilder: mathmlBuilder3
  } = _ref;
  var data = {
    type,
    numArgs: props.numArgs || 0,
    allowedInText: false,
    numOptionalArgs: 0,
    handler
  };
  for (var i = 0; i < names.length; ++i) {
    _environments[names[i]] = data;
  }
  if (htmlBuilder3) {
    _htmlGroupBuilders[type] = htmlBuilder3;
  }
  if (mathmlBuilder3) {
    _mathmlGroupBuilders[type] = mathmlBuilder3;
  }
}
var _macros = {};
function defineMacro(name2, body) {
  _macros[name2] = body;
}
function getHLines(parser) {
  var hlineInfo = [];
  parser.consumeSpaces();
  var nxt = parser.fetch().text;
  if (nxt === "\\relax") {
    parser.consume();
    parser.consumeSpaces();
    nxt = parser.fetch().text;
  }
  while (nxt === "\\hline" || nxt === "\\hdashline") {
    parser.consume();
    hlineInfo.push(nxt === "\\hdashline");
    parser.consumeSpaces();
    nxt = parser.fetch().text;
  }
  return hlineInfo;
}
var validateAmsEnvironmentContext = (context) => {
  var settings = context.parser.settings;
  if (!settings.displayMode) {
    throw new ParseError("{" + context.envName + "} can be used only in display mode.");
  }
};
function getAutoTag(name2) {
  if (name2.indexOf("ed") === -1) {
    return name2.indexOf("*") === -1;
  }
}
function parseArray(parser, _ref, style) {
  var {
    hskipBeforeAndAfter,
    addJot,
    cols,
    arraystretch,
    colSeparationType,
    autoTag,
    singleRow,
    emptySingleRow,
    maxNumCols,
    leqno
  } = _ref;
  parser.gullet.beginGroup();
  if (!singleRow) {
    parser.gullet.macros.set("\\cr", "\\\\\\relax");
  }
  if (!arraystretch) {
    var stretch = parser.gullet.expandMacroAsText("\\arraystretch");
    if (stretch == null) {
      arraystretch = 1;
    } else {
      arraystretch = parseFloat(stretch);
      if (!arraystretch || arraystretch < 0) {
        throw new ParseError("Invalid \\arraystretch: " + stretch);
      }
    }
  }
  parser.gullet.beginGroup();
  var row = [];
  var body = [row];
  var rowGaps = [];
  var hLinesBeforeRow = [];
  var tags = autoTag != null ? [] : void 0;
  function beginRow() {
    if (autoTag) {
      parser.gullet.macros.set("\\@eqnsw", "1", true);
    }
  }
  function endRow() {
    if (tags) {
      if (parser.gullet.macros.get("\\df@tag")) {
        tags.push(parser.subparse([new Token("\\df@tag")]));
        parser.gullet.macros.set("\\df@tag", void 0, true);
      } else {
        tags.push(Boolean(autoTag) && parser.gullet.macros.get("\\@eqnsw") === "1");
      }
    }
  }
  beginRow();
  hLinesBeforeRow.push(getHLines(parser));
  while (true) {
    var cell = parser.parseExpression(false, singleRow ? "\\end" : "\\\\");
    parser.gullet.endGroup();
    parser.gullet.beginGroup();
    cell = {
      type: "ordgroup",
      mode: parser.mode,
      body: cell
    };
    if (style) {
      cell = {
        type: "styling",
        mode: parser.mode,
        style,
        body: [cell]
      };
    }
    row.push(cell);
    var next = parser.fetch().text;
    if (next === "&") {
      if (maxNumCols && row.length === maxNumCols) {
        if (singleRow || colSeparationType) {
          throw new ParseError("Too many tab characters: &", parser.nextToken);
        } else {
          parser.settings.reportNonstrict("textEnv", "Too few columns specified in the {array} column argument.");
        }
      }
      parser.consume();
    } else if (next === "\\end") {
      endRow();
      if (row.length === 1 && cell.type === "styling" && cell.body[0].body.length === 0 && (body.length > 1 || !emptySingleRow)) {
        body.pop();
      }
      if (hLinesBeforeRow.length < body.length + 1) {
        hLinesBeforeRow.push([]);
      }
      break;
    } else if (next === "\\\\") {
      parser.consume();
      var size = void 0;
      if (parser.gullet.future().text !== " ") {
        size = parser.parseSizeGroup(true);
      }
      rowGaps.push(size ? size.value : null);
      endRow();
      hLinesBeforeRow.push(getHLines(parser));
      row = [];
      body.push(row);
      beginRow();
    } else {
      throw new ParseError("Expected & or \\\\ or \\cr or \\end", parser.nextToken);
    }
  }
  parser.gullet.endGroup();
  parser.gullet.endGroup();
  return {
    type: "array",
    mode: parser.mode,
    addJot,
    arraystretch,
    body,
    cols,
    rowGaps,
    hskipBeforeAndAfter,
    hLinesBeforeRow,
    colSeparationType,
    tags,
    leqno
  };
}
function dCellStyle(envName) {
  if (envName.slice(0, 1) === "d") {
    return "display";
  } else {
    return "text";
  }
}
var htmlBuilder$6 = function htmlBuilder(group, options) {
  var r;
  var c;
  var nr = group.body.length;
  var hLinesBeforeRow = group.hLinesBeforeRow;
  var nc = 0;
  var body = new Array(nr);
  var hlines = [];
  var ruleThickness = Math.max(
    // From LaTeX \showthe\arrayrulewidth. Equals 0.04 em.
    options.fontMetrics().arrayRuleWidth,
    options.minRuleThickness
    // User override.
  );
  var pt = 1 / options.fontMetrics().ptPerEm;
  var arraycolsep = 5 * pt;
  if (group.colSeparationType && group.colSeparationType === "small") {
    var localMultiplier = options.havingStyle(Style$1.SCRIPT).sizeMultiplier;
    arraycolsep = 0.2778 * (localMultiplier / options.sizeMultiplier);
  }
  var baselineskip = group.colSeparationType === "CD" ? calculateSize({
    number: 3,
    unit: "ex"
  }, options) : 12 * pt;
  var jot = 3 * pt;
  var arrayskip = group.arraystretch * baselineskip;
  var arstrutHeight = 0.7 * arrayskip;
  var arstrutDepth = 0.3 * arrayskip;
  var totalHeight = 0;
  function setHLinePos(hlinesInGap) {
    for (var i = 0; i < hlinesInGap.length; ++i) {
      if (i > 0) {
        totalHeight += 0.25;
      }
      hlines.push({
        pos: totalHeight,
        isDashed: hlinesInGap[i]
      });
    }
  }
  setHLinePos(hLinesBeforeRow[0]);
  for (r = 0; r < group.body.length; ++r) {
    var inrow = group.body[r];
    var height = arstrutHeight;
    var depth = arstrutDepth;
    if (nc < inrow.length) {
      nc = inrow.length;
    }
    var outrow = new Array(inrow.length);
    for (c = 0; c < inrow.length; ++c) {
      var elt = buildGroup$1(inrow[c], options);
      if (depth < elt.depth) {
        depth = elt.depth;
      }
      if (height < elt.height) {
        height = elt.height;
      }
      outrow[c] = elt;
    }
    var rowGap = group.rowGaps[r];
    var gap = 0;
    if (rowGap) {
      gap = calculateSize(rowGap, options);
      if (gap > 0) {
        gap += arstrutDepth;
        if (depth < gap) {
          depth = gap;
        }
        gap = 0;
      }
    }
    if (group.addJot) {
      depth += jot;
    }
    outrow.height = height;
    outrow.depth = depth;
    totalHeight += height;
    outrow.pos = totalHeight;
    totalHeight += depth + gap;
    body[r] = outrow;
    setHLinePos(hLinesBeforeRow[r + 1]);
  }
  var offset = totalHeight / 2 + options.fontMetrics().axisHeight;
  var colDescriptions = group.cols || [];
  var cols = [];
  var colSep;
  var colDescrNum;
  var tagSpans = [];
  if (group.tags && group.tags.some((tag2) => tag2)) {
    for (r = 0; r < nr; ++r) {
      var rw = body[r];
      var shift = rw.pos - offset;
      var tag = group.tags[r];
      var tagSpan = void 0;
      if (tag === true) {
        tagSpan = buildCommon.makeSpan(["eqn-num"], [], options);
      } else if (tag === false) {
        tagSpan = buildCommon.makeSpan([], [], options);
      } else {
        tagSpan = buildCommon.makeSpan([], buildExpression$1(tag, options, true), options);
      }
      tagSpan.depth = rw.depth;
      tagSpan.height = rw.height;
      tagSpans.push({
        type: "elem",
        elem: tagSpan,
        shift
      });
    }
  }
  for (
    c = 0, colDescrNum = 0;
    // Continue while either there are more columns or more column
    // descriptions, so trailing separators don't get lost.
    c < nc || colDescrNum < colDescriptions.length;
    ++c, ++colDescrNum
  ) {
    var colDescr = colDescriptions[colDescrNum] || {};
    var firstSeparator = true;
    while (colDescr.type === "separator") {
      if (!firstSeparator) {
        colSep = buildCommon.makeSpan(["arraycolsep"], []);
        colSep.style.width = makeEm(options.fontMetrics().doubleRuleSep);
        cols.push(colSep);
      }
      if (colDescr.separator === "|" || colDescr.separator === ":") {
        var lineType = colDescr.separator === "|" ? "solid" : "dashed";
        var separator = buildCommon.makeSpan(["vertical-separator"], [], options);
        separator.style.height = makeEm(totalHeight);
        separator.style.borderRightWidth = makeEm(ruleThickness);
        separator.style.borderRightStyle = lineType;
        separator.style.margin = "0 " + makeEm(-ruleThickness / 2);
        var _shift = totalHeight - offset;
        if (_shift) {
          separator.style.verticalAlign = makeEm(-_shift);
        }
        cols.push(separator);
      } else {
        throw new ParseError("Invalid separator type: " + colDescr.separator);
      }
      colDescrNum++;
      colDescr = colDescriptions[colDescrNum] || {};
      firstSeparator = false;
    }
    if (c >= nc) {
      continue;
    }
    var sepwidth = void 0;
    if (c > 0 || group.hskipBeforeAndAfter) {
      sepwidth = utils.deflt(colDescr.pregap, arraycolsep);
      if (sepwidth !== 0) {
        colSep = buildCommon.makeSpan(["arraycolsep"], []);
        colSep.style.width = makeEm(sepwidth);
        cols.push(colSep);
      }
    }
    var col = [];
    for (r = 0; r < nr; ++r) {
      var row = body[r];
      var elem = row[c];
      if (!elem) {
        continue;
      }
      var _shift2 = row.pos - offset;
      elem.depth = row.depth;
      elem.height = row.height;
      col.push({
        type: "elem",
        elem,
        shift: _shift2
      });
    }
    col = buildCommon.makeVList({
      positionType: "individualShift",
      children: col
    }, options);
    col = buildCommon.makeSpan(["col-align-" + (colDescr.align || "c")], [col]);
    cols.push(col);
    if (c < nc - 1 || group.hskipBeforeAndAfter) {
      sepwidth = utils.deflt(colDescr.postgap, arraycolsep);
      if (sepwidth !== 0) {
        colSep = buildCommon.makeSpan(["arraycolsep"], []);
        colSep.style.width = makeEm(sepwidth);
        cols.push(colSep);
      }
    }
  }
  body = buildCommon.makeSpan(["mtable"], cols);
  if (hlines.length > 0) {
    var line = buildCommon.makeLineSpan("hline", options, ruleThickness);
    var dashes = buildCommon.makeLineSpan("hdashline", options, ruleThickness);
    var vListElems = [{
      type: "elem",
      elem: body,
      shift: 0
    }];
    while (hlines.length > 0) {
      var hline = hlines.pop();
      var lineShift = hline.pos - offset;
      if (hline.isDashed) {
        vListElems.push({
          type: "elem",
          elem: dashes,
          shift: lineShift
        });
      } else {
        vListElems.push({
          type: "elem",
          elem: line,
          shift: lineShift
        });
      }
    }
    body = buildCommon.makeVList({
      positionType: "individualShift",
      children: vListElems
    }, options);
  }
  if (tagSpans.length === 0) {
    return buildCommon.makeSpan(["mord"], [body], options);
  } else {
    var eqnNumCol = buildCommon.makeVList({
      positionType: "individualShift",
      children: tagSpans
    }, options);
    eqnNumCol = buildCommon.makeSpan(["tag"], [eqnNumCol], options);
    return buildCommon.makeFragment([body, eqnNumCol]);
  }
};
var alignMap = {
  c: "center ",
  l: "left ",
  r: "right "
};
var mathmlBuilder$5 = function mathmlBuilder(group, options) {
  var tbl = [];
  var glue = new mathMLTree.MathNode("mtd", [], ["mtr-glue"]);
  var tag = new mathMLTree.MathNode("mtd", [], ["mml-eqn-num"]);
  for (var i = 0; i < group.body.length; i++) {
    var rw = group.body[i];
    var row = [];
    for (var j2 = 0; j2 < rw.length; j2++) {
      row.push(new mathMLTree.MathNode("mtd", [buildGroup2(rw[j2], options)]));
    }
    if (group.tags && group.tags[i]) {
      row.unshift(glue);
      row.push(glue);
      if (group.leqno) {
        row.unshift(tag);
      } else {
        row.push(tag);
      }
    }
    tbl.push(new mathMLTree.MathNode("mtr", row));
  }
  var table = new mathMLTree.MathNode("mtable", tbl);
  var gap = group.arraystretch === 0.5 ? 0.1 : 0.16 + group.arraystretch - 1 + (group.addJot ? 0.09 : 0);
  table.setAttribute("rowspacing", makeEm(gap));
  var menclose = "";
  var align = "";
  if (group.cols && group.cols.length > 0) {
    var cols = group.cols;
    var columnLines = "";
    var prevTypeWasAlign = false;
    var iStart = 0;
    var iEnd = cols.length;
    if (cols[0].type === "separator") {
      menclose += "top ";
      iStart = 1;
    }
    if (cols[cols.length - 1].type === "separator") {
      menclose += "bottom ";
      iEnd -= 1;
    }
    for (var _i = iStart; _i < iEnd; _i++) {
      if (cols[_i].type === "align") {
        align += alignMap[cols[_i].align];
        if (prevTypeWasAlign) {
          columnLines += "none ";
        }
        prevTypeWasAlign = true;
      } else if (cols[_i].type === "separator") {
        if (prevTypeWasAlign) {
          columnLines += cols[_i].separator === "|" ? "solid " : "dashed ";
          prevTypeWasAlign = false;
        }
      }
    }
    table.setAttribute("columnalign", align.trim());
    if (/[sd]/.test(columnLines)) {
      table.setAttribute("columnlines", columnLines.trim());
    }
  }
  if (group.colSeparationType === "align") {
    var _cols = group.cols || [];
    var spacing2 = "";
    for (var _i2 = 1; _i2 < _cols.length; _i2++) {
      spacing2 += _i2 % 2 ? "0em " : "1em ";
    }
    table.setAttribute("columnspacing", spacing2.trim());
  } else if (group.colSeparationType === "alignat" || group.colSeparationType === "gather") {
    table.setAttribute("columnspacing", "0em");
  } else if (group.colSeparationType === "small") {
    table.setAttribute("columnspacing", "0.2778em");
  } else if (group.colSeparationType === "CD") {
    table.setAttribute("columnspacing", "0.5em");
  } else {
    table.setAttribute("columnspacing", "1em");
  }
  var rowLines = "";
  var hlines = group.hLinesBeforeRow;
  menclose += hlines[0].length > 0 ? "left " : "";
  menclose += hlines[hlines.length - 1].length > 0 ? "right " : "";
  for (var _i3 = 1; _i3 < hlines.length - 1; _i3++) {
    rowLines += hlines[_i3].length === 0 ? "none " : hlines[_i3][0] ? "dashed " : "solid ";
  }
  if (/[sd]/.test(rowLines)) {
    table.setAttribute("rowlines", rowLines.trim());
  }
  if (menclose !== "") {
    table = new mathMLTree.MathNode("menclose", [table]);
    table.setAttribute("notation", menclose.trim());
  }
  if (group.arraystretch && group.arraystretch < 1) {
    table = new mathMLTree.MathNode("mstyle", [table]);
    table.setAttribute("scriptlevel", "1");
  }
  return table;
};
var alignedHandler = function alignedHandler2(context, args) {
  if (context.envName.indexOf("ed") === -1) {
    validateAmsEnvironmentContext(context);
  }
  var cols = [];
  var separationType = context.envName.indexOf("at") > -1 ? "alignat" : "align";
  var isSplit = context.envName === "split";
  var res = parseArray(context.parser, {
    cols,
    addJot: true,
    autoTag: isSplit ? void 0 : getAutoTag(context.envName),
    emptySingleRow: true,
    colSeparationType: separationType,
    maxNumCols: isSplit ? 2 : void 0,
    leqno: context.parser.settings.leqno
  }, "display");
  var numMaths;
  var numCols = 0;
  var emptyGroup = {
    type: "ordgroup",
    mode: context.mode,
    body: []
  };
  if (args[0] && args[0].type === "ordgroup") {
    var arg0 = "";
    for (var i = 0; i < args[0].body.length; i++) {
      var textord2 = assertNodeType(args[0].body[i], "textord");
      arg0 += textord2.text;
    }
    numMaths = Number(arg0);
    numCols = numMaths * 2;
  }
  var isAligned = !numCols;
  res.body.forEach(function(row) {
    for (var _i4 = 1; _i4 < row.length; _i4 += 2) {
      var styling = assertNodeType(row[_i4], "styling");
      var ordgroup = assertNodeType(styling.body[0], "ordgroup");
      ordgroup.body.unshift(emptyGroup);
    }
    if (!isAligned) {
      var curMaths = row.length / 2;
      if (numMaths < curMaths) {
        throw new ParseError("Too many math in a row: " + ("expected " + numMaths + ", but got " + curMaths), row[0]);
      }
    } else if (numCols < row.length) {
      numCols = row.length;
    }
  });
  for (var _i5 = 0; _i5 < numCols; ++_i5) {
    var align = "r";
    var pregap = 0;
    if (_i5 % 2 === 1) {
      align = "l";
    } else if (_i5 > 0 && isAligned) {
      pregap = 1;
    }
    cols[_i5] = {
      type: "align",
      align,
      pregap,
      postgap: 0
    };
  }
  res.colSeparationType = isAligned ? "align" : "alignat";
  return res;
};
defineEnvironment({
  type: "array",
  names: ["array", "darray"],
  props: {
    numArgs: 1
  },
  handler(context, args) {
    var symNode = checkSymbolNodeType(args[0]);
    var colalign = symNode ? [args[0]] : assertNodeType(args[0], "ordgroup").body;
    var cols = colalign.map(function(nde) {
      var node = assertSymbolNodeType(nde);
      var ca = node.text;
      if ("lcr".indexOf(ca) !== -1) {
        return {
          type: "align",
          align: ca
        };
      } else if (ca === "|") {
        return {
          type: "separator",
          separator: "|"
        };
      } else if (ca === ":") {
        return {
          type: "separator",
          separator: ":"
        };
      }
      throw new ParseError("Unknown column alignment: " + ca, nde);
    });
    var res = {
      cols,
      hskipBeforeAndAfter: true,
      // \@preamble in lttab.dtx
      maxNumCols: cols.length
    };
    return parseArray(context.parser, res, dCellStyle(context.envName));
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "matrix*", "pmatrix*", "bmatrix*", "Bmatrix*", "vmatrix*", "Vmatrix*"],
  props: {
    numArgs: 0
  },
  handler(context) {
    var delimiters2 = {
      "matrix": null,
      "pmatrix": ["(", ")"],
      "bmatrix": ["[", "]"],
      "Bmatrix": ["\\{", "\\}"],
      "vmatrix": ["|", "|"],
      "Vmatrix": ["\\Vert", "\\Vert"]
    }[context.envName.replace("*", "")];
    var colAlign = "c";
    var payload = {
      hskipBeforeAndAfter: false,
      cols: [{
        type: "align",
        align: colAlign
      }]
    };
    if (context.envName.charAt(context.envName.length - 1) === "*") {
      var parser = context.parser;
      parser.consumeSpaces();
      if (parser.fetch().text === "[") {
        parser.consume();
        parser.consumeSpaces();
        colAlign = parser.fetch().text;
        if ("lcr".indexOf(colAlign) === -1) {
          throw new ParseError("Expected l or c or r", parser.nextToken);
        }
        parser.consume();
        parser.consumeSpaces();
        parser.expect("]");
        parser.consume();
        payload.cols = [{
          type: "align",
          align: colAlign
        }];
      }
    }
    var res = parseArray(context.parser, payload, dCellStyle(context.envName));
    var numCols = Math.max(0, ...res.body.map((row) => row.length));
    res.cols = new Array(numCols).fill({
      type: "align",
      align: colAlign
    });
    return delimiters2 ? {
      type: "leftright",
      mode: context.mode,
      body: [res],
      left: delimiters2[0],
      right: delimiters2[1],
      rightColor: void 0
      // \right uninfluenced by \color in array
    } : res;
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["smallmatrix"],
  props: {
    numArgs: 0
  },
  handler(context) {
    var payload = {
      arraystretch: 0.5
    };
    var res = parseArray(context.parser, payload, "script");
    res.colSeparationType = "small";
    return res;
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["subarray"],
  props: {
    numArgs: 1
  },
  handler(context, args) {
    var symNode = checkSymbolNodeType(args[0]);
    var colalign = symNode ? [args[0]] : assertNodeType(args[0], "ordgroup").body;
    var cols = colalign.map(function(nde) {
      var node = assertSymbolNodeType(nde);
      var ca = node.text;
      if ("lc".indexOf(ca) !== -1) {
        return {
          type: "align",
          align: ca
        };
      }
      throw new ParseError("Unknown column alignment: " + ca, nde);
    });
    if (cols.length > 1) {
      throw new ParseError("{subarray} can contain only one column");
    }
    var res = {
      cols,
      hskipBeforeAndAfter: false,
      arraystretch: 0.5
    };
    res = parseArray(context.parser, res, "script");
    if (res.body.length > 0 && res.body[0].length > 1) {
      throw new ParseError("{subarray} can contain only one column");
    }
    return res;
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["cases", "dcases", "rcases", "drcases"],
  props: {
    numArgs: 0
  },
  handler(context) {
    var payload = {
      arraystretch: 1.2,
      cols: [{
        type: "align",
        align: "l",
        pregap: 0,
        // TODO(kevinb) get the current style.
        // For now we use the metrics for TEXT style which is what we were
        // doing before.  Before attempting to get the current style we
        // should look at TeX's behavior especially for \over and matrices.
        postgap: 1
        /* 1em quad */
      }, {
        type: "align",
        align: "l",
        pregap: 0,
        postgap: 0
      }]
    };
    var res = parseArray(context.parser, payload, dCellStyle(context.envName));
    return {
      type: "leftright",
      mode: context.mode,
      body: [res],
      left: context.envName.indexOf("r") > -1 ? "." : "\\{",
      right: context.envName.indexOf("r") > -1 ? "\\}" : ".",
      rightColor: void 0
    };
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["align", "align*", "aligned", "split"],
  props: {
    numArgs: 0
  },
  handler: alignedHandler,
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["gathered", "gather", "gather*"],
  props: {
    numArgs: 0
  },
  handler(context) {
    if (utils.contains(["gather", "gather*"], context.envName)) {
      validateAmsEnvironmentContext(context);
    }
    var res = {
      cols: [{
        type: "align",
        align: "c"
      }],
      addJot: true,
      colSeparationType: "gather",
      autoTag: getAutoTag(context.envName),
      emptySingleRow: true,
      leqno: context.parser.settings.leqno
    };
    return parseArray(context.parser, res, "display");
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["alignat", "alignat*", "alignedat"],
  props: {
    numArgs: 1
  },
  handler: alignedHandler,
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["equation", "equation*"],
  props: {
    numArgs: 0
  },
  handler(context) {
    validateAmsEnvironmentContext(context);
    var res = {
      autoTag: getAutoTag(context.envName),
      emptySingleRow: true,
      singleRow: true,
      maxNumCols: 1,
      leqno: context.parser.settings.leqno
    };
    return parseArray(context.parser, res, "display");
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["CD"],
  props: {
    numArgs: 0
  },
  handler(context) {
    validateAmsEnvironmentContext(context);
    return parseCD(context.parser);
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineMacro("\\nonumber", "\\gdef\\@eqnsw{0}");
defineMacro("\\notag", "\\nonumber");
defineFunction({
  type: "text",
  // Doesn't matter what this is.
  names: ["\\hline", "\\hdashline"],
  props: {
    numArgs: 0,
    allowedInText: true,
    allowedInMath: true
  },
  handler(context, args) {
    throw new ParseError(context.funcName + " valid only within array environment");
  }
});
var environments = _environments;
defineFunction({
  type: "environment",
  names: ["\\begin", "\\end"],
  props: {
    numArgs: 1,
    argTypes: ["text"]
  },
  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    var nameGroup = args[0];
    if (nameGroup.type !== "ordgroup") {
      throw new ParseError("Invalid environment name", nameGroup);
    }
    var envName = "";
    for (var i = 0; i < nameGroup.body.length; ++i) {
      envName += assertNodeType(nameGroup.body[i], "textord").text;
    }
    if (funcName === "\\begin") {
      if (!environments.hasOwnProperty(envName)) {
        throw new ParseError("No such environment: " + envName, nameGroup);
      }
      var env = environments[envName];
      var {
        args: _args,
        optArgs
      } = parser.parseArguments("\\begin{" + envName + "}", env);
      var context = {
        mode: parser.mode,
        envName,
        parser
      };
      var result = env.handler(context, _args, optArgs);
      parser.expect("\\end", false);
      var endNameToken = parser.nextToken;
      var end = assertNodeType(parser.parseFunction(), "environment");
      if (end.name !== envName) {
        throw new ParseError("Mismatch: \\begin{" + envName + "} matched by \\end{" + end.name + "}", endNameToken);
      }
      return result;
    }
    return {
      type: "environment",
      mode: parser.mode,
      name: envName,
      nameGroup
    };
  }
});
var htmlBuilder$5 = (group, options) => {
  var font = group.font;
  var newOptions = options.withFont(font);
  return buildGroup$1(group.body, newOptions);
};
var mathmlBuilder$4 = (group, options) => {
  var font = group.font;
  var newOptions = options.withFont(font);
  return buildGroup2(group.body, newOptions);
};
var fontAliases = {
  "\\Bbb": "\\mathbb",
  "\\bold": "\\mathbf",
  "\\frak": "\\mathfrak",
  "\\bm": "\\boldsymbol"
};
defineFunction({
  type: "font",
  names: [
    // styles, except \boldsymbol defined below
    "\\mathrm",
    "\\mathit",
    "\\mathbf",
    "\\mathnormal",
    "\\mathsfit",
    // families
    "\\mathbb",
    "\\mathcal",
    "\\mathfrak",
    "\\mathscr",
    "\\mathsf",
    "\\mathtt",
    // aliases, except \bm defined below
    "\\Bbb",
    "\\bold",
    "\\frak"
  ],
  props: {
    numArgs: 1,
    allowedInArgument: true
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var body = normalizeArgument(args[0]);
    var func = funcName;
    if (func in fontAliases) {
      func = fontAliases[func];
    }
    return {
      type: "font",
      mode: parser.mode,
      font: func.slice(1),
      body
    };
  },
  htmlBuilder: htmlBuilder$5,
  mathmlBuilder: mathmlBuilder$4
});
defineFunction({
  type: "mclass",
  names: ["\\boldsymbol", "\\bm"],
  props: {
    numArgs: 1
  },
  handler: (_ref2, args) => {
    var {
      parser
    } = _ref2;
    var body = args[0];
    var isCharacterBox3 = utils.isCharacterBox(body);
    return {
      type: "mclass",
      mode: parser.mode,
      mclass: binrelClass(body),
      body: [{
        type: "font",
        mode: parser.mode,
        font: "boldsymbol",
        body
      }],
      isCharacterBox: isCharacterBox3
    };
  }
});
defineFunction({
  type: "font",
  names: ["\\rm", "\\sf", "\\tt", "\\bf", "\\it", "\\cal"],
  props: {
    numArgs: 0,
    allowedInText: true
  },
  handler: (_ref3, args) => {
    var {
      parser,
      funcName,
      breakOnTokenText
    } = _ref3;
    var {
      mode
    } = parser;
    var body = parser.parseExpression(true, breakOnTokenText);
    var style = "math" + funcName.slice(1);
    return {
      type: "font",
      mode,
      font: style,
      body: {
        type: "ordgroup",
        mode: parser.mode,
        body
      }
    };
  },
  htmlBuilder: htmlBuilder$5,
  mathmlBuilder: mathmlBuilder$4
});
var adjustStyle = (size, originalStyle) => {
  var style = originalStyle;
  if (size === "display") {
    style = style.id >= Style$1.SCRIPT.id ? style.text() : Style$1.DISPLAY;
  } else if (size === "text" && style.size === Style$1.DISPLAY.size) {
    style = Style$1.TEXT;
  } else if (size === "script") {
    style = Style$1.SCRIPT;
  } else if (size === "scriptscript") {
    style = Style$1.SCRIPTSCRIPT;
  }
  return style;
};
var htmlBuilder$4 = (group, options) => {
  var style = adjustStyle(group.size, options.style);
  var nstyle = style.fracNum();
  var dstyle = style.fracDen();
  var newOptions;
  newOptions = options.havingStyle(nstyle);
  var numerm = buildGroup$1(group.numer, newOptions, options);
  if (group.continued) {
    var hStrut = 8.5 / options.fontMetrics().ptPerEm;
    var dStrut = 3.5 / options.fontMetrics().ptPerEm;
    numerm.height = numerm.height < hStrut ? hStrut : numerm.height;
    numerm.depth = numerm.depth < dStrut ? dStrut : numerm.depth;
  }
  newOptions = options.havingStyle(dstyle);
  var denomm = buildGroup$1(group.denom, newOptions, options);
  var rule;
  var ruleWidth;
  var ruleSpacing;
  if (group.hasBarLine) {
    if (group.barSize) {
      ruleWidth = calculateSize(group.barSize, options);
      rule = buildCommon.makeLineSpan("frac-line", options, ruleWidth);
    } else {
      rule = buildCommon.makeLineSpan("frac-line", options);
    }
    ruleWidth = rule.height;
    ruleSpacing = rule.height;
  } else {
    rule = null;
    ruleWidth = 0;
    ruleSpacing = options.fontMetrics().defaultRuleThickness;
  }
  var numShift;
  var clearance;
  var denomShift;
  if (style.size === Style$1.DISPLAY.size || group.size === "display") {
    numShift = options.fontMetrics().num1;
    if (ruleWidth > 0) {
      clearance = 3 * ruleSpacing;
    } else {
      clearance = 7 * ruleSpacing;
    }
    denomShift = options.fontMetrics().denom1;
  } else {
    if (ruleWidth > 0) {
      numShift = options.fontMetrics().num2;
      clearance = ruleSpacing;
    } else {
      numShift = options.fontMetrics().num3;
      clearance = 3 * ruleSpacing;
    }
    denomShift = options.fontMetrics().denom2;
  }
  var frac;
  if (!rule) {
    var candidateClearance = numShift - numerm.depth - (denomm.height - denomShift);
    if (candidateClearance < clearance) {
      numShift += 0.5 * (clearance - candidateClearance);
      denomShift += 0.5 * (clearance - candidateClearance);
    }
    frac = buildCommon.makeVList({
      positionType: "individualShift",
      children: [{
        type: "elem",
        elem: denomm,
        shift: denomShift
      }, {
        type: "elem",
        elem: numerm,
        shift: -numShift
      }]
    }, options);
  } else {
    var axisHeight = options.fontMetrics().axisHeight;
    if (numShift - numerm.depth - (axisHeight + 0.5 * ruleWidth) < clearance) {
      numShift += clearance - (numShift - numerm.depth - (axisHeight + 0.5 * ruleWidth));
    }
    if (axisHeight - 0.5 * ruleWidth - (denomm.height - denomShift) < clearance) {
      denomShift += clearance - (axisHeight - 0.5 * ruleWidth - (denomm.height - denomShift));
    }
    var midShift = -(axisHeight - 0.5 * ruleWidth);
    frac = buildCommon.makeVList({
      positionType: "individualShift",
      children: [{
        type: "elem",
        elem: denomm,
        shift: denomShift
      }, {
        type: "elem",
        elem: rule,
        shift: midShift
      }, {
        type: "elem",
        elem: numerm,
        shift: -numShift
      }]
    }, options);
  }
  newOptions = options.havingStyle(style);
  frac.height *= newOptions.sizeMultiplier / options.sizeMultiplier;
  frac.depth *= newOptions.sizeMultiplier / options.sizeMultiplier;
  var delimSize;
  if (style.size === Style$1.DISPLAY.size) {
    delimSize = options.fontMetrics().delim1;
  } else if (style.size === Style$1.SCRIPTSCRIPT.size) {
    delimSize = options.havingStyle(Style$1.SCRIPT).fontMetrics().delim2;
  } else {
    delimSize = options.fontMetrics().delim2;
  }
  var leftDelim;
  var rightDelim;
  if (group.leftDelim == null) {
    leftDelim = makeNullDelimiter(options, ["mopen"]);
  } else {
    leftDelim = delimiter.customSizedDelim(group.leftDelim, delimSize, true, options.havingStyle(style), group.mode, ["mopen"]);
  }
  if (group.continued) {
    rightDelim = buildCommon.makeSpan([]);
  } else if (group.rightDelim == null) {
    rightDelim = makeNullDelimiter(options, ["mclose"]);
  } else {
    rightDelim = delimiter.customSizedDelim(group.rightDelim, delimSize, true, options.havingStyle(style), group.mode, ["mclose"]);
  }
  return buildCommon.makeSpan(["mord"].concat(newOptions.sizingClasses(options)), [leftDelim, buildCommon.makeSpan(["mfrac"], [frac]), rightDelim], options);
};
var mathmlBuilder$3 = (group, options) => {
  var node = new mathMLTree.MathNode("mfrac", [buildGroup2(group.numer, options), buildGroup2(group.denom, options)]);
  if (!group.hasBarLine) {
    node.setAttribute("linethickness", "0px");
  } else if (group.barSize) {
    var ruleWidth = calculateSize(group.barSize, options);
    node.setAttribute("linethickness", makeEm(ruleWidth));
  }
  var style = adjustStyle(group.size, options.style);
  if (style.size !== options.style.size) {
    node = new mathMLTree.MathNode("mstyle", [node]);
    var isDisplay = style.size === Style$1.DISPLAY.size ? "true" : "false";
    node.setAttribute("displaystyle", isDisplay);
    node.setAttribute("scriptlevel", "0");
  }
  if (group.leftDelim != null || group.rightDelim != null) {
    var withDelims = [];
    if (group.leftDelim != null) {
      var leftOp = new mathMLTree.MathNode("mo", [new mathMLTree.TextNode(group.leftDelim.replace("\\", ""))]);
      leftOp.setAttribute("fence", "true");
      withDelims.push(leftOp);
    }
    withDelims.push(node);
    if (group.rightDelim != null) {
      var rightOp = new mathMLTree.MathNode("mo", [new mathMLTree.TextNode(group.rightDelim.replace("\\", ""))]);
      rightOp.setAttribute("fence", "true");
      withDelims.push(rightOp);
    }
    return makeRow(withDelims);
  }
  return node;
};
defineFunction({
  type: "genfrac",
  names: [
    "\\dfrac",
    "\\frac",
    "\\tfrac",
    "\\dbinom",
    "\\binom",
    "\\tbinom",
    "\\\\atopfrac",
    // can’t be entered directly
    "\\\\bracefrac",
    "\\\\brackfrac"
    // ditto
  ],
  props: {
    numArgs: 2,
    allowedInArgument: true
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var numer = args[0];
    var denom = args[1];
    var hasBarLine;
    var leftDelim = null;
    var rightDelim = null;
    var size = "auto";
    switch (funcName) {
      case "\\dfrac":
      case "\\frac":
      case "\\tfrac":
        hasBarLine = true;
        break;
      case "\\\\atopfrac":
        hasBarLine = false;
        break;
      case "\\dbinom":
      case "\\binom":
      case "\\tbinom":
        hasBarLine = false;
        leftDelim = "(";
        rightDelim = ")";
        break;
      case "\\\\bracefrac":
        hasBarLine = false;
        leftDelim = "\\{";
        rightDelim = "\\}";
        break;
      case "\\\\brackfrac":
        hasBarLine = false;
        leftDelim = "[";
        rightDelim = "]";
        break;
      default:
        throw new Error("Unrecognized genfrac command");
    }
    switch (funcName) {
      case "\\dfrac":
      case "\\dbinom":
        size = "display";
        break;
      case "\\tfrac":
      case "\\tbinom":
        size = "text";
        break;
    }
    return {
      type: "genfrac",
      mode: parser.mode,
      continued: false,
      numer,
      denom,
      hasBarLine,
      leftDelim,
      rightDelim,
      size,
      barSize: null
    };
  },
  htmlBuilder: htmlBuilder$4,
  mathmlBuilder: mathmlBuilder$3
});
defineFunction({
  type: "genfrac",
  names: ["\\cfrac"],
  props: {
    numArgs: 2
  },
  handler: (_ref2, args) => {
    var {
      parser,
      funcName
    } = _ref2;
    var numer = args[0];
    var denom = args[1];
    return {
      type: "genfrac",
      mode: parser.mode,
      continued: true,
      numer,
      denom,
      hasBarLine: true,
      leftDelim: null,
      rightDelim: null,
      size: "display",
      barSize: null
    };
  }
});
defineFunction({
  type: "infix",
  names: ["\\over", "\\choose", "\\atop", "\\brace", "\\brack"],
  props: {
    numArgs: 0,
    infix: true
  },
  handler(_ref3) {
    var {
      parser,
      funcName,
      token
    } = _ref3;
    var replaceWith;
    switch (funcName) {
      case "\\over":
        replaceWith = "\\frac";
        break;
      case "\\choose":
        replaceWith = "\\binom";
        break;
      case "\\atop":
        replaceWith = "\\\\atopfrac";
        break;
      case "\\brace":
        replaceWith = "\\\\bracefrac";
        break;
      case "\\brack":
        replaceWith = "\\\\brackfrac";
        break;
      default:
        throw new Error("Unrecognized infix genfrac command");
    }
    return {
      type: "infix",
      mode: parser.mode,
      replaceWith,
      token
    };
  }
});
var stylArray = ["display", "text", "script", "scriptscript"];
var delimFromValue = function delimFromValue2(delimString) {
  var delim = null;
  if (delimString.length > 0) {
    delim = delimString;
    delim = delim === "." ? null : delim;
  }
  return delim;
};
defineFunction({
  type: "genfrac",
  names: ["\\genfrac"],
  props: {
    numArgs: 6,
    allowedInArgument: true,
    argTypes: ["math", "math", "size", "text", "math", "math"]
  },
  handler(_ref4, args) {
    var {
      parser
    } = _ref4;
    var numer = args[4];
    var denom = args[5];
    var leftNode = normalizeArgument(args[0]);
    var leftDelim = leftNode.type === "atom" && leftNode.family === "open" ? delimFromValue(leftNode.text) : null;
    var rightNode = normalizeArgument(args[1]);
    var rightDelim = rightNode.type === "atom" && rightNode.family === "close" ? delimFromValue(rightNode.text) : null;
    var barNode = assertNodeType(args[2], "size");
    var hasBarLine;
    var barSize = null;
    if (barNode.isBlank) {
      hasBarLine = true;
    } else {
      barSize = barNode.value;
      hasBarLine = barSize.number > 0;
    }
    var size = "auto";
    var styl = args[3];
    if (styl.type === "ordgroup") {
      if (styl.body.length > 0) {
        var textOrd = assertNodeType(styl.body[0], "textord");
        size = stylArray[Number(textOrd.text)];
      }
    } else {
      styl = assertNodeType(styl, "textord");
      size = stylArray[Number(styl.text)];
    }
    return {
      type: "genfrac",
      mode: parser.mode,
      numer,
      denom,
      continued: false,
      hasBarLine,
      barSize,
      leftDelim,
      rightDelim,
      size
    };
  },
  htmlBuilder: htmlBuilder$4,
  mathmlBuilder: mathmlBuilder$3
});
defineFunction({
  type: "infix",
  names: ["\\above"],
  props: {
    numArgs: 1,
    argTypes: ["size"],
    infix: true
  },
  handler(_ref5, args) {
    var {
      parser,
      funcName,
      token
    } = _ref5;
    return {
      type: "infix",
      mode: parser.mode,
      replaceWith: "\\\\abovefrac",
      size: assertNodeType(args[0], "size").value,
      token
    };
  }
});
defineFunction({
  type: "genfrac",
  names: ["\\\\abovefrac"],
  props: {
    numArgs: 3,
    argTypes: ["math", "size", "math"]
  },
  handler: (_ref6, args) => {
    var {
      parser,
      funcName
    } = _ref6;
    var numer = args[0];
    var barSize = assert(assertNodeType(args[1], "infix").size);
    var denom = args[2];
    var hasBarLine = barSize.number > 0;
    return {
      type: "genfrac",
      mode: parser.mode,
      numer,
      denom,
      continued: false,
      hasBarLine,
      barSize,
      leftDelim: null,
      rightDelim: null,
      size: "auto"
    };
  },
  htmlBuilder: htmlBuilder$4,
  mathmlBuilder: mathmlBuilder$3
});
var htmlBuilder$3 = (grp, options) => {
  var style = options.style;
  var supSubGroup;
  var group;
  if (grp.type === "supsub") {
    supSubGroup = grp.sup ? buildGroup$1(grp.sup, options.havingStyle(style.sup()), options) : buildGroup$1(grp.sub, options.havingStyle(style.sub()), options);
    group = assertNodeType(grp.base, "horizBrace");
  } else {
    group = assertNodeType(grp, "horizBrace");
  }
  var body = buildGroup$1(group.base, options.havingBaseStyle(Style$1.DISPLAY));
  var braceBody = stretchy.svgSpan(group, options);
  var vlist;
  if (group.isOver) {
    vlist = buildCommon.makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: body
      }, {
        type: "kern",
        size: 0.1
      }, {
        type: "elem",
        elem: braceBody
      }]
    }, options);
    vlist.children[0].children[0].children[1].classes.push("svg-align");
  } else {
    vlist = buildCommon.makeVList({
      positionType: "bottom",
      positionData: body.depth + 0.1 + braceBody.height,
      children: [{
        type: "elem",
        elem: braceBody
      }, {
        type: "kern",
        size: 0.1
      }, {
        type: "elem",
        elem: body
      }]
    }, options);
    vlist.children[0].children[0].children[0].classes.push("svg-align");
  }
  if (supSubGroup) {
    var vSpan = buildCommon.makeSpan(["mord", group.isOver ? "mover" : "munder"], [vlist], options);
    if (group.isOver) {
      vlist = buildCommon.makeVList({
        positionType: "firstBaseline",
        children: [{
          type: "elem",
          elem: vSpan
        }, {
          type: "kern",
          size: 0.2
        }, {
          type: "elem",
          elem: supSubGroup
        }]
      }, options);
    } else {
      vlist = buildCommon.makeVList({
        positionType: "bottom",
        positionData: vSpan.depth + 0.2 + supSubGroup.height + supSubGroup.depth,
        children: [{
          type: "elem",
          elem: supSubGroup
        }, {
          type: "kern",
          size: 0.2
        }, {
          type: "elem",
          elem: vSpan
        }]
      }, options);
    }
  }
  return buildCommon.makeSpan(["mord", group.isOver ? "mover" : "munder"], [vlist], options);
};
var mathmlBuilder$2 = (group, options) => {
  var accentNode = stretchy.mathMLnode(group.label);
  return new mathMLTree.MathNode(group.isOver ? "mover" : "munder", [buildGroup2(group.base, options), accentNode]);
};
defineFunction({
  type: "horizBrace",
  names: ["\\overbrace", "\\underbrace"],
  props: {
    numArgs: 1
  },
  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    return {
      type: "horizBrace",
      mode: parser.mode,
      label: funcName,
      isOver: /^\\over/.test(funcName),
      base: args[0]
    };
  },
  htmlBuilder: htmlBuilder$3,
  mathmlBuilder: mathmlBuilder$2
});
defineFunction({
  type: "href",
  names: ["\\href"],
  props: {
    numArgs: 2,
    argTypes: ["url", "original"],
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      parser
    } = _ref;
    var body = args[1];
    var href = assertNodeType(args[0], "url").url;
    if (!parser.settings.isTrusted({
      command: "\\href",
      url: href
    })) {
      return parser.formatUnsupportedCmd("\\href");
    }
    return {
      type: "href",
      mode: parser.mode,
      href,
      body: ordargument(body)
    };
  },
  htmlBuilder: (group, options) => {
    var elements = buildExpression$1(group.body, options, false);
    return buildCommon.makeAnchor(group.href, [], elements, options);
  },
  mathmlBuilder: (group, options) => {
    var math2 = buildExpressionRow(group.body, options);
    if (!(math2 instanceof MathNode)) {
      math2 = new MathNode("mrow", [math2]);
    }
    math2.setAttribute("href", group.href);
    return math2;
  }
});
defineFunction({
  type: "href",
  names: ["\\url"],
  props: {
    numArgs: 1,
    argTypes: ["url"],
    allowedInText: true
  },
  handler: (_ref2, args) => {
    var {
      parser
    } = _ref2;
    var href = assertNodeType(args[0], "url").url;
    if (!parser.settings.isTrusted({
      command: "\\url",
      url: href
    })) {
      return parser.formatUnsupportedCmd("\\url");
    }
    var chars = [];
    for (var i = 0; i < href.length; i++) {
      var c = href[i];
      if (c === "~") {
        c = "\\textasciitilde";
      }
      chars.push({
        type: "textord",
        mode: "text",
        text: c
      });
    }
    var body = {
      type: "text",
      mode: parser.mode,
      font: "\\texttt",
      body: chars
    };
    return {
      type: "href",
      mode: parser.mode,
      href,
      body: ordargument(body)
    };
  }
});
defineFunction({
  type: "hbox",
  names: ["\\hbox"],
  props: {
    numArgs: 1,
    argTypes: ["text"],
    allowedInText: true,
    primitive: true
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    return {
      type: "hbox",
      mode: parser.mode,
      body: ordargument(args[0])
    };
  },
  htmlBuilder(group, options) {
    var elements = buildExpression$1(group.body, options, false);
    return buildCommon.makeFragment(elements);
  },
  mathmlBuilder(group, options) {
    return new mathMLTree.MathNode("mrow", buildExpression2(group.body, options));
  }
});
defineFunction({
  type: "html",
  names: ["\\htmlClass", "\\htmlId", "\\htmlStyle", "\\htmlData"],
  props: {
    numArgs: 2,
    argTypes: ["raw", "original"],
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName,
      token
    } = _ref;
    var value = assertNodeType(args[0], "raw").string;
    var body = args[1];
    if (parser.settings.strict) {
      parser.settings.reportNonstrict("htmlExtension", "HTML extension is disabled on strict mode");
    }
    var trustContext;
    var attributes = {};
    switch (funcName) {
      case "\\htmlClass":
        attributes.class = value;
        trustContext = {
          command: "\\htmlClass",
          class: value
        };
        break;
      case "\\htmlId":
        attributes.id = value;
        trustContext = {
          command: "\\htmlId",
          id: value
        };
        break;
      case "\\htmlStyle":
        attributes.style = value;
        trustContext = {
          command: "\\htmlStyle",
          style: value
        };
        break;
      case "\\htmlData": {
        var data = value.split(",");
        for (var i = 0; i < data.length; i++) {
          var keyVal = data[i].split("=");
          if (keyVal.length !== 2) {
            throw new ParseError("Error parsing key-value for \\htmlData");
          }
          attributes["data-" + keyVal[0].trim()] = keyVal[1].trim();
        }
        trustContext = {
          command: "\\htmlData",
          attributes
        };
        break;
      }
      default:
        throw new Error("Unrecognized html command");
    }
    if (!parser.settings.isTrusted(trustContext)) {
      return parser.formatUnsupportedCmd(funcName);
    }
    return {
      type: "html",
      mode: parser.mode,
      attributes,
      body: ordargument(body)
    };
  },
  htmlBuilder: (group, options) => {
    var elements = buildExpression$1(group.body, options, false);
    var classes = ["enclosing"];
    if (group.attributes.class) {
      classes.push(...group.attributes.class.trim().split(/\s+/));
    }
    var span = buildCommon.makeSpan(classes, elements, options);
    for (var attr in group.attributes) {
      if (attr !== "class" && group.attributes.hasOwnProperty(attr)) {
        span.setAttribute(attr, group.attributes[attr]);
      }
    }
    return span;
  },
  mathmlBuilder: (group, options) => {
    return buildExpressionRow(group.body, options);
  }
});
defineFunction({
  type: "htmlmathml",
  names: ["\\html@mathml"],
  props: {
    numArgs: 2,
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      parser
    } = _ref;
    return {
      type: "htmlmathml",
      mode: parser.mode,
      html: ordargument(args[0]),
      mathml: ordargument(args[1])
    };
  },
  htmlBuilder: (group, options) => {
    var elements = buildExpression$1(group.html, options, false);
    return buildCommon.makeFragment(elements);
  },
  mathmlBuilder: (group, options) => {
    return buildExpressionRow(group.mathml, options);
  }
});
var sizeData = function sizeData2(str) {
  if (/^[-+]? *(\d+(\.\d*)?|\.\d+)$/.test(str)) {
    return {
      number: +str,
      unit: "bp"
    };
  } else {
    var match = /([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(str);
    if (!match) {
      throw new ParseError("Invalid size: '" + str + "' in \\includegraphics");
    }
    var data = {
      number: +(match[1] + match[2]),
      // sign + magnitude, cast to number
      unit: match[3]
    };
    if (!validUnit(data)) {
      throw new ParseError("Invalid unit: '" + data.unit + "' in \\includegraphics.");
    }
    return data;
  }
};
defineFunction({
  type: "includegraphics",
  names: ["\\includegraphics"],
  props: {
    numArgs: 1,
    numOptionalArgs: 1,
    argTypes: ["raw", "url"],
    allowedInText: false
  },
  handler: (_ref, args, optArgs) => {
    var {
      parser
    } = _ref;
    var width = {
      number: 0,
      unit: "em"
    };
    var height = {
      number: 0.9,
      unit: "em"
    };
    var totalheight = {
      number: 0,
      unit: "em"
    };
    var alt = "";
    if (optArgs[0]) {
      var attributeStr = assertNodeType(optArgs[0], "raw").string;
      var attributes = attributeStr.split(",");
      for (var i = 0; i < attributes.length; i++) {
        var keyVal = attributes[i].split("=");
        if (keyVal.length === 2) {
          var str = keyVal[1].trim();
          switch (keyVal[0].trim()) {
            case "alt":
              alt = str;
              break;
            case "width":
              width = sizeData(str);
              break;
            case "height":
              height = sizeData(str);
              break;
            case "totalheight":
              totalheight = sizeData(str);
              break;
            default:
              throw new ParseError("Invalid key: '" + keyVal[0] + "' in \\includegraphics.");
          }
        }
      }
    }
    var src = assertNodeType(args[0], "url").url;
    if (alt === "") {
      alt = src;
      alt = alt.replace(/^.*[\\/]/, "");
      alt = alt.substring(0, alt.lastIndexOf("."));
    }
    if (!parser.settings.isTrusted({
      command: "\\includegraphics",
      url: src
    })) {
      return parser.formatUnsupportedCmd("\\includegraphics");
    }
    return {
      type: "includegraphics",
      mode: parser.mode,
      alt,
      width,
      height,
      totalheight,
      src
    };
  },
  htmlBuilder: (group, options) => {
    var height = calculateSize(group.height, options);
    var depth = 0;
    if (group.totalheight.number > 0) {
      depth = calculateSize(group.totalheight, options) - height;
    }
    var width = 0;
    if (group.width.number > 0) {
      width = calculateSize(group.width, options);
    }
    var style = {
      height: makeEm(height + depth)
    };
    if (width > 0) {
      style.width = makeEm(width);
    }
    if (depth > 0) {
      style.verticalAlign = makeEm(-depth);
    }
    var node = new Img(group.src, group.alt, style);
    node.height = height;
    node.depth = depth;
    return node;
  },
  mathmlBuilder: (group, options) => {
    var node = new mathMLTree.MathNode("mglyph", []);
    node.setAttribute("alt", group.alt);
    var height = calculateSize(group.height, options);
    var depth = 0;
    if (group.totalheight.number > 0) {
      depth = calculateSize(group.totalheight, options) - height;
      node.setAttribute("valign", makeEm(-depth));
    }
    node.setAttribute("height", makeEm(height + depth));
    if (group.width.number > 0) {
      var width = calculateSize(group.width, options);
      node.setAttribute("width", makeEm(width));
    }
    node.setAttribute("src", group.src);
    return node;
  }
});
defineFunction({
  type: "kern",
  names: ["\\kern", "\\mkern", "\\hskip", "\\mskip"],
  props: {
    numArgs: 1,
    argTypes: ["size"],
    primitive: true,
    allowedInText: true
  },
  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    var size = assertNodeType(args[0], "size");
    if (parser.settings.strict) {
      var mathFunction = funcName[1] === "m";
      var muUnit = size.value.unit === "mu";
      if (mathFunction) {
        if (!muUnit) {
          parser.settings.reportNonstrict("mathVsTextUnits", "LaTeX's " + funcName + " supports only mu units, " + ("not " + size.value.unit + " units"));
        }
        if (parser.mode !== "math") {
          parser.settings.reportNonstrict("mathVsTextUnits", "LaTeX's " + funcName + " works only in math mode");
        }
      } else {
        if (muUnit) {
          parser.settings.reportNonstrict("mathVsTextUnits", "LaTeX's " + funcName + " doesn't support mu units");
        }
      }
    }
    return {
      type: "kern",
      mode: parser.mode,
      dimension: size.value
    };
  },
  htmlBuilder(group, options) {
    return buildCommon.makeGlue(group.dimension, options);
  },
  mathmlBuilder(group, options) {
    var dimension = calculateSize(group.dimension, options);
    return new mathMLTree.SpaceNode(dimension);
  }
});
defineFunction({
  type: "lap",
  names: ["\\mathllap", "\\mathrlap", "\\mathclap"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var body = args[0];
    return {
      type: "lap",
      mode: parser.mode,
      alignment: funcName.slice(5),
      body
    };
  },
  htmlBuilder: (group, options) => {
    var inner2;
    if (group.alignment === "clap") {
      inner2 = buildCommon.makeSpan([], [buildGroup$1(group.body, options)]);
      inner2 = buildCommon.makeSpan(["inner"], [inner2], options);
    } else {
      inner2 = buildCommon.makeSpan(["inner"], [buildGroup$1(group.body, options)]);
    }
    var fix = buildCommon.makeSpan(["fix"], []);
    var node = buildCommon.makeSpan([group.alignment], [inner2, fix], options);
    var strut = buildCommon.makeSpan(["strut"]);
    strut.style.height = makeEm(node.height + node.depth);
    if (node.depth) {
      strut.style.verticalAlign = makeEm(-node.depth);
    }
    node.children.unshift(strut);
    node = buildCommon.makeSpan(["thinbox"], [node], options);
    return buildCommon.makeSpan(["mord", "vbox"], [node], options);
  },
  mathmlBuilder: (group, options) => {
    var node = new mathMLTree.MathNode("mpadded", [buildGroup2(group.body, options)]);
    if (group.alignment !== "rlap") {
      var offset = group.alignment === "llap" ? "-1" : "-0.5";
      node.setAttribute("lspace", offset + "width");
    }
    node.setAttribute("width", "0px");
    return node;
  }
});
defineFunction({
  type: "styling",
  names: ["\\(", "$"],
  props: {
    numArgs: 0,
    allowedInText: true,
    allowedInMath: false
  },
  handler(_ref, args) {
    var {
      funcName,
      parser
    } = _ref;
    var outerMode = parser.mode;
    parser.switchMode("math");
    var close2 = funcName === "\\(" ? "\\)" : "$";
    var body = parser.parseExpression(false, close2);
    parser.expect(close2);
    parser.switchMode(outerMode);
    return {
      type: "styling",
      mode: parser.mode,
      style: "text",
      body
    };
  }
});
defineFunction({
  type: "text",
  // Doesn't matter what this is.
  names: ["\\)", "\\]"],
  props: {
    numArgs: 0,
    allowedInText: true,
    allowedInMath: false
  },
  handler(context, args) {
    throw new ParseError("Mismatched " + context.funcName);
  }
});
var chooseMathStyle = (group, options) => {
  switch (options.style.size) {
    case Style$1.DISPLAY.size:
      return group.display;
    case Style$1.TEXT.size:
      return group.text;
    case Style$1.SCRIPT.size:
      return group.script;
    case Style$1.SCRIPTSCRIPT.size:
      return group.scriptscript;
    default:
      return group.text;
  }
};
defineFunction({
  type: "mathchoice",
  names: ["\\mathchoice"],
  props: {
    numArgs: 4,
    primitive: true
  },
  handler: (_ref, args) => {
    var {
      parser
    } = _ref;
    return {
      type: "mathchoice",
      mode: parser.mode,
      display: ordargument(args[0]),
      text: ordargument(args[1]),
      script: ordargument(args[2]),
      scriptscript: ordargument(args[3])
    };
  },
  htmlBuilder: (group, options) => {
    var body = chooseMathStyle(group, options);
    var elements = buildExpression$1(body, options, false);
    return buildCommon.makeFragment(elements);
  },
  mathmlBuilder: (group, options) => {
    var body = chooseMathStyle(group, options);
    return buildExpressionRow(body, options);
  }
});
var assembleSupSub = (base, supGroup, subGroup, options, style, slant, baseShift) => {
  base = buildCommon.makeSpan([], [base]);
  var subIsSingleCharacter = subGroup && utils.isCharacterBox(subGroup);
  var sub2;
  var sup2;
  if (supGroup) {
    var elem = buildGroup$1(supGroup, options.havingStyle(style.sup()), options);
    sup2 = {
      elem,
      kern: Math.max(options.fontMetrics().bigOpSpacing1, options.fontMetrics().bigOpSpacing3 - elem.depth)
    };
  }
  if (subGroup) {
    var _elem = buildGroup$1(subGroup, options.havingStyle(style.sub()), options);
    sub2 = {
      elem: _elem,
      kern: Math.max(options.fontMetrics().bigOpSpacing2, options.fontMetrics().bigOpSpacing4 - _elem.height)
    };
  }
  var finalGroup;
  if (sup2 && sub2) {
    var bottom = options.fontMetrics().bigOpSpacing5 + sub2.elem.height + sub2.elem.depth + sub2.kern + base.depth + baseShift;
    finalGroup = buildCommon.makeVList({
      positionType: "bottom",
      positionData: bottom,
      children: [{
        type: "kern",
        size: options.fontMetrics().bigOpSpacing5
      }, {
        type: "elem",
        elem: sub2.elem,
        marginLeft: makeEm(-slant)
      }, {
        type: "kern",
        size: sub2.kern
      }, {
        type: "elem",
        elem: base
      }, {
        type: "kern",
        size: sup2.kern
      }, {
        type: "elem",
        elem: sup2.elem,
        marginLeft: makeEm(slant)
      }, {
        type: "kern",
        size: options.fontMetrics().bigOpSpacing5
      }]
    }, options);
  } else if (sub2) {
    var top = base.height - baseShift;
    finalGroup = buildCommon.makeVList({
      positionType: "top",
      positionData: top,
      children: [{
        type: "kern",
        size: options.fontMetrics().bigOpSpacing5
      }, {
        type: "elem",
        elem: sub2.elem,
        marginLeft: makeEm(-slant)
      }, {
        type: "kern",
        size: sub2.kern
      }, {
        type: "elem",
        elem: base
      }]
    }, options);
  } else if (sup2) {
    var _bottom = base.depth + baseShift;
    finalGroup = buildCommon.makeVList({
      positionType: "bottom",
      positionData: _bottom,
      children: [{
        type: "elem",
        elem: base
      }, {
        type: "kern",
        size: sup2.kern
      }, {
        type: "elem",
        elem: sup2.elem,
        marginLeft: makeEm(slant)
      }, {
        type: "kern",
        size: options.fontMetrics().bigOpSpacing5
      }]
    }, options);
  } else {
    return base;
  }
  var parts = [finalGroup];
  if (sub2 && slant !== 0 && !subIsSingleCharacter) {
    var spacer = buildCommon.makeSpan(["mspace"], [], options);
    spacer.style.marginRight = makeEm(slant);
    parts.unshift(spacer);
  }
  return buildCommon.makeSpan(["mop", "op-limits"], parts, options);
};
var noSuccessor = ["\\smallint"];
var htmlBuilder$2 = (grp, options) => {
  var supGroup;
  var subGroup;
  var hasLimits = false;
  var group;
  if (grp.type === "supsub") {
    supGroup = grp.sup;
    subGroup = grp.sub;
    group = assertNodeType(grp.base, "op");
    hasLimits = true;
  } else {
    group = assertNodeType(grp, "op");
  }
  var style = options.style;
  var large = false;
  if (style.size === Style$1.DISPLAY.size && group.symbol && !utils.contains(noSuccessor, group.name)) {
    large = true;
  }
  var base;
  if (group.symbol) {
    var fontName = large ? "Size2-Regular" : "Size1-Regular";
    var stash = "";
    if (group.name === "\\oiint" || group.name === "\\oiiint") {
      stash = group.name.slice(1);
      group.name = stash === "oiint" ? "\\iint" : "\\iiint";
    }
    base = buildCommon.makeSymbol(group.name, fontName, "math", options, ["mop", "op-symbol", large ? "large-op" : "small-op"]);
    if (stash.length > 0) {
      var italic = base.italic;
      var oval = buildCommon.staticSvg(stash + "Size" + (large ? "2" : "1"), options);
      base = buildCommon.makeVList({
        positionType: "individualShift",
        children: [{
          type: "elem",
          elem: base,
          shift: 0
        }, {
          type: "elem",
          elem: oval,
          shift: large ? 0.08 : 0
        }]
      }, options);
      group.name = "\\" + stash;
      base.classes.unshift("mop");
      base.italic = italic;
    }
  } else if (group.body) {
    var inner2 = buildExpression$1(group.body, options, true);
    if (inner2.length === 1 && inner2[0] instanceof SymbolNode) {
      base = inner2[0];
      base.classes[0] = "mop";
    } else {
      base = buildCommon.makeSpan(["mop"], inner2, options);
    }
  } else {
    var output = [];
    for (var i = 1; i < group.name.length; i++) {
      output.push(buildCommon.mathsym(group.name[i], group.mode, options));
    }
    base = buildCommon.makeSpan(["mop"], output, options);
  }
  var baseShift = 0;
  var slant = 0;
  if ((base instanceof SymbolNode || group.name === "\\oiint" || group.name === "\\oiiint") && !group.suppressBaseShift) {
    baseShift = (base.height - base.depth) / 2 - options.fontMetrics().axisHeight;
    slant = base.italic;
  }
  if (hasLimits) {
    return assembleSupSub(base, supGroup, subGroup, options, style, slant, baseShift);
  } else {
    if (baseShift) {
      base.style.position = "relative";
      base.style.top = makeEm(baseShift);
    }
    return base;
  }
};
var mathmlBuilder$1 = (group, options) => {
  var node;
  if (group.symbol) {
    node = new MathNode("mo", [makeText(group.name, group.mode)]);
    if (utils.contains(noSuccessor, group.name)) {
      node.setAttribute("largeop", "false");
    }
  } else if (group.body) {
    node = new MathNode("mo", buildExpression2(group.body, options));
  } else {
    node = new MathNode("mi", [new TextNode(group.name.slice(1))]);
    var operator = new MathNode("mo", [makeText("\u2061", "text")]);
    if (group.parentIsSupSub) {
      node = new MathNode("mrow", [node, operator]);
    } else {
      node = newDocumentFragment([node, operator]);
    }
  }
  return node;
};
var singleCharBigOps = {
  "\u220F": "\\prod",
  "\u2210": "\\coprod",
  "\u2211": "\\sum",
  "\u22C0": "\\bigwedge",
  "\u22C1": "\\bigvee",
  "\u22C2": "\\bigcap",
  "\u22C3": "\\bigcup",
  "\u2A00": "\\bigodot",
  "\u2A01": "\\bigoplus",
  "\u2A02": "\\bigotimes",
  "\u2A04": "\\biguplus",
  "\u2A06": "\\bigsqcup"
};
defineFunction({
  type: "op",
  names: ["\\coprod", "\\bigvee", "\\bigwedge", "\\biguplus", "\\bigcap", "\\bigcup", "\\intop", "\\prod", "\\sum", "\\bigotimes", "\\bigoplus", "\\bigodot", "\\bigsqcup", "\\smallint", "\u220F", "\u2210", "\u2211", "\u22C0", "\u22C1", "\u22C2", "\u22C3", "\u2A00", "\u2A01", "\u2A02", "\u2A04", "\u2A06"],
  props: {
    numArgs: 0
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var fName = funcName;
    if (fName.length === 1) {
      fName = singleCharBigOps[fName];
    }
    return {
      type: "op",
      mode: parser.mode,
      limits: true,
      parentIsSupSub: false,
      symbol: true,
      name: fName
    };
  },
  htmlBuilder: htmlBuilder$2,
  mathmlBuilder: mathmlBuilder$1
});
defineFunction({
  type: "op",
  names: ["\\mathop"],
  props: {
    numArgs: 1,
    primitive: true
  },
  handler: (_ref2, args) => {
    var {
      parser
    } = _ref2;
    var body = args[0];
    return {
      type: "op",
      mode: parser.mode,
      limits: false,
      parentIsSupSub: false,
      symbol: false,
      body: ordargument(body)
    };
  },
  htmlBuilder: htmlBuilder$2,
  mathmlBuilder: mathmlBuilder$1
});
var singleCharIntegrals = {
  "\u222B": "\\int",
  "\u222C": "\\iint",
  "\u222D": "\\iiint",
  "\u222E": "\\oint",
  "\u222F": "\\oiint",
  "\u2230": "\\oiiint"
};
defineFunction({
  type: "op",
  names: ["\\arcsin", "\\arccos", "\\arctan", "\\arctg", "\\arcctg", "\\arg", "\\ch", "\\cos", "\\cosec", "\\cosh", "\\cot", "\\cotg", "\\coth", "\\csc", "\\ctg", "\\cth", "\\deg", "\\dim", "\\exp", "\\hom", "\\ker", "\\lg", "\\ln", "\\log", "\\sec", "\\sin", "\\sinh", "\\sh", "\\tan", "\\tanh", "\\tg", "\\th"],
  props: {
    numArgs: 0
  },
  handler(_ref3) {
    var {
      parser,
      funcName
    } = _ref3;
    return {
      type: "op",
      mode: parser.mode,
      limits: false,
      parentIsSupSub: false,
      symbol: false,
      name: funcName
    };
  },
  htmlBuilder: htmlBuilder$2,
  mathmlBuilder: mathmlBuilder$1
});
defineFunction({
  type: "op",
  names: ["\\det", "\\gcd", "\\inf", "\\lim", "\\max", "\\min", "\\Pr", "\\sup"],
  props: {
    numArgs: 0
  },
  handler(_ref4) {
    var {
      parser,
      funcName
    } = _ref4;
    return {
      type: "op",
      mode: parser.mode,
      limits: true,
      parentIsSupSub: false,
      symbol: false,
      name: funcName
    };
  },
  htmlBuilder: htmlBuilder$2,
  mathmlBuilder: mathmlBuilder$1
});
defineFunction({
  type: "op",
  names: ["\\int", "\\iint", "\\iiint", "\\oint", "\\oiint", "\\oiiint", "\u222B", "\u222C", "\u222D", "\u222E", "\u222F", "\u2230"],
  props: {
    numArgs: 0
  },
  handler(_ref5) {
    var {
      parser,
      funcName
    } = _ref5;
    var fName = funcName;
    if (fName.length === 1) {
      fName = singleCharIntegrals[fName];
    }
    return {
      type: "op",
      mode: parser.mode,
      limits: false,
      parentIsSupSub: false,
      symbol: true,
      name: fName
    };
  },
  htmlBuilder: htmlBuilder$2,
  mathmlBuilder: mathmlBuilder$1
});
var htmlBuilder$1 = (grp, options) => {
  var supGroup;
  var subGroup;
  var hasLimits = false;
  var group;
  if (grp.type === "supsub") {
    supGroup = grp.sup;
    subGroup = grp.sub;
    group = assertNodeType(grp.base, "operatorname");
    hasLimits = true;
  } else {
    group = assertNodeType(grp, "operatorname");
  }
  var base;
  if (group.body.length > 0) {
    var body = group.body.map((child2) => {
      var childText = child2.text;
      if (typeof childText === "string") {
        return {
          type: "textord",
          mode: child2.mode,
          text: childText
        };
      } else {
        return child2;
      }
    });
    var expression = buildExpression$1(body, options.withFont("mathrm"), true);
    for (var i = 0; i < expression.length; i++) {
      var child = expression[i];
      if (child instanceof SymbolNode) {
        child.text = child.text.replace(/\u2212/, "-").replace(/\u2217/, "*");
      }
    }
    base = buildCommon.makeSpan(["mop"], expression, options);
  } else {
    base = buildCommon.makeSpan(["mop"], [], options);
  }
  if (hasLimits) {
    return assembleSupSub(base, supGroup, subGroup, options, options.style, 0, 0);
  } else {
    return base;
  }
};
var mathmlBuilder2 = (group, options) => {
  var expression = buildExpression2(group.body, options.withFont("mathrm"));
  var isAllString = true;
  for (var i = 0; i < expression.length; i++) {
    var node = expression[i];
    if (node instanceof mathMLTree.SpaceNode) ;
    else if (node instanceof mathMLTree.MathNode) {
      switch (node.type) {
        case "mi":
        case "mn":
        case "ms":
        case "mspace":
        case "mtext":
          break;
        // Do nothing yet.
        case "mo": {
          var child = node.children[0];
          if (node.children.length === 1 && child instanceof mathMLTree.TextNode) {
            child.text = child.text.replace(/\u2212/, "-").replace(/\u2217/, "*");
          } else {
            isAllString = false;
          }
          break;
        }
        default:
          isAllString = false;
      }
    } else {
      isAllString = false;
    }
  }
  if (isAllString) {
    var word = expression.map((node2) => node2.toText()).join("");
    expression = [new mathMLTree.TextNode(word)];
  }
  var identifier = new mathMLTree.MathNode("mi", expression);
  identifier.setAttribute("mathvariant", "normal");
  var operator = new mathMLTree.MathNode("mo", [makeText("\u2061", "text")]);
  if (group.parentIsSupSub) {
    return new mathMLTree.MathNode("mrow", [identifier, operator]);
  } else {
    return mathMLTree.newDocumentFragment([identifier, operator]);
  }
};
defineFunction({
  type: "operatorname",
  names: ["\\operatorname@", "\\operatornamewithlimits"],
  props: {
    numArgs: 1
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var body = args[0];
    return {
      type: "operatorname",
      mode: parser.mode,
      body: ordargument(body),
      alwaysHandleSupSub: funcName === "\\operatornamewithlimits",
      limits: false,
      parentIsSupSub: false
    };
  },
  htmlBuilder: htmlBuilder$1,
  mathmlBuilder: mathmlBuilder2
});
defineMacro("\\operatorname", "\\@ifstar\\operatornamewithlimits\\operatorname@");
defineFunctionBuilders({
  type: "ordgroup",
  htmlBuilder(group, options) {
    if (group.semisimple) {
      return buildCommon.makeFragment(buildExpression$1(group.body, options, false));
    }
    return buildCommon.makeSpan(["mord"], buildExpression$1(group.body, options, true), options);
  },
  mathmlBuilder(group, options) {
    return buildExpressionRow(group.body, options, true);
  }
});
defineFunction({
  type: "overline",
  names: ["\\overline"],
  props: {
    numArgs: 1
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    var body = args[0];
    return {
      type: "overline",
      mode: parser.mode,
      body
    };
  },
  htmlBuilder(group, options) {
    var innerGroup = buildGroup$1(group.body, options.havingCrampedStyle());
    var line = buildCommon.makeLineSpan("overline-line", options);
    var defaultRuleThickness = options.fontMetrics().defaultRuleThickness;
    var vlist = buildCommon.makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: innerGroup
      }, {
        type: "kern",
        size: 3 * defaultRuleThickness
      }, {
        type: "elem",
        elem: line
      }, {
        type: "kern",
        size: defaultRuleThickness
      }]
    }, options);
    return buildCommon.makeSpan(["mord", "overline"], [vlist], options);
  },
  mathmlBuilder(group, options) {
    var operator = new mathMLTree.MathNode("mo", [new mathMLTree.TextNode("\u203E")]);
    operator.setAttribute("stretchy", "true");
    var node = new mathMLTree.MathNode("mover", [buildGroup2(group.body, options), operator]);
    node.setAttribute("accent", "true");
    return node;
  }
});
defineFunction({
  type: "phantom",
  names: ["\\phantom"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      parser
    } = _ref;
    var body = args[0];
    return {
      type: "phantom",
      mode: parser.mode,
      body: ordargument(body)
    };
  },
  htmlBuilder: (group, options) => {
    var elements = buildExpression$1(group.body, options.withPhantom(), false);
    return buildCommon.makeFragment(elements);
  },
  mathmlBuilder: (group, options) => {
    var inner2 = buildExpression2(group.body, options);
    return new mathMLTree.MathNode("mphantom", inner2);
  }
});
defineFunction({
  type: "hphantom",
  names: ["\\hphantom"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler: (_ref2, args) => {
    var {
      parser
    } = _ref2;
    var body = args[0];
    return {
      type: "hphantom",
      mode: parser.mode,
      body
    };
  },
  htmlBuilder: (group, options) => {
    var node = buildCommon.makeSpan([], [buildGroup$1(group.body, options.withPhantom())]);
    node.height = 0;
    node.depth = 0;
    if (node.children) {
      for (var i = 0; i < node.children.length; i++) {
        node.children[i].height = 0;
        node.children[i].depth = 0;
      }
    }
    node = buildCommon.makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: node
      }]
    }, options);
    return buildCommon.makeSpan(["mord"], [node], options);
  },
  mathmlBuilder: (group, options) => {
    var inner2 = buildExpression2(ordargument(group.body), options);
    var phantom = new mathMLTree.MathNode("mphantom", inner2);
    var node = new mathMLTree.MathNode("mpadded", [phantom]);
    node.setAttribute("height", "0px");
    node.setAttribute("depth", "0px");
    return node;
  }
});
defineFunction({
  type: "vphantom",
  names: ["\\vphantom"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler: (_ref3, args) => {
    var {
      parser
    } = _ref3;
    var body = args[0];
    return {
      type: "vphantom",
      mode: parser.mode,
      body
    };
  },
  htmlBuilder: (group, options) => {
    var inner2 = buildCommon.makeSpan(["inner"], [buildGroup$1(group.body, options.withPhantom())]);
    var fix = buildCommon.makeSpan(["fix"], []);
    return buildCommon.makeSpan(["mord", "rlap"], [inner2, fix], options);
  },
  mathmlBuilder: (group, options) => {
    var inner2 = buildExpression2(ordargument(group.body), options);
    var phantom = new mathMLTree.MathNode("mphantom", inner2);
    var node = new mathMLTree.MathNode("mpadded", [phantom]);
    node.setAttribute("width", "0px");
    return node;
  }
});
defineFunction({
  type: "raisebox",
  names: ["\\raisebox"],
  props: {
    numArgs: 2,
    argTypes: ["size", "hbox"],
    allowedInText: true
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    var amount = assertNodeType(args[0], "size").value;
    var body = args[1];
    return {
      type: "raisebox",
      mode: parser.mode,
      dy: amount,
      body
    };
  },
  htmlBuilder(group, options) {
    var body = buildGroup$1(group.body, options);
    var dy = calculateSize(group.dy, options);
    return buildCommon.makeVList({
      positionType: "shift",
      positionData: -dy,
      children: [{
        type: "elem",
        elem: body
      }]
    }, options);
  },
  mathmlBuilder(group, options) {
    var node = new mathMLTree.MathNode("mpadded", [buildGroup2(group.body, options)]);
    var dy = group.dy.number + group.dy.unit;
    node.setAttribute("voffset", dy);
    return node;
  }
});
defineFunction({
  type: "internal",
  names: ["\\relax"],
  props: {
    numArgs: 0,
    allowedInText: true,
    allowedInArgument: true
  },
  handler(_ref) {
    var {
      parser
    } = _ref;
    return {
      type: "internal",
      mode: parser.mode
    };
  }
});
defineFunction({
  type: "rule",
  names: ["\\rule"],
  props: {
    numArgs: 2,
    numOptionalArgs: 1,
    allowedInText: true,
    allowedInMath: true,
    argTypes: ["size", "size", "size"]
  },
  handler(_ref, args, optArgs) {
    var {
      parser
    } = _ref;
    var shift = optArgs[0];
    var width = assertNodeType(args[0], "size");
    var height = assertNodeType(args[1], "size");
    return {
      type: "rule",
      mode: parser.mode,
      shift: shift && assertNodeType(shift, "size").value,
      width: width.value,
      height: height.value
    };
  },
  htmlBuilder(group, options) {
    var rule = buildCommon.makeSpan(["mord", "rule"], [], options);
    var width = calculateSize(group.width, options);
    var height = calculateSize(group.height, options);
    var shift = group.shift ? calculateSize(group.shift, options) : 0;
    rule.style.borderRightWidth = makeEm(width);
    rule.style.borderTopWidth = makeEm(height);
    rule.style.bottom = makeEm(shift);
    rule.width = width;
    rule.height = height + shift;
    rule.depth = -shift;
    rule.maxFontSize = height * 1.125 * options.sizeMultiplier;
    return rule;
  },
  mathmlBuilder(group, options) {
    var width = calculateSize(group.width, options);
    var height = calculateSize(group.height, options);
    var shift = group.shift ? calculateSize(group.shift, options) : 0;
    var color = options.color && options.getColor() || "black";
    var rule = new mathMLTree.MathNode("mspace");
    rule.setAttribute("mathbackground", color);
    rule.setAttribute("width", makeEm(width));
    rule.setAttribute("height", makeEm(height));
    var wrapper = new mathMLTree.MathNode("mpadded", [rule]);
    if (shift >= 0) {
      wrapper.setAttribute("height", makeEm(shift));
    } else {
      wrapper.setAttribute("height", makeEm(shift));
      wrapper.setAttribute("depth", makeEm(-shift));
    }
    wrapper.setAttribute("voffset", makeEm(shift));
    return wrapper;
  }
});
function sizingGroup(value, options, baseOptions) {
  var inner2 = buildExpression$1(value, options, false);
  var multiplier = options.sizeMultiplier / baseOptions.sizeMultiplier;
  for (var i = 0; i < inner2.length; i++) {
    var pos = inner2[i].classes.indexOf("sizing");
    if (pos < 0) {
      Array.prototype.push.apply(inner2[i].classes, options.sizingClasses(baseOptions));
    } else if (inner2[i].classes[pos + 1] === "reset-size" + options.size) {
      inner2[i].classes[pos + 1] = "reset-size" + baseOptions.size;
    }
    inner2[i].height *= multiplier;
    inner2[i].depth *= multiplier;
  }
  return buildCommon.makeFragment(inner2);
}
var sizeFuncs = ["\\tiny", "\\sixptsize", "\\scriptsize", "\\footnotesize", "\\small", "\\normalsize", "\\large", "\\Large", "\\LARGE", "\\huge", "\\Huge"];
var htmlBuilder2 = (group, options) => {
  var newOptions = options.havingSize(group.size);
  return sizingGroup(group.body, newOptions, options);
};
defineFunction({
  type: "sizing",
  names: sizeFuncs,
  props: {
    numArgs: 0,
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      breakOnTokenText,
      funcName,
      parser
    } = _ref;
    var body = parser.parseExpression(false, breakOnTokenText);
    return {
      type: "sizing",
      mode: parser.mode,
      // Figure out what size to use based on the list of functions above
      size: sizeFuncs.indexOf(funcName) + 1,
      body
    };
  },
  htmlBuilder: htmlBuilder2,
  mathmlBuilder: (group, options) => {
    var newOptions = options.havingSize(group.size);
    var inner2 = buildExpression2(group.body, newOptions);
    var node = new mathMLTree.MathNode("mstyle", inner2);
    node.setAttribute("mathsize", makeEm(newOptions.sizeMultiplier));
    return node;
  }
});
defineFunction({
  type: "smash",
  names: ["\\smash"],
  props: {
    numArgs: 1,
    numOptionalArgs: 1,
    allowedInText: true
  },
  handler: (_ref, args, optArgs) => {
    var {
      parser
    } = _ref;
    var smashHeight = false;
    var smashDepth = false;
    var tbArg = optArgs[0] && assertNodeType(optArgs[0], "ordgroup");
    if (tbArg) {
      var letter = "";
      for (var i = 0; i < tbArg.body.length; ++i) {
        var node = tbArg.body[i];
        letter = node.text;
        if (letter === "t") {
          smashHeight = true;
        } else if (letter === "b") {
          smashDepth = true;
        } else {
          smashHeight = false;
          smashDepth = false;
          break;
        }
      }
    } else {
      smashHeight = true;
      smashDepth = true;
    }
    var body = args[0];
    return {
      type: "smash",
      mode: parser.mode,
      body,
      smashHeight,
      smashDepth
    };
  },
  htmlBuilder: (group, options) => {
    var node = buildCommon.makeSpan([], [buildGroup$1(group.body, options)]);
    if (!group.smashHeight && !group.smashDepth) {
      return node;
    }
    if (group.smashHeight) {
      node.height = 0;
      if (node.children) {
        for (var i = 0; i < node.children.length; i++) {
          node.children[i].height = 0;
        }
      }
    }
    if (group.smashDepth) {
      node.depth = 0;
      if (node.children) {
        for (var _i = 0; _i < node.children.length; _i++) {
          node.children[_i].depth = 0;
        }
      }
    }
    var smashedNode = buildCommon.makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: node
      }]
    }, options);
    return buildCommon.makeSpan(["mord"], [smashedNode], options);
  },
  mathmlBuilder: (group, options) => {
    var node = new mathMLTree.MathNode("mpadded", [buildGroup2(group.body, options)]);
    if (group.smashHeight) {
      node.setAttribute("height", "0px");
    }
    if (group.smashDepth) {
      node.setAttribute("depth", "0px");
    }
    return node;
  }
});
defineFunction({
  type: "sqrt",
  names: ["\\sqrt"],
  props: {
    numArgs: 1,
    numOptionalArgs: 1
  },
  handler(_ref, args, optArgs) {
    var {
      parser
    } = _ref;
    var index = optArgs[0];
    var body = args[0];
    return {
      type: "sqrt",
      mode: parser.mode,
      body,
      index
    };
  },
  htmlBuilder(group, options) {
    var inner2 = buildGroup$1(group.body, options.havingCrampedStyle());
    if (inner2.height === 0) {
      inner2.height = options.fontMetrics().xHeight;
    }
    inner2 = buildCommon.wrapFragment(inner2, options);
    var metrics = options.fontMetrics();
    var theta = metrics.defaultRuleThickness;
    var phi = theta;
    if (options.style.id < Style$1.TEXT.id) {
      phi = options.fontMetrics().xHeight;
    }
    var lineClearance = theta + phi / 4;
    var minDelimiterHeight = inner2.height + inner2.depth + lineClearance + theta;
    var {
      span: img,
      ruleWidth,
      advanceWidth
    } = delimiter.sqrtImage(minDelimiterHeight, options);
    var delimDepth = img.height - ruleWidth;
    if (delimDepth > inner2.height + inner2.depth + lineClearance) {
      lineClearance = (lineClearance + delimDepth - inner2.height - inner2.depth) / 2;
    }
    var imgShift = img.height - inner2.height - lineClearance - ruleWidth;
    inner2.style.paddingLeft = makeEm(advanceWidth);
    var body = buildCommon.makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: inner2,
        wrapperClasses: ["svg-align"]
      }, {
        type: "kern",
        size: -(inner2.height + imgShift)
      }, {
        type: "elem",
        elem: img
      }, {
        type: "kern",
        size: ruleWidth
      }]
    }, options);
    if (!group.index) {
      return buildCommon.makeSpan(["mord", "sqrt"], [body], options);
    } else {
      var newOptions = options.havingStyle(Style$1.SCRIPTSCRIPT);
      var rootm = buildGroup$1(group.index, newOptions, options);
      var toShift = 0.6 * (body.height - body.depth);
      var rootVList = buildCommon.makeVList({
        positionType: "shift",
        positionData: -toShift,
        children: [{
          type: "elem",
          elem: rootm
        }]
      }, options);
      var rootVListWrap = buildCommon.makeSpan(["root"], [rootVList]);
      return buildCommon.makeSpan(["mord", "sqrt"], [rootVListWrap, body], options);
    }
  },
  mathmlBuilder(group, options) {
    var {
      body,
      index
    } = group;
    return index ? new mathMLTree.MathNode("mroot", [buildGroup2(body, options), buildGroup2(index, options)]) : new mathMLTree.MathNode("msqrt", [buildGroup2(body, options)]);
  }
});
var styleMap = {
  "display": Style$1.DISPLAY,
  "text": Style$1.TEXT,
  "script": Style$1.SCRIPT,
  "scriptscript": Style$1.SCRIPTSCRIPT
};
defineFunction({
  type: "styling",
  names: ["\\displaystyle", "\\textstyle", "\\scriptstyle", "\\scriptscriptstyle"],
  props: {
    numArgs: 0,
    allowedInText: true,
    primitive: true
  },
  handler(_ref, args) {
    var {
      breakOnTokenText,
      funcName,
      parser
    } = _ref;
    var body = parser.parseExpression(true, breakOnTokenText);
    var style = funcName.slice(1, funcName.length - 5);
    return {
      type: "styling",
      mode: parser.mode,
      // Figure out what style to use by pulling out the style from
      // the function name
      style,
      body
    };
  },
  htmlBuilder(group, options) {
    var newStyle = styleMap[group.style];
    var newOptions = options.havingStyle(newStyle).withFont("");
    return sizingGroup(group.body, newOptions, options);
  },
  mathmlBuilder(group, options) {
    var newStyle = styleMap[group.style];
    var newOptions = options.havingStyle(newStyle);
    var inner2 = buildExpression2(group.body, newOptions);
    var node = new mathMLTree.MathNode("mstyle", inner2);
    var styleAttributes = {
      "display": ["0", "true"],
      "text": ["0", "false"],
      "script": ["1", "false"],
      "scriptscript": ["2", "false"]
    };
    var attr = styleAttributes[group.style];
    node.setAttribute("scriptlevel", attr[0]);
    node.setAttribute("displaystyle", attr[1]);
    return node;
  }
});
var htmlBuilderDelegate = function htmlBuilderDelegate2(group, options) {
  var base = group.base;
  if (!base) {
    return null;
  } else if (base.type === "op") {
    var delegate = base.limits && (options.style.size === Style$1.DISPLAY.size || base.alwaysHandleSupSub);
    return delegate ? htmlBuilder$2 : null;
  } else if (base.type === "operatorname") {
    var _delegate = base.alwaysHandleSupSub && (options.style.size === Style$1.DISPLAY.size || base.limits);
    return _delegate ? htmlBuilder$1 : null;
  } else if (base.type === "accent") {
    return utils.isCharacterBox(base.base) ? htmlBuilder$a : null;
  } else if (base.type === "horizBrace") {
    var isSup = !group.sub;
    return isSup === base.isOver ? htmlBuilder$3 : null;
  } else {
    return null;
  }
};
defineFunctionBuilders({
  type: "supsub",
  htmlBuilder(group, options) {
    var builderDelegate = htmlBuilderDelegate(group, options);
    if (builderDelegate) {
      return builderDelegate(group, options);
    }
    var {
      base: valueBase,
      sup: valueSup,
      sub: valueSub
    } = group;
    var base = buildGroup$1(valueBase, options);
    var supm;
    var subm;
    var metrics = options.fontMetrics();
    var supShift = 0;
    var subShift = 0;
    var isCharacterBox3 = valueBase && utils.isCharacterBox(valueBase);
    if (valueSup) {
      var newOptions = options.havingStyle(options.style.sup());
      supm = buildGroup$1(valueSup, newOptions, options);
      if (!isCharacterBox3) {
        supShift = base.height - newOptions.fontMetrics().supDrop * newOptions.sizeMultiplier / options.sizeMultiplier;
      }
    }
    if (valueSub) {
      var _newOptions = options.havingStyle(options.style.sub());
      subm = buildGroup$1(valueSub, _newOptions, options);
      if (!isCharacterBox3) {
        subShift = base.depth + _newOptions.fontMetrics().subDrop * _newOptions.sizeMultiplier / options.sizeMultiplier;
      }
    }
    var minSupShift;
    if (options.style === Style$1.DISPLAY) {
      minSupShift = metrics.sup1;
    } else if (options.style.cramped) {
      minSupShift = metrics.sup3;
    } else {
      minSupShift = metrics.sup2;
    }
    var multiplier = options.sizeMultiplier;
    var marginRight = makeEm(0.5 / metrics.ptPerEm / multiplier);
    var marginLeft = null;
    if (subm) {
      var isOiint = group.base && group.base.type === "op" && group.base.name && (group.base.name === "\\oiint" || group.base.name === "\\oiiint");
      if (base instanceof SymbolNode || isOiint) {
        marginLeft = makeEm(-base.italic);
      }
    }
    var supsub;
    if (supm && subm) {
      supShift = Math.max(supShift, minSupShift, supm.depth + 0.25 * metrics.xHeight);
      subShift = Math.max(subShift, metrics.sub2);
      var ruleWidth = metrics.defaultRuleThickness;
      var maxWidth = 4 * ruleWidth;
      if (supShift - supm.depth - (subm.height - subShift) < maxWidth) {
        subShift = maxWidth - (supShift - supm.depth) + subm.height;
        var psi = 0.8 * metrics.xHeight - (supShift - supm.depth);
        if (psi > 0) {
          supShift += psi;
          subShift -= psi;
        }
      }
      var vlistElem = [{
        type: "elem",
        elem: subm,
        shift: subShift,
        marginRight,
        marginLeft
      }, {
        type: "elem",
        elem: supm,
        shift: -supShift,
        marginRight
      }];
      supsub = buildCommon.makeVList({
        positionType: "individualShift",
        children: vlistElem
      }, options);
    } else if (subm) {
      subShift = Math.max(subShift, metrics.sub1, subm.height - 0.8 * metrics.xHeight);
      var _vlistElem = [{
        type: "elem",
        elem: subm,
        marginLeft,
        marginRight
      }];
      supsub = buildCommon.makeVList({
        positionType: "shift",
        positionData: subShift,
        children: _vlistElem
      }, options);
    } else if (supm) {
      supShift = Math.max(supShift, minSupShift, supm.depth + 0.25 * metrics.xHeight);
      supsub = buildCommon.makeVList({
        positionType: "shift",
        positionData: -supShift,
        children: [{
          type: "elem",
          elem: supm,
          marginRight
        }]
      }, options);
    } else {
      throw new Error("supsub must have either sup or sub.");
    }
    var mclass = getTypeOfDomTree(base, "right") || "mord";
    return buildCommon.makeSpan([mclass], [base, buildCommon.makeSpan(["msupsub"], [supsub])], options);
  },
  mathmlBuilder(group, options) {
    var isBrace = false;
    var isOver;
    var isSup;
    if (group.base && group.base.type === "horizBrace") {
      isSup = !!group.sup;
      if (isSup === group.base.isOver) {
        isBrace = true;
        isOver = group.base.isOver;
      }
    }
    if (group.base && (group.base.type === "op" || group.base.type === "operatorname")) {
      group.base.parentIsSupSub = true;
    }
    var children = [buildGroup2(group.base, options)];
    if (group.sub) {
      children.push(buildGroup2(group.sub, options));
    }
    if (group.sup) {
      children.push(buildGroup2(group.sup, options));
    }
    var nodeType;
    if (isBrace) {
      nodeType = isOver ? "mover" : "munder";
    } else if (!group.sub) {
      var base = group.base;
      if (base && base.type === "op" && base.limits && (options.style === Style$1.DISPLAY || base.alwaysHandleSupSub)) {
        nodeType = "mover";
      } else if (base && base.type === "operatorname" && base.alwaysHandleSupSub && (base.limits || options.style === Style$1.DISPLAY)) {
        nodeType = "mover";
      } else {
        nodeType = "msup";
      }
    } else if (!group.sup) {
      var _base = group.base;
      if (_base && _base.type === "op" && _base.limits && (options.style === Style$1.DISPLAY || _base.alwaysHandleSupSub)) {
        nodeType = "munder";
      } else if (_base && _base.type === "operatorname" && _base.alwaysHandleSupSub && (_base.limits || options.style === Style$1.DISPLAY)) {
        nodeType = "munder";
      } else {
        nodeType = "msub";
      }
    } else {
      var _base2 = group.base;
      if (_base2 && _base2.type === "op" && _base2.limits && options.style === Style$1.DISPLAY) {
        nodeType = "munderover";
      } else if (_base2 && _base2.type === "operatorname" && _base2.alwaysHandleSupSub && (options.style === Style$1.DISPLAY || _base2.limits)) {
        nodeType = "munderover";
      } else {
        nodeType = "msubsup";
      }
    }
    return new mathMLTree.MathNode(nodeType, children);
  }
});
defineFunctionBuilders({
  type: "atom",
  htmlBuilder(group, options) {
    return buildCommon.mathsym(group.text, group.mode, options, ["m" + group.family]);
  },
  mathmlBuilder(group, options) {
    var node = new mathMLTree.MathNode("mo", [makeText(group.text, group.mode)]);
    if (group.family === "bin") {
      var variant = getVariant(group, options);
      if (variant === "bold-italic") {
        node.setAttribute("mathvariant", variant);
      }
    } else if (group.family === "punct") {
      node.setAttribute("separator", "true");
    } else if (group.family === "open" || group.family === "close") {
      node.setAttribute("stretchy", "false");
    }
    return node;
  }
});
var defaultVariant = {
  "mi": "italic",
  "mn": "normal",
  "mtext": "normal"
};
defineFunctionBuilders({
  type: "mathord",
  htmlBuilder(group, options) {
    return buildCommon.makeOrd(group, options, "mathord");
  },
  mathmlBuilder(group, options) {
    var node = new mathMLTree.MathNode("mi", [makeText(group.text, group.mode, options)]);
    var variant = getVariant(group, options) || "italic";
    if (variant !== defaultVariant[node.type]) {
      node.setAttribute("mathvariant", variant);
    }
    return node;
  }
});
defineFunctionBuilders({
  type: "textord",
  htmlBuilder(group, options) {
    return buildCommon.makeOrd(group, options, "textord");
  },
  mathmlBuilder(group, options) {
    var text2 = makeText(group.text, group.mode, options);
    var variant = getVariant(group, options) || "normal";
    var node;
    if (group.mode === "text") {
      node = new mathMLTree.MathNode("mtext", [text2]);
    } else if (/[0-9]/.test(group.text)) {
      node = new mathMLTree.MathNode("mn", [text2]);
    } else if (group.text === "\\prime") {
      node = new mathMLTree.MathNode("mo", [text2]);
    } else {
      node = new mathMLTree.MathNode("mi", [text2]);
    }
    if (variant !== defaultVariant[node.type]) {
      node.setAttribute("mathvariant", variant);
    }
    return node;
  }
});
var cssSpace = {
  "\\nobreak": "nobreak",
  "\\allowbreak": "allowbreak"
};
var regularSpace = {
  " ": {},
  "\\ ": {},
  "~": {
    className: "nobreak"
  },
  "\\space": {},
  "\\nobreakspace": {
    className: "nobreak"
  }
};
defineFunctionBuilders({
  type: "spacing",
  htmlBuilder(group, options) {
    if (regularSpace.hasOwnProperty(group.text)) {
      var className = regularSpace[group.text].className || "";
      if (group.mode === "text") {
        var ord = buildCommon.makeOrd(group, options, "textord");
        ord.classes.push(className);
        return ord;
      } else {
        return buildCommon.makeSpan(["mspace", className], [buildCommon.mathsym(group.text, group.mode, options)], options);
      }
    } else if (cssSpace.hasOwnProperty(group.text)) {
      return buildCommon.makeSpan(["mspace", cssSpace[group.text]], [], options);
    } else {
      throw new ParseError('Unknown type of space "' + group.text + '"');
    }
  },
  mathmlBuilder(group, options) {
    var node;
    if (regularSpace.hasOwnProperty(group.text)) {
      node = new mathMLTree.MathNode("mtext", [new mathMLTree.TextNode("\xA0")]);
    } else if (cssSpace.hasOwnProperty(group.text)) {
      return new mathMLTree.MathNode("mspace");
    } else {
      throw new ParseError('Unknown type of space "' + group.text + '"');
    }
    return node;
  }
});
var pad = () => {
  var padNode = new mathMLTree.MathNode("mtd", []);
  padNode.setAttribute("width", "50%");
  return padNode;
};
defineFunctionBuilders({
  type: "tag",
  mathmlBuilder(group, options) {
    var table = new mathMLTree.MathNode("mtable", [new mathMLTree.MathNode("mtr", [pad(), new mathMLTree.MathNode("mtd", [buildExpressionRow(group.body, options)]), pad(), new mathMLTree.MathNode("mtd", [buildExpressionRow(group.tag, options)])])]);
    table.setAttribute("width", "100%");
    return table;
  }
});
var textFontFamilies = {
  "\\text": void 0,
  "\\textrm": "textrm",
  "\\textsf": "textsf",
  "\\texttt": "texttt",
  "\\textnormal": "textrm"
};
var textFontWeights = {
  "\\textbf": "textbf",
  "\\textmd": "textmd"
};
var textFontShapes = {
  "\\textit": "textit",
  "\\textup": "textup"
};
var optionsWithFont = (group, options) => {
  var font = group.font;
  if (!font) {
    return options;
  } else if (textFontFamilies[font]) {
    return options.withTextFontFamily(textFontFamilies[font]);
  } else if (textFontWeights[font]) {
    return options.withTextFontWeight(textFontWeights[font]);
  } else if (font === "\\emph") {
    return options.fontShape === "textit" ? options.withTextFontShape("textup") : options.withTextFontShape("textit");
  }
  return options.withTextFontShape(textFontShapes[font]);
};
defineFunction({
  type: "text",
  names: [
    // Font families
    "\\text",
    "\\textrm",
    "\\textsf",
    "\\texttt",
    "\\textnormal",
    // Font weights
    "\\textbf",
    "\\textmd",
    // Font Shapes
    "\\textit",
    "\\textup",
    "\\emph"
  ],
  props: {
    numArgs: 1,
    argTypes: ["text"],
    allowedInArgument: true,
    allowedInText: true
  },
  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    var body = args[0];
    return {
      type: "text",
      mode: parser.mode,
      body: ordargument(body),
      font: funcName
    };
  },
  htmlBuilder(group, options) {
    var newOptions = optionsWithFont(group, options);
    var inner2 = buildExpression$1(group.body, newOptions, true);
    return buildCommon.makeSpan(["mord", "text"], inner2, newOptions);
  },
  mathmlBuilder(group, options) {
    var newOptions = optionsWithFont(group, options);
    return buildExpressionRow(group.body, newOptions);
  }
});
defineFunction({
  type: "underline",
  names: ["\\underline"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    return {
      type: "underline",
      mode: parser.mode,
      body: args[0]
    };
  },
  htmlBuilder(group, options) {
    var innerGroup = buildGroup$1(group.body, options);
    var line = buildCommon.makeLineSpan("underline-line", options);
    var defaultRuleThickness = options.fontMetrics().defaultRuleThickness;
    var vlist = buildCommon.makeVList({
      positionType: "top",
      positionData: innerGroup.height,
      children: [{
        type: "kern",
        size: defaultRuleThickness
      }, {
        type: "elem",
        elem: line
      }, {
        type: "kern",
        size: 3 * defaultRuleThickness
      }, {
        type: "elem",
        elem: innerGroup
      }]
    }, options);
    return buildCommon.makeSpan(["mord", "underline"], [vlist], options);
  },
  mathmlBuilder(group, options) {
    var operator = new mathMLTree.MathNode("mo", [new mathMLTree.TextNode("\u203E")]);
    operator.setAttribute("stretchy", "true");
    var node = new mathMLTree.MathNode("munder", [buildGroup2(group.body, options), operator]);
    node.setAttribute("accentunder", "true");
    return node;
  }
});
defineFunction({
  type: "vcenter",
  names: ["\\vcenter"],
  props: {
    numArgs: 1,
    argTypes: ["original"],
    // In LaTeX, \vcenter can act only on a box.
    allowedInText: false
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    return {
      type: "vcenter",
      mode: parser.mode,
      body: args[0]
    };
  },
  htmlBuilder(group, options) {
    var body = buildGroup$1(group.body, options);
    var axisHeight = options.fontMetrics().axisHeight;
    var dy = 0.5 * (body.height - axisHeight - (body.depth + axisHeight));
    return buildCommon.makeVList({
      positionType: "shift",
      positionData: dy,
      children: [{
        type: "elem",
        elem: body
      }]
    }, options);
  },
  mathmlBuilder(group, options) {
    return new mathMLTree.MathNode("mpadded", [buildGroup2(group.body, options)], ["vcenter"]);
  }
});
defineFunction({
  type: "verb",
  names: ["\\verb"],
  props: {
    numArgs: 0,
    allowedInText: true
  },
  handler(context, args, optArgs) {
    throw new ParseError("\\verb ended by end of line instead of matching delimiter");
  },
  htmlBuilder(group, options) {
    var text2 = makeVerb(group);
    var body = [];
    var newOptions = options.havingStyle(options.style.text());
    for (var i = 0; i < text2.length; i++) {
      var c = text2[i];
      if (c === "~") {
        c = "\\textasciitilde";
      }
      body.push(buildCommon.makeSymbol(c, "Typewriter-Regular", group.mode, newOptions, ["mord", "texttt"]));
    }
    return buildCommon.makeSpan(["mord", "text"].concat(newOptions.sizingClasses(options)), buildCommon.tryCombineChars(body), newOptions);
  },
  mathmlBuilder(group, options) {
    var text2 = new mathMLTree.TextNode(makeVerb(group));
    var node = new mathMLTree.MathNode("mtext", [text2]);
    node.setAttribute("mathvariant", "monospace");
    return node;
  }
});
var makeVerb = (group) => group.body.replace(/ /g, group.star ? "\u2423" : "\xA0");
var functions = _functions;
var spaceRegexString = "[ \r\n	]";
var controlWordRegexString = "\\\\[a-zA-Z@]+";
var controlSymbolRegexString = "\\\\[^\uD800-\uDFFF]";
var controlWordWhitespaceRegexString = "(" + controlWordRegexString + ")" + spaceRegexString + "*";
var controlSpaceRegexString = "\\\\(\n|[ \r	]+\n?)[ \r	]*";
var combiningDiacriticalMarkString = "[\u0300-\u036F]";
var combiningDiacriticalMarksEndRegex = new RegExp(combiningDiacriticalMarkString + "+$");
var tokenRegexString = "(" + spaceRegexString + "+)|" + // whitespace
(controlSpaceRegexString + "|") + // \whitespace
"([!-\\[\\]-\u2027\u202A-\uD7FF\uF900-\uFFFF]" + // single codepoint
(combiningDiacriticalMarkString + "*") + // ...plus accents
"|[\uD800-\uDBFF][\uDC00-\uDFFF]" + // surrogate pair
(combiningDiacriticalMarkString + "*") + // ...plus accents
"|\\\\verb\\*([^]).*?\\4|\\\\verb([^*a-zA-Z]).*?\\5" + // \verb unstarred
("|" + controlWordWhitespaceRegexString) + // \macroName + spaces
("|" + controlSymbolRegexString + ")");
var Lexer = class {
  // Category codes. The lexer only supports comment characters (14) for now.
  // MacroExpander additionally distinguishes active (13).
  constructor(input, settings) {
    this.input = void 0;
    this.settings = void 0;
    this.tokenRegex = void 0;
    this.catcodes = void 0;
    this.input = input;
    this.settings = settings;
    this.tokenRegex = new RegExp(tokenRegexString, "g");
    this.catcodes = {
      "%": 14,
      // comment character
      "~": 13
      // active character
    };
  }
  setCatcode(char, code) {
    this.catcodes[char] = code;
  }
  /**
   * This function lexes a single token.
   */
  lex() {
    var input = this.input;
    var pos = this.tokenRegex.lastIndex;
    if (pos === input.length) {
      return new Token("EOF", new SourceLocation(this, pos, pos));
    }
    var match = this.tokenRegex.exec(input);
    if (match === null || match.index !== pos) {
      throw new ParseError("Unexpected character: '" + input[pos] + "'", new Token(input[pos], new SourceLocation(this, pos, pos + 1)));
    }
    var text2 = match[6] || match[3] || (match[2] ? "\\ " : " ");
    if (this.catcodes[text2] === 14) {
      var nlIndex = input.indexOf("\n", this.tokenRegex.lastIndex);
      if (nlIndex === -1) {
        this.tokenRegex.lastIndex = input.length;
        this.settings.reportNonstrict("commentAtEnd", "% comment has no terminating newline; LaTeX would fail because of commenting the end of math mode (e.g. $)");
      } else {
        this.tokenRegex.lastIndex = nlIndex + 1;
      }
      return this.lex();
    }
    return new Token(text2, new SourceLocation(this, pos, this.tokenRegex.lastIndex));
  }
};
var Namespace = class {
  /**
   * Both arguments are optional.  The first argument is an object of
   * built-in mappings which never change.  The second argument is an object
   * of initial (global-level) mappings, which will constantly change
   * according to any global/top-level `set`s done.
   */
  constructor(builtins, globalMacros) {
    if (builtins === void 0) {
      builtins = {};
    }
    if (globalMacros === void 0) {
      globalMacros = {};
    }
    this.current = void 0;
    this.builtins = void 0;
    this.undefStack = void 0;
    this.current = globalMacros;
    this.builtins = builtins;
    this.undefStack = [];
  }
  /**
   * Start a new nested group, affecting future local `set`s.
   */
  beginGroup() {
    this.undefStack.push({});
  }
  /**
   * End current nested group, restoring values before the group began.
   */
  endGroup() {
    if (this.undefStack.length === 0) {
      throw new ParseError("Unbalanced namespace destruction: attempt to pop global namespace; please report this as a bug");
    }
    var undefs = this.undefStack.pop();
    for (var undef in undefs) {
      if (undefs.hasOwnProperty(undef)) {
        if (undefs[undef] == null) {
          delete this.current[undef];
        } else {
          this.current[undef] = undefs[undef];
        }
      }
    }
  }
  /**
   * Ends all currently nested groups (if any), restoring values before the
   * groups began.  Useful in case of an error in the middle of parsing.
   */
  endGroups() {
    while (this.undefStack.length > 0) {
      this.endGroup();
    }
  }
  /**
   * Detect whether `name` has a definition.  Equivalent to
   * `get(name) != null`.
   */
  has(name2) {
    return this.current.hasOwnProperty(name2) || this.builtins.hasOwnProperty(name2);
  }
  /**
   * Get the current value of a name, or `undefined` if there is no value.
   *
   * Note: Do not use `if (namespace.get(...))` to detect whether a macro
   * is defined, as the definition may be the empty string which evaluates
   * to `false` in JavaScript.  Use `if (namespace.get(...) != null)` or
   * `if (namespace.has(...))`.
   */
  get(name2) {
    if (this.current.hasOwnProperty(name2)) {
      return this.current[name2];
    } else {
      return this.builtins[name2];
    }
  }
  /**
   * Set the current value of a name, and optionally set it globally too.
   * Local set() sets the current value and (when appropriate) adds an undo
   * operation to the undo stack.  Global set() may change the undo
   * operation at every level, so takes time linear in their number.
   * A value of undefined means to delete existing definitions.
   */
  set(name2, value, global) {
    if (global === void 0) {
      global = false;
    }
    if (global) {
      for (var i = 0; i < this.undefStack.length; i++) {
        delete this.undefStack[i][name2];
      }
      if (this.undefStack.length > 0) {
        this.undefStack[this.undefStack.length - 1][name2] = value;
      }
    } else {
      var top = this.undefStack[this.undefStack.length - 1];
      if (top && !top.hasOwnProperty(name2)) {
        top[name2] = this.current[name2];
      }
    }
    if (value == null) {
      delete this.current[name2];
    } else {
      this.current[name2] = value;
    }
  }
};
var macros = _macros;
defineMacro("\\noexpand", function(context) {
  var t = context.popToken();
  if (context.isExpandable(t.text)) {
    t.noexpand = true;
    t.treatAsRelax = true;
  }
  return {
    tokens: [t],
    numArgs: 0
  };
});
defineMacro("\\expandafter", function(context) {
  var t = context.popToken();
  context.expandOnce(true);
  return {
    tokens: [t],
    numArgs: 0
  };
});
defineMacro("\\@firstoftwo", function(context) {
  var args = context.consumeArgs(2);
  return {
    tokens: args[0],
    numArgs: 0
  };
});
defineMacro("\\@secondoftwo", function(context) {
  var args = context.consumeArgs(2);
  return {
    tokens: args[1],
    numArgs: 0
  };
});
defineMacro("\\@ifnextchar", function(context) {
  var args = context.consumeArgs(3);
  context.consumeSpaces();
  var nextToken = context.future();
  if (args[0].length === 1 && args[0][0].text === nextToken.text) {
    return {
      tokens: args[1],
      numArgs: 0
    };
  } else {
    return {
      tokens: args[2],
      numArgs: 0
    };
  }
});
defineMacro("\\@ifstar", "\\@ifnextchar *{\\@firstoftwo{#1}}");
defineMacro("\\TextOrMath", function(context) {
  var args = context.consumeArgs(2);
  if (context.mode === "text") {
    return {
      tokens: args[0],
      numArgs: 0
    };
  } else {
    return {
      tokens: args[1],
      numArgs: 0
    };
  }
});
var digitToNumber = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "a": 10,
  "A": 10,
  "b": 11,
  "B": 11,
  "c": 12,
  "C": 12,
  "d": 13,
  "D": 13,
  "e": 14,
  "E": 14,
  "f": 15,
  "F": 15
};
defineMacro("\\char", function(context) {
  var token = context.popToken();
  var base;
  var number = "";
  if (token.text === "'") {
    base = 8;
    token = context.popToken();
  } else if (token.text === '"') {
    base = 16;
    token = context.popToken();
  } else if (token.text === "`") {
    token = context.popToken();
    if (token.text[0] === "\\") {
      number = token.text.charCodeAt(1);
    } else if (token.text === "EOF") {
      throw new ParseError("\\char` missing argument");
    } else {
      number = token.text.charCodeAt(0);
    }
  } else {
    base = 10;
  }
  if (base) {
    number = digitToNumber[token.text];
    if (number == null || number >= base) {
      throw new ParseError("Invalid base-" + base + " digit " + token.text);
    }
    var digit;
    while ((digit = digitToNumber[context.future().text]) != null && digit < base) {
      number *= base;
      number += digit;
      context.popToken();
    }
  }
  return "\\@char{" + number + "}";
});
var newcommand = (context, existsOK, nonexistsOK, skipIfExists) => {
  var arg = context.consumeArg().tokens;
  if (arg.length !== 1) {
    throw new ParseError("\\newcommand's first argument must be a macro name");
  }
  var name2 = arg[0].text;
  var exists = context.isDefined(name2);
  if (exists && !existsOK) {
    throw new ParseError("\\newcommand{" + name2 + "} attempting to redefine " + (name2 + "; use \\renewcommand"));
  }
  if (!exists && !nonexistsOK) {
    throw new ParseError("\\renewcommand{" + name2 + "} when command " + name2 + " does not yet exist; use \\newcommand");
  }
  var numArgs = 0;
  arg = context.consumeArg().tokens;
  if (arg.length === 1 && arg[0].text === "[") {
    var argText = "";
    var token = context.expandNextToken();
    while (token.text !== "]" && token.text !== "EOF") {
      argText += token.text;
      token = context.expandNextToken();
    }
    if (!argText.match(/^\s*[0-9]+\s*$/)) {
      throw new ParseError("Invalid number of arguments: " + argText);
    }
    numArgs = parseInt(argText);
    arg = context.consumeArg().tokens;
  }
  if (!(exists && skipIfExists)) {
    context.macros.set(name2, {
      tokens: arg,
      numArgs
    });
  }
  return "";
};
defineMacro("\\newcommand", (context) => newcommand(context, false, true, false));
defineMacro("\\renewcommand", (context) => newcommand(context, true, false, false));
defineMacro("\\providecommand", (context) => newcommand(context, true, true, true));
defineMacro("\\message", (context) => {
  var arg = context.consumeArgs(1)[0];
  console.log(arg.reverse().map((token) => token.text).join(""));
  return "";
});
defineMacro("\\errmessage", (context) => {
  var arg = context.consumeArgs(1)[0];
  console.error(arg.reverse().map((token) => token.text).join(""));
  return "";
});
defineMacro("\\show", (context) => {
  var tok = context.popToken();
  var name2 = tok.text;
  console.log(tok, context.macros.get(name2), functions[name2], symbols.math[name2], symbols.text[name2]);
  return "";
});
defineMacro("\\bgroup", "{");
defineMacro("\\egroup", "}");
defineMacro("~", "\\nobreakspace");
defineMacro("\\lq", "`");
defineMacro("\\rq", "'");
defineMacro("\\aa", "\\r a");
defineMacro("\\AA", "\\r A");
defineMacro("\\textcopyright", "\\html@mathml{\\textcircled{c}}{\\char`\xA9}");
defineMacro("\\copyright", "\\TextOrMath{\\textcopyright}{\\text{\\textcopyright}}");
defineMacro("\\textregistered", "\\html@mathml{\\textcircled{\\scriptsize R}}{\\char`\xAE}");
defineMacro("\u212C", "\\mathscr{B}");
defineMacro("\u2130", "\\mathscr{E}");
defineMacro("\u2131", "\\mathscr{F}");
defineMacro("\u210B", "\\mathscr{H}");
defineMacro("\u2110", "\\mathscr{I}");
defineMacro("\u2112", "\\mathscr{L}");
defineMacro("\u2133", "\\mathscr{M}");
defineMacro("\u211B", "\\mathscr{R}");
defineMacro("\u212D", "\\mathfrak{C}");
defineMacro("\u210C", "\\mathfrak{H}");
defineMacro("\u2128", "\\mathfrak{Z}");
defineMacro("\\Bbbk", "\\Bbb{k}");
defineMacro("\xB7", "\\cdotp");
defineMacro("\\llap", "\\mathllap{\\textrm{#1}}");
defineMacro("\\rlap", "\\mathrlap{\\textrm{#1}}");
defineMacro("\\clap", "\\mathclap{\\textrm{#1}}");
defineMacro("\\mathstrut", "\\vphantom{(}");
defineMacro("\\underbar", "\\underline{\\text{#1}}");
defineMacro("\\not", '\\html@mathml{\\mathrel{\\mathrlap\\@not}}{\\char"338}');
defineMacro("\\neq", "\\html@mathml{\\mathrel{\\not=}}{\\mathrel{\\char`\u2260}}");
defineMacro("\\ne", "\\neq");
defineMacro("\u2260", "\\neq");
defineMacro("\\notin", "\\html@mathml{\\mathrel{{\\in}\\mathllap{/\\mskip1mu}}}{\\mathrel{\\char`\u2209}}");
defineMacro("\u2209", "\\notin");
defineMacro("\u2258", "\\html@mathml{\\mathrel{=\\kern{-1em}\\raisebox{0.4em}{$\\scriptsize\\frown$}}}{\\mathrel{\\char`\u2258}}");
defineMacro("\u2259", "\\html@mathml{\\stackrel{\\tiny\\wedge}{=}}{\\mathrel{\\char`\u2258}}");
defineMacro("\u225A", "\\html@mathml{\\stackrel{\\tiny\\vee}{=}}{\\mathrel{\\char`\u225A}}");
defineMacro("\u225B", "\\html@mathml{\\stackrel{\\scriptsize\\star}{=}}{\\mathrel{\\char`\u225B}}");
defineMacro("\u225D", "\\html@mathml{\\stackrel{\\tiny\\mathrm{def}}{=}}{\\mathrel{\\char`\u225D}}");
defineMacro("\u225E", "\\html@mathml{\\stackrel{\\tiny\\mathrm{m}}{=}}{\\mathrel{\\char`\u225E}}");
defineMacro("\u225F", "\\html@mathml{\\stackrel{\\tiny?}{=}}{\\mathrel{\\char`\u225F}}");
defineMacro("\u27C2", "\\perp");
defineMacro("\u203C", "\\mathclose{!\\mkern-0.8mu!}");
defineMacro("\u220C", "\\notni");
defineMacro("\u231C", "\\ulcorner");
defineMacro("\u231D", "\\urcorner");
defineMacro("\u231E", "\\llcorner");
defineMacro("\u231F", "\\lrcorner");
defineMacro("\xA9", "\\copyright");
defineMacro("\xAE", "\\textregistered");
defineMacro("\uFE0F", "\\textregistered");
defineMacro("\\ulcorner", '\\html@mathml{\\@ulcorner}{\\mathop{\\char"231c}}');
defineMacro("\\urcorner", '\\html@mathml{\\@urcorner}{\\mathop{\\char"231d}}');
defineMacro("\\llcorner", '\\html@mathml{\\@llcorner}{\\mathop{\\char"231e}}');
defineMacro("\\lrcorner", '\\html@mathml{\\@lrcorner}{\\mathop{\\char"231f}}');
defineMacro("\\vdots", "{\\varvdots\\rule{0pt}{15pt}}");
defineMacro("\u22EE", "\\vdots");
defineMacro("\\varGamma", "\\mathit{\\Gamma}");
defineMacro("\\varDelta", "\\mathit{\\Delta}");
defineMacro("\\varTheta", "\\mathit{\\Theta}");
defineMacro("\\varLambda", "\\mathit{\\Lambda}");
defineMacro("\\varXi", "\\mathit{\\Xi}");
defineMacro("\\varPi", "\\mathit{\\Pi}");
defineMacro("\\varSigma", "\\mathit{\\Sigma}");
defineMacro("\\varUpsilon", "\\mathit{\\Upsilon}");
defineMacro("\\varPhi", "\\mathit{\\Phi}");
defineMacro("\\varPsi", "\\mathit{\\Psi}");
defineMacro("\\varOmega", "\\mathit{\\Omega}");
defineMacro("\\substack", "\\begin{subarray}{c}#1\\end{subarray}");
defineMacro("\\colon", "\\nobreak\\mskip2mu\\mathpunct{}\\mathchoice{\\mkern-3mu}{\\mkern-3mu}{}{}{:}\\mskip6mu\\relax");
defineMacro("\\boxed", "\\fbox{$\\displaystyle{#1}$}");
defineMacro("\\iff", "\\DOTSB\\;\\Longleftrightarrow\\;");
defineMacro("\\implies", "\\DOTSB\\;\\Longrightarrow\\;");
defineMacro("\\impliedby", "\\DOTSB\\;\\Longleftarrow\\;");
defineMacro("\\dddot", "{\\overset{\\raisebox{-0.1ex}{\\normalsize ...}}{#1}}");
defineMacro("\\ddddot", "{\\overset{\\raisebox{-0.1ex}{\\normalsize ....}}{#1}}");
var dotsByToken = {
  ",": "\\dotsc",
  "\\not": "\\dotsb",
  // \keybin@ checks for the following:
  "+": "\\dotsb",
  "=": "\\dotsb",
  "<": "\\dotsb",
  ">": "\\dotsb",
  "-": "\\dotsb",
  "*": "\\dotsb",
  ":": "\\dotsb",
  // Symbols whose definition starts with \DOTSB:
  "\\DOTSB": "\\dotsb",
  "\\coprod": "\\dotsb",
  "\\bigvee": "\\dotsb",
  "\\bigwedge": "\\dotsb",
  "\\biguplus": "\\dotsb",
  "\\bigcap": "\\dotsb",
  "\\bigcup": "\\dotsb",
  "\\prod": "\\dotsb",
  "\\sum": "\\dotsb",
  "\\bigotimes": "\\dotsb",
  "\\bigoplus": "\\dotsb",
  "\\bigodot": "\\dotsb",
  "\\bigsqcup": "\\dotsb",
  "\\And": "\\dotsb",
  "\\longrightarrow": "\\dotsb",
  "\\Longrightarrow": "\\dotsb",
  "\\longleftarrow": "\\dotsb",
  "\\Longleftarrow": "\\dotsb",
  "\\longleftrightarrow": "\\dotsb",
  "\\Longleftrightarrow": "\\dotsb",
  "\\mapsto": "\\dotsb",
  "\\longmapsto": "\\dotsb",
  "\\hookrightarrow": "\\dotsb",
  "\\doteq": "\\dotsb",
  // Symbols whose definition starts with \mathbin:
  "\\mathbin": "\\dotsb",
  // Symbols whose definition starts with \mathrel:
  "\\mathrel": "\\dotsb",
  "\\relbar": "\\dotsb",
  "\\Relbar": "\\dotsb",
  "\\xrightarrow": "\\dotsb",
  "\\xleftarrow": "\\dotsb",
  // Symbols whose definition starts with \DOTSI:
  "\\DOTSI": "\\dotsi",
  "\\int": "\\dotsi",
  "\\oint": "\\dotsi",
  "\\iint": "\\dotsi",
  "\\iiint": "\\dotsi",
  "\\iiiint": "\\dotsi",
  "\\idotsint": "\\dotsi",
  // Symbols whose definition starts with \DOTSX:
  "\\DOTSX": "\\dotsx"
};
defineMacro("\\dots", function(context) {
  var thedots = "\\dotso";
  var next = context.expandAfterFuture().text;
  if (next in dotsByToken) {
    thedots = dotsByToken[next];
  } else if (next.slice(0, 4) === "\\not") {
    thedots = "\\dotsb";
  } else if (next in symbols.math) {
    if (utils.contains(["bin", "rel"], symbols.math[next].group)) {
      thedots = "\\dotsb";
    }
  }
  return thedots;
});
var spaceAfterDots = {
  // \rightdelim@ checks for the following:
  ")": true,
  "]": true,
  "\\rbrack": true,
  "\\}": true,
  "\\rbrace": true,
  "\\rangle": true,
  "\\rceil": true,
  "\\rfloor": true,
  "\\rgroup": true,
  "\\rmoustache": true,
  "\\right": true,
  "\\bigr": true,
  "\\biggr": true,
  "\\Bigr": true,
  "\\Biggr": true,
  // \extra@ also tests for the following:
  "$": true,
  // \extrap@ checks for the following:
  ";": true,
  ".": true,
  ",": true
};
defineMacro("\\dotso", function(context) {
  var next = context.future().text;
  if (next in spaceAfterDots) {
    return "\\ldots\\,";
  } else {
    return "\\ldots";
  }
});
defineMacro("\\dotsc", function(context) {
  var next = context.future().text;
  if (next in spaceAfterDots && next !== ",") {
    return "\\ldots\\,";
  } else {
    return "\\ldots";
  }
});
defineMacro("\\cdots", function(context) {
  var next = context.future().text;
  if (next in spaceAfterDots) {
    return "\\@cdots\\,";
  } else {
    return "\\@cdots";
  }
});
defineMacro("\\dotsb", "\\cdots");
defineMacro("\\dotsm", "\\cdots");
defineMacro("\\dotsi", "\\!\\cdots");
defineMacro("\\dotsx", "\\ldots\\,");
defineMacro("\\DOTSI", "\\relax");
defineMacro("\\DOTSB", "\\relax");
defineMacro("\\DOTSX", "\\relax");
defineMacro("\\tmspace", "\\TextOrMath{\\kern#1#3}{\\mskip#1#2}\\relax");
defineMacro("\\,", "\\tmspace+{3mu}{.1667em}");
defineMacro("\\thinspace", "\\,");
defineMacro("\\>", "\\mskip{4mu}");
defineMacro("\\:", "\\tmspace+{4mu}{.2222em}");
defineMacro("\\medspace", "\\:");
defineMacro("\\;", "\\tmspace+{5mu}{.2777em}");
defineMacro("\\thickspace", "\\;");
defineMacro("\\!", "\\tmspace-{3mu}{.1667em}");
defineMacro("\\negthinspace", "\\!");
defineMacro("\\negmedspace", "\\tmspace-{4mu}{.2222em}");
defineMacro("\\negthickspace", "\\tmspace-{5mu}{.277em}");
defineMacro("\\enspace", "\\kern.5em ");
defineMacro("\\enskip", "\\hskip.5em\\relax");
defineMacro("\\quad", "\\hskip1em\\relax");
defineMacro("\\qquad", "\\hskip2em\\relax");
defineMacro("\\tag", "\\@ifstar\\tag@literal\\tag@paren");
defineMacro("\\tag@paren", "\\tag@literal{({#1})}");
defineMacro("\\tag@literal", (context) => {
  if (context.macros.get("\\df@tag")) {
    throw new ParseError("Multiple \\tag");
  }
  return "\\gdef\\df@tag{\\text{#1}}";
});
defineMacro("\\bmod", "\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}\\mathbin{\\rm mod}\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}");
defineMacro("\\pod", "\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern8mu}{\\mkern8mu}{\\mkern8mu}(#1)");
defineMacro("\\pmod", "\\pod{{\\rm mod}\\mkern6mu#1}");
defineMacro("\\mod", "\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern12mu}{\\mkern12mu}{\\mkern12mu}{\\rm mod}\\,\\,#1");
defineMacro("\\newline", "\\\\\\relax");
defineMacro("\\TeX", "\\textrm{\\html@mathml{T\\kern-.1667em\\raisebox{-.5ex}{E}\\kern-.125emX}{TeX}}");
var latexRaiseA = makeEm(fontMetricsData["Main-Regular"]["T".charCodeAt(0)][1] - 0.7 * fontMetricsData["Main-Regular"]["A".charCodeAt(0)][1]);
defineMacro("\\LaTeX", "\\textrm{\\html@mathml{" + ("L\\kern-.36em\\raisebox{" + latexRaiseA + "}{\\scriptstyle A}") + "\\kern-.15em\\TeX}{LaTeX}}");
defineMacro("\\KaTeX", "\\textrm{\\html@mathml{" + ("K\\kern-.17em\\raisebox{" + latexRaiseA + "}{\\scriptstyle A}") + "\\kern-.15em\\TeX}{KaTeX}}");
defineMacro("\\hspace", "\\@ifstar\\@hspacer\\@hspace");
defineMacro("\\@hspace", "\\hskip #1\\relax");
defineMacro("\\@hspacer", "\\rule{0pt}{0pt}\\hskip #1\\relax");
defineMacro("\\ordinarycolon", ":");
defineMacro("\\vcentcolon", "\\mathrel{\\mathop\\ordinarycolon}");
defineMacro("\\dblcolon", '\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-.9mu}\\vcentcolon}}{\\mathop{\\char"2237}}');
defineMacro("\\coloneqq", '\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}=}}{\\mathop{\\char"2254}}');
defineMacro("\\Coloneqq", '\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}=}}{\\mathop{\\char"2237\\char"3d}}');
defineMacro("\\coloneq", '\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}}{\\mathop{\\char"3a\\char"2212}}');
defineMacro("\\Coloneq", '\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}}{\\mathop{\\char"2237\\char"2212}}');
defineMacro("\\eqqcolon", '\\html@mathml{\\mathrel{=\\mathrel{\\mkern-1.2mu}\\vcentcolon}}{\\mathop{\\char"2255}}');
defineMacro("\\Eqqcolon", '\\html@mathml{\\mathrel{=\\mathrel{\\mkern-1.2mu}\\dblcolon}}{\\mathop{\\char"3d\\char"2237}}');
defineMacro("\\eqcolon", '\\html@mathml{\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\vcentcolon}}{\\mathop{\\char"2239}}');
defineMacro("\\Eqcolon", '\\html@mathml{\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\dblcolon}}{\\mathop{\\char"2212\\char"2237}}');
defineMacro("\\colonapprox", '\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\approx}}{\\mathop{\\char"3a\\char"2248}}');
defineMacro("\\Colonapprox", '\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\approx}}{\\mathop{\\char"2237\\char"2248}}');
defineMacro("\\colonsim", '\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\sim}}{\\mathop{\\char"3a\\char"223c}}');
defineMacro("\\Colonsim", '\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\sim}}{\\mathop{\\char"2237\\char"223c}}');
defineMacro("\u2237", "\\dblcolon");
defineMacro("\u2239", "\\eqcolon");
defineMacro("\u2254", "\\coloneqq");
defineMacro("\u2255", "\\eqqcolon");
defineMacro("\u2A74", "\\Coloneqq");
defineMacro("\\ratio", "\\vcentcolon");
defineMacro("\\coloncolon", "\\dblcolon");
defineMacro("\\colonequals", "\\coloneqq");
defineMacro("\\coloncolonequals", "\\Coloneqq");
defineMacro("\\equalscolon", "\\eqqcolon");
defineMacro("\\equalscoloncolon", "\\Eqqcolon");
defineMacro("\\colonminus", "\\coloneq");
defineMacro("\\coloncolonminus", "\\Coloneq");
defineMacro("\\minuscolon", "\\eqcolon");
defineMacro("\\minuscoloncolon", "\\Eqcolon");
defineMacro("\\coloncolonapprox", "\\Colonapprox");
defineMacro("\\coloncolonsim", "\\Colonsim");
defineMacro("\\simcolon", "\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\vcentcolon}");
defineMacro("\\simcoloncolon", "\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\dblcolon}");
defineMacro("\\approxcolon", "\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\vcentcolon}");
defineMacro("\\approxcoloncolon", "\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\dblcolon}");
defineMacro("\\notni", "\\html@mathml{\\not\\ni}{\\mathrel{\\char`\u220C}}");
defineMacro("\\limsup", "\\DOTSB\\operatorname*{lim\\,sup}");
defineMacro("\\liminf", "\\DOTSB\\operatorname*{lim\\,inf}");
defineMacro("\\injlim", "\\DOTSB\\operatorname*{inj\\,lim}");
defineMacro("\\projlim", "\\DOTSB\\operatorname*{proj\\,lim}");
defineMacro("\\varlimsup", "\\DOTSB\\operatorname*{\\overline{lim}}");
defineMacro("\\varliminf", "\\DOTSB\\operatorname*{\\underline{lim}}");
defineMacro("\\varinjlim", "\\DOTSB\\operatorname*{\\underrightarrow{lim}}");
defineMacro("\\varprojlim", "\\DOTSB\\operatorname*{\\underleftarrow{lim}}");
defineMacro("\\gvertneqq", "\\html@mathml{\\@gvertneqq}{\u2269}");
defineMacro("\\lvertneqq", "\\html@mathml{\\@lvertneqq}{\u2268}");
defineMacro("\\ngeqq", "\\html@mathml{\\@ngeqq}{\u2271}");
defineMacro("\\ngeqslant", "\\html@mathml{\\@ngeqslant}{\u2271}");
defineMacro("\\nleqq", "\\html@mathml{\\@nleqq}{\u2270}");
defineMacro("\\nleqslant", "\\html@mathml{\\@nleqslant}{\u2270}");
defineMacro("\\nshortmid", "\\html@mathml{\\@nshortmid}{\u2224}");
defineMacro("\\nshortparallel", "\\html@mathml{\\@nshortparallel}{\u2226}");
defineMacro("\\nsubseteqq", "\\html@mathml{\\@nsubseteqq}{\u2288}");
defineMacro("\\nsupseteqq", "\\html@mathml{\\@nsupseteqq}{\u2289}");
defineMacro("\\varsubsetneq", "\\html@mathml{\\@varsubsetneq}{\u228A}");
defineMacro("\\varsubsetneqq", "\\html@mathml{\\@varsubsetneqq}{\u2ACB}");
defineMacro("\\varsupsetneq", "\\html@mathml{\\@varsupsetneq}{\u228B}");
defineMacro("\\varsupsetneqq", "\\html@mathml{\\@varsupsetneqq}{\u2ACC}");
defineMacro("\\imath", "\\html@mathml{\\@imath}{\u0131}");
defineMacro("\\jmath", "\\html@mathml{\\@jmath}{\u0237}");
defineMacro("\\llbracket", "\\html@mathml{\\mathopen{[\\mkern-3.2mu[}}{\\mathopen{\\char`\u27E6}}");
defineMacro("\\rrbracket", "\\html@mathml{\\mathclose{]\\mkern-3.2mu]}}{\\mathclose{\\char`\u27E7}}");
defineMacro("\u27E6", "\\llbracket");
defineMacro("\u27E7", "\\rrbracket");
defineMacro("\\lBrace", "\\html@mathml{\\mathopen{\\{\\mkern-3.2mu[}}{\\mathopen{\\char`\u2983}}");
defineMacro("\\rBrace", "\\html@mathml{\\mathclose{]\\mkern-3.2mu\\}}}{\\mathclose{\\char`\u2984}}");
defineMacro("\u2983", "\\lBrace");
defineMacro("\u2984", "\\rBrace");
defineMacro("\\minuso", "\\mathbin{\\html@mathml{{\\mathrlap{\\mathchoice{\\kern{0.145em}}{\\kern{0.145em}}{\\kern{0.1015em}}{\\kern{0.0725em}}\\circ}{-}}}{\\char`\u29B5}}");
defineMacro("\u29B5", "\\minuso");
defineMacro("\\darr", "\\downarrow");
defineMacro("\\dArr", "\\Downarrow");
defineMacro("\\Darr", "\\Downarrow");
defineMacro("\\lang", "\\langle");
defineMacro("\\rang", "\\rangle");
defineMacro("\\uarr", "\\uparrow");
defineMacro("\\uArr", "\\Uparrow");
defineMacro("\\Uarr", "\\Uparrow");
defineMacro("\\N", "\\mathbb{N}");
defineMacro("\\R", "\\mathbb{R}");
defineMacro("\\Z", "\\mathbb{Z}");
defineMacro("\\alef", "\\aleph");
defineMacro("\\alefsym", "\\aleph");
defineMacro("\\Alpha", "\\mathrm{A}");
defineMacro("\\Beta", "\\mathrm{B}");
defineMacro("\\bull", "\\bullet");
defineMacro("\\Chi", "\\mathrm{X}");
defineMacro("\\clubs", "\\clubsuit");
defineMacro("\\cnums", "\\mathbb{C}");
defineMacro("\\Complex", "\\mathbb{C}");
defineMacro("\\Dagger", "\\ddagger");
defineMacro("\\diamonds", "\\diamondsuit");
defineMacro("\\empty", "\\emptyset");
defineMacro("\\Epsilon", "\\mathrm{E}");
defineMacro("\\Eta", "\\mathrm{H}");
defineMacro("\\exist", "\\exists");
defineMacro("\\harr", "\\leftrightarrow");
defineMacro("\\hArr", "\\Leftrightarrow");
defineMacro("\\Harr", "\\Leftrightarrow");
defineMacro("\\hearts", "\\heartsuit");
defineMacro("\\image", "\\Im");
defineMacro("\\infin", "\\infty");
defineMacro("\\Iota", "\\mathrm{I}");
defineMacro("\\isin", "\\in");
defineMacro("\\Kappa", "\\mathrm{K}");
defineMacro("\\larr", "\\leftarrow");
defineMacro("\\lArr", "\\Leftarrow");
defineMacro("\\Larr", "\\Leftarrow");
defineMacro("\\lrarr", "\\leftrightarrow");
defineMacro("\\lrArr", "\\Leftrightarrow");
defineMacro("\\Lrarr", "\\Leftrightarrow");
defineMacro("\\Mu", "\\mathrm{M}");
defineMacro("\\natnums", "\\mathbb{N}");
defineMacro("\\Nu", "\\mathrm{N}");
defineMacro("\\Omicron", "\\mathrm{O}");
defineMacro("\\plusmn", "\\pm");
defineMacro("\\rarr", "\\rightarrow");
defineMacro("\\rArr", "\\Rightarrow");
defineMacro("\\Rarr", "\\Rightarrow");
defineMacro("\\real", "\\Re");
defineMacro("\\reals", "\\mathbb{R}");
defineMacro("\\Reals", "\\mathbb{R}");
defineMacro("\\Rho", "\\mathrm{P}");
defineMacro("\\sdot", "\\cdot");
defineMacro("\\sect", "\\S");
defineMacro("\\spades", "\\spadesuit");
defineMacro("\\sub", "\\subset");
defineMacro("\\sube", "\\subseteq");
defineMacro("\\supe", "\\supseteq");
defineMacro("\\Tau", "\\mathrm{T}");
defineMacro("\\thetasym", "\\vartheta");
defineMacro("\\weierp", "\\wp");
defineMacro("\\Zeta", "\\mathrm{Z}");
defineMacro("\\argmin", "\\DOTSB\\operatorname*{arg\\,min}");
defineMacro("\\argmax", "\\DOTSB\\operatorname*{arg\\,max}");
defineMacro("\\plim", "\\DOTSB\\mathop{\\operatorname{plim}}\\limits");
defineMacro("\\bra", "\\mathinner{\\langle{#1}|}");
defineMacro("\\ket", "\\mathinner{|{#1}\\rangle}");
defineMacro("\\braket", "\\mathinner{\\langle{#1}\\rangle}");
defineMacro("\\Bra", "\\left\\langle#1\\right|");
defineMacro("\\Ket", "\\left|#1\\right\\rangle");
var braketHelper = (one) => (context) => {
  var left = context.consumeArg().tokens;
  var middle = context.consumeArg().tokens;
  var middleDouble = context.consumeArg().tokens;
  var right = context.consumeArg().tokens;
  var oldMiddle = context.macros.get("|");
  var oldMiddleDouble = context.macros.get("\\|");
  context.macros.beginGroup();
  var midMacro = (double) => (context2) => {
    if (one) {
      context2.macros.set("|", oldMiddle);
      if (middleDouble.length) {
        context2.macros.set("\\|", oldMiddleDouble);
      }
    }
    var doubled = double;
    if (!double && middleDouble.length) {
      var nextToken = context2.future();
      if (nextToken.text === "|") {
        context2.popToken();
        doubled = true;
      }
    }
    return {
      tokens: doubled ? middleDouble : middle,
      numArgs: 0
    };
  };
  context.macros.set("|", midMacro(false));
  if (middleDouble.length) {
    context.macros.set("\\|", midMacro(true));
  }
  var arg = context.consumeArg().tokens;
  var expanded = context.expandTokens([
    ...right,
    ...arg,
    ...left
    // reversed
  ]);
  context.macros.endGroup();
  return {
    tokens: expanded.reverse(),
    numArgs: 0
  };
};
defineMacro("\\bra@ket", braketHelper(false));
defineMacro("\\bra@set", braketHelper(true));
defineMacro("\\Braket", "\\bra@ket{\\left\\langle}{\\,\\middle\\vert\\,}{\\,\\middle\\vert\\,}{\\right\\rangle}");
defineMacro("\\Set", "\\bra@set{\\left\\{\\:}{\\;\\middle\\vert\\;}{\\;\\middle\\Vert\\;}{\\:\\right\\}}");
defineMacro("\\set", "\\bra@set{\\{\\,}{\\mid}{}{\\,\\}}");
defineMacro("\\angln", "{\\angl n}");
defineMacro("\\blue", "\\textcolor{##6495ed}{#1}");
defineMacro("\\orange", "\\textcolor{##ffa500}{#1}");
defineMacro("\\pink", "\\textcolor{##ff00af}{#1}");
defineMacro("\\red", "\\textcolor{##df0030}{#1}");
defineMacro("\\green", "\\textcolor{##28ae7b}{#1}");
defineMacro("\\gray", "\\textcolor{gray}{#1}");
defineMacro("\\purple", "\\textcolor{##9d38bd}{#1}");
defineMacro("\\blueA", "\\textcolor{##ccfaff}{#1}");
defineMacro("\\blueB", "\\textcolor{##80f6ff}{#1}");
defineMacro("\\blueC", "\\textcolor{##63d9ea}{#1}");
defineMacro("\\blueD", "\\textcolor{##11accd}{#1}");
defineMacro("\\blueE", "\\textcolor{##0c7f99}{#1}");
defineMacro("\\tealA", "\\textcolor{##94fff5}{#1}");
defineMacro("\\tealB", "\\textcolor{##26edd5}{#1}");
defineMacro("\\tealC", "\\textcolor{##01d1c1}{#1}");
defineMacro("\\tealD", "\\textcolor{##01a995}{#1}");
defineMacro("\\tealE", "\\textcolor{##208170}{#1}");
defineMacro("\\greenA", "\\textcolor{##b6ffb0}{#1}");
defineMacro("\\greenB", "\\textcolor{##8af281}{#1}");
defineMacro("\\greenC", "\\textcolor{##74cf70}{#1}");
defineMacro("\\greenD", "\\textcolor{##1fab54}{#1}");
defineMacro("\\greenE", "\\textcolor{##0d923f}{#1}");
defineMacro("\\goldA", "\\textcolor{##ffd0a9}{#1}");
defineMacro("\\goldB", "\\textcolor{##ffbb71}{#1}");
defineMacro("\\goldC", "\\textcolor{##ff9c39}{#1}");
defineMacro("\\goldD", "\\textcolor{##e07d10}{#1}");
defineMacro("\\goldE", "\\textcolor{##a75a05}{#1}");
defineMacro("\\redA", "\\textcolor{##fca9a9}{#1}");
defineMacro("\\redB", "\\textcolor{##ff8482}{#1}");
defineMacro("\\redC", "\\textcolor{##f9685d}{#1}");
defineMacro("\\redD", "\\textcolor{##e84d39}{#1}");
defineMacro("\\redE", "\\textcolor{##bc2612}{#1}");
defineMacro("\\maroonA", "\\textcolor{##ffbde0}{#1}");
defineMacro("\\maroonB", "\\textcolor{##ff92c6}{#1}");
defineMacro("\\maroonC", "\\textcolor{##ed5fa6}{#1}");
defineMacro("\\maroonD", "\\textcolor{##ca337c}{#1}");
defineMacro("\\maroonE", "\\textcolor{##9e034e}{#1}");
defineMacro("\\purpleA", "\\textcolor{##ddd7ff}{#1}");
defineMacro("\\purpleB", "\\textcolor{##c6b9fc}{#1}");
defineMacro("\\purpleC", "\\textcolor{##aa87ff}{#1}");
defineMacro("\\purpleD", "\\textcolor{##7854ab}{#1}");
defineMacro("\\purpleE", "\\textcolor{##543b78}{#1}");
defineMacro("\\mintA", "\\textcolor{##f5f9e8}{#1}");
defineMacro("\\mintB", "\\textcolor{##edf2df}{#1}");
defineMacro("\\mintC", "\\textcolor{##e0e5cc}{#1}");
defineMacro("\\grayA", "\\textcolor{##f6f7f7}{#1}");
defineMacro("\\grayB", "\\textcolor{##f0f1f2}{#1}");
defineMacro("\\grayC", "\\textcolor{##e3e5e6}{#1}");
defineMacro("\\grayD", "\\textcolor{##d6d8da}{#1}");
defineMacro("\\grayE", "\\textcolor{##babec2}{#1}");
defineMacro("\\grayF", "\\textcolor{##888d93}{#1}");
defineMacro("\\grayG", "\\textcolor{##626569}{#1}");
defineMacro("\\grayH", "\\textcolor{##3b3e40}{#1}");
defineMacro("\\grayI", "\\textcolor{##21242c}{#1}");
defineMacro("\\kaBlue", "\\textcolor{##314453}{#1}");
defineMacro("\\kaGreen", "\\textcolor{##71B307}{#1}");
var implicitCommands = {
  "^": true,
  // Parser.js
  "_": true,
  // Parser.js
  "\\limits": true,
  // Parser.js
  "\\nolimits": true
  // Parser.js
};
var MacroExpander = class {
  constructor(input, settings, mode) {
    this.settings = void 0;
    this.expansionCount = void 0;
    this.lexer = void 0;
    this.macros = void 0;
    this.stack = void 0;
    this.mode = void 0;
    this.settings = settings;
    this.expansionCount = 0;
    this.feed(input);
    this.macros = new Namespace(macros, settings.macros);
    this.mode = mode;
    this.stack = [];
  }
  /**
   * Feed a new input string to the same MacroExpander
   * (with existing macros etc.).
   */
  feed(input) {
    this.lexer = new Lexer(input, this.settings);
  }
  /**
   * Switches between "text" and "math" modes.
   */
  switchMode(newMode) {
    this.mode = newMode;
  }
  /**
   * Start a new group nesting within all namespaces.
   */
  beginGroup() {
    this.macros.beginGroup();
  }
  /**
   * End current group nesting within all namespaces.
   */
  endGroup() {
    this.macros.endGroup();
  }
  /**
   * Ends all currently nested groups (if any), restoring values before the
   * groups began.  Useful in case of an error in the middle of parsing.
   */
  endGroups() {
    this.macros.endGroups();
  }
  /**
   * Returns the topmost token on the stack, without expanding it.
   * Similar in behavior to TeX's `\futurelet`.
   */
  future() {
    if (this.stack.length === 0) {
      this.pushToken(this.lexer.lex());
    }
    return this.stack[this.stack.length - 1];
  }
  /**
   * Remove and return the next unexpanded token.
   */
  popToken() {
    this.future();
    return this.stack.pop();
  }
  /**
   * Add a given token to the token stack.  In particular, this get be used
   * to put back a token returned from one of the other methods.
   */
  pushToken(token) {
    this.stack.push(token);
  }
  /**
   * Append an array of tokens to the token stack.
   */
  pushTokens(tokens) {
    this.stack.push(...tokens);
  }
  /**
   * Find an macro argument without expanding tokens and append the array of
   * tokens to the token stack. Uses Token as a container for the result.
   */
  scanArgument(isOptional) {
    var start;
    var end;
    var tokens;
    if (isOptional) {
      this.consumeSpaces();
      if (this.future().text !== "[") {
        return null;
      }
      start = this.popToken();
      ({
        tokens,
        end
      } = this.consumeArg(["]"]));
    } else {
      ({
        tokens,
        start,
        end
      } = this.consumeArg());
    }
    this.pushToken(new Token("EOF", end.loc));
    this.pushTokens(tokens);
    return start.range(end, "");
  }
  /**
   * Consume all following space tokens, without expansion.
   */
  consumeSpaces() {
    for (; ; ) {
      var token = this.future();
      if (token.text === " ") {
        this.stack.pop();
      } else {
        break;
      }
    }
  }
  /**
   * Consume an argument from the token stream, and return the resulting array
   * of tokens and start/end token.
   */
  consumeArg(delims) {
    var tokens = [];
    var isDelimited = delims && delims.length > 0;
    if (!isDelimited) {
      this.consumeSpaces();
    }
    var start = this.future();
    var tok;
    var depth = 0;
    var match = 0;
    do {
      tok = this.popToken();
      tokens.push(tok);
      if (tok.text === "{") {
        ++depth;
      } else if (tok.text === "}") {
        --depth;
        if (depth === -1) {
          throw new ParseError("Extra }", tok);
        }
      } else if (tok.text === "EOF") {
        throw new ParseError("Unexpected end of input in a macro argument, expected '" + (delims && isDelimited ? delims[match] : "}") + "'", tok);
      }
      if (delims && isDelimited) {
        if ((depth === 0 || depth === 1 && delims[match] === "{") && tok.text === delims[match]) {
          ++match;
          if (match === delims.length) {
            tokens.splice(-match, match);
            break;
          }
        } else {
          match = 0;
        }
      }
    } while (depth !== 0 || isDelimited);
    if (start.text === "{" && tokens[tokens.length - 1].text === "}") {
      tokens.pop();
      tokens.shift();
    }
    tokens.reverse();
    return {
      tokens,
      start,
      end: tok
    };
  }
  /**
   * Consume the specified number of (delimited) arguments from the token
   * stream and return the resulting array of arguments.
   */
  consumeArgs(numArgs, delimiters2) {
    if (delimiters2) {
      if (delimiters2.length !== numArgs + 1) {
        throw new ParseError("The length of delimiters doesn't match the number of args!");
      }
      var delims = delimiters2[0];
      for (var i = 0; i < delims.length; i++) {
        var tok = this.popToken();
        if (delims[i] !== tok.text) {
          throw new ParseError("Use of the macro doesn't match its definition", tok);
        }
      }
    }
    var args = [];
    for (var _i = 0; _i < numArgs; _i++) {
      args.push(this.consumeArg(delimiters2 && delimiters2[_i + 1]).tokens);
    }
    return args;
  }
  /**
   * Increment `expansionCount` by the specified amount.
   * Throw an error if it exceeds `maxExpand`.
   */
  countExpansion(amount) {
    this.expansionCount += amount;
    if (this.expansionCount > this.settings.maxExpand) {
      throw new ParseError("Too many expansions: infinite loop or need to increase maxExpand setting");
    }
  }
  /**
   * Expand the next token only once if possible.
   *
   * If the token is expanded, the resulting tokens will be pushed onto
   * the stack in reverse order, and the number of such tokens will be
   * returned.  This number might be zero or positive.
   *
   * If not, the return value is `false`, and the next token remains at the
   * top of the stack.
   *
   * In either case, the next token will be on the top of the stack,
   * or the stack will be empty (in case of empty expansion
   * and no other tokens).
   *
   * Used to implement `expandAfterFuture` and `expandNextToken`.
   *
   * If expandableOnly, only expandable tokens are expanded and
   * an undefined control sequence results in an error.
   */
  expandOnce(expandableOnly) {
    var topToken = this.popToken();
    var name2 = topToken.text;
    var expansion = !topToken.noexpand ? this._getExpansion(name2) : null;
    if (expansion == null || expandableOnly && expansion.unexpandable) {
      if (expandableOnly && expansion == null && name2[0] === "\\" && !this.isDefined(name2)) {
        throw new ParseError("Undefined control sequence: " + name2);
      }
      this.pushToken(topToken);
      return false;
    }
    this.countExpansion(1);
    var tokens = expansion.tokens;
    var args = this.consumeArgs(expansion.numArgs, expansion.delimiters);
    if (expansion.numArgs) {
      tokens = tokens.slice();
      for (var i = tokens.length - 1; i >= 0; --i) {
        var tok = tokens[i];
        if (tok.text === "#") {
          if (i === 0) {
            throw new ParseError("Incomplete placeholder at end of macro body", tok);
          }
          tok = tokens[--i];
          if (tok.text === "#") {
            tokens.splice(i + 1, 1);
          } else if (/^[1-9]$/.test(tok.text)) {
            tokens.splice(i, 2, ...args[+tok.text - 1]);
          } else {
            throw new ParseError("Not a valid argument number", tok);
          }
        }
      }
    }
    this.pushTokens(tokens);
    return tokens.length;
  }
  /**
   * Expand the next token only once (if possible), and return the resulting
   * top token on the stack (without removing anything from the stack).
   * Similar in behavior to TeX's `\expandafter\futurelet`.
   * Equivalent to expandOnce() followed by future().
   */
  expandAfterFuture() {
    this.expandOnce();
    return this.future();
  }
  /**
   * Recursively expand first token, then return first non-expandable token.
   */
  expandNextToken() {
    for (; ; ) {
      if (this.expandOnce() === false) {
        var token = this.stack.pop();
        if (token.treatAsRelax) {
          token.text = "\\relax";
        }
        return token;
      }
    }
    throw new Error();
  }
  /**
   * Fully expand the given macro name and return the resulting list of
   * tokens, or return `undefined` if no such macro is defined.
   */
  expandMacro(name2) {
    return this.macros.has(name2) ? this.expandTokens([new Token(name2)]) : void 0;
  }
  /**
   * Fully expand the given token stream and return the resulting list of
   * tokens.  Note that the input tokens are in reverse order, but the
   * output tokens are in forward order.
   */
  expandTokens(tokens) {
    var output = [];
    var oldStackLength = this.stack.length;
    this.pushTokens(tokens);
    while (this.stack.length > oldStackLength) {
      if (this.expandOnce(true) === false) {
        var token = this.stack.pop();
        if (token.treatAsRelax) {
          token.noexpand = false;
          token.treatAsRelax = false;
        }
        output.push(token);
      }
    }
    this.countExpansion(output.length);
    return output;
  }
  /**
   * Fully expand the given macro name and return the result as a string,
   * or return `undefined` if no such macro is defined.
   */
  expandMacroAsText(name2) {
    var tokens = this.expandMacro(name2);
    if (tokens) {
      return tokens.map((token) => token.text).join("");
    } else {
      return tokens;
    }
  }
  /**
   * Returns the expanded macro as a reversed array of tokens and a macro
   * argument count.  Or returns `null` if no such macro.
   */
  _getExpansion(name2) {
    var definition = this.macros.get(name2);
    if (definition == null) {
      return definition;
    }
    if (name2.length === 1) {
      var catcode = this.lexer.catcodes[name2];
      if (catcode != null && catcode !== 13) {
        return;
      }
    }
    var expansion = typeof definition === "function" ? definition(this) : definition;
    if (typeof expansion === "string") {
      var numArgs = 0;
      if (expansion.indexOf("#") !== -1) {
        var stripped = expansion.replace(/##/g, "");
        while (stripped.indexOf("#" + (numArgs + 1)) !== -1) {
          ++numArgs;
        }
      }
      var bodyLexer = new Lexer(expansion, this.settings);
      var tokens = [];
      var tok = bodyLexer.lex();
      while (tok.text !== "EOF") {
        tokens.push(tok);
        tok = bodyLexer.lex();
      }
      tokens.reverse();
      var expanded = {
        tokens,
        numArgs
      };
      return expanded;
    }
    return expansion;
  }
  /**
   * Determine whether a command is currently "defined" (has some
   * functionality), meaning that it's a macro (in the current group),
   * a function, a symbol, or one of the special commands listed in
   * `implicitCommands`.
   */
  isDefined(name2) {
    return this.macros.has(name2) || functions.hasOwnProperty(name2) || symbols.math.hasOwnProperty(name2) || symbols.text.hasOwnProperty(name2) || implicitCommands.hasOwnProperty(name2);
  }
  /**
   * Determine whether a command is expandable.
   */
  isExpandable(name2) {
    var macro = this.macros.get(name2);
    return macro != null ? typeof macro === "string" || typeof macro === "function" || !macro.unexpandable : functions.hasOwnProperty(name2) && !functions[name2].primitive;
  }
};
var unicodeSubRegEx = /^[₊₋₌₍₎₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵦᵧᵨᵩᵪ]/;
var uSubsAndSups = Object.freeze({
  "\u208A": "+",
  "\u208B": "-",
  "\u208C": "=",
  "\u208D": "(",
  "\u208E": ")",
  "\u2080": "0",
  "\u2081": "1",
  "\u2082": "2",
  "\u2083": "3",
  "\u2084": "4",
  "\u2085": "5",
  "\u2086": "6",
  "\u2087": "7",
  "\u2088": "8",
  "\u2089": "9",
  "\u2090": "a",
  "\u2091": "e",
  "\u2095": "h",
  "\u1D62": "i",
  "\u2C7C": "j",
  "\u2096": "k",
  "\u2097": "l",
  "\u2098": "m",
  "\u2099": "n",
  "\u2092": "o",
  "\u209A": "p",
  "\u1D63": "r",
  "\u209B": "s",
  "\u209C": "t",
  "\u1D64": "u",
  "\u1D65": "v",
  "\u2093": "x",
  "\u1D66": "\u03B2",
  "\u1D67": "\u03B3",
  "\u1D68": "\u03C1",
  "\u1D69": "\u03D5",
  "\u1D6A": "\u03C7",
  "\u207A": "+",
  "\u207B": "-",
  "\u207C": "=",
  "\u207D": "(",
  "\u207E": ")",
  "\u2070": "0",
  "\xB9": "1",
  "\xB2": "2",
  "\xB3": "3",
  "\u2074": "4",
  "\u2075": "5",
  "\u2076": "6",
  "\u2077": "7",
  "\u2078": "8",
  "\u2079": "9",
  "\u1D2C": "A",
  "\u1D2E": "B",
  "\u1D30": "D",
  "\u1D31": "E",
  "\u1D33": "G",
  "\u1D34": "H",
  "\u1D35": "I",
  "\u1D36": "J",
  "\u1D37": "K",
  "\u1D38": "L",
  "\u1D39": "M",
  "\u1D3A": "N",
  "\u1D3C": "O",
  "\u1D3E": "P",
  "\u1D3F": "R",
  "\u1D40": "T",
  "\u1D41": "U",
  "\u2C7D": "V",
  "\u1D42": "W",
  "\u1D43": "a",
  "\u1D47": "b",
  "\u1D9C": "c",
  "\u1D48": "d",
  "\u1D49": "e",
  "\u1DA0": "f",
  "\u1D4D": "g",
  "\u02B0": "h",
  "\u2071": "i",
  "\u02B2": "j",
  "\u1D4F": "k",
  "\u02E1": "l",
  "\u1D50": "m",
  "\u207F": "n",
  "\u1D52": "o",
  "\u1D56": "p",
  "\u02B3": "r",
  "\u02E2": "s",
  "\u1D57": "t",
  "\u1D58": "u",
  "\u1D5B": "v",
  "\u02B7": "w",
  "\u02E3": "x",
  "\u02B8": "y",
  "\u1DBB": "z",
  "\u1D5D": "\u03B2",
  "\u1D5E": "\u03B3",
  "\u1D5F": "\u03B4",
  "\u1D60": "\u03D5",
  "\u1D61": "\u03C7",
  "\u1DBF": "\u03B8"
});
var unicodeAccents = {
  "\u0301": {
    "text": "\\'",
    "math": "\\acute"
  },
  "\u0300": {
    "text": "\\`",
    "math": "\\grave"
  },
  "\u0308": {
    "text": '\\"',
    "math": "\\ddot"
  },
  "\u0303": {
    "text": "\\~",
    "math": "\\tilde"
  },
  "\u0304": {
    "text": "\\=",
    "math": "\\bar"
  },
  "\u0306": {
    "text": "\\u",
    "math": "\\breve"
  },
  "\u030C": {
    "text": "\\v",
    "math": "\\check"
  },
  "\u0302": {
    "text": "\\^",
    "math": "\\hat"
  },
  "\u0307": {
    "text": "\\.",
    "math": "\\dot"
  },
  "\u030A": {
    "text": "\\r",
    "math": "\\mathring"
  },
  "\u030B": {
    "text": "\\H"
  },
  "\u0327": {
    "text": "\\c"
  }
};
var unicodeSymbols = {
  "\xE1": "a\u0301",
  "\xE0": "a\u0300",
  "\xE4": "a\u0308",
  "\u01DF": "a\u0308\u0304",
  "\xE3": "a\u0303",
  "\u0101": "a\u0304",
  "\u0103": "a\u0306",
  "\u1EAF": "a\u0306\u0301",
  "\u1EB1": "a\u0306\u0300",
  "\u1EB5": "a\u0306\u0303",
  "\u01CE": "a\u030C",
  "\xE2": "a\u0302",
  "\u1EA5": "a\u0302\u0301",
  "\u1EA7": "a\u0302\u0300",
  "\u1EAB": "a\u0302\u0303",
  "\u0227": "a\u0307",
  "\u01E1": "a\u0307\u0304",
  "\xE5": "a\u030A",
  "\u01FB": "a\u030A\u0301",
  "\u1E03": "b\u0307",
  "\u0107": "c\u0301",
  "\u1E09": "c\u0327\u0301",
  "\u010D": "c\u030C",
  "\u0109": "c\u0302",
  "\u010B": "c\u0307",
  "\xE7": "c\u0327",
  "\u010F": "d\u030C",
  "\u1E0B": "d\u0307",
  "\u1E11": "d\u0327",
  "\xE9": "e\u0301",
  "\xE8": "e\u0300",
  "\xEB": "e\u0308",
  "\u1EBD": "e\u0303",
  "\u0113": "e\u0304",
  "\u1E17": "e\u0304\u0301",
  "\u1E15": "e\u0304\u0300",
  "\u0115": "e\u0306",
  "\u1E1D": "e\u0327\u0306",
  "\u011B": "e\u030C",
  "\xEA": "e\u0302",
  "\u1EBF": "e\u0302\u0301",
  "\u1EC1": "e\u0302\u0300",
  "\u1EC5": "e\u0302\u0303",
  "\u0117": "e\u0307",
  "\u0229": "e\u0327",
  "\u1E1F": "f\u0307",
  "\u01F5": "g\u0301",
  "\u1E21": "g\u0304",
  "\u011F": "g\u0306",
  "\u01E7": "g\u030C",
  "\u011D": "g\u0302",
  "\u0121": "g\u0307",
  "\u0123": "g\u0327",
  "\u1E27": "h\u0308",
  "\u021F": "h\u030C",
  "\u0125": "h\u0302",
  "\u1E23": "h\u0307",
  "\u1E29": "h\u0327",
  "\xED": "i\u0301",
  "\xEC": "i\u0300",
  "\xEF": "i\u0308",
  "\u1E2F": "i\u0308\u0301",
  "\u0129": "i\u0303",
  "\u012B": "i\u0304",
  "\u012D": "i\u0306",
  "\u01D0": "i\u030C",
  "\xEE": "i\u0302",
  "\u01F0": "j\u030C",
  "\u0135": "j\u0302",
  "\u1E31": "k\u0301",
  "\u01E9": "k\u030C",
  "\u0137": "k\u0327",
  "\u013A": "l\u0301",
  "\u013E": "l\u030C",
  "\u013C": "l\u0327",
  "\u1E3F": "m\u0301",
  "\u1E41": "m\u0307",
  "\u0144": "n\u0301",
  "\u01F9": "n\u0300",
  "\xF1": "n\u0303",
  "\u0148": "n\u030C",
  "\u1E45": "n\u0307",
  "\u0146": "n\u0327",
  "\xF3": "o\u0301",
  "\xF2": "o\u0300",
  "\xF6": "o\u0308",
  "\u022B": "o\u0308\u0304",
  "\xF5": "o\u0303",
  "\u1E4D": "o\u0303\u0301",
  "\u1E4F": "o\u0303\u0308",
  "\u022D": "o\u0303\u0304",
  "\u014D": "o\u0304",
  "\u1E53": "o\u0304\u0301",
  "\u1E51": "o\u0304\u0300",
  "\u014F": "o\u0306",
  "\u01D2": "o\u030C",
  "\xF4": "o\u0302",
  "\u1ED1": "o\u0302\u0301",
  "\u1ED3": "o\u0302\u0300",
  "\u1ED7": "o\u0302\u0303",
  "\u022F": "o\u0307",
  "\u0231": "o\u0307\u0304",
  "\u0151": "o\u030B",
  "\u1E55": "p\u0301",
  "\u1E57": "p\u0307",
  "\u0155": "r\u0301",
  "\u0159": "r\u030C",
  "\u1E59": "r\u0307",
  "\u0157": "r\u0327",
  "\u015B": "s\u0301",
  "\u1E65": "s\u0301\u0307",
  "\u0161": "s\u030C",
  "\u1E67": "s\u030C\u0307",
  "\u015D": "s\u0302",
  "\u1E61": "s\u0307",
  "\u015F": "s\u0327",
  "\u1E97": "t\u0308",
  "\u0165": "t\u030C",
  "\u1E6B": "t\u0307",
  "\u0163": "t\u0327",
  "\xFA": "u\u0301",
  "\xF9": "u\u0300",
  "\xFC": "u\u0308",
  "\u01D8": "u\u0308\u0301",
  "\u01DC": "u\u0308\u0300",
  "\u01D6": "u\u0308\u0304",
  "\u01DA": "u\u0308\u030C",
  "\u0169": "u\u0303",
  "\u1E79": "u\u0303\u0301",
  "\u016B": "u\u0304",
  "\u1E7B": "u\u0304\u0308",
  "\u016D": "u\u0306",
  "\u01D4": "u\u030C",
  "\xFB": "u\u0302",
  "\u016F": "u\u030A",
  "\u0171": "u\u030B",
  "\u1E7D": "v\u0303",
  "\u1E83": "w\u0301",
  "\u1E81": "w\u0300",
  "\u1E85": "w\u0308",
  "\u0175": "w\u0302",
  "\u1E87": "w\u0307",
  "\u1E98": "w\u030A",
  "\u1E8D": "x\u0308",
  "\u1E8B": "x\u0307",
  "\xFD": "y\u0301",
  "\u1EF3": "y\u0300",
  "\xFF": "y\u0308",
  "\u1EF9": "y\u0303",
  "\u0233": "y\u0304",
  "\u0177": "y\u0302",
  "\u1E8F": "y\u0307",
  "\u1E99": "y\u030A",
  "\u017A": "z\u0301",
  "\u017E": "z\u030C",
  "\u1E91": "z\u0302",
  "\u017C": "z\u0307",
  "\xC1": "A\u0301",
  "\xC0": "A\u0300",
  "\xC4": "A\u0308",
  "\u01DE": "A\u0308\u0304",
  "\xC3": "A\u0303",
  "\u0100": "A\u0304",
  "\u0102": "A\u0306",
  "\u1EAE": "A\u0306\u0301",
  "\u1EB0": "A\u0306\u0300",
  "\u1EB4": "A\u0306\u0303",
  "\u01CD": "A\u030C",
  "\xC2": "A\u0302",
  "\u1EA4": "A\u0302\u0301",
  "\u1EA6": "A\u0302\u0300",
  "\u1EAA": "A\u0302\u0303",
  "\u0226": "A\u0307",
  "\u01E0": "A\u0307\u0304",
  "\xC5": "A\u030A",
  "\u01FA": "A\u030A\u0301",
  "\u1E02": "B\u0307",
  "\u0106": "C\u0301",
  "\u1E08": "C\u0327\u0301",
  "\u010C": "C\u030C",
  "\u0108": "C\u0302",
  "\u010A": "C\u0307",
  "\xC7": "C\u0327",
  "\u010E": "D\u030C",
  "\u1E0A": "D\u0307",
  "\u1E10": "D\u0327",
  "\xC9": "E\u0301",
  "\xC8": "E\u0300",
  "\xCB": "E\u0308",
  "\u1EBC": "E\u0303",
  "\u0112": "E\u0304",
  "\u1E16": "E\u0304\u0301",
  "\u1E14": "E\u0304\u0300",
  "\u0114": "E\u0306",
  "\u1E1C": "E\u0327\u0306",
  "\u011A": "E\u030C",
  "\xCA": "E\u0302",
  "\u1EBE": "E\u0302\u0301",
  "\u1EC0": "E\u0302\u0300",
  "\u1EC4": "E\u0302\u0303",
  "\u0116": "E\u0307",
  "\u0228": "E\u0327",
  "\u1E1E": "F\u0307",
  "\u01F4": "G\u0301",
  "\u1E20": "G\u0304",
  "\u011E": "G\u0306",
  "\u01E6": "G\u030C",
  "\u011C": "G\u0302",
  "\u0120": "G\u0307",
  "\u0122": "G\u0327",
  "\u1E26": "H\u0308",
  "\u021E": "H\u030C",
  "\u0124": "H\u0302",
  "\u1E22": "H\u0307",
  "\u1E28": "H\u0327",
  "\xCD": "I\u0301",
  "\xCC": "I\u0300",
  "\xCF": "I\u0308",
  "\u1E2E": "I\u0308\u0301",
  "\u0128": "I\u0303",
  "\u012A": "I\u0304",
  "\u012C": "I\u0306",
  "\u01CF": "I\u030C",
  "\xCE": "I\u0302",
  "\u0130": "I\u0307",
  "\u0134": "J\u0302",
  "\u1E30": "K\u0301",
  "\u01E8": "K\u030C",
  "\u0136": "K\u0327",
  "\u0139": "L\u0301",
  "\u013D": "L\u030C",
  "\u013B": "L\u0327",
  "\u1E3E": "M\u0301",
  "\u1E40": "M\u0307",
  "\u0143": "N\u0301",
  "\u01F8": "N\u0300",
  "\xD1": "N\u0303",
  "\u0147": "N\u030C",
  "\u1E44": "N\u0307",
  "\u0145": "N\u0327",
  "\xD3": "O\u0301",
  "\xD2": "O\u0300",
  "\xD6": "O\u0308",
  "\u022A": "O\u0308\u0304",
  "\xD5": "O\u0303",
  "\u1E4C": "O\u0303\u0301",
  "\u1E4E": "O\u0303\u0308",
  "\u022C": "O\u0303\u0304",
  "\u014C": "O\u0304",
  "\u1E52": "O\u0304\u0301",
  "\u1E50": "O\u0304\u0300",
  "\u014E": "O\u0306",
  "\u01D1": "O\u030C",
  "\xD4": "O\u0302",
  "\u1ED0": "O\u0302\u0301",
  "\u1ED2": "O\u0302\u0300",
  "\u1ED6": "O\u0302\u0303",
  "\u022E": "O\u0307",
  "\u0230": "O\u0307\u0304",
  "\u0150": "O\u030B",
  "\u1E54": "P\u0301",
  "\u1E56": "P\u0307",
  "\u0154": "R\u0301",
  "\u0158": "R\u030C",
  "\u1E58": "R\u0307",
  "\u0156": "R\u0327",
  "\u015A": "S\u0301",
  "\u1E64": "S\u0301\u0307",
  "\u0160": "S\u030C",
  "\u1E66": "S\u030C\u0307",
  "\u015C": "S\u0302",
  "\u1E60": "S\u0307",
  "\u015E": "S\u0327",
  "\u0164": "T\u030C",
  "\u1E6A": "T\u0307",
  "\u0162": "T\u0327",
  "\xDA": "U\u0301",
  "\xD9": "U\u0300",
  "\xDC": "U\u0308",
  "\u01D7": "U\u0308\u0301",
  "\u01DB": "U\u0308\u0300",
  "\u01D5": "U\u0308\u0304",
  "\u01D9": "U\u0308\u030C",
  "\u0168": "U\u0303",
  "\u1E78": "U\u0303\u0301",
  "\u016A": "U\u0304",
  "\u1E7A": "U\u0304\u0308",
  "\u016C": "U\u0306",
  "\u01D3": "U\u030C",
  "\xDB": "U\u0302",
  "\u016E": "U\u030A",
  "\u0170": "U\u030B",
  "\u1E7C": "V\u0303",
  "\u1E82": "W\u0301",
  "\u1E80": "W\u0300",
  "\u1E84": "W\u0308",
  "\u0174": "W\u0302",
  "\u1E86": "W\u0307",
  "\u1E8C": "X\u0308",
  "\u1E8A": "X\u0307",
  "\xDD": "Y\u0301",
  "\u1EF2": "Y\u0300",
  "\u0178": "Y\u0308",
  "\u1EF8": "Y\u0303",
  "\u0232": "Y\u0304",
  "\u0176": "Y\u0302",
  "\u1E8E": "Y\u0307",
  "\u0179": "Z\u0301",
  "\u017D": "Z\u030C",
  "\u1E90": "Z\u0302",
  "\u017B": "Z\u0307",
  "\u03AC": "\u03B1\u0301",
  "\u1F70": "\u03B1\u0300",
  "\u1FB1": "\u03B1\u0304",
  "\u1FB0": "\u03B1\u0306",
  "\u03AD": "\u03B5\u0301",
  "\u1F72": "\u03B5\u0300",
  "\u03AE": "\u03B7\u0301",
  "\u1F74": "\u03B7\u0300",
  "\u03AF": "\u03B9\u0301",
  "\u1F76": "\u03B9\u0300",
  "\u03CA": "\u03B9\u0308",
  "\u0390": "\u03B9\u0308\u0301",
  "\u1FD2": "\u03B9\u0308\u0300",
  "\u1FD1": "\u03B9\u0304",
  "\u1FD0": "\u03B9\u0306",
  "\u03CC": "\u03BF\u0301",
  "\u1F78": "\u03BF\u0300",
  "\u03CD": "\u03C5\u0301",
  "\u1F7A": "\u03C5\u0300",
  "\u03CB": "\u03C5\u0308",
  "\u03B0": "\u03C5\u0308\u0301",
  "\u1FE2": "\u03C5\u0308\u0300",
  "\u1FE1": "\u03C5\u0304",
  "\u1FE0": "\u03C5\u0306",
  "\u03CE": "\u03C9\u0301",
  "\u1F7C": "\u03C9\u0300",
  "\u038E": "\u03A5\u0301",
  "\u1FEA": "\u03A5\u0300",
  "\u03AB": "\u03A5\u0308",
  "\u1FE9": "\u03A5\u0304",
  "\u1FE8": "\u03A5\u0306",
  "\u038F": "\u03A9\u0301",
  "\u1FFA": "\u03A9\u0300"
};
var Parser = class _Parser {
  constructor(input, settings) {
    this.mode = void 0;
    this.gullet = void 0;
    this.settings = void 0;
    this.leftrightDepth = void 0;
    this.nextToken = void 0;
    this.mode = "math";
    this.gullet = new MacroExpander(input, settings, this.mode);
    this.settings = settings;
    this.leftrightDepth = 0;
  }
  /**
   * Checks a result to make sure it has the right type, and throws an
   * appropriate error otherwise.
   */
  expect(text2, consume) {
    if (consume === void 0) {
      consume = true;
    }
    if (this.fetch().text !== text2) {
      throw new ParseError("Expected '" + text2 + "', got '" + this.fetch().text + "'", this.fetch());
    }
    if (consume) {
      this.consume();
    }
  }
  /**
   * Discards the current lookahead token, considering it consumed.
   */
  consume() {
    this.nextToken = null;
  }
  /**
   * Return the current lookahead token, or if there isn't one (at the
   * beginning, or if the previous lookahead token was consume()d),
   * fetch the next token as the new lookahead token and return it.
   */
  fetch() {
    if (this.nextToken == null) {
      this.nextToken = this.gullet.expandNextToken();
    }
    return this.nextToken;
  }
  /**
   * Switches between "text" and "math" modes.
   */
  switchMode(newMode) {
    this.mode = newMode;
    this.gullet.switchMode(newMode);
  }
  /**
   * Main parsing function, which parses an entire input.
   */
  parse() {
    if (!this.settings.globalGroup) {
      this.gullet.beginGroup();
    }
    if (this.settings.colorIsTextColor) {
      this.gullet.macros.set("\\color", "\\textcolor");
    }
    try {
      var parse = this.parseExpression(false);
      this.expect("EOF");
      if (!this.settings.globalGroup) {
        this.gullet.endGroup();
      }
      return parse;
    } finally {
      this.gullet.endGroups();
    }
  }
  /**
   * Fully parse a separate sequence of tokens as a separate job.
   * Tokens should be specified in reverse order, as in a MacroDefinition.
   */
  subparse(tokens) {
    var oldToken = this.nextToken;
    this.consume();
    this.gullet.pushToken(new Token("}"));
    this.gullet.pushTokens(tokens);
    var parse = this.parseExpression(false);
    this.expect("}");
    this.nextToken = oldToken;
    return parse;
  }
  /**
   * Parses an "expression", which is a list of atoms.
   *
   * `breakOnInfix`: Should the parsing stop when we hit infix nodes? This
   *                 happens when functions have higher precedence han infix
   *                 nodes in implicit parses.
   *
   * `breakOnTokenText`: The text of the token that the expression should end
   *                     with, or `null` if something else should end the
   *                     expression.
   */
  parseExpression(breakOnInfix, breakOnTokenText) {
    var body = [];
    while (true) {
      if (this.mode === "math") {
        this.consumeSpaces();
      }
      var lex = this.fetch();
      if (_Parser.endOfExpression.indexOf(lex.text) !== -1) {
        break;
      }
      if (breakOnTokenText && lex.text === breakOnTokenText) {
        break;
      }
      if (breakOnInfix && functions[lex.text] && functions[lex.text].infix) {
        break;
      }
      var atom = this.parseAtom(breakOnTokenText);
      if (!atom) {
        break;
      } else if (atom.type === "internal") {
        continue;
      }
      body.push(atom);
    }
    if (this.mode === "text") {
      this.formLigatures(body);
    }
    return this.handleInfixNodes(body);
  }
  /**
   * Rewrites infix operators such as \over with corresponding commands such
   * as \frac.
   *
   * There can only be one infix operator per group.  If there's more than one
   * then the expression is ambiguous.  This can be resolved by adding {}.
   */
  handleInfixNodes(body) {
    var overIndex = -1;
    var funcName;
    for (var i = 0; i < body.length; i++) {
      if (body[i].type === "infix") {
        if (overIndex !== -1) {
          throw new ParseError("only one infix operator per group", body[i].token);
        }
        overIndex = i;
        funcName = body[i].replaceWith;
      }
    }
    if (overIndex !== -1 && funcName) {
      var numerNode;
      var denomNode;
      var numerBody = body.slice(0, overIndex);
      var denomBody = body.slice(overIndex + 1);
      if (numerBody.length === 1 && numerBody[0].type === "ordgroup") {
        numerNode = numerBody[0];
      } else {
        numerNode = {
          type: "ordgroup",
          mode: this.mode,
          body: numerBody
        };
      }
      if (denomBody.length === 1 && denomBody[0].type === "ordgroup") {
        denomNode = denomBody[0];
      } else {
        denomNode = {
          type: "ordgroup",
          mode: this.mode,
          body: denomBody
        };
      }
      var node;
      if (funcName === "\\\\abovefrac") {
        node = this.callFunction(funcName, [numerNode, body[overIndex], denomNode], []);
      } else {
        node = this.callFunction(funcName, [numerNode, denomNode], []);
      }
      return [node];
    } else {
      return body;
    }
  }
  /**
   * Handle a subscript or superscript with nice errors.
   */
  handleSupSubscript(name2) {
    var symbolToken = this.fetch();
    var symbol = symbolToken.text;
    this.consume();
    this.consumeSpaces();
    var group;
    do {
      var _group;
      group = this.parseGroup(name2);
    } while (((_group = group) == null ? void 0 : _group.type) === "internal");
    if (!group) {
      throw new ParseError("Expected group after '" + symbol + "'", symbolToken);
    }
    return group;
  }
  /**
   * Converts the textual input of an unsupported command into a text node
   * contained within a color node whose color is determined by errorColor
   */
  formatUnsupportedCmd(text2) {
    var textordArray = [];
    for (var i = 0; i < text2.length; i++) {
      textordArray.push({
        type: "textord",
        mode: "text",
        text: text2[i]
      });
    }
    var textNode = {
      type: "text",
      mode: this.mode,
      body: textordArray
    };
    var colorNode = {
      type: "color",
      mode: this.mode,
      color: this.settings.errorColor,
      body: [textNode]
    };
    return colorNode;
  }
  /**
   * Parses a group with optional super/subscripts.
   */
  parseAtom(breakOnTokenText) {
    var base = this.parseGroup("atom", breakOnTokenText);
    if ((base == null ? void 0 : base.type) === "internal") {
      return base;
    }
    if (this.mode === "text") {
      return base;
    }
    var superscript;
    var subscript;
    while (true) {
      this.consumeSpaces();
      var lex = this.fetch();
      if (lex.text === "\\limits" || lex.text === "\\nolimits") {
        if (base && base.type === "op") {
          var limits = lex.text === "\\limits";
          base.limits = limits;
          base.alwaysHandleSupSub = true;
        } else if (base && base.type === "operatorname") {
          if (base.alwaysHandleSupSub) {
            base.limits = lex.text === "\\limits";
          }
        } else {
          throw new ParseError("Limit controls must follow a math operator", lex);
        }
        this.consume();
      } else if (lex.text === "^") {
        if (superscript) {
          throw new ParseError("Double superscript", lex);
        }
        superscript = this.handleSupSubscript("superscript");
      } else if (lex.text === "_") {
        if (subscript) {
          throw new ParseError("Double subscript", lex);
        }
        subscript = this.handleSupSubscript("subscript");
      } else if (lex.text === "'") {
        if (superscript) {
          throw new ParseError("Double superscript", lex);
        }
        var prime = {
          type: "textord",
          mode: this.mode,
          text: "\\prime"
        };
        var primes = [prime];
        this.consume();
        while (this.fetch().text === "'") {
          primes.push(prime);
          this.consume();
        }
        if (this.fetch().text === "^") {
          primes.push(this.handleSupSubscript("superscript"));
        }
        superscript = {
          type: "ordgroup",
          mode: this.mode,
          body: primes
        };
      } else if (uSubsAndSups[lex.text]) {
        var isSub = unicodeSubRegEx.test(lex.text);
        var subsupTokens = [];
        subsupTokens.push(new Token(uSubsAndSups[lex.text]));
        this.consume();
        while (true) {
          var token = this.fetch().text;
          if (!uSubsAndSups[token]) {
            break;
          }
          if (unicodeSubRegEx.test(token) !== isSub) {
            break;
          }
          subsupTokens.unshift(new Token(uSubsAndSups[token]));
          this.consume();
        }
        var body = this.subparse(subsupTokens);
        if (isSub) {
          subscript = {
            type: "ordgroup",
            mode: "math",
            body
          };
        } else {
          superscript = {
            type: "ordgroup",
            mode: "math",
            body
          };
        }
      } else {
        break;
      }
    }
    if (superscript || subscript) {
      return {
        type: "supsub",
        mode: this.mode,
        base,
        sup: superscript,
        sub: subscript
      };
    } else {
      return base;
    }
  }
  /**
   * Parses an entire function, including its base and all of its arguments.
   */
  parseFunction(breakOnTokenText, name2) {
    var token = this.fetch();
    var func = token.text;
    var funcData = functions[func];
    if (!funcData) {
      return null;
    }
    this.consume();
    if (name2 && name2 !== "atom" && !funcData.allowedInArgument) {
      throw new ParseError("Got function '" + func + "' with no arguments" + (name2 ? " as " + name2 : ""), token);
    } else if (this.mode === "text" && !funcData.allowedInText) {
      throw new ParseError("Can't use function '" + func + "' in text mode", token);
    } else if (this.mode === "math" && funcData.allowedInMath === false) {
      throw new ParseError("Can't use function '" + func + "' in math mode", token);
    }
    var {
      args,
      optArgs
    } = this.parseArguments(func, funcData);
    return this.callFunction(func, args, optArgs, token, breakOnTokenText);
  }
  /**
   * Call a function handler with a suitable context and arguments.
   */
  callFunction(name2, args, optArgs, token, breakOnTokenText) {
    var context = {
      funcName: name2,
      parser: this,
      token,
      breakOnTokenText
    };
    var func = functions[name2];
    if (func && func.handler) {
      return func.handler(context, args, optArgs);
    } else {
      throw new ParseError("No function handler for " + name2);
    }
  }
  /**
   * Parses the arguments of a function or environment
   */
  parseArguments(func, funcData) {
    var totalArgs = funcData.numArgs + funcData.numOptionalArgs;
    if (totalArgs === 0) {
      return {
        args: [],
        optArgs: []
      };
    }
    var args = [];
    var optArgs = [];
    for (var i = 0; i < totalArgs; i++) {
      var argType = funcData.argTypes && funcData.argTypes[i];
      var isOptional = i < funcData.numOptionalArgs;
      if (funcData.primitive && argType == null || // \sqrt expands into primitive if optional argument doesn't exist
      funcData.type === "sqrt" && i === 1 && optArgs[0] == null) {
        argType = "primitive";
      }
      var arg = this.parseGroupOfType("argument to '" + func + "'", argType, isOptional);
      if (isOptional) {
        optArgs.push(arg);
      } else if (arg != null) {
        args.push(arg);
      } else {
        throw new ParseError("Null argument, please report this as a bug");
      }
    }
    return {
      args,
      optArgs
    };
  }
  /**
   * Parses a group when the mode is changing.
   */
  parseGroupOfType(name2, type, optional) {
    switch (type) {
      case "color":
        return this.parseColorGroup(optional);
      case "size":
        return this.parseSizeGroup(optional);
      case "url":
        return this.parseUrlGroup(optional);
      case "math":
      case "text":
        return this.parseArgumentGroup(optional, type);
      case "hbox": {
        var group = this.parseArgumentGroup(optional, "text");
        return group != null ? {
          type: "styling",
          mode: group.mode,
          body: [group],
          style: "text"
          // simulate \textstyle
        } : null;
      }
      case "raw": {
        var token = this.parseStringGroup("raw", optional);
        return token != null ? {
          type: "raw",
          mode: "text",
          string: token.text
        } : null;
      }
      case "primitive": {
        if (optional) {
          throw new ParseError("A primitive argument cannot be optional");
        }
        var _group2 = this.parseGroup(name2);
        if (_group2 == null) {
          throw new ParseError("Expected group as " + name2, this.fetch());
        }
        return _group2;
      }
      case "original":
      case null:
      case void 0:
        return this.parseArgumentGroup(optional);
      default:
        throw new ParseError("Unknown group type as " + name2, this.fetch());
    }
  }
  /**
   * Discard any space tokens, fetching the next non-space token.
   */
  consumeSpaces() {
    while (this.fetch().text === " ") {
      this.consume();
    }
  }
  /**
   * Parses a group, essentially returning the string formed by the
   * brace-enclosed tokens plus some position information.
   */
  parseStringGroup(modeName, optional) {
    var argToken = this.gullet.scanArgument(optional);
    if (argToken == null) {
      return null;
    }
    var str = "";
    var nextToken;
    while ((nextToken = this.fetch()).text !== "EOF") {
      str += nextToken.text;
      this.consume();
    }
    this.consume();
    argToken.text = str;
    return argToken;
  }
  /**
   * Parses a regex-delimited group: the largest sequence of tokens
   * whose concatenated strings match `regex`. Returns the string
   * formed by the tokens plus some position information.
   */
  parseRegexGroup(regex, modeName) {
    var firstToken = this.fetch();
    var lastToken = firstToken;
    var str = "";
    var nextToken;
    while ((nextToken = this.fetch()).text !== "EOF" && regex.test(str + nextToken.text)) {
      lastToken = nextToken;
      str += lastToken.text;
      this.consume();
    }
    if (str === "") {
      throw new ParseError("Invalid " + modeName + ": '" + firstToken.text + "'", firstToken);
    }
    return firstToken.range(lastToken, str);
  }
  /**
   * Parses a color description.
   */
  parseColorGroup(optional) {
    var res = this.parseStringGroup("color", optional);
    if (res == null) {
      return null;
    }
    var match = /^(#[a-f0-9]{3}|#?[a-f0-9]{6}|[a-z]+)$/i.exec(res.text);
    if (!match) {
      throw new ParseError("Invalid color: '" + res.text + "'", res);
    }
    var color = match[0];
    if (/^[0-9a-f]{6}$/i.test(color)) {
      color = "#" + color;
    }
    return {
      type: "color-token",
      mode: this.mode,
      color
    };
  }
  /**
   * Parses a size specification, consisting of magnitude and unit.
   */
  parseSizeGroup(optional) {
    var res;
    var isBlank = false;
    this.gullet.consumeSpaces();
    if (!optional && this.gullet.future().text !== "{") {
      res = this.parseRegexGroup(/^[-+]? *(?:$|\d+|\d+\.\d*|\.\d*) *[a-z]{0,2} *$/, "size");
    } else {
      res = this.parseStringGroup("size", optional);
    }
    if (!res) {
      return null;
    }
    if (!optional && res.text.length === 0) {
      res.text = "0pt";
      isBlank = true;
    }
    var match = /([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(res.text);
    if (!match) {
      throw new ParseError("Invalid size: '" + res.text + "'", res);
    }
    var data = {
      number: +(match[1] + match[2]),
      // sign + magnitude, cast to number
      unit: match[3]
    };
    if (!validUnit(data)) {
      throw new ParseError("Invalid unit: '" + data.unit + "'", res);
    }
    return {
      type: "size",
      mode: this.mode,
      value: data,
      isBlank
    };
  }
  /**
   * Parses an URL, checking escaped letters and allowed protocols,
   * and setting the catcode of % as an active character (as in \hyperref).
   */
  parseUrlGroup(optional) {
    this.gullet.lexer.setCatcode("%", 13);
    this.gullet.lexer.setCatcode("~", 12);
    var res = this.parseStringGroup("url", optional);
    this.gullet.lexer.setCatcode("%", 14);
    this.gullet.lexer.setCatcode("~", 13);
    if (res == null) {
      return null;
    }
    var url = res.text.replace(/\\([#$%&~_^{}])/g, "$1");
    return {
      type: "url",
      mode: this.mode,
      url
    };
  }
  /**
   * Parses an argument with the mode specified.
   */
  parseArgumentGroup(optional, mode) {
    var argToken = this.gullet.scanArgument(optional);
    if (argToken == null) {
      return null;
    }
    var outerMode = this.mode;
    if (mode) {
      this.switchMode(mode);
    }
    this.gullet.beginGroup();
    var expression = this.parseExpression(false, "EOF");
    this.expect("EOF");
    this.gullet.endGroup();
    var result = {
      type: "ordgroup",
      mode: this.mode,
      loc: argToken.loc,
      body: expression
    };
    if (mode) {
      this.switchMode(outerMode);
    }
    return result;
  }
  /**
   * Parses an ordinary group, which is either a single nucleus (like "x")
   * or an expression in braces (like "{x+y}") or an implicit group, a group
   * that starts at the current position, and ends right before a higher explicit
   * group ends, or at EOF.
   */
  parseGroup(name2, breakOnTokenText) {
    var firstToken = this.fetch();
    var text2 = firstToken.text;
    var result;
    if (text2 === "{" || text2 === "\\begingroup") {
      this.consume();
      var groupEnd = text2 === "{" ? "}" : "\\endgroup";
      this.gullet.beginGroup();
      var expression = this.parseExpression(false, groupEnd);
      var lastToken = this.fetch();
      this.expect(groupEnd);
      this.gullet.endGroup();
      result = {
        type: "ordgroup",
        mode: this.mode,
        loc: SourceLocation.range(firstToken, lastToken),
        body: expression,
        // A group formed by \begingroup...\endgroup is a semi-simple group
        // which doesn't affect spacing in math mode, i.e., is transparent.
        // https://tex.stackexchange.com/questions/1930/when-should-one-
        // use-begingroup-instead-of-bgroup
        semisimple: text2 === "\\begingroup" || void 0
      };
    } else {
      result = this.parseFunction(breakOnTokenText, name2) || this.parseSymbol();
      if (result == null && text2[0] === "\\" && !implicitCommands.hasOwnProperty(text2)) {
        if (this.settings.throwOnError) {
          throw new ParseError("Undefined control sequence: " + text2, firstToken);
        }
        result = this.formatUnsupportedCmd(text2);
        this.consume();
      }
    }
    return result;
  }
  /**
   * Form ligature-like combinations of characters for text mode.
   * This includes inputs like "--", "---", "``" and "''".
   * The result will simply replace multiple textord nodes with a single
   * character in each value by a single textord node having multiple
   * characters in its value.  The representation is still ASCII source.
   * The group will be modified in place.
   */
  formLigatures(group) {
    var n = group.length - 1;
    for (var i = 0; i < n; ++i) {
      var a = group[i];
      var v = a.text;
      if (v === "-" && group[i + 1].text === "-") {
        if (i + 1 < n && group[i + 2].text === "-") {
          group.splice(i, 3, {
            type: "textord",
            mode: "text",
            loc: SourceLocation.range(a, group[i + 2]),
            text: "---"
          });
          n -= 2;
        } else {
          group.splice(i, 2, {
            type: "textord",
            mode: "text",
            loc: SourceLocation.range(a, group[i + 1]),
            text: "--"
          });
          n -= 1;
        }
      }
      if ((v === "'" || v === "`") && group[i + 1].text === v) {
        group.splice(i, 2, {
          type: "textord",
          mode: "text",
          loc: SourceLocation.range(a, group[i + 1]),
          text: v + v
        });
        n -= 1;
      }
    }
  }
  /**
   * Parse a single symbol out of the string. Here, we handle single character
   * symbols and special functions like \verb.
   */
  parseSymbol() {
    var nucleus = this.fetch();
    var text2 = nucleus.text;
    if (/^\\verb[^a-zA-Z]/.test(text2)) {
      this.consume();
      var arg = text2.slice(5);
      var star = arg.charAt(0) === "*";
      if (star) {
        arg = arg.slice(1);
      }
      if (arg.length < 2 || arg.charAt(0) !== arg.slice(-1)) {
        throw new ParseError("\\verb assertion failed --\n                    please report what input caused this bug");
      }
      arg = arg.slice(1, -1);
      return {
        type: "verb",
        mode: "text",
        body: arg,
        star
      };
    }
    if (unicodeSymbols.hasOwnProperty(text2[0]) && !symbols[this.mode][text2[0]]) {
      if (this.settings.strict && this.mode === "math") {
        this.settings.reportNonstrict("unicodeTextInMathMode", 'Accented Unicode text character "' + text2[0] + '" used in math mode', nucleus);
      }
      text2 = unicodeSymbols[text2[0]] + text2.slice(1);
    }
    var match = combiningDiacriticalMarksEndRegex.exec(text2);
    if (match) {
      text2 = text2.substring(0, match.index);
      if (text2 === "i") {
        text2 = "\u0131";
      } else if (text2 === "j") {
        text2 = "\u0237";
      }
    }
    var symbol;
    if (symbols[this.mode][text2]) {
      if (this.settings.strict && this.mode === "math" && extraLatin.indexOf(text2) >= 0) {
        this.settings.reportNonstrict("unicodeTextInMathMode", 'Latin-1/Unicode text character "' + text2[0] + '" used in math mode', nucleus);
      }
      var group = symbols[this.mode][text2].group;
      var loc = SourceLocation.range(nucleus);
      var s;
      if (ATOMS.hasOwnProperty(group)) {
        var family = group;
        s = {
          type: "atom",
          mode: this.mode,
          family,
          loc,
          text: text2
        };
      } else {
        s = {
          type: group,
          mode: this.mode,
          loc,
          text: text2
        };
      }
      symbol = s;
    } else if (text2.charCodeAt(0) >= 128) {
      if (this.settings.strict) {
        if (!supportedCodepoint(text2.charCodeAt(0))) {
          this.settings.reportNonstrict("unknownSymbol", 'Unrecognized Unicode character "' + text2[0] + '"' + (" (" + text2.charCodeAt(0) + ")"), nucleus);
        } else if (this.mode === "math") {
          this.settings.reportNonstrict("unicodeTextInMathMode", 'Unicode text character "' + text2[0] + '" used in math mode', nucleus);
        }
      }
      symbol = {
        type: "textord",
        mode: "text",
        loc: SourceLocation.range(nucleus),
        text: text2
      };
    } else {
      return null;
    }
    this.consume();
    if (match) {
      for (var i = 0; i < match[0].length; i++) {
        var accent2 = match[0][i];
        if (!unicodeAccents[accent2]) {
          throw new ParseError("Unknown accent ' " + accent2 + "'", nucleus);
        }
        var command = unicodeAccents[accent2][this.mode] || unicodeAccents[accent2].text;
        if (!command) {
          throw new ParseError("Accent " + accent2 + " unsupported in " + this.mode + " mode", nucleus);
        }
        symbol = {
          type: "accent",
          mode: this.mode,
          loc: SourceLocation.range(nucleus),
          label: command,
          isStretchy: false,
          isShifty: true,
          // $FlowFixMe
          base: symbol
        };
      }
    }
    return symbol;
  }
};
Parser.endOfExpression = ["}", "\\endgroup", "\\end", "\\right", "&"];
var parseTree = function parseTree2(toParse, settings) {
  if (!(typeof toParse === "string" || toParse instanceof String)) {
    throw new TypeError("KaTeX can only parse string typed expression");
  }
  var parser = new Parser(toParse, settings);
  delete parser.gullet.macros.current["\\df@tag"];
  var tree = parser.parse();
  delete parser.gullet.macros.current["\\current@color"];
  delete parser.gullet.macros.current["\\color"];
  if (parser.gullet.macros.get("\\df@tag")) {
    if (!settings.displayMode) {
      throw new ParseError("\\tag works only in display equations");
    }
    tree = [{
      type: "tag",
      mode: "text",
      body: tree,
      tag: parser.subparse([new Token("\\df@tag")])
    }];
  }
  return tree;
};
var render = function render2(expression, baseNode, options) {
  baseNode.textContent = "";
  var node = renderToDomTree(expression, options).toNode();
  baseNode.appendChild(node);
};
if (typeof document !== "undefined") {
  if (document.compatMode !== "CSS1Compat") {
    typeof console !== "undefined" && console.warn("Warning: KaTeX doesn't work in quirks mode. Make sure your website has a suitable doctype.");
    render = function render3() {
      throw new ParseError("KaTeX doesn't work in quirks mode.");
    };
  }
}
var renderToString = function renderToString2(expression, options) {
  var markup = renderToDomTree(expression, options).toMarkup();
  return markup;
};
var generateParseTree = function generateParseTree2(expression, options) {
  var settings = new Settings(options);
  return parseTree(expression, settings);
};
var renderError = function renderError2(error, expression, options) {
  if (options.throwOnError || !(error instanceof ParseError)) {
    throw error;
  }
  var node = buildCommon.makeSpan(["katex-error"], [new SymbolNode(expression)]);
  node.setAttribute("title", error.toString());
  node.setAttribute("style", "color:" + options.errorColor);
  return node;
};
var renderToDomTree = function renderToDomTree2(expression, options) {
  var settings = new Settings(options);
  try {
    var tree = parseTree(expression, settings);
    return buildTree(tree, expression, settings);
  } catch (error) {
    return renderError(error, expression, settings);
  }
};
var renderToHTMLTree = function renderToHTMLTree2(expression, options) {
  var settings = new Settings(options);
  try {
    var tree = parseTree(expression, settings);
    return buildHTMLTree(tree, expression, settings);
  } catch (error) {
    return renderError(error, expression, settings);
  }
};
var version = "0.16.22";
var __domTree = {
  Span,
  Anchor,
  SymbolNode,
  SvgNode,
  PathNode,
  LineNode
};
var katex = {
  /**
   * Current KaTeX version
   */
  version,
  /**
   * Renders the given LaTeX into an HTML+MathML combination, and adds
   * it as a child to the specified DOM node.
   */
  render,
  /**
   * Renders the given LaTeX into an HTML+MathML combination string,
   * for sending to the client.
   */
  renderToString,
  /**
   * KaTeX error, usually during parsing.
   */
  ParseError,
  /**
   * The schema of Settings
   */
  SETTINGS_SCHEMA,
  /**
   * Parses the given LaTeX into KaTeX's internal parse tree structure,
   * without rendering to HTML or MathML.
   *
   * NOTE: This method is not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */
  __parse: generateParseTree,
  /**
   * Renders the given LaTeX into an HTML+MathML internal DOM tree
   * representation, without flattening that representation to a string.
   *
   * NOTE: This method is not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */
  __renderToDomTree: renderToDomTree,
  /**
   * Renders the given LaTeX into an HTML internal DOM tree representation,
   * without MathML and without flattening that representation to a string.
   *
   * NOTE: This method is not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */
  __renderToHTMLTree: renderToHTMLTree,
  /**
   * extends internal font metrics object with a new object
   * each key in the new object represents a font name
  */
  __setFontMetrics: setFontMetrics,
  /**
   * adds a new symbol to builtin symbols table
   */
  __defineSymbol: defineSymbol,
  /**
   * adds a new function to builtin function list,
   * which directly produce parse tree elements
   * and have their own html/mathml builders
   */
  __defineFunction: defineFunction,
  /**
   * adds a new macro to builtin macro list
   */
  __defineMacro: defineMacro,
  /**
   * Expose the dom tree node types, which can be useful for type checking nodes.
   *
   * NOTE: These methods are not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */
  __domTree
};

// ../../src/lib/board-validate.ts
var BOARD_LIMITS = { treeNodes: 31, graphNodes: 12, graphEdges: 30, arrayItems: 16, tex: 300, label: 12, caption: 40, trees: 3, text: 200, bars: 8, unit: 6, timelinePoints: [2, 6], spans: 4, sub: 16, flowNodes: [2, 10], flowEdges: 14, flowLabel: 14, edgeLabel: 8, actors: [2, 5], messages: 10, msgText: 18, layers: [2, 5], layerItems: 5, cycle: [3, 6], htmlTitle: 24, brief: 600, nestDepth: 4, nestChildren: 5, nestNodes: 24, nestNote: 20 };
var isStr = (v) => typeof v === "string";
var nonEmpty2 = (v) => isStr(v) && v.trim().length > 0;
function checkCaption(c) {
  if (c === void 0) return null;
  if (!isStr(c)) return "caption \u5FC5\u987B\u662F\u5B57\u7B26\u4E32";
  if (tlen(c) > BOARD_LIMITS.caption) return `caption \u8D85\u8FC7 ${BOARD_LIMITS.caption} \u5B57`;
  return null;
}
function checkLabels(nodes, max, what) {
  if (!Array.isArray(nodes) || nodes.length === 0) return `${what}\u6CA1\u6709\u7ED3\u70B9`;
  if (nodes.length > max) return `${what}\u7ED3\u70B9\u6570\u8D85\u8FC7 ${max}`;
  const ids = /* @__PURE__ */ new Set();
  const labels = /* @__PURE__ */ new Set();
  for (const n of nodes) {
    if (!n || !nonEmpty2(n.id)) return `${what}\u7ED3\u70B9 id \u4E3A\u7A7A`;
    if (!nonEmpty2(n.label)) return `${what}\u7ED3\u70B9 ${n.id} \u7F3A label`;
    if (tlen(n.label) > BOARD_LIMITS.label) return `${what}\u7ED3\u70B9 ${n.id} \u7684 label \u8FC7\u957F`;
    if (ids.has(n.id)) return `${what}\u7ED3\u70B9 id \u91CD\u590D\uFF1A${n.id}`;
    if (labels.has(n.label)) return `${what}\u7ED3\u70B9 label \u91CD\u590D\uFF1A${n.label}`;
    ids.add(n.id);
    labels.add(n.label);
  }
  return null;
}
function checkHighlight(h, ids) {
  if (h === void 0) return null;
  if (!Array.isArray(h)) return "highlight \u5FC5\u987B\u662F\u6570\u7EC4";
  for (const id of h) if (!isStr(id) || !ids.has(id)) return `highlight \u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u7ED3\u70B9\uFF1A${String(id)}`;
  return null;
}
function validateTree(t) {
  const e = checkLabels(t?.nodes, BOARD_LIMITS.treeNodes, "\u6811");
  if (e) return e;
  const ids = new Set(t.nodes.map((n) => n.id));
  if (!nonEmpty2(t.root) || !ids.has(t.root)) return "root \u4E0D\u5B58\u5728";
  const parent = /* @__PURE__ */ new Map();
  for (const n of t.nodes) {
    if (n.children === void 0) continue;
    if (!Array.isArray(n.children)) return `\u7ED3\u70B9 ${n.id} \u7684 children \u5FC5\u987B\u662F\u6570\u7EC4`;
    if (t.binary && n.children.length > 2) return `\u4E8C\u53C9\u6811\u7ED3\u70B9 ${n.id} \u7684\u5B69\u5B50\u8D85\u8FC7 2 \u4E2A`;
    for (const c of n.children) {
      if (!isStr(c)) return `\u7ED3\u70B9 ${n.id} \u7684\u5B69\u5B50\u5FC5\u987B\u662F\u5B57\u7B26\u4E32 id`;
      if (c === "") {
        if (!t.binary) return `\u975E\u4E8C\u53C9\u6811\u4E0D\u5141\u8BB8\u7A7A\u5B69\u5B50\u5360\u4F4D\uFF08\u7ED3\u70B9 ${n.id}\uFF09`;
        continue;
      }
      if (!ids.has(c)) return `\u7ED3\u70B9 ${n.id} \u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u5B69\u5B50 ${c}`;
      if (c === t.root) return `\u6839 ${c} \u4E0D\u80FD\u662F\u522B\u4EBA\u7684\u5B69\u5B50`;
      if (parent.has(c)) return `\u7ED3\u70B9 ${c} \u6709\u591A\u4E2A\u53CC\u4EB2`;
      parent.set(c, n.id);
    }
  }
  const seen = /* @__PURE__ */ new Set();
  const stack = [t.root];
  const byId = new Map(t.nodes.map((n) => [n.id, n]));
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) return `\u5B58\u5728\u73AF\uFF08${id}\uFF09`;
    seen.add(id);
    for (const c of byId.get(id).children ?? []) if (c) stack.push(c);
  }
  if (seen.size !== ids.size) return `\u6709 ${ids.size - seen.size} \u4E2A\u7ED3\u70B9\u4E0D\u5728\u6811\u4E0A\uFF08\u4E0D\u53EF\u4ECE\u6839\u5230\u8FBE\u6216\u6210\u73AF\uFF09`;
  return checkHighlight(t.highlight, ids);
}
function validateGraph(g2) {
  const e = checkLabels(g2?.nodes, BOARD_LIMITS.graphNodes, "\u56FE");
  if (e) return e;
  const ids = new Set(g2.nodes.map((n) => n.id));
  if (!Array.isArray(g2.edges)) return "edges \u5FC5\u987B\u662F\u6570\u7EC4";
  if (g2.edges.length > BOARD_LIMITS.graphEdges) return `\u8FB9\u6570\u8D85\u8FC7 ${BOARD_LIMITS.graphEdges}`;
  const seen = /* @__PURE__ */ new Set();
  for (const ed of g2.edges) {
    if (!Array.isArray(ed) || ed.length !== 2) return "\u6BCF\u6761\u8FB9\u5FC5\u987B\u662F [from, to]";
    const [a, b] = ed;
    if (!isStr(a) || !isStr(b) || !ids.has(a) || !ids.has(b)) return `\u8FB9 ${String(a)}\u2192${String(b)} \u6307\u5411\u4E0D\u5B58\u5728\u7684\u7ED3\u70B9`;
    if (a === b) return `\u4E0D\u652F\u6301\u81EA\u73AF\uFF08${a}\uFF09`;
    const k = g2.directed ? `${a}>${b}` : [a, b].sort().join("-");
    if (seen.has(k)) return `\u91CD\u590D\u7684\u8FB9 ${a}-${b}`;
    seen.add(k);
  }
  return checkHighlight(g2.highlight, ids);
}
function validateArray(a) {
  if (!a || !["array", "queue", "stack"].includes(a.variant)) return "variant \u5FC5\u987B\u662F array | queue | stack";
  if (!Array.isArray(a.items)) return "items \u5FC5\u987B\u662F\u6570\u7EC4";
  if (a.items.length > BOARD_LIMITS.arrayItems) return `items \u8D85\u8FC7 ${BOARD_LIMITS.arrayItems} \u4E2A`;
  for (const it of a.items) if (!isStr(it) || tlen(it) > BOARD_LIMITS.label) return "items \u5FC5\u987B\u662F\u4E0D\u8D85\u8FC7 12 \u5B57\u7684\u5B57\u7B26\u4E32";
  if (a.pointers !== void 0) {
    if (!Array.isArray(a.pointers)) return "pointers \u5FC5\u987B\u662F\u6570\u7EC4";
    for (const p of a.pointers) {
      if (!p || !Number.isInteger(p.index) || p.index < 0 || p.index >= a.items.length) return `\u6307\u9488\u4E0B\u6807\u8D8A\u754C\uFF1A${String(p?.index)}`;
      if (!nonEmpty2(p.label) || tlen(p.label) > 8) return "\u6307\u9488 label \u5FC5\u987B\u662F 1\u20138 \u5B57";
    }
  }
  if (a.highlight !== void 0) {
    if (!Array.isArray(a.highlight)) return "highlight \u5FC5\u987B\u662F\u4E0B\u6807\u6570\u7EC4";
    for (const i of a.highlight) if (!Number.isInteger(i) || i < 0 || i >= a.items.length) return `highlight \u4E0B\u6807\u8D8A\u754C\uFF1A${String(i)}`;
  }
  return null;
}
function validateTex(tex) {
  if (!nonEmpty2(tex)) return "tex \u4E3A\u7A7A";
  if (tex.length > BOARD_LIMITS.tex) return `tex \u8D85\u8FC7 ${BOARD_LIMITS.tex} \u5B57\u7B26`;
  try {
    katex.renderToString(tex, { throwOnError: true, displayMode: true, trust: false, strict: "ignore", maxExpand: 200, maxSize: 20 });
  } catch (e) {
    return `tex \u65E0\u6CD5\u89E3\u6790\uFF1A${e.message.slice(0, 80)}`;
  }
  return null;
}
function validateBars(b) {
  if (!Array.isArray(b?.items) || b.items.length < 1 || b.items.length > BOARD_LIMITS.bars) return `bars.items \u5FC5\u987B\u662F 1\u2013${BOARD_LIMITS.bars} \u9879`;
  const labels = /* @__PURE__ */ new Set();
  for (const it of b.items) {
    if (!it || !nonEmpty2(it.label)) return "bars \u6BCF\u9879\u9700\u8981\u975E\u7A7A label";
    if (tlen(it.label) > BOARD_LIMITS.label) return `bars label \u8D85\u8FC7 ${BOARD_LIMITS.label} \u5B57\uFF1A${it.label}`;
    if (labels.has(it.label)) return `bars label \u91CD\u590D\uFF1A${it.label}`;
    labels.add(it.label);
    if (typeof it.value !== "number" || !Number.isFinite(it.value) || it.value < 0) return `bars\u300C${it.label}\u300D\u7684 value \u5FC5\u987B\u662F \u2265 0 \u7684\u6709\u9650\u6570`;
  }
  if (b.unit !== void 0 && (!isStr(b.unit) || tlen(b.unit) > BOARD_LIMITS.unit)) return `unit \u5FC5\u987B\u662F\u4E0D\u8D85\u8FC7 ${BOARD_LIMITS.unit} \u5B57\u7684\u5B57\u7B26\u4E32`;
  if (b.highlight !== void 0) {
    if (!Array.isArray(b.highlight)) return "highlight \u5FC5\u987B\u662F\u4E0B\u6807\u6570\u7EC4";
    for (const i of b.highlight) if (!Number.isInteger(i) || i < 0 || i >= b.items.length) return `highlight \u4E0B\u6807\u8D8A\u754C\uFF1A${String(i)}`;
  }
  return null;
}
function validateTimeline(t) {
  const [minP, maxP] = BOARD_LIMITS.timelinePoints;
  if (!Array.isArray(t?.points) || t.points.length < minP || t.points.length > maxP) return `timeline.points \u5FC5\u987B\u662F ${minP}\u2013${maxP} \u4E2A`;
  for (const p of t.points) {
    if (!p || !nonEmpty2(p.label)) return "timeline \u6BCF\u4E2A\u70B9\u9700\u8981\u975E\u7A7A label";
    if (tlen(p.label) > BOARD_LIMITS.label) return `timeline label \u8D85\u8FC7 ${BOARD_LIMITS.label} \u5B57\uFF1A${p.label}`;
    if (p.sub !== void 0 && (!isStr(p.sub) || tlen(p.sub) > BOARD_LIMITS.sub)) return `timeline sub \u5FC5\u987B\u662F\u4E0D\u8D85\u8FC7 ${BOARD_LIMITS.sub} \u5B57\u7684\u5B57\u7B26\u4E32`;
  }
  if (t.spans !== void 0) {
    if (!Array.isArray(t.spans)) return "spans \u5FC5\u987B\u662F\u6570\u7EC4";
    if (t.spans.length > BOARD_LIMITS.spans) return `spans \u8D85\u8FC7 ${BOARD_LIMITS.spans} \u6BB5`;
    for (const sp of t.spans) {
      if (!sp || !Number.isInteger(sp.from) || !Number.isInteger(sp.to)) return "span \u7684 from / to \u5FC5\u987B\u662F\u6574\u6570\u4E0B\u6807";
      if (sp.from < 0 || sp.to > t.points.length - 1 || sp.from >= sp.to) return `span \u533A\u95F4\u4E0D\u5408\u6CD5\uFF1A${sp.from}\u2192${sp.to}`;
      if (!nonEmpty2(sp.label) || tlen(sp.label) > BOARD_LIMITS.label) return `span label \u5FC5\u987B\u662F 1\u2013${BOARD_LIMITS.label} \u5B57`;
      if (sp.tone !== void 0 && !["bad", "good", "neutral"].includes(sp.tone)) return `span tone \u4E0D\u5408\u6CD5\uFF1A${String(sp.tone)}`;
    }
  }
  return null;
}
var lbl = (v, max) => nonEmpty2(v) && tlen(v) <= max;
function validateFlowchart(f) {
  const [mn, mx] = BOARD_LIMITS.flowNodes;
  if (!Array.isArray(f?.nodes) || f.nodes.length < mn || f.nodes.length > mx) return `flowchart.nodes \u5FC5\u987B\u662F ${mn}\u2013${mx} \u4E2A`;
  const ids = /* @__PURE__ */ new Set();
  for (const n of f.nodes) {
    if (!n || !nonEmpty2(n.id) || ids.has(n.id)) return "flowchart \u7ED3\u70B9 id \u5FC5\u987B\u975E\u7A7A\u4E14\u552F\u4E00";
    ids.add(n.id);
    if (!lbl(n.label, BOARD_LIMITS.flowLabel)) return `flowchart \u7ED3\u70B9 label \u5FC5\u987B\u662F 1\u2013${BOARD_LIMITS.flowLabel} \u5B57\uFF1A${String(n.label)}`;
    if (n.shape !== void 0 && !["start", "end", "process", "decision", "io"].includes(n.shape)) return `flowchart shape \u4E0D\u5408\u6CD5\uFF1A${String(n.shape)}`;
  }
  if (!Array.isArray(f.edges) || f.edges.length < 1 || f.edges.length > BOARD_LIMITS.flowEdges) return `flowchart.edges \u5FC5\u987B\u662F 1\u2013${BOARD_LIMITS.flowEdges} \u6761`;
  const seen = /* @__PURE__ */ new Set(), touched = /* @__PURE__ */ new Set();
  for (const e of f.edges) {
    if (!e || !ids.has(e.from) || !ids.has(e.to)) return `flowchart \u8FB9\u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u7ED3\u70B9\uFF1A${e?.from}\u2192${e?.to}`;
    if (e.from === e.to) return "flowchart \u4E0D\u5141\u8BB8\u81EA\u73AF";
    const k = `${e.from}>${e.to}`;
    if (seen.has(k)) return `flowchart \u8FB9\u91CD\u590D\uFF1A${k}`;
    seen.add(k);
    touched.add(e.from);
    touched.add(e.to);
    if (e.label !== void 0 && !lbl(e.label, BOARD_LIMITS.edgeLabel)) return `flowchart \u8FB9 label \u5FC5\u987B\u662F 1\u2013${BOARD_LIMITS.edgeLabel} \u5B57`;
  }
  for (const id of ids) if (!touched.has(id)) return `flowchart \u7ED3\u70B9 ${id} \u6CA1\u6709\u8FDE\u7EBF`;
  if (f.dir !== void 0 && f.dir !== "TB" && f.dir !== "LR") return "flowchart.dir \u53EA\u80FD\u662F TB \u6216 LR";
  if (f.highlight !== void 0 && (!Array.isArray(f.highlight) || f.highlight.some((h) => !ids.has(h)))) return "flowchart.highlight \u5FC5\u987B\u662F\u5DF2\u6709\u7ED3\u70B9 id";
  return null;
}
function validateSequence(q) {
  const [mn, mx] = BOARD_LIMITS.actors;
  if (!Array.isArray(q?.actors) || q.actors.length < mn || q.actors.length > mx) return `sequence.actors \u5FC5\u987B\u662F ${mn}\u2013${mx} \u4E2A`;
  if (q.actors.some((a) => !lbl(a, 10)) || new Set(q.actors).size !== q.actors.length) return "sequence \u53C2\u4E0E\u8005\u5FC5\u987B\u662F 1\u201310 \u5B57\u4E14\u4E0D\u91CD\u590D";
  if (!Array.isArray(q.messages) || q.messages.length < 1 || q.messages.length > BOARD_LIMITS.messages) return `sequence.messages \u5FC5\u987B\u662F 1\u2013${BOARD_LIMITS.messages} \u6761`;
  for (const m of q.messages) {
    if (!m || !Number.isInteger(m.from) || !Number.isInteger(m.to) || m.from < 0 || m.to < 0 || m.from >= q.actors.length || m.to >= q.actors.length) return "sequence \u6D88\u606F\u7684 from / to \u5FC5\u987B\u662F\u53C2\u4E0E\u8005\u4E0B\u6807";
    if (!lbl(m.text, BOARD_LIMITS.msgText)) return `sequence \u6D88\u606F text \u5FC5\u987B\u662F 1\u2013${BOARD_LIMITS.msgText} \u5B57\uFF1A${String(m.text)}`;
  }
  if (q.highlight !== void 0 && (!Array.isArray(q.highlight) || q.highlight.some((i) => !Number.isInteger(i) || i < 0 || i >= q.messages.length))) return "sequence.highlight \u5FC5\u987B\u662F\u6D88\u606F\u4E0B\u6807";
  return null;
}
function validateArch(a) {
  const [mn, mx] = BOARD_LIMITS.layers;
  if (!Array.isArray(a?.layers) || a.layers.length < mn || a.layers.length > mx) return `arch.layers \u5FC5\u987B\u662F ${mn}\u2013${mx} \u5C42`;
  const all2 = /* @__PURE__ */ new Set();
  for (const l of a.layers) {
    if (!l || !lbl(l.name, 8)) return "arch \u6BCF\u5C42\u9700\u8981 1\u20138 \u5B57\u7684 name";
    if (!Array.isArray(l.items) || l.items.length < 1 || l.items.length > BOARD_LIMITS.layerItems) return `arch \u6BCF\u5C42 1\u2013${BOARD_LIMITS.layerItems} \u4E2A\u7EC4\u4EF6`;
    for (const it of l.items) {
      if (!lbl(it, 10)) return `arch \u7EC4\u4EF6\u540D\u5FC5\u987B\u662F 1\u201310 \u5B57\uFF1A${String(it)}`;
      if (all2.has(it)) return `arch \u7EC4\u4EF6\u540D\u91CD\u590D\uFF1A${it}`;
      all2.add(it);
    }
  }
  if (a.highlight !== void 0 && (!Array.isArray(a.highlight) || a.highlight.some((h) => !all2.has(h)))) return "arch.highlight \u5FC5\u987B\u662F\u5DF2\u6709\u7EC4\u4EF6\u540D";
  return null;
}
function validateCycle(c) {
  const [mn, mx] = BOARD_LIMITS.cycle;
  if (!Array.isArray(c?.nodes) || c.nodes.length < mn || c.nodes.length > mx) return `cycle.nodes \u5FC5\u987B\u662F ${mn}\u2013${mx} \u4E2A`;
  if (c.nodes.some((x) => !lbl(x, 10)) || new Set(c.nodes).size !== c.nodes.length) return "cycle \u73AF\u8282\u5FC5\u987B\u662F 1\u201310 \u5B57\u4E14\u4E0D\u91CD\u590D";
  if (c.center !== void 0 && !lbl(c.center, 10)) return "cycle.center \u5FC5\u987B\u662F 1\u201310 \u5B57";
  if (c.highlight !== void 0 && (!Array.isArray(c.highlight) || c.highlight.some((i) => !Number.isInteger(i) || i < 0 || i >= c.nodes.length))) return "cycle.highlight \u5FC5\u987B\u662F\u73AF\u8282\u4E0B\u6807";
  return null;
}
function nestNodes(root) {
  const out = [];
  const walk = (n) => {
    out.push(n);
    for (const c of n.children ?? []) walk(c);
  };
  if (root) walk(root);
  return out;
}
function validateNest(n) {
  if (n?.title !== void 0 && !(isStr(n.title) && tlen(n.title) <= 20)) return "nest.title \u5FC5\u987B\u662F \u2264 20 \u5B57\u7684\u5B57\u7B26\u4E32";
  if (!n?.root || typeof n.root !== "object") return "nest \u7F3A root";
  if (!Array.isArray(n.root.children) || n.root.children.length === 0) return "nest.root \u81F3\u5C11\u8981\u5305\u542B 1 \u4E2A\u5B50\u96C6\u5408";
  const labels = /* @__PURE__ */ new Set();
  let count = 0;
  const walk = (x, depth) => {
    if (!x || typeof x !== "object") return "nest \u7ED3\u70B9\u5FC5\u987B\u662F\u5BF9\u8C61";
    if (depth > BOARD_LIMITS.nestDepth) return `nest \u5D4C\u5957\u8D85\u8FC7 ${BOARD_LIMITS.nestDepth} \u5C42`;
    if (++count > BOARD_LIMITS.nestNodes) return `nest \u7ED3\u70B9\u8D85\u8FC7 ${BOARD_LIMITS.nestNodes} \u4E2A`;
    if (!lbl(x.label, BOARD_LIMITS.label)) return `nest \u7ED3\u70B9 label \u5FC5\u987B\u662F 1\u2013${BOARD_LIMITS.label} \u5B57\uFF1A${String(x.label)}`;
    if (labels.has(x.label)) return `nest \u7ED3\u70B9 label \u91CD\u590D\uFF1A${x.label}`;
    labels.add(x.label);
    if (x.note !== void 0 && !(isStr(x.note) && tlen(x.note) <= BOARD_LIMITS.nestNote)) return `nest \u7ED3\u70B9 note \u5FC5\u987B\u662F \u2264 ${BOARD_LIMITS.nestNote} \u5B57\u7684\u5B57\u7B26\u4E32`;
    if (x.children === void 0) return null;
    if (!Array.isArray(x.children) || x.children.length > BOARD_LIMITS.nestChildren) return `nest \u7ED3\u70B9\u300C${x.label}\u300D\u7684 children \u5FC5\u987B\u662F \u2264 ${BOARD_LIMITS.nestChildren} \u4E2A\u7684\u6570\u7EC4`;
    for (const c of x.children) {
      const e2 = walk(c, depth + 1);
      if (e2) return e2;
    }
    return null;
  };
  const e = walk(n.root, 1);
  if (e) return e;
  if (n.highlight !== void 0 && (!Array.isArray(n.highlight) || n.highlight.some((h) => !labels.has(h)))) return "nest.highlight \u5FC5\u987B\u662F\u5DF2\u6709\u7ED3\u70B9 label";
  return null;
}
var IMAGE_LIMITS = { perLesson: 4, whyMin: 8, why: 120, prompt: 300 };
var COMIC_LIMITS = { panels: [2, 4], scene: 60, line: 14, who: 6, point: [4, 20], mapping: [2, 4], item: 8, concept: 16, textTotal: 80 };
var IMAGE_FORBIDDEN = [
  [/解剖|内脏|器官(结构|剖面)|骨骼结构|血管分布/, "\u89E3\u5256\u7ED3\u6784"],
  [/地图|疆域|版图|行政区划|经纬/, "\u5730\u56FE"],
  [/电路|电路图|电阻|电容|晶体管|接线/, "\u7535\u8DEF"],
  [/化学(结构|式)|结构式|分子式|分子结构|化学键|苯环|官能团/, "\u5316\u5B66\u7ED3\u6784"],
  [/肖像|画像|历史人物|真实人物|名人|领袖|皇帝|总统/, "\u771F\u5B9E\u4EBA\u7269"],
  [/具体数据|数据图|统计图|柱状图|折线图|饼图|曲线图|坐标轴|表格|公式|方程/, "\u5177\u4F53\u6570\u636E\u6216\u56FE\u8868"],
  [/文字|汉字|字母|单词|数字(?!化|孪生|人)|标签|标注|logo|商标|签名|书法|对联|招牌/i, "\u6587\u5B57"]
];
function imageForbidden(prompt) {
  const t = prompt.replace(/(不要|不能|不得|没有|无|不含|不出现|不带|避免|禁止|切勿)[^，。；,;！!]{0,16}/g, "");
  for (const [re, what] of IMAGE_FORBIDDEN) if (re.test(t)) return what;
  return null;
}
function validateComic(b) {
  if (b.panels === void 0) return null;
  const ps = b.panels;
  if (!Array.isArray(ps) || ps.length < COMIC_LIMITS.panels[0] || ps.length > COMIC_LIMITS.panels[1]) return `image.panels \u5FC5\u987B\u662F ${COMIC_LIMITS.panels[0]}\u2013${COMIC_LIMITS.panels[1]} \u683C`;
  let total = 0;
  for (const [i, p] of ps.entries()) {
    if (!p || typeof p !== "object" || !nonEmpty2(p.scene) || tlen(p.scene) > COMIC_LIMITS.scene) return `image.panels \u7B2C ${i + 1} \u683C\u7684 scene \u5FC5\u987B\u662F 1\u2013${COMIC_LIMITS.scene} \u5B57\u7684\u753B\u9762\u63CF\u8FF0`;
    const bad = imageForbidden(p.scene);
    if (bad && bad !== "\u6587\u5B57") return `image.panels \u7B2C ${i + 1} \u683C\u4E0D\u80FD\u753B\u9700\u8981\u300C\u753B\u5BF9\u300D\u7684\u5185\u5BB9\uFF08${bad}\uFF09`;
    if (p.line !== void 0 && (!isStr(p.line) || tlen(p.line) > COMIC_LIMITS.line)) return `image.panels \u7B2C ${i + 1} \u683C\u7684 line\uFF08\u53F0\u8BCD\uFF09\u2264 ${COMIC_LIMITS.line} \u5B57`;
    if (p.who !== void 0 && (!isStr(p.who) || tlen(p.who) > COMIC_LIMITS.who)) return `image.panels \u7B2C ${i + 1} \u683C\u7684 who \u2264 ${COMIC_LIMITS.who} \u5B57`;
    total += isStr(p.line) ? tlen(p.line) : 0;
  }
  if (!ps.some((p) => nonEmpty2(p.line))) return "image.panels \u81F3\u5C11\u4E00\u683C\u8981\u6709\u53F0\u8BCD line";
  if (!nonEmpty2(b.point) || tlen(b.point) < COMIC_LIMITS.point[0] || tlen(b.point) > COMIC_LIMITS.point[1]) return `image.point\uFF08\u6838\u5FC3\u89C2\u70B9\u6A2A\u5E45\uFF09\u5FC5\u987B\u662F ${COMIC_LIMITS.point[0]}\u2013${COMIC_LIMITS.point[1]} \u5B57`;
  total += tlen(b.point);
  const mp = b.mapping;
  if (!Array.isArray(mp) || mp.length < COMIC_LIMITS.mapping[0] || mp.length > COMIC_LIMITS.mapping[1]) return `image.mapping \u8981\u5199 ${COMIC_LIMITS.mapping[0]}\u2013${COMIC_LIMITS.mapping[1]} \u6761\u300C\u753B\u9762\u5143\u7D20 \u2192 \u672C\u8BFE\u6982\u5FF5\u300D\u5BF9\u7167\uFF0C\u5982 {"item":"\u7092\u83DC\u673A","concept":"scripts/"}`;
  for (const m of mp) {
    if (!m || !nonEmpty2(m.item) || tlen(m.item) > COMIC_LIMITS.item) return `image.mapping \u7684 item\uFF08\u753B\u9762\u5143\u7D20\u540D\uFF09\u662F 1\u2013${COMIC_LIMITS.item} \u5B57`;
    if (!nonEmpty2(m.concept) || tlen(m.concept) > COMIC_LIMITS.concept) return `image.mapping \u7684 concept\uFF08\u5BF9\u5E94\u6982\u5FF5\uFF09\u662F 1\u2013${COMIC_LIMITS.concept} \u5B57`;
    total += tlen(m.item);
  }
  if (total > COMIC_LIMITS.textTotal) return `\u6F2B\u753B\u91CC\u7684\u6587\u5B57\u592A\u591A\uFF08\u53F0\u8BCD + \u6838\u5FC3\u89C2\u70B9\u5171 ${total} \u5B57\uFF0C\u6700\u591A ${COMIC_LIMITS.textTotal} \u5B57\uFF09\uFF1A\u7F29\u77ED\u53F0\u8BCD`;
  return null;
}
function validateImage(b) {
  if (!IMAGE_ROLES.includes(b.role)) return `image.role \u53EA\u80FD\u662F ${IMAGE_ROLES.join(" / ")}`;
  if (!nonEmpty2(b.caption) || tlen(b.caption) > BOARD_LIMITS.caption) return `image.caption \u5FC5\u987B\u662F 1\u2013${BOARD_LIMITS.caption} \u5B57`;
  if (b.imageId !== void 0) return isStr(b.imageId) && /^im_[a-z0-9]{8,32}$/.test(b.imageId) ? null : "image.imageId \u683C\u5F0F\u4E0D\u5BF9";
  if (!nonEmpty2(b.why) || tlen(b.why.trim()) < IMAGE_LIMITS.whyMin || tlen(b.why) > IMAGE_LIMITS.why) return `image.why \u5FC5\u987B\u5199\u6E05\u8FD9\u5F20\u56FE\u7684\u5B66\u4E60\u4F5C\u7528\uFF08${IMAGE_LIMITS.whyMin}\u2013${IMAGE_LIMITS.why} \u5B57\uFF09`;
  if (b.panels !== void 0) return validateComic(b);
  if (!nonEmpty2(b.prompt) || tlen(b.prompt) > IMAGE_LIMITS.prompt) return `image.prompt \u5FC5\u987B\u662F 1\u2013${IMAGE_LIMITS.prompt} \u5B57\u7684\u753B\u9762\u63CF\u8FF0`;
  const bad = imageForbidden(b.prompt);
  if (bad) return `image.prompt \u4E0D\u80FD\u753B\u9700\u8981\u300C\u753B\u5BF9\u300D\u7684\u5185\u5BB9\uFF08${bad}\uFF09\uFF1A\u8FD9\u7C7B\u5185\u5BB9\u7528\u8868\u683C / SVG / \u6559\u6750\u539F\u56FE`;
  return null;
}
function boardRawText(b) {
  switch (b.kind) {
    case "title":
    case "bullet":
    case "formula":
    case "note":
      return b.text;
    case "table":
      return b.rows.map((r) => r.join(" ")).join(" ");
    case "flow":
      return b.nodes.join(" ");
    case "list":
      return [b.title ?? "", ...b.items].join(" ");
    case "case":
      return [b.title, ...b.items.flatMap((x) => [x.label, x.text])].join(" ");
    case "tree":
    case "graph":
      return [...b.nodes.map((n) => n.label), b.caption ?? ""].join(" ");
    case "trees":
      return b.items.map((it) => [it.caption, ...it.tree.nodes.map((n) => n.label)].join(" ")).join(" ");
    case "array":
      return [...b.items, ...(b.pointers ?? []).map((p) => p.label), b.caption ?? ""].join(" ");
    case "math":
      return [b.tex, b.caption ?? ""].join(" ");
    case "code":
      return [b.path ?? "", b.code, b.caption ?? ""].join(" ");
    case "bars":
      return [...b.items.map((x) => x.label), b.caption ?? ""].join(" ");
    case "timeline":
      return [...b.points.flatMap((p) => [p.label, p.sub ?? ""]), ...(b.spans ?? []).map((x) => x.label), b.caption ?? ""].join(" ");
    case "flowchart":
      return [...b.nodes.map((n) => n.label), ...b.edges.map((e) => e.label ?? ""), b.caption ?? ""].join(" ");
    case "sequence":
      return [...b.actors, ...b.messages.map((m) => m.text), b.caption ?? ""].join(" ");
    case "arch":
      return [...b.layers.flatMap((l) => [l.name, ...l.items]), b.caption ?? ""].join(" ");
    case "cycle":
      return [...b.nodes, b.center ?? "", b.caption ?? ""].join(" ");
    case "nest":
      return [b.title ?? "", ...nestNodes(b.root).flatMap((n) => [n.label, n.note ?? ""]), b.caption ?? ""].filter(Boolean).join(" ");
    case "html":
      return [b.title, b.caption ?? ""].join(" ");
    case "image":
      return b.caption;
  }
}
function validateMark(lesson, stepIdx) {
  const s = lesson.steps[stepIdx];
  if (!s || s.type !== "say" || s.mark === void 0) return null;
  const m = s.mark;
  if (!m || typeof m !== "object") return "mark \u5FC5\u987B\u662F\u5BF9\u8C61";
  if (!["circle", "highlight", "underline"].includes(m.style)) return `mark.style \u4E0D\u5408\u6CD5\uFF1A${String(m.style)}`;
  if (!Number.isInteger(m.target) || m.target < 0 || m.target >= stepIdx) return `mark.target \u5FC5\u987B\u662F\u4E4B\u524D\u7684\u6B65\u9AA4\uFF1A${String(m.target)}`;
  const t = lesson.steps[m.target];
  if (!t || t.type !== "say" || !t.board) return `mark.target ${m.target} \u6CA1\u6709\u677F\u4E66`;
  if (m.text !== void 0) {
    if (!nonEmpty2(m.text) || tlen(m.text) > 40) return "mark.text \u5FC5\u987B\u662F 1\u201340 \u5B57";
    if (!boardRawText(t.board).includes(m.text)) return `mark.text\u300C${m.text}\u300D\u4E0D\u5728\u76EE\u6807\u677F\u4E66\u91CC`;
  }
  return null;
}
function validateBoard(item) {
  const b = item;
  if (!b || typeof b !== "object" || !isStr(b.kind)) return "board \u7F3A kind";
  if ("figId" in b && b.figId !== void 0 && !nonEmpty2(b.figId)) return "figId \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32";
  switch (b.kind) {
    case "title":
    case "bullet":
    case "formula":
    case "note":
      return nonEmpty2(b.text) && tlen(b.text) <= BOARD_LIMITS.text ? null : `${b.kind} \u9700\u8981\u975E\u7A7A text\uFF08\u2264 ${BOARD_LIMITS.text} \u5B57\uFF09`;
    case "table":
      return Array.isArray(b.rows) && b.rows.length > 0 && b.rows.length <= 12 && b.rows.every((r) => Array.isArray(r) && r.every(isStr)) ? null : "table.rows \u5FC5\u987B\u662F 1\u201312 \u884C\u5B57\u7B26\u4E32\u6570\u7EC4";
    case "flow":
      return Array.isArray(b.nodes) && b.nodes.length > 0 && b.nodes.length <= 8 && b.nodes.every(nonEmpty2) ? null : "flow.nodes \u5FC5\u987B\u662F 1\u20138 \u4E2A\u975E\u7A7A\u5B57\u7B26\u4E32";
    case "list":
      if (b.title !== void 0 && !(isStr(b.title) && tlen(b.title) <= 20)) return "list.title \u2264 20 \u5B57";
      return Array.isArray(b.items) && b.items.length > 0 && b.items.length <= 8 && b.items.every((x) => nonEmpty2(x) && tlen(x) <= 40) ? null : "list.items \u5FC5\u987B\u662F 1\u20138 \u6761\u3001\u6BCF\u6761 \u2264 40 \u5B57";
    case "case":
      if (!nonEmpty2(b.title) || tlen(b.title) > 24) return "case.title \u5FC5\u987B\u975E\u7A7A\u4E14 \u2264 24 \u5B57";
      return Array.isArray(b.items) && b.items.length > 0 && b.items.length <= 6 && b.items.every((x) => x && nonEmpty2(x.label) && tlen(x.label) <= 6 && nonEmpty2(x.text) && tlen(x.text) <= 60) ? null : "case.items \u5FC5\u987B\u662F 1\u20136 \u683C\uFF0Clabel \u2264 6 \u5B57\u3001text \u2264 60 \u5B57";
    case "tree":
      return validateTree(b) ?? checkCaption(b.caption);
    case "trees": {
      if (!Array.isArray(b.items) || b.items.length < 2 || b.items.length > BOARD_LIMITS.trees) return "trees.items \u5FC5\u987B\u662F 2\u20133 \u68F5\u6811";
      for (const [i, it] of b.items.entries()) {
        const e = (it?.tree ? validateTree(it.tree) : "\u7F3A tree") ?? checkCaption(it.caption);
        if (e) return `\u7B2C ${i + 1} \u68F5\uFF1A${e}`;
      }
      return null;
    }
    case "graph":
      return validateGraph(b) ?? checkCaption(b.caption);
    case "array":
      return validateArray(b) ?? checkCaption(b.caption);
    case "math":
      return validateTex(b.tex) ?? checkCaption(b.caption);
    case "code": {
      if (!nonEmpty2(b.code)) return "code.code \u4E0D\u80FD\u4E3A\u7A7A";
      const n = b.code.replace(/\n+$/, "").split("\n").length;
      if (n > 14 || b.code.length > 900) return "code \u6700\u591A 14 \u884C\u3001900 \u5B57\u7B26\uFF1A\u53EA\u6458\u6700\u5173\u952E\u7684\u51E0\u884C";
      if (b.path !== void 0 && !(isStr(b.path) && b.path.length <= 160)) return "code.path \u5FC5\u987B\u662F\u6587\u4EF6\u8DEF\u5F84";
      if (b.startLine !== void 0 && !(Number.isInteger(b.startLine) && b.startLine >= 1)) return "code.startLine \u5FC5\u987B\u662F\u6B63\u6574\u6570";
      if (b.highlight !== void 0 && !(Array.isArray(b.highlight) && b.highlight.every((x) => Number.isInteger(x) && x >= 1 && x <= n))) return "code.highlight \u662F\u672C\u6BB5\u5185\u7684\u884C\u53F7\uFF08\u4ECE 1 \u8D77\uFF09";
      return checkCaption(b.caption);
    }
    case "bars":
      return validateBars(b) ?? checkCaption(b.caption);
    case "timeline":
      return validateTimeline(b) ?? checkCaption(b.caption);
    case "flowchart":
      return validateFlowchart(b) ?? checkCaption(b.caption);
    case "sequence":
      return validateSequence(b) ?? checkCaption(b.caption);
    case "arch":
      return validateArch(b) ?? checkCaption(b.caption);
    case "cycle":
      return validateCycle(b) ?? checkCaption(b.caption);
    case "nest":
      return validateNest(b) ?? checkCaption(b.caption);
    case "html":
      if (!lbl(b.title, BOARD_LIMITS.htmlTitle)) return `html.title \u5FC5\u987B\u662F 1\u2013${BOARD_LIMITS.htmlTitle} \u5B57`;
      if (b.htmlId !== void 0 && !/^hx_[a-z0-9]{8,32}$/.test(b.htmlId)) return "html.htmlId \u683C\u5F0F\u4E0D\u5BF9";
      if (b.variant !== void 0 && b.variant !== "anim" && b.variant !== "game") return "html.variant \u53EA\u80FD\u662F anim \u6216 game";
      if (b.variant === "game") {
        if (b.game !== void 0) {
          const e = validateGame(b.game);
          if (e) return `html \u5C0F\u6E38\u620F\uFF1A${e}`;
        }
        if (b.game === void 0 && b.htmlId === void 0) return "html \u5C0F\u6E38\u620F\u9700\u8981\u5185\u7F6E\u73A9\u6CD5 game\uFF08\u5C0F\u7A0B\u5E8F\u53EA\u80FD\u73A9\u5185\u7F6E\u73A9\u6CD5\uFF09";
        return checkCaption(b.caption);
      }
      if (b.htmlId === void 0 && !lbl(b.brief, BOARD_LIMITS.brief)) return `html \u9700\u8981 brief\uFF081\u2013${BOARD_LIMITS.brief} \u5B57\uFF0C\u5199\u6E05\u8981\u6F14\u793A\u4EC0\u4E48\uFF09`;
      return checkCaption(b.caption);
    case "image":
      return validateImage(b);
    default:
      return `\u672A\u77E5\u7684 board kind\uFF1A${String(b.kind)}`;
  }
}
function sanitizeLessonBoards(lesson) {
  const dropped = [];
  lesson.steps.forEach((s, i) => {
    if (s.type !== "say" || s.board === void 0) return;
    const reason = validateBoard(s.board);
    if (reason) {
      dropped.push({ step: i, reason });
      delete s.board;
    }
  });
  lesson.steps.forEach((s, i) => {
    if (s.type !== "say" || s.mark === void 0) return;
    const reason = validateMark(lesson, i);
    if (reason) {
      dropped.push({ step: i, reason: `mark:${reason}` });
      delete s.mark;
    }
  });
  return { dropped };
}

// ../../src/lib/lesson-player.ts
var VOLATILE = /* @__PURE__ */ new Set(["figId", "highlight", "active", "visit", "visited", "current", "cursor"]);
function figureKey(b) {
  return JSON.stringify(b, (k, v) => VOLATILE.has(k) ? void 0 : v);
}
function sameFigure(a, b) {
  return a.kind === b.kind && figureKey(a) === figureKey(b);
}

// ../../src/lib/lesson-build.ts
init_textwidth();

// ../../src/lib/enum.ts
var ENUM_RE = /^\s*(?:[\u2460-\u2473\u2474-\u2487\u2488-\u249b\u2776-\u277f\u24f5-\u24fe]|[(（]\s*\d{1,2}\s*[)）]|\d{1,2}\s*(?:[)）、:：]|[.．](?!\d))|[一二三四五六七八九十]{1,3}\s*[、.．:：]|第\s*[一二三四五六七八九十\d]{1,3}\s*(?:[点步条个]\s*)?[、:：，,]|(?:step|Step|STEP)\s*\d{1,2}\s*[:：.、])\s*/;
function stripEnum(text2) {
  const out = text2.replace(ENUM_RE, "");
  return out.trim() ? out : text2;
}

// ../../src/lib/lesson-build.ts
var SAY_MAX_CHARS = 80;
var QUIZ_GROUNDING_MIN = 0.3;
var QUIZ_CONTEXT_STEPS = 3;
function boardText(b) {
  if (!b) return "";
  switch (b.kind) {
    case "title":
    case "bullet":
    case "note":
    case "formula":
      return b.text ?? "";
    case "table":
      return (b.rows ?? []).map((r) => r.join(" ")).join(" ");
    case "flow":
      return (b.nodes ?? []).join(" ");
    case "list":
      return [b.title ?? "", ...b.items ?? []].join(" ");
    case "case":
      return [b.title ?? "", ...(b.items ?? []).flatMap((x) => [x.label, x.text])].join(" ");
    case "tree":
    case "graph":
      return [...(b.nodes ?? []).map((n) => n.label), b.caption ?? ""].join(" ");
    case "trees":
      return (b.items ?? []).map((it) => `${it.caption} ${it.tree.nodes.map((n) => n.label).join(" ")}`).join(" ");
    case "array":
      return [...b.items ?? [], b.caption ?? ""].join(" ");
    case "math":
      return `${b.tex ?? ""} ${b.caption ?? ""}`;
    case "code":
      return `${b.path ?? ""} ${b.code ?? ""} ${b.caption ?? ""}`;
    case "bars":
      return [...(b.items ?? []).map((x) => `${x.label} ${x.value}${b.unit ?? ""}`), b.caption ?? ""].join(" ");
    case "timeline":
      return [...(b.points ?? []).map((p) => `${p.label} ${p.sub ?? ""}`), ...(b.spans ?? []).map((s) => s.label), b.caption ?? ""].join(" ");
    case "flowchart":
      return [...(b.nodes ?? []).map((n) => n.label), ...(b.edges ?? []).map((e) => e.label ?? ""), b.caption ?? ""].join(" ");
    case "sequence":
      return [...b.actors ?? [], ...(b.messages ?? []).map((m) => m.text), b.caption ?? ""].join(" ");
    case "arch":
      return [...(b.layers ?? []).flatMap((l) => [l.name, ...l.items ?? []]), b.caption ?? ""].join(" ");
    case "cycle":
      return [...b.nodes ?? [], b.center ?? "", b.caption ?? ""].join(" ");
    case "nest": {
      const walk = (n) => n ? [n.label, n.note ?? "", ...(n.children ?? []).flatMap(walk)] : [];
      return [b.title ?? "", ...walk(b.root), b.caption ?? ""].filter(Boolean).join(" ");
    }
    case "html":
      return [b.title ?? "", b.caption ?? ""].join(" ");
    case "image":
      return b.caption ?? "";
    // R49：图内无字，只有说明文字可被圈画 / 溯源
    default:
      return "";
  }
}
function splitText(text2, max = SAY_MAX_CHARS) {
  const t = text2.trim();
  if (tlen(t) <= max) return [t];
  const latin = isLatinText2(t);
  const sep = latin ? " " : "";
  const sents = (latin ? t.split(/(?<=[.!?;])\s+/) : t.split(/(?<=[。！？；!?])/)).map((s) => s.trim()).filter(Boolean);
  const pieces = [];
  for (const s of sents) {
    if (tlen(s) <= max) {
      pieces.push(s);
      continue;
    }
    let cur = "";
    for (const c of latin ? s.split(/(?<=[,:])\s+/) : s.split(/(?<=[，、：,:])/)) {
      if (cur && tlen(cur + sep + c) > max) {
        pieces.push(cur);
        cur = "";
      }
      cur = cur ? cur + sep + c : c;
      while (tlen(cur) > max) {
        if (latin) {
          const words = cur.split(/\s+/);
          let head = "";
          while (words.length && tlen(head ? head + " " + words[0] : words[0]) <= max) head = head ? head + " " + words.shift() : words.shift();
          if (!head) {
            const w = words.shift();
            head = w.slice(0, max * 2);
            if (w.length > max * 2) words.unshift(w.slice(max * 2));
          }
          pieces.push(head);
          cur = words.join(" ");
        } else {
          pieces.push(cur.slice(0, max));
          cur = cur.slice(max);
        }
      }
    }
    if (cur) pieces.push(cur);
  }
  const out = [];
  for (const p of pieces) {
    if (out.length && tlen(out[out.length - 1] + sep + p) <= max && tlen(out[out.length - 1]) < max * 0.45) out[out.length - 1] += sep + p;
    else out.push(p);
  }
  return out;
}
var isLatinText2 = (s) => {
  const t = s.replace(/\s+/g, "");
  return !!t && (t.match(/[\u3400-\u9fff]/g) ?? []).length < t.length * 0.05;
};
function splitLongSays(steps, max = SAY_MAX_CHARS) {
  const out = [];
  for (const s of steps) {
    if (s.type !== "say" || typeof s.text !== "string" || tlen(s.text) <= max) {
      out.push(s);
      continue;
    }
    const parts = splitText(s.text, max);
    parts.forEach((text2, i) => {
      if (i === 0) out.push({ ...s, text: text2 });
      else {
        const rest = { ...s, text: text2 };
        delete rest.board;
        delete rest.mark;
        delete rest.id;
        out.push(rest);
      }
    });
  }
  return out;
}
var MARK_STYLES = ["circle", "highlight", "underline"];
function assembleLesson(parts) {
  const steps = [];
  for (const part of parts) {
    const local = /* @__PURE__ */ new Map();
    const raw = part.steps;
    let lastQ = -1;
    raw.forEach((s, i) => {
      if (s.type === "quiz" || s.type === "check") lastQ = i;
    });
    let lastNonReward = -1;
    raw.forEach((s, i) => {
      if (s.type !== "reward") lastNonReward = i;
    });
    const rewardAfter = lastQ >= 0 ? lastQ : lastNonReward;
    raw.forEach((s, i) => {
      const g2 = steps.length;
      const objective = part.objective;
      if (s.type === "say") {
        const { id, mark, ...rest } = s;
        const out = { ...rest, kp: part.kp };
        if (out.board?.kind === "list") out.board = { ...out.board, items: (out.board.items ?? []).map((x) => stripEnum(String(x))) };
        if (objective !== void 0 && !rest.filler) out.objective = objective;
        if (mark) {
          const target = mark.ref !== void 0 ? local.get(String(mark.ref)) : void 0;
          const style = MARK_STYLES.includes(String(mark.style)) ? mark.style : "highlight";
          if (target !== void 0) out.mark = { target, style, ...mark.text ? { text: String(mark.text) } : {} };
        }
        if (id && out.board) local.set(String(id), g2);
        steps.push(out);
      } else if (s.type === "reward") {
        return;
      } else {
        steps.push({ ...s, kp: part.kp, ...objective !== void 0 ? { objective } : {} });
      }
      if (i === rewardAfter && part.reward && objective !== void 0)
        steps.push({ type: "reward", concept: part.reward.concept, desc: part.reward.desc, objective, kp: part.kp });
    });
    if (rewardAfter < 0 && part.reward && part.objective !== void 0)
      steps.push({ type: "reward", concept: part.reward.concept, desc: part.reward.desc, objective: part.objective, kp: part.kp });
  }
  return steps;
}
function validateMarks(steps) {
  const dropped = [];
  steps.forEach((s, i) => {
    if (s.type !== "say" || !s.mark) return;
    const m = s.mark;
    const t = Number.isInteger(m.target) ? steps[m.target] : void 0;
    const ok = !!t && m.target < i && t.type === "say" && !!t.board && MARK_STYLES.includes(m.style) && (m.text === void 0 || m.text.trim().length > 0 && boardText(t.board).includes(m.text));
    if (!ok) {
      delete s.mark;
      dropped.push(i);
    }
  });
  return dropped;
}
function quizGroundingScore(steps, idx, n = QUIZ_CONTEXT_STEPS) {
  const q = steps[idx];
  if (!q || q.type !== "quiz") return 0;
  const ctx = [];
  for (let i = idx - 1; i >= 0 && ctx.length < n; i--) {
    const s = steps[i];
    if (s.type === "say") ctx.push(`${s.text} ${boardText(s.board)}`);
  }
  if (!ctx.length) return 0;
  const correct = q.options[q.answer] ?? "";
  return scoreOverlap(`${correct} ${q.explain ?? ""}`, ctx.join(" "));
}
function quizShapeOk(q) {
  return typeof q.prompt === "string" && q.prompt.trim().length > 0 && Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 4 && q.options.every((o) => typeof o === "string" && o.trim().length > 0) && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length;
}
function validateQuizGrounding(steps, threshold = QUIZ_GROUNDING_MIN, label = "") {
  const dropped = [];
  const keep = steps.map((s, i) => {
    if (s.type !== "quiz") return true;
    if (!quizShapeOk(s)) {
      dropped.push({ step: i, score: -1, prompt: String(s.prompt ?? "") });
      return false;
    }
    const score = quizGroundingScore(steps, i);
    if (score < threshold) {
      dropped.push({ step: i, score, prompt: s.prompt });
      return false;
    }
    return true;
  });
  if (!dropped.length) return { steps, dropped };
  for (const d of dropped) console.warn(`[quiz] ${label}\u5220\u9664\u672A\u5728\u524D\u6587\u627E\u5230\u7B54\u6848\u7684\u5FEB\u6D4B #${d.step}\uFF08\u91CD\u53E0\u5EA6 ${d.score.toFixed(2)}\uFF09\uFF1A${d.prompt.slice(0, 40)}`);
  const map = [];
  let n = 0;
  steps.forEach((_, i) => {
    map[i] = keep[i] ? n++ : -1;
  });
  const out = steps.filter((_, i) => keep[i]);
  for (const s of out) if (s.type === "say" && s.mark) {
    const t = map[s.mark.target];
    if (t === void 0 || t < 0) delete s.mark;
    else s.mark = { ...s.mark, target: t };
  }
  return { steps: out, dropped };
}
var STRUCTURED_KINDS = ["table", "flowchart", "sequence", "arch", "cycle", "nest", "tree", "trees", "graph", "array", "bars", "timeline", "html"];
var TEXT_KINDS = ["title", "bullet", "note", "formula", "list", "flow"];
var KP_STRUCTURED_MIN = 2;
var LESSON_TABLE_MIN = 2;
var TEXT_RUN_MAX = 3;
var isStructured = (b) => STRUCTURED_KINDS.includes(b.kind) && !(b.kind === "html" && b.variant === "game");
var isTextBoard = (b) => TEXT_KINDS.includes(b.kind);
function boardQuota(steps) {
  const objs = /* @__PURE__ */ new Map();
  let run2 = 0, maxTextRun = 0, runText = "";
  steps.forEach((s, i) => {
    if (s.type !== "say" || !s.board || validateBoard(s.board)) return;
    const b = s.board;
    if (b.kind === "image") return;
    const fig = b.figId;
    objs.set(fig ? `${b.kind}#${fig}` : `${b.kind}@${i}`, b);
    if (isTextBoard(b)) {
      run2++;
      if (run2 > maxTextRun) {
        maxTextRun = run2;
        runText = String(s.text ?? "").slice(0, 20);
      }
    } else run2 = 0;
  });
  const list = [...objs.values()];
  const structured = list.filter(isStructured);
  return {
    structured: structured.length,
    tables: list.filter((b) => b.kind === "table").length,
    kinds: [...new Set(structured.map((b) => b.kind))],
    maxTextRun,
    /** 最长一串文字板书里第一次超限那段口播的开头（给修复提示用） */
    textRunAt: runText
  };
}
function lessonQuotaIssues(steps) {
  const issues = [];
  const kps = [...new Set(steps.map((s) => s.kp).filter((k) => Number.isInteger(k)))].sort((a, b) => a - b);
  if (!kps.length) return issues;
  const last = kps[kps.length - 1];
  let tables = 0;
  for (const k of kps) {
    const q = boardQuota(steps.filter((s) => s.kp === k));
    if (k > 0) tables += q.tables;
    if (k > 0 && k < last && q.structured < KP_STRUCTURED_MIN) issues.push(`\u77E5\u8BC6\u70B9 ${k} \u7ED3\u6784\u5316\u677F\u4E66 ${q.structured} \u4E2A\uFF08< ${KP_STRUCTURED_MIN}\uFF09`);
    if (k > 0 && q.maxTextRun > TEXT_RUN_MAX) issues.push(`${k === last ? "\u6536\u5C3E" : `\u77E5\u8BC6\u70B9 ${k}`}\u8FDE\u7EED ${q.maxTextRun} \u6BB5\u6587\u5B57\u677F\u4E66\uFF08> ${TEXT_RUN_MAX}\uFF09`);
  }
  if (tables < LESSON_TABLE_MIN) issues.push(`\u5168\u8282\u8868\u683C ${tables} \u5F20\uFF08< ${LESSON_TABLE_MIN}\uFF09`);
  return issues;
}
var BRIDGE_RE = /你可能会(想|问)|快测|小测|测一下|测试一下|考考你|确认一下/;
var REVEAL_RE = /^(所以)?(正确答案|答案是|答案就是|没错|对，)/;
function relocateUngroundedQuizzes(steps, threshold = QUIZ_GROUNDING_MIN) {
  let moved = 0;
  for (let q = 0; q < steps.length; q++) {
    const quiz = steps[q];
    if (quiz.type !== "quiz" || !quizShapeOk(quiz)) continue;
    if (quizGroundingScore(steps, q) >= threshold) continue;
    const before = steps[q - 1];
    const after = steps[q + 1];
    const hasBridge = !!before && before.type === "say" && BRIDGE_RE.test(before.text);
    const hasReveal = !!after && after.type === "say" && !after.board && REVEAL_RE.test(after.text.trim());
    const start = hasBridge ? q - 1 : q;
    const block = steps.slice(start, q + 1 + (hasReveal ? 1 : 0));
    const rest = [...steps.slice(0, start), ...steps.slice(start + block.length)];
    const qi = block.indexOf(quiz);
    for (let p = start - 1; p >= 1; p--) {
      if (rest[p - 1].type !== "say") continue;
      const trial = [...rest.slice(0, p), ...block.slice(0, qi + 1)];
      if (quizGroundingScore(trial, p + qi) >= threshold) {
        steps.splice(0, steps.length, ...rest.slice(0, p), ...block, ...rest.slice(p));
        moved++;
        q = p + block.length - 1;
        break;
      }
    }
  }
  return moved;
}
function phrasesOf(text2) {
  return Array.from(new Set(text2.split(/[\s,，。.、；;：:|/→←↔+＋=（）()「」“”"'《》①②③④⑤·…!！?？-]+/).map((x) => x.trim()).filter((x) => x.length >= 2 && x.length <= 8)));
}
function autoMarks(steps) {
  let added = 0;
  let lastText = "";
  steps.forEach((s, i) => {
    if (s.type !== "say" || s.board || s.mark || s.panel || s.filler || s.text.length < 8) return;
    for (let j2 = i - 1, seen = 0; j2 >= 0 && seen < 6; j2--) {
      const t = steps[j2];
      if (t.type !== "say" || !t.board || t.board.kind === "image") continue;
      if ((t.kp ?? 0) !== (s.kp ?? 0)) break;
      seen++;
      const hit = phrasesOf(boardText(t.board)).filter((p) => s.text.includes(p) && p !== lastText).sort((a, b) => b.length - a.length)[0];
      if (hit) {
        s.mark = { target: j2, style: "highlight", text: hit };
        lastText = hit;
        added++;
        return;
      }
    }
  });
  return added;
}
function boardSyncRate(steps) {
  const says = steps.filter((s) => s.type === "say" && !s.filler);
  if (!says.length) return 1;
  return says.filter((s) => s.board || s.mark || s.panel).length / says.length;
}
function dropRepeatedBoards(steps, same) {
  let n = 0;
  steps.forEach((s, i) => {
    if (s.type !== "say" || !s.board || s.board.figId) return;
    for (let j2 = i - 1; j2 >= 0; j2--) {
      const t = steps[j2];
      if ((t.kp ?? 0) !== (s.kp ?? 0)) break;
      if (t.type !== "say" || !t.board || !same(t.board, s.board)) continue;
      const hl = s.board.highlight;
      const changed = JSON.stringify(hl ?? null) !== JSON.stringify(t.board.highlight ?? null);
      if (changed) {
        const fid = `dup${j2}`;
        t.board.figId = fid;
        s.board.figId = fid;
      } else {
        delete s.board;
        if (!s.mark) s.mark = { target: j2, style: "highlight" };
      }
      n++;
      return;
    }
  });
  return n;
}

// ../../src/lib/ai/tasks.ts
function sentences(text2) {
  return text2.split(/(?<=[。！？；])/).map((s) => s.trim()).filter((s) => s.length >= 10);
}
function shorten(s, n = 34) {
  const t = s.replace(/[。；]$/, "");
  return t.length > n ? t.slice(0, n) + "\u2026" : t;
}
function finalizeLesson(l, label = "") {
  l.steps = validateQuizGrounding(l.steps, QUIZ_GROUNDING_MIN, `\u8BFE\u8282\u300C${label}\u300D`).steps;
  const { dropped } = sanitizeLessonBoards(l);
  if (dropped.length) console.warn(`[board] \u8BFE\u8282\u300C${label}\u300D\u5220\u9664 ${dropped.length} \u4E2A\u4E0D\u5408\u683C\u677F\u4E66\uFF1A${dropped.map((d) => `#${d.step} ${d.reason}`).join("\uFF1B")}`);
  const marks = validateMarks(l.steps);
  if (marks.length) console.warn(`[mark] \u8BFE\u8282\u300C${label}\u300D\u5220\u9664 ${marks.length} \u4E2A\u4E0D\u5408\u683C\u5708\u753B\uFF1A${marks.map((i) => `#${i}`).join("\u3001")}`);
  const dup = dropRepeatedBoards(l.steps, sameFigure);
  if (dup) console.warn(`[board] ${dup} \u5F20\u91CD\u590D\u677F\u4E66\u6539\u4E3A\u539F\u4F4D\u66F4\u65B0`);
  const auto = autoMarks(l.steps);
  if (auto) console.warn(`[mark] \u8BFE\u8282\u300C${label}\u300D\u81EA\u52A8\u8865 ${auto} \u5904\u9AD8\u4EAE\uFF0C\u767D\u677F\u547C\u5E94\u7387 ${Math.round(boardSyncRate(l.steps) * 100)}%`);
  const quota = lessonQuotaIssues(l.steps);
  if (quota.length) console.warn(`[board] \u8BFE\u8282\u300C${label}\u300D\u7ED3\u6784\u5316\u677F\u4E66\u914D\u989D\u672A\u8FBE\u6807\uFF08\u5DF2\u63A5\u53D7\uFF09\uFF1A${quota.join("\uFF1B")}`);
  return l;
}
var ROLE_TEXT = {
  concrete: "\u5177\u8C61\u5316\uFF1A\u5B66\u4E60\u8005\u6CA1\u89C1\u8FC7\u7684\u4E8B\u7269\uFF0C\u753B\u51FA\u6765\u624D\u6709\u76F4\u89C9",
  metaphor: "\u9690\u55BB\u843D\u5730\uFF1A\u628A\u672C\u8BFE\u7528\u5230\u7684\u7C7B\u6BD4\u753B\u6210\u4E00\u5E45\u753B",
  scene: "\u60C5\u5883\u4EE3\u5165\uFF1A\u6848\u4F8B / \u95EE\u9898\u53D1\u751F\u7684\u771F\u5B9E\u573A\u666F",
  contrast: "\u5BF9\u6BD4\u53CD\u5DEE\uFF1A\u9519\u8BEF\u505A\u6CD5 vs \u6B63\u786E\u505A\u6CD5\u7684\u4E24\u683C\u753B\u9762",
  story: "\u53D9\u4E8B\u89D2\u8272\u683C\uFF1A\u8D2F\u7A7F\u6848\u4F8B\u4E3B\u89D2\u5728\u672C\u77E5\u8BC6\u70B9\u7684\u4E00\u683C\u5267\u60C5",
  panorama: "\u5168\u666F\u73AF\u5883\uFF1A\u7CFB\u7EDF / \u73B0\u8C61\u5728\u771F\u5B9E\u73AF\u5883\u4E2D\u7684\u6837\u5B50",
  hook: "\u8BB0\u5FC6\u94A9\u5B50\uFF1A\u4E00\u4E2A\u5938\u5F20\u3001\u597D\u8BB0\u7684\u753B\u9762\u5E2E\u52A9\u8BB0\u4F4F\u5173\u952E\u6982\u5FF5",
  mood: "\u60C5\u7EEA\u8282\u594F\uFF1A\u8FC7\u6E21 / \u6536\u5C3E\u65F6\u8BA9\u4EBA\u653E\u677E\u3001\u6709\u753B\u9762\u611F"
};
var IMAGE_PLAN_RULE = `- images\uFF08\u53EF\u9009\u7684 AI\u300C\u6848\u4F8B\u6F2B\u753B\u300D\uFF0C\u6BCF\u8282 0\u2013${IMAGE_LIMITS.perLesson} \u5F20\uFF0C\u6BCF\u4E2A\u77E5\u8BC6\u70B9\u6700\u591A 1 \u5F20\uFF09\uFF1A\u628A\u672C\u77E5\u8BC6\u70B9\u7684\u8D2F\u7A7F\u6848\u4F8B\uFF08escalation \u90A3\u4E00\u6B65\uFF09\u753B\u6210 2\u20134 \u683C\u5E7D\u9ED8\u6F2B\u753B\uFF0C\u53F0\u8BCD\u548C\u672C\u77E5\u8BC6\u70B9\u6700\u6838\u5FC3\u7684\u4E00\u53E5\u89C2\u70B9\u76F4\u63A5\u5199\u5728\u753B\u91CC\uFF0C\u8BA9\u5B66\u4E60\u8005\u7B11\u7740\u8BB0\u4F4F\u9053\u7406\uFF082026-11-01 \u7528\u6237\u9700\u6C42\uFF09\u3002
  \u6F2B\u753B\u5FC5\u987B\u6F14\u300C\u672C\u8282\u8D2F\u7A7F\u6848\u4F8B\u300D\u7684\u4E3B\u89D2\u548C\u573A\u666F\uFF082026-11-01 \u7528\u6237\u5F55\u5C4F\u53CD\u9988\uFF1A\u6F2B\u753B\u53E6\u8D77\u53A8\u623F\u3001\u63A5\u529B\u8D5B\u7B49\u65B0\u6BD4\u55BB\uFF0C\u548C\u8BB2\u89E3\u5BF9\u4E0D\u4E0A\uFF09\uFF1A\u540C\u4E00\u8282\u8BFE\u53EA\u7528\u8FD9\u4E00\u4E2A\u6848\u4F8B\uFF0C\u4E0D\u518D\u5F15\u5165\u7B2C\u4E8C\u5957\u6BD4\u55BB\uFF1B\u53EA\u6709\u6848\u4F8B\u672C\u8EAB\u6CA1\u6CD5\u753B\u65F6\uFF0C\u624D\u5141\u8BB8\u7528\u4E00\u4E2A\u6BD4\u55BB\uFF0C\u800C\u4E14\u5FC5\u987B\u5728\u8BB2\u7A3F\u91CC\u9010\u4E00\u8BF4\u660E\u300C\u753B\u9762\u91CC\u7684 X \u5C31\u662F Y\u300D\u3002
  \u5B83\u548C\u6848\u4F8B\u5361\u7247 / \u8868\u683C\u5206\u5DE5\uFF1A\u5361\u7247\u548C\u8868\u683C\u5199\u4E8B\u5B9E\u4E0E\u7ED3\u6784\uFF0C\u6F2B\u753B\u53EA\u8D1F\u8D23\u300C\u597D\u7B11\u7684\u60C5\u8282 + \u4E00\u53E5\u70B9\u9898\u7684\u8BDD\u300D\uFF1B\u4E0D\u8981\u5728\u6F2B\u753B\u91CC\u91CD\u590D\u8868\u683C\u3001\u6570\u636E\u6216\u5B9A\u4E49\u539F\u6587\u3002role \u4E00\u822C\u7528 story\uFF08\u53D9\u4E8B\uFF09/ contrast\uFF08\u9519\u8BEF vs \u6B63\u786E\uFF09/ hook\uFF08\u5938\u5F20\u597D\u8BB0\uFF09\uFF1A
${IMAGE_ROLES.map((r) => `  \xB7 ${r}\uFF08${ROLE_TEXT[r]}\uFF09`).join("\n")}
  \u6BCF\u5F20\u5199 {"role":"\u2026","why":"\u8FD9\u5E45\u6F2B\u753B\u5E2E\u5B66\u4E60\u8005\u8BB0\u4F4F\u4EC0\u4E48\uFF08\u2265 ${IMAGE_LIMITS.whyMin} \u5B57\uFF09","idea":"\u6F2B\u753B\u60C5\u8282\u6784\u60F3\uFF08\u4E00\u53E5\u8BDD\uFF1A\u6848\u4F8B\u4E3B\u89D2\u9047\u5230\u4EC0\u4E48\u597D\u7B11\u7684\u72B6\u51B5\u3001\u600E\u4E48\u70B9\u9898\uFF09"}\uFF1B\u6848\u4F8B\u672C\u8EAB\u4E0D\u597D\u7B11\u3001\u786C\u51D1\u7B11\u70B9\u5C31\u4E0D\u8981\u5B89\u6392\u3002
  \u4E0D\u753B\u9700\u8981\u300C\u753B\u5BF9\u300D\u7684\u5185\u5BB9\uFF1A\u89E3\u5256\u3001\u5730\u56FE\u3001\u7535\u8DEF\u3001\u5316\u5B66\u7ED3\u6784\u3001\u771F\u5B9E\u5386\u53F2\u4EBA\u7269\u3001\u5177\u4F53\u6570\u636E / \u56FE\u8868\u3002`;
var BOARD_SPEC = `\u677F\u4E66 board \u7684\u683C\u5F0F\uFF08\u6BCF\u4E2A say \u81F3\u591A\u4E00\u4E2A board\uFF1B\u4E0D\u8981\u8F93\u51FA SVG/HTML/\u5750\u6807\uFF0C\u524D\u7AEF\u4F1A\u81EA\u52A8\u6392\u7248\u753B\u56FE\uFF09\uFF1A
  \xB7 \u6587\u5B57\u7C7B\uFF1A{"kind":"title|bullet|note|formula","text":"..."}\uFF08\u2264 30 \u5B57\u4E3A\u5B9C\uFF09\uFF1B\u8868\u683C {"kind":"table","rows":[["\u8868\u5934",...],[...]]}\uFF1B\u6D41\u7A0B {"kind":"flow","nodes":["\u6B65\u9AA41","\u6B65\u9AA42"]}
  \xB7 \u8981\u70B9\u6E05\u5355 list\uFF08\u8BB2\u4E00\u53E5\u5199\u4E00\u6761\uFF09\uFF1A{"kind":"list","figId":"k1","title":"\u5E7B\u89C9\u7684\u4E09\u4E2A\u6765\u6E90","items":["\u6982\u7387\u751F\u6210"]}\uFF1B\u4E4B\u540E\u6BCF\u8BB2\u4E00\u6761\uFF0C\u518D\u8F93\u51FA\u540C\u4E00\u4E2A figId \u7684\u5B8C\u6574 list\uFF08\u4E4B\u524D\u7684\u6761\u76EE + \u65B0\u6761\u76EE\uFF09\uFF0C\u767D\u677F\u4F1A\u539F\u4F4D\u8FFD\u52A0\uFF0C\u4E0D\u4F1A\u91CD\u753B\u3002\u2264 8 \u6761\uFF0C\u6BCF\u6761 \u2264 20 \u5B57\u3002
  \xB7 \u6848\u4F8B\u5361 case\uFF08\u628A\u8D2F\u7A7F\u6848\u4F8B\u753B\u5230\u677F\u4E0A\uFF09\uFF1A{"kind":"case","figId":"case","title":"\u5C0F\u5468\u7684\u667A\u80FD\u5BA2\u670D","items":[{"label":"\u573A\u666F","text":"\u7528\u6237\u95EE\u9000\u8D27\u653F\u7B56"}]}\uFF1B\u6848\u4F8B\u6BCF\u63A8\u8FDB\u4E00\u6B65\uFF0C\u518D\u8F93\u51FA\u540C\u4E00\u4E2A figId \u7684\u5B8C\u6574 case \u5E76\u8FFD\u52A0\u4E00\u683C\uFF08label \u7528 \u573A\u666F / \u95EE\u9898 / \u505A\u6CD5 / \u7ED3\u679C / \u542F\u793A \u7B49 \u2264 4 \u5B57\uFF0Ctext \u2264 30 \u5B57\uFF09\u3002
  \xB7 table / flow \u4E5F\u53EF\u4EE5\u5E26 figId \u9010\u884C\uFF08\u9010\u4E2A\u7ED3\u70B9\uFF09\u8FFD\u52A0\uFF1A\u540E\u7EED\u8F93\u51FA\u540C figId \u7684\u5B8C\u6574\u8868\u683C/\u6D41\u7A0B\uFF0C\u591A\u4E00\u884C\u6216\u591A\u4E00\u4E2A\u7ED3\u70B9\u3002
  \xB7 \u6761\u5F62\u56FE bars\uFF08\u6982\u7387 / \u6BD4\u4F8B / \u6570\u503C\u5BF9\u6BD4\uFF0C\u5982\u6A21\u578B\u9884\u6D4B\u4E0B\u4E00\u4E2A\u8BCD\u7684\u5019\u9009\u6982\u7387\uFF09\uFF1A{"kind":"bars","items":[{"label":"\u5019\u9009A","value":60},{"label":"\u5019\u9009B","value":25},{"label":"\u5019\u9009C","value":15}],"unit":"%","highlight":[0],"caption":"\u2026\u2026\u7684\u5BF9\u6BD4"}\uFF08\u6807\u7B7E\u4E0E\u6570\u503C\u6309\u672C\u8BFE\u5185\u5BB9\u81EA\u62DF\uFF0C\u4E0D\u8981\u7167\u6284\u793A\u4F8B\uFF09\uFF1B\u2264 8 \u9879\uFF0Cvalue \u2265 0\uFF0C\u6570\u503C\u5FC5\u987B\u4E0E\u53E3\u64AD\u4E00\u81F4\u3002
  \xB7 \u65F6\u95F4\u8F74 timeline\uFF08\u5148\u540E\u987A\u5E8F / \u65F6\u95F4\u533A\u95F4\uFF0C\u5982\u8BAD\u7EC3\u622A\u6B62 T0 \u2192 \u5F53\u524D T1 \u4E4B\u95F4\u7684\u77E5\u8BC6\u76F2\u533A\uFF09\uFF1A{"kind":"timeline","points":[{"label":"T0 \u8BAD\u7EC3\u622A\u6B62","sub":"\u6570\u636E\u505C\u5728\u8FD9\u91CC"},{"label":"T1 \u73B0\u5728"}],"spans":[{"from":0,"to":1,"label":"\u77E5\u8BC6\u76F2\u533A","tone":"bad"}],"caption":"..."}\uFF1Bpoints \u2264 6\uFF0Cspans \u7528 points \u4E0B\u6807\uFF0Ctone \u53D6 bad|good|neutral\u3002
  \xB7 \u6811 tree\uFF1A{"kind":"tree","binary":true,"root":"A","nodes":[{"id":"A","label":"A","children":["B","C"]},{"id":"B","label":"B"},{"id":"C","label":"C"}],"highlight":["A"],"caption":"..."}\uFF08binary \u65F6 children \u4E3A [\u5DE6, \u53F3]\uFF0C\u7A7A\u5B69\u5B50\u7528 "" \u5360\u4F4D\uFF09
  \xB7 \u6811\u5BF9\u6BD4 trees\uFF1A{"kind":"trees","items":[{"caption":"\u524D","tree":{...}},{"caption":"\u540E","tree":{...}}]}\uFF1B\u56FE graph\uFF1A{"kind":"graph","nodes":[{"id":"A","label":"A"}],"edges":[["A","B"]],"directed":false}
  \xB7 \u6570\u7EC4/\u961F\u5217/\u6808 array\uFF1A{"kind":"array","variant":"array|queue|stack","items":["B","C"],"caption":"..."}\uFF1B\u516C\u5F0F math\uFF1A{"kind":"math","tex":"P(w_t\\\\mid w_{<t})","caption":"..."}\uFF08\u6807\u51C6 LaTeX\uFF0C\u2264 300 \u5B57\u7B26\uFF09
  \xB7 \u6D41\u7A0B\u56FE flowchart\uFF08\u6B65\u9AA4 + \u5224\u65AD\u5206\u652F + \u56DE\u8DEF\uFF0C\u5982\u300C\u68C0\u7D22\u589E\u5F3A\u751F\u6210\u7684\u5904\u7406\u6D41\u7A0B\u300D\uFF09\uFF1A{"kind":"flowchart","dir":"TB","nodes":[{"id":"a","label":"\u7528\u6237\u63D0\u95EE","shape":"start"},{"id":"b","label":"\u547D\u4E2D\u77E5\u8BC6\u5E93\uFF1F","shape":"decision"},{"id":"c","label":"\u68C0\u7D22\u7247\u6BB5","shape":"process"},{"id":"d","label":"\u751F\u6210\u56DE\u7B54","shape":"end"}],"edges":[{"from":"a","to":"b"},{"from":"b","to":"c","label":"\u662F"},{"from":"b","to":"d","label":"\u5426"},{"from":"c","to":"d"}],"caption":"..."}\uFF1B2\u201310 \u4E2A\u7ED3\u70B9\uFF08shape\uFF1Astart|end|process|decision|io\uFF09\uFF0C\u6BCF\u4E2A\u7ED3\u70B9\u90FD\u8981\u8FDE\u7EBF\uFF0C\u8FB9 label \u2264 8 \u5B57\uFF1Bdir \u53D6 TB\uFF08\u4E0A\u2192\u4E0B\uFF09\u6216 LR\uFF08\u5DE6\u2192\u53F3\uFF09\u3002
  \xB7 \u65F6\u5E8F\u56FE sequence\uFF08\u591A\u4E2A\u89D2\u8272\u4E4B\u95F4\u6309\u65F6\u95F4\u5148\u540E\u7684\u4EA4\u4E92\uFF0C\u5982\u6D4F\u89C8\u5668 / \u670D\u52A1\u5668 / \u6570\u636E\u5E93\uFF09\uFF1A{"kind":"sequence","actors":["\u6D4F\u89C8\u5668","\u670D\u52A1\u5668","\u6570\u636E\u5E93"],"messages":[{"from":0,"to":1,"text":"\u53D1\u9001\u8BF7\u6C42"},{"from":1,"to":2,"text":"\u67E5\u8BE2"},{"from":2,"to":1,"text":"\u8FD4\u56DE\u7ED3\u679C","reply":true}],"highlight":[1],"caption":"..."}\uFF1B2\u20135 \u4E2A\u53C2\u4E0E\u8005\uFF0C1\u201310 \u6761\u6D88\u606F\uFF0Cfrom/to \u662F\u53C2\u4E0E\u8005\u4E0B\u6807\uFF0Creply \u753B\u865A\u7EBF\u8FD4\u56DE\uFF0Ctext \u2264 18 \u5B57\u3002
  \xB7 \u67B6\u6784\u56FE arch\uFF08\u5206\u5C42\u7ED3\u6784\uFF0C\u5982 \u5E94\u7528\u5C42 / \u670D\u52A1\u5C42 / \u6570\u636E\u5C42\u3001OSI \u6A21\u578B\uFF09\uFF1A{"kind":"arch","layers":[{"name":"\u5E94\u7528\u5C42","items":["\u7F51\u9875","App"]},{"name":"\u670D\u52A1\u5C42","items":["\u7F51\u5173","\u4E1A\u52A1\u670D\u52A1"]},{"name":"\u6570\u636E\u5C42","items":["MySQL","\u7F13\u5B58"]}],"highlight":["\u7F51\u5173"],"caption":"..."}\uFF1B2\u20135 \u5C42\u81EA\u4E0A\u800C\u4E0B\uFF0C\u6BCF\u5C42 1\u20135 \u4E2A\u7EC4\u4EF6\uFF08\u2264 10 \u5B57\uFF0C\u5168\u56FE\u4E0D\u91CD\u590D\uFF09\u3002
  \xB7 \u5FAA\u73AF\u56FE cycle\uFF08\u9996\u5C3E\u76F8\u63A5\u7684\u5FAA\u73AF\u8FC7\u7A0B\uFF0C\u5982 PDCA\u3001\u53CD\u9988\u56DE\u8DEF\u3001\u7EC6\u80DE\u5468\u671F\uFF09\uFF1A{"kind":"cycle","nodes":["\u8BA1\u5212","\u6267\u884C","\u68C0\u67E5","\u6539\u8FDB"],"center":"PDCA","caption":"..."}\uFF1B3\u20136 \u4E2A\u73AF\u8282\u3002
  \xB7 \u5305\u542B\u5173\u7CFB\u56FE nest\uFF08\u96C6\u5408\u5305\u542B / \u5C42\u7EA7\u4ECE\u5C5E / \u6982\u5FF5\u7684\u4E0A\u4E0B\u4F4D\u5173\u7CFB\uFF0C\u5982 \u4EBA\u5DE5\u667A\u80FD \u2283 \u673A\u5668\u5B66\u4E60 \u2283 \u6DF1\u5EA6\u5B66\u4E60\u3001\u5B9E\u6570 \u2283 \u6709\u7406\u6570 \u2283 \u6574\u6570\uFF09\uFF1A{"kind":"nest","title":"\u53EF\u9009\u6807\u9898","root":{"label":"\u4EBA\u5DE5\u667A\u80FD","children":[{"label":"\u673A\u5668\u5B66\u4E60","note":"\u4ECE\u6570\u636E\u4E2D\u5B66\u89C4\u5F8B","children":[{"label":"\u6DF1\u5EA6\u5B66\u4E60"},{"label":"\u5F3A\u5316\u5B66\u4E60"}]},{"label":"\u4E13\u5BB6\u7CFB\u7EDF"}]},"highlight":["\u6DF1\u5EA6\u5B66\u4E60"],"caption":"..."}\uFF1B\u753B\u6210\u5916\u5C42\u5305\u4F4F\u5185\u5C42\u7684\u5D4C\u5957\u6846\u3002root \u81F3\u5C11\u5305\u542B 1 \u4E2A\u5B50\u96C6\u5408\uFF0C\u542B\u6839\u6700\u591A 4 \u5C42\uFF0C\u6BCF\u4E2A\u96C6\u5408 1\u20135 \u4E2A\u5B50\u96C6\u5408\uFF0C\u5168\u56FE \u2264 24 \u4E2A\u7ED3\u70B9\uFF1Blabel \u2264 12 \u5B57\u4E14\u5168\u56FE\u4E0D\u91CD\u590D\uFF0Cnote \u53EF\u9009\uFF08\u2264 20 \u5B57\uFF09\uFF0Chighlight \u5199 label\u3002
  \xB7 \u6982\u5FF5\u52A8\u753B html\uFF08\u53EA\u6709\u52A8\u6001\u8FC7\u7A0B / \u53C2\u6570\u5173\u7CFB\u7528\u9759\u6001\u56FE\u8BB2\u4E0D\u6E05\u65F6\u624D\u7528\uFF0C\u5982\u5F15\u529B\u968F\u8D28\u91CF\u548C\u8DDD\u79BB\u53D8\u5316\u3001\u6CE2\u7684\u53E0\u52A0\u3001\u68AF\u5EA6\u4E0B\u964D\u3001\u6392\u5E8F\u4EA4\u6362\u8FC7\u7A0B\uFF1B\u5168\u8282\u6700\u591A 1 \u4E2A\uFF09\uFF1A{"kind":"html","title":"\u52A8\u753B\u6807\u9898\uFF08\u2264 24 \u5B57\uFF09","brief":"\u8981\u6F14\u793A\u4EC0\u4E48\u3001\u753B\u9762\u4E0A\u6709\u4EC0\u4E48\u3001\u54EA 1\u20133 \u4E2A\u53C2\u6570\u53EF\u4EE5\u62D6\u52A8\u8C03\u8282\u3001\u5B66\u4E60\u8005\u5E94\u8BE5\u89C2\u5BDF\u5230\u4EC0\u4E48\u89C4\u5F8B\uFF08\u2264 200 \u5B57\uFF09"}\u3002\u4E0D\u8981\u5199\u4EE3\u7801\uFF0C\u7CFB\u7EDF\u4F1A\u6309 brief \u751F\u6210\u53EF\u4EA4\u4E92\u52A8\u753B\uFF1B\u8BB2\u5230\u52A8\u753B\u7684\u90A3\u6BB5\u53E3\u64AD\u8BF7\u5F15\u5BFC\u5B66\u4E60\u8005\u300C\u62D6\u52A8\u6ED1\u5757\u770B\u770B\u2026\u2026\u4F1A\u600E\u6837\u300D\u3002
  \xB7 \u4EE3\u7801\u677F\u4E66 code\uFF08\u8BB2\u7F16\u7A0B\u3001\u547D\u4EE4\u884C\u3001\u914D\u7F6E\u6587\u4EF6\u65F6\u628A\u4EE3\u7801\u5199\u4E0A\u767D\u677F\uFF0CR71\uFF09\uFF1A{"kind":"code","lang":"python","code":"1\u201314 \u884C\u4EE3\u7801\uFF0C\u4FDD\u7559\u7F29\u8FDB\u4E0E\u6362\u884C","highlight":[\u8981\u5F3A\u8C03\u7684\u884C\uFF0C\u4ECE 1 \u8D77],"caption":"\u4E00\u53E5\u8BDD\u8BF4\u660E\u8FD9\u51E0\u884C\u5728\u505A\u4EC0\u4E48"}\u3002\u7247\u6BB5\u91CC\u6709\u8FD9\u6BB5\u4EE3\u7801\u5C31\u539F\u6837\u7167\u6284\uFF08\u4E0D\u6539\u5199\u3001\u4E0D\u8865\u5168\uFF09\uFF0C\u670D\u52A1\u7AEF\u4F1A\u627E\u5230\u51FA\u5904\u6807\u4E0A\u9875\u7801 / \u884C\u53F7\uFF1B\u7247\u6BB5\u91CC\u6CA1\u6709\u3001\u9700\u8981\u81EA\u5DF1\u5199\u793A\u4F8B\u65F6\uFF0C\u4EE3\u7801\u8981\u80FD\u8FD0\u884C\u3001\u5199\u6CD5\u5E38\u89C4\uFF0C\u767D\u677F\u4F1A\u6807\u300C\u793A\u4F8B \xB7 AI \u7F16\u5199\u300D\uFF0C\u53E3\u64AD\u91CC\u4E5F\u8BF4\u300C\u6211\u4EEC\u5199\u4E2A\u5C0F\u4F8B\u5B50\u300D\uFF0C\u4E0D\u8981\u8BF4\u6210\u662F\u6750\u6599\u91CC\u7684\u3002\u8BB2\u4EE3\u7801\u7684\u8BFE\u6BCF\u4E2A\u77E5\u8BC6\u70B9\u81F3\u5C11\u914D 1 \u4E2A\u4EE3\u7801\u677F\u4E66\u3002
  \xB7 \u884C\u5185\u4EE3\u7801\uFF1A\u6587\u5B57\u7C7B\u677F\u4E66\u3001\u8868\u683C\u3001\u6848\u4F8B\u5361\u91CC\u51FA\u73B0\u547D\u4EE4\u3001\u6587\u4EF6\u540D\u3001\u51FD\u6570 / \u53D8\u91CF\u540D\u3001\u53C2\u6570\u65F6\u7528\u53CD\u5F15\u53F7\u5305\u8D77\u6765\uFF0C\u5982 \`python train.py\`\u3001\`init_from\`\uFF1B\u53E3\u64AD say \u91CC\u4E0D\u8981\u7528\u53CD\u5F15\u53F7\u3002
  \xB7 \u540C\u4E00\u5F20\u56FE\u53EA\u753B\u4E00\u6B21\uFF1A\u60F3\u5F3A\u8C03\u56FE\u91CC\u67D0\u4E00\u9879\uFF0C\u7528 mark \u5708\u753B / \u9AD8\u4EAE\uFF0C\u6216\u8F93\u51FA\u5E26\u540C\u4E00 figId \u7684\u56FE\u53EA\u6539 highlight\uFF1B\u4E0D\u8981\u628A\u540C\u6837\u7684\u56FE\u518D\u8F93\u51FA\u4E00\u904D\uFF08\u4F1A\u88AB\u5F53\u6210\u91CD\u590D\u5220\u6389\uFF09\u3002
  \xB7 \u6309\u5185\u5BB9\u9009\u56FE\uFF08\u786C\u6027\u8981\u6C42\uFF0C\u4E0D\u662F\u5EFA\u8BAE\uFF09\uFF1A\u8BB2\u5230\u300C\u6982\u5FF5\u5BF9\u6BD4 / \u5206\u7C7B\u68B3\u7406 / \u4F18\u7F3A\u70B9 / \u53C2\u6570\u542B\u4E49 / \u591A\u4E2A\u7EF4\u5EA6\u7684\u5F52\u7EB3\u300D\u2192 table\uFF08\u53EF\u5E26 figId \u9010\u884C\u8FFD\u52A0\uFF09\uFF1B\u8BB2\u5230\u300C\u6B65\u9AA4 / \u5224\u65AD\u5206\u652F / \u5904\u7406\u8FC7\u7A0B\u300D\u2192 flowchart\uFF1B\u300C\u591A\u4E2A\u89D2\u8272\u6216\u7CFB\u7EDF\u4E4B\u95F4\u7684\u4EA4\u4E92\u300D\u2192 sequence\uFF1B\u300C\u5206\u5C42\u7ED3\u6784\u300D\u2192 arch\uFF1B\u300C\u5FAA\u73AF / \u53CD\u9988\u56DE\u8DEF\u300D\u2192 cycle\uFF1B\u300C\u5305\u542B / \u4ECE\u5C5E / \u96C6\u5408\u5173\u7CFB\u3001\u4E0A\u4E0B\u4F4D\u6982\u5FF5\u300D\u2192 nest\uFF1B\u300C\u6570\u503C\u5BF9\u6BD4\u3001\u6BD4\u4F8B\u300D\u2192 bars\uFF1B\u300C\u65F6\u95F4\u5148\u540E\u3001\u9636\u6BB5\u300D\u2192 timeline\uFF1B\u300C\u52A8\u6001\u8FC7\u7A0B\u6216\u53C2\u6570\u5173\u7CFB\uFF08\u8FD0\u52A8\u539F\u7406\u3001\u6CE2\u52A8\u3001\u7B97\u6CD5\u9010\u6B65\u6267\u884C\u3001\u4F18\u5316\u8FC7\u7A0B\uFF09\u300D\u2192 html \u52A8\u753B\u3002title / bullet / note / list \u8FD9\u7C7B\u6587\u5B57\u677F\u4E66\u53EA\u7528\u4E8E\u6807\u9898\u3001\u4E00\u53E5\u7ED3\u8BBA\u6216\u786E\u5B9E\u6CA1\u6709\u7ED3\u6784\u7684\u5E76\u5217\u8981\u70B9\u3002
  \xB7 \u6587\u5B57\u677F\u4E66\u4E0D\u80FD\u624E\u5806\uFF1A\u8FDE\u7EED\u5199\u6587\u5B57\u7C7B\u677F\u4E66\uFF08title / bullet / note / formula / list / flow\uFF0C\u5305\u62EC\u5F80\u540C\u4E00\u4E2A list \u91CC\u8FFD\u52A0\uFF09\u6700\u591A ${TEXT_RUN_MAX} \u6BB5\uFF0C\u7B2C ${TEXT_RUN_MAX + 1} \u6BB5\u5FC5\u987B\u6362\u6210\u7ED3\u6784\u5316\u677F\u4E66\uFF08\u8868\u683C\u6216\u56FE\uFF09\uFF1B\u80FD\u5199\u6210\u8868\u683C\u7684\u8981\u70B9\u4E0D\u8981\u5199\u6210 list\u3002
  \xB7 label \u2264 12 \u5B57\u3001\u540C\u56FE\u4E0D\u91CD\u590D\uFF1B\u7ED3\u6784\u4E0D\u81EA\u6D3D\u7684\u56FE\u4F1A\u88AB\u670D\u52A1\u7AEF\u5220\u9664\u3002`;
var FEEDBACK_OPENINGS = ["\u5BF9\uFF0C\u5C31\u662F\u8FD9\u4E2A\u610F\u601D", "\u6CA1\u9519", "\u6293\u5F97\u5F88\u51C6", "\u8FD9\u4E2A\u5224\u65AD\u7AD9\u5F97\u4F4F", "\u601D\u8DEF\u5F88\u6E05\u695A", "\u8BF4\u5230\u70B9\u5B50\u4E0A\u4E86", "\u5B8C\u5168\u6B63\u786E"];
var ERROR_PHRASES = ["\u6709\u4E2A\u5751\u8981\u7559\u610F\uFF1A", "\u5BB9\u6613\u6DF7\u7684\u4E00\u70B9\u662F\uFF1A", "\u4E0D\u5C11\u4EBA\u5728\u8FD9\u91CC\u4F1A", "\u5BF9\u6BD4\u4E00\u4E0B\u5E38\u89C1\u7684\u9519\u6CD5\uFF1A", "\u987A\u5E26\u63D0\u9192\uFF1A"];
var FEEDBACK_OPENINGS_EN = ["Exactly", "That's right", "Spot on", "Solid reasoning", "Nicely put", "You got it", "Correct"];
var ERROR_PHRASES_EN = ["One trap to watch: ", "A common mix-up is ", "Many people here ", "Compare with the usual mistake: ", "Also note: "];
var openings = () => contentLang() === "en" ? FEEDBACK_OPENINGS_EN : FEEDBACK_OPENINGS;
var errorPhrases = () => contentLang() === "en" ? ERROR_PHRASES_EN : ERROR_PHRASES;
function feedbackOpening(text2) {
  return (text2.split(/[，,。！!；;：:]/)[0] ?? "").trim().slice(0, 12);
}
function dedupeOpening(feedback, prevOpening) {
  if (!prevOpening) return feedback;
  const head = feedbackOpening(feedback);
  if (!head || head !== prevOpening.trim()) return feedback;
  const alt = openings().find((o) => o !== prevOpening.trim()) ?? L("\u597D", "OK");
  return alt + feedback.slice(feedback.indexOf(head) + head.length);
}
var pickIdx = (s, n) => Array.from(s).reduce((a, ch) => a * 31 + ch.charCodeAt(0) >>> 0, 7) % n;
async function judgeCheck(p) {
  const err = p.commonError.replace(/^(很多人会误以为|很多人会|常见错误[:：]?)/, "");
  if (!hasLLM()) {
    const s = scoreOverlap(p.expected, p.answer);
    const correct = p.answer.trim().length >= 4 && s >= 0.22;
    const seed = pickIdx(p.prompt + p.answer, 1e3);
    const pool = FEEDBACK_OPENINGS.filter((o) => o !== p.prevOpening);
    const opening = pool[seed % pool.length];
    const errLine = ERROR_PHRASES[seed % ERROR_PHRASES.length];
    return correct ? { correct, feedback: `${opening}\uFF01\u5173\u952E\u70B9\u6293\u4F4F\u4E86\uFF1A${shorten(p.expected, 40)}\u3002${errLine}${err}\uFF0C\u4F60\u907F\u5F00\u4E86\u3002`, board: shorten(p.expected, 40) } : { correct, feedback: `\u8FD8\u5DEE\u4E00\u6B65\u3002\u53C2\u8003\u8981\u70B9\u662F\uFF1A${shorten(p.expected, 60)}\u3002${errLine}${err}\u3002\u53EF\u4EE5\u518D\u8BD5\u4E00\u6B21\uFF0C\u6216\u8005\u5148\u8DF3\u8FC7\u3002`, board: "" };
  }
  const r = await chatJSON(
    `\u4F60\u662F\u8001\u5E08\uFF0C\u5224\u65AD\u5B66\u751F\u5BF9${p.variant === "apply" ? "\u60C5\u5883\u5E94\u7528\u9898" : p.variant === "recap" ? "\u590D\u76D8\u9898" : "\u68C0\u67E5\u9898"}\u7684\u53E3\u5934\u4F5C\u7B54\u662F\u5426\u6B63\u786E\u3002\u6807\u51C6\uFF1A\u8BF4\u51FA\u4E86\u5173\u952E\u8FC7\u7A0B/\u7406\u7531\u5373\u7B97\u5BF9\uFF0C\u4E0D\u82DB\u6C42\u63AA\u8F9E\u3002
\u8F93\u51FA {"correct":true/false,"feedback":"...","board":"\u7B54\u5BF9\u65F6\u5199\u4E00\u53E5\u677F\u4E66\u7ED3\u8BBA\uFF08\u2264 30 \u5B57\uFF09\uFF0C\u7B54\u9519\u4E3A\u7A7A"}
feedback \u8981\u6C42\uFF08\u603B\u957F \u2264 120 \u5B57\uFF09\uFF1A
- \u7B54\u5BF9\uFF1A\u5148\u4E00\u53E5\u5F88\u77ED\u7684\u80AF\u5B9A\uFF0C\u5F00\u5934\u4ECE\u8FD9\u4E9B\u91CC\u9009\u4E00\u4E2A\uFF1A${openings().map((o) => `\u300C${o}\u300D`).join("")}${p.prevOpening ? `\uFF0C\u4F46\u4E0D\u80FD\u7528\u4E0A\u4E00\u6B21\u53CD\u9988\u7684\u5F00\u5934\u300C${p.prevOpening}\u300D` : ""}\uFF1B\u518D\u7528 1\u20132 \u53E5\u89E3\u91CA\u4E3A\u4EC0\u4E48\u5BF9\u3001\u8865\u4E00\u4E2A\u5173\u952E\u7EC6\u8282\u3002
- \u987A\u5E26\u70B9\u540D\u4E00\u4E2A\u5E38\u89C1\u9519\u8BEF\uFF08PRD F5.2\uFF09\uFF1A\u7528\u81EA\u7136\u7684\u8BF4\u6CD5\uFF0C\u4ECE\u8FD9\u4E9B\u91CC\u6311\u4E00\u79CD\u6216\u81EA\u5DF1\u6362\u8BF4\u6CD5\uFF1A${errorPhrases().map((o) => `\u300C${o}\u300D`).join("")}\uFF1B\u4E0D\u8981\u5957\u7528\u300C\u5F88\u591A\u4EBA\u4F1A\u8BEF\u4EE5\u4E3A\u2026\u2026\u4F46\u4F60\u2026\u2026\u300D\u8FD9\u4E2A\u56FA\u5B9A\u53E5\u5F0F\u3002
- \u7B54\u9519\uFF1A\u4E00\u53E5\u6E29\u548C\u7684\u56DE\u5E94 + \u6307\u51FA\u7F3A\u4E86\u54EA\u4E00\u6B65 + \u4E00\u4E2A\u63D0\u793A\uFF0C\u4E0D\u8981\u76F4\u63A5\u7ED9\u5B8C\u6574\u7B54\u6848\u3002`,
    `\u9898\u76EE\uFF1A${p.prompt}
\u53C2\u8003\u8981\u70B9\uFF1A${p.expected}
\u5E38\u89C1\u9519\u8BEF\uFF1A${p.commonError}
\u5B66\u751F\u4F5C\u7B54\uFF1A${p.answer}${p.parts && p.parts > 1 ? `
\uFF08\u8FD9\u662F\u5B66\u751F\u5206 ${p.parts} \u6BB5\u8BF4\u5B8C\u7684\u540C\u4E00\u6B21\u4F5C\u7B54\uFF0C\u5DF2\u6309\u987A\u5E8F\u62FC\u5728\u4E00\u8D77\uFF0C\u8BF7\u6574\u4F53\u5224\u65AD\uFF0C\u4E0D\u8981\u53EA\u770B\u6700\u540E\u4E00\u6BB5\uFF09` : ""}${contextBlock(p.history)}`,
    (v) => typeof v?.correct === "boolean" && v.feedback ? null : "\u7F3A\u5B57\u6BB5",
    { maxTokens: 600 }
  );
  r.feedback = dedupeOpening(r.feedback, p.prevOpening);
  return r;
}
var askChunkList = (chunks) => chunks.map((c) => c.line_start ? `[${c.id}] (${(c.heading ?? "").split(" \xB7 ")[0]} L${c.line_start}\u2013${c.line_end})
${c.text}` : `[${c.id}] ${c.text}`).join("\n") || "\uFF08\u65E0\uFF09";
async function answerAsk(p) {
  if (!hasLLM()) {
    const best = p.chunks.map((c) => ({ c, s: scoreOverlap(p.question, c.text) })).sort((a, b) => b.s - a.s)[0];
    if (best && best.s > 0.1) {
      const sent = sentences(best.c.text).sort((a, b) => scoreOverlap(p.question, b) - scoreOverlap(p.question, a))[0] ?? best.c.text;
      return { text: `\u597D\u95EE\u9898\u3002\u6750\u6599\u91CC\u662F\u8FD9\u6837\u8BF4\u7684\uFF1A${sent} \u7ED3\u5408\u521A\u624D\u8BB2\u7684\u300C${shorten(p.currentText, 20)}\u300D\uFF0C\u4F60\u53EF\u4EE5\u628A\u5B83\u7406\u89E3\u4E3A\u540C\u4E00\u4EF6\u4E8B\u7684\u53E6\u4E00\u9762\u3002\u6211\u4EEC\u56DE\u5230\u521A\u624D\u7684\u4F4D\u7F6E\u7EE7\u7EED\u3002`, citeChunkIds: [best.c.id] };
    }
    return { text: `\u597D\u95EE\u9898\u3002\uFF08\u6F14\u793A\u6A21\u5F0F\uFF1A\u672A\u63A5\u5165\u6A21\u578B\uFF0C\u6750\u6599\u4E2D\u4E5F\u6CA1\u627E\u5230\u76F4\u63A5\u76F8\u5173\u7684\u6BB5\u843D\uFF09\u8FD9\u4E2A\u95EE\u9898\u6211\u5148\u8BB0\u4E0B\uFF0C\u8BB2\u5B8C\u8FD9\u4E00\u6BB5\u6211\u4EEC\u518D\u56DE\u5934\u770B\u3002`, citeChunkIds: [] };
  }
  return chatJSON(
    `\u4F60\u662F\u6B63\u5728\u4E0A\u767D\u677F\u8BFE\u7684\u8001\u5E08\uFF0C\u5B66\u751F\u6253\u65AD\u63D0\u95EE\u3002\u5B66\u751F\u7684\u95EE\u9898\u5E38\u6765\u81EA\u8BED\u97F3\u8BC6\u522B\uFF0C\u53EF\u80FD\u6709\u540C\u97F3 / \u8FD1\u97F3\u9519\u5B57\u6216\u6F0F\u6389\u672B\u5C3E\u4E00\u4E24\u4E2A\u5B57\uFF1A\u6309\u672C\u8282\u5185\u5BB9\u7406\u89E3\u5B66\u751F\u60F3\u95EE\u4EC0\u4E48\u518D\u56DE\u7B54\uFF0C\u4E0D\u8981\u6307\u51FA\u6216\u590D\u8FF0\u539F\u8BDD\u91CC\u7684\u9519\u5B57\u3002\u7528 2\u20135 \u53E5\u8BDD\u56DE\u7B54\uFF0C\u8D34\u5408\u5F53\u524D\u8BB2\u89E3\u4F4D\u7F6E\uFF1B\u5F15\u7528\u53EA\u80FD\u4ECE\u7247\u6BB5\u4E2D\u9009 chunk id\uFF1B\u6700\u540E\u4E00\u53E5\u81EA\u7136\u5730\u628A\u8BDD\u9898\u5E26\u56DE\u521A\u624D\u7684\u8BB2\u89E3\u3002\u8F93\u51FA {"text":"...","citeChunkIds":["..."]}${p.memory ? `

${p.memory}` : ""}`,
    `\u8BFE\u8282\uFF1A${p.lessonTitle}
\u5F53\u524D\u8BB2\u5230\uFF1A${p.currentText}
\u5B66\u751F\u63D0\u95EE\uFF1A${p.question}
\u7247\u6BB5\uFF1A
${p.chunks.map((c) => `[${c.id}] ${c.text}`).join("\n")}${contextBlock(p.history)}`,
    (v) => typeof v?.text === "string" ? null : "\u7F3A text",
    { maxTokens: 800 }
  );
}
function looksComplex(q) {
  return /为什么|区别|不同|怎么|如何|原理|步骤|流程|对比|比较|关系|过程|举例|例子/.test(q) || q.replace(/\s/g, "").length > 24;
}
async function* answerAskStream(p, signal) {
  if (p.reexplain) {
    yield* reexplainStream({ ...p, reexplain: p.reexplain }, signal);
    return;
  }
  if (!hasLLM()) {
    const base = await answerAsk(p);
    if (!looksComplex(p.question)) {
      yield { type: "mode", mode: "simple" };
      yield { type: "seg", seg: { say: base.text, citeChunkIds: base.citeChunkIds } };
      return;
    }
    yield { type: "mode", mode: "board", title: shorten(p.question.replace(/[？?。]$/, ""), 12) };
    const steps = ["\u5148\u6293\u4F4F\u95EE\u9898\u7684\u5173\u952E", "\u518D\u770B\u5B83\u548C\u521A\u624D\u5185\u5BB9\u7684\u8054\u7CFB", "\u6700\u540E\u8BB0\u4F4F\u4E00\u53E5\u8BDD\u7ED3\u8BBA"];
    for (let k = 0; k < steps.length; k++) {
      yield { type: "seg", seg: { say: k === 0 ? base.text : `\u7B2C ${k + 1} \u70B9\uFF1A${steps[k]}\u3002\uFF08\u6F14\u793A\u6A21\u5F0F\uFF1A\u63A5\u5165\u6A21\u578B\u540E\u8FD9\u91CC\u4F1A\u8FB9\u8BB2\u8FB9\u5199\u771F\u5B9E\u5185\u5BB9\uFF09`, board: { kind: "list", figId: "qa", title: "\u7B54\u7591\u8981\u70B9", items: steps.slice(0, k + 1) } } };
    }
    yield { type: "seg", seg: { say: "\u597D\uFF0C\u6211\u4EEC\u56DE\u5230\u521A\u624D\u7684\u8BB2\u89E3\u7EE7\u7EED\u3002" } };
    return;
  }
  const sys = `\u4F60\u662F\u6B63\u5728\u4E0A\u767D\u677F\u8BFE\u7684\u8001\u5E08\uFF0C\u5B66\u751F\u6253\u65AD\u63D0\u95EE\u3002\u5B66\u751F\u7684\u95EE\u9898\u5E38\u6765\u81EA\u8BED\u97F3\u8BC6\u522B\uFF0C\u53EF\u80FD\u6709\u540C\u97F3 / \u8FD1\u97F3\u9519\u5B57\u6216\u6F0F\u6389\u672B\u5C3E\u4E00\u4E24\u4E2A\u5B57\uFF1A\u6309\u672C\u8282\u5185\u5BB9\u7406\u89E3\u5B66\u751F\u60F3\u95EE\u4EC0\u4E48\u518D\u56DE\u7B54\uFF0C\u4E0D\u8981\u6307\u51FA\u6216\u590D\u8FF0\u539F\u8BDD\u91CC\u7684\u9519\u5B57\u3002\u5148\u5224\u65AD\u95EE\u9898\u590D\u6742\u5EA6\uFF0C\u518D\u56DE\u7B54\uFF1A
- \u7B80\u5355\uFF08\u4E8B\u5B9E\u3001\u5B9A\u4E49\u3001\u662F\u975E\u3001\u4E00\u4E24\u53E5\u8BDD\u80FD\u8BF4\u6E05\uFF09\uFF1A\u7B2C 1 \u884C\u8F93\u51FA {"mode":"simple"}\uFF1B\u7B2C 2 \u884C\u8F93\u51FA {"say":"2\u20134 \u53E5\u53E3\u8BED\u5316\u56DE\u7B54\uFF0C\u6700\u540E\u4E00\u53E5\u81EA\u7136\u5730\u628A\u8BDD\u9898\u5E26\u56DE\u521A\u624D\u7684\u8BB2\u89E3","citeChunkIds":[]}
- \u590D\u6742\uFF08\u9700\u8981\u5BF9\u6BD4\u3001\u6B65\u9AA4\u3001\u539F\u7406\u3001\u7ED3\u6784\u3001\u4E3E\u4F8B\u63A8\u6F14\u624D\u8BB2\u5F97\u6E05\uFF09\uFF1A\u7B2C 1 \u884C\u8F93\u51FA {"mode":"board","title":"\u2264 12 \u5B57\u7684\u7B54\u7591\u5C0F\u6807\u9898"}\uFF1B\u4E4B\u540E\u6BCF\u884C\u4E00\u6BB5 {"say":"\u2264 60 \u5B57\u53E3\u64AD","board":{...},"citeChunkIds":[]}\uFF0C\u5171 3\u20135 \u6BB5\u3002
  \u8FB9\u8BB2\u8FB9\u5199\uFF1A\u6BCF\u6BB5\u81F3\u591A\u4E00\u4E2A\u677F\u4E66\uFF0C\u8BB2\u5230\u54EA\u5199\u5230\u54EA\uFF1B\u4F18\u5148\u7ED3\u6784\u5316\u677F\u4E66\uFF08\u5BF9\u6BD4 \u2192 table\uFF0C\u6B65\u9AA4 \u2192 flowchart\uFF0C\u5305\u542B\u5173\u7CFB \u2192 nest\uFF0C\u5206\u5C42 \u2192 arch\uFF1B\u95EE\u5230\u5177\u4F53\u4EE3\u7801\u3001\u547D\u4EE4\u3001\u62A5\u9519\u3001\u600E\u4E48\u5199 \u2192 code \u4EE3\u7801\u677F\u4E66\uFF09\uFF0C\u4E5F\u53EF\u4EE5\u7528\u540C\u4E00 figId \u9010\u6761\u8FFD\u52A0 list / table\uFF1B\u4E0D\u8981\u7528 html \u52A8\u753B\u3001\u4E0D\u8981\u7528 image\u3002\u6700\u540E\u4E00\u6BB5\u53EA\u8BF4\u8BDD\u3001\u4E0D\u5199\u677F\u4E66\uFF0C\u628A\u8BDD\u9898\u5E26\u56DE\u521A\u624D\u7684\u8BB2\u89E3\u3002
\u5F15\u7528\u53EA\u80FD\u4ECE\u7ED9\u51FA\u7684\u7247\u6BB5\u91CC\u9009 chunk id\uFF0C\u6CA1\u6709\u4F9D\u636E\u5C31\u7559\u7A7A\u6570\u7EC4\u3002\u53EA\u8F93\u51FA JSON Lines\uFF08\u6BCF\u884C\u4E00\u4E2A\u5B8C\u6574 JSON \u5BF9\u8C61\uFF09\uFF0C\u4E0D\u8981 Markdown\u3001\u4E0D\u8981\u5176\u4ED6\u6587\u5B57\u3002
${BOARD_SPEC}${p.memory ? `

${p.memory}` : ""}`;
  const user = `\u8BFE\u8282\uFF1A${p.lessonTitle}
\u5F53\u524D\u8BB2\u5230\uFF1A${p.currentText}
\u5B66\u751F\u63D0\u95EE\uFF1A${p.question}
\u7247\u6BB5\uFF1A
${askChunkList(p.chunks)}${contextBlock(p.history)}`;
  yield* parseLiveStream(chatStream([{ role: "system", content: sys }, { role: "user", content: user }], { maxTokens: 2e3, temperature: 0.5 }, signal));
}
async function* reexplainStream(p, signal) {
  if (!hasLLM()) {
    yield { type: "mode", mode: "board", title: shorten(`\u6362\u4E2A\u65B9\u5F0F\u8BB2\uFF1A${p.reexplain.focus}`, 14) };
    const pts = ["\u5148\u7528\u4E00\u4E2A\u751F\u6D3B\u91CC\u7684\u6BD4\u65B9", "\u518D\u5BF9\u7167\u521A\u624D\u8BB2\u7684\u539F\u8BDD", "\u6700\u540E\u7528\u4E00\u53E5\u8BDD\u6536\u4F4F"];
    for (let k = 0; k < pts.length; k++) yield { type: "seg", seg: { say: `${k === 0 ? `\u6211\u4EEC\u6362\u4E2A\u65B9\u5F0F\u8BB2\u300C${shorten(p.reexplain.focus, 16)}\u300D\u3002` : ""}${pts[k]}\u3002\uFF08\u6F14\u793A\u6A21\u5F0F\uFF1A\u63A5\u5165\u6A21\u578B\u540E\u8FD9\u91CC\u662F\u771F\u5B9E\u7684\u91CD\u8BB2\uFF09`, board: { kind: "list", figId: "re", title: "\u6362\u4E2A\u65B9\u5F0F\u7406\u89E3", items: pts.slice(0, k + 1) } } };
    yield { type: "seg", seg: { say: "\u8FD9\u6837\u6E05\u695A\u4E00\u70B9\u4E86\u5417\uFF1F\u8FD8\u6709\u4E0D\u61C2\u7684\u968F\u65F6\u8BF4\uFF0C\u6211\u4EEC\u63A5\u7740\u5F80\u4E0B\u8BB2\u3002" } };
    return;
  }
  const sys = `\u4F60\u662F\u6B63\u5728\u4E0A\u767D\u677F\u8BFE\u7684\u8001\u5E08\u3002\u5B66\u751F\u8BF4\u300C\u6CA1\u542C\u61C2\u300D\u4E0B\u9762\u8FD9\u90E8\u5206\u5185\u5BB9\u3002\u8BF7\u6362\u4E00\u4E2A\u89D2\u5EA6\u91CD\u65B0\u8BB2\uFF1A\u6362\u4E00\u4E2A\u6BD4\u55BB\uFF0C\u6216\u4E3E\u4E00\u4E2A\u66F4\u8D34\u8FD1\u5B66\u751F\u7684\u5177\u4F53\u4F8B\u5B50\uFF0C\u5FC5\u8981\u65F6\u62C6\u6210\u66F4\u5C0F\u7684\u6B65\u9AA4\uFF1B\u4E0D\u8981\u628A\u539F\u8BDD\u518D\u8BF4\u4E00\u904D\uFF0C\u4E5F\u4E0D\u8981\u8BF4\u300C\u6211\u518D\u8BB2\u4E00\u904D\u300D\u3002
\u5FC5\u987B\u8FB9\u8BB2\u8FB9\u5199\uFF1A\u7B2C 1 \u884C\u8F93\u51FA {"mode":"board","title":"\u2264 12 \u5B57\u7684\u5C0F\u6807\u9898"}\uFF1B\u4E4B\u540E\u6BCF\u884C\u4E00\u6BB5 {"say":"\u2264 60 \u5B57\u53E3\u64AD","board":{...},"citeChunkIds":[]}\uFF0C\u5171 3\u20135 \u6BB5\uFF0C\u6BCF\u6BB5\u81F3\u591A\u4E00\u4E2A\u677F\u4E66\uFF0C\u8BB2\u5230\u54EA\u5199\u5230\u54EA\uFF08\u7ED3\u6784\u5316\u4F18\u5148\uFF0C\u53EF\u7528\u540C\u4E00 figId \u9010\u6761\u8FFD\u52A0 list / table\uFF1B\u4E0D\u8981\u7528 html \u52A8\u753B\u3001\u4E0D\u8981\u7528 image\uFF09\u3002
\u6700\u540E\u4E00\u6BB5\u53EA\u8BF4\u8BDD\u3001\u4E0D\u5199\u677F\u4E66\uFF1A\u8F7B\u8F7B\u786E\u8BA4\u4E00\u53E5\u300C\u8FD9\u6837\u6E05\u695A\u4E00\u70B9\u4E86\u5417\uFF1F\u300D\uFF0C\u518D\u628A\u8BDD\u9898\u5E26\u56DE\u63A5\u4E0B\u6765\u7684\u8BB2\u89E3\u3002
\u5F15\u7528\u53EA\u80FD\u4ECE\u7ED9\u51FA\u7684\u7247\u6BB5\u91CC\u9009 chunk id\uFF0C\u6CA1\u6709\u4F9D\u636E\u5C31\u7559\u7A7A\u6570\u7EC4\u3002\u53EA\u8F93\u51FA JSON Lines\uFF0C\u4E0D\u8981 Markdown\u3001\u4E0D\u8981\u5176\u4ED6\u6587\u5B57\u3002
${BOARD_SPEC}${p.memory ? `

${p.memory}` : ""}`;
  const user = `\u8BFE\u8282\uFF1A${p.lessonTitle}
\u5B66\u751F\u6CA1\u542C\u61C2\u7684\u90E8\u5206\uFF1A${p.reexplain.focus}
\u8FD9\u90E8\u5206\u8001\u5E08\u539F\u6765\u662F\u8FD9\u6837\u8BB2\u7684\uFF08\u53E3\u64AD\u4E0E\u677F\u4E66\uFF09\uFF1A
${p.reexplain.context}
\u7247\u6BB5\uFF1A
${askChunkList(p.chunks)}${contextBlock(p.history)}`;
  yield* parseLiveStream(chatStream([{ role: "system", content: sys }, { role: "user", content: user }], { maxTokens: 2e3, temperature: 0.6 }, signal));
}
async function* parseLiveStream(pieces) {
  let buf = "", mode = null, n = 0;
  const handle = function* (raw) {
    const line = raw.trim().replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
    if (!line.startsWith("{")) return;
    let v;
    try {
      v = JSON.parse(line);
    } catch {
      return;
    }
    if (!mode && (v.mode === "simple" || v.mode === "board")) {
      mode = v.mode;
      yield { type: "mode", mode, title: typeof v.title === "string" ? v.title.slice(0, 16) : void 0 };
      return;
    }
    if (typeof v.say !== "string" || !v.say.trim() || n >= 6) return;
    if (!mode) {
      mode = "simple";
      yield { type: "mode", mode };
    }
    let board;
    if (mode === "board" && v.board && typeof v.board === "object") {
      const b = v.board;
      const bad = validateBoard(b) || (b.kind === "html" || b.kind === "image" ? "\u7B54\u7591\u4E0D\u7528\u52A8\u753B / \u751F\u56FE" : null);
      if (bad) console.warn(`[ask-board] \u4E22\u5F03\u4E0D\u5408\u683C\u677F\u4E66\uFF1A${bad.slice(0, 60)}`);
      else board = b;
    }
    n++;
    yield { type: "seg", seg: { say: v.say.trim(), board, citeChunkIds: Array.isArray(v.citeChunkIds) ? v.citeChunkIds.map(String) : [] } };
  };
  for await (const piece of pieces) {
    buf += piece;
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      yield* handle(line);
    }
  }
  if (buf.trim()) yield* handle(buf);
  if (!n) throw new Error("\u6A21\u578B\u6CA1\u6709\u7ED9\u51FA\u53EF\u7528\u7684\u56DE\u7B54");
}

// src/host/api.ts
init_lang();

// ../../src/lib/gen-repair.ts
function classifyGenError(e) {
  const m = String(e?.message ?? e ?? "");
  if (/Sensitive|sensitive|敏感|content[_ ]?(policy|filter|risk)|RiskControl|risk_control|审核不通过|违规/.test(m)) return "sensitive";
  if (/自检不合格|文字有错|与知识点不符|图中有文字/.test(m)) return "quality";
  if (/timeout|timed out|aborted|ECONN|ETIMEDOUT|EAI_AGAIN|socket|fetch failed|network|\b429\b|\b50[0-9]\b|rate.?limit|overload|busy|Too Many/i.test(m)) return "transient";
  return "other";
}
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function backoffMs(attempt) {
  const scale = Number(process.env.GEN_RETRY_SCALE ?? 1);
  return (attempt <= 1 ? 2e3 : 6e3) * (Number.isFinite(scale) ? scale : 1);
}
var RISKY = [
  [/光着(身子|膀子)?|赤裸|裸露|裸体|没穿衣服|不穿衣服/g, "\u7A7F\u7740\u65E5\u5E38\u8863\u670D"],
  [/血(腥|淋淋)?|流血|受伤/g, "\u72FC\u72C8"],
  [/打(人|架)|揍|殴打|暴打/g, "\u4E89\u6267"],
  [/枪|刀|炸(弹|药)|爆炸/g, "\u9053\u5177"],
  [/死(了|亡)?|自杀|杀/g, "\u5D29\u6E83"],
  [/毒品|吸毒|赌博|赌/g, "\u574F\u4E60\u60EF"],
  [/警察|公安|政府|领导人|国家/g, "\u7BA1\u7406\u5458"],
  [/性感|暴露|内衣|亲吻/g, "\u53EF\u7231"]
];
function neutralizeByRules(text2) {
  let t = text2;
  for (const [re, to] of RISKY) t = t.replace(re, to);
  return t;
}
async function neutralize(texts, purpose) {
  const ruled = texts.map(neutralizeByRules);
  try {
    const { chatJSON: chatJSON2, hasLLM: hasLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
    if (!hasLLM2()) return ruled;
    const r = await chatJSON2(
      `\u4F60\u5728\u4E3A${purpose}\u6539\u5199\u6587\u5B57\u3002\u4E0B\u9762\u8FD9\u4E9B\u53E5\u5B50\u4EA4\u7ED9\u56FE\u50CF\u751F\u6210\u670D\u52A1\u65F6\u88AB\u5185\u5BB9\u5B89\u5168\u62E6\u622A\u4E86\u3002\u8BF7\u9010\u53E5\u6539\u5199\u6210\u66F4\u4E2D\u6027\u3001\u6E29\u548C\u3001\u9002\u5408\u6240\u6709\u5E74\u9F84\u7684\u8BF4\u6CD5\uFF1A\u4FDD\u6301\u539F\u6765\u7684\u610F\u601D\u548C\u957F\u5EA6\uFF0C\u53BB\u6389\u4EFB\u4F55\u53EF\u80FD\u6D89\u53CA\u8EAB\u4F53\u88F8\u9732\u3001\u66B4\u529B\u3001\u5371\u9669\u7269\u54C1\u3001\u653F\u6CBB\u3001\u8FDD\u6CD5\u6216\u6210\u4EBA\u5185\u5BB9\u7684\u5B57\u773C\uFF1B\u4E0D\u8981\u52A0\u65B0\u5185\u5BB9\u3002`,
      `${ruled.map((t, i) => `${i + 1}. ${t}`).join("\n")}

\u8F93\u51FA JSON\uFF1A{"texts":[\u2026\u4E0E\u539F\u53E5\u4E00\u4E00\u5BF9\u5E94\u2026]}`,
      (v) => {
        const x = v.texts;
        if (!Array.isArray(x) || x.length !== texts.length) return `texts \u5FC5\u987B\u6B63\u597D ${texts.length} \u53E5`;
        if (x.some((s, i) => typeof s !== "string" || !s.trim() || s.length > Math.max(20, texts[i].length * 1.6))) return "\u6BCF\u53E5\u4E0D\u80FD\u4E3A\u7A7A\uFF0C\u4E5F\u4E0D\u8981\u6BD4\u539F\u53E5\u957F\u592A\u591A";
        return null;
      },
      { maxTokens: 800 }
    );
    return r.texts.map((t) => neutralizeByRules(t.trim()));
  } catch {
    return ruled;
  }
}
var REFS = {
  comic: {
    present: (s) => s.board?.kind === "image" && !!s.board.imageId,
    mention: (s) => !!s.panel || /这(幅|张)(漫画|配图)|第\s*[一二三四1-4]\s*格|左格|右格|看(这|下面这)?(幅|张)?漫画/.test(s.text),
    label: "\u6F2B\u753B"
  },
  anim: {
    present: (s) => s.board?.kind === "html" && s.board.variant !== "game" && !!s.board.htmlId,
    mention: (s) => /(这个|下面这个|看这个|打开这个|拖动|拖一拖|点一下)(概念)?动画|动画里|滑块/.test(s.text),
    label: "\u6982\u5FF5\u52A8\u753B"
  }
};
function orphanRefs(steps, kind) {
  const ref = REFS[kind];
  const has = /* @__PURE__ */ new Set();
  for (const s of steps) if (s.type === "say" && ref.present(s)) has.add(s.kp ?? -1);
  const out = /* @__PURE__ */ new Map();
  for (const s of steps) {
    if (s.type !== "say") continue;
    const k = s.kp ?? -1;
    if (has.has(k) || !ref.mention(s)) continue;
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(s);
  }
  return out;
}
function auditLesson(l) {
  const issues = [];
  for (const kind of Object.keys(REFS)) for (const [kp, says] of orphanRefs(l.steps, kind)) issues.push({ kind, kp, count: says.length });
  return issues;
}
function stripRefs(text2, kind) {
  let t = text2;
  if (kind === "comic") {
    t = t.replace(/(先|再|最后)?看(看)?(这|下面这|上面这)?(幅|张)(漫画|图|配图)[，。！,!：:]?/g, "").replace(/^(第\s*[一二三四1-4]\s*格|左格|右格|中间那?格|最后一格|上一格|下一格)(里|中|上)?[，,：:]?\s*/g, "").replace(/(第\s*[一二三四1-4]\s*格|左格|右格|最后一格)(里|中)?/g, "").replace(/画面(里|上|中)的?那?/g, "").replace(/漫画(里|中)的?/g, "");
  } else {
    t = t.replace(/(先|再)?(看|打开|玩)(一下)?(这个|下面这个)?(概念)?动画[，。！,!：:]?/g, "").replace(/(拖动|拖一拖)(一下)?滑块[，,]?/g, "").replace(/动画(里|中)的?/g, "");
  }
  t = t.replace(/^[，,。、\s]+/, "").trim();
  return t.length >= 4 ? t : "\u5148\u770B\u4E00\u4E2A\u5177\u4F53\u7684\u60C5\u51B5\u3002";
}
var rewriteWithLLM = async ({ kind, kpTitle, texts }) => {
  const { chatJSON: chatJSON2, hasLLM: hasLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
  if (!hasLLM2()) return null;
  const label = REFS[kind].label;
  const r = await chatJSON2(
    `\u4F60\u662F\u767D\u677F\u8BFE\u7684\u8BB2\u7A3F\u7F16\u8F91\u3002\u4E0B\u9762\u51E0\u53E5\u53E3\u64AD\u539F\u672C\u662F\u5BF9\u7740\u767D\u677F\u4E0A\u7684\u4E00\u4E2A${label}\u8BB2\u7684\uFF0C\u4F46\u8FD9\u4E2A${label}\u6CA1\u80FD\u663E\u793A\u3002\u8BF7\u9010\u53E5\u6539\u5199\u6210\u4E0D\u4F9D\u8D56\u5B83\u4E5F\u80FD\u542C\u61C2\u7684\u8BB2\u6CD5\uFF1A\u53BB\u6389\u300C\u7B2C\u4E00\u683C\u300D\u300C\u753B\u9762\u91CC\u7684 X\u300D\u300C\u770B\u8FD9\u5E45\u6F2B\u753B\u300D\u300C\u62D6\u52A8\u6ED1\u5757\u300D\u300C\u770B\u8FD9\u4E2A\u52A8\u753B\u300D\u8FD9\u7C7B\u6307\u5411\u5B83\u7684\u8BF4\u6CD5\uFF0C\u628A\u5B83\u8868\u8FBE\u7684\u60C5\u8282\u6216\u89C4\u5F8B\u76F4\u63A5\u8BB2\u51FA\u6765\uFF1B\u4FDD\u6301\u539F\u610F\u3001\u53E3\u8BED\u3001\u6BCF\u53E5 \u2264 80 \u5B57\uFF0C\u53E5\u6570\u4E0D\u53D8\u3002`,
    `\u77E5\u8BC6\u70B9\uFF1A${kpTitle}
\u539F\u53E5\uFF1A
${texts.map((t, i) => `${i + 1}. ${t}`).join("\n")}

\u8F93\u51FA JSON\uFF1A{"texts":["\u6539\u5199\u540E\u7684\u7B2C 1 \u53E5", \u2026]}`,
    (v) => {
      const x = v.texts;
      if (!Array.isArray(x) || x.length !== texts.length) return `texts \u5FC5\u987B\u6B63\u597D ${texts.length} \u53E5`;
      if (x.some((s) => typeof s !== "string" || s.trim().length < 4 || s.length > 120)) return "\u6BCF\u53E5 4\u2013120 \u5B57";
      if (x.some((s) => REFS[kind].mention({ type: "say", text: String(s) }))) return `\u8FD8\u6709\u6307\u5411${label}\u7684\u8BF4\u6CD5\uFF0C\u8981\u53BB\u6389`;
      return null;
    },
    { maxTokens: 800 }
  );
  return r.texts;
};
async function fixOrphanNarration(l, kind, rewrite = rewriteWithLLM) {
  let n = 0;
  for (const [k, says] of orphanRefs(l.steps, kind)) {
    let out = null;
    try {
      out = await rewrite({ kind, kpTitle: l.sections?.[k] ?? "", texts: says.map((s) => s.text) });
    } catch {
    }
    says.forEach((s, i) => {
      s.text = out?.[i]?.trim() || stripRefs(s.text, kind);
      delete s.panel;
      n++;
    });
  }
  return n;
}
function stripOrphanRefs(l) {
  const fix = /* @__PURE__ */ new Map();
  for (const kind of Object.keys(REFS)) for (const says of orphanRefs(l.steps, kind).values()) for (const s of says) fix.set(s, kind);
  if (!fix.size) return l;
  return { ...l, steps: l.steps.map((s) => {
    const kind = fix.get(s);
    if (!kind || s.type !== "say") return s;
    const { panel: _p, ...rest } = s;
    void _p;
    return { ...rest, text: stripRefs(s.text, kind) };
  }) };
}

// src/host/api.ts
init_store();
init_llm();

// ../../src/lib/voice.ts
var VOICES = [
  { id: "zh_female_xiaohe_uranus_bigtts", label: "\u5C0F\u4F55", gender: "female", resource: "seed-tts-2.0", desc: "\u5973\u58F0 \xB7 \u4EB2\u5207\u8010\u5FC3\uFF0C\u50CF\u5B66\u59D0\u7ED9\u4F60\u8BB2\u9898" },
  { id: "zh_male_liufei_uranus_bigtts", label: "\u5218\u98DE", gender: "male", resource: "seed-tts-2.0", desc: "\u7537\u58F0 \xB7 \u8282\u594F\u7A33\u3001\u5410\u5B57\u6E05\u695A\uFF0C\u9002\u5408\u957F\u65F6\u95F4\u542C" },
  { id: "zh_male_taocheng_uranus_bigtts", label: "\u9676\u6210", gender: "male", resource: "seed-tts-2.0", desc: "\u7537\u58F0 \xB7 \u6C89\u7A33\u4E13\u4E1A\uFF0C\u50CF\u8001\u5E08\u5728\u8BB2\u53F0\u4E0A" },
  // R61 英文课程（2026-11-02 用户指定；实测 seed-tts-2.0 资源可直接合成）
  { id: "en_female_wenrouzhishijieshuonv_uranus_bigtts", label: "Ava", gender: "female", resource: "seed-tts-2.0", desc: "\u82F1\u6587\u5973\u58F0 \xB7 \u6E29\u67D4\u6E05\u6670\uFF0C\u50CF\u77E5\u8BC6\u8BB2\u89E3\u89C6\u9891\u91CC\u7684\u8001\u5E08", lang: "en" },
  { id: "ICL_uranus_en_male_kevin_mccallister_tob", label: "Kevin", gender: "male", resource: "seed-tts-2.0", desc: "\u82F1\u6587\u7537\u58F0 \xB7 \u5C11\u5E74\u97F3\uFF0C\u8F7B\u5FEB\u6709\u6D3B\u529B", lang: "en" }
];
var DEFAULT_VOICE_ID = VOICES[0].id;
var DEFAULT_VOICE_EN = "en_female_wenrouzhishijieshuonv_uranus_bigtts";
var voiceLang = (v) => v.lang ?? (/^(en_|ICL_.*_en_)/.test(v.id) ? "en" : "zh");
function resourceOfVoiceId(id) {
  return /_uranus_bigtts$|_saturn_bigtts$|^ICL_uranus_/.test(id) || !/_bigtts$/.test(id) ? "seed-tts-2.0" : "seed-tts-1.0";
}
function findVoice(id) {
  return id ? VOICES.find((v) => v.id === id) : void 0;
}

// src/host/api.ts
var json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
var fail = (code, message, status = 400) => json({ error: { code, message } }, status);
var nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
var rid = (p) => p + Math.random().toString(36).slice(2, 10);
function chatPush(sec, role, kind, text2, clientMsgId, step) {
  sec.chat.push({ id: rid("ch_"), role, kind, text: text2, created_at: nowIso(), step: Number.isInteger(step) ? step : null, ...clientMsgId ? { client_msg_id: clientMsgId } : {} });
}
var hasMsg = (sec, cid) => sec.chat.some((m) => m.client_msg_id === cid);
function classContext(sec, exclude) {
  const KEEP = /* @__PURE__ */ new Set(["ask", "answer", "check", "quiz", "check_prompt", "quiz_prompt", "say"]);
  const rows = sec.chat.slice(-60).reverse().filter((r) => KEEP.has(r.kind) && r.client_msg_id !== exclude);
  const picked = [];
  let says = 0;
  for (const r of rows) {
    if (r.kind === "say") {
      if (says >= 3) continue;
      says++;
    }
    picked.push(r);
    if (picked.length >= 14) break;
  }
  const lines = picked.reverse().map((r) => {
    const who = r.role === "user" ? "\u5B66\u751F" : "\u8001\u5E08";
    const tag = r.kind === "say" ? "\uFF08\u8BB2\u89E3\uFF09" : r.kind === "check_prompt" ? "\uFF08\u68C0\u67E5\u9898\uFF09" : r.kind === "quiz_prompt" ? "\uFF08\u5FEB\u6D4B\uFF09" : r.kind === "check" ? "\uFF08\u4F5C\u7B54\uFF09" : r.kind === "quiz" ? "\uFF08\u5FEB\u6D4B\u9009\u62E9\uFF09" : "";
    const text2 = r.text.replace(/\[[^\]|]+\|[^\]|]+\|\d+\]/g, "").replace(/\s+/g, " ").trim();
    return `${who}${tag}\uFF1A${text2.length > 160 ? text2.slice(0, 160) + "\u2026" : text2}`;
  });
  let out = lines.join("\n");
  while (out.length > 2400 && lines.length > 2) {
    lines.shift();
    out = lines.join("\n");
  }
  return out;
}
function publicLesson(l, sid) {
  l = stripOrphanRefs(l);
  return { ...l, steps: l.steps.map((x) => {
    if (x.type === "say" && x.board?.kind === "html" && x.board.game) return { ...x, board: { ...x.board, game: publicGame(x.board.game, `${sid}:board`) } };
    return x;
  }) };
}
function sectionView(board, sec) {
  const sid = sidOf(board.id, sec.index);
  const prev = board.sections[sec.index - 1];
  const next = board.sections[sec.index + 1];
  const est = sec.lesson ? Math.min(35, Math.max(10, Math.round(sec.lesson.steps.reduce((a, s) => a + (s.type === "say" ? s.text.length : s.type === "check" || s.type === "quiz" ? s.prompt.length : 0), 0) / 220 + 6))) : 20;
  return {
    id: sid,
    title: sec.title,
    contentStatus: sec.lesson ? "ready" : "generating",
    estMinutes: est,
    depth: [],
    lesson: sec.lesson ? publicLesson(sec.lesson, sid) : null,
    progress: sec.progress ? { state: sec.progress.state, step: sec.progress.step, objectives: sec.progress.objectives, completed: sec.progress.completed, interrupts: sec.progress.interrupts } : null,
    chat: sec.chat.map(({ client_msg_id: _c, ...m }) => m),
    qaBoards: sec.qaBoards,
    fee: { amount: 0, charged: true },
    lang: board.lang,
    practice: null,
    course: { id: board.id, title: board.title, pdfReading: false },
    unitTitle: void 0,
    lectureTitle: board.sections.length > 1 ? `\u7B2C ${sec.index + 1} / ${board.sections.length} \u8282` : "\u767D\u677F\u8BB2\u89E3",
    prev: prev ? { id: sidOf(board.id, prev.index), title: prev.title } : null,
    next: next ? { id: sidOf(board.id, next.index), title: next.title, contentStatus: next.lesson ? "ready" : "lazy" } : null,
    // 插件：章节切换列表
    sections: board.sections.map((s) => ({ id: sidOf(board.id, s.index), title: s.title, ready: !!s.lesson, completed: !!s.progress?.completed, current: s.index === sec.index })),
    // 同一段对话里生成的所有课（2026-11-11 用户需求：多次开讲时左上角下拉能看到、切换所有课）
    courses: boardsOfSession(board.sessionId).map((b) => ({
      id: b.id,
      title: b.title,
      current: b.id === board.id,
      sections: b.sections.map((s) => ({ id: sidOf(b.id, s.index), title: s.title, ready: !!s.lesson, completed: !!s.progress?.completed, current: b.id === board.id && s.index === sec.index }))
    })),
    embed: { boardId: board.id, learner: board.learner }
  };
}
async function readJson(req) {
  try {
    const t = await req.text();
    return t ? JSON.parse(t) : {};
  } catch {
    return {};
  }
}
function ensureWritten(host, board, sec) {
  const want = !sec.lesson ? sec : board.sections[sec.index + 1] && !board.sections[sec.index + 1].lesson ? board.sections[sec.index + 1] : null;
  if (!want) return;
  if (want.status === "requested" && want.requestedAt && Date.now() - want.requestedAt < 5 * 6e4) return;
  if (host.requestSection(board, want.index)) {
    want.status = "requested";
    want.requestedAt = Date.now();
    saveBoard(board);
  }
}
async function handleApi(host, path3, req) {
  const url = new URL(req.url);
  if (path3 === "api/me") return json(host.me());
  if (path3 === "api/tts") {
    if (req.method === "POST") return json({ ok: true });
    const text2 = url.searchParams.get("text") ?? "";
    const sref = sectionRef(url.searchParams.get("s") ?? "");
    const r = host.tts ? await host.tts(text2, url.searchParams.get("v"), sref?.board ?? null, url.searchParams.get("s")).catch(() => null) : null;
    return r ?? fail("TTS_OFF", "\u6CA1\u6709\u7ED1\u5B9A TellerU \u8D26\u53F7\u6216\u8C46\u5305\u8BED\u97F3 Key\uFF0C\u53EA\u663E\u793A\u5B57\u5E55", 503);
  }
  if (path3 === "api/asr") return json({ enabled: false });
  if (path3.startsWith("api/asr")) return fail("ASR_OFF", "\u672A\u5F00\u901A\u4E91\u7AEF\u8BED\u97F3\u8BC6\u522B", 503);
  if (path3 === "api/settings/voice") {
    const lang = url.searchParams.get("lang") === "en" ? "en" : "zh";
    if (req.method === "POST") {
      const b = await readJson(req);
      if (typeof b.voice === "string" && findVoice(b.voice)) host.setVoice?.(lang, b.voice);
      return json({ ok: true });
    }
    return json({ voice: host.voiceOf?.(lang) ?? (lang === "en" ? DEFAULT_VOICE_EN : DEFAULT_VOICE_ID), cloud: !!host.tts && host.cloud?.() === true, voices: VOICES.filter((v) => voiceLang(v) === lang) });
  }
  if (/^api\/courses\/[^/]+\/materials$/.test(path3)) return json({ materials: [] });
  if (path3.startsWith("api/lesson-image/")) {
    const r = host.image?.(path3.slice("api/lesson-image/".length));
    return r ? new Response(new Uint8Array(r.bytes), { headers: { "content-type": r.type, "cache-control": "private, max-age=86400" } }) : fail("NOT_FOUND", "\u56FE\u7247\u4E0D\u5B58\u5728", 404);
  }
  if (path3.startsWith("api/html/")) {
    const r = host.html?.(path3.slice("api/html/".length));
    return r ? json(r) : fail("NOT_FOUND", "\u52A8\u753B\u8FD8\u5728\u751F\u6210", 404);
  }
  const m = /^api\/sessions\/([^/]+)(?:\/(.+))?$/.exec(path3);
  if (!m) return fail("NOT_FOUND", "\u63A5\u53E3\u4E0D\u5B58\u5728", 404);
  const ref = sectionRef(decodeURIComponent(m[1]));
  if (!ref) return fail("NOT_FOUND", "\u8FD9\u8282\u8BB2\u89E3\u4E0D\u5B58\u5728\uFF08\u53EF\u80FD\u5DF2\u88AB\u5220\u9664\uFF09", 404);
  const { board, section: sec } = ref;
  const sub2 = m[2] ?? "";
  const sid = sidOf(board.id, sec.index);
  if (sub2 === "") {
    if (!url.searchParams.has("peek")) ensureWritten(host, board, sec);
    if (!sec.progress && sec.lesson) {
      sec.progress = { state: "loading", step: 0, objectives: [], completed: false, interrupts: 0, dwellMs: 0 };
      saveBoard(board);
    }
    return json({ session: sectionView(board, sec) });
  }
  if (sub2 === "annotations") {
    if (req.method === "PUT") {
      const b = await readJson(req);
      sec.annotations = b.annotations;
      saveBoard(board);
      return json({ ok: true });
    }
    return json({ annotations: sec.annotations ?? { v: 2, strokes: [], notes: [] } });
  }
  if (sub2 === "subs") return json({ target: board.lang === "en" ? "zh" : "en", lines: {} });
  if (sub2 === "progress") {
    const b = await readJson(req);
    const p = sec.progress ?? (sec.progress = { state: "playing", step: 0, objectives: [], completed: false, interrupts: 0, dwellMs: 0 });
    const state = String(b.state ?? "playing");
    p.step = Math.max(p.step, Number(b.step) | 0);
    if (!p.completed && ["ready", "playing", "paused", "interrupted"].includes(state)) p.state = state;
    p.dwellMs += Math.max(0, Math.min(15e3, Math.round(Number(b.dwellDeltaMs) || 0)));
    if (Array.isArray(b.objectives)) p.objectives = Array.from(new Set(b.objectives.filter((x) => Number.isInteger(x))));
    saveBoard(board);
    return json({ ok: true });
  }
  if (sub2 === "complete") {
    const p = sec.progress ?? (sec.progress = { state: "done", step: 0, objectives: [], completed: false, interrupts: 0, dwellMs: 0 });
    p.completed = true;
    p.state = "done";
    saveBoard(board);
    return json({ feeError: null, mastery: { level: 0 } });
  }
  if (sub2 === "quiz") {
    const b = await readJson(req);
    const stepIdx = Number(b.stepIdx), choice = Number(b.choice);
    const step = sec.lesson?.steps[stepIdx];
    if (!step || step.type !== "quiz") return fail("BAD_STEP", "\u8FD9\u4E00\u6B65\u4E0D\u662F\u5FEB\u6D4B");
    const skipped = choice === -1;
    if (!skipped && (!Number.isInteger(choice) || choice < 0 || choice >= step.options.length)) return fail("BAD_CHOICE", "\u9009\u9879\u4E0D\u5B58\u5728");
    const key = `${sid}:quiz:${stepIdx}`;
    if (!hasMsg(sec, key)) {
      chatPush(sec, "user", "quiz", skipped ? "\uFF08\u8DF3\u8FC7\uFF09" : step.options[choice], key, stepIdx);
      saveBoard(board);
    }
    return json({ correct: !skipped && choice === step.answer, skipped, answer: step.answer, explain: step.explain });
  }
  if (sub2 === "check") {
    const b = await readJson(req);
    const stepIdx = Number(b.stepIdx);
    const answer = String(b.answer ?? "");
    const step = sec.lesson?.steps[stepIdx];
    if (!step || step.type !== "check") return fail("BAD_STEP", "\u8FD9\u4E00\u6B65\u4E0D\u662F\u68C0\u67E5\u9898");
    if (!answer.trim()) return fail("EMPTY", "\u5148\u8BF4\u8BF4\u4F60\u7684\u601D\u8DEF");
    const bridge3 = host.bridgeFor(board);
    const prev = [...sec.chat].reverse().find((c) => c.role === "teacher" && c.kind === "answer" && !c.client_msg_id);
    const history = classContext(sec);
    chatPush(sec, "user", "check", String(b.part ?? answer).trim(), void 0, stepIdx);
    const run2 = () => withLang(board.lang, () => judgeCheck({ prompt: step.prompt, expected: step.expected, commonError: step.commonError, answer, variant: step.variant, prevOpening: prev ? feedbackOpening(prev.text) : void 0, history, parts: Number(b.parts) || void 0 }));
    const r = bridge3 ? await withBridge(bridge3, run2) : await run2();
    if (!req.signal?.aborted) chatPush(sec, "teacher", "answer", r.feedback, void 0, stepIdx);
    saveBoard(board);
    return json(r);
  }
  if (sub2 === "ask-stream" || sub2 === "ask") return askStream(host, board, sec, req);
  if (sub2 === "game/move" || sub2 === "game") {
    const b = await readJson(req);
    const step = sec.lesson?.steps[Number(b.stepIdx)];
    if (!step || step.type !== "say" || step.board?.kind !== "html" || !step.board.game) return fail("BAD_STEP", "\u8FD9\u4E00\u6B65\u4E0D\u662F\u5C0F\u6E38\u620F");
    const g2 = step.board.game;
    const runs = gameRuns.get(`${sid}:${b.stepIdx}:${b.run}`) ?? /* @__PURE__ */ new Map();
    gameRuns.set(`${sid}:${b.stepIdx}:${b.run}`, runs);
    if (sub2 === "game/move") {
      const v = judgeMove(g2, b.move);
      if (!v) return fail("BAD_MOVE", "\u8FD9\u4E00\u6B65\u4E0D\u5408\u6CD5");
      if (!runs.has(v.key)) runs.set(v.key, v.correct);
      return json(v);
    }
    const r = gradeFirstTries(g2, runs);
    const key = `${sid}:game:${b.stepIdx}`;
    if (!hasMsg(sec, key)) {
      chatPush(sec, "user", "game", r.right === r.total ? `\u5B8C\u6210\u5C0F\u6E38\u620F\u300C${step.board.title}\u300D\uFF0C\u5168\u90E8\u4E00\u6B21\u505A\u5BF9` : `\u5B8C\u6210\u5C0F\u6E38\u620F\u300C${step.board.title}\u300D\uFF0C\u4E00\u6B21\u505A\u5BF9 ${r.right}/${r.total}`, key, Number(b.stepIdx));
      saveBoard(board);
    }
    return json(r);
  }
  if (sub2 === "back-to-chat") {
    const b = await readJson(req);
    const list = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => x.slice(0, 120)).slice(0, 8) : [];
    return host.backToChat(board, sec, { summary: list(b.summary), pending: list(b.pending) }) ? json({ ok: true }) : fail("NO_AGENT", "\u5BF9\u8BDD\u5DF2\u5173\u95ED\uFF0C\u56DE\u5230\u5BF9\u8BDD\u9875\u9762\u518D\u8BD5", 409);
  }
  if (sub2 === "restore" || sub2 === "regenerate") return json({ ok: true });
  return fail("NOT_FOUND", "\u63A5\u53E3\u4E0D\u5B58\u5728", 404);
}
var gameRuns = /* @__PURE__ */ new Map();
function askStream(host, board, sec, req) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(c) {
      const emit = (e) => {
        try {
          c.enqueue(enc.encode(JSON.stringify(e) + "\n"));
        } catch {
        }
      };
      try {
        const b = await readJson(req);
        const question = String(b.question ?? "").trim();
        const clientMsgId = String(b.clientMsgId || rid("q_"));
        const stepIdx = Number(b.stepIdx) || 0;
        if (!question) throw new Error("\u8BF7\u8F93\u5165\u95EE\u9898");
        for (const cid of Array.isArray(b.replaces) ? b.replaces : []) sec.qaBoards = sec.qaBoards.filter((q) => q.id !== cid);
        const done = sec.chat.find((x) => x.client_msg_id === `${clientMsgId}:a`);
        if (done) {
          emit({ type: "mode", mode: "simple" });
          emit({ type: "seg", seg: { say: done.text } });
          emit({ type: "done", text: done.text });
          return;
        }
        const history = classContext(sec, clientMsgId);
        if (!hasMsg(sec, clientMsgId)) {
          chatPush(sec, "user", "ask", String(b.shown ?? question).trim(), clientMsgId);
          if (sec.progress) {
            sec.progress.interrupts++;
            sec.progress.state = "interrupted";
          }
        }
        const step = sec.lesson?.steps[stepIdx];
        const chunks = board.source.chunks.slice(0, 8).map((x) => ({ id: x.id, text: x.text, filename: "\u5BF9\u8BDD\u539F\u6587", material_id: "", page: 0, idx: x.idx, heading: null }));
        const re = b.reexplain && typeof b.reexplain.focus === "string" ? { focus: String(b.reexplain.focus).slice(0, 200), context: String(b.reexplain.context ?? "").slice(0, 2e3) } : void 0;
        const p = { question, lessonTitle: sec.title, currentText: step && step.type === "say" ? step.text : sec.title, chunks, reexplain: re, history };
        const segs = [];
        let mode = "simple", title = "";
        const bridge3 = host.bridgeFor(board);
        const iter = async () => {
          for await (const e of answerAskStream(p, req.signal)) {
            if (e.type === "mode") {
              mode = e.mode;
              title = e.title ?? "";
            } else {
              e.seg.say = e.seg.say.replace(/`/g, "");
              delete e.seg.citeChunkIds;
              segs.push(e.seg);
            }
            emit(e);
          }
        };
        await withLang(board.lang, () => bridge3 ? withBridge(bridge3, iter) : iter());
        const full = segs.map((x) => x.say).join("");
        chatPush(sec, "teacher", "answer", full, `${clientMsgId}:a`);
        if (mode === "board" && segs.some((x) => x.board)) sec.qaBoards.push({ id: clientMsgId, title: (title || String(b.shown ?? question)).slice(0, 40), segs, createdAt: nowIso() });
        saveBoard(board);
        emit({ type: "done", text: full });
      } catch (e) {
        emit({ type: "error", message: e.message || "\u56DE\u7B54\u5931\u8D25" });
      } finally {
        try {
          c.close();
        } catch {
        }
      }
    }
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}

// ../../src/lib/course-package/compile.ts
init_db();

// ../../src/lib/citations.ts
init_llm();
var WEB_EXCERPT_MAX = 100;
var META_LINE = /affiliation|copyright|all rights reserved|e-?mail|@|arxiv:|doi:|^(abstract|keywords|authors?)\b|版权所有|作者[:：]/i;
function webExcerpt(chunkText, claim, max = WEB_EXCERPT_MAX) {
  const sents = chunkText.split(/(?<=[.!?])\s+|(?<=[。！？；])/).map((x) => x.trim()).filter(Boolean);
  let best = sents.find((x) => !META_LINE.test(x) && x.length >= 20) ?? sents[0] ?? chunkText;
  let bestScore = -1;
  for (let i = 0; i < sents.length; i++) {
    if (META_LINE.test(sents[i])) continue;
    const cand = sents[i].length < 30 && sents[i + 1] ? `${sents[i]} ${sents[i + 1]}` : sents[i];
    const sc = scoreOverlap(claim, cand) + (cand.length >= 40 && cand.length <= 200 ? 0.01 : 0);
    if (sc > bestScore) {
      best = cand;
      bestScore = sc;
    }
  }
  return best.length > max ? best.slice(0, max - 1) + "\u2026" : best;
}
function webCitation(c, claim) {
  return {
    chunkId: c.id,
    materialId: "",
    filename: c.filename,
    page: 0,
    excerpt: webExcerpt(c.text, claim),
    coarse: false,
    kind: "web",
    url: c.url ?? "",
    sourceTitle: c.filename,
    site: c.site,
    authoritative: c.authoritative ?? true
  };
}

// ../../src/lib/course-package/compile.ts
init_textwidth();

// ../../src/lib/courses.ts
init_db();

// stub:/home/claude/stm/src/lib/project-summary.ts
var __stub5 = (n) => new Proxy(function() {
}, { apply() {
  return void 0;
}, get(t, k) {
  return k === Symbol.toPrimitive ? () => "" : k === "then" ? void 0 : __stub5(n + "." + String(k));
} });
var projectSummary = __stub5("projectSummary");

// ../../src/lib/lesson-media.ts
init_lang();

// ../../src/lib/html-assets.ts
init_db();
var HTML_LIMITS = { minChars: 300, maxChars: 6e4 };
function validateLessonHtml(html, opts = {}) {
  if (typeof html !== "string") return "\u6CA1\u6709 HTML";
  const h = html.trim();
  if (h.length < HTML_LIMITS.minChars) return "HTML \u592A\u77ED\uFF0C\u4E0D\u50CF\u4E00\u4E2A\u5B8C\u6574\u9875\u9762";
  if (h.length > HTML_LIMITS.maxChars) return `HTML \u8D85\u8FC7 ${HTML_LIMITS.maxChars} \u5B57\u7B26\uFF0C\u8BF7\u7CBE\u7B80`;
  if (!/<(html|body|div|canvas|svg)\b/i.test(h)) return "\u9700\u8981\u5B8C\u6574\u7684 HTML\uFF08\u542B body / canvas / svg \u7B49\u5143\u7D20\uFF09";
  if (!/<script\b/i.test(h) && !/<svg\b/i.test(h)) return "\u9700\u8981\u7528 script \u5B9E\u73B0\u52A8\u753B\u6216\u4EA4\u4E92";
  const banned = [
    [/<script\b[^>]*\bsrc\s*=/i, "\u4E0D\u80FD\u5F15\u7528\u5916\u90E8\u811A\u672C\uFF08script src\uFF09"],
    [/<link\b[^>]*\bhref\s*=/i, "\u4E0D\u80FD\u5F15\u7528\u5916\u90E8\u6837\u5F0F\u6216\u5B57\u4F53\uFF08link href\uFF09"],
    [/<(iframe|object|embed|form|base|meta\s+http-equiv)\b/i, "\u4E0D\u80FD\u4F7F\u7528 iframe / object / embed / form / base / meta \u8DF3\u8F6C"],
    [/@import\b/i, "CSS \u4E0D\u80FD @import"],
    [/\b(fetch|XMLHttpRequest|WebSocket|EventSource|importScripts|sendBeacon)\b/, "\u4E0D\u80FD\u53D1\u7F51\u7EDC\u8BF7\u6C42"],
    [/\bimport\s*\(/, "\u4E0D\u80FD\u52A8\u6001 import"],
    [/\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/, "\u4E0D\u80FD\u8BFB\u5199\u5B58\u50A8\u6216 cookie"],
    [/\b(window\.open|top\.location|parent\.location|location\.href\s*=)/, "\u4E0D\u80FD\u6253\u5F00\u6216\u8DF3\u8F6C\u9875\u9762"],
    [/\b(alert|confirm|prompt)\s*\(/, "\u4E0D\u80FD\u7528 alert / confirm / prompt \u5F39\u7A97"],
    [/\beval\s*\(|new\s+Function\s*\(/, "\u4E0D\u80FD\u7528 eval / new Function"]
  ];
  for (const [re, why] of banned) if (re.test(h)) return why;
  const urls = h.match(/https?:\/\/[^\s"'<>)]+/gi) ?? [];
  const bad = urls.find((u) => !/^https?:\/\/www\.w3\.org\//i.test(u));
  if (bad) return `\u4E0D\u80FD\u5F15\u7528\u5916\u90E8\u5730\u5740\uFF1A${bad.slice(0, 60)}`;
  if (opts.game) {
    if (!/TU\.check\s*\(/.test(h)) return "\u5C0F\u6E38\u620F\u6BCF\u4E00\u6B65\u90FD\u5FC5\u987B\u8C03\u7528 TU.check(\u4E00\u6B65) \u7531\u7CFB\u7EDF\u5224\u5B9A\u5BF9\u9519";
    if (!/TU\.finish\s*\(/.test(h)) return "\u5168\u90E8\u5B8C\u6210\u540E\u5FC5\u987B\u8C03\u7528 TU.finish() \u62FF\u5230\u6210\u7EE9";
    if (!/TU\.data/.test(h)) return "\u5C0F\u6E38\u620F\u5FC5\u987B\u4ECE TU.data \u8BFB\u53D6\u9898\u76EE\u6570\u636E\uFF0C\u4E0D\u8981\u628A\u9898\u76EE\u5199\u6B7B";
  }
  if (opts.dnd) {
    const usesKit = /TU\.dnd\s*\(/.test(h);
    const selfDrag = /\b(dragstart|draggable|ondrag)\b/i.test(h) || /setPointerCapture|(pointer|mouse|touch)move/i.test(h);
    if (opts.dnd === "required" && !usesKit) return "\u62D6\u653E / \u70B9\u9009\u653E\u7F6E\u5FC5\u987B\u8C03\u7528 TU.dnd({item, zone, onDrop}) \u5B9E\u73B0\uFF0C\u4E0D\u8981\u81EA\u5DF1\u5199\u62D6\u62FD";
    if (opts.dnd === "if-drag" && selfDrag && !usesKit) return "\u68C0\u6D4B\u5230\u81EA\u5199\u7684\u62D6\u62FD\u4EE3\u7801\uFF1A\u6240\u6709\u300C\u62D6\u5230 / \u653E\u8FDB\u300D\u64CD\u4F5C\u90FD\u5FC5\u987B\u6539\u7528 TU.dnd({item, zone, onDrop})\uFF0C\u5220\u6389\u81EA\u5DF1\u5199\u7684\u62D6\u62FD\u4E8B\u4EF6";
  }
  return null;
}
function extractHtml(text2) {
  const fenced = text2.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text2).trim();
  const start = body.search(/<!doctype html|<html\b/i);
  if (start >= 0) {
    const end = body.toLowerCase().lastIndexOf("</html>");
    return body.slice(start, end > start ? end + 7 : void 0).trim();
  }
  return /<(div|canvas|svg|body)\b/i.test(body) ? body : null;
}
var HTML_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'";
var DND_CSS = '.tu-item{cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;transition:transform .15s ease,box-shadow .15s ease,outline-color .15s ease}.tu-item:focus-visible{outline:3px solid rgba(31,92,77,.45)!important;outline-offset:2px}.tu-selected{outline:3px solid #1f5c4d!important;outline-offset:2px;transform:translateY(-3px)!important;box-shadow:0 12px 26px -12px rgba(31,92,77,.55)!important;background-color:#e2eee9!important;position:relative}.tu-selected::after{content:"\u5DF2\u9009\u4E2D";position:absolute;top:-10px;right:-6px;background:#1f5c4d;color:#fbfaf6;font-size:11px;line-height:1;padding:4px 7px;border-radius:999px;font-weight:600;pointer-events:none}.tu-dragging{opacity:.3!important}.tu-busy{opacity:.6;pointer-events:none}.tu-ghost{position:fixed!important;z-index:2147483647!important;pointer-events:none!important;margin:0!important;transform:rotate(-2.5deg) scale(1.04)!important;box-shadow:0 22px 44px -14px rgba(28,26,22,.5)!important;cursor:grabbing;opacity:.97}.tu-zone{transition:background-color .15s ease,outline-color .15s ease,transform .15s ease}.tu-ready{outline:2px dashed #1f5c4d!important;outline-offset:2px;background-color:rgba(31,92,77,.06)!important;cursor:pointer}.tu-over{outline:3px solid #1f5c4d!important;background-color:rgba(31,92,77,.16)!important;transform:scale(1.02)}.tu-hint{position:fixed;left:50%;bottom:12px;transform:translate(-50%,8px);max-width:calc(100vw - 32px);background:#1f5c4d;color:#fbfaf6;font:500 13px/1.4 "PingFang SC","Microsoft YaHei",system-ui,sans-serif;padding:7px 14px;border-radius:999px;box-shadow:0 8px 22px -10px rgba(28,26,22,.5);opacity:0;pointer-events:none;transition:opacity .15s,transform .15s;z-index:2147483646;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tu-hint.tu-show{opacity:1;transform:translate(-50%,0)}@media (prefers-reduced-motion:reduce){.tu-item,.tu-zone,.tu-hint{transition:none}.tu-selected,.tu-over{transform:none!important}}';
var DND_JS = String.raw`TU.dnd=function(o){o=o||{};var IS=o.item||"[data-item]",ZS=o.zone||"[data-zone]",onDrop=o.onDrop||function(){},useHint=o.hint!==false;var sel=null,busy=false,drag=null,hintEl=null;var q=function(s){return [].slice.call(document.querySelectorAll(s))};var up=function(t,s){return t&&t.closest?t.closest(s):null};var live=function(el){return el&&el.isConnected&&!el.hasAttribute("data-tu-done")&&el.getAttribute("aria-disabled")!=="true"};var prep=function(){q(IS).forEach(function(el){if(!el.hasAttribute("tabindex"))el.tabIndex=0;if(!el.hasAttribute("role"))el.setAttribute("role","button");el.classList.add("tu-item")});q(ZS).forEach(function(z){if(!z.hasAttribute("tabindex"))z.tabIndex=0;z.classList.add("tu-zone")})};var ready=function(on){q(ZS).forEach(function(z){z.classList.toggle("tu-ready",on);if(!on)z.classList.remove("tu-over")})};var say=function(t){if(!useHint)return;if(!hintEl){hintEl=document.createElement("div");hintEl.className="tu-hint";hintEl.setAttribute("role","status");document.body.appendChild(hintEl)}if(t)hintEl.textContent=t;hintEl.classList.toggle("tu-show",!!t)};var label=function(el){return(el.getAttribute("data-label")||el.textContent||"").replace(/\s+/g," ").trim().slice(0,16)};var select=function(el){if(sel){sel.classList.remove("tu-selected");sel.setAttribute("aria-pressed","false")}sel=el&&live(el)?el:null;if(sel){sel.classList.add("tu-selected");sel.setAttribute("aria-pressed","true");ready(true);say("已选中「"+label(sel)+"」· 点一个放置区放进去，或直接拖过去（Esc 取消）")}else{ready(false);say("")}};var drop=function(el,z){if(!live(el)||busy)return;busy=true;el.classList.add("tu-busy");select(null);Promise.resolve().then(function(){return onDrop(el,z)}).catch(function(){}).then(function(){busy=false;el.classList.remove("tu-busy");prep()})};var zoneAt=function(x,y){return up(document.elementFromPoint(x,y),ZS)};var ghost=function(el,r){var g=el.cloneNode(true),cs=getComputedStyle(el);g.removeAttribute("id");g.classList.remove("tu-selected","tu-dragging");g.classList.add("tu-ghost");["backgroundColor","backgroundImage","color","fontFamily","fontSize","fontWeight","lineHeight","letterSpacing","textAlign","padding","borderWidth","borderStyle","borderColor","borderRadius","boxSizing","display","alignItems","justifyContent","gap","flexDirection"].forEach(function(k){g.style[k]=cs[k]});if(cs.backgroundColor==="rgba(0, 0, 0, 0)"&&cs.backgroundImage==="none")g.style.backgroundColor="#fffdf8";g.style.width=r.width+"px";g.style.height=r.height+"px";document.body.appendChild(g);return g};addEventListener("pointerdown",function(e){if(busy||e.button>0||drag)return;var it=up(e.target,IS);if(!live(it))return;var r=it.getBoundingClientRect();drag={el:it,x0:e.clientX,y0:e.clientY,dx:e.clientX-r.left,dy:e.clientY-r.top,r:r,g:null,id:e.pointerId}},true);addEventListener("pointermove",function(e){if(!drag||e.pointerId!==drag.id)return;if(!drag.g){if(Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0)<6)return;drag.g=ghost(drag.el,drag.r);drag.el.classList.add("tu-dragging");if(sel)sel.classList.remove("tu-selected");sel=null;ready(true);say("拖到一个放置区上松手")}e.preventDefault();drag.g.style.left=e.clientX-drag.dx+"px";drag.g.style.top=e.clientY-drag.dy+"px";var z=zoneAt(e.clientX,e.clientY);q(ZS).forEach(function(x){x.classList.toggle("tu-over",x===z)})},{passive:false,capture:true});var end=function(e){if(!drag||e.pointerId!==drag.id)return;var d=drag;drag=null;if(!d.g)return;var z=e.type==="pointerup"?zoneAt(e.clientX,e.clientY):null;d.g.remove();d.el.classList.remove("tu-dragging");ready(false);say("");d.el.setAttribute("data-tu-dragged","1");setTimeout(function(){d.el.removeAttribute("data-tu-dragged")},0);if(z)drop(d.el,z)};addEventListener("pointerup",end,true);addEventListener("pointercancel",end,true);addEventListener("click",function(e){var it=up(e.target,IS);if(it){if(it.hasAttribute("data-tu-dragged"))return;if(live(it)&&!busy){e.stopPropagation();select(sel===it?null:it)}return}var z=up(e.target,ZS);if(sel&&z){e.preventDefault();e.stopPropagation();drop(sel,z);return}if(sel)select(null)},true);addEventListener("keydown",function(e){if(e.key==="Escape"&&sel){select(null);return}var t=e.target;if(e.key==="Enter"||e.key===" "){var it=up(t,IS);if(live(it)){e.preventDefault();select(sel===it?null:it);return}var z=up(t,ZS);if(z&&sel){e.preventDefault();drop(sel,z);return}}if(sel&&/^[1-9]$/.test(e.key)){var z2=q(ZS)[+e.key-1];if(z2){e.preventDefault();drop(sel,z2)}}});new MutationObserver(prep).observe(document.documentElement,{childList:true,subtree:true});prep();return{select:select,clear:function(){select(null)},refresh:prep}};`;
function bridge2(data) {
  const json2 = JSON.stringify(data ?? null).replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, " ");
  return `<script>(function(){var cbs=[],wait={},seq=0;var post=function(m){try{parent.postMessage(Object.assign({tu:1},m),"*")}catch(e){}};var ask=function(type,payload){return new Promise(function(res,rej){var id=++seq;wait[id]={res:res,rej:rej};post(Object.assign({type:type,id:id},payload||{}));setTimeout(function(){if(wait[id]){delete wait[id];rej(new Error("timeout"))}},15000)})};window.TU={data:${json2},check:function(m){return ask("move",{move:m})},finish:function(){return ask("finish")},submit:function(a){post({type:"submit",answer:a})},onResult:function(cb){if(typeof cb==="function")cbs.push(cb)},done:function(){post({type:"done"})}};addEventListener("message",function(e){var m=e.data;if(!m||m.tu!==1)return;if(m.type==="reply"&&wait[m.id]){var w=wait[m.id];delete wait[m.id];m.error?w.rej(new Error(m.error)):w.res(m.result);return}if(m.type==="result"){cbs.forEach(function(cb){try{cb(m.result)}catch(_){}})}});addEventListener("error",function(e){post({type:"error",message:String(e.message||"").slice(0,200)})});var TU=window.TU;${DND_JS}})();</script><style>${DND_CSS}</style>`;
}
function wrapLessonHtml(html, data) {
  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${HTML_CSP}"><meta name="viewport" content="width=device-width,initial-scale=1">${bridge2(data)}`;
  const h = html.trim();
  if (/<head[^>]*>/i.test(h)) return h.replace(/<head[^>]*>/i, (m) => `${m}${head}`);
  if (/<html[^>]*>/i.test(h)) return h.replace(/<html[^>]*>/i, (m) => `${m}<head>${head}</head>`);
  return `<!doctype html><html><head>${head}</head><body>${h}</body></html>`;
}
function saveLessonHtml(p) {
  const id = uid("hx_").toLowerCase();
  run(
    "INSERT INTO lesson_html(id,session_id,kind,title,html,data_json,provider,created_at) VALUES(?,?,?,?,?,?,?,?)",
    id,
    p.sessionId,
    p.kind,
    p.title,
    p.html,
    p.data === void 0 ? null : JSON.stringify(p.data),
    p.provider ?? null,
    now()
  );
  return id;
}
function lessonHtml(id) {
  const r = get("SELECT * FROM lesson_html WHERE id=?", id);
  if (!r) return null;
  const data = r.data_json ? JSON.parse(r.data_json) : void 0;
  return { id: r.id, sessionId: r.session_id, kind: r.kind, title: r.title, srcdoc: wrapLessonHtml(r.html, data), legacyDrag: legacyDrag(r.kind, r.html, data) };
}
function legacyDrag(kind, html, data) {
  if (kind === "anim" || /TU\.dnd\s*\(/.test(html)) return false;
  if (kind === "practice" && data?.type === "order") return false;
  return /\b(dragstart|draggable)\b/i.test(html) || /(pointer|mouse|touch)move/i.test(html);
}

// ../../src/lib/ai/html-gen.ts
init_llm();
var STYLE = `\u89C6\u89C9\u89C4\u8303\uFF08\u4E0E TellerU \u767D\u677F\u4E00\u81F4\uFF09\uFF1A
- \u80CC\u666F #f5f2ea\uFF08\u7C73\u8272\u7EB8\uFF09\u6216 #fffdf8\uFF0C\u4E3B\u8272 \u677F\u4E66\u7EFF #1f5c4d\uFF0C\u58A8\u8272\u6587\u5B57 #1c1a16\uFF0C\u5F3A\u8C03\u9EC4 #ffd84a\uFF0C\u63D0\u793A\u6A59 #c46a1c\uFF0C\u9519\u8BEF\u7EA2 #a8402c\uFF1B\u5706\u89D2 10\u201314px\uFF0C\u7EC6\u8FB9\u6846 #e3ddcf\u3002
- \u5B57\u4F53\uFF1Afont-family: "PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif\uFF1B\u6B63\u6587 15\u201317px\uFF1B\u4E2D\u6587\u754C\u9762\u3002
- \u9875\u9762\u4F1A\u653E\u5728\u4E00\u4E2A 16:9 \u7684 iframe \u91CC\uFF08\u5BBD 640\u20131100px\uFF09\uFF0C\u7528 100vw / 100vh \u81EA\u9002\u5E94\uFF0C\u4E0D\u8981\u51FA\u73B0\u6EDA\u52A8\u6761\uFF1B\u5185\u5BB9\u5C45\u4E2D\uFF0C\u56DB\u5468\u7559\u767D 16\u201324px\u3002
- \u52A8\u6548\u5E73\u6ED1\uFF08requestAnimationFrame\uFF09\uFF0C\u4E0D\u8981\u95EA\u70C1\uFF1B\u5C0A\u91CD prefers-reduced-motion\uFF08\u51CF\u5C11\u52A8\u6548\u65F6\u76F4\u63A5\u663E\u793A\u7EC8\u6001\uFF09\u3002`;
var SAFETY = `\u786C\u6027\u7EA6\u675F\uFF08\u8FDD\u53CD\u4F1A\u88AB\u7CFB\u7EDF\u62D2\u6536\uFF09\uFF1A
- \u53EA\u8F93\u51FA\u4E00\u4E2A\u5B8C\u6574\u7684\u5355\u6587\u4EF6 HTML\uFF08<!doctype html> \u5F00\u5934\uFF09\uFF0CCSS \u5199\u5728 <style>\uFF0CJS \u5199\u5728 <script>\uFF0C\u4E0D\u5F15\u7528\u4EFB\u4F55\u5916\u90E8\u6587\u4EF6\u3001\u5B57\u4F53\u3001\u56FE\u7247\u3001CDN\u3002
- \u7981\u6B62\uFF1Afetch / XMLHttpRequest / WebSocket\u3001localStorage / sessionStorage / cookie\u3001alert / confirm / prompt\u3001eval / new Function\u3001window.open\u3001\u8DF3\u8F6C\u9875\u9762\u3001iframe / form\u3002
- \u4E0D\u8981\u5199 http:// \u6216 https:// \u5730\u5740\uFF08SVG \u547D\u540D\u7A7A\u95F4 http://www.w3.org/2000/svg \u9664\u5916\uFF09\u3002
- \u4F53\u79EF \u2264 20KB\uFF08\u7EA6 600 \u884C\u4EE5\u5185\uFF09\uFF0C\u4EE3\u7801\u7D27\u51D1\u53EF\u8BFB\uFF0C\u53D8\u91CF\u540D\u7528\u82F1\u6587\uFF1B\u4E0D\u8981\u5199\u5927\u6BB5\u6CE8\u91CA\u3002
- \u53EA\u8F93\u51FA HTML \u4EE3\u7801\u5757\uFF0C\u4E0D\u8981\u89E3\u91CA\u3002`;
var DND = `\u300C\u62D6\u5230 / \u653E\u8FDB / \u914D\u5BF9\u300D\u7C7B\u64CD\u4F5C\uFF082026-10-29 \u89C4\u8303\uFF0C\u8FDD\u53CD\u4F1A\u88AB\u7CFB\u7EDF\u62D2\u6536\uFF09\uFF1A
- \u9875\u9762\u91CC\u6709\u7CFB\u7EDF\u6CE8\u5165\u7684 TU.dnd({item, zone, onDrop})\uFF1Aitem = \u53EF\u62D6\u52A8\u5361\u7247\u7684 CSS \u9009\u62E9\u5668\uFF0Czone = \u653E\u7F6E\u533A\u7684 CSS \u9009\u62E9\u5668\uFF0ConDrop(\u5361\u7247\u5143\u7D20, \u653E\u7F6E\u533A\u5143\u7D20) \u5728\u5361\u7247\u88AB\u62D6\u5230\u6216\u70B9\u9009\u653E\u8FDB\u67D0\u4E2A\u653E\u7F6E\u533A\u65F6\u8C03\u7528\uFF08\u53EF\u8FD4\u56DE Promise\uFF09\u3002\u5B83\u5DF2\u7ECF\u5B9E\u73B0\u4E86\uFF1A\u9F20\u6807 / \u89E6\u5C4F\u62D6\u52A8\uFF08\u6D6E\u5C42\u5361\u7247\u4E0D\u4F1A\u88AB\u4EFB\u4F55\u5BB9\u5668\u88C1\u6389\uFF09\u3001\u70B9\u9009\u5361\u7247 \u2192 \u70B9\u653E\u7F6E\u533A\u3001\u952E\u76D8\u64CD\u4F5C\u3001\u9009\u4E2D\u9AD8\u4EAE\u3001\u653E\u7F6E\u533A\u9AD8\u4EAE\u3001\u5E95\u90E8\u64CD\u4F5C\u63D0\u793A\u3002
- \u6240\u6709\u62D6\u653E\u90FD\u5FC5\u987B\u7528 TU.dnd\uFF0C**\u4E0D\u8981\u81EA\u5DF1\u5199\u62D6\u62FD**\uFF08\u4E0D\u8981\u5199 draggable / dragstart / pointermove / mousemove / touchmove\uFF09\uFF0C\u4E5F\u4E0D\u8981\u7ED9\u5361\u7247\u81EA\u5DF1\u5199\u70B9\u51FB\u9009\u4E2D\u903B\u8F91\u3002\u9009\u4E2D\u3001\u60AC\u505C\u6837\u5F0F\u7531\u7CFB\u7EDF\u63D0\u4F9B\uFF08\u7C7B\u540D tu-selected / tu-ready / tu-over\uFF09\uFF0C\u4E0D\u8981\u8986\u76D6\u3002
- \u5361\u7247\u653E\u597D\u540E\u7531\u4F60\u628A\u5B83\u79FB\u8FDB\u653E\u7F6E\u533A\u6216\u6807\u6210\u5DF2\u5B8C\u6210\uFF0C\u5E76\u7ED9\u5B83\u52A0\u5C5E\u6027 data-tu-done\uFF08\u4E4B\u540E\u4E0D\u518D\u54CD\u5E94\uFF09\uFF1B\u5361\u7247\u7684 data-label \u5199\u5B83\u7684\u7B80\u77ED\u6587\u5B57\u3002
- \u5E03\u5C40\uFF1A\u5F85\u653E\u7F6E\u7684\u5361\u7247\u7528 flex-wrap \u5E73\u94FA\u6392\u6210\u4E00\u884C\u6216\u51E0\u884C\uFF0C**\u4E0D\u8981\u5806\u53E0\u3001\u91CD\u53E0\u6216\u7EDD\u5BF9\u5B9A\u4F4D\u5C42\u53E0**\uFF1B\u5361\u7247\u533A\u548C\u6240\u6709\u653E\u7F6E\u533A\u5728\u4E00\u5C4F\u5185\u540C\u65F6\u53EF\u89C1\uFF0C\u4E0D\u9700\u8981\u6EDA\u52A8\uFF1B\u653E\u7F6E\u533A\u9AD8\u5EA6 \u2265 72px\uFF0C\u6807\u9898\u5199\u6E05\u695A\u3002`;
async function writeHtml(system, user, opts = {}) {
  const messages = [{ role: "system", content: system }, { role: "user", content: user }];
  let last = "";
  for (let i = 0; i < 3; i++) {
    const raw = await chat(messages, { maxTokens: 8e3, temperature: 0.5, timeoutMs: 15e4 });
    const html = extractHtml(raw);
    const problem = html ? validateLessonHtml(html, opts) : "\u6CA1\u6709\u627E\u5230 HTML \u4EE3\u7801\u5757";
    if (!problem) return html;
    last = problem;
    messages.push({ role: "assistant", content: raw.slice(0, 12e3) }, { role: "user", content: `\u4E0A\u9762\u7684 HTML \u4E0D\u5408\u683C\uFF1A${problem}\u3002\u8BF7\u4FEE\u6B63\u540E\u91CD\u65B0\u8F93\u51FA\u5B8C\u6574 HTML\u3002` });
  }
  throw new Error(`HTML \u751F\u6210\u4E0D\u5408\u683C\uFF1A${last}`);
}
async function genAnimHtml(c) {
  if (!hasLLM()) return { html: mockAnimHtml(c.title, c.brief), provider: "mock" };
  const html = await writeHtml(
    `\u4F60\u662F\u4E00\u4F4D\u64C5\u957F\u628A\u62BD\u8C61\u6982\u5FF5\u505A\u6210\u4EA4\u4E92\u52A8\u753B\u7684\u524D\u7AEF\u5DE5\u7A0B\u5E08\u517C\u6559\u5B66\u8BBE\u8BA1\u5E08\u3002\u4E3A\u767D\u677F\u8BFE\u8282\u5199\u4E00\u4E2A\u300C\u6982\u5FF5\u6A21\u578B\u52A8\u753B\u300DHTML\uFF0C\u5E2E\u5B66\u4E60\u8005\u76F4\u89C2\u770B\u5230\u6982\u5FF5\u80CC\u540E\u7684\u673A\u5236\uFF08\u4F8B\u5982\u5F15\u529B\u968F\u8D28\u91CF\u4E0E\u8DDD\u79BB\u53D8\u5316\u3001\u6CE2\u7684\u53E0\u52A0\u3001\u68AF\u5EA6\u4E0B\u964D\u4E00\u6B65\u6B65\u903C\u8FD1\u6700\u4F4E\u70B9\u3001\u6392\u5E8F\u7B97\u6CD5\u9010\u6B65\u4EA4\u6362\uFF09\u3002
\u8981\u6C42\uFF1A
1. \u9876\u90E8\u4E00\u884C\u6807\u9898\uFF08\u5C31\u662F\u7ED9\u5B9A\u7684\u52A8\u753B\u6807\u9898\uFF09+ \u4E00\u53E5\u8BDD\u8BF4\u660E\u5728\u770B\u4EC0\u4E48\uFF1B\u4E3B\u4F53\u662F canvas \u6216 SVG \u52A8\u753B\u3002
2. \u81F3\u5C11\u63D0\u4F9B\uFF1A\u64AD\u653E/\u6682\u505C\u3001\u91CD\u7F6E\uFF1B\u4EE5\u53CA 1\u20133 \u4E2A\u53EF\u62D6\u52A8\u7684\u53C2\u6570\u6ED1\u5757\uFF08\u663E\u793A\u5F53\u524D\u6570\u503C\u548C\u5355\u4F4D\uFF09\uFF0C\u53C2\u6570\u53D8\u5316\u65F6\u52A8\u753B\u5373\u65F6\u54CD\u5E94\uFF0C\u8BA9\u5B66\u4E60\u8005\u81EA\u5DF1\u505A\u300C\u5982\u679C\u2026\u2026\u4F1A\u600E\u6837\u300D\u7684\u5B9E\u9A8C\u3002
3. \u753B\u9762\u4E0A\u6807\u51FA\u5173\u952E\u91CF\uFF08\u6570\u503C\u3001\u7BAD\u5934\u3001\u8F68\u8FF9\u3001\u516C\u5F0F\uFF09\uFF0C\u7269\u7406/\u6570\u5B66\u5173\u7CFB\u5FC5\u987B\u6B63\u786E\uFF08\u5982 F = G\xB7m1\xB7m2 / r\xB2\uFF09\uFF0C\u4E0D\u8981\u7F16\u9020\u3002
4. \u9ED8\u8BA4\u81EA\u52A8\u64AD\u653E\uFF1B10 \u79D2\u5185\u80FD\u770B\u61C2\u53D1\u751F\u4E86\u4EC0\u4E48\u3002
5. \u52A8\u753B\u53EA\u6F14\u793A\uFF0C\u4E0D\u51FA\u9898\u3001\u4E0D\u5224\u5206\u3002
${STYLE}
${SAFETY}`,
    `\u8BFE\u7A0B\uFF1A${c.courseTitle}
\u53D7\u4F17\uFF1A${c.audience || "\u5927\u5B66\u751F"}
\u8BFE\u8282\uFF1A${c.sessionTitle}
\u52A8\u753B\u6807\u9898\uFF1A${c.title}
\u8981\u6F14\u793A\u7684\u5185\u5BB9\uFF1A${c.brief}`,
    {}
  );
  return { html, provider: "llm" };
}
var GAME_SPEC_FORMAT = `\u4E09\u79CD\u73A9\u6CD5\uFF08\u9009\u6700\u9002\u5408\u672C\u8282\u5185\u5BB9\u7684\u4E00\u79CD\uFF09\uFF1A
\xB7 \u5206\u7C7B sort\uFF1A{"type":"sort","title":"\u2264 24 \u5B57","instructions":"\u2264 60 \u5B57\uFF0C\u544A\u8BC9\u5B66\u4E60\u8005\u600E\u4E48\u73A9","buckets":[{"id":"b1","label":"\u7C7B\u522B"}],"items":[{"id":"i1","label":"\u6761\u76EE","bucket":"b1"}]}\uFF082\u20134 \u4E2A\u7C7B\u522B\u30014\u201310 \u4E2A\u6761\u76EE\uFF0C\u6BCF\u4E2A\u7C7B\u522B\u81F3\u5C11 1 \u4E2A\u6761\u76EE\uFF09
\xB7 \u6392\u5E8F order\uFF1A{"type":"order","title":"\u2026","instructions":"\u2026","items":[{"id":"s1","label":"\u7B2C\u4E00\u6B65"},\u2026]}\uFF083\u20137 \u6B65\uFF0C\u6309\u6B63\u786E\u987A\u5E8F\u7ED9\u51FA\uFF0C\u7CFB\u7EDF\u4F1A\u6253\u4E71\uFF09
\xB7 \u8FDE\u7EBF match\uFF1A{"type":"match","title":"\u2026","instructions":"\u2026","pairs":[{"id":"p1","left":"\u6982\u5FF5\uFF08\u2264 24 \u5B57\uFF09","right":"\u5BF9\u5E94\u7684\u89E3\u91CA\u6216\u4F8B\u5B50\uFF08\u2264 40 \u5B57\uFF09"}]}\uFF083\u20136 \u5BF9\uFF09
id \u53EA\u7528\u5B57\u6BCD\u6570\u5B57\uFF1Blabel \u7B80\u77ED\u3001\u4E0D\u91CD\u590D\uFF1B\u6BCF\u4E00\u9879\u7684\u6B63\u786E\u7B54\u6848\u5FC5\u987B\u552F\u4E00\u3001\u65E0\u4E89\u8BAE\uFF0C\u5E76\u4E14\u90FD\u80FD\u5728\u672C\u8282\u8BB2\u8FC7\u7684\u5185\u5BB9\u91CC\u627E\u5230\u4F9D\u636E\u3002
instructions \u53EA\u5199**\u8981\u5224\u65AD / \u5B8C\u6210\u4EC0\u4E48**\uFF08\u5982\u300C\u5224\u65AD\u6BCF\u6761\u8BF4\u6CD5\uFF1A\u7B26\u5408\u751F\u6210\u6A21\u578B\u7684\u672C\u8D28\uFF0C\u8FD8\u662F\u5E38\u89C1\u8BEF\u89E3\u300D\uFF09\uFF0C**\u4E0D\u8981\u5199\u64CD\u4F5C\u65B9\u5F0F**\uFF08\u4E0D\u8981\u51FA\u73B0 \u62D6 / \u70B9 / \u6233 / \u8FDE\u7EBF / \u6309\u952E / \u653E\u8FDB \u7B49\u5B57\uFF09\uFF1A\u540C\u4E00\u9053\u9898\u53EF\u80FD\u7528\u62D6\u62FD\u3001\u70B9\u9009\u6216\u952E\u76D8\u6765\u73A9\uFF0C\u64CD\u4F5C\u8BF4\u660E\u7531\u73A9\u6CD5\u81EA\u5DF1\u7ED9\u51FA\u3002`;
async function genGameSpec(c) {
  if (!hasLLM()) {
    const g2 = mockGameSpec(c);
    const bad = validateGame(g2);
    if (bad) throw new Error(`mock \u5C0F\u6E38\u620F\u4E0D\u5408\u683C\uFF1A${bad}`);
    return g2;
  }
  const L2 = c.lesson;
  return chatJSON(
    `\u4F60\u662F\u8BFE\u7A0B\u8BBE\u8BA1\u5E08\u3002\u4E3A\u8BFE\u8282\u300C${c.sessionTitle}\u300D\u8BBE\u8BA1\u4E00\u4E2A${c.purpose === "recap" ? "\u653E\u5728\u8BFE\u8282\u603B\u7ED3\u5904\u7684\u6982\u5FF5\u8003\u6838\u5C0F\u6E38\u620F\uFF08\u8F7B\u677E\u30012 \u5206\u949F\u5185\u5B8C\u6210\uFF0C\u5E2E\u5B66\u4E60\u8005\u628A\u4E09\u4E2A\u77E5\u8BC6\u70B9\u4E32\u8D77\u6765\uFF09" : "\u7EC3\u4E60\u7684\u6700\u540E\u4E00\u9898\uFF08\u8003\u7EFC\u5408\u7406\u89E3\uFF0C\u6BD4\u666E\u901A\u9009\u62E9\u9898\u66F4\u9700\u8981\u60F3\u4E00\u60F3\uFF09"}\u3002
${GAME_SPEC_FORMAT}
${c.avoid ? `\u4E0D\u8981\u7528 ${c.avoid} \u73A9\u6CD5\uFF08\u8BFE\u8282\u603B\u7ED3\u5DF2\u7ECF\u7528\u8FC7\uFF09\u3002` : ""}
\u8F93\u51FA JSON\uFF1A\u5C31\u662F\u4E0A\u9762\u7684\u4E00\u4E2A\u6E38\u620F\u5BF9\u8C61\u3002`,
    [
      `\u8BFE\u5802\u8981\u70B9\uFF1A${L2.objectives.join(" / ")}`,
      `\u77E5\u8BC6\u70B9\uFF1A${(L2.sections ?? []).slice(1, -1).join(" / ")}`,
      `\u4E09\u4E2A\u95EE\u9898\uFF1A${L2.openingQuestions.join(" / ")}`,
      `\u4E09\u4E2A\u95EE\u9898\u7684\u7B54\u6848\uFF1A${L2.closing.summary.join(" / ")}`,
      `\u672F\u8BED\u8868\uFF1A${L2.glossary.map((g2) => `${g2.term}\uFF1A${g2.def}`).join("\uFF1B") || "\uFF08\u65E0\uFF09"}`
    ].join("\n"),
    (v) => validateGame(v) ?? (c.avoid && v.type === c.avoid ? `\u4E0D\u8981\u7528 ${c.avoid} \u73A9\u6CD5` : null) ?? (OPERATION_WORDS.test(v.instructions) ? "instructions \u4E0D\u8981\u5199\u64CD\u4F5C\u65B9\u5F0F\uFF08\u62D6 / \u70B9 / \u6233 / \u8FDE\u7EBF / \u6309\u952E / \u653E\u8FDB\u7B49\uFF09\uFF0C\u53EA\u5199\u8981\u5224\u65AD\u6216\u5B8C\u6210\u4EC0\u4E48" : null),
    { maxTokens: 2e3, temperature: 0.4 }
  );
}
async function genConceptGameHtml(c) {
  if (!hasLLM()) return null;
  const L2 = c.lesson;
  const html = await writeHtml(
    `\u4F60\u662F\u6E38\u620F\u5316\u5B66\u4E60\u8BBE\u8BA1\u5E08\u517C\u524D\u7AEF\u5DE5\u7A0B\u5E08\u3002\u4E3A\u4E00\u8282\u8BFE\u505A\u4E00\u4E2A\u300C\u6982\u5FF5\u4E92\u52A8\u5C0F\u6E38\u620F\u300D\u5355\u6587\u4EF6 HTML\uFF1A\u5B66\u4E60\u8005\u5728\u4E00\u4E2A**\u6709\u573A\u666F\u611F**\u7684\u754C\u9762\u91CC\u4EB2\u624B\u64CD\u4F5C\u672C\u8282\u6700\u6838\u5FC3\u7684\u6982\u5FF5\uFF0C\u8FB9\u73A9\u8FB9\u5F04\u61C2\uFF0C\u800C\u4E0D\u662F\u505A\u9009\u62E9\u9898\u3002
\u53C2\u8003\u8303\u4F8B\uFF08\u53EA\u5B66\u5F62\u5F0F\uFF0C\u4E0D\u8981\u7167\u6284\u9898\u6750\uFF09\uFF1A\u300C\u672C\u4F53\u8BBA\u300D\u5C0F\u6E38\u620F\u2014\u2014\u6807\u9898\u300C\u672C\u4F53\u8BBA (Ontology)\uFF1A\u63A2\u7D22\u5B58\u5728\u7684\u672C\u8D28\u4E0E\u5206\u7C7B\u300D\uFF1B\u9876\u90E8\u5207\u6362\u300C\u4E8C\u5143\u8BBA / \u4E00\u5143\u8BBA\u300D\u4E24\u79CD\u89C2\u70B9\uFF1B\u4E2D\u95F4\u4E00\u6392\u9875\u7B7E\u300C\u5B9E\u4F53 / \u5C5E\u6027 / \u5173\u7CFB\u300D\uFF1B\u5DE6\u8FB9\u300C\u73B0\u5B9E\u7A7A\u95F4\u300D\u6446\u7740\u5E26\u56FE\u6807\u7684\u5361\u7247\uFF08\u{1F34E} \u82F9\u679C\u3001\u2696\uFE0F \u6B63\u4E49\u30017\uFE0F\u20E3 \u6570\u5B577\u3001\u{1F409} \u9F99\uFF09\uFF1B\u53F3\u8FB9\u300C\u5206\u7C7B\u5668\u300D\u6709\u4E24\u4E2A\u865A\u7EBF\u653E\u7F6E\u533A\u300C\u7269\u8D28\u4E16\u754C / \u7CBE\u795E\xB7\u7406\u5FF5\u4E16\u754C\u300D\u3002\u5B66\u4E60\u8005\u628A\u5361\u7247\u62D6\u8FDB\u653E\u7F6E\u533A\uFF0C\u7ACB\u523B\u770B\u5230\u8FD9\u6837\u5206\u7684\u7406\u7531\uFF1B\u5207\u6362\u5230\u300C\u4E00\u5143\u8BBA\u300D\u540E\u653E\u7F6E\u533A\u53D8\u6210\u4E00\u4E2A\uFF0C\u4F53\u4F1A\u89C2\u70B9\u4E0D\u540C\u3001\u5206\u7C7B\u5C31\u4E0D\u540C\u3002\u53F3\u4E0B\u89D2\u6709\u300C\u91CD\u7F6E\u300D\u3002
\u8BBE\u8BA1\u8981\u6C42\uFF1A
1. \u5148\u60F3\u6E05\u695A\u672C\u8282**\u6700\u503C\u5F97\u4EB2\u624B\u73A9**\u7684\u4E00\u4E2A\u6982\u5FF5\u6216\u5BF9\u6BD4\uFF0C\u628A\u5B83\u505A\u6210\u4E00\u4E2A\u9690\u55BB\u573A\u666F\uFF1A\u53EF\u4EE5\u662F\u62D6\u62FD\u5206\u7C7B\u3001\u6309\u987A\u5E8F\u642D\u5EFA / \u7EC4\u88C5\u3001\u8C03\u53C2\u6570\u770B\u7ED3\u679C\u53D8\u5316\u3001\u5728\u4E24\u79CD\u89C2\u70B9 / \u6A21\u5F0F\u4E4B\u95F4\u5207\u6362\u5BF9\u6BD4\u3001\u627E\u51FA\u7CFB\u7EDF\u91CC\u7684\u9519\u8BEF\u7B49\u3002\u73A9\u6CD5\u8981\u548C\u6982\u5FF5\u672C\u8EAB\u5F3A\u76F8\u5173\uFF0C\u6362\u4E00\u8282\u8BFE\u5C31\u4E0D\u6210\u7ACB\u3002
2. \u81F3\u5C11 6 \u4E2A\u53EF\u64CD\u4F5C\u5BF9\u8C61\uFF08\u5361\u7247 / \u90E8\u4EF6 / \u53C2\u6570\uFF09\uFF0C\u6BCF\u4E2A\u5BF9\u8C61\u6709\u4E00\u4E2A\u5408\u9002\u7684 emoji \u6216\u7B80\u5355 SVG \u56FE\u6807\uFF1B\u653E\u7F6E\u533A\u6216\u7ED3\u679C\u533A\u8981\u6709\u6E05\u695A\u7684\u6807\u9898\u3002
3. \u5373\u65F6\u53CD\u9988\uFF1A\u6BCF\u6B21\u64CD\u4F5C\u540E\u9A6C\u4E0A\u544A\u8BC9\u5B66\u4E60\u8005\u5BF9\u4E0D\u5BF9\u3001**\u4E3A\u4EC0\u4E48**\uFF08\u4E00\u53E5\u8BDD\u89E3\u91CA\uFF0C\u6765\u81EA\u672C\u8282\u5185\u5BB9\uFF09\uFF1B\u6B63\u786E\u65F6\u6709\u8F7B\u5FEB\u7684\u52A8\u6548\uFF08\u5F39\u8DF3\u3001\u53D1\u5149\u3001\u5C0F\u5F69\u5E26\uFF09\uFF0C\u9519\u8BEF\u65F6\u8F7B\u5FAE\u6296\u52A8\u5E76\u7ED9\u63D0\u793A\uFF0C\u53EF\u4EE5\u91CD\u65B0\u653E\u3002
4. \u6709\u4E00\u70B9\u6E38\u620F\u611F\uFF1A\u9876\u90E8\u663E\u793A\u8FDB\u5EA6\uFF08\u5DF2\u5B8C\u6210 x/\u603B\u6570\uFF09\u548C\u5F97\u5206\u6216\u661F\u7EA7\uFF1B\u5168\u90E8\u5B8C\u6210\u65F6\u6709\u4E00\u4E2A\u7B80\u77ED\u7684\u901A\u5173\u753B\u9762\uFF08\u603B\u7ED3\u672C\u8282 2\u20133 \u4E2A\u8981\u70B9\uFF09\uFF0C\u53EF\u300C\u518D\u73A9\u4E00\u6B21\u300D\u3002
5. \u5982\u679C\u672C\u8282\u6709\u4E24\u79CD\u89C2\u70B9 / \u65B9\u6CD5 / \u60C5\u5F62\u7684\u5BF9\u6BD4\uFF0C\u63D0\u4F9B\u9876\u90E8\u5207\u6362\uFF0C\u5207\u6362\u540E\u573A\u666F\u89C4\u5219\u968F\u4E4B\u53D8\u5316\uFF08\u50CF\u4E8C\u5143\u8BBA / \u4E00\u5143\u8BBA\uFF09\u3002
6. \u62D6\u62FD\u5206\u7C7B / \u653E\u7F6E\u4E00\u5F8B\u7528 TU.dnd\uFF08\u89C1\u4E0B\u65B9\u89C4\u8303\uFF09\uFF1B\u8C03\u53C2\u6570\u7528 <input type="range">\uFF0C\u5207\u6362\u89C2\u70B9\u7528\u6309\u94AE\u3002
7. <title> \u5199\u6E38\u620F\u540D\uFF08\u2264 16 \u5B57\uFF0C\u5982\u300C\u672C\u4F53\u8BBA\uFF1A\u7ED9\u5B58\u5728\u5206\u5206\u7C7B\u300D\uFF09\u3002\u6240\u6709\u5185\u5BB9\u5FC5\u987B\u5FE0\u4E8E\u672C\u8282\u77E5\u8BC6\uFF0C\u4E0D\u7F16\u9020\u3002
${DND}
${STYLE}
${SAFETY}`,
    [
      `\u8BFE\u7A0B\uFF1A${c.courseTitle}\uFF1B\u53D7\u4F17\uFF1A${c.audience || "\u5927\u5B66\u751F"}`,
      `\u8BFE\u8282\uFF1A${c.sessionTitle}`,
      `\u8BFE\u5802\u8981\u70B9\uFF1A${L2.objectives.join(" / ")}`,
      `\u77E5\u8BC6\u70B9\uFF1A${(L2.sections ?? []).slice(1, -1).join(" / ")}`,
      `\u672C\u8282\u4E09\u95EE\u4E0E\u7B54\u6848\uFF1A${L2.openingQuestions.map((q, i) => `${q} \u2192 ${L2.closing.summary[i] ?? ""}`).join("\uFF1B")}`,
      `\u672F\u8BED\u8868\uFF1A${L2.glossary.map((g2) => `${g2.term}\uFF1A${g2.def}`).join("\uFF1B") || "\uFF08\u65E0\uFF09"}`
    ].join("\n"),
    { dnd: "if-drag" }
  );
  const title = (html.match(/<title>([^<]{1,40})<\/title>/i)?.[1] ?? "").trim() || `${c.sessionTitle}\u5C0F\u6E38\u620F`;
  return { html, title: title.slice(0, 24), provider: "llm" };
}
function mockGameSpec(c) {
  const L2 = c.lesson;
  const kps = (L2.sections ?? []).slice(1, -1).filter(Boolean);
  const gl = L2.glossary.filter((g2) => g2.term && g2.def).slice(0, 5);
  const want = c.avoid === "match" ? "order" : c.avoid === "order" ? "match" : gl.length >= 3 ? "match" : "order";
  if (want === "match" && gl.length < 3 && c.avoid === "order" && L2.objectives.length >= 3)
    return {
      type: "match",
      title: `${c.sessionTitle.slice(0, 14)}\uFF1A\u95EE\u9898\u4E0E\u7B54\u6848`,
      instructions: "\u7ED9\u6BCF\u4E2A\u95EE\u9898\u627E\u5230\u5B83\u7684\u7B54\u6848",
      pairs: L2.openingQuestions.slice(0, 3).map((q, i) => ({ id: `p${i + 1}`, left: q.slice(0, 24), right: (L2.closing.summary[i] || L2.objectives[i]).slice(0, 40) }))
    };
  if (want === "match" && gl.length >= 3)
    return {
      type: "match",
      title: `${c.sessionTitle.slice(0, 14)}\uFF1A\u672F\u8BED\u8FDE\u7EBF`,
      instructions: "\u7ED9\u6BCF\u4E2A\u672F\u8BED\u627E\u5230\u5BF9\u5E94\u7684\u89E3\u91CA",
      pairs: gl.map((g2, i) => ({ id: `p${i + 1}`, left: g2.term.slice(0, 24), right: g2.def.slice(0, 40) }))
    };
  const steps = kps.length >= 3 ? kps : L2.objectives;
  return {
    type: "order",
    title: `${c.sessionTitle.slice(0, 14)}\uFF1A\u7406\u4E00\u7406\u987A\u5E8F`,
    instructions: "\u6309\u672C\u8282\u8BB2\u89E3\u7684\u5148\u540E\u987A\u5E8F\u6392\u5217\u8FD9\u4E9B\u77E5\u8BC6\u70B9",
    items: steps.slice(0, 6).map((s, i) => ({ id: `s${i + 1}`, label: s.slice(0, 24) }))
  };
}
function mockAnimHtml(title, brief) {
  const gravity = /引力|重力|万有引力|gravity|轨道|行星/i.test(`${title}${brief}`);
  const esc = (s) => s.replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[ch]);
  const head = `<!doctype html><html lang="zh"><head><style>
html,body{margin:0;height:100%;background:#fffdf8;color:#1c1a16;font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif;overflow:hidden}
.wrap{position:absolute;inset:0;display:flex;flex-direction:column;padding:14px 18px;box-sizing:border-box}
h1{margin:0;font-size:18px;color:#1f5c4d}.sub{font-size:13px;color:#6f6a5f;margin:2px 0 8px}
canvas{flex:1;width:100%;min-height:0;border-radius:12px;background:#f5f2ea}
.bar{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-top:10px;font-size:13px}
button{border:1px solid #e3ddcf;background:#fff;border-radius:999px;padding:5px 14px;font:inherit;cursor:pointer}button:hover{background:#eef4f1}
label{display:flex;align-items:center;gap:6px}input[type=range]{accent-color:#1f5c4d;width:120px}b{color:#1f5c4d;font-variant-numeric:tabular-nums}
</style></head><body><div class="wrap"><h1>${esc(title)}</h1><div class="sub">${esc(brief.slice(0, 60))}</div><canvas id="c"></canvas><div class="bar">
<button id="play">\u6682\u505C</button><button id="reset">\u91CD\u7F6E</button>`;
  if (gravity)
    return `${head}<label>\u8D28\u91CF m\u2082 <input id="m" type="range" min="1" max="10" value="4"><b id="mv">4</b></label><label>\u521D\u59CB\u8DDD\u79BB r <input id="r" type="range" min="80" max="220" value="160"><b id="rv">160</b></label><span>F = G\xB7m\u2081\xB7m\u2082 / r\xB2 = <b id="f"></b></span></div></div>
<script>
var c=document.getElementById("c"),x=c.getContext("2d"),run=true,G=900,M1=20,b={};
function size(){c.width=c.clientWidth*devicePixelRatio;c.height=c.clientHeight*devicePixelRatio;x.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}
function reset(){var r=+document.getElementById("r").value;b={x:c.clientWidth/2+r,y:c.clientHeight/2,vx:0,vy:Math.sqrt(G*M1/r)*0.92,trail:[]};}
function m2(){return +document.getElementById("m").value}
function step(){var cx=c.clientWidth/2,cy=c.clientHeight/2,dx=cx-b.x,dy=cy-b.y,r=Math.max(18,Math.hypot(dx,dy)),a=G*M1/(r*r);b.vx+=a*dx/r*0.016*6;b.vy+=a*dy/r*0.016*6;b.x+=b.vx*0.016*6;b.y+=b.vy*0.016*6;b.trail.push([b.x,b.y]);if(b.trail.length>220)b.trail.shift();return r}
function draw(r){var cx=c.clientWidth/2,cy=c.clientHeight/2;x.clearRect(0,0,c.width,c.height);x.strokeStyle="rgba(31,92,77,.35)";x.lineWidth=2;x.beginPath();b.trail.forEach(function(p,i){i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])});x.stroke();
x.fillStyle="#c46a1c";x.beginPath();x.arc(cx,cy,22,0,7);x.fill();x.fillStyle="#1f5c4d";x.beginPath();x.arc(b.x,b.y,6+m2()*1.2,0,7);x.fill();
var f=G*M1*m2()/(r*r),len=Math.min(90,f*0.9),ux=(cx-b.x)/r,uy=(cy-b.y)/r;x.strokeStyle="#a8402c";x.lineWidth=3;x.beginPath();x.moveTo(b.x,b.y);x.lineTo(b.x+ux*len,b.y+uy*len);x.stroke();
x.fillStyle="#1c1a16";x.font="13px sans-serif";x.fillText("m\u2081",cx-8,cy+40);x.fillText("r = "+r.toFixed(0),(cx+b.x)/2,(cy+b.y)/2-8);document.getElementById("f").textContent=f.toFixed(1)}
function loop(){var r=run?step():Math.hypot(c.clientWidth/2-b.x,c.clientHeight/2-b.y);draw(r);requestAnimationFrame(loop)}
document.getElementById("play").onclick=function(){run=!run;this.textContent=run?"\u6682\u505C":"\u64AD\u653E"};document.getElementById("reset").onclick=reset;
["m","r"].forEach(function(id){document.getElementById(id).oninput=function(){document.getElementById(id+"v").textContent=this.value;if(id==="r")reset()}});
addEventListener("resize",function(){size();reset()});size();reset();if(matchMedia("(prefers-reduced-motion: reduce)").matches)run=false;loop();
</script></body></html>`;
  return `${head}<label>\u901F\u5EA6 <input id="s" type="range" min="1" max="10" value="4"><b id="sv">4</b></label></div></div>
<script>
var c=document.getElementById("c"),x=c.getContext("2d"),run=true,t=0,labels=${JSON.stringify(brief.split(/[，,、；;。\s]+/).filter(function(s) {
    return s.length >= 2 && s.length <= 8;
  }).slice(0, 5)).replace(/</g, "\\u003c")};
if(labels.length<3)labels=["\u8F93\u5165","\u5904\u7406","\u8F93\u51FA"];
function size(){c.width=c.clientWidth*devicePixelRatio;c.height=c.clientHeight*devicePixelRatio;x.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}
function pos(i){var w=c.clientWidth,h=c.clientHeight;return [w*(i+1)/(labels.length+1),h/2+Math.sin(i*1.7)*h*0.18]}
function draw(){x.clearRect(0,0,c.width,c.height);var k=labels.length;for(var i=0;i<k-1;i++){var a=pos(i),b=pos(i+1);x.strokeStyle="rgba(31,92,77,.4)";x.lineWidth=2;x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b[0],b[1]);x.stroke();
var p=(t*0.004*(+document.getElementById("s").value)+i*0.3)%1;x.fillStyle="#ffd84a";x.beginPath();x.arc(a[0]+(b[0]-a[0])*p,a[1]+(b[1]-a[1])*p,7,0,7);x.fill()}
labels.forEach(function(l,i){var q=pos(i),r=26+3*Math.sin(t*0.05+i);x.fillStyle="#fff";x.strokeStyle="#1f5c4d";x.lineWidth=2.4;x.beginPath();x.arc(q[0],q[1],r,0,7);x.fill();x.stroke();x.fillStyle="#1c1a16";x.font="14px sans-serif";x.textAlign="center";x.fillText(l,q[0],q[1]+r+18)})}
function loop(){if(run)t++;draw();requestAnimationFrame(loop)}
document.getElementById("play").onclick=function(){run=!run;this.textContent=run?"\u6682\u505C":"\u64AD\u653E"};document.getElementById("reset").onclick=function(){t=0};
document.getElementById("s").oninput=function(){document.getElementById("sv").textContent=this.value};
addEventListener("resize",size);size();loop();
</script></body></html>`;
}

// ../../src/lib/lesson-images.ts
init_lang();
init_db();
import fs from "node:fs";
import path2 from "node:path";

// stub:/home/claude/stm/src/lib/cover.ts
var __stub6 = (n) => new Proxy(function() {
}, { apply() {
  return void 0;
}, get(t, k) {
  return k === Symbol.toPrimitive ? () => "" : k === "then" ? void 0 : __stub6(n + "." + String(k));
} });
var imageConfig = __stub6("imageConfig");
var COVER_STYLE_VERSION = __stub6("COVER_STYLE_VERSION");
var PALETTES = __stub6("PALETTES");
var ruleBrief = __stub6("ruleBrief");
var coverBrief = __stub6("coverBrief");
var coverPrompt = __stub6("coverPrompt");
var generateImage = __stub6("generateImage");
var ensureCover = __stub6("ensureCover");
var coverOf = __stub6("coverOf");
var coverSig = __stub6("coverSig");
var signedCoverUrl = __stub6("signedCoverUrl");
var verifyCoverSig = __stub6("verifyCoverSig");

// src/host/shims/usage-meter.ts
function meter(_u, _tag) {
  return 0;
}
function splitUsage(_u) {
  return null;
}

// ../../src/lib/lesson-images.ts
var IMAGE_STYLE = [
  "\u624B\u7ED8\u6C34\u5F69\u63D2\u753B\uFF0C\u7EC6\u58A8\u7EBF\u52FE\u52D2\u8F6E\u5ED3\uFF0C\u7EBF\u6761\u5E72\u51C0\uFF1B\u6DE1\u5F69\u6655\u67D3\uFF0C\u4E0D\u8981\u5199\u5B9E\u6444\u5F71\u611F",
  "\u80CC\u666F\u662F\u5E72\u51C0\u7684\u7C73\u767D\u7EB8\u8272\uFF08\u7EA6 #f5f2ea\uFF09\uFF0C\u5927\u91CF\u7559\u767D\uFF0C\u4E3B\u4F53\u6E05\u6670\u5C45\u4E2D",
  "\u914D\u8272\u8D34\u8FD1\u9ED1\u677F\u767D\u677F\uFF1A\u9ED1\u677F\u7EFF\uFF08\u7EA6 #1f5c4d\uFF09\u3001\u9676\u571F\u6A59\uFF08\u7EA6 #c8693c\uFF09\u3001\u7070\u84DD\uFF08\u7EA6 #6b85a0\uFF09\u4E3A\u4E3B\uFF0C\u5C11\u91CF\u6696\u7070\uFF1B\u4E0D\u7528\u8367\u5149\u8272\u548C\u5927\u9762\u79EF\u9AD8\u9971\u548C\u8272",
  "\u6784\u56FE\u7B80\u6D01\uFF0C\u6700\u591A 3\u20134 \u4E2A\u5143\u7D20\uFF0C\u4E00\u773C\u80FD\u770B\u51FA\u753B\u7684\u662F\u4EC0\u4E48"
].join("\uFF1B");
var NO_TEXT = "\u753B\u9762\u4E2D\u7EDD\u5BF9\u4E0D\u8981\u51FA\u73B0\u4EFB\u4F55\u6587\u5B57\u3001\u6C49\u5B57\u3001\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u516C\u5F0F\u3001\u6807\u7B7E\u3001\u5BF9\u8BDD\u6C14\u6CE1\u91CC\u7684\u5B57\u3001\u62DB\u724C\u3001Logo \u6216\u7B7E\u540D\u3002";
var COMIC_STYLE = [
  "\u5E7D\u9ED8\u7684\u6761\u6F2B / \u591A\u683C\u6F2B\u753B\uFF0C\u624B\u7ED8\u7EC6\u58A8\u7EBF + \u6DE1\u5F69\u4E0A\u8272\uFF0C\u4EBA\u7269 Q \u7248\u3001\u8868\u60C5\u548C\u52A8\u4F5C\u5938\u5F20\u6709\u559C\u611F",
  "\u4EBA\u7269\u7A7F\u6574\u9F50\u7684\u886C\u886B\u3001\u536B\u8863\u6216\u5916\u5957\u7B49\u65E5\u5E38\u670D\u88C5\uFF0C\u540C\u4E00\u4E2A\u89D2\u8272\u6BCF\u683C\u957F\u76F8\u548C\u670D\u88C5\u4E00\u81F4",
  // 2026-11-01 线上：原写法里描述「不穿衣服」的字眼触发生图服务敏感词拦截（400 InputTextSensitiveContentDetected），所有漫画都失败；只正面描述服装
  "\u683C\u5B50\u4E4B\u95F4\u7559\u767D\u8272\u5206\u9694\uFF0C\u6BCF\u683C\u6784\u56FE\u7B80\u6D01\uFF0C\u80CC\u666F\u5E72\u51C0\u7684\u7C73\u767D\u7EB8\u8272\uFF08\u7EA6 #f5f2ea\uFF09",
  "\u914D\u8272\u8D34\u8FD1\u767D\u677F\uFF1A\u9ED1\u677F\u7EFF\uFF08\u7EA6 #1f5c4d\uFF09\u3001\u9676\u571F\u6A59\uFF08\u7EA6 #c8693c\uFF09\u3001\u7070\u84DD\uFF08\u7EA6 #6b85a0\uFF09\u4E3A\u4E3B\uFF0C\u5C11\u91CF\u6696\u7070\uFF1B\u4E0D\u7528\u8367\u5149\u8272",
  "\u5BF9\u8BDD\u6C14\u6CE1\u662F\u767D\u5E95\u9ED1\u8FB9\u7684\u5706\u89D2\u6C14\u6CE1\uFF0C\u91CC\u9762\u7684\u4E2D\u6587\u7528\u6E05\u6670\u5DE5\u6574\u7684\u9ED1\u8272\u9ED1\u4F53\uFF0C\u5B57\u8981\u5927\u3001\u4E00\u7B14\u4E00\u753B\u5199\u5BF9"
].join("\uFF1B");
var comicStyle = () => contentLang() === "en" ? COMIC_STYLE.replace("\u91CC\u9762\u7684\u4E2D\u6587\u7528\u6E05\u6670\u5DE5\u6574\u7684\u9ED1\u8272\u9ED1\u4F53\uFF0C\u5B57\u8981\u5927\u3001\u4E00\u7B14\u4E00\u753B\u5199\u5BF9", "\u91CC\u9762\u7684\u82F1\u6587\u7528\u6E05\u6670\u5DE5\u6574\u7684\u9ED1\u8272\u65E0\u886C\u7EBF\u5927\u5199\u5B57\u6BCD\uFF08\u7C7B\u4F3C Comic Sans / Arial Rounded\uFF09\uFF0C\u5B57\u8981\u5927\u3001\u6BCF\u4E2A\u5355\u8BCD\u62FC\u5199\u6B63\u786E") : COMIC_STYLE;
function comicPrompt(b, ctx) {
  const ps = b.panels ?? [];
  const layout = ps.length === 4 ? "2\xD72 \u56DB\u683C" : ps.length === 3 ? "\u6A2A\u5411\u4E09\u683C" : "\u5DE6\u53F3\u4E24\u683C";
  const cells = ps.map((p, i) => `\u7B2C ${i + 1} \u683C\uFF1A${p.scene.replace(/\s+/g, " ")}${p.line ? `\uFF1B${p.who ? `${p.who}\u7684` : ""}\u5BF9\u8BDD\u6C14\u6CE1\u91CC\u5199\u300C${p.line}\u300D` : ""}`).join("\n");
  const tags = b._noTags ? "" : (b.mapping ?? []).map((m) => `\u300C${m.item}\u300D`).join("\u3001");
  return `\u6A2A\u7248 4:3 \u7684${layout}\u5E7D\u9ED8\u6F2B\u753B\uFF0C\u7528\u4E8E\u767D\u677F\u8BFE\u300C${ctx.sessionTitle}\u300D${ctx.kpTitle ? `\u7684\u77E5\u8BC6\u70B9\u300C${ctx.kpTitle}\u300D` : ""}\uFF0C\u7528\u4E00\u4E2A\u597D\u7B11\u7684\u5C0F\u6545\u4E8B\u8BB2\u660E\u767D\u4E00\u4E2A\u9053\u7406\u3002
${cells}
${tags ? `\u753B\u9762\u91CC\u8FD9\u4E9B\u7269\u4EF6\u65C1\u8FB9\u5404\u8D34\u4E00\u4E2A\u767D\u5E95\u5C0F\u6807\u7B7E\uFF0C\u6807\u7B7E\u4E0A\u5199\u5B83\u7684\u540D\u5B57\uFF1A${tags}\uFF08\u6BCF\u4E2A\u540D\u5B57\u53EA\u51FA\u73B0\u4E00\u6B21\uFF09\u3002
` : ""}\u753B\u9762\u6700\u4E0B\u65B9\u4E00\u6761\u9ED1\u677F\u7EFF\u6A2A\u5E45\uFF0C\u5DE6\u53F3\u5404\u7559\u51FA\u4E00\u70B9\u8FB9\u8DDD\u3001\u4E0D\u8981\u9876\u5230\u53F3\u4E0B\u89D2\uFF08\u53F3\u4E0B\u89D2\u7559\u7A7A\uFF09\uFF0C\u6A2A\u5E45\u91CC\u7528\u767D\u8272\u5927\u5B57\u5199\u300C${b.point ?? b.caption}\u300D\u3002
\u98CE\u683C\uFF1A${comicStyle()}\u3002
\u6587\u5B57\u8981\u6C42\uFF1A\u53EA\u51FA\u73B0\u4E0A\u9762\u5F15\u53F7\u91CC\u7684${L("\u4E2D\u6587\uFF0C\u4E00\u5B57\u4E0D\u5DEE\u3001\u4E0D\u52A0\u6807\u70B9\u4EE5\u5916\u7684\u5B57", "\u82F1\u6587\uFF08English\uFF09\uFF0C\u9010\u8BCD\u7167\u6284\u3001\u62FC\u5199\u4E00\u5B57\u6BCD\u4E0D\u5DEE\uFF0C\u4E0D\u52A0\u5176\u4ED6\u5355\u8BCD")}\uFF1B\u9664\u6B64\u4E4B\u5916\u4E0D\u8981\u51FA\u73B0\u4EFB\u4F55\u5176\u4ED6\u6587\u5B57\u3001${L("\u5B57\u6BCD\u3001", "\u6C49\u5B57\u3001")}\u6570\u5B57\u3001\u62DF\u58F0\u8BCD\u3001\u62DB\u724C\u3001Logo \u6216\u7B7E\u540D\u3002`;
}
function lessonImagePrompt(b, ctx) {
  if (b.panels?.length) return comicPrompt(b, ctx);
  return `\u6A2A\u7248 4:3 \u7684\u6559\u5B66\u914D\u56FE\uFF0C\u7528\u4E8E\u767D\u677F\u8BFE\u300C${ctx.sessionTitle}\u300D${ctx.kpTitle ? `\u7684\u77E5\u8BC6\u70B9\u300C${ctx.kpTitle}\u300D` : ""}\u3002
\u753B\u9762\uFF1A${(b.prompt ?? b.caption).replace(/\s+/g, " ").slice(0, IMAGE_LIMITS.prompt)}\u3002
\u98CE\u683C\uFF1A${IMAGE_STYLE}\u3002
${NO_TEXT}`;
}
async function neutralizeImage(b) {
  const ps = b.panels ?? [];
  const src = [...ps.map((p) => p.scene), ...ps.map((p) => p.line ?? ""), b.point ?? "", b.caption, b.prompt ?? ""];
  const out = await neutralize(src.map((t) => t || "\u65E0"), "\u767D\u677F\u8BFE\u7684\u6559\u5B66\u6F2B\u753B");
  const n = ps.length;
  const back = (i, orig) => orig ? out[i] : orig;
  return {
    ...b,
    panels: ps.map((p, i) => ({ ...p, scene: out[i], ...p.line ? { line: back(n + i, p.line).slice(0, 14) } : {} })),
    ...b.point ? { point: back(2 * n, b.point).slice(0, 20) } : {},
    caption: out[2 * n + 1].slice(0, 40),
    ...b.prompt ? { prompt: out[2 * n + 2] } : {}
  };
}
function lessonImageFile(id) {
  return path2.join(DATA_DIR, "lesson-images", `${id}.jpg`);
}
function saveLessonImage(p) {
  const id = uid("im_").toLowerCase();
  const fp = lessonImageFile(id);
  fs.mkdirSync(path2.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, p.bytes);
  run("INSERT INTO lesson_images(id,session_id,role,prompt,file_path,created_at) VALUES(?,?,?,?,?,?)", id, p.sessionId, p.role, p.prompt, fp, now());
  return id;
}
function visionConfig() {
  const e = process.env;
  if (!e.VISION_MODEL) return null;
  const img = imageConfig();
  const base = (e.VISION_BASE_URL || img?.base || "").replace(/\/$/, "");
  const key = e.VISION_API_KEY || img?.key || "";
  return base && key ? { base, key, model: e.VISION_MODEL } : null;
}
function parseVisionVerdict(text2) {
  const m = text2.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]);
    const reason = typeof v.reason === "string" ? v.reason.slice(0, 120) : "";
    if (typeof v.match !== "boolean") return null;
    if (typeof v.textOk === "boolean") {
      if (!v.match) return { ok: false, reason: `\u4E0E\u77E5\u8BC6\u70B9\u4E0D\u7B26\uFF1A${reason}` };
      if (!v.textOk) return { ok: false, reason: `\u6F2B\u753B\u6587\u5B57\u6709\u9519\uFF1A${reason}` };
      return { ok: true, reason };
    }
    if (typeof v.hasText !== "boolean") return null;
    if (!v.match) return { ok: false, reason: `\u4E0E\u77E5\u8BC6\u70B9\u4E0D\u7B26\uFF1A${reason}` };
    if (v.hasText) return { ok: false, reason: `\u56FE\u4E2D\u6709\u6587\u5B57\uFF1A${reason}` };
    return { ok: true, reason };
  } catch {
    return null;
  }
}
var visionCheck = async (bytes, ctx) => {
  const cfg = visionConfig();
  if (!cfg) return null;
  const mime = bytes[0] === 137 && bytes[1] === 80 ? "image/png" : "image/jpeg";
  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      max_tokens: 200,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: ctx.texts?.length ? `\u8FD9\u662F\u767D\u677F\u8BFE\u300C${ctx.sessionTitle}\u300D${ctx.kpTitle ? `\u77E5\u8BC6\u70B9\u300C${ctx.kpTitle}\u300D` : ""}\u7684\u4E00\u5E45\u6559\u5B66\u6F2B\u753B\u3002\u56FE\u4E0B\u8BF4\u660E\uFF1A\u300C${ctx.caption}\u300D\u3002
\u753B\u91CC\u5E94\u8BE5\u5199\u7740\u8FD9\u4E9B${L("\u4E2D\u6587", "\u82F1\u6587")}\uFF08\u5BF9\u8BDD\u6C14\u6CE1\u548C\u5E95\u90E8\u6A2A\u5E45\uFF09\uFF1A${ctx.texts.map((t) => `\u300C${t}\u300D`).join("\u3001")}\u3002
\u8BF7\u5224\u65AD\uFF1A1) \u753B\u9762\u662F\u4E0D\u662F\u4E00\u5E45\u4E0E\u8FD9\u4E2A\u77E5\u8BC6\u70B9\u76F8\u5173\u7684\u6F2B\u753B\uFF1B2) \u4E0A\u9762\u8FD9\u4E9B\u6587\u5B57\u662F\u5426\u90FD\u6E05\u695A\u5730\u51FA\u73B0\u5728\u753B\u91CC\u3001\u6CA1\u6709\u9519\u522B\u5B57 / \u4E71\u7801 / \u7F3A\u5B57\uFF0C\u4E5F\u6CA1\u6709\u591A\u51FA\u5176\u4ED6\u660E\u663E\u7684\u6587\u5B57\uFF08\u5FFD\u7565\u89D2\u843D\u91CC\u7684\u300CAI \u751F\u6210\u300D\u6C34\u5370\uFF1B\u6807\u70B9\u5DEE\u5F02\u4E0D\u7B97\u9519\uFF09\u3002
\u53EA\u8F93\u51FA JSON\uFF1A{"match":true|false,"textOk":true|false,"reason":"\u4E00\u53E5\u8BDD\u7406\u7531"}` : `\u8FD9\u662F\u767D\u677F\u8BFE\u300C${ctx.sessionTitle}\u300D${ctx.kpTitle ? `\u77E5\u8BC6\u70B9\u300C${ctx.kpTitle}\u300D` : ""}\u7684\u4E00\u5F20\u6559\u5B66\u914D\u56FE\u3002\u56FE\u4E0B\u8BF4\u660E\uFF1A\u300C${ctx.caption}\u300D\u3002${ctx.why ? `\u8FD9\u5F20\u56FE\u7684\u4F5C\u7528\uFF1A${ctx.why}\u3002` : ""}
\u8BF7\u5224\u65AD\uFF1A1) \u753B\u9762\u5185\u5BB9\u4E0E\u8FD9\u4E2A\u77E5\u8BC6\u70B9\u548C\u8BF4\u660E\u662F\u5426\u76F8\u7B26\uFF08\u4E0D\u8981\u6C42\u7CBE\u786E\uFF0C\u80FD\u5E2E\u52A9\u7406\u89E3\u5373\u53EF\uFF09\uFF1B2) \u753B\u9762\u91CC\u6709\u6CA1\u6709\u6587\u5B57\u3001\u5B57\u6BCD\u6216\u6570\u5B57\uFF08\u5FFD\u7565\u89D2\u843D\u91CC\u6A21\u578B\u81EA\u5E26\u7684\u300CAI \u751F\u6210\u300D\u6C34\u5370\uFF09\u3002
\u53EA\u8F93\u51FA JSON\uFF1A{"match":true|false,"hasText":true|false,"reason":"\u4E00\u53E5\u8BDD\u7406\u7531"}` },
          { type: "image_url", image_url: { url: `data:${mime};base64,${bytes.toString("base64")}` } }
        ]
      }]
    }),
    signal: AbortSignal.timeout(6e4)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${data.error?.message ?? ""}`.trim());
  const u = splitUsage(data.usage);
  if (u) meter({ kind: "vision", model: cfg.model, in: u.miss, hit: u.hit, out: u.out });
  return parseVisionVerdict(data.choices?.[0]?.message?.content ?? "");
};
var g = globalThis;
var warn = (what, e) => console.warn(`[media] ${what}\u5931\u8D25\uFF1A${e?.message?.slice(0, 160) ?? e}`);
async function materializeImages(l, c, deps = {}) {
  const pending = l.steps.filter((s) => s.type === "say" && s.board?.kind === "image" && !s.board.imageId);
  if (!pending.length) return 0;
  const allowed = !!c.images && (!!deps.generate || !!imageConfig());
  if (!allowed) {
    for (const s of pending) delete s.board;
    return 0;
  }
  const ready = l.steps.filter((s) => s.type === "say" && s.board?.kind === "image" && s.board.imageId).length;
  const room = Math.max(0, IMAGE_LIMITS.perLesson - ready);
  for (const s of pending.slice(room)) delete s.board;
  const gen = deps.generate ?? ((p) => generateImage(p, "1152x864"));
  const check = deps.check ?? visionCheck;
  const save = deps.save ?? saveLessonImage;
  if (!deps.check && !visionConfig() && !g.__visionWarned) {
    g.__visionWarned = true;
    console.warn("[media] \u672A\u914D\u7F6E VISION_MODEL\uFF1A\u751F\u56FE\u677F\u4E66\u8DF3\u8FC7\u591A\u6A21\u6001\u81EA\u68C0");
  }
  const results = await Promise.all(pending.slice(0, room).map(async (s) => {
    const b = s.board;
    const kpTitle = s.kp ? l.sections?.[s.kp] : void 0;
    let spec = { ...b };
    let neutralized = false, simplified = false;
    const textsOf = (x) => x.panels?.length ? [...x.panels.map((p) => p.line).filter((y) => !!y), ...simplified ? [] : (x.mapping ?? []).map((m) => m.item), x.point ?? x.caption] : void 0;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const prompt = lessonImagePrompt(spec, { sessionTitle: c.sessionTitle, kpTitle });
      try {
        const bytes = await gen(prompt);
        let verdict = null;
        try {
          verdict = await check(bytes, { sessionTitle: c.sessionTitle, kpTitle, caption: spec.caption, why: spec.why, texts: textsOf(spec) });
        } catch (e) {
          warn(`\u914D\u56FE\u81EA\u68C0\u300C${spec.caption}\u300D`, e);
        }
        if (verdict && !verdict.ok) throw new Error(`\u81EA\u68C0\u4E0D\u5408\u683C\uFF08${verdict.reason}\uFF09`);
        const { _noTags: _t, ...clean2 } = spec;
        void _t;
        Object.assign(b, clean2);
        b.imageId = save({ sessionId: c.sessionId, role: b.role, prompt, bytes });
        if (attempt > 1) console.warn(`[media] \u914D\u56FE\u300C${b.caption}\u300D\u7B2C ${attempt} \u6B21\u4FEE\u590D\u540E\u6210\u529F${neutralized ? "\uFF08\u5DF2\u4E2D\u6027\u5316\uFF09" : ""}${simplified ? "\uFF08\u5DF2\u53BB\u6389\u753B\u5185\u6807\u7B7E\uFF09" : ""}`);
        return 1;
      } catch (e) {
        const kind = classifyGenError(e);
        warn(`\u914D\u56FE\u300C${spec.caption}\u300D\u7B2C ${attempt} \u6B21\uFF08${kind}\uFF09`, e);
        if (attempt === 4 || kind === "other") break;
        if (kind === "transient") {
          await sleep(backoffMs(attempt));
          continue;
        }
        if (kind === "sensitive" && !neutralized) {
          neutralized = true;
          spec = await neutralizeImage(spec);
          continue;
        }
        if (kind === "quality" && attempt >= 2 && !simplified && spec.mapping?.length) {
          simplified = true;
          spec = { ...spec, _noTags: true };
          continue;
        }
        if (kind === "sensitive") break;
        if (kind === "quality" && attempt >= 2) break;
      }
    }
    delete s.board;
    return 0;
  }));
  return results.reduce((a, x) => a + x, 0);
}

// ../../src/lib/lesson-media.ts
init_db();
var MAX_ANIMS = 1;
var warn2 = (what, e) => console.warn(`[media] ${what}\u5931\u8D25\uFF1A${e?.message?.slice(0, 160) ?? e}`);
function insertStep(steps, at, step) {
  steps.splice(at, 0, step);
  for (const s of steps) if (s.type === "say" && s.mark && s.mark.target >= at) s.mark.target++;
}
function gameInsertIndex(steps) {
  const closingKp = Math.max(0, ...steps.map((s) => s.kp ?? 0));
  let last = -1;
  for (let i = steps.length - 1; i >= 0; i--) if (steps[i].type === "say" && (steps[i].kp ?? closingKp) === closingKp) {
    last = i;
    break;
  }
  return last < 0 ? steps.length : last;
}
async function materializeAnims(l, c) {
  let made = 0;
  for (const s of l.steps) {
    if (s.type !== "say" || s.board?.kind !== "html" || s.board.variant === "game" || s.board.htmlId) continue;
    const b = s.board;
    if (made >= MAX_ANIMS || !b.brief) {
      delete s.board;
      continue;
    }
    made++;
    const brief = b.brief;
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const { html, provider } = await genAnimHtml({ title: b.title, brief, sessionTitle: c.sessionTitle, courseTitle: c.courseTitle, audience: c.audience });
        b.htmlId = saveLessonHtml({ sessionId: c.sessionId, kind: "anim", title: b.title, html, provider });
        delete b.brief;
        ok = true;
        if (attempt > 1) console.warn(`[media] \u52A8\u753B\u300C${b.title}\u300D\u7B2C ${attempt} \u6B21\u4FEE\u590D\u540E\u6210\u529F`);
      } catch (e) {
        const kind = classifyGenError(e);
        warn2(`\u52A8\u753B\u300C${b.title}\u300D\u7B2C ${attempt} \u6B21\uFF08${kind}\uFF09`, e);
        if (kind === "other" && attempt >= 2) break;
        if (kind === "transient") await sleep(backoffMs(attempt));
      }
    }
    if (!ok) delete s.board;
  }
  dropDanglingMarks(l);
}
function dropDanglingMarks(l) {
  l.steps.forEach((s) => {
    if (s.type === "say" && s.mark) {
      const t = l.steps[s.mark.target];
      if (!t || t.type !== "say" || !t.board) delete s.mark;
    }
  });
}
function boardGameOf(l) {
  for (const s of l.steps) if (s.type === "say" && s.board?.kind === "html" && s.board.variant === "game") return s.board;
  return null;
}
async function addBoardGame(l, c) {
  const existing = boardGameOf(l);
  if (existing) return existing.game ?? null;
  const retry = async (what, f) => {
    try {
      return await f();
    } catch (e) {
      const kind = classifyGenError(e);
      warn2(`${what}\u7B2C 1 \u6B21\uFF08${kind}\uFF09`, e);
      if (kind === "transient") await sleep(backoffMs(1));
      return f();
    }
  };
  const [spec0, html] = await Promise.all([
    retry("\u5C0F\u6E38\u620F\u73A9\u6CD5", () => genGameSpec({ sessionTitle: c.sessionTitle, lesson: l, purpose: "recap" })).catch((e) => {
      warn2("\u5C0F\u6E38\u620F\u73A9\u6CD5", e);
      return null;
    }),
    retry("\u5C0F\u6E38\u620F HTML", () => genConceptGameHtml({ sessionTitle: c.sessionTitle, courseTitle: c.courseTitle, audience: c.audience, lesson: l })).catch((e) => {
      warn2("\u5C0F\u6E38\u620F HTML", e);
      return null;
    })
  ]);
  const spec = spec0 ?? await genGameSpec({ sessionTitle: c.sessionTitle, lesson: l, purpose: "recap" }).catch((e) => {
    warn2("\u5C0F\u6E38\u620F\u73A9\u6CD5\uFF08\u8865\u751F\u6210\uFF09", e);
    return null;
  });
  if (!spec) return null;
  const title = (html?.title || spec?.title || L(`${c.sessionTitle}\u5C0F\u6E38\u620F`, `${c.sessionTitle} game`)).slice(0, contentLang() === "en" ? 40 : 24);
  const htmlId = html ? saveLessonHtml({ sessionId: c.sessionId, kind: "game", title, html: html.html, provider: html.provider }) : void 0;
  const kp = Math.max(0, ...l.steps.map((s) => s.kp ?? 0));
  insertStep(l.steps, gameInsertIndex(l.steps), {
    type: "say",
    kp,
    filler: true,
    text: L(`\u6700\u540E\u7ED9\u4F60\u7559\u4E86\u4E00\u4E2A\u5C0F\u6E38\u620F\u300C${title}\u300D\uFF0C\u5C31\u5728\u767D\u677F\u4E0A\uFF0C\u70B9\u5F00\u5C31\u80FD\u73A9\uFF0C\u4EB2\u624B\u628A\u8FD9\u8282\u8BFE\u7684\u6982\u5FF5\u6446\u4E00\u6446\u3002`, `Finally, there's a little game for you on the board, "${title}". Open it and play to put today's ideas together.`),
    board: { kind: "html", variant: "game", title, ...htmlId ? { htmlId } : {}, game: spec, caption: L("\u70B9\u5F00\u73A9\u4E00\u73A9\uFF1A\u628A\u8FD9\u8282\u8BFE\u7684\u6982\u5FF5\u4E32\u8D77\u6765", "Play it to connect today's ideas") }
  });
  return spec;
}
async function enrichLesson(l, c, imageDeps) {
  const [, , game] = await Promise.all([
    materializeAnims(l, c).catch((e) => warn2("\u52A8\u753B", e)),
    // R49：配图与动画并行；不允许生图时 materializeImages 会删掉所有待生成的图板书
    materializeImages(l, c, imageDeps).catch((e) => warn2("\u914D\u56FE", e)),
    addBoardGame(l, c)
  ]);
  for (const s of l.steps) if (s.type === "say" && s.board?.kind === "image" && !s.board.imageId) delete s.board;
  const before = auditLesson(l);
  let fixed = 0;
  for (const kind of new Set(before.map((x) => x.kind))) fixed += await fixOrphanNarration(l, kind).catch((e) => {
    warn2(`\u8BB2\u7A3F\u4F53\u68C0\uFF08${kind}\uFF09`, e);
    return 0;
  });
  const after = auditLesson(l);
  dropDanglingMarks(l);
  const planned = { images: l.steps.filter((s) => s.type === "say" && s.board?.kind === "image").length, anims: l.steps.filter((s) => s.type === "say" && s.board?.kind === "html" && s.board.variant !== "game").length };
  const report = { sessionId: c.sessionId, images: planned.images, anims: planned.anims, game: !!boardGameOf(l), issues: before.length, fixedSays: fixed, remaining: after.length };
  if (before.length || after.length) console.warn(`[media] \u8BB2\u7A3F\u4F53\u68C0\u300C${c.sessionTitle}\u300D\u53D1\u73B0 ${before.length} \u5904\u3001\u6539\u5199 ${fixed} \u53E5\u3001\u5269\u4F59 ${after.length} \u5904`);
  try {
    track(null, "lesson_gen_report", report);
  } catch {
  }
  return { recapGame: game ?? null };
}

// stub:/home/claude/stm/src/lib/websources.ts
var __stub7 = (n) => new Proxy(function() {
}, { apply() {
  return void 0;
}, get(t, k) {
  return k === Symbol.toPrimitive ? () => "" : k === "then" ? void 0 : __stub7(n + "." + String(k));
} });
var GROUP_LIMIT = __stub7("GROUP_LIMIT");
var runGroup = __stub7("runGroup");
var isJunkChunk = __stub7("isJunkChunk");
var chunkWebText = __stub7("chunkWebText");
var webSourcesOfRun = __stub7("webSourcesOfRun");
var fetchAndStore = __stub7("fetchAndStore");
var isLatinHeavy = __stub7("isLatinHeavy");
var retrieveWeb = __stub7("retrieveWeb");
var englishQueryOf = __stub7("englishQueryOf");
var webBasisFor = __stub7("webBasisFor");
var shortTitle = __stub7("shortTitle");

// stub:/home/claude/stm/src/lib/mastery.ts
var __stub8 = (n) => new Proxy(function() {
}, { apply() {
  return void 0;
}, get(t, k) {
  return k === Symbol.toPrimitive ? () => "" : k === "then" ? void 0 : __stub8(n + "." + String(k));
} });
var DAY = __stub8("DAY");
var levelFromSignals = __stub8("levelFromSignals");
var applyMonotonic = __stub8("applyMonotonic");
var examSignals = __stub8("examSignals");
var recomputeMastery = __stub8("recomputeMastery");
var contentResetAt = __stub8("contentResetAt");
var aggregateMin = __stub8("aggregateMin");
var PETALS = __stub8("PETALS");
var masteryHint = __stub8("masteryHint");

// ../../src/lib/interactive.ts
var GRAPHS = [
  { start: "A", nodes: "ABCDEF".split("").map((x) => ({ id: x, label: x })), edges: [["A", "B"], ["A", "C"], ["B", "D"], ["C", "D"], ["C", "E"], ["D", "F"], ["E", "F"]] },
  { start: "A", nodes: "ABCDEFG".split("").map((x) => ({ id: x, label: x })), edges: [["A", "B"], ["A", "D"], ["B", "C"], ["B", "E"], ["D", "E"], ["E", "F"], ["F", "G"], ["C", "G"]] }
];

// stub:/home/claude/stm/src/lib/credits.ts
var __stub9 = (n) => new Proxy(function() {
}, { apply() {
  return void 0;
}, get(t, k) {
  return k === Symbol.toPrimitive ? () => "" : k === "then" ? void 0 : __stub9(n + "." + String(k));
} });
var PRICING = __stub9("PRICING");
var PLANS = __stub9("PLANS");
var PRODUCTS = __stub9("PRODUCTS");
var product = __stub9("product");
var giftPlanId = __stub9("giftPlanId");
var giftProduct = __stub9("giftProduct");
var GRACE_DAYS = __stub9("GRACE_DAYS");
var PAY_FEE_RATE = __stub9("PAY_FEE_RATE");
var QuotaExceeded = __stub9("QuotaExceeded");
var dayStart = __stub9("dayStart");
var nextReset = __stub9("nextReset");
var dailyQuota = __stub9("dailyQuota");
var dailyUsed = __stub9("dailyUsed");
var dailyRemaining = __stub9("dailyRemaining");
var packBalance = __stub9("packBalance");
var ledgerBalance = __stub9("ledgerBalance");
var heldAmount = __stub9("heldAmount");
var UNLIMITED_CREDITS = __stub9("UNLIMITED_CREDITS");
var unlimitedCredits = __stub9("unlimitedCredits");
var availableBalance = __stub9("availableBalance");
var creditSummary = __stub9("creditSummary");
var postEntry = __stub9("postEntry");
var charge = __stub9("charge");
var hold = __stub9("hold");
var capture = __stub9("capture");
var release = __stub9("release");
var refund = __stub9("refund");
var releaseOrRefund = __stub9("releaseOrRefund");
var ledger = __stub9("ledger");
var activeHolds = __stub9("activeHolds");
var MEMBERSHIP_DAYS = __stub9("MEMBERSHIP_DAYS");
var memberPeriods = __stub9("memberPeriods");
var membership = __stub9("membership");
var isPaidMember = __stub9("isPaidMember");
var GUARD = __stub9("GUARD");
var costGuard = __stub9("costGuard");

// ../../src/lib/courses.ts
init_lang();
function estimateMinutes(l) {
  const chars = l.steps.reduce((a, s) => a + (s.type === "say" ? s.text.length : s.type === "check" || s.type === "quiz" ? s.prompt.length : 0), 0);
  const checks = l.steps.filter((s) => s.type === "check").length;
  const quizzes = l.steps.filter((s) => s.type === "quiz").length;
  const games = l.steps.filter((s) => s.type === "say" && s.board?.kind === "html" && s.board.variant === "game").length;
  const raw = Math.round(chars / 220 + checks * 2.5 + quizzes * 0.5 + games * 2 + 8);
  return Math.min(35, Math.max(15, raw));
}

// ../../src/lib/course-package/types.ts
var PACKAGE_SCHEMA_VERSION = "1.0";
var PACKAGE_KIND = "telleru.course";

// ../../src/lib/course-package/compile.ts
var PKG_LIMITS = {
  title: 40,
  summaryMin: 10,
  summary: 600,
  audience: 120,
  units: 12,
  lecturesPerUnit: 6,
  sessionsPerLecture: 3,
  sessions: 80,
  quoteMin: 6,
  quote: 400,
  practiceMin: 3,
  practiceMax: 8,
  sayHard: 240,
  stepsPerPart: 40,
  bytes: 4e6
};
var isStr2 = (v) => typeof v === "string";
var nonEmpty3 = (v) => isStr2(v) && v.trim().length > 0;
var len = (s) => tlen(s);
function quoteKey(s) {
  return normalizeText(s).toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}
function compilePackage(userId, raw, opts = {}) {
  const errors = [];
  const warnings = [];
  const E = (path3, message) => {
    errors.push({ path: path3, message });
  };
  const W = (path3, message) => {
    warnings.push({ path: path3, message });
  };
  const stats = { units: 0, lectures: 0, sessions: 0, withLesson: 0, withPractice: 0, cites: 0, images: 0, anims: 0 };
  let imageCount = 0, animCount = 0;
  const done = (compiled) => ({ result: { ok: errors.length === 0, errors: errors.slice(0, 200), warnings: warnings.slice(0, 200), stats }, compiled: errors.length ? null : compiled });
  const pkg = raw;
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
    E("", "\u8BFE\u7A0B\u5305\u5FC5\u987B\u662F\u4E00\u4E2A JSON \u5BF9\u8C61");
    return done(null);
  }
  try {
    if (JSON.stringify(pkg).length > PKG_LIMITS.bytes) {
      E("", `\u8BFE\u7A0B\u5305\u592A\u5927\uFF08> ${PKG_LIMITS.bytes / 1e6}MB\uFF09\uFF0C\u62C6\u6210\u51E0\u95E8\u8BFE\u6216\u5148\u53EA\u5199\u90E8\u5206\u8BFE\u8282\u7684\u8BB2\u7A3F`);
      return done(null);
    }
  } catch {
    E("", "\u8BFE\u7A0B\u5305\u65E0\u6CD5\u5E8F\u5217\u5316\u4E3A JSON");
    return done(null);
  }
  if (pkg.kind !== PACKAGE_KIND) E("kind", `kind \u5FC5\u987B\u662F "${PACKAGE_KIND}"`);
  if (pkg.schemaVersion !== PACKAGE_SCHEMA_VERSION) E("schemaVersion", `schemaVersion \u5FC5\u987B\u662F "${PACKAGE_SCHEMA_VERSION}"\uFF08\u5148\u8C03\u7528 get_course_format \u770B\u6700\u65B0\u683C\u5F0F\uFF09`);
  const c = pkg.course;
  if (!c || typeof c !== "object") E("course", "\u7F3A\u5C11 course");
  else {
    if (!nonEmpty3(c.title) || len(c.title) > PKG_LIMITS.title) E("course.title", `\u8BFE\u7A0B\u6807\u9898 1\u2013${PKG_LIMITS.title} \u5B57`);
    if (!nonEmpty3(c.summary) || len(c.summary) < PKG_LIMITS.summaryMin || len(c.summary) > PKG_LIMITS.summary) E("course.summary", `\u8BFE\u7A0B\u7B80\u4ECB ${PKG_LIMITS.summaryMin}\u2013${PKG_LIMITS.summary} \u5B57\uFF0C\u5EFA\u8BAE\u53E5\u5F0F\u300C\u4F60\u5C06\u4ECE\u2026\u51FA\u53D1\uFF0C\u638C\u63E1\u2026\uFF0C\u4EA7\u51FA\u2026\u300D`);
    if (!nonEmpty3(c.audience) || len(c.audience) > PKG_LIMITS.audience) E("course.audience", `\u76EE\u6807\u4EBA\u7FA4 1\u2013${PKG_LIMITS.audience} \u5B57\uFF08\u8BB2\u7A3F\u91CC\u7684\u4F8B\u5B50\u4F1A\u8D34\u5408\u5B83\uFF09`);
    if (c.tags !== void 0 && !(Array.isArray(c.tags) && c.tags.every(nonEmpty3))) E("course.tags", "tags \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4");
    if (c.project !== void 0 && !(c.project && nonEmpty3(c.project.name) && nonEmpty3(c.project.deliverable))) E("course.project", "project \u9700\u8981 name \u4E0E deliverable");
    if (c.language !== void 0 && c.language !== "zh" && c.language !== "en") E("course.language", "language \u53EA\u80FD\u662F zh \u6216 en\uFF08\u8BB2\u8BFE\u8BED\u8A00\uFF1B\u4E0D\u5199\u6309\u5185\u5BB9\u81EA\u52A8\u5224\u65AD\uFF09");
  }
  const sources = /* @__PURE__ */ new Map();
  const materialIds = [];
  let sourceSetId = null;
  if (pkg.sourceSetId !== void 0) {
    const ok = isStr2(pkg.sourceSetId) && get("SELECT 1 FROM runs WHERE id=? AND user_id=?", pkg.sourceSetId, userId);
    if (!ok) E("sourceSetId", "\u6765\u6E90\u96C6\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u4F60\uFF1A\u5148\u8C03\u7528 fetch_sources \u6293\u53D6\u7F51\u9875\uFF0C\u7528\u8FD4\u56DE\u7684 sourceSetId");
    else sourceSetId = pkg.sourceSetId;
  }
  if (pkg.sources !== void 0 && !Array.isArray(pkg.sources)) E("sources", "sources \u5FC5\u987B\u662F\u6570\u7EC4");
  (Array.isArray(pkg.sources) ? pkg.sources : []).forEach((s, i) => {
    const p = `sources[${i}]`;
    if (!s || !nonEmpty3(s.id) || !/^[A-Za-z0-9_-]{1,24}$/.test(s.id)) return E(`${p}.id`, "\u6765\u6E90 id \u5FC5\u987B\u662F 1\u201324 \u4F4D\u5B57\u6BCD\u6570\u5B57\uFF08\u5982 s1\uFF09");
    if (sources.has(s.id)) return E(`${p}.id`, `\u6765\u6E90 id\u300C${s.id}\u300D\u91CD\u590D`);
    if (s.kind === "web") {
      if (!sourceSetId) return E(p, "\u7F51\u9875\u6765\u6E90\u9700\u8981\u5148 fetch_sources\uFF0C\u5E76\u5728\u8BFE\u7A0B\u5305\u91CC\u5199 sourceSetId");
      const ws = get("SELECT id, title FROM web_sources WHERE run_id=? AND url=?", sourceSetId, s.url);
      if (!ws) return E(`${p}.url`, "\u8FD9\u4E2A\u7F51\u5740\u4E0D\u5728\u6765\u6E90\u96C6\u91CC\uFF08fetch_sources \u6CA1\u6293\u5230\u6216\u6293\u53D6\u5931\u8D25\uFF09");
      const chunks = all(
        "SELECT c.id, c.idx, c.heading, c.text, s.title, s.url, s.site, s.authoritative FROM web_chunks c JOIN web_sources s ON s.id=c.source_id WHERE c.source_id=? ORDER BY c.idx",
        ws.id
      );
      sources.set(s.id, { kind: "web", title: s.title || ws.title, url: s.url, chunks });
    } else if (s.kind === "material") {
      const m = get("SELECT id, filename, status FROM materials WHERE id=? AND user_id=?", s.materialId, userId);
      if (!m) return E(`${p}.materialId`, "\u6750\u6599\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u4F60\uFF08list_materials \u53EF\u4EE5\u67E5\u770B\u77E5\u8BC6\u5E93\u91CC\u7684\u6750\u6599\uFF09");
      if (m.status !== "ready") return E(`${p}.materialId`, "\u6750\u6599\u8FD8\u6CA1\u89E3\u6790\u5B8C\u6210");
      const chunks = all(
        "SELECT c.id, c.page, c.idx, c.text, c.material_id, m.filename, m.quality, m.page_kind FROM material_chunks c JOIN materials m ON m.id=c.material_id WHERE c.material_id=? ORDER BY c.page, c.idx",
        m.id
      );
      sources.set(s.id, { kind: "material", title: s.title || m.filename, materialId: m.id, chunks });
      materialIds.push(m.id);
    } else E(`${p}.kind`, "kind \u53EA\u80FD\u662F web \u6216 material");
  });
  const resolveCite = (ct, path3, claim) => {
    if (!ct || !nonEmpty3(ct.source)) {
      E(path3, "\u5F15\u7528\u9700\u8981 source\uFF08\u6765\u6E90 id\uFF09");
      return null;
    }
    const src = sources.get(ct.source);
    if (!src) {
      E(`${path3}.source`, `\u6765\u6E90\u300C${ct.source}\u300D\u6CA1\u6709\u5728 sources \u91CC\u58F0\u660E`);
      return null;
    }
    if (!nonEmpty3(ct.quote) || len(ct.quote.trim()) < PKG_LIMITS.quoteMin || len(ct.quote) > PKG_LIMITS.quote) {
      E(`${path3}.quote`, `quote \u662F\u4ECE\u539F\u6587\u9010\u5B57\u6458\u51FA\u7684\u53E5\u5B50\uFF0C${PKG_LIMITS.quoteMin}\u2013${PKG_LIMITS.quote} \u5B57`);
      return null;
    }
    const key = quoteKey(ct.quote);
    if (key.length < 4) {
      E(`${path3}.quote`, "quote \u53BB\u6389\u6807\u70B9\u540E\u592A\u77ED");
      return null;
    }
    if (src.kind === "material") {
      if (!Number.isInteger(ct.page) || ct.page < 1) {
        E(`${path3}.page`, "\u6750\u6599\u5F15\u7528\u5FC5\u987B\u5199\u9875\u7801 page\uFF08\u4ECE 1 \u5F00\u59CB\uFF09");
        return null;
      }
      const onPage = src.chunks.filter((x) => x.page === ct.page);
      if (!onPage.length) {
        E(`${path3}.page`, `\u300A${src.title}\u300B\u6CA1\u6709\u7B2C ${ct.page} \u9875\u7684\u6587\u5B57`);
        return null;
      }
      const hit2 = findChunk(onPage, key);
      if (!hit2) {
        E(`${path3}.quote`, `\u5728\u300A${src.title}\u300B\u7B2C ${ct.page} \u9875\u627E\u4E0D\u5230\u8FD9\u53E5\u8BDD\uFF1A\u300C${ct.quote.slice(0, 30)}\u300D\uFF08\u8981\u9010\u5B57\u6458\u81EA\u539F\u6587\uFF0C\u53EF\u4EE5\u53EA\u6458\u4E00\u90E8\u5206\uFF09`);
        return null;
      }
      return { chunkId: hit2.id, materialId: hit2.material_id, filename: hit2.filename, page: hit2.page, excerpt: ct.quote.trim().slice(0, 160), coarse: hit2.quality === "low_quality", kind: "material", ...hit2.page_kind === "logical" ? { approx: true } : {} };
    }
    const hit = findChunk(src.chunks, key);
    if (!hit) {
      E(`${path3}.quote`, `\u5728\u300C${src.title}\u300D\u91CC\u627E\u4E0D\u5230\u8FD9\u53E5\u8BDD\uFF1A\u300C${ct.quote.slice(0, 30)}\u300D\uFF08\u8981\u9010\u5B57\u6458\u81EA fetch_sources / read_source \u8FD4\u56DE\u7684\u539F\u6587\uFF09`);
      return null;
    }
    const cite = webCitation({ id: hit.id, text: hit.text, filename: hit.title, url: hit.url, site: hit.site, authoritative: !!hit.authoritative }, claim);
    cite.excerpt = ct.quote.trim().length <= 100 ? ct.quote.trim() : cite.excerpt;
    return cite;
  };
  const units = Array.isArray(pkg.units) ? pkg.units : [];
  if (!units.length || units.length > PKG_LIMITS.units) E("units", `\u5355\u5143 1\u2013${PKG_LIMITS.units} \u4E2A`);
  const out = [];
  units.forEach((u, ui) => {
    const up = `units[${ui}]`;
    if (!u || typeof u !== "object") return E(up, "\u5355\u5143\u5FC5\u987B\u662F\u5BF9\u8C61");
    stats.units++;
    if (!nonEmpty3(u.title)) E(`${up}.title`, "\u5355\u5143\u9700\u8981 title");
    if (!nonEmpty3(u.goal)) E(`${up}.goal`, "\u5355\u5143\u9700\u8981 goal\uFF082\u20133 \u53E5\uFF1A\u5B66\u4EC0\u4E48\u3001\u4E3A\u4EC0\u4E48\u91CD\u8981\u3001\u4E3A\u9879\u76EE\u4EA7\u51FA\u4EC0\u4E48\uFF09");
    if (!nonEmpty3(u.projectStageDetail)) E(`${up}.projectStageDetail`, "\u5355\u5143\u9700\u8981 projectStageDetail\uFF08\u542B\u6570\u5B57\u4E0E\u4EA4\u4ED8\u7269\u7684\u5177\u4F53\u4EFB\u52A1\uFF09");
    if (!nonEmpty3(u.examScope)) E(`${up}.examScope`, "\u5355\u5143\u9700\u8981 examScope\uFF08\u4EE5\u300C\u68C0\u9A8C\u4F60\u662F\u5426\u80FD\u300D\u5F00\u5934\uFF09");
    const lecs = Array.isArray(u.lectures) ? u.lectures : [];
    if (!lecs.length || lecs.length > PKG_LIMITS.lecturesPerUnit) E(`${up}.lectures`, `\u6BCF\u4E2A\u5355\u5143 1\u2013${PKG_LIMITS.lecturesPerUnit} \u4E2A\u8BB2\u6B21`);
    const cu = {
      title: String(u.title ?? ""),
      goal: String(u.goal ?? ""),
      projectStageTitle: nonEmpty3(u.projectStageTitle) ? u.projectStageTitle : null,
      projectStageDetail: String(u.projectStageDetail ?? ""),
      examTitle: nonEmpty3(u.examTitle) ? u.examTitle : null,
      examScope: String(u.examScope ?? ""),
      lectures: []
    };
    lecs.forEach((l, li) => {
      const lp = `${up}.lectures[${li}]`;
      if (!l || typeof l !== "object") return E(lp, "\u8BB2\u6B21\u5FC5\u987B\u662F\u5BF9\u8C61");
      stats.lectures++;
      if (!nonEmpty3(l.title)) E(`${lp}.title`, "\u8BB2\u6B21\u9700\u8981 title\uFF08\u5EFA\u8BAE\u300C\u6BD4\u55BB\u524D\u7F00\uFF1A\u5185\u5BB9\u300D\uFF09");
      if (!isStr2(l.summary)) E(`${lp}.summary`, "\u8BB2\u6B21\u9700\u8981 summary");
      const ss = Array.isArray(l.sessions) ? l.sessions : [];
      if (!ss.length || ss.length > PKG_LIMITS.sessionsPerLecture) E(`${lp}.sessions`, `\u6BCF\u4E2A\u8BB2\u6B21 1\u2013${PKG_LIMITS.sessionsPerLecture} \u4E2A\u8BFE\u8282`);
      const cl = { title: String(l.title ?? ""), summary: String(l.summary ?? ""), basis: null, sessions: [] };
      ss.forEach((s, si) => {
        const sp = `${lp}.sessions[${si}]`;
        if (!s || typeof s !== "object") return E(sp, "\u8BFE\u8282\u5FC5\u987B\u662F\u5BF9\u8C61");
        stats.sessions++;
        if (!nonEmpty3(s.title)) E(`${sp}.title`, "\u8BFE\u8282\u9700\u8981 title\uFF08\u95EE\u53E5\u6216\u94A9\u5B50\uFF0C\u5305\u542B\u6838\u5FC3\u672F\u8BED\uFF09");
        let depth = [DEPTHS[0]];
        if (s.depth !== void 0) {
          if (!Array.isArray(s.depth) || !s.depth.length || s.depth.length > 3 || !s.depth.every((d) => DEPTHS.includes(d))) E(`${sp}.depth`, `depth \u4ECE ${DEPTHS.join(" / ")} \u91CC\u9009 1\u20133 \u4E2A`);
          else depth = s.depth;
        }
        const lesson = s.lesson === void 0 ? null : compileLesson(s.lesson, `${sp}.lesson`, String(s.title ?? ""));
        if (s.lesson === void 0) {
          if (opts.requireLessons) E(`${sp}.lesson`, "\u8FD9\u91CC\u8981\u6C42\u6BCF\u4E2A\u8BFE\u8282\u90FD\u5199\u8BB2\u7A3F");
          else W(`${sp}.lesson`, "\u6CA1\u6709\u8BB2\u7A3F\uFF1A\u5B66\u4E60\u8005\u5B66\u5230\u8FD9\u8282\u65F6\u7531 TellerU \u6309\u6807\u9898\u751F\u6210\uFF08\u4F1A\u6D88\u8017 TellerU \u7684\u6A21\u578B\u989D\u5EA6\uFF09");
        } else stats.withLesson++;
        let practice = null;
        if (s.practice !== void 0) {
          practice = compilePractice(s.practice, `${sp}.practice`);
          stats.withPractice++;
        } else if (lesson) W(`${sp}.practice`, "\u6CA1\u6709\u7EC3\u4E60\uFF1A\u5B66\u5230\u8FD9\u8282\u65F6\u7531 TellerU \u6309\u8BB2\u7A3F\u8865\u51FA\u7EC3\u4E60");
        let est = lesson ? estimateMinutes(lesson) : 25;
        if (s.estMinutes !== void 0) {
          if (!Number.isFinite(s.estMinutes) || s.estMinutes < 15 || s.estMinutes > 35) W(`${sp}.estMinutes`, "estMinutes \u5E94\u5728 15\u201335\uFF0C\u5DF2\u6309\u8BB2\u7A3F\u957F\u5EA6\u4F30\u7B97");
          else if (!lesson) est = Math.round(s.estMinutes);
        }
        cl.sessions.push({ path: sp, id: isStr2(s.id) ? s.id : void 0, title: String(s.title ?? ""), depth, estMinutes: est, lesson, practice });
      });
      cu.lectures.push(cl);
    });
    out.push(cu);
  });
  if (stats.sessions > PKG_LIMITS.sessions) E("units", `\u8BFE\u8282\u603B\u6570 ${stats.sessions}\uFF0C\u6700\u591A ${PKG_LIMITS.sessions}`);
  for (const u of out) for (const l of u.lectures) {
    const cites = l.sessions.flatMap((s) => (s.lesson?.steps ?? []).flatMap((st) => st.type === "say" ? st.citations ?? [] : []));
    const pages = [...new Set(cites.filter((x) => x.kind !== "web").map((x) => x.page))].sort((a, b) => a - b);
    const titles = [...new Set(cites.filter((x) => x.kind === "web").map((x) => x.sourceTitle ?? x.filename))].slice(0, 2);
    l.basis = pages.length ? `\u6559\u6750 P${pages[0]}${pages.length > 1 ? `\u2013${pages[pages.length - 1]}` : ""}` : titles.length ? titles.map((t) => `\u300A${t.slice(0, 30)}\u300B`).join("") : null;
  }
  return done({
    course: {
      title: String(c?.title ?? "").trim(),
      summary: String(c?.summary ?? "").trim(),
      audience: String(c?.audience ?? "").trim(),
      tags: (c?.tags ?? []).map((t) => t.startsWith("#") ? t : `#${t}`).slice(0, 6),
      project: c?.project ?? { name: `\u300A${String(c?.title ?? "").slice(0, 20)}\u300B\u5B66\u4E60\u624B\u518C`, deliverable: "\u6BCF\u5355\u5143\u5B8C\u6210\u4E00\u7AE0\u7B14\u8BB0\uFF0C\u5B66\u5B8C\u6C47\u6210\u4E00\u672C\u81EA\u5DF1\u7684\u5B66\u4E60\u624B\u518C" },
      style: nonEmpty3(c?.style) ? c.style.slice(0, 120) : null,
      lang: courseLanguage(pkg)
    },
    sourceSetId,
    materialIds,
    units: out
  });
  function compileLesson(l, p, sessionTitle) {
    if (!l || typeof l !== "object") {
      E(p, "lesson \u5FC5\u987B\u662F\u5BF9\u8C61");
      return null;
    }
    imageCount = 0;
    animCount = 0;
    const before = errors.length;
    if (!Array.isArray(l.openingQuestions) || l.openingQuestions.length !== 3 || !l.openingQuestions.every(nonEmpty3)) E(`${p}.openingQuestions`, "\u5F00\u573A\u4E09\u95EE\uFF1A\u6070\u597D 3 \u4E2A\u95EE\u9898\uFF0C\u4E0E 3 \u4E2A\u77E5\u8BC6\u70B9\u4E00\u4E00\u5BF9\u5E94");
    if (!Array.isArray(l.points) || l.points.length !== 3) {
      E(`${p}.points`, "\u6070\u597D 3 \u4E2A\u77E5\u8BC6\u70B9");
      return null;
    }
    if (!l.closing || typeof l.closing !== "object") {
      E(`${p}.closing`, "\u7F3A\u5C11 closing");
      return null;
    }
    if (!Array.isArray(l.closing.summary) || !l.closing.summary.length || l.closing.summary.length > 5 || !l.closing.summary.every(nonEmpty3)) E(`${p}.closing.summary`, "\u6536\u5C3E\u8981\u70B9 1\u20135 \u6761");
    if (!nonEmpty3(l.closing.next)) E(`${p}.closing.next`, "closing.next\uFF1A\u4E0B\u4E00\u8282\u7684\u94A9\u5B50\uFF08\u4E00\u53E5\u8BDD\uFF09");
    const parts = [];
    parts.push({ kp: 0, steps: compileSteps(l.opening, `${p}.opening`, "opening") });
    l.points.forEach((pt, i) => {
      const pp = `${p}.points[${i}]`;
      if (!pt || typeof pt !== "object") return E(pp, "\u77E5\u8BC6\u70B9\u5FC5\u987B\u662F\u5BF9\u8C61");
      if (!nonEmpty3(pt.title)) E(`${pp}.title`, "\u77E5\u8BC6\u70B9\u9700\u8981 title\uFF08\u767D\u677F\u5206\u5C4F\u6807\u9898\uFF09");
      if (!nonEmpty3(pt.objective)) E(`${pp}.objective`, "\u77E5\u8BC6\u70B9\u9700\u8981 objective\uFF08\u8BFE\u5802\u8981\u70B9\uFF1A\u5B66\u5B8C\u4F60\u80FD\u2026\uFF09");
      if (!pt.reward || !nonEmpty3(pt.reward.concept) || !nonEmpty3(pt.reward.desc)) E(`${pp}.reward`, "\u77E5\u8BC6\u70B9\u9700\u8981 reward\uFF1A{concept, desc}\uFF08\u7B54\u5BF9\u68C0\u67E5\u9898\u540E\u5F39\u51FA\u7684\u6982\u5FF5\u5361\uFF09");
      const steps2 = compileSteps(pt.steps, `${pp}.steps`, "point");
      const says = steps2.filter((s) => s.type === "say" && !s.filler).length;
      if (says < 4) E(`${pp}.steps`, `\u77E5\u8BC6\u70B9\u81F3\u5C11 4 \u6BB5\u5B9E\u8D28\u53E3\u64AD\uFF08\u73B0\u5728 ${says} \u6BB5\uFF09\uFF0C\u5EFA\u8BAE 8\u201314 \u6BB5`);
      if (!steps2.some((s) => s.type === "quiz" || s.type === "check")) E(`${pp}.steps`, "\u6BCF\u4E2A\u77E5\u8BC6\u70B9\u81F3\u5C11 1 \u9053\u5FEB\u6D4B quiz \u6216\u68C0\u67E5\u9898 check");
      parts.push({ kp: i + 1, objective: i, steps: steps2, reward: pt.reward ? { concept: String(pt.reward.concept ?? ""), desc: String(pt.reward.desc ?? "") } : void 0 });
    });
    const closingSteps = compileSteps(l.closing.steps, `${p}.closing.steps`, "closing");
    if (!closingSteps.some((s) => s.type === "say")) E(`${p}.closing.steps`, "\u6536\u5C3E\u81F3\u5C11 1 \u6BB5\u53E3\u64AD");
    parts.push({ kp: 4, steps: closingSteps });
    if (l.glossary !== void 0 && !(Array.isArray(l.glossary) && l.glossary.every((g3) => g3 && nonEmpty3(g3.term) && nonEmpty3(g3.def)))) E(`${p}.glossary`, "glossary \u662F {term, def} \u6570\u7EC4");
    parts.forEach((part, pi) => {
      const ids = /* @__PURE__ */ new Map();
      const dropped = /* @__PURE__ */ new Set();
      part.steps.forEach((s, si) => {
        if (s.type !== "say") return;
        const sp = `${p}.${pi === 0 ? "opening" : pi === 4 ? "closing.steps" : `points[${pi - 1}].steps`}[${si}]`;
        const d = s._droppedId;
        if (d) {
          dropped.add(d);
          delete s._droppedId;
        }
        const m = s.mark;
        if (m && dropped.has(String(m.ref))) {
          delete s.mark;
          return;
        }
        if (m) {
          const target = ids.get(String(m.ref));
          if (!ids.has(String(m.ref))) E(`${sp}.mark.ref`, `mark.ref\u300C${m.ref}\u300D\u5FC5\u987B\u662F\u672C\u6BB5\u66F4\u65E9\u4E00\u6761\u5E26\u677F\u4E66\u53E3\u64AD\u7684 id`);
          else if (m.text && !JSON.stringify(target).includes(m.text)) E(`${sp}.mark.text`, `mark.text\u300C${m.text}\u300D\u5FC5\u987B\u539F\u6837\u51FA\u73B0\u5728\u88AB\u5708\u753B\u7684\u677F\u4E66\u91CC`);
        }
        const id = s.id;
        if (id !== void 0) {
          if (!s.board) E(`${sp}.id`, "\u53EA\u6709\u5E26 board \u7684\u53E3\u64AD\u624D\u9700\u8981 id");
          else if (ids.has(id)) E(`${sp}.id`, `\u677F\u4E66 id\u300C${id}\u300D\u5728\u672C\u6BB5\u91CD\u590D`);
          else ids.set(id, s.board);
        }
      });
    });
    if (errors.length > before) return null;
    parts.forEach((part, pi) => {
      const quizzes = part.steps.filter((s) => s.type === "quiz");
      const at = new Map(quizzes.map((q) => [q, part.steps.indexOf(q)]));
      if (!relocateUngroundedQuizzes(part.steps)) return;
      const where = pi === 0 ? "\u5F00\u573A" : pi === 4 ? "\u6536\u5C3E" : `\u77E5\u8BC6\u70B9 ${pi}`;
      for (const q of quizzes) {
        const to = part.steps.indexOf(q);
        if (to === at.get(q)) continue;
        const prompt = String(q.prompt ?? "").slice(0, 30);
        W(`${p}`, `\u5FEB\u6D4B\u300C${prompt}\u300D\u5728\u539F\u4F4D\u7F6E\u524D 3 \u6BB5\u91CC\u627E\u4E0D\u5230\u7B54\u6848\u4F9D\u636E\uFF0C\u5DF2\u8FDE\u540C\u8FC7\u6E21\u53E5\u524D\u79FB\u5230${where}\u7B2C ${to + 1} \u6B65\uFF08\u7D27\u8DDF\u8BB2\u51FA\u7B54\u6848\u7684\u53E3\u64AD\u4E4B\u540E\uFF09\uFF1B\u60F3\u4FDD\u6301\u539F\u987A\u5E8F\uFF0C\u5C31\u5728\u9898\u76EE\u524D 1\u20133 \u6BB5\u91CC\u8BB2\u51FA\u7B54\u6848\u8981\u70B9`);
      }
    });
    if (opts.assets && opts.requireImages !== false) {
      const imgs = parts.flatMap((pt) => pt.steps).filter((x) => x.type === "say" && x.board?.kind === "image").length;
      if (!imgs) E(`${p}`, `\u6807\u51C6\u914D\u7F6E\uFF1A\u6BCF\u8282\u81F3\u5C11 1 \u5F20\u751F\u56FE\u677F\u4E66\uFF08\u63A8\u8350\u6848\u4F8B\u6F2B\u753B kind "image" + panels\uFF0C\u6700\u591A ${IMAGE_LIMITS.perLesson} \u5F20\uFF09\uFF0C\u5199\u6784\u60F3\u5373\u53EF\uFF0C\u5BFC\u5165\u540E TellerU \u751F\u6210\uFF1B\u8D39\u7528\u89C1 validate_course \u7684 credits \u62A5\u4EF7`);
    }
    let steps = assembleLesson(parts);
    const g2 = validateQuizGrounding(steps, void 0, `\u8BFE\u8282\u300C${sessionTitle}\u300D`);
    for (const d of g2.dropped) W(`${p}`, `\u5FEB\u6D4B\u300C${d.prompt.slice(0, 30)}\u300D\u7684\u7B54\u6848\u5728\u524D 3 \u6BB5\u53E3\u64AD / \u677F\u4E66\u91CC\u627E\u4E0D\u5230\u4F9D\u636E\uFF0C\u5DF2\u53BB\u6389\uFF08\u5148\u8BB2\u51FA\u7B54\u6848\u8981\u70B9\u518D\u51FA\u9898\uFF09`);
    steps = g2.steps;
    const lesson = {
      openingQuestions: l.openingQuestions,
      objectives: l.points.map((x) => String(x.objective)),
      steps,
      closing: { summary: l.closing.summary.map(String), next: String(l.closing.next) },
      glossary: (l.glossary ?? []).map((x) => ({ term: String(x.term), def: String(x.def) })),
      references: (l.references ?? []).filter((r) => r && nonEmpty3(r.title)).map((r) => ({ title: String(r.title), why: String(r.why ?? "") })),
      sections: ["\u672C\u8282\u8BFE\u6982\u89C8", ...l.points.map((x) => String(x.title)), nonEmpty3(l.closing.title) ? l.closing.title : "\u5C0F\u7ED3"],
      noMaterial: !steps.some((s) => s.type === "say" && s.citations?.some((x) => x.kind !== "web")),
      provider: "agent"
    };
    finalizeLesson(lesson, sessionTitle);
    for (const q of lessonQuotaIssues(lesson.steps)) W(p, `\u677F\u4E66\u914D\u989D\uFF1A${q}\uFF08\u80FD\u5BFC\u5165\uFF1B\u5EFA\u8BAE\u6BCF\u4E2A\u77E5\u8BC6\u70B9 \u2265 2 \u4E2A\u8868\u683C / \u6D41\u7A0B\u56FE\u7B49\u7ED3\u6784\u5316\u677F\u4E66\uFF09`);
    return lesson;
  }
  function compileSteps(arr, p, part) {
    if (!Array.isArray(arr)) {
      E(p, "steps \u5FC5\u987B\u662F\u6570\u7EC4");
      return [];
    }
    if (arr.length > PKG_LIMITS.stepsPerPart) E(p, `\u6BCF\u6BB5\u6700\u591A ${PKG_LIMITS.stepsPerPart} \u6B65`);
    const outSteps = [];
    arr.forEach((s, i) => {
      const sp = `${p}[${i}]`;
      if (!s || typeof s !== "object") return E(sp, "\u6B65\u9AA4\u5FC5\u987B\u662F\u5BF9\u8C61");
      if (s.type === "say") {
        if (!nonEmpty3(s.text)) return E(`${sp}.text`, "\u53E3\u64AD text \u4E0D\u80FD\u4E3A\u7A7A");
        if (len(s.text) > PKG_LIMITS.sayHard) return E(`${sp}.text`, `\u53E3\u64AD\u592A\u957F\uFF08${len(s.text)} \u5B57\uFF09\uFF0C\u6BCF\u6BB5 \u2264 ${SAY_MAX_CHARS} \u5B57\uFF0C\u62C6\u6210\u51E0\u6BB5`);
        if (len(s.text) > SAY_MAX_CHARS) W(`${sp}.text`, `\u53E3\u64AD ${len(s.text)} \u5B57\uFF0C\u8D85\u8FC7 ${SAY_MAX_CHARS} \u5B57\uFF0C\u5DF2\u6309\u53E5\u5207\u5F00`);
        let board = s.board;
        if (board !== void 0) {
          const why = validateBoard(board);
          if (why) {
            E(`${sp}.board`, why);
            board = void 0;
          } else if (board.kind === "image") {
            if (board.imageId) {
              if (!get("SELECT 1 FROM lesson_images WHERE id=?", board.imageId)) {
                E(`${sp}.board.imageId`, "imageId \u4E0D\u5B58\u5728\uFF1A\u65B0\u56FE\u4E0D\u8981\u5199 imageId\uFF0C\u5199 role / why / prompt\uFF08\u6216\u6F2B\u753B panels\uFF09\u7531 TellerU \u751F\u6210");
                board = void 0;
              }
            } else if (!opts.assets) {
              W(`${sp}.board`, "\u751F\u56FE\u677F\u4E66\u53EA\u7ED9\u4F1A\u5458\u751F\u6210\uFF08R49\uFF09\uFF0C\u5DF2\u53BB\u6389\uFF08\u4FDD\u7559\u53E3\u64AD\uFF09");
              board = void 0;
            } else if (++imageCount > IMAGE_LIMITS.perLesson) {
              W(`${sp}.board`, `\u6BCF\u8282\u6700\u591A ${IMAGE_LIMITS.perLesson} \u5F20\u751F\u56FE\uFF0C\u8FD9\u5F20\u5DF2\u53BB\u6389`);
              board = void 0;
            }
          } else if (board.kind === "html" && board.variant !== "game") {
            if (board.htmlId) {
              if (!get("SELECT 1 FROM lesson_html WHERE id=?", board.htmlId)) {
                E(`${sp}.board.htmlId`, "htmlId \u4E0D\u5B58\u5728\uFF1A\u65B0\u52A8\u753B\u4E0D\u8981\u5199 htmlId\uFF0C\u5199 title + brief \u7531 TellerU \u751F\u6210");
                board = void 0;
              }
            } else if (++animCount > 1) {
              W(`${sp}.board`, "\u6BCF\u8282\u6700\u591A 1 \u4E2A\u6982\u5FF5\u52A8\u753B\uFF0C\u8FD9\u4E2A\u5DF2\u53BB\u6389");
              board = void 0;
            }
          } else if (board.kind === "html" && board.variant === "game") {
            if (board.htmlId && get("SELECT 1 FROM lesson_html WHERE id=?", board.htmlId)) {
            } else if (!board.game) {
              E(`${sp}.board.game`, "\u5C0F\u6E38\u620F\u5FC5\u987B\u5E26\u5185\u7F6E\u73A9\u6CD5 game\uFF08sort / order / match\uFF09");
              board = void 0;
            } else board = { kind: "html", title: board.title, variant: "game", game: board.game, ...board.caption ? { caption: board.caption } : {}, ...board.figId ? { figId: board.figId } : {} };
          }
        }
        if (board?.kind === "image" && !board.imageId) stats.images++;
        if (board?.kind === "html" && board.variant !== "game" && !board.htmlId) stats.anims++;
        const cites = [];
        if (s.cite !== void 0) {
          if (!Array.isArray(s.cite)) E(`${sp}.cite`, "cite \u5FC5\u987B\u662F\u6570\u7EC4");
          else s.cite.slice(0, 3).forEach((ct, k) => {
            const r = resolveCite(ct, `${sp}.cite[${k}]`, s.text);
            if (r && !cites.some((x) => x.chunkId === r.chunkId)) cites.push(r);
          });
          if (Array.isArray(s.cite) && s.cite.length > 3) W(`${sp}.cite`, "\u6BCF\u6BB5\u53E3\u64AD\u6700\u591A 3 \u6761\u5F15\u7528\uFF0C\u591A\u4F59\u7684\u5DF2\u5FFD\u7565");
        }
        stats.cites += cites.length;
        const droppedBoard = s.board !== void 0 && !board;
        const step = {
          type: "say",
          text: s.text.trim(),
          ...board ? { board } : {},
          ...nonEmpty3(s.id) && board ? { id: s.id } : {},
          ...nonEmpty3(s.id) && droppedBoard ? { _droppedId: s.id } : {},
          ...s.mark ? { mark: { ref: String(s.mark.ref ?? ""), style: s.mark.style, ...nonEmpty3(s.mark.text) ? { text: s.mark.text } : {} } } : {},
          ...s.filler ? { filler: true } : {},
          ...cites.length ? { citations: cites, citeChunkIds: cites.map((x) => x.chunkId) } : !s.filler ? { aiSupplement: true } : {},
          ...Number.isInteger(s.panel) ? { panel: s.panel } : {}
        };
        if (s.mark && !["circle", "highlight", "underline"].includes(String(s.mark.style))) E(`${sp}.mark.style`, "mark.style \u53EA\u80FD\u662F circle / highlight / underline");
        outSteps.push(...splitLongSays([step]));
      } else if (s.type === "quiz") {
        if (!nonEmpty3(s.prompt)) E(`${sp}.prompt`, "\u5FEB\u6D4B\u9700\u8981 prompt");
        if (!Array.isArray(s.options) || s.options.length < 2 || s.options.length > 4 || !s.options.every(nonEmpty3)) E(`${sp}.options`, "\u5FEB\u6D4B 2\u20134 \u4E2A\u9009\u9879");
        else if (!Number.isInteger(s.answer) || s.answer < 0 || s.answer >= s.options.length) E(`${sp}.answer`, "answer \u662F\u6B63\u786E\u9009\u9879\u7684\u4E0B\u6807\uFF08\u4ECE 0 \u5F00\u59CB\uFF09");
        if (!nonEmpty3(s.explain)) E(`${sp}.explain`, "\u5FEB\u6D4B\u9700\u8981 explain\uFF08\u4E3A\u4EC0\u4E48\u5BF9\uFF09");
        if (part === "opening") W(sp, "\u5F00\u573A\u4E00\u822C\u4E0D\u653E\u5FEB\u6D4B");
        outSteps.push({ type: "quiz", prompt: String(s.prompt ?? ""), options: (s.options ?? []).map(String), answer: Number(s.answer), explain: String(s.explain ?? ""), objective: 0 });
      } else if (s.type === "check") {
        if (!nonEmpty3(s.prompt) || !nonEmpty3(s.expected) || !nonEmpty3(s.commonError)) E(sp, "\u68C0\u67E5\u9898\u9700\u8981 prompt\u3001expected\uFF08\u53C2\u8003\u7B54\u6848\uFF09\u3001commonError\uFF08\u5E38\u89C1\u9519\u8BEF\uFF09");
        const variant = part === "closing" ? "recap" : s.variant === "apply" ? "apply" : "point";
        outSteps.push({ type: "check", prompt: String(s.prompt ?? ""), expected: String(s.expected ?? ""), commonError: String(s.commonError ?? ""), variant, objective: 0 });
      } else E(`${sp}.type`, "type \u53EA\u80FD\u662F say / quiz / check\uFF08\u5956\u52B1\u5361\u5199\u5728\u77E5\u8BC6\u70B9\u7684 reward \u91CC\uFF09");
    });
    return outSteps;
  }
  function compilePractice(arr, p) {
    if (!Array.isArray(arr) || arr.length < PKG_LIMITS.practiceMin || arr.length > PKG_LIMITS.practiceMax) {
      E(p, `\u7EC3\u4E60 ${PKG_LIMITS.practiceMin}\u2013${PKG_LIMITS.practiceMax} \u9898`);
      return null;
    }
    const before = errors.length;
    const ids = /* @__PURE__ */ new Set();
    const out_ = [];
    arr.forEach((q, i) => {
      const qp = `${p}[${i}]`;
      if (!q || typeof q !== "object") return E(qp, "\u9898\u76EE\u5FC5\u987B\u662F\u5BF9\u8C61");
      const id = nonEmpty3(q.id) ? q.id : `q${i + 1}`;
      if (ids.has(id)) E(`${qp}.id`, `\u9898\u76EE id\u300C${id}\u300D\u91CD\u590D`);
      ids.add(id);
      if (!nonEmpty3(q.stem)) E(`${qp}.stem`, "\u9898\u5E72 stem \u4E0D\u80FD\u4E3A\u7A7A");
      if (!nonEmpty3(q.explanation)) E(`${qp}.explanation`, "\u9700\u8981 explanation\uFF08\u89E3\u6790\uFF0C\u8BF4\u660E\u4E3A\u4EC0\u4E48\u3001\u5E38\u89C1\u9519\u5728\u54EA\uFF09");
      const hint = nonEmpty3(q.hint) ? q.hint : "";
      if (!hint) W(`${qp}.hint`, "\u5EFA\u8BAE\u5199\u4E00\u53E5\u63D0\u793A hint");
      if (q.type === "single" || q.type === "multi") {
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6 || !q.options.every(nonEmpty3)) return E(`${qp}.options`, "\u9009\u9879 2\u20136 \u4E2A");
        if (q.type === "single") {
          if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) return E(`${qp}.answer`, "\u5355\u9009 answer \u662F\u6B63\u786E\u9009\u9879\u4E0B\u6807");
          out_.push({ id, type: "single", stem: q.stem, options: q.options, answer: q.answer, explanation: q.explanation, hint });
        } else {
          const a = q.answer;
          if (!Array.isArray(a) || a.length < 2 || !a.every((x) => Number.isInteger(x) && x >= 0 && x < q.options.length) || new Set(a).size !== a.length) return E(`${qp}.answer`, "\u591A\u9009 answer \u662F \u2265 2 \u4E2A\u4E0D\u91CD\u590D\u7684\u6B63\u786E\u9009\u9879\u4E0B\u6807");
          out_.push({ id, type: "multi", stem: q.stem, options: q.options, answer: [...a].sort((x, y) => x - y), explanation: q.explanation, hint });
        }
      } else if (q.type === "fill") {
        if (!Array.isArray(q.answer) || !q.answer.length || !q.answer.every(nonEmpty3)) return E(`${qp}.answer`, "\u586B\u7A7A answer \u662F\u53EF\u63A5\u53D7\u7B54\u6848\u7684\u5B57\u7B26\u4E32\u6570\u7EC4\uFF08\u540C\u4E49\u5199\u6CD5\u90FD\u5217\u4E0A\uFF09");
        if (!/_{2,}|（\s*）|\(\s*\)/.test(q.stem)) W(`${qp}.stem`, "\u586B\u7A7A\u9898\u5E72\u91CC\u7528 ____ \u6807\u51FA\u7A7A\u4F4D");
        out_.push({ id, type: "fill", stem: q.stem, answer: q.answer, explanation: q.explanation, hint });
      } else if (q.type === "game") {
        const why = validateGame(q.game);
        if (why) return E(`${qp}.game`, why);
        out_.push({ id, type: "game", stem: q.stem, game: q.game, answer: gameAnswer(q.game), explanation: q.explanation, hint });
      } else E(`${qp}.type`, "\u9898\u578B\u53EA\u80FD\u662F single / multi / fill / game");
    });
    return errors.length > before ? null : out_;
  }
}
function findChunk(chunks, key) {
  const keys = chunks.map((c) => quoteKey(`${c.heading ?? ""} ${c.text}`));
  for (let i = 0; i < chunks.length; i++) if (keys[i].includes(key)) return chunks[i];
  for (let i = 0; i + 1 < chunks.length; i++) if ((keys[i] + keys[i + 1]).includes(key)) return chunks[i];
  return null;
}
function courseLanguage(pkg) {
  const l = pkg.course?.language;
  if (l === "zh" || l === "en") return l;
  const says = [];
  const walk = (v) => {
    if (says.length > 40 || !v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    const o = v;
    if (o.type === "say" && typeof o.text === "string") says.push(o.text);
    for (const x of Object.values(o)) walk(x);
  };
  walk(pkg.units);
  return detectLang([pkg.course?.title, pkg.course?.summary, ...says].filter((x) => typeof x === "string").join(" ")) ?? "zh";
}

// src/host/compile-section.ts
init_lang();
init_db();
var PREFIX = "units[0].lectures[0].sessions[0].lesson";
function sourceUrl(boardId) {
  return `https://telleru.cn/conversation/${boardId}`;
}
function normalizeLesson(lesson) {
  const fixes = [];
  if (!lesson || typeof lesson !== "object") return { lesson, fixes };
  const L2 = structuredClone(lesson);
  const kinds = /* @__PURE__ */ new Set();
  const isQuiz = (o) => typeof o.prompt === "string" && Array.isArray(o.options);
  const isCheck = (o) => typeof o.prompt === "string" && typeof o.expected === "string";
  const fixArr = (arr) => {
    if (!Array.isArray(arr)) return arr;
    const out = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        out.push(raw);
        continue;
      }
      let s = { ...raw };
      for (const k of ["quiz", "check"]) {
        const inner2 = s[k];
        if (inner2 && typeof inner2 === "object" && !Array.isArray(inner2) && (s.type === k || s.type === void 0) && !("text" in s) && !("say" in s)) {
          s = { ...inner2, ...Object.fromEntries(Object.entries(s).filter(([x]) => x !== k)), type: k };
          kinds.add(`${k} \u7684\u5B57\u6BB5\u76F4\u63A5\u5199\u5728\u8FD9\u4E00\u6B65\u4E0A\uFF0C\u4E0D\u8981\u518D\u5305\u4E00\u5C42 "${k}"`);
        }
      }
      if (s.type === void 0 || s.type === "say") {
        for (const alt of ["say", "content", "speech"]) {
          if (s.text === void 0 && typeof s[alt] === "string") {
            s.text = s[alt];
            delete s[alt];
            kinds.add(`\u53E3\u64AD\u6B63\u6587\u7684\u5B57\u6BB5\u540D\u662F text\uFF08\u4E0D\u662F ${alt}\uFF09`);
          }
        }
      }
      if (s.type === void 0) {
        if (typeof s.text === "string") {
          s.type = "say";
          kinds.add('\u53E3\u64AD\u8981\u5199 "type":"say"');
        } else if (isQuiz(s)) {
          s.type = "quiz";
          kinds.add('\u5FEB\u6D4B\u8981\u5199 "type":"quiz"');
        } else if (isCheck(s)) {
          s.type = "check";
          kinds.add('\u68C0\u67E5\u9898\u8981\u5199 "type":"check"');
        }
      }
      const tail = [];
      if (s.type === "say") {
        for (const k of ["quiz", "check"]) {
          const inner2 = s[k];
          if (inner2 && typeof inner2 === "object" && !Array.isArray(inner2)) {
            tail.push({ ...inner2, type: k });
            delete s[k];
            kinds.add(`${k} \u8981\u5355\u72EC\u6210\u4E00\u6B65\uFF08\u548C\u53E3\u64AD\u5E76\u5217\uFF09\uFF0C\u4E0D\u80FD\u5199\u5728\u53E3\u64AD\u91CC`);
          }
        }
      }
      out.push(s, ...tail);
    }
    return out;
  };
  L2.opening = fixArr(L2.opening);
  if (Array.isArray(L2.points)) L2.points = L2.points.map((pt) => pt && typeof pt === "object" ? { ...pt, steps: fixArr(pt.steps) } : pt);
  if (L2.closing && typeof L2.closing === "object") L2.closing = { ...L2.closing, steps: fixArr(L2.closing.steps) };
  const notes = [...kinds];
  return { lesson: L2, fixes: notes.length ? [{ path: "lesson", message: `\u5DF2\u81EA\u52A8\u4FEE\u6B63\u6B65\u9AA4\u683C\u5F0F\uFF1A${notes.join("\uFF1B")}\u3002\u4E0B\u4E00\u8282\u8BF7\u76F4\u63A5\u6309\u8FD9\u4E2A\u683C\u5F0F\u5199` }] : [] };
}
function compileSection(board, index, rawLesson, opts) {
  const { lesson, fixes } = normalizeLesson(rawLesson);
  const sec = board.sections[index];
  const pkg = {
    kind: PACKAGE_KIND,
    schemaVersion: PACKAGE_SCHEMA_VERSION,
    course: {
      title: board.title.slice(0, 40) || "\u767D\u677F\u8BB2\u89E3",
      summary: `\u4F60\u5C06\u4ECE\u5BF9\u8BDD\u91CC\u7684\u5185\u5BB9\u51FA\u53D1\uFF0C\u5F04\u61C2\u300C${board.topic.slice(0, 60)}\u300D\u3002`,
      audience: (board.learner.level || "\u81EA\u5B66\u8005").slice(0, 120),
      language: board.lang
    },
    sourceSetId: board.id,
    sources: board.source.chunks.length ? [{ id: "src", kind: "web", url: sourceUrl(board.id) }] : [],
    units: [{
      title: board.title || "\u767D\u677F\u8BB2\u89E3",
      goal: board.learner.goal || "\u5F04\u61C2\u8FD9\u90E8\u5206\u5185\u5BB9",
      projectStageDetail: "\uFF08\u63D2\u4EF6\u8BB2\u89E3\u4E0D\u8BBE\u9879\u76EE\uFF09",
      examScope: "\u68C0\u9A8C\u4F60\u662F\u5426\u80FD\u8BB2\u6E05\u8FD9\u90E8\u5206\u5185\u5BB9",
      lectures: [{ title: board.title || "\u767D\u677F\u8BB2\u89E3", summary: "", sessions: [{ title: sec?.title || board.title, lesson }] }]
    }]
  };
  const src = { setId: board.id, url: sourceUrl(board.id), title: "\u5BF9\u8BDD\u539F\u6587", chunks: board.source.chunks };
  const { result, compiled } = withLang(board.lang, () => withSource(src, () => compilePackage("plugin", pkg, { requireLessons: true, assets: opts.images, requireImages: false })));
  const strip = (p) => p.startsWith(PREFIX) ? "lesson" + p.slice(PREFIX.length) : p;
  const mapIssue = (x) => ({ path: strip(x.path), message: pluginWording(x.message) });
  const errors = result.errors.map(mapIssue).filter((x) => !/^units|^course|^sources|^sourceSetId/.test(x.path) || x.path.startsWith("lesson"));
  const warnings = result.warnings.map(mapIssue).filter((x) => x.path.startsWith("lesson") || x.path === "");
  const out = compiled?.units[0]?.lectures[0]?.sessions[0]?.lesson ?? null;
  if (out) {
    out.provider = "dsh";
    for (const st of out.steps) if (st.type === "say") for (const c of st.citations ?? []) {
      c.url = "";
      c.site = "\u5BF9\u8BDD";
    }
  }
  return { ok: result.ok && !!out, errors: result.ok ? [] : errors.length ? errors : result.errors.map(mapIssue), warnings: [...fixes, ...warnings], lesson: out };
}
function pluginWording(m) {
  return m.replace("\u751F\u56FE\u677F\u4E66\u53EA\u7ED9\u4F1A\u5458\u751F\u6210\uFF08R49\uFF09\uFF0C\u5DF2\u53BB\u6389\uFF08\u4FDD\u7559\u53E3\u64AD\uFF09", '\u63D2\u4EF6\u4E0D\u652F\u6301\u751F\u56FE\uFF0C\u8FD9\u5F20\u6F2B\u753B\u5DF2\u53BB\u6389\uFF08\u4FDD\u7559\u53E3\u64AD\uFF09\uFF1B\u4EE5\u540E\u4E0D\u8981\u5199 {"kind":"image"} \u677F\u4E66').replace(/fetch_sources|read_source/g, "whiteboard_start \u7684 source_text").replace(/导入/g, "\u6536\u4E0B");
}

// src/host/guide.ts
var WORKFLOW = (content) => `[TellerU \u767D\u677F\u8BB2\u89E3 \xB7 \u5DE5\u4F5C\u6D41\u7A0B\uFF08\u7CFB\u7EDF\u8BF4\u660E\uFF0C\u4E0D\u8981\u539F\u6837\u590D\u8FF0\u7ED9\u7528\u6237\uFF09]
\u7528\u6237\u7528 /telleru \u8BF7\u4F60\u7528 TellerU \u767D\u677F\u8BB2\u89E3${content ? `\uFF1A\u300C${content.slice(0, 400)}\u300D` : "\u524D\u9762\u5BF9\u8BDD\u91CC\u7684\u5185\u5BB9"}\u3002
\u8981\u8BB2\u7684\u5185\u5BB9\uFF1A\u7528\u6237\u8FD9\u6B21\u7ED9\u7684\u6587\u5B57\uFF0C\u6216\u524D\u9762\u5BF9\u8BDD\u91CC\u88AB\u6307\u5230\u7684\u6D88\u606F / \u9644\u4EF6\uFF08"\u4E0A\u9762\u8FD9\u6BB5""\u4F60\u521A\u624D\u8BF4\u7684\u2026"\uFF09\u3002
\u6574\u4E2A\u8FC7\u7A0B\u8981\u8BA9\u7528\u6237\u5728\u5BF9\u8BDD\u91CC\u770B\u5F97\u5230\u8FDB\u5EA6\uFF082026-11-10 \u7528\u6237\u8981\u6C42\uFF09\uFF1A\u8BB2\u7A3F\u53EA\u4EA4\u7ED9\u5DE5\u5177\uFF0C\u4E0D\u5199\u5728\u5BF9\u8BDD\u91CC\uFF1B\u4F46\u6BCF\u4E00\u6B65\u5F00\u59CB\u524D\u540E\u90FD\u5728\u5BF9\u8BDD\u91CC\u8BF4\u4E00\u4E24\u53E5\u3002

## \u7B2C 0 \u6B65\uFF1A\u5148\u56DE\u5E94\uFF0C\u5E76\u5217\u51FA\u8BA1\u5212\uFF08\u4E0D\u8981\u5148\u8C03\u7528\u4EFB\u4F55\u5176\u4ED6\u5DE5\u5177\uFF09
1. \u7528 1\u20132 \u53E5\u8BDD\u5F52\u7EB3\u4F60\u7406\u89E3\u7684\u9700\u6C42\uFF1A\u8981\u5B66\u4EC0\u4E48\u3001\u53EF\u80FD\u7684\u7528\u9014\u6216\u96BE\u70B9\u3002
2. \u6709 todo_write \u5DE5\u5177\u65F6\uFF0C\u7528\u5B83\u5EFA\u8FD9 5 \u9879\u4EFB\u52A1\uFF08\u7B2C 1 \u9879 in_progress\uFF0C\u5176\u4F59 pending\uFF09\uFF0C\u4E4B\u540E\u6BCF\u5B8C\u6210\u4E00\u6B65\u5C31\u66F4\u65B0\u4E00\u6B21\u72B6\u6001\uFF1B\u6CA1\u6709\u8FD9\u4E2A\u5DE5\u5177\u65F6\uFF0C\u5728\u5BF9\u8BDD\u91CC\u7528\u7F16\u53F7\u5217\u8868\u5199\u51FA\u8FD9 5 \u6B65\uFF1A
   \u2460 \u8FFD\u95EE\uFF0C\u660E\u786E\u5B66\u4E60\u76EE\u6807 \u2461 \u5C0F\u6D4B\uFF0C\u4E86\u89E3\u4F60\u73B0\u5728\u638C\u63E1\u5230\u54EA\u513F \u2462 \u68C0\u7D22\u3001\u6536\u96C6\u8BB2\u89E3\u6750\u6599 \u2463 \u62DF\u5B9A\u5927\u7EB2\uFF08\u9700\u8981\u4F60\u786E\u8BA4\uFF09\u2464 \u751F\u6210\u8BFE\u7A0B\uFF0C\u5728\u53F3\u4FA7\u767D\u677F\u5F00\u8BB2

## \u7B2C 1 \u6B65\uFF1A\u660E\u786E\u9700\u6C42
\u8C03\u7528 whiteboard_ask\uFF08purpose="goal"\uFF09\uFF1A2\u20133 \u4E2A\u95EE\u9898\u6F84\u6E05\u5B66\u4E60\u76EE\u6807\uFF08\u4E3A\u4EC0\u4E48\u5B66\u3001\u5B66\u5230\u4EC0\u4E48\u7A0B\u5EA6\u3001\u504F\u91CD\u54EA\u90E8\u5206\uFF09\uFF0C\u6BCF\u95EE 2\u20134 \u4E2A\u9009\u9879\uFF0C\u63A8\u8350\u9879\u653E\u7B2C\u4E00\u4E2A\u5E76\u5728 label \u672B\u5C3E\u52A0\u300C\uFF08\u63A8\u8350\uFF09\u300D\u3002
\u7B54\u5B8C\u5728\u5BF9\u8BDD\u91CC\u5199\u4E00\u53E5\u7ED3\u8BBA\uFF0C\u683C\u5F0F\u300C\u2705 \u7B2C 1 \u6B65 \xB7 \u660E\u786E\u9700\u6C42\uFF1A\u2026\u2026\u300D\uFF08\u4F8B\u5982\u300C\u4F60\u60F3\u51C6\u5907\u8003\u8BD5\uFF0C\u91CD\u70B9\u662F\u5165\u6808\u51FA\u6808\u7684\u8FC7\u7A0B\u300D\uFF09\u3002

## \u7B2C 2 \u6B65\uFF1A\u4E86\u89E3\u638C\u63E1\u7A0B\u5EA6
\u8C03\u7528 whiteboard_ask\uFF08purpose="level"\uFF09\uFF1A2\u20133 \u9053\u6478\u5E95\u9898\uFF0C\u6BCF\u9898\u662F\u4E00\u4E2A\u5177\u4F53\u7684\u5C0F\u95EE\u9898\uFF08\u4E0D\u662F"\u4F60\u4F1A\u4E0D\u4F1A"\uFF09\uFF0C\u9009\u9879\u91CC\u6709\u5BF9\u6709\u9519\uFF0C\u6700\u540E\u4E00\u4E2A\u9009\u9879\u662F\u300C\u4E0D\u786E\u5B9A / \u6CA1\u5B66\u8FC7\u300D\u3002
\u7B54\u5B8C\u5199\u7ED3\u8BBA\u300C\u2705 \u7B2C 2 \u6B65 \xB7 \u638C\u63E1\u7A0B\u5EA6\uFF1A\u2026\u2026\u300D\uFF1A\u54EA\u4E9B\u5DF2\u7ECF\u4F1A\u4E86\u3001\u54EA\u4E9B\u8FD8\u4E0D\u6E05\u695A\uFF0C\u8BB2\u89E3\u4F1A\u600E\u4E48\u8C03\u6DF1\u6D45\u3002

## \u7B2C 3 \u6B65\uFF1A\u6536\u96C6\u6750\u6599
- \u6709 web_search / web_fetch \u5DE5\u5177\u65F6\uFF1A\u56F4\u7ED5\u4E3B\u9898\u548C\u7528\u6237\u76EE\u6807\u641C 2\u20134 \u6B21\uFF0C\u6311 1\u20133 \u4E2A\u53EF\u9760\u6765\u6E90\u8BFB\u539F\u6587\uFF0C\u628A\u7528\u5F97\u4E0A\u7684\u6BB5\u843D\u9010\u5B57\u6458\u4E0B\u6765\u3002
- \u6CA1\u6709\u8FD9\u4E9B\u5DE5\u5177\uFF0C\u6216\u5185\u5BB9\u5B8C\u5168\u6765\u81EA\u5BF9\u8BDD / \u9644\u4EF6\u65F6\uFF1A\u5C31\u4EE5\u5BF9\u8BDD\u539F\u6587\u4E3A\u51C6\uFF0C\u7528\u4F60\u81EA\u5DF1\u7684\u77E5\u8BC6\u8865\u5145\u3002
- \u4EE5\u4E0A\u539F\u6587\uFF08\u5BF9\u8BDD\u5185\u5BB9 + \u6458\u4E0B\u6765\u7684\u6BB5\u843D\uFF0C\u6CE8\u660E\u51FA\u5904\uFF09\u5408\u5728\u4E00\u8D77\uFF0C\u5C31\u662F\u7B2C 5 \u6B65\u7684 source_text\u3002
\u5199\u7ED3\u8BBA\u300C\u2705 \u7B2C 3 \u6B65 \xB7 \u6750\u6599\uFF1A\u2026\u2026\u300D\uFF1A\u7528\u4E86\u54EA\u4E9B\u6765\u6E90\uFF08\u6807\u9898\u5373\u53EF\uFF09\uFF0C\u6216\u8BF4\u660E\u4E3B\u8981\u4F9D\u636E\u5BF9\u8BDD\u5185\u5BB9\u3002

## \u7B2C 4 \u6B65\uFF1A\u62DF\u5B9A\u5927\u7EB2\uFF08\u5FC5\u987B\u7B49\u7528\u6237\u786E\u8BA4\uFF09
1. \u6309\u5185\u5BB9\u91CF\u62C6\u8282\uFF1A\u4E00\u8282 \u2248 15\u201325 \u5206\u949F\u3001\u6070\u597D 3 \u4E2A\u77E5\u8BC6\u70B9\u3002\u5185\u5BB9\u5C11\u5C31 1 \u8282\uFF0C\u591A\u7684\u8BDD\u62C6\u6210\u51E0\u8282\u3002
2. \u5148\u5728\u5BF9\u8BDD\u91CC\u628A\u5927\u7EB2\u5199\u51FA\u6765\uFF1A\u6BCF\u8282\u4E00\u884C\u6807\u9898\uFF0C\u4E0B\u9762\u662F 3 \u4E2A\u77E5\u8BC6\u70B9\u3002
3. \u518D\u8C03\u7528 whiteboard_ask\uFF08purpose="outline"\uFF09\u8BF7\u7528\u6237\u786E\u8BA4\uFF1Adetail \u91CC\u653E\u540C\u6837\u7684\u5927\u7EB2\uFF0C\u9009\u9879\u5982\u300C\u5C31\u6309\u8FD9\u4E2A\u5927\u7EB2\u8BB2\uFF08\u63A8\u8350\uFF09\u300D\u300C\u538B\u7F29\u6210 K \u8282\u300D\u300C\u5148\u53EA\u8BB2\u7B2C 1 \u8282\u300D\u300C\u6211\u60F3\u8C03\u6574\uFF08\u5728\u8F93\u5165\u6846\u5199\uFF09\u300D\u3002\u7528\u6237\u8981\u8C03\u6574\u5C31\u6539\u4E86\u518D\u95EE\u4E00\u6B21\uFF0C\u76F4\u5230\u786E\u8BA4\u3002
\u5199\u7ED3\u8BBA\u300C\u2705 \u7B2C 4 \u6B65 \xB7 \u5927\u7EB2\u5DF2\u786E\u8BA4\uFF1A\u5171 N \u8282\u2026\u2026\u300D\u3002

## \u7B2C 5 \u6B65\uFF1A\u751F\u6210\u8BFE\u7A0B
1. \u8C03\u7528 whiteboard_start\uFF1Atitle\u3001source_text\uFF08\u7B2C 3 \u6B65\u7684\u539F\u6587\uFF0C\u9010\u5B57\u8D34\u5165\uFF0C\u662F\u5F15\u7528\u7684\u4F9D\u636E\uFF09\u3001\u5B66\u4E60\u8005\u753B\u50CF\uFF08\u76EE\u6807 + \u6478\u5E95\u7ED3\u8BBA\uFF09\u3001\u786E\u8BA4\u540E\u7684\u5404\u8282\u3002\u53F3\u4FA7\u4F1A\u6253\u5F00\u767D\u677F\u3002
2. \u6309\u5B83\u8FD4\u56DE\u7684\u5199\u4F5C\u8BF4\u660E\uFF0C\u8C03\u7528 whiteboard_write_section \u5199\u7B2C 1 \u8282\uFF1B\u6709 errors \u5C31\u6309 path \u6539\u4E86\u518D\u4EA4\uFF0C\u76F4\u5230 ok\u3002\u540E\u9762\u7684\u8282\u4E0D\u8981\u4E00\u6B21\u5199\u5B8C\uFF1A\u7528\u6237\u5B66\u5230\u65F6\uFF0C\u7CFB\u7EDF\u4F1A\u53D1\u6765\u300C\u8BF7\u5199\u7B2C k \u8282\u300D\uFF0C\u5C4A\u65F6\u518D\u5199\u3002
3. \u5199\u597D\u540E\u7ED3\u675F\u8FD9\u4E00\u8F6E\uFF0C\u56DE\u590D\uFF1A
   - \u300C\u2705 \u7B2C 5 \u6B65 \xB7 \u7B2C 1 \u8282\u5DF2\u7ECF\u5728\u53F3\u4FA7\u767D\u677F\u4E0A\u4E86\u300D\uFF0C\u4E00\u53E5\u8BDD\u8BF4\u8FD9\u8282\u8BB2\u4EC0\u4E48\uFF1B
   - \u767D\u677F\u600E\u4E48\u7528\uFF08\u7B80\u77ED\u5217\u8868\uFF09\uFF1A\u70B9\u300C\u5F00\u59CB\u4E0A\u8BFE\u300D\u5F00\u8BB2\uFF0C\u8001\u5E08\u8FB9\u8BB2\u8FB9\u5199\u3001\u5E26\u5B57\u5E55\uFF1B\u5E95\u90E8\u8F93\u5165\u6846\u968F\u65F6\u6253\u5B57\u6253\u65AD\u63D0\u95EE\uFF0C\u7B54\u5B8C\u56DE\u5230\u539F\u5904\uFF1B\u8BB2\u5B8C\u6BCF\u4E2A\u77E5\u8BC6\u70B9\u6709\u5FEB\u6D4B / \u68C0\u67E5\u9898\uFF1B\u300C\u6CA1\u542C\u61C2\u300D\u53EF\u4EE5\u6362\u4E2A\u6BD4\u55BB\u91CD\u8BB2\uFF1B\u5DE6\u4E0A\u89D2\u6807\u9898\u4E0B\u62C9\u5207\u6362\u5404\u8282\u3001\u5404\u5C4F\uFF1B\u5DE6\u4FA7\u5DE5\u5177\u680F\u6709\u753B\u7B14\u3001\u8367\u5149\u7B14\u3001\u4FBF\u7B7E\u3001\u6A61\u76AE\uFF0C\u8FD8\u6709\u58F0\u97F3\u3001\u4E2D\u82F1\u5207\u6362\u548C\u660E\u6697\u4E3B\u9898\uFF1B\u53F3\u4E0A\u89D2\u8BBE\u7F6E\u91CC\u53EF\u8C03\u677F\u4E66\u5B57\u4F53\u3001\u97F3\u8272\u548C\u8BED\u901F\uFF1B\u8FD8\u80FD\u56DE\u653E\u672C\u8282\u3001\u4FDD\u5B58\u767D\u677F\u56FE\u7247\uFF1B\u6CA1\u7ED1\u5B9A\u8BED\u97F3\u65F6\u53EA\u6709\u5B57\u5E55\uFF0C\u53F3\u4E0B\u89D2 TellerU \u91CC\u53EF\u4EE5\u5F00\u901A\uFF1B\u5B66\u5B8C\u70B9\u300C\u56DE\u5230\u5BF9\u8BDD\u7EE7\u7EED\u300D\u3002

\u8BB2\u89E3\u8981\u6309\u6478\u5E95\u7ED3\u8BBA\u8C03\u6DF1\u6D45\uFF1A\u5DF2\u7ECF\u4F1A\u7684\u4E00\u7B14\u5E26\u8FC7\uFF0C\u6CA1\u5B66\u8FC7\u7684\u4ECE\u76F4\u89C9\u8BB2\u8D77\uFF1B\u4F8B\u5B50\u8D34\u5408\u7528\u6237\u7684\u76EE\u6807\u3002`;
function lessonGuide(lang) {
  return `# TellerU \u767D\u677F\u8BB2\u7A3F\u683C\u5F0F\uFF08whiteboard_write_section \u7684 lesson \u5B57\u6BB5\uFF09

\u5B66\u4E60\u8005\u5728\u767D\u677F\u4E0A\u542C\u8001\u5E08\u8FB9\u8BB2\u8FB9\u5199\uFF1A\u6BCF\u6BB5\u53E3\u64AD\uFF08say\uFF09\u914D\u4E00\u4E2A\u677F\u4E66\u52A8\u4F5C\uFF0C\u8BB2\u5B8C\u4E00\u4E2A\u77E5\u8BC6\u70B9\u505A\u5FEB\u6D4B / \u68C0\u67E5\u9898\u3002\u4F60\u4EA4\u7684\u662F\u4E00\u8282\u8BFE\u7684 lesson JSON\uFF0CTellerU \u4F1A\u9010\u5B57\u6BB5\u6821\u9A8C\uFF1A\u6709 errors \u4E0D\u6536\uFF0C\u6309 path \u6539\u4E86\u518D\u4EA4\uFF1Bwarnings \u80FD\u6536\u4F46\u67D0\u4E9B\u5185\u5BB9\u4F1A\u88AB\u53BB\u6389\u6216\u964D\u7EA7\u3002
${lang === "en" ? "\n**\u672C\u6B21\u8BB2\u89E3\u8BED\u8A00\u662F\u82F1\u6587**\uFF1A\u5B66\u4E60\u8005\u770B\u5230\u3001\u542C\u5230\u7684\u5185\u5BB9\u5168\u90E8\u5199\u82F1\u6587\uFF08JSON \u952E\u540D\u548C\u679A\u4E3E\u503C\u4E0D\u7FFB\u8BD1\uFF1B\u5F15\u7528 quote \u4ECD\u6309\u539F\u6587\u8BED\u8A00\u9010\u5B57\u6458\uFF09\u3002\u4E0B\u9762\u7684\u300C\u2264 N \u5B57\u300D\u6309\u5B57\u5BBD\u7B97\uFF1A2 \u4E2A\u82F1\u6587\u5B57\u7B26 \u2248 1 \u5B57\u3002\n" : ""}
## \u4E00\u8282\u8BFE\u7684\u7ED3\u6784
- \`openingQuestions\`\uFF1A3 \u4E2A\u95EE\u9898\uFF0C\u4E0E 3 \u4E2A\u77E5\u8BC6\u70B9\u4E00\u4E00\u5BF9\u5E94\uFF08\u8FD9\u8282\u8BFE\u7684\u9AA8\u67B6\uFF09\u3002
- \`opening\`\uFF1A**3\u20135 \u6BB5 say**\uFF0C\u90FD\u6807 \`"filler": true\`\uFF0C**\u6BCF\u6BB5\u90FD\u8981\u8BA9\u767D\u677F\u52A8**\uFF082026-11-11 \u7528\u6237\u53CD\u9988\uFF1A\u5F00\u573A\u592A\u5570\u55E6\uFF0C\u76EF\u7740\u767D\u677F\u534A\u5929\u6CA1\u5185\u5BB9\uFF09\uFF1A
  1. \u7B2C 1 \u6BB5\uFF1A\u4E00\u53E5\u8BDD\u6253\u62DB\u547C\u5E76\u70B9\u9898\uFF0C\u7528\u300C\u540C\u5B66\u4F60\u597D\uFF0C\u4ECA\u5929\u6211\u4EEC\u8BB2\u2026\u2026\u300D\uFF08\u82F1\u6587\u8BFE "Hi, today we're going to talk about \u2026"\uFF09\uFF0C**\u540C\u65F6\u5199\u6807\u9898\u677F\u4E66** \`{"kind":"title","text":"\u672C\u8282\u4E3B\u9898"}\`\u3002
  2. \u7B2C 2 \u6BB5\uFF1A\u4E00\u53E5\u8BDD\u8BF4\u4E3A\u4EC0\u4E48\u503C\u5F97\u5B66\uFF0C\u628A\u5B66\u4E60\u8005\u7684\u76EE\u6807\u548C\u6478\u5E95\u7ED3\u8BBA\u63C9\u8FDB\u53BB\uFF08\u4F8B\u5982\u300C\u4F60\u60F3\u641E\u6E05\u5B83\u7684\u80FD\u529B\u8FB9\u754C\uFF0C\u53C8\u662F\u96F6\u57FA\u7840\uFF0C\u6211\u4EEC\u4E0D\u63A8\u516C\u5F0F\uFF0C\u53EA\u8BB2\u6BCF\u4E00\u6B65\u5728\u505A\u4EC0\u4E48\u300D\uFF09\uFF0C\u914D\u4E00\u6761 note \u677F\u4E66\u5199\u4E0B\u8FD9\u8282\u7684\u5B66\u4E60\u76EE\u6807\u3002\u4E0D\u8981\u5355\u72EC\u94FA\u9648\u573A\u666F\u3001\u4E0D\u8981\u590D\u8FF0\u7528\u6237\u8BF4\u8FC7\u7684\u8BDD\u3002
  3. \u63A5\u7740\u7528\u4E00\u5F20 list\uFF08figId "q"\uFF09\u9010\u6761\u5199\u51FA\u4E09\u4E2A\u95EE\u9898\uFF1A\u6BCF\u4E2A\u95EE\u9898\u4E00\u6BB5 say\uFF0C\u5F80\u540C\u4E00\u4E2A list \u8FFD\u52A0\uFF1B\u6700\u540E\u4E00\u4E2A\u95EE\u9898\u90A3\u6BB5\u987A\u5E26\u8FC7\u6E21\u5230\u7B2C\u4E00\u4E2A\u77E5\u8BC6\u70B9\u3002
  4. \u6574\u4E2A\u5F00\u573A\u63A7\u5236\u5728 20 \u79D2\u5185\u8BFB\u5B8C\uFF08\u7EA6 150 \u5B57\uFF09\u3002\u4E0D\u8981\u5355\u72EC\u5199\u300C\u8FD9\u4E00\u8282\u6211\u4EEC\u8981\u56DE\u7B54\u4E09\u4E2A\u95EE\u9898\u300D\u8FD9\u79CD\u6CA1\u6709\u65B0\u4FE1\u606F\u7684\u53E5\u5B50\u3002
- **\u6B65\u9AA4\u7684\u5199\u6CD5**\uFF08\u6BCF\u4E00\u6B65\u90FD\u662F steps \u6570\u7EC4\u91CC\u7684\u4E00\u4E2A\u5BF9\u8C61\uFF0C\`type\` \u4E0D\u80FD\u7701\uFF1Bquiz / check \u5355\u72EC\u6210\u4E00\u6B65\uFF0C\u4E0D\u80FD\u5199\u8FDB say \u91CC\uFF0C\u4E5F\u4E0D\u8981\u518D\u5305\u4E00\u5C42\uFF09\uFF1A
  \`\`\`json
  {"type":"say","text":"\u53E3\u64AD\u6B63\u6587\uFF08\u5B57\u6BB5\u540D\u662F text\uFF09","board":{"kind":"title","text":"\u2026"},"id":"b1"}
  {"type":"say","text":"\u5708\u51FA\u521A\u624D\u5199\u7684\u5173\u952E\u8BCD","mark":{"ref":"b1","style":"circle","text":"\u5173\u952E\u8BCD"}}
  {"type":"quiz","prompt":"\u2026","options":["\u2026","\u2026"],"answer":0,"explain":"\u2026"}
  {"type":"check","variant":"apply","prompt":"\u2026","expected":"\u53C2\u8003\u7B54\u6848","commonError":"\u5E38\u89C1\u9519\u8BEF"}
  \`\`\`
  \u5E38\u89C1\u9519\u8BEF\uFF1A\u516C\u5F0F\u677F\u4E66\u662F \`{"kind":"math","tex":"LaTeX"}\`\uFF08\u5B57\u6BB5\u662F tex\uFF0C\u4E0D\u662F text\uFF09\uFF1B\u6848\u4F8B\u5361 case \u6700\u591A 6 \u683C\u3002
- \`points\`\uFF1A**\u6070\u597D 3 \u4E2A\u77E5\u8BC6\u70B9**\u3002\u6BCF\u4E2A\uFF1Atitle\uFF08\u767D\u677F\u5206\u5C4F\u6807\u9898\uFF09\u3001objective\uFF08\u8BFE\u5802\u8981\u70B9\u300C\u80FD\u2026\u300D\uFF09\u3001steps\u3001reward\uFF08{concept \u2264 12 \u5B57, desc\u300C\u4F60\u5DF2\u7ECF\u638C\u63E1\u4E86\uFF1A\u2026\u300D}\uFF09\u3002
  - \u6BCF\u4E2A\u77E5\u8BC6\u70B9 10\u201314 \u6BB5 say\uFF08\u81F3\u5C11 4 \u6BB5\u5B9E\u8D28\u53E3\u64AD\uFF09\uFF0C\u6BCF\u6BB5 25\u201360 \u5B57\uFF08\u786C\u4E0A\u9650 ${SAY_MAX_CHARS} \u5B57\uFF0C\u8D85\u51FA\u81EA\u52A8\u5207\u53E5\uFF09\uFF0C\u77ED\u53E5\u3001\u53E3\u8BED\u3001\u4E0D\u590D\u8FF0\u3002
  - 1\u20132 \u9053 quiz\uFF1A\`{"type":"quiz","prompt":"\u2026","options":["\u2026","\u2026"],"answer":\u4E0B\u6807,"explain":"\u2026"}\`\u3002\u6B63\u786E\u9009\u9879\u7684\u5173\u952E\u8BCD\u5FC5\u987B\u51FA\u73B0\u5728 quiz \u524D\u7D27\u6328\u7740\u7684 1\u20133 \u6BB5\u53E3\u64AD\u6216\u677F\u4E66\u91CC\uFF08\u5426\u5219\u6536\u7A3F\u65F6\u4F1A\u628A\u5B83\u8FDE\u540C\u8FC7\u6E21\u53E5\u524D\u79FB\u5230\u8BB2\u51FA\u7B54\u6848\u7684\u53E3\u64AD\u4E4B\u540E\uFF1B\u6574\u6BB5\u90FD\u627E\u4E0D\u5230\u4F9D\u636E\u624D\u53BB\u6389\uFF09\u3002quiz \u540E\u4E0D\u8981\u518D\u53E3\u64AD\u63ED\u6653\u7B54\u6848\u3002
  - \u7B2C 2 \u6216\u7B2C 3 \u4E2A\u77E5\u8BC6\u70B9\u653E 1 \u9053 check\uFF08\`"variant":"apply"\`\uFF09\uFF1A\`{"type":"check","variant":"apply","prompt":"\u2026","expected":"\u53C2\u8003\u7B54\u6848","commonError":"\u5E38\u89C1\u9519\u8BEF"}\`\uFF0C\u8BA9\u5B66\u751F\u8BF4\u51FA\u5224\u65AD\u548C\u7406\u7531\u3002\u6BCF\u4E2A\u77E5\u8BC6\u70B9\u81F3\u5C11 1 \u9053 quiz \u6216 check\u3002
  - \u81F3\u5C11\u4E00\u5904\u300C\u5F88\u591A\u4EBA\u4F1A\u89C9\u5F97\u2026\u2026\u4F46\u771F\u76F8\u662F\u2026\u2026\u300D\u3002\u5168\u8282\u4E00\u4E2A\u8D2F\u7A7F\u6848\u4F8B\uFF0C\u7528 case \u5361\uFF08figId "case"\uFF09\u9010\u683C\u753B\u51FA\u6765\u3002
- \`closing\`\uFF1Atitle\u3001steps\uFF08\u9010\u4E2A\u56DE\u6536\u4E09\u4E2A\u95EE\u9898\uFF0C\u5F80\u4E00\u5F20\u5F52\u7EB3\u8868 table figId "sum" \u91CC\u9010\u884C\u8FFD\u52A0\uFF1B1 \u9053 check variant "recap"\uFF09\u3001summary\uFF081\u20135 \u6761\uFF09\u3001next\uFF08\u4E0B\u4E00\u8282\u94A9\u5B50\uFF1B\u6700\u540E\u4E00\u8282\u5199\u300C\u56DE\u5230\u5BF9\u8BDD\uFF0C\u60F3\u7EE7\u7EED\u5B66\u4EC0\u4E48\u544A\u8BC9\u6211\u300D\u4E4B\u7C7B\uFF09\u3002
- \`glossary\`\uFF08\u53EF\u9009\uFF09\uFF1A[{term, def}]\u3002
- \u6BCF\u6BB5 say \u90FD\u8981\u8BA9\u767D\u677F\u52A8\u4E00\u4E0B\uFF1A\u65B0\u677F\u4E66 / \u5F80\u540C figId \u7684 list\u3001case\u3001table \u8FFD\u52A0\uFF08\u8F93\u51FA\u5B8C\u6574\u5BF9\u8C61\uFF09 / \u7528 mark \u5708\u753B\u5DF2\u5199\u7684\u8BCD\u3002\u53EA\u6709\u7EAF\u8FC7\u6E21\u53E5\uFF08filler\uFF09\u53EF\u4EE5\u6CA1\u6709\u767D\u677F\u52A8\u4F5C\u3002
- \u7ED3\u6784\u5316\u677F\u4E66\u914D\u989D\uFF1A\u6BCF\u4E2A\u77E5\u8BC6\u70B9 \u2265 2 \u4E2A\u7ED3\u6784\u5316\u677F\u4E66\uFF08table / flowchart / sequence / arch / cycle / nest / tree / graph / bars / timeline\uFF09\uFF0C\u5168\u8282 \u2265 2 \u5F20\u8868\u683C\uFF0C\u8FDE\u7EED\u6587\u5B57\u677F\u4E66 \u2264 3 \u6BB5\u3002
- mark\uFF1A\`{"ref":"b1","style":"circle|highlight|underline","text":"\u677F\u4E66\u91CC\u539F\u6837\u51FA\u73B0\u7684 2\u20138 \u4E2A\u5B57"}\`\uFF0Cref \u662F**\u540C\u4E00\u6BB5**\uFF08\u5F00\u573A / \u67D0\u4E2A\u77E5\u8BC6\u70B9 / \u6536\u5C3E\uFF09\u91CC\u66F4\u65E9\u4E00\u6761\u5E26\u677F\u4E66\u53E3\u64AD\u7684 id\uFF08\u90A3\u6761\u53E3\u64AD\u5199 \`"id":"b1"\`\uFF09\u3002

## \u5F15\u7528\uFF08\u8BB2\u7684\u5185\u5BB9\u6765\u81EA\u5BF9\u8BDD\u539F\u6587\uFF09
- \u5B9A\u4E49\u3001\u7ED3\u8BBA\u3001\u6570\u636E\u3001\u6B65\u9AA4\u8FD9\u7C7B\u4E8B\u5B9E\u6027\u8BBA\u65AD\uFF0C\u5C3D\u91CF\u4ECE whiteboard_start \u91CC\u7684\u539F\u6587\uFF08source_text\uFF09\u9010\u5B57\u6458\u53E5\u5F15\u7528\uFF1Asay \u91CC\u5199 \`"cite":[{"source":"src","quote":"\u9010\u5B57\u6458\u81EA\u539F\u6587\u7684\u4E00\u53E5\uFF08\u2265 6 \u5B57\uFF0C\u53EF\u4EE5\u53EA\u6458\u4E00\u90E8\u5206\uFF09"}]\`\uFF0C\u6BCF\u6BB5\u6700\u591A 3 \u6761\u3002
- \u6821\u9A8C\u65F6\u5FFD\u7565\u7A7A\u767D\u548C\u6807\u70B9\u6BD4\u5BF9\uFF1Bquote \u5728\u539F\u6587\u91CC\u627E\u4E0D\u5230 \u2192 error\u3002\u7C7B\u6BD4\u3001\u4E3E\u4F8B\u3001\u8FC7\u6E21\u4E0D\u9700\u8981\u5F15\u7528\uFF1B\u539F\u6587\u6CA1\u6709\u7684\u5185\u5BB9\u4E0D\u8981\u786C\u5F15\uFF0C\u5B83\u4F1A\u6807\u300CAI \u8865\u5145\u300D\u3002

## \u677F\u4E66\uFF08board\uFF09\u683C\u5F0F
${BOARD_SPEC}

## \u6982\u5FF5\u52A8\u753B\u4E0E\u5C0F\u6E38\u620F\uFF1A\u4F60\u5199\u6784\u60F3\uFF0C\u63D2\u4EF6\u6765\u505A
- \u4E0D\u8981\u5199\u751F\u56FE\u677F\u4E66\uFF08\`{"kind":"image"}\`\uFF0C\u6848\u4F8B\u6F2B\u753B\uFF09\uFF1A\u63D2\u4EF6\u4E0D\u652F\u6301\u751F\u56FE\uFF0C\u5199\u4E86\u4F1A\u88AB\u53BB\u6389\u3002\u9700\u8981\u753B\u9762\u611F\u65F6\u7528\u6848\u4F8B\u5361\u3001\u8868\u683C\u6216\u4E0B\u9762\u7684\u6982\u5FF5\u52A8\u753B\u3002
- \u6982\u5FF5\u52A8\u753B\uFF08\u6BCF\u8282\u6700\u591A 1 \u4E2A\uFF0C\u53EA\u5728\u52A8\u6001\u8FC7\u7A0B / \u53C2\u6570\u5173\u7CFB\u7528\u9759\u6001\u56FE\u8BB2\u4E0D\u6E05\u65F6\u7528\uFF09\uFF1A\`{"kind":"html","title":"\u2264 24 \u5B57","brief":"\u6F14\u793A\u4EC0\u4E48\u3001\u54EA 1\u20133 \u4E2A\u53C2\u6570\u53EF\u62D6\u52A8\u3001\u8981\u89C2\u5BDF\u5230\u4EC0\u4E48\u89C4\u5F8B\uFF08\u2264 200 \u5B57\uFF09"}\`\u3002
- \u5C0F\u6E38\u620F\uFF08\u53EF\u9009\uFF09\uFF1A\`{"kind":"html","variant":"game","title":"\u2026","game":{\u2026}}\`\uFF0Cgame \u683C\u5F0F\u540C BOARD_SPEC \u91CC\u7684 sort / order / match\u3002
`;
}

// src/host/index.ts
init_store();

// src/host/voice.ts
import { createHash, randomUUID } from "node:crypto";
import { existsSync as existsSync3, mkdirSync as mkdirSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "node:fs";
import { dirname, join as join3 } from "node:path";
init_store();
var endpoint = () => process.env.TELLERU_WB_TTS_ENDPOINT || "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
var clean = (t) => t.replace(/\[[^\]]*\|[^\]]*\]/g, "").replace(/\s+/g, " ").trim().slice(0, 300);
var cacheFile = (voice, text2, ext = "mp3") => {
  const k = createHash("sha1").update(voice + "\0" + text2).digest("hex");
  return join3(dataDir(), "tts", k.slice(0, 2), `${k}.${ext}`);
};
var audio = (body, type = "audio/mpeg") => new Response(body, { headers: { "content-type": type, "cache-control": "private, max-age=86400" } });
function makeTts(getCfg) {
  return async (raw, v, board, sid = null) => {
    const cfg = getCfg();
    const text2 = clean(raw);
    if (!text2) return null;
    const lang = board?.lang ?? "zh";
    const picked = v && findVoice(v) ? v : null;
    const voice = picked ?? (lang === "en" ? DEFAULT_VOICE_EN : cfg.voice);
    const fp = cacheFile(voice, text2);
    if (existsSync3(fp)) return audio(readFileSync3(fp));
    const own = !!cfg.speechApiKey, account = !!cfg.telleruToken;
    const order = [own && "own", account && "account"];
    for (const way of order.filter(Boolean)) {
      try {
        const r = way === "own" ? await synthOwn(cfg.speechApiKey, voice, text2) : await synthAccount(cfg, voice, text2, sid);
        if (r) {
          mkdirSync3(dirname(fp), { recursive: true });
          writeFileSync3(fp, r);
          return audio(new Uint8Array(r));
        }
      } catch {
      }
    }
    return null;
  };
}
var keyChecks = /* @__PURE__ */ new Map();
async function checkSpeechKey(key, voice, fresh = false) {
  const hit = keyChecks.get(key);
  if (!fresh && hit && Date.now() - hit.at < 5 * 6e4) return hit;
  let r;
  try {
    const buf = await synthOwn(key, voice, "\u4F60\u597D");
    r = buf ? { ok: true, at: Date.now() } : { ok: false, error: "\u8C46\u5305\u8BED\u97F3\u6CA1\u6709\u8FD4\u56DE\u97F3\u9891\uFF0C\u7A0D\u540E\u518D\u8BD5", at: Date.now() };
  } catch (e) {
    const m = e.message ?? "";
    const code = Number(/TTS (\d+)/.exec(m)?.[1] ?? 0);
    const error = code === 401 || code === 403 ? "Key \u65E0\u6548\uFF0C\u6216\u8FD9\u4E2A Key \u6CA1\u6709\u5F00\u901A\u8C46\u5305\u8BED\u97F3\u5408\u6210" : code === 429 ? "\u8C03\u7528\u592A\u9891\u7E41\u6216\u989D\u5EA6\u7528\u5B8C\u4E86\uFF0C\u7A0D\u540E\u518D\u8BD5" : code ? `\u8C46\u5305\u8BED\u97F3\u8FD4\u56DE ${code}\uFF1A${m}` : /timeout|abort|fetch failed|ENOTFOUND|ECONN/i.test(m) ? "\u8FDE\u4E0D\u4E0A\u706B\u5C71\u5F15\u64CE\uFF0C\u68C0\u67E5\u7F51\u7EDC" : `\u68C0\u6D4B\u5931\u8D25\uFF1A${m}`;
    r = { ok: false, error, at: Date.now() };
  }
  keyChecks.set(key, r);
  return r;
}
async function synthOwn(key, voice, text2) {
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": key, "X-Api-Resource-Id": resourceOfVoiceId(voice), "X-Api-Request-Id": randomUUID() },
    body: JSON.stringify({ user: { uid: "telleru-dsh" }, req_params: { text: text2, speaker: voice, audio_params: { format: "mp3", sample_rate: 24e3 } } }),
    signal: AbortSignal.timeout(3e4)
  });
  if (!res.ok) throw new Error(`TTS ${res.status}`);
  const parts = [];
  for (const line of (await res.text()).split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const j2 = JSON.parse(t);
      if (j2.data) parts.push(Buffer.from(j2.data, "base64"));
      else if (j2.code && j2.code !== 0 && j2.code !== 2e7) throw new Error(j2.message ?? `code ${j2.code}`);
    } catch (e) {
      if (e.message && !(e instanceof SyntaxError)) throw e;
    }
  }
  return parts.length ? Buffer.concat(parts) : null;
}
async function synthAccount(cfg, voice, text2, sid) {
  const u = new URL("/api/plugin/tts", cfg.telleruBaseUrl);
  u.searchParams.set("text", text2);
  u.searchParams.set("v", voice);
  if (sid) u.searchParams.set("ref", sid);
  const res = await fetch(u, { headers: { authorization: `Bearer ${cfg.telleruToken}`, "x-telleru-client": "dsh-whiteboard" }, signal: AbortSignal.timeout(3e4) });
  if (!res.ok) throw new Error(`TellerU TTS ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// src/host/media.ts
import { mkdirSync as mkdirSync4, readFileSync as readFileSync4, writeFileSync as writeFileSync4, existsSync as existsSync4 } from "node:fs";
import { join as join4 } from "node:path";
init_lang();
init_llm();
init_store();
var imagesDir = () => join4(dataDir(), "images");
var IMAGE_ID = /^im_[a-z0-9]{8,32}$/;
function imageBytes(id) {
  if (!IMAGE_ID.test(id)) return null;
  const f = join4(imagesDir(), `${id}.img`);
  if (!existsSync4(f)) return null;
  const bytes = readFileSync4(f);
  const type = bytes[0] === 137 && bytes[1] === 80 ? "image/png" : bytes[0] === 82 && bytes[8] === 87 ? "image/webp" : "image/jpeg";
  return { bytes, type };
}
function htmlDoc(id) {
  const r = lessonHtml(id);
  return r ? { srcdoc: r.srcdoc, legacyDrag: r.legacyDrag } : null;
}
async function enrichSection(board, index, lesson, o) {
  const sec = board.sections[index];
  const ctx = { sessionId: sidOf(board.id, index), sessionTitle: sec.title, courseTitle: board.title, audience: board.learner.level, images: !!o.images };
  const work = structuredClone(lesson);
  const run2 = () => withLang(board.lang, () => enrichLesson(work, ctx, o.images ?? void 0));
  const job = (o.bridge ? withBridge(o.bridge, run2) : run2()).catch((e) => console.warn("[telleru-whiteboard] \u5BCC\u5A92\u4F53\u751F\u6210\u5931\u8D25\uFF1A", e.message));
  let timer;
  await Promise.race([job, new Promise((r) => {
    timer = setTimeout(r, o.timeoutMs ?? 75e3);
  })]);
  clearTimeout(timer);
  lesson = structuredClone(work);
  for (const s of lesson.steps) {
    if (s.type !== "say" || !s.board) continue;
    if (s.board.kind === "image" && !s.board.imageId) delete s.board;
    else if (s.board.kind === "html" && s.board.variant !== "game" && !s.board.htmlId) delete s.board;
  }
  return lesson;
}

// src/host/account.ts
var cache2 = /* @__PURE__ */ new Map();
function accountError(base, token) {
  return cache2.get(base + "\0" + token)?.err ?? null;
}
async function accountInfo(base, token, fresh = false) {
  const key = base + "\0" + token;
  const hit = cache2.get(key);
  if (!fresh && hit && Date.now() - hit.at < 5 * 6e4) return hit.v;
  let v = null;
  let err;
  try {
    const res = await fetch(new URL("/api/plugin/me", base), { headers: { authorization: `Bearer ${token}`, "x-telleru-client": "dsh-whiteboard" }, signal: AbortSignal.timeout(1e4) });
    const json2 = res.headers.get("content-type")?.includes("json");
    if (res.ok && json2) v = await res.json();
    else if (res.status === 401 || res.status === 403) err = "\u4EE4\u724C\u65E0\u6548\u6216\u5DF2\u64A4\u9500\uFF1A\u8BF7\u5728 TellerU \u7F51\u7AD9\u300C\u8BBE\u7F6E \u2192 \u8FDE\u63A5 AI \u52A9\u624B\u300D\u91CD\u65B0\u751F\u6210";
    else if (res.status === 404 || !json2) err = `${new URL(base).host} \u8FD8\u6CA1\u6709\u4E0A\u7EBF\u63D2\u4EF6\u63A5\u53E3\uFF08/api/plugin/me \u8FD4\u56DE ${res.status}\uFF09\uFF0C\u9700\u8981\u5148\u90E8\u7F72 TellerU \u670D\u52A1\u7AEF`;
    else err = `TellerU \u8FD4\u56DE ${res.status}\uFF0C\u7A0D\u540E\u518D\u8BD5`;
  } catch {
    err = `\u8FDE\u4E0D\u4E0A ${base}\uFF0C\u68C0\u67E5\u7F51\u7EDC\u6216\u300CTellerU \u670D\u52A1\u5730\u5740\u300D`;
  }
  cache2.set(key, { at: Date.now(), v, err });
  return v;
}

// src/host/prefs.ts
init_store();
import { existsSync as existsSync5, readFileSync as readFileSync5, writeFileSync as writeFileSync5 } from "node:fs";
import { join as join5 } from "node:path";
var cache3 = null;
var file = () => join5(dataDir(), "prefs.json");
function load() {
  if (!cache3) {
    try {
      cache3 = existsSync5(file()) ? JSON.parse(readFileSync5(file(), "utf8")) : {};
    } catch {
      cache3 = {};
    }
  }
  return cache3;
}
var prefs = {
  get(k) {
    return load()[k];
  },
  set(k, v) {
    load()[k] = v;
    writeFileSync5(file(), JSON.stringify(cache3));
  }
};

// src/host/index.ts
var name = "telleru-whiteboard";
var inject = ["tools", "commands", "userQuestions", "llm"];
var Config = Schema.object({
  language: Schema.union(["auto", "zh", "en"]).default("auto").description("\u8BB2\u89E3\u8BED\u8A00").volatile(),
  telleruToken: Schema.string().role("secret").default("").description("TellerU \u8D26\u53F7\u4EE4\u724C\uFF1A\u7528\u8D26\u53F7\u79EF\u5206\u8C03\u7528\u8C46\u5305\u8BED\u97F3\uFF08TellerU \u7F51\u7AD9 \u2192 \u8BBE\u7F6E \u2192 \u8FDE\u63A5 AI \u52A9\u624B\uFF09").volatile(),
  telleruBaseUrl: Schema.string().default("https://telleru.cn").description("TellerU \u670D\u52A1\u5730\u5740").volatile(),
  speechApiKey: Schema.string().role("secret").default("").description("\u8C46\u5305\u8BED\u97F3 API Key\uFF08\u81EA\u914D\uFF0C\u7528\u4E8E\u8BED\u97F3\u5408\u6210\uFF1B\u548C\u8D26\u53F7\u90FD\u6709\u65F6\u4F18\u5148\u7528\u5B83\uFF09").volatile(),
  voice: Schema.string().default("zh_female_xiaohe_uranus_bigtts").description("\u8C46\u5305\u8BED\u97F3\u97F3\u8272 ID").volatile()
});
var ROUTE = "/api/telleru-wb.x";
var ENTRY_ID = "telleru-whiteboard";
var APP_DIR = join6(fileURLToPath(new URL(".", import.meta.url)), "app");
var MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json", ".mp3": "audio/mpeg" };
function live(config) {
  const out = {};
  for (const [k, v] of Object.entries(config ?? {})) out[k] = v && typeof v.get === "function" ? v.get() : v;
  return out;
}
function apply(ctx, rawConfig) {
  const cfg = () => live(rawConfig);
  const agents = /* @__PURE__ */ new Map();
  const models = /* @__PURE__ */ new Map();
  const remember = (agent) => {
    try {
      agents.set(String(agent.session.id), agent);
    } catch {
    }
  };
  const agentOf = (sessionId) => {
    const hit = agents.get(sessionId);
    if (hit) return hit;
    try {
      const a = ctx.get?.("agents", false)?.get?.(sessionId);
      if (a) {
        remember(a);
        return a;
      }
    } catch {
    }
    return void 0;
  };
  ctx.on("agent/pre-step", (payload, next) => {
    try {
      remember(payload.agent);
      models.set(String(payload.agent.session.id), { provider: payload.modelSelection.provider, model: payload.modelSelection.model });
    } catch {
    }
    return next();
  });
  const bridgeFor = (board) => {
    const sel = models.get(board.sessionId) ?? board.model;
    if (!sel) return null;
    return async function* ({ system, user, temperature, maxTokens, signal }) {
      const base = { provider: sel.provider, model: sel.model, system, messages: [{ role: "user", content: [{ type: "text", text: user }] }], temperature, maxTokens, sessionId: board.sessionId, purpose: "telleru-whiteboard", signal };
      const attempt = async function* (opts) {
        for await (const ch of ctx.llm.stream(opts)) {
          if (ch.type === "text-delta") yield ch.text;
          else if (ch.type === "finish" && (ch.reason?.kind === "error" || ch.reason?.kind === "aborted")) throw new Error(ch.reason.failure?.message ?? ch.reason.kind);
        }
      };
      if (/deepseek/i.test(sel.provider + sel.model)) {
        let started = false;
        try {
          for await (const t of attempt({ ...base, reasoningEffort: "off" })) {
            started = true;
            yield t;
          }
          return;
        } catch (e) {
          if (started || signal?.aborted) throw e;
          console.warn("[telleru-whiteboard] reasoningEffort=off \u8C03\u7528\u5931\u8D25\uFF0C\u6539\u7528\u9ED8\u8BA4\uFF1A", e.message);
        }
      }
      yield* attempt(base);
    };
  };
  const requestSection = (board, index) => {
    const agent = agentOf(board.sessionId);
    const sec = board.sections[index];
    if (!agent || !sec) return false;
    try {
      agent.followup(createUserMessage({
        content: [{ type: "text", text: `[TellerU \u767D\u677F] \u5B66\u4E60\u8005\u5FEB\u5B66\u5230\u7B2C ${index + 1} \u8282\u4E86\uFF1A\u8BF7\u8C03\u7528 whiteboard_write_section \u5199\u767D\u677F\u8BB2\u89E3\u300C${board.title}\u300D\u7684\u7B2C ${index + 1} \u8282\u300A${sec.title}\u300B\uFF08boardId=${board.id}\uFF0Cindex=${index}\uFF09\u3002\u5199\u597D\u540E\u53EA\u56DE\u590D\u4E00\u53E5\u8BDD\uFF0C\u4E0D\u8981\u590D\u8FF0\u8BB2\u7A3F\u3002` }],
        source: { kind: "telleru-whiteboard", form: "notice", summary: `\u767D\u677F\uFF1A\u51C6\u5907\u7B2C ${index + 1} \u8282\u300A${sec.title}\u300B` }
      }));
      return true;
    } catch {
      return false;
    }
  };
  const voice = () => ({ telleruToken: cfg().telleruToken, telleruBaseUrl: cfg().telleruBaseUrl, speechApiKey: cfg().speechApiKey, voice: cfg().voice });
  const hasVoice = () => !!(cfg().speechApiKey || cfg().telleruToken);
  const host = {
    bridgeFor,
    requestSection,
    tts: makeTts(voice),
    backToChat: (board, sec, p) => {
      const agent = agentOf(board.sessionId);
      if (!agent) return false;
      const lines = [`\u6211\u5728\u767D\u677F\u4E0A\u5B66\u5B8C\u4E86\u300C${board.title}\u300D\u7B2C ${sec.index + 1} \u8282\u300A${sec.title}\u300B\u3002`, p.summary.length ? `\u8FD9\u8282\u7684\u8981\u70B9\uFF1A${p.summary.join("\uFF1B")}` : "", p.pending.length ? `\u8FD8\u6CA1\u638C\u63E1\u7262\u7684\uFF1A${p.pending.join("\uFF1B")}` : ""].filter(Boolean);
      try {
        agent.followup(createUserMessage({ content: [{ type: "text", text: lines.join("\n") }], source: { kind: "user" } }));
        return true;
      } catch {
        return false;
      }
    },
    cloud: hasVoice,
    html: (id) => htmlDoc(id),
    image: (id) => imageBytes(id),
    voiceOf: (lang) => prefs.get(`voice:${lang}`) ?? (lang === "en" ? DEFAULT_VOICE_EN : cfg().voice),
    setVoice: (lang, v) => prefs.set(`voice:${lang}`, v),
    me: () => ({ user: null, plugin: { bound: !!cfg().telleruToken, ownKey: !!cfg().speechApiKey }, tts: hasVoice() ? { voice: prefs.get("voice:zh") ?? cfg().voice } : null, voiceId: prefs.get("voice:zh") ?? cfg().voice, voiceIdEn: prefs.get("voice:en") ?? DEFAULT_VOICE_EN })
  };
  ctx.commands.register({
    name: "telleru",
    description: "TellerU \u767D\u677F\u8BB2\u89E3\uFF1A\u628A\u4F60\u6307\u5B9A\u7684\u5185\u5BB9\u7528\u767D\u677F\u8FB9\u5199\u8FB9\u8BB2",
    input: { hint: "\u8981\u5B66\u7684\u5185\u5BB9\uFF08\u7559\u7A7A = \u8BB2\u4E0A\u9762\u7684\u5BF9\u8BDD\u5185\u5BB9\uFF09" },
    handler: (inv) => {
      const content = inv.rawInput.trim();
      remember(inv.agent);
      inv.agent.inject(createUserMessage({ content: [{ type: "text", text: WORKFLOW(content) }], source: { kind: "telleru-whiteboard", form: "notice", summary: "TellerU \u767D\u677F\u8BB2\u89E3 \xB7 \u5DE5\u4F5C\u6D41\u7A0B" } }));
      inv.agent.followup(createUserMessage({ content: [{ type: "text", text: content ? `\u7528\u767D\u677F\u7ED9\u6211\u8BB2\u8BB2\uFF1A${content}` : "\u7528\u767D\u677F\u7ED9\u6211\u8BB2\u8BB2\u4E0A\u9762\u7684\u5185\u5BB9" }], source: { kind: "user" } }));
      return { kind: "success", text: "TellerU \u767D\u677F\u8BB2\u89E3" };
    }
  });
  const textOut = (v) => [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v) }];
  ctx.tools.register({
    name: "whiteboard_ask",
    description: "TellerU \u767D\u677F\u8BB2\u89E3\uFF1A\u5728\u5BF9\u8BDD\u91CC\u7528\u9009\u9879\u5361\u7247\u95EE\u5B66\u4E60\u8005\uFF08purpose: goal \u6F84\u6E05\u5B66\u4E60\u76EE\u6807 / level \u6478\u5E95\u4E86\u89E3\u638C\u63E1\u7A0B\u5EA6 / outline \u786E\u8BA4\u5927\u7EB2 / sections \u786E\u8BA4\u8BB2\u51E0\u8282 / other\uFF09\u3002\u53EA\u5728 /telleru \u6D41\u7A0B\u91CC\u7528\u3002",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["purpose", "questions"],
      properties: {
        purpose: { type: "string", enum: ["goal", "level", "outline", "sections", "other"] },
        questions: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "question", "options"],
            properties: {
              id: { type: "string" },
              question: { type: "string", description: "\u95EE\u9898\u672C\u8EAB\uFF08\u4E00\u53E5\u8BDD\uFF09" },
              detail: { type: "string", description: "\u8865\u5145\u8BF4\u660E\uFF0C\u5982\u5F85\u786E\u8BA4\u7684\u5927\u7EB2\uFF08\u5404\u8282\u6807\u9898 + \u77E5\u8BC6\u70B9\uFF09" },
              options: { type: "array", minItems: 2, maxItems: 5, items: { type: "object", required: ["label"], additionalProperties: false, properties: { label: { type: "string" }, description: { type: "string" } } } },
              multi_select: { type: "boolean" }
            }
          }
        }
      }
    },
    output: { schema: { type: "object", additionalProperties: true }, render: (_a, v) => textOut(v), presentationMeta: (a, v) => ({ args: a, value: v }) },
    async execute(args, exec) {
      if (exec.agent) remember(exec.agent);
      const header = { goal: "\u5B66\u4E60\u76EE\u6807", level: "\u6478\u5E95", outline: "\u786E\u8BA4\u5927\u7EB2", sections: "\u8BB2\u51E0\u8282", other: "\u767D\u677F\u8BB2\u89E3" }[args.purpose] ?? "\u767D\u677F\u8BB2\u89E3";
      const r = await ctx.userQuestions.ask({
        questions: args.questions.map((q) => ({ id: q.id, question: q.question, header, ...q.detail ? { detail: q.detail } : {}, options: q.options, ...q.multi_select ? { multiSelect: true } : {} })),
        ...exec.agent ? { agent: exec.agent } : {},
        signal: exec.signal
      });
      return { purpose: args.purpose, answers: r.answers.map((a) => ({ id: a.id, selected: [...a.selected], ...a.custom ? { custom: a.custom } : {} })) };
    }
  });
  ctx.tools.register({
    name: "whiteboard_start",
    description: "TellerU \u767D\u677F\u8BB2\u89E3\uFF1A\u6F84\u6E05\u76EE\u6807\u3001\u6478\u5E95\u3001\u6536\u96C6\u8D44\u6599\u3001\u7528\u6237\u786E\u8BA4\u5927\u7EB2\u4E4B\u540E\u8C03\u7528\u3002\u521B\u5EFA\u8FD9\u6B21\u8BB2\u89E3\u5E76\u5728\u53F3\u680F\u6253\u5F00\u767D\u677F\uFF0C\u8FD4\u56DE\u8BB2\u7A3F\u5199\u4F5C\u8BF4\u660E\u3002",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["title", "topic", "source_text", "learner", "sections"],
      properties: {
        title: { type: "string", description: "\u8BB2\u89E3\u6807\u9898\uFF08\u2264 40 \u5B57\uFF09" },
        topic: { type: "string", description: "\u4E00\u53E5\u8BDD\u8BF4\u660E\u8BB2\u4EC0\u4E48" },
        source_text: { type: "string", description: "\u8981\u8BB2\u7684\u539F\u6587\uFF0C\u9010\u5B57\u8D34\u5165\uFF08\u5BF9\u8BDD\u91CC\u7684\u90A3\u6BB5\u5185\u5BB9 / \u9644\u4EF6\u6587\u5B57\uFF09\uFF1B\u8BB2\u7A3F\u5F15\u7528\u53EA\u80FD\u4ECE\u8FD9\u91CC\u9010\u5B57\u6458" },
        learner: { type: "object", additionalProperties: false, required: ["goal", "level"], properties: { goal: { type: "string", description: "\u5B66\u4E60\u76EE\u6807\uFF08\u6F84\u6E05\u7ED3\u679C\uFF09" }, level: { type: "string", description: "\u638C\u63E1\u7A0B\u5EA6\uFF08\u6478\u5E95\u7ED3\u8BBA\uFF1A\u54EA\u4E9B\u4F1A\u3001\u54EA\u4E9B\u4E0D\u4F1A\uFF09" }, notes: { type: "string" } } },
        language: { type: "string", enum: ["zh", "en"] },
        sections: { type: "array", minItems: 1, maxItems: 12, items: { type: "object", additionalProperties: false, required: ["title"], properties: { title: { type: "string" }, summary: { type: "string" } } } }
      }
    },
    output: { schema: { type: "object", additionalProperties: true }, render: (_a, v) => textOut(`${JSON.stringify(withoutGuide(v))}

${v.guide ?? ""}`), presentationMeta: (_a, v) => withoutGuide(v) },
    async execute(args, exec) {
      const agent = exec.agent;
      if (agent) remember(agent);
      const sessionId = agent ? String(agent.session.id) : "unknown";
      const pref = cfg().language;
      const lang = args.language ?? (pref === "auto" ? /[\u4e00-\u9fff]/.test(args.title + args.topic) ? "zh" : "en" : pref);
      const board = {
        id: newBoardId(),
        sessionId,
        model: models.get(sessionId),
        title: args.title.slice(0, 60),
        topic: args.topic.slice(0, 200),
        lang,
        learner: { goal: args.learner.goal.slice(0, 400), level: args.learner.level.slice(0, 600), ...args.learner.notes ? { notes: args.learner.notes.slice(0, 400) } : {} },
        source: { text: args.source_text.slice(0, 6e4), chunks: chunkSource(args.source_text.slice(0, 6e4)) },
        sections: args.sections.map((s, i) => ({ index: i, title: s.title.slice(0, 60), summary: (s.summary ?? "").slice(0, 200), status: "pending", chat: [], qaBoards: [] })),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      board.sections[0].status = "requested";
      board.sections[0].requestedAt = Date.now();
      saveBoard(board, true);
      return {
        boardId: board.id,
        title: board.title,
        sections: board.sections.map((s) => s.title),
        firstSid: sidOf(board.id, 0),
        next: `\u767D\u677F\u5DF2\u5728\u53F3\u680F\u6253\u5F00\u3002\u73B0\u5728\u8C03\u7528 whiteboard_write_section\uFF08boardId="${board.id}", index=0\uFF09\u5199\u7B2C 1 \u8282\u300A${board.sections[0].title}\u300B\u3002`,
        guide: lessonGuide(lang)
      };
    }
  });
  ctx.tools.register({
    name: "whiteboard_write_section",
    description: "TellerU \u767D\u677F\u8BB2\u89E3\uFF1A\u4EA4\u4E00\u8282\u8BB2\u7A3F\uFF08lesson JSON\uFF0C\u683C\u5F0F\u89C1 whiteboard_start / whiteboard_format \u8FD4\u56DE\u7684\u8BF4\u660E\uFF09\u3002\u6709 errors \u5C31\u6309 path \u4FEE\u6539\u540E\u91CD\u4EA4\uFF1Bok \u540E\u5B66\u4E60\u8005\u7ACB\u523B\u80FD\u5728\u767D\u677F\u4E0A\u542C\u3002",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["boardId", "index", "lesson"],
      properties: { boardId: { type: "string" }, index: { type: "integer", minimum: 0 }, lesson: { type: "object", additionalProperties: true, description: "\u4E00\u8282\u8BFE\u7684\u8BB2\u7A3F\uFF1AopeningQuestions / opening / points[3] / closing / glossary" } }
    },
    output: { schema: { type: "object", additionalProperties: true }, render: (_a, v) => textOut(v), presentationMeta: (_a, v) => v },
    async execute(args, exec) {
      if (exec.agent) remember(exec.agent);
      const board = loadBoard(args.boardId);
      if (!board) return { ok: false, errors: [{ path: "boardId", message: "\u8FD9\u5757\u767D\u677F\u4E0D\u5B58\u5728\uFF1A\u5148\u8C03\u7528 whiteboard_start" }] };
      const sec = board.sections[args.index];
      if (!sec) return { ok: false, errors: [{ path: "index", message: `index \u8D85\u51FA\u8303\u56F4\uFF08\u5171 ${board.sections.length} \u8282\uFF0C\u4ECE 0 \u5F00\u59CB\uFF09` }] };
      const r = compileSection(board, args.index, args.lesson, { images: false });
      if (!r.ok || !r.lesson) return { ok: false, boardId: board.id, index: args.index, title: sec.title, errors: r.errors.slice(0, 40), warnings: r.warnings.slice(0, 20), hint: "\u6309 path \u4FEE\u6539\u540E\u91CD\u65B0\u8C03\u7528 whiteboard_write_section\uFF08\u4EA4\u5B8C\u6574\u7684 lesson\uFF09" };
      sec.lesson = await enrichSection(board, args.index, r.lesson, { bridge: bridgeFor(board), images: null });
      sec.status = "ready";
      sec.writtenAt = (/* @__PURE__ */ new Date()).toISOString();
      if (!board.model) board.model = models.get(board.sessionId);
      saveBoard(board, true);
      const next = board.sections[args.index + 1];
      return {
        ok: true,
        boardId: board.id,
        index: args.index,
        title: sec.title,
        sid: sidOf(board.id, args.index),
        warnings: r.warnings.slice(0, 20),
        next: next ? `\u7B2C ${args.index + 1} \u8282\u5DF2\u4E0A\u767D\u677F\u3002\u4E0D\u8981\u63A5\u7740\u5199\u7B2C ${args.index + 2} \u8282\uFF1A\u5B66\u4E60\u8005\u5B66\u5230\u65F6\u4F1A\u53D1\u6765\u8BF7\u6C42\u3002\u73B0\u5728\u7528\u4E00\u53E5\u8BDD\u544A\u8BC9\u7528\u6237\u53EF\u4EE5\u5F00\u59CB\u542C\u4E86\u3002` : "\u5168\u90E8\u5199\u5B8C\u3002\u7528\u4E00\u53E5\u8BDD\u544A\u8BC9\u7528\u6237\u53EF\u4EE5\u5728\u767D\u677F\u4E0A\u5B66\u4E86\u3002"
      };
    }
  });
  ctx.tools.register({
    name: "whiteboard_format",
    description: "TellerU \u767D\u677F\u8BB2\u89E3\uFF1A\u91CD\u65B0\u67E5\u770B\u8BB2\u7A3F\u5199\u4F5C\u8BF4\u660E\uFF08\u5199\u540E\u9762\u7684\u8282\u65F6\uFF0C\u5982\u679C\u5BF9\u8BDD\u91CC\u5DF2\u7ECF\u770B\u4E0D\u5230\u683C\u5F0F\u8BF4\u660E\u5C31\u8C03\u7528\u5B83\uFF09\u3002",
    parameters: { type: "object", additionalProperties: false, required: ["boardId"], properties: { boardId: { type: "string" } } },
    output: { schema: { type: "object", additionalProperties: true }, render: (_a, v) => textOut(v.guide ?? v) },
    async execute(args) {
      const board = loadBoard(args.boardId);
      if (!board) return { guide: "\u8FD9\u5757\u767D\u677F\u4E0D\u5B58\u5728\u3002" };
      const pending = board.sections.filter((s) => !s.lesson).map((s) => `\u7B2C ${s.index + 1} \u8282\uFF08index=${s.index}\uFF09\u300A${s.title}\u300B${s.summary ? `\uFF1A${s.summary}` : ""}`);
      return { guide: `\u5B66\u4E60\u8005\uFF1A\u76EE\u6807 ${board.learner.goal}\uFF1B\u638C\u63E1\u7A0B\u5EA6 ${board.learner.level}
\u8FD8\u6CA1\u5199\u7684\u8282\uFF1A
${pending.join("\n") || "\uFF08\u65E0\uFF09"}
\u539F\u6587\uFF08\u5F15\u7528\u53EA\u80FD\u4ECE\u8FD9\u91CC\u9010\u5B57\u6458\uFF09\uFF1A
${board.source.text.slice(0, 12e3)}

${lessonGuide(board.lang)}` };
    }
  });
  ctx.inject(["connection"], (inj) => {
    const connection = inj.get("connection");
    inj.effect(() => connection.fetch.register({
      path: ROUTE,
      methods: ["GET", "POST", "PUT"],
      requestBody: "buffered",
      fetch: async (req) => {
        try {
          const url = new URL(req.url);
          const p = (url.searchParams.get("p") ?? "").replace(/^\/+/, "");
          if (p.startsWith("app/") || p === "app") return serveApp(p === "app" ? "index.html" : p.slice(4));
          if (p === "settings") return await settingsRoute(req);
          if (p === "boards") return Response.json({ boards: boardsOfSession(url.searchParams.get("session") ?? "").map((b) => ({ id: b.id, title: b.title, sections: b.sections.length, createdAt: b.createdAt })) });
          if (p.startsWith("api/")) return await handleApi(host, p, req);
          return new Response("not found", { status: 404 });
        } catch (e) {
          return Response.json({ error: { code: "INTERNAL", message: e.message } }, { status: 500 });
        }
      }
    }), "telleru-whiteboard: routes");
  });
  const SECRET = ["telleruToken", "speechApiKey"];
  const EDITABLE = ["language", "telleruToken", "telleruBaseUrl", "speechApiKey", "voice"];
  async function settingsRoute(req) {
    const c = cfg();
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const patch = {};
      for (const k of EDITABLE) if (typeof body[k] === "string") patch[k] = body[k].trim();
      const settings = ctx.get?.("settings", false);
      if (!settings?.update) return Response.json({ error: { message: "\u5BBF\u4E3B\u6CA1\u6709\u63D0\u4F9B\u8BBE\u7F6E\u670D\u52A1\uFF0C\u8BF7\u5728 profile \u7684 cordis.patch.yml \u91CC\u586B\u5199 telleru-whiteboard \u7684 config" } }, { status: 501 });
      try {
        await settings.update(ENTRY_ID, patch);
      } catch (e) {
        return Response.json({ error: { message: e.message } }, { status: 400 });
      }
      if (typeof patch.voice === "string") prefs.set("voice:zh", patch.voice);
      return Response.json({ ok: true });
    }
    const values = {};
    for (const k of EDITABLE) values[k] = SECRET.includes(k) ? { set: !!c[k] } : c[k];
    const fresh = new URL(req.url).searchParams.get("fresh");
    const [account, speech] = await Promise.all([
      c.telleruToken ? accountInfo(c.telleruBaseUrl, c.telleruToken, fresh === "1" || fresh === "account") : null,
      c.speechApiKey ? checkSpeechKey(c.speechApiKey, c.voice || DEFAULT_VOICE_ID, fresh === "1" || fresh === "speech") : null
    ]);
    const active = speech?.ok ? "own" : account ? "account" : c.speechApiKey ? "own" : null;
    return Response.json({ values, account, speech, active, accountError: c.telleruToken && !account ? accountError(c.telleruBaseUrl, c.telleruToken) ?? "\u4EE4\u724C\u65E0\u6548\uFF0C\u6216\u8FDE\u4E0D\u4E0A TellerU" : null, voices: VOICES.filter((v) => voiceLang(v) === "zh").map((v) => ({ id: v.id, label: v.label, desc: v.desc })) });
  }
  ctx.effect?.(() => () => flushAll(), "telleru-whiteboard: flush");
}
function withoutGuide(v) {
  const { guide: _g, ...rest } = v ?? {};
  return rest;
}
function serveApp(rel2) {
  const file2 = normalize(join6(APP_DIR, rel2));
  if (!file2.startsWith(APP_DIR) || !existsSync6(file2)) return new Response("not found", { status: 404 });
  const type = MIME[extname(file2)] ?? "application/octet-stream";
  const headers = { "content-type": type, "cache-control": rel2 === "index.html" ? "no-store" : "public, max-age=3600" };
  if (rel2 === "index.html") headers["x-content-type-options"] = "nosniff";
  return new Response(readFileSync6(file2), { headers });
}
export {
  Config,
  apply,
  inject,
  name
};
