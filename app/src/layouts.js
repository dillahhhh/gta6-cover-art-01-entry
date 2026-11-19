// Eight multi-panel compositions. Every layout is a different arrangement of
// panels, not a recolour: different panel counts, shapes, angles and text
// zones. Rects are fractions of the cover; a panel may carry a `poly` (a
// diagonal cut, fractions) or a `rot` (degrees, tilted like a pasted photo).
export const LAYOUTS = [
  {
    id: 'sunset',
    name: 'Vice City Sunset',
    blurb: 'Big hero on top, three strips below',
    bg: '#12081f',
    gap: 0.008,
    panels: [
      { x: 0, y: 0, w: 1, h: 0.6 },
      { x: 0, y: 0.6, w: 1 / 3, h: 0.4 },
      { x: 1 / 3, y: 0.6, w: 1 / 3, h: 0.4 },
      { x: 2 / 3, y: 0.6, w: 1 / 3, h: 0.4 },
    ],
    text: { headline: { x: 0.5, y: 0.5 }, subtitle: { x: 0.5, y: 0.575 } },
  },
  {
    id: 'neon-noir',
    name: 'Neon Noir',
    blurb: 'Tall side panel, two stacked smalls',
    bg: '#05030c',
    gap: 0.008,
    panels: [
      { x: 0, y: 0, w: 0.46, h: 1 },
      { x: 0.46, y: 0, w: 0.54, h: 0.5 },
      { x: 0.46, y: 0.5, w: 0.54, h: 0.5 },
    ],
    text: { headline: { x: 0.23, y: 0.88 }, subtitle: { x: 0.23, y: 0.8 } },
  },
  {
    id: 'miami-luxury',
    name: 'Miami Luxury',
    blurb: 'Clean four-grid over a wide banner',
    bg: '#0e1a2e',
    gap: 0.01,
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.32 },
      { x: 0.5, y: 0, w: 0.5, h: 0.32 },
      { x: 0, y: 0.32, w: 0.5, h: 0.32 },
      { x: 0.5, y: 0.32, w: 0.5, h: 0.32 },
    ],
    band: { x: 0, y: 0.64, w: 1, h: 0.36, color: '#0e1a2e', rule: '#ffd166' },
    text: { headline: { x: 0.5, y: 0.79 }, subtitle: { x: 0.5, y: 0.885 } },
  },
  {
    id: 'cinematic-collage',
    name: 'Cinematic Collage',
    blurb: 'Overlapping tilted prints, poster feel',
    bg: '#0b0714',
    gap: 0,
    panels: [
      { x: 0.04, y: 0.04, w: 0.56, h: 0.54, rot: -4, frame: 'polaroid' },
      { x: 0.46, y: 0.06, w: 0.52, h: 0.5, rot: 3, frame: 'polaroid' },
      { x: 0.2, y: 0.5, w: 0.6, h: 0.36, rot: -2, frame: 'polaroid' },
    ],
    text: { headline: { x: 0.5, y: 0.905 }, subtitle: { x: 0.5, y: 0.973 } },
  },
  {
    id: 'diagonal-heist',
    name: 'Diagonal Heist',
    blurb: 'Two panels split on a diagonal',
    bg: '#0d0518',
    gap: 0,
    panels: [
      { x: 0, y: 0, w: 1, h: 1, poly: [[0, 0], [1, 0], [0.32, 1], [0, 1]] },
      { x: 0, y: 0, w: 1, h: 1, poly: [[1, 0], [1, 1], [0.32, 1]] },
    ],
    text: { headline: { x: 0.5, y: 0.86 }, subtitle: { x: 0.5, y: 0.94 } },
  },
  {
    id: 'portrait-duo',
    name: 'Portrait Duo',
    blurb: 'Two tall portraits over a caption band',
    bg: '#12081f',
    gap: 0.008,
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.82 },
      { x: 0.5, y: 0, w: 0.5, h: 0.82 },
    ],
    band: { x: 0, y: 0.82, w: 1, h: 0.18, color: '#12081f', rule: '#ff2e88' },
    text: { headline: { x: 0.5, y: 0.885 }, subtitle: { x: 0.5, y: 0.96 } },
  },
  {
    id: 'sunset-strip',
    name: 'Sunset Strip',
    blurb: 'Film strips top and bottom, hero in the middle',
    bg: '#160a24',
    gap: 0.006,
    panels: [
      { x: 0, y: 0, w: 1 / 3, h: 0.22 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 0.22 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 0.22 },
      { x: 0, y: 0.24, w: 1, h: 0.52 },
      { x: 0, y: 0.78, w: 1 / 3, h: 0.22 },
      { x: 1 / 3, y: 0.78, w: 1 / 3, h: 0.22 },
      { x: 2 / 3, y: 0.78, w: 1 / 3, h: 0.22 },
    ],
    text: { headline: { x: 0.5, y: 0.66 }, subtitle: { x: 0.5, y: 0.735 } },
  },
  {
    id: 'vice-grid',
    name: 'Vice Grid',
    blurb: 'Asymmetric mosaic: big, smalls, wide base',
    bg: '#0a0616',
    gap: 0.008,
    panels: [
      { x: 0, y: 0, w: 0.58, h: 0.62 },
      { x: 0.58, y: 0, w: 0.42, h: 0.3 },
      { x: 0.58, y: 0.3, w: 0.42, h: 0.32 },
      { x: 0, y: 0.62, w: 1, h: 0.38 },
    ],
    text: { headline: { x: 0.5, y: 0.74 }, subtitle: { x: 0.5, y: 0.84 } },
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}
