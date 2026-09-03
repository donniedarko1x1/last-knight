export default class HeroMelee {
  createHitBurst(x, y, tint = null){
    const fx = this.scene.add.sprite(x, y, 'hit_burst_00')
      .setDepth(22)
      .setScale(0.68)
      .setRotation(Phaser.Math.FloatBetween(-0.35, 0.35));

    if(tint !== null){
      fx.setTint(tint);
    }

    fx.play('hit_burst');
    fx.on('animationcomplete', ()=>{
      if(fx && fx.active) fx.destroy();
    });

    return fx;
  }

  getRingScales(){
    const ratio = this.radius / 90;
    return {
      start: 0.34 * ratio,
      peak: 0.40 * ratio
    };
  }

  constructor(scene, owner){
    this.level = 1;
    this.scene = scene;
    this.owner = owner;
    this.cooldown = 1000;
    this.damage = 15;
    this.radius = 99;
    this.lastAttack = 0;
    this.attackCounter = 0;
    this.combatActive = false;
    this.attackTargetCount = 0;
    this.nearbyTargetCount = 0;
    this.nearestTargetDistance = null;
    this.disengagePadding = 26;
  }

  updateTargetState(enemies){
    const owner=this.owner;
    const attackRadius=this.radius;
    const nearbyRadius=attackRadius+this.disengagePadding;
    const attackRadiusSq=attackRadius*attackRadius;
    const nearbyRadiusSq=nearbyRadius*nearbyRadius;
    let attackTargets=0;
    let nearbyTargets=0;
    let nearestSq=Infinity;
    const candidates=[];

    // Broad phase: squared-distance filtering avoids sqrt work for every enemy,
    // and the exact same candidate list is reused by the damage pass below.
    for(const enemy of enemies||[]){
      if(!enemy?.active || enemy.hp<=0) continue;
      const dx=enemy.x-owner.x;
      const dy=enemy.y-owner.y;
      const d2=dx*dx+dy*dy;
      if(d2<nearestSq) nearestSq=d2;
      if(d2<=nearbyRadiusSq) nearbyTargets++;
      if(d2<=attackRadiusSq){
        attackTargets++;
        candidates.push(enemy);
      }
    }

    this.attackCandidates=candidates;
    this.attackTargetCount=attackTargets;
    this.nearbyTargetCount=nearbyTargets;
    this.nearestTargetDistance=Number.isFinite(nearestSq)?Math.round(Math.sqrt(nearestSq)*10)/10:null;
    this.combatActive=nearbyTargets>0;
    return attackTargets>0;
  }

  update(time, enemies){
    // Story anomaly focus deliberately disarms the hero so the anomalous
    // skeleton cannot be accidentally auto-killed during its five-second beat.
    if(this.scene.isStoryAnomalyMomentActive?.(time)){
      this.combatActive=false;
      this.attackTargetCount=0;
      this.nearbyTargetCount=0;
      this.nearestTargetDistance=null;
      return;
    }

    // Exploration is now genuinely quiet: do not start the spin animation,
    // ring FX or sword SFX unless at least one living enemy is inside the real
    // melee radius. A slightly wider nearby radius is kept only as hysteresis
    // for the combat-state diagnostic, not as permission to swing into empty air.
    const hasAttackTarget=this.updateTargetState(enemies);
    if(!hasAttackTarget) return;
    if(time < (this.scene.skillLockUntil || 0)) return;
    if(time - this.lastAttack < this.cooldown) return;

    this.lastAttack = time;
    this.attackCounter++;

    if(this.scene.onSwordAttack){
      this.scene.onSwordAttack(this.attackCounter);
    }
    if(this.scene.playHeroSwordAttackSfx){
      this.scene.playHeroSwordAttackSfx();
    }

    // Runtime weapon-socket build: the sword is a separate sprite and follows
    // the exact current hero animation frame through the exported socket JSON.
    this.scene.playerAttackDir = this.scene.playerDir || 'down';
    if(this.scene.startHeroSpinAttack){
      this.scene.startHeroSpinAttack();
    } else {
      this.scene.playerAttackUntil = time + 750;
    }

    if(this.scene.activeAttackFx && this.scene.activeAttackFx.active){
      this.scene.activeAttackFx.destroy();
      this.scene.activeAttackFx = null;
    }

    const ringScales = this.getRingScales();

    const ring = this.scene.add.sprite(
      this.owner.x,
      this.owner.y,
      'ring_sweep_00'
    ).setDepth(14).setScale(ringScales.start).setAlpha(0.70);

    this.scene.activeAttackFx = ring;

    // Scale the visible ring proportionally to the real damage radius.
    this.scene.tweens.add({
      targets: ring,
      scale: ringScales.peak,
      duration: 90,
      ease: 'Sine.easeOut',
      yoyo: true
    });

    ring.play('ring_sweep');
    ring.on('animationcomplete', ()=>{
      if(this.scene.activeAttackFx === ring){
        this.scene.activeAttackFx = null;
      }
      if(ring && ring.active) ring.destroy();
    });

    let swordImpactSfxNeeded=false;
    // Resolve a path modifier once per real sword swing. Echo is therefore
    // consumed only by a swing that has a living enemy in range.
    const combatStyleEffect=this.scene.getCombatStyleMeleeEffect
      ? this.scene.getCombatStyleMeleeEffect(this.attackTargetCount)
      : {multiplier:this.scene.consumeCombatStyleMeleeMultiplier
        ? this.scene.consumeCombatStyleMeleeMultiplier(this.attackTargetCount)
        : 1,id:null};
    const combatStyleDamageMultiplier=combatStyleEffect.multiplier||1;
    let combatStyleProcShown=false;

    for(const enemy of this.attackCandidates||[]){
      if(!enemy?.active || enemy.hp<=0) continue;
      // Candidate membership was computed at the start of this same update;
      // re-check with squared distance only in case another hit moved the target.
      const dx=enemy.x-this.owner.x;
      const dy=enemy.y-this.owner.y;
      if(dx*dx+dy*dy <= this.radius*this.radius){
        swordImpactSfxNeeded=true;
        if(this.scene.consumeShieldBlock && this.scene.consumeShieldBlock(enemy)){
          this.createHitBurst(enemy.x, enemy.y - 16, 0xffffff);
        } else {
          const effectiveDamage=(this.scene.getEffectiveMeleeDamage
            ? this.scene.getEffectiveMeleeDamage(this.damage)
            : this.damage)*combatStyleDamageMultiplier;
          const resolvedDamage=this.scene.getSwordDamageAgainst
            ? this.scene.getSwordDamageAgainst(enemy,effectiveDamage)
            : effectiveDamage;

          enemy.hp -= resolvedDamage;
          const defeated=enemy.hp<=0;
          if(combatStyleEffect.id && !combatStyleProcShown){
            this.scene.notifyCombatStyleProc?.(combatStyleEffect.id,enemy);
            combatStyleProcShown=true;
          }
          if(defeated && this.scene.markEnemyDefeated){
            this.scene.markEnemyDefeated(enemy);
          }

          if(this.scene.onSwordHit){
            this.scene.onSwordHit(enemy,resolvedDamage);
          }

          // The scene owns stagger/knockback so AI cannot overwrite it.
          if(!defeated && enemy.body){
            const angle = Phaser.Math.Angle.Between(
              this.owner.x,
              this.owner.y,
              enemy.x,
              enemy.y
            );
            const knockbackMultiplier=this.scene.getCombatStyleKnockbackMultiplier
              ? this.scene.getCombatStyleKnockbackMultiplier(enemy)
              : 1;
            this.scene.applyEnemyHitReaction(enemy,angle,120*knockbackMultiplier);
            if(knockbackMultiplier>1 && !combatStyleProcShown){
              this.scene.notifyCombatStyleProc?.('crowdbreak',enemy);
              combatStyleProcShown=true;
            }
          }

          // Heavy impact feedback only for elite targets.
          // Normal enemies keep the combat readable.
          if(
            !defeated && (
              enemy.type === 'champion' ||
              enemy.type === 'elite' ||
              enemy.type === 'boss'
            )
          ){
            this.scene.cameras.main.shake(35, 0.003);

            if(enemy.body){
              enemy.knockbackVX=(enemy.knockbackVX||enemy.body.velocity.x)*1.8;
              enemy.knockbackVY=(enemy.knockbackVY||enemy.body.velocity.y)*1.8;
              enemy.body.setVelocity(enemy.knockbackVX,enemy.knockbackVY);
            }
          }

          if(enemy.visual && enemy.visual.active){
            enemy.visual.setTint(0xfff2a8);
            this.scene.time.delayedCall(90, ()=>{
              if(enemy.visual && enemy.visual.active) enemy.visual.clearTint();
            });
          }

          this.createHitBurst(enemy.x, enemy.y - 12, 0xffe28a);

        }
      }
    }

    if(swordImpactSfxNeeded && this.scene.playHeroSwordImpactSfx){
      this.scene.playHeroSwordImpactSfx();
    }
  }
}
