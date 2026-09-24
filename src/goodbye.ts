export type Theme = 'expectation' | 'work' | 'relationship' | 'dream' | 'self' | 'unknown'

export type Letter = {
  id: string
  char: string
  index: number
  anchor: number
  x: number
  y: number
  turn: number
}

export type Pulse = {
  id: string
  ms: number
  released: string[]
  at: number
}

export type GoodbyeState = {
  version: 1
  phrase: string
  seed: string
  theme: Theme
  letters: Letter[]
  remaining: string[]
  pulses: Pulse[]
  committed: boolean
}

const themeRules: Array<{ theme: Theme; cues: string[]; anchor: string; lines: [string, string, string] }> = [
  { theme: 'expectation', cues: ['期待', 'べき', '正解', '応え', '評価'], anchor: '自分', lines: ['期待に応えた時間まで、否定しなくていい。', '他人の拍手を風へ返し、自分の呼吸だけを残した。', 'もう証明しなくていい。それでも歩ける。'] },
  { theme: 'work', cues: ['仕事', '会社', '働', '案件', '締切'], anchor: '余白', lines: ['頑張った事実は、手放しても消えない。', '役割を降ろすと、あなたの輪郭が戻ってくる。', '空いた手は、次に本当に触れたいもののために。'] },
  { theme: 'relationship', cues: ['彼', '彼女', '友', '好き', '愛', '一緒', '別れ'], anchor: '温度', lines: ['忘れなくていい。ただ、持ち方を変えていい。', '名前を風へ返しても、受け取った温度は残る。', '失ったのではなく、身体の内側へ移した。'] },
  { theme: 'dream', cues: ['夢', 'いつか', '諦', '目標', 'なりた'], anchor: '火種', lines: ['叶わなかった願いにも、あなたを運んだ距離がある。', '形をほどいて、願っていた理由だけを残した。', '終わった夢の灰は、次の火を知っている。'] },
  { theme: 'self', cues: ['自分', '私', '僕', '俺', '弱', '嫌い'], anchor: '呼吸', lines: ['変われなかった日々にも、あなたは居続けた。', '責める声を薄くして、呼吸の場所を取り戻した。', '捨てたのはあなたではなく、古い判決だ。'] },
  { theme: 'unknown', cues: [], anchor: '余韻', lines: ['まだ名前のない終わりを、急いで説明しなくていい。', '言葉を少し風へ返し、余韻だけを手元に置いた。', '空白は欠けた場所ではなく、次が入る場所だ。'] },
]

export function cleanText(value: string, max = 72) {
  return Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0)
      return code < 32 || code === 127 ? ' ' : char
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function hash(input: string) {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rand(seed: string, index: number) {
  let x = hash(`${seed}:${index}`) || 1
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  return (x >>> 0) / 4294967295
}

export function detectTheme(phrase: string): Theme {
  return themeRules.find((rule) => rule.theme !== 'unknown' && rule.cues.some((cue) => phrase.includes(cue)))?.theme ?? 'unknown'
}

function ruleFor(theme: Theme) {
  return themeRules.find((rule) => rule.theme === theme) ?? themeRules[themeRules.length - 1]
}

export function createGoodbye(rawPhrase: string, rawSeed = 'dawn-0925'): GoodbyeState {
  const phrase = cleanText(rawPhrase) || 'まだ名前のない何か'
  const seed = cleanText(rawSeed, 40) || 'dawn-0925'
  const theme = detectTheme(phrase)
  const rule = ruleFor(theme)
  const chars = Array.from(phrase).filter((char) => char !== ' ')
  const anchorChars = new Set(Array.from(rule.anchor + rule.cues.join('')))
  const letters = chars.map((char, index) => ({
    id: `l-${index}-${hash(`${seed}:${index}:${char}`).toString(36)}`,
    char,
    index,
    anchor: Math.round(rand(seed, index) * 50) + (anchorChars.has(char) ? 45 : 0) + (/[。、！？]/.test(char) ? -25 : 0),
    x: 8 + rand(`${seed}:x`, index) * 84,
    y: 26 + rand(`${seed}:y`, index) * 44,
    turn: Math.round((rand(`${seed}:r`, index) - 0.5) * 28),
  }))
  return { version: 1, phrase, seed, theme, letters, remaining: letters.map((letter) => letter.id), pulses: [], committed: false }
}

export function releasePulse(state: GoodbyeState, rawMs: number): GoodbyeState {
  if (state.committed || state.remaining.length <= 1) return state
  const ms = Math.max(180, Math.min(5000, Math.round(Number.isFinite(rawMs) ? rawMs : 180)))
  const strength = Math.max(1, Math.floor(ms / 170))
  const candidates = state.letters
    .filter((letter) => state.remaining.includes(letter.id))
    .sort((a, b) => a.anchor - b.anchor || a.index - b.index)
  const count = Math.min(strength, candidates.length - 1)
  const released = candidates.slice(0, count).map((letter) => letter.id)
  const pulse: Pulse = { id: `p-${state.pulses.length + 1}-${hash(`${state.seed}:${state.pulses.length}:${ms}`).toString(36)}`, ms, released, at: state.pulses.length }
  return { ...state, remaining: state.remaining.filter((id) => !released.includes(id)), pulses: [...state.pulses, pulse] }
}

export function commitGoodbye(state: GoodbyeState): GoodbyeState {
  if (!state.pulses.length) return state
  return { ...state, committed: true }
}

export function keptText(state: GoodbyeState) {
  const ids = new Set(state.remaining)
  return state.letters.filter((letter) => ids.has(letter.id)).map((letter) => letter.char).join('')
}

export function releasedText(state: GoodbyeState) {
  const ids = new Set(state.remaining)
  return state.letters.filter((letter) => !ids.has(letter.id)).map((letter) => letter.char).join('')
}

export function receipt(state: GoodbyeState) {
  const ratio = state.remaining.length / Math.max(1, state.letters.length)
  const rule = ruleFor(state.theme)
  const depth = ratio > 0.62 ? 0 : ratio > 0.28 ? 1 : 2
  const titles = ['まだ、手放さなくていい', '半分だけ、風に返した', '最後の一文字は、あなたのもの']
  return {
    title: titles[depth],
    line: rule.lines[depth],
    keepsake: keptText(state),
    anchor: rule.anchor,
    released: state.letters.length - state.remaining.length,
    ratio: Math.round(ratio * 100),
  }
}

export function encodeState(state: GoodbyeState) {
  const payload = JSON.stringify(state)
  const bytes = new TextEncoder().encode(payload)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function decodeState(token: string): GoodbyeState | null {
  try {
    if (!token || token.length > 9000) return null
    const normalized = token.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0))
    const raw: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!raw || typeof raw !== 'object') return null
    const value = raw as Partial<GoodbyeState>
    if (value.version !== 1 || typeof value.phrase !== 'string' || typeof value.seed !== 'string' || !Array.isArray(value.letters) || !Array.isArray(value.remaining) || !Array.isArray(value.pulses) || typeof value.committed !== 'boolean') return null
    if (value.phrase.length > 72 || value.seed.length > 40 || value.letters.length < 1 || value.letters.length > 72 || value.pulses.length > 72) return null
    const validThemes: Theme[] = ['expectation', 'work', 'relationship', 'dream', 'self', 'unknown']
    if (!value.theme || !validThemes.includes(value.theme)) return null
    const ids = new Set<string>()
    for (const letter of value.letters as Letter[]) {
      if (!letter || typeof letter.id !== 'string' || ids.has(letter.id) || typeof letter.char !== 'string' || typeof letter.index !== 'number' || typeof letter.anchor !== 'number' || typeof letter.x !== 'number' || typeof letter.y !== 'number' || typeof letter.turn !== 'number') return null
      ids.add(letter.id)
    }
    if (!(value.remaining as unknown[]).every((id) => typeof id === 'string' && ids.has(id))) return null
    return value as GoodbyeState
  } catch {
    return null
  }
}
