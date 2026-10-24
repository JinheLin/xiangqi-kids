export const difficulties = [
  { id: 'starter', title: '启蒙', description: '先熟悉走法，适合刚开始学棋。', depth: 1, quiescence: 0, timeMs: 80, nodes: 2_000 },
  { id: 'easy', title: '入门', description: '轻松练习走棋，留意吃子和保护。', depth: 2, quiescence: 0, timeMs: 220, nodes: 18_000 },
  { id: 'medium', title: '进阶', description: '会推演连续交换，注意进攻和防守。', depth: 4, quiescence: 4, timeMs: 800, nodes: 140_000 },
  { id: 'hard', title: '挑战', description: '想得更远，认真寻找战术与将杀。', depth: 6, quiescence: 6, timeMs: 1_800, nodes: 450_000 },
] as const;
export type Difficulty = typeof difficulties[number]['id'];
export const defaultDifficulty: Difficulty = 'easy';
export const parseDifficulty = (value: unknown): Difficulty => difficulties.some(item => item.id === value) ? value as Difficulty : defaultDifficulty;
