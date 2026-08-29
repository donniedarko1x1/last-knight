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
  }

  update(time, enemies){
    if(time < (this.scene.skillLockUntil || 0)) return;
    if(time - this.lastAttack < this.cooldown) return;

    this.lastAttack = time;
    this.attackCounter++;

    if(this.scene.onSwordAttack){
      this.scene.onSwordAttack(this.attackCounter);
    }

    // The sword is baked into the hero attack frames; this controller owns gameplay only.
    this.scene.playerAttackDir = this.scene.playerDir || 'down';
    this.scene.playerAttackUntil = time + 500;

    const attackKey = `player_${this.scene.playerAttackDir}_attack`;

    if(this.scene.playerVisual && this.scene.playerVisual.active){
      this.scene.playerVisualState = attackKey;
      this.scene.playerVisual.play(attackKey, true);
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

    for(const enemy of enemies){
      if(!enemy.active || enemy.hp<=0) continue;

      const d = Phaser.Math.Distance.Between(
        this.owner.x,
        this.owner.y,
        enemy.x,
        enemy.y
      );

      if(d <= this.radius){
        if(this.scene.consumeShieldBlock && this.scene.consumeShieldBlock(enemy)){
          this.createHitBurst(enemy.x, enemy.y - 16, 0xffffff);
        } else {
          const resolvedDamage=this.scene.getSwordDamageAgainst
            ? this.scene.getSwordDamageAgainst(enemy,this.damage)
            : this.damage;

          enemy.hp -= resolvedDamage;
          const defeated=enemy.hp<=0;
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
            this.scene.applyEnemyHitReaction(enemy,angle,120);
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
  }
}