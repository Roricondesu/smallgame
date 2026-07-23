// SVG 图标库：Lucide 风格线条图标，用于替代 emoji

export type IconKey =
  | 'plus' | 'multiply' | 'divide' | 'power' | 'sage'
  | 'charge' | 'combo' | 'crit' | 'multi' | 'lucky'
  | 'rhythm' | 'speed' | 'autoCrit' | 'offline' | 'clock'
  | 'recycle' | 'gravity' | 'box' | 'coin' | 'critDmg'
  | 'tag' | 'pin' | 'ball' | 'wave' | 'chart'
  | 'discount' | 'frenzy' | 'snail' | 'double' | 'rain'
  | 'blast' | 'bolt' | 'menu' | 'close' | 'save'
  | 'home' | 'trash' | 'auto1' | 'auto2' | 'auto3'
  | 'smart' | 'matrix' | 'gold' | 'crystal' | 'chapter'
  | 'pegs' | 'skills' | 'prestige' | 'ending' | 'info';

const ICON_PATHS: Record<IconKey, string> = {
  plus: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
  multiply: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
  divide: '<line x1="5" y1="12" x2="19" y2="12"></line><circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none"></circle>',
  power: '<path d="M12 2v4"></path><path d="M12.5 21a9.5 9.5 0 1 1 0-19 9.5 9.5 0 0 1 0 19z" stroke-dasharray="2 2"></path>',
  sage: '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path>',
  charge: '<path d="M13 2L4.09 12.11a2 2 0 0 0 1.52 3.31H11L10 22l8.91-10.11a2 2 0 0 0-1.52-3.31H13z"></path>',
  combo: '<path d="M8 3v3a2 2 0 0 1-2 2H3"></path><path d="M16 3v3a2 2 0 0 0 2 2h3"></path><path d="M8 21v-3a2 2 0 0 0-2-2H3"></path><path d="M16 21v-3a2 2 0 0 1 2-2h3"></path>',
  crit: '<path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"></path>',
  multi: '<circle cx="8" cy="8" r="5"></circle><circle cx="16" cy="8" r="5"></circle><circle cx="8" cy="16" r="5"></circle><circle cx="16" cy="16" r="5"></circle>',
  lucky: '<path d="M12 2a5 5 0 0 0-5 5c0 2.5 2 5 5 8 3-3 5-5.5 5-8a5 5 0 0 0-5-5z"></path><path d="M12 22c-2-3-4-5-8-5"></path><path d="M12 22c2-3 4-5 8-5"></path>',
  rhythm: '<path d="M2 10v4"></path><path d="M6 6v12"></path><path d="M10 8v8"></path><path d="M14 4v16"></path><path d="M18 7v10"></path><path d="M22 9v6"></path>',
  speed: '<path d="M13 2L4.09 12.11a2 2 0 0 0 1.52 3.31H11L10 22l8.91-10.11a2 2 0 0 0-1.52-3.31H13z"></path>',
  autoCrit: '<path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"></path><circle cx="18" cy="6" r="2" fill="currentColor" stroke="none"></circle>',
  offline: '<path d="M12 2v4"></path><path d="M12 12l3-3"></path><circle cx="12" cy="12" r="10"></circle>',
  clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
  recycle: '<path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-2.77l1.44-2.49"></path><path d="M14.965 22.75l-2.483-1.443a1.83 1.83 0 0 1-.54-2.498l1.443-2.483"></path><path d="M16.03 5.25l2.483 1.443a1.83 1.83 0 0 1 .54 2.498l-1.443 2.483"></path><path d="M8.035 2.25l2.483 1.443a1.83 1.83 0 0 0 2.498-.54l1.443-2.483"></path>',
  gravity: '<path d="M12 3v14"></path><path d="M5 14l7 7 7-7"></path>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="M3.27 6.96L12 12.01l8.73-5.05"></path><path d="M12 22.08V12"></path>',
  coin: '<circle cx="12" cy="12" r="10"></circle><path d="M12 6v12"></path><path d="M15 9.5a3.5 3.5 0 0 0-3-1.5"></path><path d="M15 14.5a3.5 3.5 0 0 1-3 1.5"></path>',
  critDmg: '<path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"></path><path d="M12 12l6-6"></path><path d="M12 12l-6 6"></path>',
  tag: '<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"></path><circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none"></circle>',
  pin: '<line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14l-3.5-9-3.5 5-3.5-5L5 17z"></path>',
  ball: '<circle cx="12" cy="12" r="10"></circle><circle cx="8" cy="10" r="2" fill="currentColor" stroke="none"></circle><circle cx="16" cy="10" r="2" fill="currentColor" stroke="none"></circle><path d="M8 16c2 2 6 2 8 0"></path>',
  wave: '<path d="M2 12c2-4 5-4 7 0s5 4 7 0 5-4 7 0"></path>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>',
  discount: '<path d="M4.8 4.8l14.4 14.4"></path><circle cx="8" cy="8" r="2"></circle><circle cx="16" cy="16" r="2"></circle><path d="M3 21h18"></path>',
  frenzy: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-15 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>',
  snail: '<path d="M2 13a5 5 0 0 0 5 5h7a4 4 0 0 0 4-4.5V7a3.5 3.5 0 0 0-7 0v5.5"></path><path d="M8 15v2"></path><circle cx="14" cy="8" r="1" fill="currentColor" stroke="none"></circle>',
  double: '<circle cx="8" cy="8" r="5"></circle><circle cx="16" cy="8" r="5"></circle><circle cx="8" cy="16" r="5"></circle><circle cx="16" cy="16" r="5"></circle>',
  rain: '<path d="M20 16.2A4.5 4.5 0 0 0 3.2 14.2"></path><path d="M16 14v6"></path><path d="M8 14v6"></path><path d="M12 16v6"></path>',
  blast: '<path d="M4.9 16.1C1 12.3 2.3 6.3 7.1 4.1c2.6-1.1 5.7-.4 7.8 1.6l1.4 1.4"></path><path d="M19.1 7.9c3.9 3.8 2.6 9.8-2.2 12-2.6 1.1-5.7.4-7.8-1.6l-1.4-1.4"></path><path d="M9 12h6"></path><path d="M12 9v6"></path>',
  bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
  menu: '<line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="18" x2="20" y2="18"></line>',
  close: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
  trash: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>',
  auto1: '<rect x="6" y="4" width="12" height="16" rx="2"></rect><circle cx="12" cy="9" r="2"></circle><line x1="12" y1="13" x2="12" y2="17"></line>',
  auto2: '<rect x="6" y="4" width="12" height="16" rx="2"></rect><circle cx="12" cy="9" r="2"></circle><line x1="10" y1="14" x2="14" y2="14"></line><line x1="12" y1="12" x2="12" y2="17"></line>',
  auto3: '<rect x="6" y="4" width="12" height="16" rx="2"></rect><circle cx="12" cy="9" r="2"></circle><line x1="10" y1="13" x2="14" y2="17"></line><line x1="14" y1="13" x2="10" y2="17"></line>',
  smart: '<path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"></path><path d="M9 21h6"></path>',
  matrix: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line>',
  gold: '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6" fill="none" stroke-width="1.5"></circle><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"></circle>',
  crystal: '<path d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z"></path><path d="M12 22V12"></path><path d="M12 12L3.34 7"></path><path d="M12 12l8.66-5"></path>',
  chapter: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"></path>',
  pegs: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
  skills: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>',
  prestige: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"></path><path d="M3 3v9h9"></path>',
  ending: '<circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path>',
  info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
};

export function svgIcon(key: IconKey, size = 18, color = 'currentColor'): string {
  const path = ICON_PATHS[key] || ICON_PATHS.menu;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

export function operatorIcon(operator: string, size = 18, color = 'currentColor'): string {
  const map: Record<string, IconKey> = {
    '+': 'plus', '*': 'multiply', '/': 'divide', '^': 'power',
    '%': 'sage', addPercent: 'chart', maxMul: 'double',
  };
  return svgIcon(map[operator] || 'pin', size, color);
}
