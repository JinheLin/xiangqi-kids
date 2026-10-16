import { describe, expect, it } from 'vitest';
import { awardLesson, emptyProgress, firstUnfinished, isUnlocked, parseProgress, starTotal } from './progress';
import { lessons } from './data/curriculum';

describe('durable progress', () => {
  it.each([null, '', '{broken', 'null', '{}', '{"version":2}', '{"version":1,"completed":null}'])('recovers from missing or malformed data: %s', raw => {
    expect(parseProgress(raw)).toEqual(emptyProgress());
  });
  it('filters unknown lesson ids and invalid stars', () => {
    const progress = parseProgress(JSON.stringify({ version: 1, completed: { 'hello-board': 3, 'meet-team': -1, 'meet-pieces': 99, fake: 3, horse: '3' }, lastLesson: 'fake', voice: 'true' }));
    expect(progress.completed).toEqual({ 'hello-board': 3 }); expect(progress.lastLesson).toBe(lessons[0].id); expect(progress.voice).toBe(false);
  });
  it('keeps best scores without duplicate rewards', () => {
    let progress = awardLesson(emptyProgress(), lessons[0].id, 3);
    progress = awardLesson(progress, lessons[0].id, 1);
    expect(starTotal(progress)).toBe(3); expect(Object.keys(progress.completed)).toHaveLength(1);
    expect(parseProgress(JSON.stringify(progress))).toEqual(progress);
  });
  it('unlocks the next lesson and resumes first unfinished', () => {
    const progress = emptyProgress(); expect(isUnlocked(0, progress)).toBe(true); expect(isUnlocked(1, progress)).toBe(false);
    const next = awardLesson(progress, lessons[0].id, 2);
    expect(isUnlocked(1, next)).toBe(true); expect(isUnlocked(2, next)).toBe(false); expect(firstUnfinished(next)).toBe(lessons[1]);
  });
  it('migrates existing progress without losing stars and saves sound independently of speech', () => {
    const old = JSON.stringify({ version: 1, completed: { 'hello-board': 3 }, voice: true });
    const progress = parseProgress(old);
    expect(progress.completed).toEqual({ 'hello-board': 3 }); expect(progress.sound).toBe(true); expect(progress.voice).toBe(true);
    const muted = parseProgress(JSON.stringify({ ...progress, sound: false }));
    expect(muted.sound).toBe(false); expect(muted.voice).toBe(true); expect(starTotal(muted)).toBe(3);
  });
});
