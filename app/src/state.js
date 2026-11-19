// The cover's whole state: photos, layout, per-panel crops, words and light.
// One object, plain data except the loaded images, so the renderer only reads
// this and the UI only writes it, then asks for a redraw.
//
// Every sample carries a `focus`: the fraction of the photo its subject sits
// on (faces, the car, the tower). The renderer centres the visible crop on
// that point instead of the photo's middle, so a wide or tall panel never
// slices a face or the hero subject off. Samples are image-model art or
// procedural scenes — no real people, no Rockstar artwork.
export const SAMPLE_PHOTOS = [
  { id: 'heist-duo', name: 'Heist Duo', file: 'heist-duo.jpg', focus: { x: 0.5, y: 0.22 } },
  { id: 'getaway', name: 'Getaway', file: 'getaway.jpg', focus: { x: 0.5, y: 0.5 } },
  { id: 'hotel-night', name: 'Hotel Night', file: 'hotel-night.jpg', focus: { x: 0.55, y: 0.45 } },
  { id: 'beach-night', name: 'Beach Night', file: 'beach-night.jpg', focus: { x: 0.45, y: 0.6 } },
  { id: 'neon-street', name: 'Neon Street', file: 'neon-street.jpg', focus: { x: 0.5, y: 0.45 } },
  { id: 'palm-beach', name: 'Palm Beach', file: 'palm-beach.jpg', focus: { x: 0.5, y: 0.45 } },
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

/** A fresh cover state: the heist crew everywhere, sunset layout, warm grade. */
export function createState() {
  return {
    photos: [],
    layoutId: 'sunset',
    // One crop per panel index: which photo, zoom (>= 1) and pan offsets (-1..1).
    crops: [],
    selectedPanel: 0,
    sizeId: 'square',
    headline: {
      text: 'SUNSET HEIST',
      font: 'Anton',
      size: 100,
      color: '#ffffff',
      glow: true,
      outline: true,
      x: 0.5,
      y: 0.5,
    },
    subtitle: {
      text: 'VICE CITY · TONIGHT',
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
