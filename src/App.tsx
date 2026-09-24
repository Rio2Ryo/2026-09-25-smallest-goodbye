import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  commitGoodbye,
  createGoodbye,
  decodeState,
  encodeState,
  receipt,
  releasePulse,
  type GoodbyeState,
} from './goodbye'

type DebugApi = {
  getState: () => GoodbyeState
  begin: (phrase: string, seed?: string) => GoodbyeState
  hold: (ms: number) => GoodbyeState
  commit: () => GoodbyeState
  reset: () => GoodbyeState
  export: () => string
}

declare global { interface Window { __GOODBYE__?: DebugApi } }

function initialState() {
  const token = window.location.hash.startsWith('#s=') ? window.location.hash.slice(3) : ''
  const decoded = decodeState(token)
  if (decoded) return decoded
  if (token) window.history.replaceState(null, '', window.location.pathname)
  return createGoodbye('もう誰かの期待で走らない', 'dawn-0925')
}

export default function App() {
  const [state, setState] = useState<GoodbyeState>(initialState)
  const [started, setStarted] = useState(() => window.location.hash.startsWith('#s='))
  const [draft, setDraft] = useState(state.phrase)
  const [holding, setHolding] = useState(false)
  const [holdMs, setHoldMs] = useState(0)
  const [notice, setNotice] = useState('')
  const [previous, setPrevious] = useState<ReturnType<typeof receipt> | null>(null)
  const latest = useRef(state)
  const holdStart = useRef(0)
  const timer = useRef<number | null>(null)

  const update = (next: GoodbyeState) => {
    latest.current = next
    setState(next)
    return next
  }

  const applyHold = (ms: number) => {
    const before = latest.current.remaining.length
    const next = update(releasePulse(latest.current, ms))
    const gone = before - next.remaining.length
    setNotice(gone ? `${gone}文字が風へ移った` : '最後の一文字が、手の中に残った')
    return next
  }

  useEffect(() => {
    window.__GOODBYE__ = {
      getState: () => latest.current,
      begin: (phrase, seed = 'debug-wind') => {
        setStarted(true)
        setDraft(phrase)
        return update(createGoodbye(phrase, seed))
      },
      hold: (ms) => applyHold(ms),
      commit: () => update(commitGoodbye(latest.current)),
      reset: () => {
        const next = createGoodbye(latest.current.phrase, latest.current.seed)
        setStarted(false)
        return update(next)
      },
      export: () => encodeState(latest.current),
    }
    return () => { delete window.__GOODBYE__ }
  })

  useEffect(() => () => {
    if (timer.current !== null) window.clearInterval(timer.current)
  }, [])

  const begin = (event: FormEvent) => {
    event.preventDefault()
    const next = createGoodbye(draft, `wind-${new Date().getDate()}-${draft.length}`)
    update(next)
    setStarted(true)
    setNotice('言葉を手のひらに置いた')
  }

  const startHold = () => {
    if (state.committed || state.remaining.length <= 1 || holding) return
    holdStart.current = performance.now()
    setHoldMs(0)
    setHolding(true)
    timer.current = window.setInterval(() => setHoldMs(Math.round(performance.now() - holdStart.current)), 50)
  }

  const endHold = () => {
    if (!holding) return
    const duration = Math.max(180, performance.now() - holdStart.current)
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
    setHolding(false)
    setHoldMs(Math.round(duration))
    applyHold(duration)
  }

  const commit = () => {
    const next = commitGoodbye(state)
    update(next)
    if (next.committed) setNotice('残った文字を、持って帰るものにした')
  }

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#s=${encodeState(state)}`
    window.history.replaceState(null, '', url)
    try {
      await navigator.clipboard.writeText(url)
      setNotice('この風を再現するURLをコピーした')
    } catch {
      setNotice('URLにこの風を保存した')
    }
  }

  const again = () => {
    setPrevious(receipt(state))
    const next = createGoodbye(state.phrase, `${state.seed}-another`)
    update(next)
    setStarted(true)
    setNotice('同じ言葉に、別の風が吹きはじめた')
    window.history.replaceState(null, '', window.location.pathname)
  }

  const currentReceipt = receipt(state)
  const remaining = new Set(state.remaining)
  const progress = Math.round((1 - state.remaining.length / state.letters.length) * 100)

  return (
    <main className={`app ${state.committed ? 'is-committed' : ''}`}>
      <header>
        <p className="eyebrow">A RELEASE INSTRUMENT / 02:00</p>
        <h1>THE SMALLEST<br /><em>GOODBYE</em></h1>
        <p className="jp-title">いちばん小さな別れ</p>
      </header>

      {!started ? (
        <section className="opening" aria-labelledby="prompt-title">
          <div className="instruction"><span>01</span><p id="prompt-title">終わったのに、まだ持っているものを<br />ひとつだけ置いてください。</p></div>
          <form onSubmit={begin}>
            <label htmlFor="phrase">もう持たなくていいもの</label>
            <textarea id="phrase" maxLength={72} value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} required />
            <button className="begin" type="submit">この言葉を、手のひらに置く <span>→</span></button>
          </form>
        </section>
      ) : (
        <>
          <section className="wind" aria-label="手放す言葉のフィールド">
            <div className="wind-topline">
              <span>{state.committed ? 'AFTER THE WIND' : 'HOLD TO RELEASE'}</span>
              <span>{progress}% RELEASED</span>
            </div>
            <div className="field" data-remaining={state.remaining.length}>
              <div className="air air-one" /><div className="air air-two" />
              {state.letters.map((letter) => {
                const stays = remaining.has(letter.id)
                const pulseIndex = state.pulses.findIndex((pulse) => pulse.released.includes(letter.id))
                return (
                  <span
                    className={`letter ${stays ? 'stays' : 'released'}`}
                    data-letter={letter.char}
                    key={letter.id}
                    style={{ '--x': `${letter.x}%`, '--y': `${letter.y}%`, '--r': `${letter.turn}deg`, '--delay': `${Math.max(0, pulseIndex) * 90}ms` } as React.CSSProperties}
                  >{letter.char}</span>
                )
              })}
              <p className="ghost-phrase">{state.phrase}</p>
            </div>

            {!state.committed ? (
              <div className="ritual-controls">
                <p><span>02</span> 押している間だけ、風が言葉をほどきます。<br />離した瞬間、残す文字が決まります。</p>
                <button
                  className={`hold ${holding ? 'holding' : ''}`}
                  type="button"
                  onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); startHold() }}
                  onPointerUp={endHold}
                  onPointerCancel={endHold}
                  onKeyDown={(event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) startHold() }}
                  onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') endHold() }}
                >
                  <span className="hold-ring" />
                  <strong>{holding ? `${(holdMs / 1000).toFixed(1)} 秒` : '押し続ける'}</strong>
                  <small>{holding ? 'いま、ほどけている' : 'HOLD / RELEASE'}</small>
                </button>
                <details>
                  <summary>長押しできないとき</summary>
                  <div className="fallbacks">
                    <button type="button" onClick={() => applyHold(500)}>一息だけ</button>
                    <button type="button" onClick={() => applyHold(1500)}>胸が空くまで</button>
                    <button type="button" onClick={() => applyHold(3200)}>ほとんど全部</button>
                  </div>
                </details>
                {state.pulses.length > 0 && <button className="commit" type="button" onClick={commit}>残った文字を持って帰る →</button>}
              </div>
            ) : (
              <section className="receipt" aria-live="polite">
                <p className="receipt-no">GOODBYE RECEIPT / {state.seed.toUpperCase()}</p>
                <h2>{currentReceipt.title}</h2>
                <div className="keepsake" aria-label={`残った文字 ${currentReceipt.keepsake}`}>
                  <span>風のあと、残った文字</span>
                  <strong>{currentReceipt.keepsake}</strong>
                </div>
                <p className="receipt-line">{currentReceipt.line}</p>
                <p className="anchor">持って帰るもの — <strong>{currentReceipt.anchor}</strong></p>
                <div className="receipt-actions">
                  <button type="button" onClick={again}>同じ言葉に、別の風を</button>
                  <button type="button" onClick={share}>この風を保存する</button>
                </div>
                {previous && <aside className="comparison"><span>ひとつ前の風</span><strong>{previous.keepsake}</strong><small>{previous.released}文字を手放した</small></aside>}
              </section>
            )}
          </section>

          <aside className="pulse-log" aria-label="風の履歴">
            <span>WIND LOG</span>
            {state.pulses.length === 0 ? <p>まだ風は吹いていない。</p> : state.pulses.map((pulse, index) => <p key={pulse.id}>0{index + 1} — {(pulse.ms / 1000).toFixed(1)}秒 / {pulse.released.length}文字</p>)}
          </aside>
        </>
      )}
      <div className="notice" role="status">{notice}</div>
      <footer><span>THE SMALLEST GOODBYE</span><span>文字は消えず、風の側へ移ります。</span></footer>
    </main>
  )
}
