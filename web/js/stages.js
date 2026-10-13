// Challenge mode: 30 mission stages (more will be added in updates).
// area: time of day (AREAS index). time: limit in seconds. goals: all must be met.
// drain: silk/s at the start (+ramp per second). heavy: share of heavy bugs (0-1).
// spawn: spawn interval multiplier (<1 = more bugs). gust: seconds into the stage, 0 = none.
// bonusNeed: meals to fill the bonus gauge (bonus time drops the glowing spool).
//
// Goal types:
//   catch n           eat n bugs
//   kind  k n         eat n bugs of a family (INSECTS[].kind)
//   type  id n        eat n of one species
//   score n           reach a score
//   combo n           reach an n combo
//   treats n          collect n treats in bonus time
//   boss n            eat n boss bugs (needs glowing silk)
//   heavy w n         eat n bugs weighing at least w
//   survive           last until the time runs out
(function (root) {
  'use strict';
  const S = (area, time, goals, o) => Object.assign({ area, time, goals, drain: 0.7, ramp: 0.004, heavy: 0, spawn: 1, gust: 0, wind: false, bonusNeed: 12 }, o || {});
  const g = (type, a, b) => (b === undefined ? { type, n: a } : { type, key: a, n: b });

  const STAGES = [
    // --- morning: learn the basics ---
    S(0, 90,  [g('catch', 5)],                              { drain: 0.5 }),
    S(0, 90,  [g('catch', 8), g('kind', 'butterfly', 2)],   { drain: 0.55 }),
    S(0, 90,  [g('score', 300)],                            { drain: 0.6 }),
    S(0, 90,  [g('combo', 3)],                              { drain: 0.6 }),
    S(0, 90,  [g('kind', 'ladybug', 3), g('catch', 10)],    { drain: 0.65, heavy: 0.1 }),
    // --- daytime: heavier bugs and wind ---
    S(1, 90,  [g('catch', 12)],                             { drain: 0.7, heavy: 0.2, wind: true }),
    S(1, 90,  [g('kind', 'dragonfly', 3)],                  { drain: 0.7, heavy: 0.25 }),
    S(1, 100, [g('treats', 8)],                             { drain: 0.75, heavy: 0.25, bonusNeed: 8 }),
    S(1, 90,  [g('kind', 'cicada', 3), g('score', 800)],    { drain: 0.8, heavy: 0.35, wind: true }),
    S(1, 100, [g('combo', 5), g('catch', 15)],              { drain: 0.8, heavy: 0.4 }),
    // --- evening ---
    S(2, 90,  [g('type', 'redfly', 4)],                     { drain: 0.85, heavy: 0.4 }),
    S(2, 100, [g('kind', 'moth', 3), g('catch', 18)],       { drain: 0.9, heavy: 0.45, wind: true }),
    S(2, 100, [g('score', 2000)],                           { drain: 0.9, heavy: 0.5, spawn: 0.9 }),
    S(2, 100, [g('survive'), g('catch', 15)],               { drain: 1.0, heavy: 0.5, gust: 55 }),
    S(2, 110, [g('heavy', 3, 3)],                           { drain: 0.95, heavy: 0.6 }),
    // --- night ---
    S(3, 100, [g('kind', 'firefly', 5)],                    { drain: 1.0, heavy: 0.55 }),
    S(3, 110, [g('type', 'kokuwa', 1), g('catch', 15)],     { drain: 1.0, heavy: 0.6 }),
    S(3, 110, [g('combo', 8)],                              { drain: 1.05, heavy: 0.6, spawn: 0.9 }),
    S(3, 110, [g('treats', 15), g('catch', 20)],            { drain: 1.1, heavy: 0.65, bonusNeed: 10, gust: 70 }),
    S(4, 120, [g('boss', 1)],                               { drain: 1.0, heavy: 0.6, bonusNeed: 8 }),
    // --- mixed times, getting tough ---
    S(0, 100, [g('catch', 24), g('combo', 5)],            { drain: 1.15, heavy: 0.7, spawn: 0.85, wind: true }),
    S(1, 110, [g('kind', 'bee', 4), g('catch', 25)],        { drain: 1.2, heavy: 0.75, gust: 60 }),
    S(2, 110, [g('heavy', 4, 4)],                           { drain: 1.2, heavy: 0.8, spawn: 0.9 }),
    S(3, 120, [g('kind', 'stag', 2), g('score', 5000)],     { drain: 1.25, heavy: 0.85, gust: 75 }),
    S(4, 120, [g('combo', 12)],                             { drain: 1.3, heavy: 0.85, spawn: 0.85, wind: true }),
    S(1, 120, [g('boss', 2)],                               { drain: 1.3, heavy: 0.9, bonusNeed: 8, gust: 90 }),
    S(2, 120, [g('catch', 32), g('survive')],               { drain: 1.4, heavy: 0.9, spawn: 0.85, gust: 60 }),
    S(3, 120, [g('score', 8000), g('kind', 'rhino', 1)],    { drain: 1.45, heavy: 1, gust: 70, bonusNeed: 10 }),
    S(4, 130, [g('type', 'hercules', 1), g('catch', 30)],   { drain: 1.5, heavy: 1, bonusNeed: 9, gust: 80 }),
    S(4, 150, [g('boss', 3), g('score', 12000)],            { drain: 1.6, heavy: 1, spawn: 0.85, bonusNeed: 9, gust: 70, wind: true }),
  ];

  root.SH = root.SH || {};
  root.SH.STAGES = STAGES;
  if (typeof module !== 'undefined' && module.exports) module.exports = STAGES;
})(typeof globalThis !== 'undefined' ? globalThis : this);
