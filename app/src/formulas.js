// Poster formulas: curated combinations of layout + treatment + lettering +
// grade, one button press each. These are named picks, not random sliders:
// each one draws from one of the four visual directions (A painterly crime
// poster, B 3D lettering poster, C neon noir collage, D airbrushed retro)
// and is tuned so the parts agree with each other. "Surprise Me" picks one
// of these five — never a random grab-bag of settings.
import { layoutById } from './layouts.js';

export const FORMULAS = [
  {
    id: 'ink-heist',
    name: 'Ink Heist',
    direction: 'A · Painterly crime poster',
    layout: 'diagonal-heist',
    grade: 'cinematic',
    treatment: 'ink',
    strength: 0.85,
    lettering: 'extrude',
    headlineFont: 'Anton',
    headlineColor: '#ffffff',
    subtitleColor: '#ffd166',
    sunset: 0.3,
    neon: 0.35,
    grain: 0.6,
    vignette: 0.65,
  },
  {
    id: 'neon-noir',
    name: 'Neon Noir Collage',
    direction: 'C · Neon noir collage',
    layout: 'cinematic-collage',
    grade: 'neon',
    treatment: 'painterly',
    strength: 0.75,
    lettering: 'neon-stack',
    headlineFont: 'Bebas Neue',
    headlineColor: '#e8fbff',
    subtitleColor: '#ffd166',
    sunset: 0.2,
    neon: 0.8,
    grain: 0.5,
    vignette: 0.6,
  },
  {
    id: 'sunset-pulp',
    name: 'Sunset Pulp',
    direction: 'A + B · Painterly poster, 3D title',
    layout: 'sunset',
    grade: 'sunset',
    treatment: 'painterly',
    strength: 0.7,
    lettering: 'slab',
    headlineFont: 'Anton',
    headlineColor: '#ffffff',
    subtitleColor: '#ffd166',
    sunset: 0.6,
    neon: 0.5,
    grain: 0.45,
    vignette: 0.55,
  },
  {
    id: 'retro-airbrush',
    name: 'Retro Airbrush',
    direction: 'D · Airbrushed retro',
    layout: 'miami-luxury',
    grade: 'miami',
    treatment: 'airbrush',
    strength: 0.55,
    lettering: 'neon-stack',
    headlineFont: 'Yellowtail',
    headlineColor: '#fff3d6',
    subtitleColor: '#ff7a3d',
    sunset: 0.5,
    neon: 0.3,
    grain: 0.25,
    vignette: 0.35,
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    direction: 'B · 3D lettering poster',
    layout: 'vice-grid',
    grade: 'cinematic',
    treatment: 'painterly',
    strength: 0.6,
    lettering: 'extrude',
    headlineFont: 'Anton',
    headlineColor: '#ffe9a8',
    subtitleColor: '#ff2e88',
    sunset: 0.7,
    neon: 0.4,
    grain: 0.4,
    vignette: 0.5,
  },
];

export function formulaById(id) {
  return FORMULAS.find((f) => f.id === id) || null;
}

/** Apply a formula to the state: layout, words, light and art, all at once.
 *  Text anchors follow the new layout, so the headline never lands on a
 *  panel edge it was not placed for. */
export function applyFormula(state, id) {
  const f = formulaById(id);
  if (!f) return null;
  const layout = layoutById(f.layout);
  state.layoutId = layout.id;
  state.selectedPanel = 0;
  state.headline.x = layout.text.headline.x;
  state.headline.y = layout.text.headline.y;
  state.subtitle.x = layout.text.subtitle.x;
  state.subtitle.y = layout.text.subtitle.y;
  state.headline.font = f.headlineFont;
  state.headline.color = f.headlineColor;
  state.subtitle.color = f.subtitleColor;
  state.fx.grade = f.grade;
  state.fx.sunset = f.sunset;
  state.fx.neon = f.neon;
  state.fx.grain = f.grain;
  state.fx.vignette = f.vignette;
  state.art.treatment = f.treatment;
  state.art.strength = f.strength;
  state.art.lettering = f.lettering;
  state.art.formula = f.id;
  return f;
}

/** A different formula than the current one, for Surprise Me. */
export function surpriseFormula(state) {
  const others = FORMULAS.filter((f) => f.id !== state.art.formula);
  const pick = others[Math.floor(Math.random() * others.length)];
  return applyFormula(state, pick.id);
}
