// Brand values for transactional emails, read from the same tokens file as
// the app (src/theme/tokens.json) so a brand change reaches email too.
// Email clients can't load web fonts reliably, so body type uses the 2026
// brand guide's own body face and fallback: Helvetica, then Arial.
import tokens from "../../../src/theme/tokens.json";

const SITE_URL = process.env.URL || "https://myprosource.netlify.app";

export const EMAIL = {
  font: "Helvetica, Arial, sans-serif",
  blue: tokens.core.blue,
  bluePale: tokens.core.bluePale,
  text: tokens.gray.gray900,
  body: tokens.gray.gray700,
  muted: tokens.gray.gray500,
  surface: tokens.gray.gray100,
  border: tokens.gray.gray200,
};

/** The logo as an absolutely-addressed image. Alt text covers clients that block images. */
export const emailLogo = ({ align = "left" } = {}) =>
  `<img src="${SITE_URL}/prosource-logo.png" width="150" height="40" alt="ProSource Wholesale" style="display: block; border: 0; height: 40px; width: 150px;${align === "center" ? " margin: 0 auto;" : ""}" />`;
