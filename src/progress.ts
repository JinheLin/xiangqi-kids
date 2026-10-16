import { lessons } from './data/curriculum';

export const STORAGE_KEY = 'xiangqi-kids-progress-v1';
export interface Progress { version: 1; completed: Record<string, number>; lastLesson: string; voice: boolean }
export const emptyProgress = (): Progress => ({ version: 1, completed: {}, lastLesson: lessons[0].id, voice: false });
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
    return { version: 1, completed, lastLesson: lessons.some(l => l.id === value.lastLesson) ? value.lastLesson : lessons[0].id, voice: value.voice === true };
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
