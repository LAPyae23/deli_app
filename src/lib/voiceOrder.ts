/**
 * Turns a spoken or typed order ("2 mohinga and a cola", "မုန့်ဟင်းခါး နှစ်ပွဲနဲ့ ကော်ဖီ")
 * into menu items and quantities.
 *
 * 1. Split the sentence into parts at "and", commas, "နဲ့", "ရယ်", "၊" …
 * 2. In each part, find the dish whose name (or Burmese alias) matches best.
 * 3. Read the quantity from digits (1, ၂), English words (two) or Burmese
 *    words (နှစ်); default 1.
 */

const BURMESE_DIGITS = '၀၁၂၃၄၅၆၇၈၉';

const NUMBER_WORDS: Array<[string, number]> = [
  // Burmese (longer words first so "ခုနစ်" wins over "ခု")
  ['ခုနစ်', 7],
  ['ခြောက်', 6],
  ['တစ်', 1],
  ['နှစ်', 2],
  ['သုံး', 3],
  ['လေး', 4],
  ['ငါး', 5],
  ['ရှစ်', 8],
  ['ကိုး', 9],
  ['ဆယ်', 10],
  // English
  ['one', 1],
  ['a', 1],
  ['an', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
  ['couple', 2],
];

/** Burmese words for common dishes → English words that appear in menu names. */
export const BURMESE_ALIASES: Record<string, string> = {
  မုန့်ဟင်းခါး: 'mohinga',
  ရှမ်းခေါက်ဆွဲ: 'shan noodle',
  ခေါက်ဆွဲ: 'noodle',
  ထမင်းကြော်: 'fried rice',
  ထမင်း: 'rice',
  လက်ဖက်သုပ်: 'tea leaf salad',
  လက်ဖက်ရည်: 'tea',
  ကော်ဖီ: 'coffee',
  ကြက်ကြော်: 'fried chicken',
  ကြက်: 'chicken',
  ဝက်: 'pork',
  အမဲ: 'beef',
  ပုစွန်: 'prawn',
  ဘာဂါ: 'burger',
  ပီဇာ: 'pizza',
  ကိုလာ: 'cola',
  ကိုကာကိုလာ: 'coca cola',
  ရေခဲမုန့်: 'ice cream',
  ဖျော်ရည်: 'juice',
  သုပ်: 'salad',
  ဟင်းချို: 'soup',
  ကြာဇံ: 'glass noodle',
  ဒံပေါက်: 'biryani',
  နံပြား: 'naan',
  ဖာလူဒါ: 'faluda',
  ရေ: 'water',
};

const SPLIT = /\s*(?:,|၊|။|\band\b|\bplus\b|\bwith\b|နဲ့|နှင့်|ရယ်|ပြီးတော့)\s*/i;
const FILLER = /\b(i|want|would|like|please|order|get|me|give|can|have|some|of|the|pcs|plates?|cups?|bottles?)\b/gi;

export type MenuCandidate = { id: string; name: string; restaurantId: string };
export type VoiceLine = { item: MenuCandidate; quantity: number; heard: string };

function normalize(text: string) {
  let s = text.toLowerCase();
  for (let i = 0; i < 10; i++) s = s.replaceAll(BURMESE_DIGITS[i], String(i));
  return s.replace(/\s+/g, ' ').trim();
}

/** English words for any Burmese dish words in the text. */
function translateAliases(text: string) {
  let out = text;
  const keys = Object.keys(BURMESE_ALIASES).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (out.includes(k)) out = out.replaceAll(k, ` ${BURMESE_ALIASES[k]} `);
  }
  return out;
}

export function parseQuantity(input: string): number {
  const part = normalize(input);
  const digits = part.match(/\b(\d{1,2})\b|(\d{1,2})\s*(?:x|ပွဲ|ခု|ဘူး|ခွက်)/);
  if (digits) return Math.min(20, Math.max(1, Number(digits[1] || digits[2])));
  const lower = ` ${part.toLowerCase()} `;
  for (const [word, n] of NUMBER_WORDS) {
    const isBurmese = /[က-႟]/.test(word);
    if (isBurmese ? lower.includes(word) : new RegExp(`\\b${word}\\b`).test(lower)) return n;
  }
  return 1;
}

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9က-႟ ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

/** 0..1: how well the spoken part matches a menu name. */
export function matchScore(part: string, name: string) {
  const p = ` ${part} `;
  const n = name.toLowerCase();
  if (p.includes(` ${n} `) || p.includes(n)) return 1;
  const nameTokens = tokens(n);
  if (nameTokens.length === 0) return 0;
  const partTokens = new Set(tokens(part).map((t) => t.replace(/s$/, '')));
  const hit = nameTokens.filter((t) => partTokens.has(t.replace(/s$/, ''))).length;
  return hit / nameTokens.length;
}

export function parseVoiceOrder(text: string, menu: MenuCandidate[], minScore = 0.5): {
  lines: VoiceLine[];
  unmatched: string[];
} {
  const raw = normalize(text);
  const parts = raw.split(SPLIT).map((p) => p.trim()).filter(Boolean);
  const lines: VoiceLine[] = [];
  const unmatched: string[] = [];

  for (const part of parts) {
    const quantity = parseQuantity(part);
    const english = translateAliases(part).replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
    let best: MenuCandidate | null = null;
    let bestScore = 0;
    for (const item of menu) {
      const score = matchScore(english, item.name);
      // Prefer the more specific (longer) name on ties: "fried chicken" over "chicken".
      if (score > bestScore || (score === bestScore && best && score > 0 && item.name.length > best.name.length)) {
        best = item;
        bestScore = score;
      }
    }
    if (best && bestScore >= minScore) {
      const existing = lines.find((l) => l.item.id === best!.id);
      if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
      else lines.push({ item: best, quantity, heard: part });
    } else {
      unmatched.push(part);
    }
  }
  return { lines, unmatched };
}
