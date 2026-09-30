// Offline stand-in for the language model: a small personality-driven rule set that produces the
// same JSON decisions, so AI-minds mode can be tried (and tested) without a DeepSeek key.
import type { Perception } from './perceive';

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const LINES: Record<string, string[]> = {
  friendly: ['How are you holding up?', 'Nice work today.', 'Good to see you.', 'Need a hand with anything?', 'Weather could be worse, right?'],
  joke: ['At least the raiders knock first. Sometimes.', 'I named the muffalo after you. It has your smile.', 'Five-star crash landing, would crash again.', 'Our cook says the stew is "rustic".'],
  deep: ['Do you ever think about home?', 'I wonder what the stars look like from the ship.', 'We might actually make it, you know.', 'Sometimes I dream about the crash.'],
  comfort: ['Hey. It will get better. I promise.', 'You are not alone out here.', 'Take a breath. I have got your back.'],
  praise: ['You are the reason we are still alive.', 'That was brilliant work.', 'Honestly, you are the best of us.'],
  flirt: ['Want to watch the stars with me later?', 'You look good in the firelight.', 'I saved you the last berries.'],
  apologize: ['About earlier... I am sorry.', 'I was out of line. Forgive me?'],
  argue: ['That is not how we do things here.', 'You never listen, do you?', 'Stop leaving your junk everywhere.'],
  insult: ['You are useless, you know that?', 'Did the crash scramble your brain?', 'Go bother someone else.'],
};
const THOUGHTS: Record<string, string[]> = {
  work: ['Better get this done before dark.', 'Work keeps my mind off things.', 'Someone has to do it.'],
  eat: ['My stomach is growling.', 'Food first, then everything else.'],
  sleep: ['I can barely keep my eyes open.', 'Bed. Now.'],
  relax: ['I need a break or I will snap.', 'A little fun never killed anyone.'],
  flee: ['Not today. Not like this.', 'Run first, be brave later.'],
  fight: ['They picked the wrong colony.', 'Nobody hurts my people.'],
  talk: ['I should check on them.', 'Could use some company.'],
};

export function mockDecide(pc: Perception): any {
  const n = pc.needs;
  const t = new Set(pc.traits);
  const lazy = t.has('lazy') || t.has('slothful');
  const heardFrom = pc.heard.map(h => /^(\S+) came up to you \((\w+)\)/.exec(h)).find(Boolean);
  if (pc.threat) {
    const brave = pc.armed && !t.has('wimp') && Math.random() < 0.7;
    return { thought: pick(THOUGHTS[brave ? 'fight' : 'flee']), action: brave ? 'fight' : 'flee', hours: 0.4, say: brave ? pick(['For the colony!', 'Get behind me!']) : '' };
  }
  if (heardFrom && !pc.heard.some(h => /run its course/.test(h)) && Math.random() < 0.6) {
    const who = heardFrom[1], p = pc.people.find(x => x.name === who);
    const hostile = (p?.op ?? 0) < -15 || heardFrom[2] === 'insult';
    const tone = hostile ? (t.has('kind') ? 'apologize' : 'argue') : p?.kind === 'lover' ? 'flirt' : pick(['friendly', 'joke', 'deep']);
    return { thought: hostile ? 'Who do they think they are?' : 'That was nice of them.', action: 'talk', target: who, tone, say: pick(LINES[tone]), hours: 0.2 };
  }
  if (n.food < 0.3) return { thought: pick(THOUGHTS.eat), action: 'eat', hours: 0.5 };
  if (n.rest < 0.25) return { thought: pick(THOUGHTS.sleep), action: 'sleep', hours: 6 };
  if (n.joy < 0.3 || (lazy && Math.random() < 0.25)) return { thought: pick(THOUGHTS.relax), action: 'relax', hours: 1 };
  const near = pc.people.filter(p => p.near && p.awake);
  if (near.length && Math.random() < 0.28) {
    const o = pick(near);
    let tone = 'friendly';
    if (o.kind === 'lover') tone = 'flirt';
    else if (o.op < -20 || (t.has('abrasive') && Math.random() < 0.4)) tone = Math.random() < 0.5 ? 'insult' : 'argue';
    else if (o.mood < 0.4 && !t.has('abrasive')) tone = 'comfort';
    else tone = pick(['friendly', 'joke', 'deep', 'praise']);
    return { thought: pick(THOUGHTS.talk), action: 'talk', target: o.name, tone, say: pick(LINES[tone]), hours: 0.25 };
  }
  const open = pc.work.filter(w => w.open);
  if (!open.length) return { thought: 'Nothing to do. Nice.', action: 'relax', hours: 0.5 };
  const score = (w: Perception['work'][number]) => (w.prio ? 5 - w.prio : 0) * 2 + Math.max(0, w.skill) * 0.5 + Math.random() * 3 + (w.id === 'firefight' || w.id === 'doctor' ? 6 : 0);
  const best = open.reduce((a, b) => (score(a) >= score(b) ? a : b));
  return { thought: pick(THOUGHTS.work), action: 'work', work: best.id, hours: lazy ? 1 : 2 + Math.random() * 2, say: '' };
}
