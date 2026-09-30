// Stand-in for api.deepseek.com for end-to-end tests: answers /chat/completions with plausible
// decisions built from the prompt (talks to people it sees, otherwise works), and logs requests.
import http from 'node:http';
const PORT = +(process.env.PORT || 9911);
let n = 0;
http.createServer((req, res) => {
  let raw = ''; req.on('data', c => (raw += c)); req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    const last = body.messages?.[body.messages.length - 1]?.content || '';
    const people = [...last.matchAll(/^- ([^:(]+?)(?: \(prisoner\))?: /gm)].map(m => m[1].trim());
    const work = (/Work waiting that you can do: ([^\n.]+)/.exec(last)?.[1] || '').split(', ').map(s => s.split(' ')[0]).filter(w => w && w !== 'none');
    n++;
    let d;
    if (people.length && n % 3 === 0) d = { thought: 'I should see how they are doing.', action: 'talk', target: people[n % people.length], tone: ['friendly', 'joke', 'deep'][n % 3], say: ['Long day, huh?', 'Did you hear the muffalo snore?', 'Do you miss the stars?'][n % 3], hours: 0.3, remember: '' };
    else if (work.length) d = { thought: 'Back to it.', action: 'work', work: work[n % work.length], hours: 2, say: '', remember: n % 5 === 0 ? 'I like this place more than I expected.' : '' };
    else d = { thought: 'Nothing pressing. A walk, then.', action: 'relax', hours: 1, say: '' };
    const content = n % 7 === 0 ? 'Here you go:\n```json\n' + JSON.stringify(d) + '\n```' : JSON.stringify(d);
    console.log(`#${n} model=${body.model} thinking=${body.thinking?.type} fmt=${body.response_format?.type} max=${body.max_tokens} msgs=${body.messages?.length} -> ${d.action}${d.target ? ' ' + d.target : ''}${d.work ? ' ' + d.work : ''}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ model: body.model, choices: [{ message: { role: 'assistant', content } }], usage: { prompt_tokens: 1300, completion_tokens: 60, prompt_cache_hit_tokens: 1000, prompt_cache_miss_tokens: 300 } }));
  });
}).listen(PORT, () => console.log('fake deepseek on', PORT));
