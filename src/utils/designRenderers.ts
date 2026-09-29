/**
 * Design renderers — real, client-side canvas generators for the Text,
 * Monogram and Badge/Logo quick-create modules. Each function actually
 * draws the user's chosen text/letters/shape/colors onto an offscreen
 * canvas and returns a PNG data URL. That data URL is then treated exactly
 * like an "uploaded artwork" and handed to the very same Auto Digitize
 * pipeline (real color analysis -> editable settings -> genuinely stitched
 * preview -> simulator -> download), so none of these modules are demo/
 * cosmetic — they produce a real image that downstream stages really
 * analyze and re-render.
 */

const isWeb = typeof document !== 'undefined';

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!isWeb) throw new Error('Design rendering requires a browser environment.');
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, w, h);
  return { canvas, ctx };
}

/** Shrinks a font size until `text` fits within `maxWidth` (never below `minPx`). */
function fitFontPx(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  buildFont: (px: number) => string,
  startPx: number,
  minPx = 12
): number {
  let px = startPx;
  ctx.font = buildFont(px);
  while (px > minPx && ctx.measureText(text).width > maxWidth) {
    px -= 2;
    ctx.font = buildFont(px);
  }
  return px;
}

/**
 * Draws `text` along a circular arc. `topArc` places it above the circle's
 * center reading left-to-right along the top (a "smile"/dome curve);
 * otherwise it sits along the bottom, upright and readable (a "frown"
 * curve), which together are the standard badge/patch top-text +
 * bottom-text convention.
 */
function drawArcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  font: string,
  color: string,
  topArc: boolean,
  maxSpanRad = Math.PI * 0.72
) {
  if (!text) return;
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';

  // total angular width of the string at this font size
  let totalWidth = 0;
  for (const ch of text) totalWidth += ctx.measureText(ch).width;
  const totalAngle = Math.min(maxSpanRad, totalWidth / radius);

  ctx.translate(cx, cy);
  ctx.textBaseline = topArc ? 'bottom' : 'top';

  // Top arc: sweep rotation from -totalAngle/2 -> +totalAngle/2 as characters
  // progress, drawing each glyph "up and out" at (0, -radius) — this keeps
  // left-to-right reading order and upright, outward-leaning glyphs.
  // Bottom arc needs the mirror-image transform (not simply the same sweep
  // flipped 180°, which draws every glyph upside-down and reversed): sweep
  // the *opposite* rotation direction (+totalAngle/2 -> -totalAngle/2) and
  // draw at (0, +radius), so glyphs stay upright/readable left-to-right and
  // lean outward away from the circle's center, matching real badge text.
  const sign = topArc ? 1 : -1;
  ctx.rotate(-sign * (totalAngle / 2));

  for (const ch of text) {
    const chWidth = ctx.measureText(ch).width;
    const chAngle = (chWidth / totalWidth) * totalAngle || 0;
    ctx.rotate(sign * (chAngle / 2));
    ctx.fillText(ch, 0, topArc ? -radius : radius);
    ctx.rotate(sign * (chAngle / 2));
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Text module
// ---------------------------------------------------------------------------

export type TextFontStyle = 'Modern Sans' | 'Bold Block' | 'Classic Serif' | 'Script' | 'Varsity';
export type TextLayout = 'Straight' | 'Arc Up' | 'Arc Down';

const TEXT_FONT_BUILDERS: Record<TextFontStyle, (px: number) => string> = {
  'Modern Sans': (px) => `700 ${px}px Inter_700Bold, Arial, sans-serif`,
  'Bold Block': (px) => `900 ${px}px Impact, 'Arial Black', sans-serif`,
  'Classic Serif': (px) => `700 ${px}px Georgia, 'Times New Roman', serif`,
  Script: (px) => `italic 600 ${px}px 'Brush Script MT', 'Segoe Script', cursive`,
  Varsity: (px) => `900 ${px}px 'Arial Black', Impact, sans-serif`,
};

export interface TextArtworkOptions {
  text: string;
  font: TextFontStyle;
  layout: TextLayout;
  color: string;
  outlineColor?: string | null;
  width?: number;
  height?: number;
}

export async function renderTextArtwork(opts: TextArtworkOptions): Promise<string> {
  const width = opts.width ?? 640;
  const height = opts.height ?? 340;
  const { canvas, ctx } = makeCanvas(width, height);
  const text = (opts.text || 'YOUR TEXT').trim() || 'YOUR TEXT';
  const buildFont = TEXT_FONT_BUILDERS[opts.font] ?? TEXT_FONT_BUILDERS['Modern Sans'];
  const maxWidth = width * 0.82;

  const applyStroke = () => {
    if (opts.outlineColor) {
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = opts.outlineColor;
    }
  };

  if (opts.layout === 'Straight') {
    // Varsity gets extra letter-spacing to read distinctly from Bold Block.
    const letterSpacing = opts.font === 'Varsity' ? 0.12 : 0;
    let px = fitFontPx(ctx, text, letterSpacing ? maxWidth * 0.86 : maxWidth, buildFont, height * 0.42);
    ctx.font = buildFont(px);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, px * 0.05);

    if (letterSpacing > 0) {
      // manual letter-spacing: measure total width including gaps, then draw char by char
      const gap = px * letterSpacing;
      let total = 0;
      const widths = [...text].map((ch) => {
        const w = ctx.measureText(ch).width;
        total += w + gap;
        return w;
      });
      total -= gap;
      let x = width / 2 - total / 2;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const w = widths[i];
        const cxp = x + w / 2;
        applyStroke();
        if (opts.outlineColor) ctx.strokeText(ch, cxp, height / 2);
        ctx.fillStyle = opts.color;
        ctx.fillText(ch, cxp, height / 2);
        x += w + gap;
      }
    } else {
      applyStroke();
      if (opts.outlineColor) ctx.strokeText(text, width / 2, height / 2);
      ctx.fillStyle = opts.color;
      ctx.fillText(text, width / 2, height / 2);
    }
  } else {
    const topArc = opts.layout === 'Arc Up';
    // Same radius both directions for a consistent curve — the circle
    // center simply mirrors vertically (near the bottom of the canvas for
    // "Arc Up" so the dome sits in the upper portion; near the top for
    // "Arc Down" so the arc sits in the lower portion), keeping glyphs
    // comfortably within the canvas either way.
    const radius = height * 0.62;
    const cy = topArc ? height * 0.72 : height * 0.28;
    let px = height * 0.32;
    ctx.font = buildFont(px);
    // shrink until the arc's angular span is reasonable for the canvas
    while (px > 14) {
      let w = 0;
      for (const ch of text) w += ctx.measureText(ch).width;
      if (w / radius < Math.PI * 0.78) break;
      px -= 2;
      ctx.font = buildFont(px);
    }
    if (opts.outlineColor) {
      ctx.save();
      ctx.strokeStyle = opts.outlineColor;
      ctx.lineWidth = Math.max(2, px * 0.05);
      drawArcTextStroke(ctx, text, width / 2, cy, radius, buildFont(px), topArc);
      ctx.restore();
    }
    drawArcText(ctx, text, width / 2, cy, radius, buildFont(px), opts.color, topArc);
  }

  return canvas.toDataURL('image/png');
}

// stroke variant of drawArcText (kept separate to avoid branching fill/stroke mid-loop)
function drawArcTextStroke(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  font: string,
  topArc: boolean
) {
  if (!text) return;
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  let totalWidth = 0;
  for (const ch of text) totalWidth += ctx.measureText(ch).width;
  const totalAngle = Math.min(Math.PI * 0.78, totalWidth / radius);
  ctx.translate(cx, cy);
  ctx.textBaseline = topArc ? 'bottom' : 'top';
  // Mirrors the fill variant's fixed sweep direction — see drawArcText above.
  const sign = topArc ? 1 : -1;
  ctx.rotate(-sign * (totalAngle / 2));
  for (const ch of text) {
    const chWidth = ctx.measureText(ch).width;
    const chAngle = (chWidth / totalWidth) * totalAngle || 0;
    ctx.rotate(sign * (chAngle / 2));
    ctx.strokeText(ch, 0, topArc ? -radius : radius);
    ctx.rotate(sign * (chAngle / 2));
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Monogram module
// ---------------------------------------------------------------------------

export type MonogramStyle = 'Classic Interlocking' | 'Circle Frame' | 'Diamond Frame' | 'Stacked Block';

export interface MonogramArtworkOptions {
  letters: string;
  style: MonogramStyle;
  primaryColor: string;
  accentColor: string;
  size?: number;
}

export async function renderMonogramArtwork(opts: MonogramArtworkOptions): Promise<string> {
  const size = opts.size ?? 480;
  const { canvas, ctx } = makeCanvas(size, size);
  const letters = (opts.letters || 'AZ')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3) || 'AZ';
  const cx = size / 2;
  const cy = size / 2;

  const serif = (px: number) => `700 ${px}px Georgia, 'Times New Roman', serif`;
  const bold = (px: number) => `800 ${px}px Inter_700Bold, Arial, sans-serif`;

  if (opts.style === 'Circle Frame' || opts.style === 'Diamond Frame') {
    const inset = size * 0.08;
    ctx.lineWidth = size * 0.035;
    ctx.strokeStyle = opts.accentColor;
    if (opts.style === 'Circle Frame') {
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2 - inset, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const r = size / 2 - inset;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.stroke();
    }
    const maxWidth = size * 0.62;
    const px = fitFontPx(ctx, letters, maxWidth, bold, size * 0.34);
    ctx.font = bold(px);
    ctx.fillStyle = opts.primaryColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letters, cx, cy + px * 0.04);
  } else if (opts.style === 'Stacked Block') {
    const rows = letters.split('');
    const rowH = size / (rows.length + 0.6);
    const px = Math.min(rowH * 0.8, size * 0.3);
    ctx.font = bold(px);
    ctx.fillStyle = opts.primaryColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const startY = cy - ((rows.length - 1) * rowH) / 2;
    rows.forEach((ch, i) => {
      ctx.fillText(ch, cx, startY + i * rowH);
    });
    if (rows.length > 1) {
      ctx.strokeStyle = opts.accentColor;
      ctx.lineWidth = size * 0.012;
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.28, cy + ((rows.length - 1) * rowH) / 2 + rowH * 0.55);
      ctx.lineTo(cx + size * 0.28, cy + ((rows.length - 1) * rowH) / 2 + rowH * 0.55);
      ctx.stroke();
    }
  } else {
    // Classic Interlocking: small-BIG-small serif triad, a timeless monogram look
    const chars = letters.length === 3 ? letters.split('') : letters.length === 2 ? [letters[0], letters[1], ''] : [letters, '', ''];
    const [a, b, c] = chars;
    const bigPx = size * 0.46;
    const smallPx = size * 0.28;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = opts.primaryColor;

    ctx.font = serif(bigPx);
    const bWidth = b ? ctx.measureText(b).width : 0;
    ctx.font = serif(smallPx);
    const aWidth = a ? ctx.measureText(a).width : 0;
    const cWidth = c ? ctx.measureText(c).width : 0;
    const gap = size * 0.02;
    const totalWidth = aWidth + bWidth + cWidth + gap * ((a ? 1 : 0) + (c ? 1 : 0));
    let x = cx - totalWidth / 2;
    const baseline = cy + bigPx * 0.32;

    if (a) {
      ctx.font = serif(smallPx);
      ctx.textAlign = 'left';
      ctx.fillText(a, x, baseline);
      x += aWidth + gap;
    }
    if (b) {
      ctx.font = serif(bigPx);
      ctx.textAlign = 'left';
      ctx.fillText(b, x, baseline + bigPx * 0.02);
      // flourish underline beneath the big center letter
      ctx.strokeStyle = opts.accentColor;
      ctx.lineWidth = size * 0.012;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.02, baseline + bigPx * 0.14);
      ctx.lineTo(x + bWidth + size * 0.02, baseline + bigPx * 0.14);
      ctx.stroke();
      x += bWidth + gap;
    }
    if (c) {
      ctx.font = serif(smallPx);
      ctx.textAlign = 'left';
      ctx.fillText(c, x, baseline);
    }
  }

  return canvas.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// Badge / Logo module
// ---------------------------------------------------------------------------

export type BadgeShape = 'Circle' | 'Shield' | 'Oval' | 'Rectangle';
export type BadgeEmblem = 'Star' | 'Shield' | 'Wreath' | 'Crown' | 'Diamond' | 'None';

export interface BadgeArtworkOptions {
  shape: BadgeShape;
  topText: string;
  bottomText: string;
  emblem: BadgeEmblem;
  backgroundColor: string;
  accentColor: string;
  size?: number;
}

function traceBadgeShape(ctx: CanvasRenderingContext2D, shape: BadgeShape, cx: number, cy: number, size: number) {
  const r = size / 2;
  ctx.beginPath();
  if (shape === 'Circle') {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else if (shape === 'Oval') {
    ctx.ellipse(cx, cy, r, r * 0.72, 0, 0, Math.PI * 2);
  } else if (shape === 'Rectangle') {
    const rad = size * 0.08;
    const x = cx - r;
    const y = cy - r * 0.76;
    const w = r * 2;
    const h = r * 1.52;
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
  } else {
    // Shield: rounded top, pointed bottom
    const x = cx - r;
    const y = cy - r;
    const w = r * 2;
    const h = r * 2;
    ctx.moveTo(x, y + h * 0.18);
    ctx.quadraticCurveTo(x, y, x + w * 0.18, y);
    ctx.lineTo(x + w * 0.82, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + h * 0.18);
    ctx.lineTo(x + w, y + h * 0.55);
    ctx.quadraticCurveTo(x + w, y + h * 0.85, cx, y + h);
    ctx.quadraticCurveTo(x, y + h * 0.85, x, y + h * 0.55);
    ctx.closePath();
  }
  ctx.closePath();
}

function drawEmblem(ctx: CanvasRenderingContext2D, emblem: BadgeEmblem, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.1);
  if (emblem === 'Star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.42;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const x = cx + rad * Math.cos(angle);
      const y = cy + rad * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else if (emblem === 'Diamond') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.72, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r * 0.72, cy);
    ctx.closePath();
    ctx.fill();
  } else if (emblem === 'Shield') {
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r * 0.7);
    ctx.lineTo(cx + r, cy - r * 0.7);
    ctx.lineTo(cx + r, cy + r * 0.1);
    ctx.quadraticCurveTo(cx + r, cy + r * 0.75, cx, cy + r);
    ctx.quadraticCurveTo(cx - r, cy + r * 0.75, cx - r, cy + r * 0.1);
    ctx.closePath();
    ctx.fill();
  } else if (emblem === 'Crown') {
    // classic 3-point coronet: left/center/right peaks with valleys between,
    // a base band, and a jewel dot on each peak tip.
    const baseY = cy + r * 0.5;
    const leftPeak = { x: cx - r, y: cy - r * 0.25 };
    const leftValley = { x: cx - r * 0.5, y: cy + r * 0.1 };
    const centerPeak = { x: cx, y: cy - r * 0.85 };
    const rightValley = { x: cx + r * 0.5, y: cy + r * 0.1 };
    const rightPeak = { x: cx + r, y: cy - r * 0.25 };

    ctx.beginPath();
    ctx.moveTo(cx - r, baseY);
    ctx.lineTo(leftPeak.x, leftPeak.y);
    ctx.lineTo(leftValley.x, leftValley.y);
    ctx.lineTo(centerPeak.x, centerPeak.y);
    ctx.lineTo(rightValley.x, rightValley.y);
    ctx.lineTo(rightPeak.x, rightPeak.y);
    ctx.lineTo(cx + r, baseY);
    ctx.closePath();
    ctx.fill();
    // base band
    ctx.fillRect(cx - r, baseY, r * 2, r * 0.12);
    // jewel dot atop each peak
    [leftPeak, centerPeak, rightPeak].forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (emblem === 'Wreath') {
    // two simple laurel sprigs curving up on either side. Leaves are placed
    // directly on the same quadratic bezier as the stem (rather than a
    // separately-interpolated straight line) so they track the visible
    // curve instead of drifting away from it, and each leaf's angle follows
    // the curve's tangent so it reads as growing out of the stem.
    for (const side of [-1, 1]) {
      const p0 = { x: cx + side * r * 0.15, y: cy + r * 0.9 };
      const p1 = { x: cx + side * r * 1.1, y: cy + r * 0.3 };
      const p2 = { x: cx + side * r * 0.55, y: cy - r * 0.7 };
      const bezierPoint = (t: number) => ({
        x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x,
        y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y,
      });
      const bezierTangentAngle = (t: number) => {
        const dx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
        const dy = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
        return Math.atan2(dy, dx);
      };

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.stroke();

      for (let t = 0.15; t < 0.95; t += 0.16) {
        const { x: bx, y: by } = bezierPoint(t);
        const tangent = bezierTangentAngle(t);
        // offset each leaf outward, perpendicular to the stem, then angle
        // it forward (outward + slightly ahead) along the curve's tangent
        const normalAngle = tangent + side * (Math.PI / 2);
        const leafX = bx + Math.cos(normalAngle) * r * 0.16;
        const leafY = by + Math.sin(normalAngle) * r * 0.16;
        ctx.beginPath();
        ctx.ellipse(leafX, leafY, r * 0.15, r * 0.075, tangent + side * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

export async function renderBadgeArtwork(opts: BadgeArtworkOptions): Promise<string> {
  const size = opts.size ?? 480;
  const pad = size * 0.06;
  const { canvas, ctx } = makeCanvas(size, size);
  const cx = size / 2;
  const cy = size / 2;
  const shapeSize = size - pad * 2;

  // background fill + border
  traceBadgeShape(ctx, opts.shape, cx, cy, shapeSize);
  ctx.fillStyle = opts.backgroundColor;
  ctx.fill();
  ctx.lineWidth = size * 0.028;
  ctx.strokeStyle = opts.accentColor;
  ctx.stroke();

  // inner hairline for a classic patch look
  ctx.save();
  traceBadgeShape(ctx, opts.shape, cx, cy, shapeSize - size * 0.05);
  ctx.lineWidth = size * 0.008;
  ctx.strokeStyle = opts.accentColor;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.restore();

  // Top/bottom arc text is always laid out on a circular arc, but non-circular
  // shapes (Oval, Rectangle) are shorter top-to-bottom than they are wide —
  // sizing the arc radius off shapeSize/2 (a circle's radius) lets text spill
  // outside those shapes' actual vertical extent. Clamp the radius to each
  // shape's real half-height instead, so the text always stays inside.
  const shapeVerticalHalfExtent =
    opts.shape === 'Oval' ? (shapeSize / 2) * 0.72 : opts.shape === 'Rectangle' ? (shapeSize / 2) * 0.76 : shapeSize / 2;
  const innerR = shapeVerticalHalfExtent - size * 0.1;
  const textColor = opts.accentColor;
  const font = (px: number) => `700 ${px}px Inter_700Bold, Arial, sans-serif`;

  if (opts.topText) {
    let px = size * 0.09;
    ctx.font = font(px);
    while (px > 12) {
      let w = 0;
      for (const ch of opts.topText.toUpperCase()) w += ctx.measureText(ch).width;
      if (w / (innerR * 0.98) < Math.PI * 0.85) break;
      px -= 2;
      ctx.font = font(px);
    }
    drawArcText(ctx, opts.topText.toUpperCase(), cx, cy, innerR * 0.98, font(px), textColor, true, Math.PI * 0.85);
  }
  if (opts.bottomText) {
    let px = size * 0.08;
    ctx.font = font(px);
    while (px > 12) {
      let w = 0;
      for (const ch of opts.bottomText.toUpperCase()) w += ctx.measureText(ch).width;
      if (w / (innerR * 0.98) < Math.PI * 0.75) break;
      px -= 2;
      ctx.font = font(px);
    }
    drawArcText(ctx, opts.bottomText.toUpperCase(), cx, cy, innerR * 0.98, font(px), textColor, false, Math.PI * 0.75);
  }
  if (opts.emblem !== 'None') {
    drawEmblem(ctx, opts.emblem, cx, cy, innerR * 0.42, textColor);
  }

  return canvas.toDataURL('image/png');
}
