import { useId } from 'react';
import { difficulties } from '../engine/difficulty';
import type { Difficulty } from '../engine/difficulty';

export function DifficultyPicker({ value, onChange }: { value: Difficulty; onChange: (value: Difficulty) => void }) {
  const id = useId(), selected = difficulties.find(level => level.id === value)!;
  return <div className="difficulty-picker"><div><label htmlFor={id}>陪练难度</label><select id={id} value={value} aria-describedby={`${id}-description`} onChange={event => onChange(event.target.value as Difficulty)}>{difficulties.map((level, index) => <option key={level.id} value={level.id}>{index + 1} 级 · {level.title}</option>)}</select></div><p id={`${id}-description`}>{selected.description}<span>随时换级，棋局保留。</span></p></div>;
}
