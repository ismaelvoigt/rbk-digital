const fs = require('node:fs');
const assert = require('node:assert/strict');
const page = fs.readFileSync('src/app/usuarios/novo/page.tsx', 'utf8');
const api = fs.readFileSync('src/app/api/usuarios/route.ts', 'utf8');
const payload = page.match(/body: JSON.stringify\(\{([\s\S]*?)\}\)/)?.[1] || '';
const inserts = [...api.matchAll(/\.from\("farms"\)\s*\.insert\(\{([\s\S]*?)\}\)/g)];
let failures = 0;
function check(name, fn) { try { fn(); console.log('OK:', name); } catch(e) { failures++; console.log('FALHOU:', name, e.message); } }
check('campos visíveis e vinculados', () => {
  for (const field of ['telefone','cidade','estado']) {
    const input = [...page.matchAll(/<input\b[\s\S]*?\/>/g)].map(m=>m[0]).find(s=>s.includes(`id="${field}"`));
    assert.ok(input, field);
    assert.ok(input.includes(`value={${field}}`), field);
    assert.ok(page.includes(`htmlFor="${field}"`), field);
  }
});
check('envio dos três campos', () => { for(const f of ['telefone','cidade','estado']) assert.match(payload, new RegExp(`\\b${f}:`)); });
check('limpeza após sucesso', () => { const reset = page.split('setSucesso(true);')[1] || ''; for(const f of ['Telefone','Cidade','Estado']) assert.ok(reset.includes(`set${f}("");`)); });
check('gravação nos dois fluxos', () => { assert.equal(inserts.length, 2); for(const m of inserts) for(const f of ['telefone','cidade','estado']) assert.match(m[1], new RegExp(`\\b${f}:`)); });
check('retorno superior ao dashboard', () => { const header = page.match(/<header\b[\s\S]*?<\/header>/)?.[0] || ''; assert.ok(header.includes('href="/dashboard"')); assert.ok(header.includes('← Voltar para o dashboard')); });
process.exitCode = failures ? 1 : 0;
