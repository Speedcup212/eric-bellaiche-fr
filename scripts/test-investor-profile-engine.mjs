import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const temp = await mkdtemp(join(tmpdir(), 'investor-profile-engine-'));
const tsc = join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc');
const compile = spawnSync(process.execPath, [tsc, 'src/portal/investorProfileEngine.ts', '--target', 'ES2020', '--module', 'commonjs', '--moduleResolution', 'node', '--skipLibCheck', '--outDir', temp], { cwd: process.cwd(), stdio: 'inherit' });
if (compile.status !== 0) process.exit(compile.status ?? 1);
const loaded = await import(pathToFileURL(join(temp, 'investorProfileEngine.js')).href);
const api = loaded.default ?? loaded;
const { computeInvestorProfile, profileRankFromScore, capacityRankFromAnswers, lossPctFromQ10, knowledgeLevel, commonOperationProfile } = api;

for (const [score, rank] of [[5,1],[7,1],[8,2],[10,2],[11,3],[13,3],[14,4],[16,4],[17,5],[19,5],[20,6],[22,6],[23,7],[25,7]]) assert.equal(profileRankFromScore(score), rank);
assert.equal(profileRankFromScore(4), null);
assert.equal(profileRankFromScore(26), null);
assert.equal(profileRankFromScore(10.5), null);

assert.equal(capacityRankFromAnswers({ Q3:'D', Q4:'A', Q9:'D', Q10:'F' }), 6);
assert.equal(capacityRankFromAnswers({ Q3:'A', Q4:'A', Q9:'D', Q10:'F' }), 1);
assert.equal(capacityRankFromAnswers({ Q3:'D', Q4:'B', Q9:'D', Q10:'F' }), 2);
assert.equal(capacityRankFromAnswers({ Q3:'D', Q4:'A', Q9:'B', Q10:'F' }), 2);
assert.equal(capacityRankFromAnswers({ Q3:'D', Q4:'A', Q9:'D', Q10:'C' }), 3);
assert.equal(capacityRankFromAnswers({ Q3:'D', Q4:'A', Q9:'D' }), null);
assert.equal(capacityRankFromAnswers({ Q3:'Z', Q4:'A', Q9:'D', Q10:'F' }), null);

assert.equal(lossPctFromQ10('A'), 0);
assert.equal(lossPctFromQ10('B'), 5);
assert.equal(lossPctFromQ10('C'), 10);
assert.equal(lossPctFromQ10('D'), 20);
assert.equal(lossPctFromQ10('E'), 30);
assert.equal(lossPctFromQ10('F'), 30);
assert.equal(lossPctFromQ10(''), null);

assert.equal(knowledgeLevel(4,4), 'À compléter');
assert.equal(knowledgeLevel(5,5), 'Suffisant');
assert.equal(knowledgeLevel(5,4), 'Suffisant');
assert.equal(knowledgeLevel(5,3), 'Intermédiaire');
assert.equal(knowledgeLevel(5,2), 'Insuffisant');

const aggressiveButFragile = computeInvestorProfile({
  toleranceScores:[5,5,5,5,5],
  capacity:{ Q3:'A', Q4:'A', Q9:'D', Q10:'F' },
  knowledgeAnswered:5,
  knowledgeCorrect:5,
  practicedProductFamilies:5,
});
assert.equal(aggressiveButFragile.toleranceRank, 7);
assert.equal(aggressiveButFragile.capacityRank, 1);
assert.equal(aggressiveButFragile.operationalRank, 1);
assert.equal(aggressiveButFragile.operationalProfile, 'Très prudent');
assert.equal(aggressiveButFragile.gap, true);
assert.equal(aggressiveButFragile.complete, true);

const balanced = computeInvestorProfile({
  toleranceScores:[4,4,3,3,3],
  capacity:{ Q3:'D', Q4:'A', Q9:'D', Q10:'F' },
  knowledgeAnswered:5,
  knowledgeCorrect:4,
  practicedProductFamilies:3,
});
assert.equal(balanced.toleranceScore, 17);
assert.equal(balanced.toleranceRank, 5);
assert.equal(balanced.capacityRank, 6);
assert.equal(balanced.operationalRank, 5);
assert.equal(balanced.gap, false);
assert.equal(balanced.knowledgeLevel, 'Suffisant');
assert.equal(balanced.controls.knowledgeOrExperienceReview, true);

const incomplete = computeInvestorProfile({ toleranceScores:[5,5,5,5,5], capacity:{ Q3:'D', Q4:'A', Q9:'D' } });
assert.equal(incomplete.complete, false);
assert.equal(incomplete.operationalRank, null);
assert.equal(incomplete.operationalProfile, null);
assert.ok(incomplete.missing.includes('Q10'));

const invalidScore = computeInvestorProfile({ toleranceScores:[5,5,5,5,6], capacity:{ Q3:'D', Q4:'A', Q9:'D', Q10:'F' } });
assert.equal(invalidScore.complete, false);
assert.equal(invalidScore.toleranceRank, null);
assert.equal(invalidScore.operationalRank, null);

assert.deepEqual(commonOperationProfile([6,4]), { rank:4, profile:'Équilibré prudent' });
assert.deepEqual(commonOperationProfile([null,5]), { rank:5, profile:'Équilibré dynamique' });
assert.deepEqual(commonOperationProfile([]), { rank:null, profile:null });

console.log('Investor profile engine: 48 contrôles validés.');
await rm(temp, { recursive:true, force:true });
