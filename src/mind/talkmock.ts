// Offline stand-in for conversation replies: reads what the leader said for requests, tone and
// intent, then answers in character with the same Outcome the language model would produce.
// Personality, trust, mood, needs, skill, passion and workload decide whether a colonist agrees,
// haggles for something in return, or refuses.
import type { World } from '../sim/world';
import type { Pawn } from '../sim/types';
import type { WorkType } from '../data/types';
import { WORK_TYPES } from '../data/pawns';
import { lead, type Outcome, type When } from '../sim/leader';
import { pawnShortName } from '../sim/things';
import { skillLevel, isIncapable } from '../sim/stats';
import { thoughtMood } from '../sim/mood';
import type { TalkMode } from './talk';

export interface MockMemo { haggle?: { work: WorkType; regular: boolean; when: When; want: string }; offer?: WorkType; topic?: string }
export interface MockCtx { mode: TalkMode; others: Pawn[]; turns: number }

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const WORDS: [RegExp, WorkType][] = [
  [/\b(cook|cooking|meals?|kitchen|food|dinner|lunch|breakfast|butcher)/, 'cook'],
  [/\b(grow|growing|plant(?!\s*cut)|planting|farm|farming|sow|sowing|harvest|crops?|fields?|garden)/, 'grow'],
  [/\b(build|building|construct|walls?|roof|repair|barracks|floor)/, 'construct'],
  [/\b(haul|hauling|carry|carrying|stockpile|storage|move the|refuel)/, 'haul'],
  [/\b(clean|cleaning|mess|filth|sweep|tidy)/, 'clean'],
  [/\b(research|study|studying|science|lab|tech)/, 'research'],
  [/\b(mine|mining|dig|digging|rock|ore|quarry)/, 'mine'],
  [/\b(hunt|hunting|shoot the|game meat)/, 'hunt'],
  [/\b(doctor|tend|heal|medic|patch (them|him|her) up|nurse|wounded)/, 'doctor'],
  [/\b(chop|trees?|wood|lumber|logging|cut (the )?plants?)/, 'plantcut'],
  [/\b(tame|animals?|milk|shear|livestock|herd)/, 'handle'],
  [/\b(prisoners?|warden|recruit)/, 'warden'],
  [/\b(sculpt|sculpture|art|paint)/, 'art'],
  [/\b(smith|weapons?|guns?|forge)/, 'smith'],
  [/\b(tailor|clothes|clothing|parka|armor|sew)/, 'tailor'],
  [/\b(craft|crafting|components?|stonecut|bricks?|medicine)/, 'craft'],
  [/\b(fires?|firefight|put out)/, 'firefight'],
];
/** the kind of work a sentence is about: the earliest mention wins ("cook for us, we need food") */
export function detectWork(text: string): WorkType | null {
  const t = text.toLowerCase();
  let best: WorkType | null = null, at = 1e9;
  for (const [re, id] of WORDS) { const m = re.exec(t); if (m && m.index < at) { at = m.index; best = id; } }
  return best;
}
const has = (t: string, re: RegExp) => re.test(t);
const RE = {
  polite: /\b(please|could you|would you|can you|if you (can|could|don't mind)|would you mind|when you get a chance|i'd appreciate|do you think you could)\b/,
  reason: /\b(because|we need|so that|otherwise|for the colony|we'll|we will|starv|winter|raid|important|help us|everyone|survive|so we can)\b/,
  praise: /\b(great|amazing|good job|well done|proud|the best|brilliant|excellent|nice work|incredible|awesome|fantastic|good work|thank you|thanks|appreciate)\b/,
  thanks: /\b(thank|thanks|appreciate)\b/,
  insult: /\b(lazy|useless|idiot|stupid|pathetic|worthless|shut up|moron|dumb|incompetent|waste of)\b/,
  threat: /\b(or else|kill you|punish|banish|kick you out|throw you out|consequences|i'll make you|last warning|you'll regret|or you're out)\b/,
  demand: /(\bnow!|\bright now\b|\bdo it\b|\bi order\b|\bthat's an order\b|\byou will\b|\byou must\b|\bget to work\b|\bget on it\b|!{2,})/,
  comfort: /\b(how are you|how're you|how do you feel|how you feeling|are you ok|are you okay|you alright|what's wrong|what's bothering|doing ok|i understand|i hear you|that's hard|talk to me|what's on your mind)\b/,
  sorry: /\b(sorry|apologi[sz]e|my fault|my bad|forgive me)\b/,
  promise: /\b(i promise|i'll make sure|you'll get|i will get you|i'll get you|i'll build you|i'll give you|you have my word|you can have|deal)\b/,
  yes: /^(yes|yeah|yep|sure|ok|okay|deal|fine|agreed|alright|all right|of course|you got it|absolutely|done|sounds good)\b|\b(it's a deal|you have my word|i promise|that's fair|fair enough)\b/,
  no: /^(no|nope|nah|not now|i can't|i won't|never)\b/,
  release: /\b(stop (doing|the)|release you|no longer|don't need you to|take a break from|off duty|relieve you|you can stop|drop the|quit (the|doing))\b/,
  regular: /\b(every|daily|each day|regular|regularly|from now on|always|full[- ]time|in charge|your job|keep doing|permanently|each morning|each night|on a regular|ongoing|routine)\b/,
  bye: /\b(bye|goodbye|see you|that's all|talk later|carry on|dismissed|off you go|that will be all)\b/,
  joke: /\b(joke|funny|haha|lol|laugh)\b/,
};
const whenOf = (t: string): When => (/\bmorning/.test(t) ? 'morning' : /\bafternoon/.test(t) ? 'afternoon' : /\b(evening|tonight|after dinner)/.test(t) ? 'evening' : /\b(night|overnight|night shift)/.test(t) ? 'night' : 'any');
const workName = (id: WorkType) => ({ cook: 'cooking', grow: 'growing', construct: 'building', haul: 'hauling', clean: 'cleaning', research: 'research', mine: 'mining', hunt: 'hunting', doctor: 'doctoring', plantcut: 'tree cutting', handle: 'animal work', warden: 'warden work', art: 'art', smith: 'smithing', tailor: 'tailoring', craft: 'crafting', firefight: 'firefighting' } as Record<string, string>)[id] || id;

/** what a colonist would ask for in return, from what they lack */
function wantOf(w: World, p: Pawn): string {
  if (!p.bed) return 'a proper bed of my own';
  if (p.needs.food < 0.35) return 'a decent meal first';
  if (p.needs.rest < 0.3) return 'some sleep first';
  if (p.needs.mood < 0.35) return 'a day off after';
  if (p.needs.joy < 0.35) return 'some time to unwind after';
  return pick(['a better room', 'first pick of the next good meal', 'you owe me one', 'a say in what we research next']);
}

export function mockTalk(w: World, p: Pawn, line: string | null, memo: MockMemo, ctx: MockCtx): Outcome {
  const L = lead(p);
  const T = new Set(p.traits);
  const trust = L.trust, mood = p.needs.mood;
  const abrasive = T.has('abrasive'), kind = T.has('kind'), lazy = T.has('lazy') || T.has('slothful'), keen = T.has('industrious') || T.has('hard_worker');
  const flavor = (s: string, e: Outcome['emotion'] = 'neutral'): Outcome => ({ say: abrasive && Math.random() < 0.3 ? `${pick(['Hmph.', 'Look.', 'Fine.'])} ${s}` : kind && e === 'happy' && Math.random() < 0.3 ? `${s} Anything for the colony.` : s, emotion: e, agree: [], drop: [], trust: 0, felt: 'none', promise: '', opinion: {}, remember: '', end: false });
  // opening greeting
  if (line === null) {
    if (mood < 0.3) return flavor(pick(["...Hey. It's not a great day.", "Hi. I'm not doing so well, honestly.", 'Oh. Hey. Sorry, I was miles away.']), 'sad');
    if (trust < -15) return flavor(pick(['What do you want now?', 'Make it quick.', "Oh. It's you."]), 'annoyed');
    if (trust >= 35) return flavor(pick(['Hey, boss! Good to see you.', 'Oh, hi! What can I do for you?', 'There you are! Everything alright?']), 'happy');
    return flavor(abrasive ? 'What?' : pick(["Hey. What's up?", 'Oh, hi. You wanted to talk?', 'Hey, boss.']), 'neutral');
  }
  const t = line.toLowerCase();
  const others = ctx.others;
  const peace = /\b(make up|get along|shake|apologi|work (it|this) out|settle|peace|forgive|move on|truce)/.test(t);
  const named = others.find(o => [o.name.nick, o.name.first].some(n => n && t.includes(n.toLowerCase()))) || (ctx.mode === 'mediate' && peace ? others[0] : undefined);
  const tone = { polite: has(t, RE.polite), reason: has(t, RE.reason), praise: has(t, RE.praise), insult: has(t, RE.insult), threat: has(t, RE.threat), demand: has(t, RE.demand), sorry: has(t, RE.sorry) };
  const felt = tone.threat ? 'threatened' : tone.insult ? 'insulted' : tone.praise ? (has(t, RE.thanks) ? 'thanked' : 'praised') : 'none';
  const base = (o: Outcome): Outcome => ({ ...o, felt: o.felt && o.felt !== 'none' ? o.felt : felt, trust: (o.trust || 0) + (tone.insult ? -5 : 0) + (tone.threat ? -7 : 0) + (tone.praise && !tone.insult ? 1 : 0) });
  // answering a counter-offer
  if (memo.haggle) {
    const h = memo.haggle;
    if (has(t, RE.yes) || has(t, RE.promise)) {
      memo.haggle = undefined;
      return base({ ...flavor(pick(["Deal. I'll hold you to that.", "Alright then. You've got yourself a deal.", "Okay. I'm trusting you on this one."]), 'happy'), agree: [{ work: h.work, regular: h.regular, when: h.when }], promise: h.want, trust: 2, remember: `The leader promised me ${h.want}.` });
    }
    if (has(t, RE.no)) { memo.haggle = undefined; return base({ ...flavor(pick(['Then find someone else.', "Then I guess it's not getting done by me.", 'Figures.']), 'annoyed'), trust: -1 }); }
  }
  // accepting something the colonist offered themselves
  if (memo.offer && (has(t, RE.yes) || /\b(go ahead|please do|do it|take it|that'd be great|that would be great)\b/.test(t))) {
    const work = memo.offer; memo.offer = undefined;
    return base({ ...flavor(pick(["Great, I'll get on it.", "Leave it to me.", "You won't regret it."]), 'excited'), agree: [{ work, regular: true, when: 'any' }], trust: 2, felt: tone.praise ? 'thanked' : 'none' });
  }
  const work = detectWork(t);
  // releasing someone from work
  if (has(t, RE.release)) {
    const d = L.duties.find(x => !work || x.work === work);
    if (d) return base({ ...flavor(lazy ? pick(['Oh thank goodness.', 'Finally, a break.']) : pick(['Oh. Alright, if you say so.', "Okay. I'll stop."]), lazy ? 'happy' : 'neutral'), drop: [d.work] });
  }
  if (work) {
    const def = WORK_TYPES.find(x => x.id === work)!;
    if (isIncapable(p, work)) return base(flavor(pick([`I don't do ${workName(work)}. Never have, never will.`, `Sorry, ${workName(work)} is just not something I can do.`]), 'embarrassed'));
    if (L.duties.some(d => d.work === work)) return base(flavor(pick(["I'm already on it.", `That's already my job, remember?`]), 'thinking'));
    const regular = has(t, RE.regular);
    const when = whenOf(t);
    const sk = def.skills[0];
    const lvl = sk ? skillLevel(p, sk) : 5, passion = sk ? p.skills[sk]?.passion || 0 : 0;
    let score = trust / 25 + (tone.polite ? 0.8 : 0) + (tone.reason ? 0.9 : 0) + (tone.praise ? 0.5 : 0) - (tone.insult ? 2.5 : 0) - (tone.demand ? 1 : 0) + lvl / 7 + passion * 1.1
      - (regular ? 1.1 : 0) - L.duties.length * 0.5 - (when === 'night' ? 1 : 0) + (keen ? 1.4 : 0) - (lazy ? 1.4 : 0) + (kind ? 0.6 : 0) - (abrasive ? 0.6 : 0)
      + (T.has('optimist') || T.has('sanguine') ? 0.4 : 0) - (T.has('pessimist') || T.has('depressive') ? 0.5 : 0) - (mood < 0.3 ? 1.4 : 0) - (p.needs.rest < 0.2 || p.needs.food < 0.2 ? 1 : 0)
      - (ctx.mode === 'address' ? 0.7 : 0) + (Math.random() * 2 - 1);
    if (tone.threat) score += T.has('wimp') || T.has('nervous') ? 1.5 : -2;
    const agreeO = (s: string, e: Outcome['emotion'] = 'happy'): Outcome => base({ ...flavor(s, e), agree: [{ work, regular, when, note: '' }], trust: tone.polite || tone.reason ? 1 : 0 });
    if (tone.threat && score > 0.8) return base({ ...agreeO(pick(['Okay, okay! I will.', "Fine. I'll do it. No need for that."]), 'scared') });
    if (score > 1.3) {
      if (passion) return agreeO(pick([`Oh, I'd love to! ${def.label} is my thing.`, `Say no more. I've been itching to do some ${workName(work)}.`]), 'excited');
      return agreeO(regular ? pick([`Alright, ${workName(work)} is mine from now on.`, `Sure. I'll make ${workName(work)} my job.`]) : pick(["Sure, I'll take care of it.", "Consider it done.", 'On it.']));
    }
    if (score > 0.1 && ctx.mode !== 'address') {
      const want = wantOf(w, p);
      memo.haggle = { work, regular, when, want };
      return base(flavor(pick([`I'll do the ${workName(work)}... if I get ${want}.`, `Hmm. What's in it for me? ${want[0].toUpperCase() + want.slice(1)}, maybe?`, `Maybe. But I want ${want}.`]), 'thinking'));
    }
    const load = L.duties.length >= 3 ? `I already do ${L.duties.slice(0, 3).map(d => workName(d.work)).join(', ')}!` : '';
    const why = tone.insult || tone.threat ? pick(['Not after talking to me like that.', 'Ask me nicely and maybe.']) : load || (trust < -10 ? pick(['Why should I do anything for you?', "You haven't earned that."]) : lvl < 3 && sk ? `I'm terrible at ${workName(work)}. Ask someone else.` : p.needs.rest < 0.25 ? "I'm dead on my feet. No." : lazy ? pick(['Ugh. No.', 'That sounds like a lot of work.']) : mood < 0.3 ? "I can't right now. I just can't." : ctx.mode === 'address' ? pick(['Not me.', 'Someone else can do that.']) : pick(["I don't think so.", "Not really my kind of thing."]));
    return base({ ...flavor(why, tone.insult || tone.threat ? 'angry' : 'annoyed'), trust: tone.insult || tone.threat ? -2 : 0 });
  }
  // everything else: small talk, feelings, praise, disputes, goodbyes
  if (tone.threat) return base({ ...flavor(T.has('wimp') || T.has('nervous') ? pick(['Please... I got it, I got it.', "You're scaring me."]) : pick(['Are you threatening me?', 'Try it.']), T.has('wimp') ? 'scared' : 'angry'), remember: 'The leader threatened me.' });
  if (tone.insult) return base({ ...flavor(pick(['Excuse me?!', "Wow. Tell me how you really feel.", "I don't have to take this from you."]), 'angry'), remember: 'The leader insulted me.' });
  if (tone.sorry) return base({ ...flavor(pick(['Okay. Thanks for saying that.', "Apology accepted. Don't make a habit of it.", 'I appreciate that. Really.']), 'happy'), trust: 3 });
  if (named) {
    const op = Math.round(p.rel[named.id]?.op || 0);
    const n = pawnShortName(named);
    if (ctx.mode === 'mediate' && peace) {
      const ok = trust > -10 && (kind || op > -60 || Math.random() < 0.5);
      return base({ ...flavor(ok ? pick([`Fine. ${n}, I'm willing to move on if you are.`, `Alright. For the colony. Truce, ${n}?`]) : pick([`No way. Not until ${n} apologises.`, `You're taking ${n}'s side? Unbelievable.`]), ok ? 'neutral' : 'angry'), opinion: { [named.name.nick || named.name.first]: ok ? 8 : -3 }, trust: ok ? 1 : -1 });
    }
    return base(flavor(op > 20 ? pick([`${n}? ${n}'s great. I'd trust them with my life.`, `Honestly, ${n} keeps me going out here.`]) : op < -20 ? pick([`Don't get me started on ${n}.`, `${n} and I... we don't get along.`]) : `${n}? They're alright, I guess.`, op < -20 ? 'annoyed' : op > 20 ? 'happy' : 'thinking'));
  }
  if (has(t, RE.comfort)) {
    const bad = thoughtMood(p).filter(x => x.mood < -2).sort((a, b) => a.mood - b.mood)[0];
    const good = thoughtMood(p).filter(x => x.mood > 2).sort((a, b) => b.mood - a.mood)[0];
    if (mood < 0.4 && bad) return base({ ...flavor(`Honestly? ${bad.label}. It's getting to me.`, 'sad'), felt: 'comforted', trust: 2 });
    return base({ ...flavor(mood > 0.65 ? `Pretty good, actually!${good ? ` ${good.label}.` : ''}` : pick(["I'm managing. Thanks for asking.", 'Could be worse. Could be better.']), mood > 0.65 ? 'happy' : 'neutral'), felt: 'comforted', trust: 1 });
  }
  if (has(t, RE.bye)) return base({ ...flavor(pick(['See you around.', 'Alright, back to it.', 'Later, boss.']), 'neutral'), end: true });
  if (tone.praise) return base({ ...flavor(pick(['Thanks, that means a lot.', 'Aw, stop it. But thanks.', 'Just doing my part.']), 'happy'), trust: 2 });
  if (has(t, RE.joke)) return base(flavor(pick(['Ha! Good one.', "Heh. Don't quit your day job.", '...I don\'t get it.']), 'happy'));
  if (has(t, RE.yes) && memo.topic) return base({ ...flavor(pick(['Thanks for hearing me out.', "Good. That's all I wanted.", 'Okay. Glad we talked.']), 'happy'), trust: 2, felt: 'comforted' });
  if (/\?\s*$/.test(t)) return base(flavor(pick(["Hmm. I'd have to think about that.", "I'm not sure, honestly.", 'Good question. No idea.', "Why do you ask?"]), 'thinking'));
  return base(flavor(pick(['Mm-hm.', 'If you say so.', 'Right.', 'Okay...?', "I hear you."]), 'neutral'));
}
