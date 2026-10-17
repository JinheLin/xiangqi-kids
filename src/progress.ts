import { lessons } from './data/curriculum';
import type { GoalId } from './guided/coach';

export const STORAGE_KEY = 'xiangqi-kids-progress-v1';
export interface Progress { version: 1; completed: Record<string, number>; lastLesson: string; voice: boolean; sound: boolean; guided: { bestSafeMoves: number; badges: GoalId[] } }
export const emptyProgress = (): Progress => ({ version: 1, completed: {}, lastLesson: lessons[0].id, voice: false, sound: true, guided: { bestSafeMoves: 0, badges: [] } });
export function parseProgress(raw: string | null): Progress {
  if (!raw) return emptyProgress();
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || typeof value.completed !== 'object' || !value.completed) return emptyProgress();
    const completed: Record<string, number> = {};
    for (const lesson of lessons) {
      const stars = value.completed[lesson.id];
      if (Number.isInteger(stars) && stars >= 1 && stars <= 3) completed[lesson.id] = stars;
    }
    return { version: 1, completed, lastLesson: lessons.some(l => l.id === value.lastLesson) ? value.lastLesson : lessons[0].id, voice: value.voice === true, sound: value.sound !== false, guided: { bestSafeMoves: Number.isInteger(value.guided?.bestSafeMoves) ? Math.max(0, Math.min(9999, value.guided.bestSafeMoves)) : 0, badges: (['safe', 'capture', 'escape'] as GoalId[]).filter(id => Array.isArray(value.guided?.badges) && value.guided.badges.includes(id)) } };
  } catch { return emptyProgress(); }
}
export function awardLesson(progress: Progress, id: string, stars: number): Progress {
  if (!lessons.some(l => l.id === id)) return progress;
  return { ...progress, completed: { ...progress.completed, [id]: Math.max(progress.completed[id] || 0, Math.min(3, Math.max(1, Math.round(stars)))) } };
}
export const starTotal = (progress: Progress) => Object.values(progress.completed).reduce((a, b) => a + b, 0);
export const firstUnfinished = (progress: Progress) => lessons.find(l => !progress.completed[l.id]) || lessons[0];
export function isUnlocked(index: number, progress: Progress): boolean {
  return index === 0 || !!progress.completed[lessons[index].id] || !!progress.completed[lessons[index - 1].id];
}

export function awardGuided(progress: Progress, goal: GoalId, safeMoves: number, completed: boolean): Progress {
  const bestSafeMoves = Math.max(progress.guided.bestSafeMoves, Math.max(0, Math.min(9999, (Number.isFinite(safeMoves) ? Math.floor(safeMoves) : 0))));
  const badges = completed && !progress.guided.badges.includes(goal) ? [...progress.guided.badges, goal] : progress.guided.badges;
  if (bestSafeMoves === progress.guided.bestSafeMoves && badges === progress.guided.badges) return progress;
  return { ...progress, guided: { bestSafeMoves, badges } };
}
