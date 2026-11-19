// The cover's whole state: photos, layout, per-panel crops, words and light.
// One object, plain data except the loaded images, so the renderer only reads
// this and the UI only writes it, then asks for a redraw.
export const SAMPLE_PHOTOS = [
  { id: 'pier', name: 'Pier', file: 'pier.jpg' },
  { id: 'boulevard', name: 'Boulevard', file: 'boulevard.jpg' },
  { id: 'neon-street', name: 'Neon Street', file: 'neon-street.jpg' },
  { id: 'palm-beach', name: 'Palm Beach', file: 'palm-beach.jpg' },
];

export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
};

export const GRADES = {
  sunset: 'saturate(1.35) contrast(1.06) brightness(1.03) sepia(0.18) hue-rotate(-12deg)',
  neon: 'saturate(1.6) contrast(1.12) brightness(1.05) hue-rotate(8deg)',
  noir: 'grayscale(1) contrast(1.25) brightness(0.95)',
  miami: 'saturate(1.2) contrast(1.02) brightness(1.08) sepia(0.08) hue-rotate(-4deg)',
  cinematic: 'saturate(0.9) contrast(1.15) brightness(0.96) sepia(0.22)',
};

/** A fresh cover state: one photo everywhere, sunset layout, warm grade. */
export function createState() {
  return {
    photos: [],
    layoutId: 'sunset',
    // One crop per panel index: which photo, zoom (>= 1) and pan offsets (-1..1).
    crops: [],
    selectedPanel: 0,
    sizeId: 'square',
    headline: {
      text: 'VICE CITY',
      font: 'Anton',
      size: 100,
      color: '#ffffff',
      glow: true,
      outline: true,
      x: 0.5,
      y: 0.5,
    },
    subtitle: {
      text: 'Sunset heist · tonight',
      font: 'Bebas Neue',
      size: 48,
      color: '#ffd166',
      glow: false,
      outline: true,
      x: 0.5,
      y: 0.575,
    },
    fx: {
      grade: 'sunset',
      sunset: 0.6,
      neon: 0.5,
      grain: 0.35,
      vignette: 0.5,
    },
  };
}

/** The crop for a panel index, creating a default that shows the first photo. */
export function cropFor(state, index) {
  if (!state.crops[index]) state.crops[index] = { photoId: null, zoom: 1, ox: 0, oy: 0 };
  return state.crops[index];
}

/** The photo a panel shows: its own pick, else the first photo, else none. */
export function photoFor(state, index) {
  const crop = cropFor(state, index);
  const picked = state.photos.find((p) => p.id === crop.photoId);
  if (picked) return picked;
  return state.photos[0] || null;
}
