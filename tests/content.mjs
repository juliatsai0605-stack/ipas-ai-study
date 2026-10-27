import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const bank=JSON.parse(readFileSync('bank.json','utf8'));
assert.equal(bank.length,700,'all 14 published papers must be available');
assert.equal(new Set(bank.map(x=>x.id)).size,700,'question IDs must remain unique');
const added=bank.filter(x=>x.id.startsWith('L11-115-3-')).sort((a,b)=>a.n-b.n);
assert.equal(added.length,50);
for(const q of added){
 assert.equal(q.o.length,4);assert.ok(q.o.every(x=>x.trim().length>0));
 assert.ok(q.q.length>20&&q.e.length>20);
 assert.match(q.sourceUrl,/ipas\.org\.tw/);assert.ok(q.sourcePage>=1&&q.sourcePage<=15);
 assert.match(q.sec,/^L11\d{3}$/);
}
const study=JSON.parse(readFileSync('study-content.json','utf8'));
const course=JSON.parse(readFileSync('course.json','utf8'));
const sections=course.levels.flatMap(l=>l.subjects.flatMap(s=>s.chapters.flatMap(c=>c.sections)));
assert.equal(sections.length,50);
for(const sec of sections){
 const x=study.lessons[sec.code];assert.ok(x,'missing lesson '+sec.code);
 assert.doesNotMatch(x.dialogue.map(t=>t.text).join(' '),/先停一下|回到本節自我檢查|先抓住哪個重點|想好後/,'old didactic script must not be served');
 assert.ok(x.explain.length>=2&&x.example.length>20&&x.memory.length>5);
 assert.ok(x.sources.length&&x.dialogue.length>=3);
 assert.match(x.audio.file,/^audio\/podcast\/L[12]\d{4}\.mp3$/);
 assert.ok(x.audio.duration>30);
 assert.equal(createHash('sha256').update(readFileSync(x.audio.file)).digest('hex'),x.audio.sha256);
 for(const id of x.practiceIds)assert.ok(bank.some(q=>q.id===id&&q.sec===sec.code),id);
 for(const id of x.sources)assert.ok(study.sources[id],id);
}
assert.ok(!JSON.stringify(study).includes('考過就嘉獎'));
console.log('PASS content: 700 unique questions, 50 text lessons, sources and practice links');
