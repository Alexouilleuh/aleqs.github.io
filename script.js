const container = document.getElementById("container");
const imageA = document.getElementById("hover-image-homepage-a");
const imageB = document.getElementById("hover-image-homepage-b");

let advanceTimer = null; // timer avant le média suivant (images uniquement)
let hideTimeout = null;
let currentHoverSpan = null;
let currentImageEl = imageA;
let nextImageEl = imageB;

const occupiedRects = [];

// même critère que le bloc MOBILE de shared.css (voir color.js : fenêtre étroite
// OU appareil tactile jusqu'aux grandes tablettes)
const isMobile = isMobileLayout();

// les couleurs aléatoires (getRandomPaleColor) viennent de color.js, chargé
// avant ce fichier : c'est là que se trouve l'interrupteur pour les passer en blanc

// la mise en page (positions aléatoires + canvas côté desktop, liste
// empilée côté mobile) n'est construite qu'une seule fois, au chargement,
// selon la largeur de la fenêtre à ce moment-là. Si on redimensionne la
// fenêtre au point de franchir ce seuil, l'affichage reste bloqué dans
// l'ancien mode. Plutôt que de tout reconstruire à la volée, on recharge
// simplement la page une fois le redimensionnement terminé.
let resizeReloadTimeout = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeReloadTimeout);
  resizeReloadTimeout = setTimeout(() => {
    const nowMobile = isMobileLayout();
    if (nowMobile !== isMobile) {
      location.reload();
    }
  }, 200);
});

// avoir navbar height pour la safe zone
function getNavbarHeight() {
  const navbar = document.getElementById('navbar');
  return navbar ? navbar.offsetHeight : 0;
}

// calculer les marges de la safezone
function getSafeZone() {
  const margin = 20; // safezone en px
  const navbarHeight = getNavbarHeight();
  
  // la navbar est fixée en haut de l'écran : aucun texte ne doit apparaître dessous
  return {
    top: Math.max(margin, navbarHeight),
    right: margin,
    bottom: margin,
    left: margin
  };
}

function isOverlapping(rect) {
  return occupiedRects.some(r => {
    return !(
      rect.right < r.left ||
      rect.left > r.right ||
      rect.bottom < r.top ||
      rect.top > r.bottom
    );
  });
}

// taille des images affichées au survol (atlas desktop)
const IMAGE_SIZE_RATIO = 0.4; // plus grand côté = 40% de la largeur de la fenêtre (avant : 45%)
const IMAGE_MARGIN = 20;      // px de marge à garder sous/au-dessus de la navbar

function normalizeImageSize(media, wrapper) {
  const maxSize = window.innerWidth * IMAGE_SIZE_RATIO;

  // L'image/vidéo est centrée verticalement : on préserve la safe zone
  // autour de la navbar et du compteur.
  const navbar = document.getElementById("navbar");
  const navbarHeight = navbar ? navbar.offsetHeight : 0;
  const maxHeight = window.innerHeight - 2 * (navbarHeight + IMAGE_MARGIN);

  // Les images utilisent naturalWidth/naturalHeight ;
  // les vidéos utilisent videoWidth/videoHeight.
  const mediaWidth = media.videoWidth || media.naturalWidth;
  const mediaHeight = media.videoHeight || media.naturalHeight;
  const ratio = mediaWidth && mediaHeight ? mediaWidth / mediaHeight : 1;

  let width, height;

  if (ratio >= 1) {
    width = maxSize;
    height = maxSize / ratio;
  } else {
    height = maxSize;
    width = maxSize * ratio;
  }

  if (height > maxHeight && maxHeight > 0) {
    const k = maxHeight / height;
    width *= k;
    height *= k;
  }

  wrapper.style.width = width + "px";
  wrapper.style.height = height + "px";
}

// ---------------------------------------------------------------------
// temps d'affichage
// ---------------------------------------------------------------------
// - image : reste affichée IMAGE_DELAY ms, puis on passe au média suivant
// - vidéo : PAS de timer. Elle est lue en entier, et on passe au média
//           suivant uniquement quand elle est terminée
//           (seule dans un projet, elle tourne en boucle)
const IMAGE_DELAY = 4000; // ms

// Détecte les vidéos (webm, mp4...), même si l'URL contient des paramètres.
function isVideo(src) {
  return /\.(webm|mp4|m4v|mov|ogv)(?:$|[?#])/i.test(src);
}

// "a.webp, b.webm," -> ["a.webp", "b.webm"] (ignore les entrées vides)
function parseMedia(str) {
  return (str || "").split(",").map(i => i.trim()).filter(Boolean);
}

// annule le timer en cours
function clearAdvance() {
  if (advanceTimer) {
    clearTimeout(advanceTimer);
    advanceTimer = null;
  }
}

// met en pause la vidéo d'un conteneur (sans la retirer)
function pauseMedia(wrapper) {
  const video = wrapper.querySelector("video");
  if (video) video.pause();
}

// Crée le bon élément HTML selon le type de média.
function createMedia(src) {
  let media;

  if (isVideo(src)) {
    media = document.createElement("video");
    media.muted = true;
    media.loop = true;
    media.autoplay = true;
    media.playsInline = true;
    media.preload = "auto";
  } else {
    media = document.createElement("img");
    media.alt = "";
  }

  return media;
}

// Vide un conteneur et arrête proprement une éventuelle vidéo.
function clearMedia(wrapper) {
  const video = wrapper.querySelector("video");

  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  wrapper.replaceChildren();
}

// Précharge les images et les vidéos.
document.querySelectorAll(".text-item").forEach(span => {
  // Sur desktop, les projets marqués .only-mobile ne sont pas affichés.
  if (!isMobile && span.classList.contains("only-mobile")) return;

  const images = (span.dataset.images || "")
    .split(",")
    .map(i => i.trim())
    .filter(Boolean);

  images.forEach(src => {
    if (isVideo(src)) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = src;
    } else {
      const img = new Image();
      img.src = src;
    }
  });
});

// version mobile : liste empilée titre/type + carrousel plein écran par projet
function buildMobileList() {
  document.body.classList.remove("no-scroll");

  const containerMobile = document.getElementById("container-mobile");
  const items = document.querySelectorAll(".text-item");

  items.forEach(span => {
    const images = span.dataset.images
      .split(",")
      .map(i => i.trim())
      .filter(Boolean);
    const year = span.dataset.year || "";
    const titleHTML = span.innerHTML.trim();

    const block = document.createElement("div");
    block.className = "mobile-project" + (images.length === 0 ? " no-image" : "");

    const header = document.createElement("div");
    header.className = "mobile-project-header";
    header.innerHTML = `<span class="mobile-project-main">
                        <span class="mobile-project-title">${titleHTML}</span> 
                        <span class="mobile-project-year">${year}</span>
                        </span>`;
    block.appendChild(header);

    if (images.length > 0) {
      const carousel = document.createElement("div");
      carousel.className = "mobile-carousel";

      // --- affichage SANS noir entre deux médias ---------------------------
      // Avant : à chaque changement, on vidait le carrousel puis on y mettait un
      // <img>/<video> tout neuf, pas encore chargé -> écran noir le temps du
      // chargement. Maintenant :
      //  1. les médias voisins (suivant / précédent) sont préparés à l'avance
      //     (image : chargée ET décodée ; vidéo : première image prête),
      //  2. on ne remplace le média affiché que quand le nouveau est prêt ;
      //     jusque-là, l'ancien reste à l'écran,
      //  3. un clic ou un swipe trop rapide n'empile rien : seul le dernier
      //     média demandé est affiché (showToken).
      const mediaEls = new Map();     // index -> élément <img>/<video>
      const mediaReady = new Map();   // index -> promesse résolue quand il est prêt
      let showToken = 0;
      let shownIndex = 0;

      function buildMedia(index) {
        const src = images[index];
        // pas de style en ligne ici : le recadrage carré 1:1 des images ET des
        // vidéos est défini dans shared.css (.mobile-carousel img, video)
        return createMedia(src);
      }

      // prépare le média n° index (sans l'afficher) et renvoie une promesse
      function prepareMedia(index) {
        if (mediaReady.has(index)) return mediaReady.get(index);

        const src = images[index];
        const media = buildMedia(index);
        mediaEls.set(index, media);

        const ready = new Promise((resolve) => {
          if (isVideo(src)) {
            let finished = false;
            const done = () => {
              if (finished) return;
              finished = true;
              clearTimeout(timer);
              media.removeEventListener("loadeddata", done);
              media.removeEventListener("error", done);
              // préparée en coulisses : on ne la laisse pas tourner dans le vide
              if (!media.isConnected) media.pause();
              resolve(media);
            };
            const timer = setTimeout(done, 6000); // garde-fou : ne jamais rester bloqué
            media.addEventListener("loadeddata", done);
            media.addEventListener("error", done);
            media.src = src;
          } else {
            media.src = src;
            (media.decode ? media.decode() : Promise.resolve())
              .catch(() => {}) // image introuvable : on n'empêche pas l'affichage
              .then(() => resolve(media));
          }
        });

        mediaReady.set(index, ready);
        return ready;
      }

      // libère les médias éloignés (surtout les vidéos) : on ne garde que
      // l'affiché et ses deux voisins
      function releaseFarMedia(index) {
        const n = images.length;
        const keep = new Set([index, (index + 1) % n, (index - 1 + n) % n]);
        [...mediaEls.keys()].forEach((i) => {
          if (keep.has(i)) return;
          const el = mediaEls.get(i);
          if (el.tagName === "VIDEO") {
            el.pause();
            el.removeAttribute("src");
            el.load();
          }
          mediaEls.delete(i);
          mediaReady.delete(i);
        });
      }

      function prepareNeighbors(index) {
        if (images.length < 2) return;
        prepareMedia((index + 1) % images.length);
        prepareMedia((index - 1 + images.length) % images.length);
      }

      // affiche le média n° index. immediate = true pour le tout premier :
      // il est posé tout de suite pour que le carrousel ait sa hauteur
      // (sinon la mise en page et les ancres de scroll sauteraient).
      function showMobileMedia(index, immediate) {
        const token = ++showToken;
        shownIndex = index;

        const swap = (media) => {
          if (token !== showToken) return; // une demande plus récente a pris le relais
          const old = carousel.firstElementChild;
          if (old && old !== media && old.tagName === "VIDEO") old.pause();

          carousel.replaceChildren(media);

          if (media.tagName === "VIDEO") {
            media.currentTime = 0;
            media.play().catch(() => {
              // Certains navigateurs peuvent refuser l'autoplay.
            });
          }

          releaseFarMedia(index);
          if (!immediate) prepareNeighbors(index);
        };

        const ready = prepareMedia(index);
        if (immediate) {
          swap(mediaEls.get(index));
        } else {
          ready.then(swap);
        }
      }

      showMobileMedia(0, true);
      block.appendChild(carousel);

      // quand le projet approche de l'écran, on prépare ses voisins (suivant /
      // précédent) : au premier clic, ils sont déjà prêts
      if (images.length > 1 && "IntersectionObserver" in window) {
        const io = new IntersectionObserver((entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          prepareNeighbors(shownIndex);
          io.disconnect();
        }, { rootMargin: "150% 0px" });
        io.observe(carousel);
      }

      if (images.length > 1) {
        let currentIndex = 0;
        let touchStartX = 0;
        let touchStartY = 0;
        let wasSwipe = false; // évite qu'un swipe déclenche aussi le clic qui suit
        const SWIPE_THRESHOLD = 40; // px minimum pour considérer que c'est un swipe

        function showNext() {
          currentIndex = (currentIndex + 1) % images.length;
          showMobileMedia(currentIndex);
        }

        function showPrev() {
          currentIndex = (currentIndex - 1 + images.length) % images.length;
          showMobileMedia(currentIndex);
        }

        carousel.addEventListener("touchstart", (e) => {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }, { passive: true });

        carousel.addEventListener("touchend", (e) => {
          const touchEndX = e.changedTouches[0].clientX;
          const touchEndY = e.changedTouches[0].clientY;
          const deltaX = touchEndX - touchStartX;
          const deltaY = touchEndY - touchStartY;

          // ignore si le geste est trop court ou plus vertical (scroll de la page)
          if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) return;

          wasSwipe = true;
          if (deltaX < 0) {
            showNext(); // swipe vers la gauche -> image suivante (boucle infinie)
          } else {
            showPrev(); // swipe vers la droite -> image précédente (boucle infinie)
          }
        }, { passive: true });

        // clic : moitié gauche -> média précédent, moitié droite -> média suivant
        // (même boucle infinie que le swipe)
        carousel.addEventListener("click", (e) => {
          if (wasSwipe) {
            // ce clic est celui généré automatiquement après le swipe tactile : on l'ignore
            wasSwipe = false;
            return;
          }
          const rect = carousel.getBoundingClientRect();
          if (e.clientX < rect.left + rect.width / 2) {
            showPrev();
          } else {
            showNext();
          }
        });
      }
    }

    containerMobile.appendChild(block);
  });

  containerMobile.style.visibility = "visible";

  // flèche "retour en haut" : invisible sur le 1er projet, elle apparaît dès qu'on
  // passe au 2e. C'est <body> qui défile sur mobile (voir shared.css).
  const scrollTopBtn = document.createElement("button");
  scrollTopBtn.id = "scroll-top";
  scrollTopBtn.type = "button";
  scrollTopBtn.setAttribute("aria-label", "Revenir en haut");
  scrollTopBtn.innerHTML =
    // viewBox = boîte exacte du tracé (trait compris) : la flèche touche donc les
    // bords de son cadre, sans vide autour -> alignement pixel-exact sur l'image
    '<svg viewBox="2.95 1.95 18.1 19.8" aria-hidden="true"><path d="M12 21V3M4 11l8-8 8 8"/></svg>';
  document.body.appendChild(scrollTopBtn);

  const updateScrollTop = () => {
    // le 1er projet occupe tout le 1er écran : dès qu'on a scrollé de plus de
    // la moitié de l'écran, on est sur le 2e projet ou plus loin
    const past = document.body.scrollTop > document.body.clientHeight / 2;
    scrollTopBtn.classList.toggle("visible", past);
  };
  document.body.addEventListener("scroll", updateScrollTop, { passive: true });
  updateScrollTop();

  scrollTopBtn.addEventListener("click", () => {
    document.body.scrollTo({ top: 0, behavior: "smooth" });
  });

  //  ??
  document.querySelectorAll("p").forEach(p => {
    p.innerHTML = p.innerHTML.replace(/ (\S+)$/, "&nbsp;$1");
  });
}

if (!isMobile) {

// compteur "1/3" au centre de la navbar : suit l'image affichée au survol.
// l'élément est créé ici ; il reprend la taille de texte des liens de la
// navbar (#navbar-right) pour rester cohérent si tu la modifies un jour.
const navbarCounter = (() => {
  const navbar = document.getElementById("navbar");
  if (!navbar) return null;

  const el = document.createElement("div");
  el.id = "navbar-counter";
  el.setAttribute("aria-hidden", "true");
  el.style.position = "absolute";
  el.style.left = "50%";
  el.style.top = "50%";
  el.style.transform = "translate(-50%, -50%)";
  el.style.whiteSpace = "nowrap";
  el.style.pointerEvents = "none";

  const navRight = document.getElementById("navbar-right");
  if (navRight) el.style.fontSize = getComputedStyle(navRight).fontSize;

  navbar.appendChild(el);
  return el;
})();

function setCounter(current, total) {
  if (navbarCounter) navbarCounter.textContent = `${current}/${total}`;
}

function clearCounter() {
  if (navbarCounter) navbarCounter.textContent = "";
}

document.querySelectorAll(".text-item").forEach(span => {
  // .only-mobile sur un .text-item = projet absent de l'atlas desktop
  // (il reste dans la liste mobile)
  if (span.classList.contains("only-mobile")) {
    span.style.display = "none";
    return;
  }

  span.style.visibility = "hidden";
  span.style.position = "absolute";
  span.style.top = "0";
  span.style.left = "0";
  document.body.appendChild(span);

  const spanWidth = span.offsetWidth;
  const spanHeight = span.offsetHeight;
  const safeZone = getSafeZone();
  
  // calcul des limites + safezone
  const maxLeft = window.innerWidth - spanWidth - safeZone.right;
  const maxTop = window.innerHeight - spanHeight - safeZone.bottom;
  const minLeft = safeZone.left;
  const minTop = safeZone.top;

  let left, top, rect;
  let tries = 0;
  const maxTries = 1000;

  do {
    // position aléatoire dans la zone
    left = minLeft + Math.random() * (maxLeft - minLeft);
    top = minTop + Math.random() * (maxTop - minTop);

    rect = {
      left: left,
      top: top,
      right: left + spanWidth,
      bottom: top + spanHeight
    };

    tries++;
    if (tries > maxTries) break;
  } while (isOverlapping(rect));

  occupiedRects.push(rect);

  span.style.left = `${left}px`;
  span.style.top = `${top}px`;
  span.style.visibility = "visible";

  container.appendChild(span);

  const images = parseMedia(span.dataset.images);
  let currentIndex = 0;

  // Identifiant de chargement : évite qu'un ancien média, chargé en retard,
  // remplace un média plus récent lors d'un changement rapide de projet.
  let mediaLoadToken = 0;

  // passe au média suivant (boucle sur la liste)
  function goNext() {
    if (currentHoverSpan !== span) return;
    currentIndex = (currentIndex + 1) % images.length;
    showImage(currentIndex);
  }

  // images : on attend IMAGE_DELAY puis on passe au média suivant
  function scheduleNext() {
    if (images.length > 1 && !advanceTimer) {
      advanceTimer = setTimeout(() => {
        advanceTimer = null;
        goNext();
      }, IMAGE_DELAY);
    }
  }

  function showImage(index) {
    const newSrc = images[index];
    if (!newSrc) return;

    const loadToken = ++mediaLoadToken;
    clearAdvance(); // annule le timer du média précédent

    // Le conteneur suivant est nettoyé avant de recevoir le nouveau média.
    clearMedia(nextImageEl);

    const video = isVideo(newSrc);
    const media = createMedia(newSrc);
    // une vidéo est lue en entier ; elle ne boucle que si elle est seule
    if (video) media.loop = images.length === 1;
    nextImageEl.appendChild(media);

    const stillCurrent = () => loadToken === mediaLoadToken && currentHoverSpan === span;

    const onReady = () => {
      // Ignore les chargements devenus obsolètes.
      if (!stillCurrent()) return;

      normalizeImageSize(media, nextImageEl);

      if (video) {
        media.play().catch(() => {
          // lecture refusée : on ne reste pas bloqué, on passe à la suite après le délai
          if (stillCurrent()) scheduleNext();
        });
      }

      nextImageEl.style.opacity = 1;
      currentImageEl.style.opacity = 0;

      const temp = currentImageEl;
      currentImageEl = nextImageEl;
      nextImageEl = temp;

      // l'ancien média (désormais caché) ne doit pas continuer à tourner
      pauseMedia(nextImageEl);

      // Le compteur change en même temps que le média.
      setCounter(index + 1, images.length);

      // image : timer de IMAGE_DELAY ; vidéo : aucun timer (voir onended)
      if (!video) scheduleNext();
    };

    media.onerror = () => {
      if (stillCurrent()) {
        clearMedia(nextImageEl);
        scheduleNext(); // fichier introuvable : on ne reste pas bloqué
      }
    };

    if (video) {
      // on passe à la suite uniquement QUAND LA VIDÉO EST TERMINÉE
      media.onended = () => {
        if (stillCurrent() && images.length > 1) goNext();
      };
      media.onloadedmetadata = onReady;
      media.src = newSrc;
      media.load();
    } else {
      media.onload = () => {
        // decode() : l'image est prête à être peinte, donc pas de trame vide ni
        // d'ancienne image au moment de l'échange (onReady vérifie stillCurrent)
        const decoded = media.decode ? media.decode().catch(() => {}) : Promise.resolve();
        decoded.then(onReady);
      };
      media.src = newSrc;
    }
  }

  span.addEventListener("mouseenter", () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    clearAdvance();
    currentHoverSpan = span;
    currentIndex = 0;
    showImage(currentIndex);
  });

  span.addEventListener("mouseleave", () => {
    hideTimeout = setTimeout(() => {
      if (currentHoverSpan === span) {
        currentImageEl.style.opacity = 0;
        nextImageEl.style.opacity = 0;

        // Invalide tout chargement en cours et arrête les vidéos.
        mediaLoadToken++;
        clearMedia(currentImageEl);
        clearMedia(nextImageEl);

        currentHoverSpan = null;
        clearCounter();
      }
    }, 0);
    clearAdvance();
  });

  span.addEventListener("click", () => {
    if (images.length <= 1) return;
    goNext(); // showImage remet à zéro le timer / l'attente de fin de vidéo
  });
});

container.style.visibility = "visible";

// tracé de la souris
const canvas = document.getElementById("mouse-trail-canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}
resizeCanvas();
window.addEventListener("resize", () => {
  resizeCanvas();      // redimensionner le canvas l'efface...
  scheduleDraw();      // ...donc on redessine le tracé
  safeRectsCache = null; // et on recalcule les safe zones
});

let points = [];
const maxLength = 7500;
let trailActive = true;




const styleSheet = document.createElement('style');
document.head.appendChild(styleSheet);

function setRandomSelectionColor() {
  const color = getRandomPaleColor();
  styleSheet.textContent = `::selection { background-color: ${color}; }`;
}

document.addEventListener('mousedown', setRandomSelectionColor);
document.addEventListener('keydown', (e) => {
  if (e.shiftKey) setRandomSelectionColor();
});

setRandomSelectionColor(); // couleur initiale au chargement


let currentStrokeColor = getRandomPaleColor();


document.querySelectorAll('.text-item').forEach(item => {
  item.addEventListener("mouseenter", () => {
    currentStrokeColor = getRandomPaleColor();
  });
});

// ---------------------------------------------------------------------
// tracé + safe zone autour des projets
// ---------------------------------------------------------------------
// la safe zone est celle qui existait déjà : la boîte de chaque .text-item
// (texte + son padding de 0.75em), la même qui déclenche le changement de
// couleur du pinceau au survol. Quand le curseur y entre, le tracé s'arrête
// net à la limite de la zone, avec une petite flèche qui indique la
// direction d'arrivée. Dès que le curseur ressort, un nouveau tracé repart
// (sans relier les deux morceaux).
const TRAIL_WIDTH = 2;
const ARROW_SIZE = TRAIL_WIDTH * 2.75; // longueur des branches de la flèche
const ARROW_SPREAD = Math.PI / 4;      // 45° de chaque côté = 90° entre les deux branches

let insideSafeZone = false;
let prevX = null;
let prevY = null;

// couleur du tracé en cours : fixée au début de chaque tracé et utilisée
// pour TOUS ses points, flèche comprise. Sans ça, le mouseenter du projet
// (qui change currentStrokeColor) peut se déclencher un mouvement avant que
// la safe zone ne détecte l'entrée, et les derniers points + la flèche
// prenaient alors la nouvelle couleur.
let strokeColor = currentStrokeColor;

// --- optimisations ---------------------------------------------------
// - la longueur du tracé est tenue à jour au fil de l'eau (avant : on la
//   recalculait en entier, point par point, à chaque mouvement de souris)
// - le canvas n'est redessiné que quand le tracé a changé (avant : 60
//   redessins par seconde, même souris immobile)
// - le tracé est dessiné en quelques chemins, pas un stroke() par segment
// - les safe zones sont mises en cache (avant : ~20 getBoundingClientRect,
//   donc des relectures de mise en page, à chaque mouvement de souris)
let trailLength = 0;
let trailDirty = false;
let drawScheduled = false;
const MIN_POINT_DIST = 2; // px : on n'enregistre pas de point plus proche que ça
let safeRectsCache = null;
let safeRectsTime = 0;
const SAFE_RECTS_TTL = 1000; // ms : filet de sécurité si la mise en page bouge

window.addEventListener("load", () => { safeRectsCache = null; });
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { safeRectsCache = null; });
}

// rectangles des projets visibles (la boîte du .text-item, padding compris).
// mis en cache : recalculés au resize, au chargement des polices, et au
// plus tard après SAFE_RECTS_TTL ms
function getSafeRects() {
  const now = performance.now();
  if (safeRectsCache && now - safeRectsTime < SAFE_RECTS_TTL) return safeRectsCache;

  const rects = [];
  document.querySelectorAll(".text-item").forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return; // projet masqué
    rects.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  });
  safeRectsCache = rects;
  safeRectsTime = now;
  return rects;
}

function rectsContaining(rects, x, y) {
  return rects.filter(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
}

// partie du segment (x0,y0)->(x1,y1) qui se trouve dans le rect (Liang–Barsky)
// renvoie { t0, t1 } (0 = départ du segment, 1 = arrivée) ou null
function clipSegment(x0, y0, x1, y1, r) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - r.left, r.right - x0, y0 - r.top, r.bottom - y0];
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return null;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return null;
        if (t < t1) t1 = t;
      }
    }
  }
  return { t0, t1 };
}

// ajoute un point au tracé en tenant la longueur totale à jour
function addPoint(p) {
  const last = points[points.length - 1];
  if (last && !p.start) trailLength += Math.hypot(p.x - last.x, p.y - last.y);
  points.push(p);
  trailDirty = true;
}

// retire le point le plus ancien (la queue du tracé) en retirant aussi
// la longueur du segment qui le reliait au suivant
function shiftPoint() {
  const removed = points.shift();
  const next = points[0];
  if (removed && next && !next.start) {
    trailLength -= Math.hypot(next.x - removed.x, next.y - removed.y);
  }
  if (points.length < 2 || trailLength < 0) trailLength = 0;
  trailDirty = true;
}

function scheduleDraw() {
  if (drawScheduled) return;
  drawScheduled = true;
  requestAnimationFrame(draw);
}

// le curseur vient d'entrer dans une safe zone : on termine le tracé
// à la limite de la zone, avec une flèche orientée dans le sens de la marche
function endStrokeWithArrow(px, py, x, y, zones) {
  if (px === null || points.length === 0) return;
  const last = points[points.length - 1];
  if (last.arrow !== undefined) return; // déjà terminé

  // point où le segment (ancienne pos -> pos actuelle) franchit la limite
  let t = 1;
  zones.forEach(z => {
    const c = clipSegment(px, py, x, y, z);
    if (c) t = Math.min(t, c.t0);
  });
  const tipX = px + (x - px) * t;
  const tipY = py + (y - py) * t;

  // direction : on remonte le tracé sur ~20px pour une orientation stable
  let ref = last;
  for (let j = points.length - 1; j >= 0; j--) {
    ref = points[j];
    if (Math.hypot(tipX - ref.x, tipY - ref.y) >= 20 || ref.start) break;
  }
  let angle;
  if (Math.hypot(tipX - ref.x, tipY - ref.y) < 1) {
    angle = Math.atan2(y - py, x - px);
  } else {
    angle = Math.atan2(tipY - ref.y, tipX - ref.x);
  }

  addPoint({ x: tipX, y: tipY, color: strokeColor, arrow: angle });
}

document.addEventListener("mousemove", (e) => {
  if (!trailActive) return;

  const x = e.clientX;
  const y = e.clientY;
  const rects = getSafeRects();
  const zones = rectsContaining(rects, x, y);
  const inside = zones.length > 0;

  if (inside) {
    // arrivée sur un projet : le tracé s'arrête (une seule fois)
    if (!insideSafeZone) endStrokeWithArrow(prevX, prevY, x, y, zones);
  } else if (insideSafeZone) {
    // sortie de la zone : nouveau tracé, qui repart de la limite
    let sx = x;
    let sy = y;
    const left = rectsContaining(rects, prevX, prevY);
    let t = 0;
    left.forEach(z => {
      const c = clipSegment(prevX, prevY, x, y, z);
      if (c) t = Math.max(t, c.t1);
    });
    if (left.length > 0) {
      sx = prevX + (x - prevX) * t;
      sy = prevY + (y - prevY) * t;
    }
    strokeColor = currentStrokeColor; // nouveau tracé, nouvelle couleur
    addPoint({ x: sx, y: sy, color: strokeColor, start: true });
    addPoint({ x, y, color: strokeColor });
  } else {
    // pas de point tous les pixels : en dessous de MIN_POINT_DIST on ignore
    // (invisible à l'écran, mais beaucoup moins de points à redessiner)
    const last = points[points.length - 1];
    if (!last || Math.hypot(x - last.x, y - last.y) >= MIN_POINT_DIST) {
      addPoint({ x, y, color: strokeColor });
    }
  }

  insideSafeZone = inside;
  prevX = x;
  prevY = y;

  while (trailLength > maxLength) {
    shiftPoint();
  }
  // une flèche seule en bout de queue (son tracé a disparu) est retirée
  while (points.length && points[0].arrow !== undefined) {
    shiftPoint();
  }

  if (trailDirty) scheduleDraw();
});

function drawArrow(p) {
  ctx.beginPath();
  ctx.moveTo(
    p.x - ARROW_SIZE * Math.cos(p.arrow - ARROW_SPREAD),
    p.y - ARROW_SIZE * Math.sin(p.arrow - ARROW_SPREAD)
  );
  ctx.lineTo(p.x, p.y);
  ctx.lineTo(
    p.x - ARROW_SIZE * Math.cos(p.arrow + ARROW_SPREAD),
    p.y - ARROW_SIZE * Math.sin(p.arrow + ARROW_SPREAD)
  );
  ctx.strokeStyle = p.color;
  ctx.stroke();
}

function draw() {
  drawScheduled = false;
  trailDirty = false;

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (!trailActive || points.length < 2) return;

  ctx.lineWidth = TRAIL_WIDTH;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // un seul chemin (donc un seul stroke) par tracé continu de même couleur,
  // au lieu d'un stroke par segment
  let k = 1;
  while (k < points.length) {
    if (points[k].start) { k++; continue; } // coupure entre deux tracés
    const color = points[k - 1].color;
    ctx.beginPath();
    ctx.moveTo(points[k - 1].x, points[k - 1].y);
    while (k < points.length && !points[k].start && points[k - 1].color === color) {
      ctx.lineTo(points[k].x, points[k].y);
      k++;
    }
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  for (let i = 0; i < points.length; i++) {
    if (points[i].arrow !== undefined) drawArrow(points[i]);
  }
}

} else {
  buildMobileList();
}


//  ??
document.querySelectorAll('p').forEach(p => {
  p.innerHTML = p.innerHTML.replace(/ (\S+)$/, '&nbsp;$1');
});