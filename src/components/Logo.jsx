// ProSource Wholesale secondary logo (with descriptor). Per the 2026 brand
// guide: never stretch, recolor, or redraw it, and keep clear space around it
// roughly the width of the "u" in Source. Size it by height only.
// TODO: swap the PNG for the official SVG from National Marketing so it stays
// sharp on high-density screens.
export default function Logo({ height = 32, style }) {
  return (
    <img
      src="/prosource-logo.png"
      alt="ProSource Wholesale"
      height={height}
      style={{ height, width: 'auto', display: 'block', ...style }}
    />
  )
}
