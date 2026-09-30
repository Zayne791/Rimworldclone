// Stand-in for api.deepseek.com for end-to-end tests: answers /chat/completions with plausible
// decisions built from the prompt (talks to people it sees, otherwise works), and logs requests.
import http from 'node:http';
const PORT = +(process.env.PORT || 9911);
let n = 0;
http.createServer((req, res) => {
  let raw = ''; req.on('data', c => (raw += c)); req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    const last = body.messages?.[body.messages.length - 1]?.content || '';
    const sys = body.messages?.[0]?.content || '';
    if (/face-to-face conversation with the colony's leader/.test(sys)) {
      // conversation: agree to whatever work the leader named, with a haggle now and then
      n++;
      const said = [...last.matchAll(/Leader(?: \([^)]*\))?: "([^"]*)"/g)].map(m => m[1]).pop() || '';
      const ids = ['cook', 'grow', 'construct', 'haul', 'clean', 'research', 'mine', 'hunt', 'doctor', 'plantcut', 'handle', 'craft'];
      const work = ids.find(id => said.toLowerCase().includes(id === 'construct' ? 'build' : id === 'plantcut' ? 'tree' : id));
      const o = !said ? { say: 'Oh! Hey, boss. What do you need?', emotion: 'surprised' }
        : work ? { say: `Fine, I will handle the ${work}. You owe me a hot meal.`, emotion: 'happy', agree: [{ work, regular: /every|daily|regular|from now on/i.test(said), when: 'any', note: 'as asked' }], trust: 2, felt: 'none', promise: '' }
        : /thank|great|good job/i.test(said) ? { say: 'Aw, thanks. That means a lot out here.', emotion: 'happy', trust: 3, felt: 'thanked' }
        : { say: 'Hmm. What exactly do you want from me?', emotion: 'thinking', trust: 0 };
      const content = JSON.stringify({ agree: [], drop: [], felt: 'none', promise: '', opinion: {}, remember: '', end: false, ...o });
      console.log(`#${n} TALK model=${body.model} max=${body.max_tokens} msgs=${body.messages?.length} said="${said.slice(0, 40)}" -> ${o.say}`);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ model: body.model, choices: [{ message: { role: 'assistant', content } }], usage: { prompt_tokens: 2400, completion_tokens: 90, prompt_cache_hit_tokens: 2000, prompt_cache_miss_tokens: 400 } }));
      return;
    }
    const people = [...last.matchAll(/^- ([^:(]+?)(?: \(prisoner\))?: /gm)].map(m => m[1].trim());
    const work = (/Work waiting that you can do: ([^\n.]+)/.exec(last)?.[1] || '').split(', ').map(s => s.split(' ')[0]).filter(w => w && w !== 'none');
    // leader mode: work only on duties that are on now, sometimes ask the leader for a word
    const duties = [...(/Your duties: ([^\n]+)/.exec(last)?.[1] || '').matchAll(/(\w+) — [^;]*?, on now(?!, nothing)/g)].map(m => m[1]);
    if (/Your leader is/.test(last)) { work.length = 0; work.push(...duties); }
    n++;
    let d;
    if (/Your leader is/.test(last) && n % 4 === 1 && !/already asked the leader/.test(last)) d = { thought: 'I should talk to the boss.', action: 'leader', topic: 'request', say: 'Boss, could we get a proper bed? The floor is killing my back.', hours: 0.3 };
    else if (people.length && n % 3 === 0) d = { thought: 'I should see how they are doing.', action: 'talk', target: people[n % people.length], tone: ['friendly', 'joke', 'deep'][n % 3], say: ['Long day, huh?', 'Did you hear the muffalo snore?', 'Do you miss the stars?'][n % 3], hours: 0.3, remember: '' };
    else if (work.length) d = { thought: 'Back to it.', action: 'work', work: work[n % work.length], hours: 2, say: '', remember: n % 5 === 0 ? 'I like this place more than I expected.' : '' };
    else d = { thought: 'Nothing pressing. A walk, then.', action: 'relax', hours: 1, say: '' };
    const content = n % 7 === 0 ? 'Here you go:\n```json\n' + JSON.stringify(d) + '\n```' : JSON.stringify(d);
    console.log(`#${n} model=${body.model} thinking=${body.thinking?.type} fmt=${body.response_format?.type} max=${body.max_tokens} msgs=${body.messages?.length} -> ${d.action}${d.target ? ' ' + d.target : ''}${d.work ? ' ' + d.work : ''}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ model: body.model, choices: [{ message: { role: 'assistant', content } }], usage: { prompt_tokens: 1300, completion_tokens: 60, prompt_cache_hit_tokens: 1000, prompt_cache_miss_tokens: 300 } }));
  });
}).listen(PORT, () => console.log('fake deepseek on', PORT));
