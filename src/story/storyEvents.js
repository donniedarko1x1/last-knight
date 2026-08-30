// LAST KNIGHT story data lives outside MainScene.
// StoryDirector consumes STORY_EVENTS at runtime; the prologue uses the same
// page schema as every future cinematic event.

const PROLOGUE_STORY_PAGES=Object.freeze([
 Object.freeze({
  image:'prologue_scene_01',
  text:'Его нашли за северной стеной.\nБез имени. Без памяти. Едва живого.'
 }),
 Object.freeze({
  image:'prologue_scene_02',
  text:'Ему дали меч.\nИ причину им воспользоваться.'
 }),
 Object.freeze({
  image:'prologue_scene_03',
  text:'Королевство умирало.\nОн верил, что его долг — спасти его.'
 }),
 Object.freeze({
  image:'prologue_scene_04',
  text:'Последний рыцарь: "Они за это ответят."'
 })
]);

// Intentionally empty in StoryDirector v1: introducing the director must not
// silently add new story beats to the current playable build. Future Ash Fields
// events are added here as declarative objects instead of MainScene.update() ifs.
//
// Example schema:
// {
//  id:'ash_first_recognition',
//  once:true,
//  trigger:{region:'ASH FIELDS',kills:8},
//  action:{
//   type:'cinematic',
//   pages:[{image:'ash_story_01',text:'...Ты?'}]
//  }
// }
const STORY_EVENTS=Object.freeze([]);

export {PROLOGUE_STORY_PAGES,STORY_EVENTS};
