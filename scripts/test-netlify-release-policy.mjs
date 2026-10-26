import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allowNetlifyBuild } from './netlify-build-policy.mjs';

const sha='1234567890abcdef1234567890abcdef12345678';
const marker='chore(deploy): verified '+sha+' [netlify-verified]';
const bot={author:'github-actions[bot]',
  email:'41898282+github-actions[bot]@users.noreply.github.com'};
const good={context:'production',message:marker,...bot};
const cases=[
  ['CI-verified production release',good,true],
  ['regular production push',{...good,message:'fix: correct missing PDF field'},false],
  ['release-like commit from human',{...good,author:'developer'},false],
  ['release-like commit from wrong email',{...good,email:'untrusted@example.test'},false],
  ['unverified marker in longer message',{...good,message:marker+'\\nextra'},false],
  ['invalid verified SHA',{...good,message:'chore(deploy): verified short [netlify-verified]'},false],
  ['case-variant marker',{...good,message:marker.replace('[netlify-verified]','[Netlify-verified]')},false],
  ['missing Git identity',{...good,author:'',email:''},false],
  ['deploy preview',{...good,context:'deploy-preview',message:'draft'},true],
  ['branch deploy',{...good,context:'branch-deploy',message:'draft'},true],
];
for(const [label,args,want] of cases){
 assert.equal(allowNetlifyBuild(args),want,label);
}
const config=readFileSync('netlify.toml','utf8');
assert.match(config,/ignore\s*=\s*"node \.\/scripts\/netlify-build-policy\.mjs"/);
const verified=readFileSync('.github/workflows/verified-netlify-deploy.yml','utf8');
assert.match(verified,/npm run test:release-gate/);
assert.match(verified,/git rev-parse HEAD/);
assert.match(verified,/\[netlify-verified\]/);
console.log('Netlify production release policy:',cases.length,'scenarios passed.');
