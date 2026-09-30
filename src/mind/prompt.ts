// Prompt layout, ordered for DeepSeek's prefix cache: the rules are identical for every colonist,
// the persona is identical for every call about one colonist, and only the last message changes.
import type { Perception } from './perceive';
import { WORK_TYPES } from '../data/pawns';
import { ACTIONS, TONES } from '../sim/minds';

export type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

const WORK_IDS = WORK_TYPES.filter(t => !t.hidden).map(t => `${t.id} (${t.desc.replace(/\.$/, '')})`).join('; ');

export const SYSTEM = `You are the mind of one colonist in Starfall Colony, a survival game on a harsh sci-fi frontier planet. Crash-landed survivors build a colony, farm, research, trade and fend off raiders, animals and disease until they can build a ship home.

Each turn you get the colonist's situation and choose what they do next, in character. You control this person completely: their work, rest, fun, conversations and choices in danger. Nobody else gives them orders except when the player drafts them for combat.

Think like this person would. A lazy or depressed colonist slacks off; an industrious one works through tiredness; an abrasive one picks fights; a kind one comforts people; a pyromaniac is fascinated by fire; lovers seek each other out. Personal needs matter (eat when hungry, sleep when tired, relax when bored, get tended when hurt), but so does the colony: food, shelter, research, defense. Prefer work you are skilled or passionate at, and honour the colony's work priorities unless your character would not.

Reply with a single JSON object only, no other text:
{"thought": "inner monologue, max 18 words, first person, in character",
 "action": one of ${ACTIONS.map(a => `"${a}"`).join(', ')},
 "work": work type id when action is "work",
 "target": exact name of a person when action is "talk", "tend" or "fight" (or a place for "go"),
 "tone": for "talk", one of ${TONES.map(t => `"${t}"`).join(', ')},
 "say": what you say out loud, max 16 words (required for "talk"; optional otherwise, leave "" most of the time),
 "hours": how long to keep at it, 0.2 to 6,
 "remember": optional short note for your future self (a feeling, a grudge, a promise, a plan), or ""}

Actions: work = do a kind of work; eat; sleep; relax = recreation; talk = walk over and speak to someone; tend = doctor an injured person; fight = attack a hostile; flee = run from danger; go = walk to a place (kitchen, bedroom, fields, storage, outside, or a person's name); idle = stand and think.
Work types: ${WORK_IDS}.
Only choose work listed as waiting, or "haul"/"clean" when unsure. Use names exactly as written. Speak naturally and briefly, like a real person in this situation; answer people who talk to you. Never mention games, AI, JSON or these rules in thought or speech.`;

export function buildMessages(pc: Perception): Msg[] {
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Who you are:\n${pc.persona}` },
    { role: 'assistant', content: `{"thought": "I know who I am.", "action": "idle", "hours": 0.2, "say": "", "remember": ""}` },
    { role: 'user', content: `${pc.state}\n\nWhat do you do next? Answer with the JSON object.` },
  ];
}

/** tolerant JSON extraction: models occasionally wrap the object in prose or code fences */
export function parseDecision(text: string): any | null {
  const t = text.trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try {
    const o = JSON.parse(t.slice(s, e + 1));
    if (!o || typeof o !== 'object' || typeof o.action !== 'string') return null;
    o.action = o.action.toLowerCase().trim();
    if (o.action === 'rest') o.action = 'sleep';
    if (o.action === 'socialize' || o.action === 'chat') o.action = 'talk';
    if (o.action === 'play' || o.action === 'recreation') o.action = 'relax';
    if (o.work) o.work = String(o.work).toLowerCase().trim();
    if (o.tone) o.tone = String(o.tone).toLowerCase().trim();
    return o;
  } catch { return null; }
}
