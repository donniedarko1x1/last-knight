export const BROKEN_SAINT_INTRO=Object.freeze([
 'Ты не должен был вернуться.',
 'Откуда ты меня знаешь?',
 'Я знал тебя до того, как ты научился отводить взгляд.',
 'Я ничего не помню.',
 'Тебе повезло....',
 'Тогда скажи, что случилось.',
 'Ты выбрал себя. А цену за этот выбор заплатили мы.',
 'Я не понимаю, что все это значит? Я должен все исправить!',
 'Может быть. Но прежде тебе придётся вспомнить, сколько крови стоил твой выбор.'
]);
// The amnesiac hero answers every second line; Broken Saint carries the
// memory, accusation, and unresolved grief of their shared past.
export const BROKEN_SAINT_INTRO_DIALOGUE=Object.freeze(
 BROKEN_SAINT_INTRO.map((text,index)=>Object.freeze({speaker:index%2===1?'hero':'npc',text}))
);

// The post-battle scene uses the opening cinematic's shared frame. Each image
// moves only inside its upper panel while the hero's thought stays below.
export const BROKEN_SAINT_AFTERMATH_PAGES=Object.freeze([
 Object.freeze({
  image:'broken_saint_aftermath_01',
  pan:'left',
  text:'Он смотрел на меня как на предателя. И я не мог доказать, что не был им.'
 }),
 Object.freeze({
  image:'broken_saint_aftermath_02',
  pan:'left',
  text:'Его меч оставил мне только один выбор: защищаться. Или снова стать тем, кем он меня считал.'
 }),
 Object.freeze({
  image:'broken_saint_aftermath_03',
  pan:'left',
  text:'Я выжил. Он — нет. И это почему-то не похоже на победу.'
 })
]);

export const BROKEN_SAINT_MEMORY=Object.freeze([
 'Ты уверен?',
 'Да.',
 'Если ты забудешь...',
 '...ты снова станешь им.'
]);

export const BROKEN_SAINT_SWORD_PAGES=Object.freeze([
 Object.freeze({image:'broken_saint_sword_01',pan:'left',text:'Я победил того, кто называл меня предателем.'}),
 Object.freeze({image:'broken_saint_sword_02',pan:'left',text:'Что здесь, чёрт возьми, происходит?'}),
 Object.freeze({image:'broken_saint_sword_03',pan:'left',text:'Чёрные знамёна. Надо двигаться.'})
]);
