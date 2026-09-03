import fs from 'node:fs';
import assert from 'node:assert/strict';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const melee=fs.readFileSync(new URL('../src/combat/HeroMelee.js',import.meta.url),'utf8');
const restart=fs.readFileSync(new URL('../src/world/ZoneRestartState.mjs',import.meta.url),'utf8');

for(const token of [
 'openCombatStyleChoice()',
 "title:'ПАМЯТЬ КЛИНКА'",
 "this.pendingCombatStyleWave=3;",
 "this.openCombatStyleChoice();",
 "this.startWave(3);",
 'getCombatStyleKnockbackMultiplier(enemy)',
 "enemy?.type==='skeleton' ? 1.5 : 1",
 'consumeCombatStyleMeleeMultiplier(targetCount)',
 "return {multiplier:1.45,id:'duelist'",
 "return {multiplier:1.70,id:'echo'",
 'armCombatStyleCharge()',
  "this.armCombatStyleCharge();",
 'showCombatNotification(text,',
 "'РАЗЛОМ'",
 "'ПОДЪЁМ'",
 "'ВИХРЬ'",
 "'Последний приговор'",
 "'Расколотый строй'",
 "'Отголосок клинка'",
 'combatStyleChargeReady:Boolean(this.combatStyleChargeReady)'
]) assert.ok(main.includes(token),`missing combat-style contract: ${token}`);

assert.ok(main.indexOf('this.openCombatStyleChoice();') < main.indexOf('}else this.startWave(3);'),
 'sword cinematic must offer a path before Wave 3 starts');
assert.ok(melee.includes('getCombatStyleMeleeEffect(this.attackTargetCount)'),
 'melee must resolve the path only after a living target is found');
assert.ok(melee.includes('120*knockbackMultiplier'),
 'crowd path must affect authored hit reaction knockback');
assert.ok(melee.includes("notifyCombatStyleProc?.('crowdbreak',enemy)"),
 'crowd path must provide a visible combat notification');
assert.ok(restart.includes("'combatStyle','combatStyleChargeReady'"),
 'zone restart must preserve the chosen path and Echo charge');

console.log('v23 PASSED: Memory of the Blade selection, all three path effects, and restart/checkpoint persistence contracts are present.');
