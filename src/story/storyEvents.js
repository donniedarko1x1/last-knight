// LAST KNIGHT story data lives outside MainScene.
// StoryDirector consumes STORY_EVENTS at runtime; the prologue uses the same
// page schema as every future cinematic event.

const PROLOGUE_STORY_PAGES=Object.freeze([
 Object.freeze({
  image:'prologue_scene_01',
  text:'За северной стеной нашли едва живого человека.\nОн не помнил ни своего имени, ни того, как оказался там.'
 }),
 Object.freeze({
  image:'prologue_scene_02',
  text:'Ему дали меч и сказали, против кого сражаться.'
 }),
 Object.freeze({
  image:'prologue_scene_03',
  text:'Королевство гибло.\nИ он поверил, что должен его спасти.'
 }),
 Object.freeze({
  image:'prologue_scene_04',
  text:'Его ярость рвалась наружу...'
 })
]);

// First reusable in-world objective. The target exists physically from the
// start, but it is NOT interactable until StoryDirector activates this objective.
// Wave 3 must be completely cleared first. Only then does the objective/marker
// unlock, and wave 4 remains gated until this dialogue is fully completed.
const ASH_WOUNDED_KNIGHT_STORY=Object.freeze({
 characterId:'ash:wounded_knight:3',
 objectiveId:'ash_find_wounded_knight',
 objectiveEventId:'ash_unlock_wounded_knight_objective',
 dialogueEventId:'ash_story_wounded_knight',
 metFlag:'ash_story_wounded_knight_met',
 waveClearedFlag:'ash_story_wave_3_cleared',
 label:'Поговорить с раненым рыцарем'
});



// After wave 4, combat pauses and the player is led to the Ash Fields altar.
// The first champion materializes only when the player reaches the landmark;
// its combat phase (music + ordinary wave pressure) begins after the reveal beat.
const ASH_ALTAR_CHAMPION_STORY=Object.freeze({
 landmarkKey:'ash_landmark_altar',
 targetId:'ash_landmark_altar',
 objectiveId:'ash_reach_landmark_altar',
 waveClearedFlag:'ash_story_wave_4_cleared',
 encounterStartedFlag:'ash_story_first_champion_reveal_started',
 fightStartedFlag:'ash_story_first_champion_fight_started',
 championKind:'brokenSaint',
 label:'Добраться до алтаря',
 approachRadius:285
});

const STORY_EVENTS=Object.freeze([
 Object.freeze({
  id:ASH_WOUNDED_KNIGHT_STORY.objectiveEventId,
  once:true,
  trigger:Object.freeze({
   regionIndex:0,
   waveExact:3,
   flag:ASH_WOUNDED_KNIGHT_STORY.waveClearedFlag,
   notFlag:ASH_WOUNDED_KNIGHT_STORY.metFlag
  }),
  action:Object.freeze({
   type:'objective',
   objective:Object.freeze({
    id:ASH_WOUNDED_KNIGHT_STORY.objectiveId,
    kind:'talk',
    targetId:ASH_WOUNDED_KNIGHT_STORY.characterId,
    label:ASH_WOUNDED_KNIGHT_STORY.label
   })
  })
 })
]);

export {PROLOGUE_STORY_PAGES,STORY_EVENTS,ASH_WOUNDED_KNIGHT_STORY,ASH_ALTAR_CHAMPION_STORY};
