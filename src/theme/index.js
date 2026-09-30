// Single source of truth for myProSource colors and fonts.
// Raw values live in tokens.json so tailwind.config.cjs can read them too.
// Pages build their local `colors` object from these exports instead of
// pasting hex values, so a brand change is one edit in tokens.json.
import tokens from './tokens.json'

export const core = tokens.core
export const gray = tokens.gray
export const surface = tokens.surface
export const statusColors = tokens.status
export const brandGuide = tokens.brandGuide2026
export const fonts = tokens.fonts

// The four brand colors every page shares, under the names pages already use.
export const coreColors = {
  red: core.red,
  darkBlue: core.blue,
  lightBlue: core.lightBlue,
  green: core.green,
  // Validation and failure states. Not the brand red.
  error: tokens.status.error,
}

export default tokens
