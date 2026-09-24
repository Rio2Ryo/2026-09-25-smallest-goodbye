import { commitGoodbye, createGoodbye, encodeState, keptText, receipt, releasePulse, releasedText } from '../src/goodbye'

function args() {
  const out: Record<string, string> = {}
  const values = process.argv.slice(2)
  for (let i = 0; i < values.length; i += 1) {
    const item = values[i]
    if (!item.startsWith('--')) continue
    const [rawKey, inline] = item.slice(2).split('=', 2)
    if (inline !== undefined) out[rawKey] = inline
    else if (values[i + 1] && !values[i + 1].startsWith('--')) out[rawKey] = values[++i]
  }
  return out
}

const input = args()
const phrase = input.phrase ?? 'もう誰かの期待で走らない'
const seed = input.seed ?? 'dawn-0925'
const holds = (input.holds ?? '700,1400').split(',').map(Number)
if (!holds.length || holds.some((hold) => !Number.isFinite(hold) || hold < 0)) {
  console.error('holds はカンマ区切りの0以上の数値で指定してください')
  process.exit(1)
}
let state = createGoodbye(phrase, seed)
const timeline: Array<{ step: number; holdMs?: number; remaining: string; released: string }> = [{ step: 0, remaining: keptText(state), released: '' }]
for (const hold of holds) {
  state = releasePulse(state, hold)
  timeline.push({ step: timeline.length, holdMs: hold, remaining: keptText(state), released: releasedText(state) })
}
state = commitGoodbye(state)
console.log(JSON.stringify({
  input: { phrase: state.phrase, seed: state.seed, holds },
  theme: state.theme,
  timeline,
  receipt: receipt(state),
  committed: state.committed,
  shareTokenLength: encodeState(state).length,
}, null, 2))
