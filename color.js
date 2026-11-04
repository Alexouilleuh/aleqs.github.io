// ---------------------------------------------------------------------
// couleurs aléatoires : source unique pour tout le site
// ---------------------------------------------------------------------
// à charger AVANT le script de chaque page (script.js, projets.js, infos.js).
// getRandomPaleColor() est utilisée par :
//   - l'atlas (index.html)  : tracé de la souris, flèches, surlignage de la sélection
//   - l'index (projets.html) : fond des lignes de projet au survol
//   - infos (infos.html)     : mots-liens colorés

let randomColorsEnabled = true;

function getRandomPaleColor() {
  if (!randomColorsEnabled) return "#ffffff"; // couleurs aléatoires désactivées
  const h = Math.floor(Math.random() * 360);
  const s = 100;
  const l = 80 + Math.floor(Math.random() * 10);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function setRandomColors(enabled) {
  randomColorsEnabled = enabled;
}

setRandomColors(false); // ← décommente : toutes les couleurs aléatoires du site passent en blanc

// ---------------------------------------------------------------------
// mode d'affichage : mobile (liste empilée) ou desktop (atlas)
// ---------------------------------------------------------------------
// source unique pour tous les scripts. DOIT rester identique à l'en-tête du bloc
// MOBILE de shared.css :  @media (max-width: 768px), (hover: none) and (pointer: coarse) and (max-width: 1400px)
//   - fenêtre étroite (<= 768px)  -> mobile, comme avant ;
//   - OU appareil tactile (doigt = pointeur principal, pas de survol) jusqu'à
//     1400px de large : toutes les tablettes, iPad Pro 13" compris (1376px en
//     paysage). Une largeur seule ne suffit pas : un iPad Pro est aussi large
//     qu'un petit ordinateur portable.
// un ordinateur (souris) garde l'atlas dès qu'il dépasse 768px.
const MOBILE_LAYOUT_QUERY =
  "(max-width: 768px), (hover: none) and (pointer: coarse) and (max-width: 1400px)";

// appareil tactile (même sur grand écran) : pas de survol possible
const TOUCH_DEVICE_QUERY = "(hover: none) and (pointer: coarse)";

function isMobileLayout() {
  return window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
}