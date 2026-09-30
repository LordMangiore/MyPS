// Hover and press colors for filled brand buttons, built from tokens.
//
// Pages style buttons inline, so a stylesheet can't know which buttons are
// filled blue or red. The browser serializes inline colors as rgb(), which
// we can match with an attribute selector. Blue buttons step lighter on
// hover (extended ramp), red buttons step darker, matching how the brand
// guide pairs tones within a color family. Everything else gets the generic
// brightness treatment from index.css.
import { core, brandGuide } from './index'

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

const filled = (hex) =>
  ['background', 'background-color']
    .flatMap((prop) =>
      ['button', 'a', "[role='button']"].map((el) => `${el}[style*='${prop}: ${rgb(hex)}']`)
    )
    .join(',\n')

const rule = (hex, hover, press) => {
  const sel = filled(hex)
  const hov = sel.split(',\n').map((s) => `${s}:not(:disabled):hover`).join(',\n')
  const act = sel.split(',\n').map((s) => `${s}:not(:disabled):active`).join(',\n')
  return `${hov} { background: ${hover} !important; border-color: ${hover} !important; filter: none !important; }
${act} { background: ${press} !important; border-color: ${press} !important; filter: none !important; }`
}

export function installInteractionStyles() {
  const blue = brandGuide.blueRamp // [darkest ... lightest], index 3 is primary
  const red = brandGuide.redRamp
  const css = [
    rule(core.blue, blue[4], blue[2]),
    rule(core.red, red[2], red[1]),
  ].join('\n')
  const el = document.createElement('style')
  el.dataset.ps = 'interaction'
  el.textContent = css
  document.head.appendChild(el)
}
