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
  text:'Ему дали чужой меч.\nСказали только одно: если хочешь жить — сражайся.'
 }),
 Object.freeze({
  image:'prologue_scene_03',
  text:'Ему указали дорогу в Пепельные поля,\nоткуда снова поднимались мёртвые.'
 })
]);

const STORY_ANOMALY_DEFINITIONS=Object.freeze([
 Object.freeze({
  id:'ash_wave2_master_question',
  regionIndex:0,
  wave:2,
  triggerFraction:0.52,
  actor:'enemy',
  speakerName:'Скелет',
  dialogue:Object.freeze([
   Object.freeze({speaker:'npc',text:'Это он?..'}),
   Object.freeze({speaker:'hero',text:'Ты меня знаешь?'})
  ]),
  focusPreset:'soft',
  behaviorAfter:'flee',
  once:true,
  storyState:'act1_false_identity'
 }),
 Object.freeze({
  id:'ash_wave3_he_returned',
  regionIndex:0,
  wave:3,
  triggerFraction:0.30,
  actor:'enemy',
  speakerName:'Скелет',
  dialogue:Object.freeze([
   Object.freeze({speaker:'npc',text:'Он здесь, надо срочно сообщить командиру.'})
  ]),
  focusPreset:'soft',
  behaviorAfter:'flee',
  once:true,
  storyState:'act1_false_identity'
 }),
 Object.freeze({
  id:'ash_wave3_why_is_he_killing_us',
  regionIndex:0,
  wave:3,
  triggerFraction:0.72,
  actor:'enemy',
  speakerName:'Скелет',
  dialogue:Object.freeze([
   Object.freeze({speaker:'npc',text:'Почему он убивает нас?'}),
   Object.freeze({speaker:'hero',text:'Да кто вы, чёрт возьми, такие?'})
  ]),
  focusPreset:'soft',
  behaviorAfter:'flee',
  once:true,
  storyState:'act1_false_identity'
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
 label:'Поговорить с раненым рыцарем',
 // Logical world anchor owned by story data, not by the streamed/rendered NPC.
 // The marker must exist even while the knight sprite is culled or not created.
 markerPoint:Object.freeze({x:2700,y:800})
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
 approachRadius:285,
 // Same rule as story NPCs: objective navigation owns a permanent world point.
 markerPoint:Object.freeze({x:3030,y:470})
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
    label:ASH_WOUNDED_KNIGHT_STORY.label,
    markerPoint:ASH_WOUNDED_KNIGHT_STORY.markerPoint
   })
  })
 })
]);

export {PROLOGUE_STORY_PAGES,STORY_ANOMALY_DEFINITIONS,STORY_EVENTS,ASH_WOUNDED_KNIGHT_STORY,ASH_ALTAR_CHAMPION_STORY};
