import { commitGoodbye, createGoodbye, decodeState, detectTheme, encodeState, keptText, receipt, releasePulse } from './goodbye'
import { describe, expect, it } from 'vitest'

describe('smallest goodbye domain', () => {
  it('detects meaning rather than using only a hash', () => {
    expect(detectTheme('もう誰かの期待で走らない')).toBe('expectation')
    expect(detectTheme('終わった恋と別れたい')).toBe('relationship')
    expect(receipt(createGoodbye('仕事を手放す', 'same')).line).not.toBe(receipt(createGoodbye('夢を手放す', 'same')).line)
  })

  it('is deterministic for a seed and pulse history', () => {
    const run = () => commitGoodbye(releasePulse(releasePulse(createGoodbye('誰かの期待で走ること', 'fixed'), 700), 1200))
    expect(run()).toEqual(run())
  })

  it('makes short and long releases consequential', () => {
    const base = createGoodbye('もう誰かの期待で走らない', 'fixed')
    const short = commitGoodbye(releasePulse(base, 350))
    const long = commitGoodbye(releasePulse(base, 2600))
    expect(keptText(short)).not.toBe(keptText(long))
    expect(receipt(short).title).not.toBe(receipt(long).title)
    expect(receipt(short).released).toBeLessThan(receipt(long).released)
  })

  it('always leaves at least one physical letter', () => {
    const state = releasePulse(createGoodbye('さよなら', 'fixed'), 5000)
    expect(state.remaining).toHaveLength(1)
  })

  it('sanitizes hostile and control input without losing it as text', () => {
    const state = createGoodbye('<img src=x onerror=alert(1)>\u0000 終わり', 'x')
    expect(state.phrase).toContain('<img')
    expect(state.phrase).not.toContain('\u0000')
  })

  it('round trips a completed share state and rejects malformed data', () => {
    const state = commitGoodbye(releasePulse(createGoodbye('古い夢', 'share'), 900))
    expect(decodeState(encodeState(state))).toEqual(state)
    expect(decodeState('e30')).toBeNull()
    expect(decodeState('not-base64')).toBeNull()
  })

  it('does not commit before a release', () => {
    const state = createGoodbye('まだここにいる', 'fixed')
    expect(commitGoodbye(state).committed).toBe(false)
  })
})
