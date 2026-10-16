import { initialBoard, samePoint } from '../engine/xiangqi';
import type { Board, Piece, PieceType, Point, Side } from '../engine/xiangqi';

interface StepBase { title: string; instruction: string; explain: string; hints: string[]; board: Board }
export interface IdentifyStep extends StepBase { kind: 'identify'; targetType: PieceType; targetSide: Side }
export interface MoveStep extends StepBase { kind: 'move'; from: Point; to: Point; turn: Side; result?: 'capture' | 'check' | 'checkmate' | 'stalemate' | 'escape' }
export interface QuizStep extends StepBase { kind: 'quiz'; options: string[]; answer: number }
export type Step = IdentifyStep | MoveStep | QuizStep;
export interface Lesson { id: string; chapter: number; title: string; subtitle: string; token: string; minutes: number; steps: Step[] }
export const chapters = [
  { title: '和象棋交朋友', subtitle: '认识棋盘与棋子', icon: '芽', color: 'sage', badge: '象棋新朋友' },
  { title: '棋子的奇妙脚步', subtitle: '七种棋子，各有本领', icon: '步', color: 'peach', badge: '走棋小能手' },
  { title: '一起学会吃子', subtitle: '瞄准目标，也保护伙伴', icon: '子', color: 'yellow', badge: '吃子小达人' },
  { title: '保护我们的帅', subtitle: '将军、应将与照面', icon: '盾', color: 'blue', badge: '九宫守护者' },
  { title: '第一场小胜利', subtitle: '将死与困毙，准备出发', icon: '旗', color: 'purple', badge: '小小象棋手' },
];
const point = (x: number, y: number): Point => ({ x, y });
export const makePiece = (type: PieceType, side: Side, x: number, y: number): Piece => ({ id: `${side}-${type}-${x}-${y}`, type, side, x, y });
const r = (type: PieceType, x: number, y: number) => makePiece(type, 'red', x, y);
const b = (type: PieceType, x: number, y: number) => makePiece(type, 'black', x, y);
/** Every teaching position includes both generals, so normal legality applies. */
const setup = (...pieces: Piece[]): Board => [r('general', 4, 9), b('general', 4, 0), r('pawn', 4, 5)]
  .filter(p => !pieces.some(extra => samePoint(extra, p))).concat(pieces);
const move = (title: string, instruction: string, board: Board, from: [number, number], to: [number, number], explain: string, hints: string[], result?: MoveStep['result']): MoveStep =>
  ({ kind: 'move', title, instruction, board, from: point(...from), to: point(...to), turn: 'red', explain, hints, result });
const identify = (title: string, instruction: string, targetType: PieceType, targetSide: Side, explain: string): IdentifyStep =>
  ({ kind: 'identify', title, instruction, targetType, targetSide, explain, board: initialBoard(), hints: [`找一找${targetSide === 'red' ? '下面红色' : '上面深色'}的棋子。`, `点一下写着“${({ rook: '车', horse: '马', cannon: '炮', pawn: targetSide === 'red' ? '兵' : '卒', elephant: targetSide === 'red' ? '相' : '象', advisor: targetSide === 'red' ? '仕' : '士', general: targetSide === 'red' ? '帅' : '将' })[targetType]}”的棋子。`] });
const quiz = (title: string, instruction: string, options: string[], answer: number, explain: string, board = initialBoard()): QuizStep =>
  ({ kind: 'quiz', title, instruction, options, answer, explain, board, hints: [explain, `再想一想：${options[answer]}`] });

export const lessons: Lesson[] = [
  { id: 'hello-board', chapter: 0, title: '你好，象棋！', subtitle: '认识我们的棋盘小天地', token: '棋', minutes: 3, steps: [
    quiz('棋子住在哪里？', '看看棋盘：棋子应该放在线与线的交叉点，还是小方格里面呢？', ['线与线的交叉点', '小方格的正中间', '棋盘外面'], 0, '对啦！象棋有 9 条竖线、10 条横线。棋子就住在交叉点上。'),
    quiz('中间有一条河', '棋盘中间写着“楚河 · 汉界”。这条河把棋盘分成了几边？', ['三边', '两边：红方和黑方', '四边'], 1, '楚河汉界把棋盘分成两边。下面是红方，上面是黑方。'),
    quiz('谁先出发？', '一盘新棋开始时，哪一方先走？', ['黑方先走', '一起走', '红方先走，然后轮流'], 2, '红方先走，接着黑方走。每次只能移动自己的一枚棋子。'),
  ] },
  { id: 'meet-team', chapter: 0, title: '认识红黑两队', subtitle: '找到兵、卒、帅和将', token: '兵', minutes: 3, steps: [
    identify('找到红方小兵', '点一点棋盘上任意一枚红色的“兵”。', 'pawn', 'red', '找到了！红方叫“兵”，黑方叫“卒”，它们的本领一样。'),
    identify('找到黑方小卒', '现在找一枚黑方的“卒”吧！', 'pawn', 'black', '真棒！两队各有 16 枚棋子，一共 32 枚。'),
    identify('红方的队长', '红方的队长住在九宫里，请点一下“帅”。', 'general', 'red', '帅是红方队长，将是黑方队长。保护队长很重要！'),
    identify('黑方的队长', '请找出黑方的“将”。', 'general', 'black', '九宫就是画着交叉斜线的地方，两位队长都要留在自己的九宫。'),
  ] },
  { id: 'meet-pieces', chapter: 0, title: '集结棋子伙伴', subtitle: '车、马、炮、相和仕', token: '马', minutes: 4, steps: [
    identify('直线小火车', '找到红方的“车”，点一下它。', 'rook', 'red', '车在棋盘的两角，它擅长沿直线前进！'),
    identify('爱跳的小马', '找到红方的“马”。', 'horse', 'red', '马站在车的旁边，走法像一个“日”字。'),
    identify('神奇的小炮', '找到红方的“炮”。', 'cannon', 'red', '炮在第三排，吃子时需要一个炮架。'),
    identify('守家的小相', '找到红方的“相”。', 'elephant', 'red', '红相和黑象走法一样，都不能过河。'),
    identify('队长的小卫士', '最后找到红方的“仕”。', 'advisor', 'red', '红仕和黑士都是卫士，守在九宫里。七种棋子都认识啦！'),
  ] },
  { id: 'rook', chapter: 1, title: '车：直线小火车', subtitle: '横着走，竖着走', token: '车', minutes: 3, steps: [
    move('沿着直线出发', '先点红车，再点金色星星。让车沿着竖线走过去。', setup(r('rook', 0, 8)), [0, 8], [0, 4], '车可以横着或竖着走，距离不限，中间不能有棋子。', ['找到左下方的红车。', '沿同一条竖线往上，在星星处停下。']),
    move('前面有伙伴', '前方被小兵挡住啦。请让红车向右走到星星处。', setup(r('rook', 0, 8), r('pawn', 0, 6)), [0, 8], [3, 8], '车不能跳过棋子。遇到伙伴，可以换一条畅通的路线。', ['前方的小兵挡住了直线。', '点红车，再向右走三格。']),
  ] },
  { id: 'horse', chapter: 1, title: '马：蹦出一个“日”', subtitle: '小马的第一跳', token: '马', minutes: 3, steps: [
    move('小马跳一跳', '点一下红马，帮它跳到星星处。', setup(r('horse', 3, 7)), [3, 7], [5, 6], '马走“日”：先向右一格，再向右上方斜走一格。', ['小马的终点和起点，正好是“日”字的两个对角。', '从红马出发，向右两格、向上一格。']),
    move('再跳到另一边', '这次请小马向左上方跳到星星处。', setup(r('horse', 6, 7)), [6, 7], [5, 5], '这次先向上一格，再向左上方斜走一格。马有好多方向可以跳！', ['先向上直走，再斜走。', '终点在起点左边一格、上面两格。']),
  ] },
  { id: 'horse-leg', chapter: 1, title: '小心，蹩马腿！', subtitle: '先看看脚下有没有挡住', token: '马', minutes: 3, steps: [
    move('换个方向跳', '小马向上的路被兵挡住了。请向左上方跳到星星处。', setup(r('horse', 3, 7), r('pawn', 3, 6)), [3, 7], [1, 6], '先直走的那一格就是“马腿”。那里有棋子，这个方向就不能跳。', ['向上的马腿有兵，向左的马腿是空的。', '先向左一格，再向左上斜走，落在星星上。']),
  ] },
  { id: 'cannon', chapter: 1, title: '炮：隔山打牛', subtitle: '走路和吃子不一样', token: '炮', minutes: 4, steps: [
    move('先学炮走路', '没有吃子的时候，炮像车一样。把红炮直着移到星星处。', setup(r('cannon', 1, 7)), [1, 7], [1, 4], '炮不吃子时，沿空的横线或竖线走，不能跳。', ['先找到左边的红炮。', '沿竖线向上走三格。']),
    move('隔一个，吃到了', '中间的小兵来当炮架。请用红炮吃掉上面的黑马。', setup(r('cannon', 1, 7), r('pawn', 1, 5), b('horse', 1, 2)), [1, 7], [1, 2], '炮吃子时，中间必须刚好隔一枚棋子。炮架可以是任何一方的棋子。', ['红炮与黑马在同一条竖线上。', '点红炮，再点黑马，跳过中间的一枚兵。'], 'capture'),
  ] },
  { id: 'pawn', chapter: 1, title: '兵：勇敢向前', subtitle: '过河前，一步一步走', token: '兵', minutes: 3, steps: [
    move('小兵向前一步', '红兵向着黑方前进。请走到前面一格的星星处。', setup(r('pawn', 0, 6)), [0, 6], [0, 5], '兵没过河时，只能向前走一格。红方向上，黑方向下。', ['红兵的前方是棋盘上方。', '点最左边的红兵，再点它正上方一格。']),
    move('我们过河啦', '再往前走一步，让左边的小兵跨过楚河汉界！', setup(r('pawn', 0, 5)), [0, 5], [0, 4], '过河啦！从现在起，小兵也可以向左或向右走一格。', ['楚河汉界在第 5 和第 6 条横线之间。', '左边的小兵向上走一格就到对岸了。']),
  ] },
  { id: 'pawn-river', chapter: 1, title: '过河兵更厉害', subtitle: '可以左右走，不能后退', token: '兵', minutes: 3, steps: [
    move('过河之后向右走', '这个兵已经过河了。请向右走一格，到星星处。', setup(r('pawn', 2, 4)), [2, 4], [3, 4], '过河兵可以向前、向左、向右，但每次仍然只走一格，也不能后退。', ['这个兵在河的上面，已经过河。', '点左上方的红兵，再点它右边一格。']),
    quiz('到了最前面呢？', '小兵走到对方底线以后，可以怎么走？', ['变成车', '向后退一格', '向左或向右走一格'], 2, '象棋的兵不会升变。到底线后，仍然可以左右走一格，不能后退。'),
  ] },
  { id: 'elephant', chapter: 1, title: '相：画一个“田”', subtitle: '守住河这边的家', token: '相', minutes: 3, steps: [
    move('相走田字', '请让红相斜着走两格，到左上方的星星处。', setup(r('elephant', 2, 9)), [2, 9], [0, 7], '相走“田”：沿斜线走两格，而且不能过河。', ['“田”字中心的交叉点要是空的。', '点红相，再点它左上方两格。']),
    move('绕开塞住的象眼', '右下方的“象眼”有兵挡住了。请向左下方走。', setup(r('elephant', 2, 5), r('pawn', 3, 6)), [2, 5], [0, 7], '中心点叫“象眼”，有棋子就不能从这个方向走。左下方的象眼是空的。', ['不能过河，也不能跳过象眼上的棋子。', '点靠近河的红相，再点左下方的星星。']),
  ] },
  { id: 'advisor', chapter: 1, title: '仕：九宫小卫士', subtitle: '斜走一格，守护队长', token: '仕', minutes: 2, steps: [
    move('向九宫中心走', '请把红仕斜着走一格，来到九宫的中心。', setup(r('advisor', 3, 9)), [3, 9], [4, 8], '仕每次斜走一格，始终留在九宫里。黑方的士也一样。', ['找找九宫里面的交叉斜线。', '从红仕出发，向右上方斜走一格。']),
  ] },
  { id: 'general', chapter: 1, title: '帅：我们的队长', subtitle: '九宫里，直走一格', token: '帅', minutes: 2, steps: [
    move('队长挪一步', '请把红帅向右移动一格，仍然留在九宫里。', setup(), [4, 9], [5, 9], '帅和将每次只能横着或竖着走一格，不能斜走，也不能离开九宫。', ['先点最下面的红帅。', '点红帅右边一格的星星。']),
  ] },
  { id: 'capture', chapter: 2, title: '我的第一次吃子', subtitle: '走到对手的位置上', token: '车', minutes: 3, steps: [
    move('红车吃黑卒', '对手在同一条竖线上！请用红车吃掉黑卒。', setup(r('rook', 0, 7), b('pawn', 0, 4)), [0, 7], [0, 4], '吃子就是走到对方棋子的位置，把它移出棋盘。吃子也要遵守走法。', ['先点自己的红车。', '再点上方的黑卒，红车就会占据它的位置。'], 'capture'),
    quiz('遇到自己的伙伴', '如果前面是自己的棋子，可以吃掉它吗？', ['可以，走过去就行', '不可以，要保护自己的伙伴'], 1, '只能吃对方的棋子，不能吃自己的棋子。自己的棋子也会挡路。'),
  ] },
  { id: 'capture-horse', chapter: 2, title: '小马也能吃子', subtitle: '每种棋子都按自己的走法', token: '马', minutes: 2, steps: [
    move('跳过去，吃到啦', '用红马按“日”字走法，吃掉右上方的黑炮。', setup(r('horse', 2, 7), b('cannon', 3, 5)), [2, 7], [3, 5], '马吃子和走路一样，都走“日”，而且要检查马腿。', ['黑炮在红马的右上方。', '先向上一格，再斜向右上，点击黑炮。'], 'capture'),
  ] },
  { id: 'capture-cannon', chapter: 2, title: '谁来当炮架？', subtitle: '对方的棋子也能帮忙', token: '炮', minutes: 2, steps: [
    move('借用黑卒当炮架', '用红炮跳过黑卒，吃掉最上方的黑车。', setup(r('cannon', 7, 8), b('pawn', 7, 5), b('rook', 7, 1)), [7, 8], [7, 1], '炮架可以是红棋，也可以是黑棋。吃完以后，炮架仍然留在原位。', ['数一数，红炮与黑车之间刚好有一枚黑卒。', '点红炮，再点同一竖线上最上面的黑车。'], 'capture'),
  ] },
  { id: 'check', chapter: 3, title: '将军！', subtitle: '让对方队长注意安全', token: '将', minutes: 3, steps: [
    move('红车发出将军', '把红车向右移到星星处，让它正对黑将。', setup(r('rook', 0, 3)), [0, 3], [4, 3], '将军，就是下一步能攻击到对方的将或帅。对手必须立刻解除威胁。', ['黑将在中间的竖线上。', '把红车平移到黑将下面，与它在同一条竖线上。'], 'check'),
    quiz('被将军时怎么办？', '对方说“将军”，现在应该做什么？', ['随便走一枚棋子', '先想办法保护帅，解除将军', '连续走两步'], 1, '被将军后必须立即应将。可以躲开、挡住，或吃掉进攻的棋子。'),
  ] },
  { id: 'escape', chapter: 3, title: '应将一：躲开', subtitle: '给队长找个安全的位置', token: '帅', minutes: 2, steps: [
    move('快让队长躲开', '黑车将军啦！请把红帅向右挪一格，离开黑车的攻击线。', setup(b('rook', 4, 6)), [4, 9], [5, 9], '安全了！移动帅（将）是解除将军的一种办法。新位置也不能被攻击。', ['黑车沿中间竖线攻击红帅。', '点红帅，再点它右边的星星。'], 'escape'),
  ] },
  { id: 'block', chapter: 3, title: '应将二：挡住', subtitle: '伙伴来帮忙', token: '车', minutes: 2, steps: [
    move('红车来挡一挡', '黑车从左边将军。请把红车向下移动到星星处，挡在中间。', setup(b('rook', 0, 9), r('rook', 3, 7)), [3, 7], [3, 9], '挡住攻击线，也可以保护帅。注意：并不是每种将军都能挡，比如马的攻击。', ['黑车与红帅在同一条横线上。', '把红车移到红帅左边一格，挡住黑车。'], 'escape'),
  ] },
  { id: 'capture-attacker', chapter: 3, title: '应将三：吃掉它', subtitle: '解除危险的另一种办法', token: '车', minutes: 2, steps: [
    move('吃掉进攻的黑车', '黑车正在将军。请用左边的红车吃掉它，保护红帅。', setup(b('rook', 4, 7), r('rook', 0, 7)), [0, 7], [4, 7], '进攻的棋子被吃掉，将军就解除了。吃子以后，还要确认帅是安全的。', ['两辆车在同一条横线上，中间没有棋子。', '先点左边的红车，再点正在将军的黑车。'], 'escape'),
  ] },
  { id: 'facing', chapter: 3, title: '将帅不能照面', subtitle: '中间的伙伴很重要', token: '兵', minutes: 3, steps: [
    quiz('中间的小兵能走开吗？', '两位队长在同一条竖线上。中间的红兵能横着走开，让它们直接见面吗？', ['可以，兵已经过河了', '不可以，将帅不能直接照面'], 1, '即使符合棋子的走法，也不能让将和帅在没有棋子阻挡的同一条竖线上见面。', [r('general', 4, 9), b('general', 4, 0), r('pawn', 4, 4)]),
    move('向前走，继续挡住', '请把过河兵向前移动一格，让它继续挡在两位队长中间。', [r('general', 4, 9), b('general', 4, 0), r('pawn', 4, 4)], [4, 4], [4, 3], '这样走就对了！兵还留在这条竖线上，将帅就不会照面。', ['横着走会让两位队长直接相见。', '点中间的红兵，再点它正上方的星星。']),
  ] },
  { id: 'checkmate', chapter: 4, title: '将死：无处可逃', subtitle: '试试双车的配合', token: '胜', minutes: 4, steps: [
    move('双车配合，将死', '红车伙伴守住了第二条横线。请把左边的红车移到星星处，将军！', [r('general', 4, 9), b('general', 4, 0), r('rook', 0, 1), r('rook', 8, 1), r('pawn', 4, 5)], [0, 1], [0, 0], '将死啦！黑将被攻击，又没有任何合法的应将方法，红方获胜。', ['一辆车封住下方，另一辆车可以封住黑将所在的横线。', '把左边红车向上移一格。它会沿最上方横线将军。'], 'checkmate'),
    quiz('什么时候赢了？', '对方被将军，而且没有任何合法办法解除威胁，这叫作什么？', ['将死，进攻的一方获胜', '平局', '让对方再走两次'], 0, '将死就是被将军而无法应将。对局到此结束，不用真的吃掉将。'),
  ] },
  { id: 'stalemate', chapter: 4, title: '困毙也是胜利', subtitle: '没有被将军，也可能输', token: '旗', minutes: 4, steps: [
    move('封住最后的出口', '让左边红车向右走到星星处，封住黑将左边的出口。', [r('general', 4, 9), b('general', 4, 0), r('pawn', 4, 5), r('rook', 0, 1), r('rook', 5, 2)], [0, 1], [3, 1], '黑将没被将军，但轮到黑方时已经无棋可走。这叫“困毙”，黑方也会输。', ['右车封住右路，左车要同时守住左路和黑将前方的横线。', '把左车移到黑将左边那条竖线上，也就是星星处。'], 'stalemate'),
    quiz('准备好出发了吗？', '下棋时最重要的小习惯是什么？', ['只看能吃到什么', '先看走法，再看自己的帅是否安全', '一次移动两个棋子'], 1, '你已经学会基础规则啦！去自由练习，和小棋搭子或家人下一盘吧。'),
  ] },
];

export const pieceGuides: { type: PieceType; title: string; rhyme: string; detail: string }[] = [
  { type: 'rook', title: '车', rhyme: '车走直线，不能跳', detail: '横着或竖着走，格数不限。沿途不能有棋子。吃子时走到对方位置。' },
  { type: 'horse', title: '马', rhyme: '马走日，留意腿', detail: '先直走一格，再向外斜走一格。先直走的格子有棋子，就是“蹩马腿”。' },
  { type: 'cannon', title: '炮', rhyme: '走直线，隔一子吃', detail: '不吃子时像车。吃子时，中间必须刚好隔一枚棋子作为炮架。' },
  { type: 'pawn', title: '兵 / 卒', rhyme: '向前走，永不回头', detail: '每次一格。过河前只能向前，过河后也可以左右走。到底线后不升变。' },
  { type: 'elephant', title: '相 / 象', rhyme: '相走田，不过河', detail: '斜着走两格。中间的象眼被挡就不能走，始终留在自己半场。' },
  { type: 'advisor', title: '仕 / 士', rhyme: '斜走一格，守九宫', detail: '每次只能斜走一格，不能离开九宫。' },
  { type: 'general', title: '帅 / 将', rhyme: '直走一格，不出宫', detail: '每次横或竖走一格，留在九宫。将帅不能在没有棋子阻挡的同一竖线上照面。' },
];
