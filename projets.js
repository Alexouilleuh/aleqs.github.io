// Position de la souris : mise à jour en continu, et à l'entrée sur une ligne
let currentMouseX = 0;
let currentMouseY = 0;

// Détection mobile
// iPadOS 13+ se présente comme un Mac dans le user agent : un iPad Pro n'est donc
// pas reconnu par la regex. On ajoute le test "pointeur tactile, sans survol".
const isMobileDevice =
  /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
  window.matchMedia(TOUCH_DEVICE_QUERY).matches;

// ---------------------------------------------------------------------
// médias : images et vidéos
// ---------------------------------------------------------------------
// une ligne de projet peut mélanger les deux dans data-images, par exemple :
//   data-images="images/a.webp, images/b.webm, images/c.webp"
// - image : affichée IMAGE_DELAY ms, puis on passe à la suivante
// - vidéo : lecture automatique (muette : obligatoire pour l'autoplay),
//           PAS de timer : on passe à la suivante uniquement quand elle est finie
const IMAGE_DELAY = 4000; // ms

// mobile : toucher une ligne ne change JAMAIS son fond. Cette option règle en plus
// l'aperçu centré des images du projet :
//   true  -> l'aperçu s'affiche au toucher (comportement d'origine)
//   false -> toucher une ligne ne fait absolument rien
const MOBILE_TAP_SHOWS_MEDIA = true;
const VIDEO_EXT = /\.(webm|mp4|m4v|mov|ogv)(?:$|[?#])/i;
function isVideo(src) {
  return VIDEO_EXT.test(src);
}
// "a.webp, b.webm," -> ["a.webp", "b.webm"] (ignore les entrées vides)
function parseMedia(str) {
  return (str || "").split(",").map(i => i.trim()).filter(Boolean);
}

let hoverVideo = null;   // lecteur vidéo, créé dans init()
let videoActive = false; // true quand c'est la vidéo (et non l'image) qui est affichée

// arrête et cache la vidéo (et libère le fichier)
function stopVideo() {
  videoActive = false;
  if (!hoverVideo) return;
  hoverVideo.onplaying = hoverVideo.onended = hoverVideo.onerror = null;
  hoverVideo.pause();
  hoverVideo.style.opacity = 0;
  if (hoverVideo.hasAttribute("src")) {
    hoverVideo.removeAttribute("src");
    hoverVideo.load();
  }
}

// ---------------------------------------------------------------------
// chargement SANS image fantôme
// ---------------------------------------------------------------------
// Une <img> qu'on rend visible avant que sa nouvelle image soit chargée et
// décodée montre pendant un instant l'ancienne (celle d'avant la vidéo, ou
// celle du projet précédent) : c'est l'image fantôme. Règle suivie ici : on
// prépare la nouvelle image HORS ÉCRAN, et on ne touche à l'élément affiché
// qu'une fois qu'elle est prête à être peinte.

// promesse résolue quand l'image est chargée ET décodée (rejetée si elle est introuvable)
function decodeImage(img) {
  if (img.decode) return img.decode();
  return new Promise((resolve, reject) => {
    if (img.complete && img.naturalWidth) return resolve();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("image introuvable"));
  });
}

function loadImage(src) {
  const probe = new Image();
  probe.src = src;
  return decodeImage(probe);
}

// Capturer la position de la souris dès le chargement
if (!isMobileDevice) {
  document.addEventListener("mousemove", (e) => {
    currentMouseX = e.clientX;
    currentMouseY = e.clientY;
  });
}

// Fonction de préchargement des images
function preloadImages() {
  return new Promise((resolve) => {
    const allImages = [];

    document.querySelectorAll(".project-row").forEach(row => {
      // une vidéo ne se précharge pas comme une image : on la saute
      allImages.push(...parseMedia(row.dataset.images).filter(src => !isVideo(src)));
    });

    if (allImages.length === 0) {
      resolve();
      return;
    }

    let loadedCount = 0;
    const totalImages = allImages.length;

    allImages.forEach(src => {
      const img = new Image();
      img.onload = img.onerror = () => {
        loadedCount++;
        if (loadedCount === totalImages) {
          resolve();
        }
      };
      img.src = src;
    });
  });
}

// Initialisation
async function init() {
  const hoverImage = document.getElementById("hover-image-index");

  // Invisible au départ
  hoverImage.style.opacity = 0;

  // lecteur vidéo : même rôle que l'image, stylé par #hover-video-index (shared.css)
  hoverVideo = document.createElement("video");
  hoverVideo.id = "hover-video-index";
  hoverVideo.className = hoverImage.className;
  hoverVideo.muted = true;               // obligatoire pour la lecture automatique
  hoverVideo.setAttribute("muted", "");
  hoverVideo.playsInline = true;
  hoverVideo.preload = "auto";
  hoverVideo.disablePictureInPicture = true;
  // sécurité si le CSS n'est pas à jour : jamais dans le flux, jamais cliquable
  hoverVideo.style.position = "fixed";
  hoverVideo.style.pointerEvents = "none";
  hoverVideo.style.opacity = 0;
  document.body.appendChild(hoverVideo);

  // Préchargement des images (met les fichiers en cache)
  preloadImages();

  setupImageDisplay();
}

// Calcul unique de position
function positionImageAt(x, y) {
  const hoverImage = document.getElementById("hover-image-index");
  // l'élément affiché : la vidéo quand elle est active, sinon l'image
  const shown = videoActive && hoverVideo ? hoverVideo : hoverImage;

  const imageWidth = shown.offsetWidth;
  const imageHeight = shown.offsetHeight;
  // taille encore inconnue (rien de chargé) : on ne place rien, plutôt que de
  // calculer avec une taille fictive qui envoie l'image dans un coin de l'écran
  if (!imageWidth || !imageHeight) return;

  const margin = 20;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  // Horizontal
  let left = x + margin;
  if (left + imageWidth > screenWidth) {
    left = x - imageWidth - margin;
  }
  left = Math.max(margin, left);

  // Vertical adaptif
  const ratio = y / screenHeight;
  let top = y - imageHeight * ratio;
  top = Math.max(margin, Math.min(top, screenHeight - imageHeight - margin));

  // on déplace les deux pour qu'ils restent synchronisés
  [hoverImage, hoverVideo].forEach(el => {
    if (!el) return;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  });
}

function setupImageDisplay() {
  const hoverImage = document.getElementById("hover-image-index");
  const isMobile = isMobileDevice;

  let advanceTimer = null; // timer avant le média suivant (images uniquement)
  let showToken = 0;       // n° du dernier affichage demandé : ignore les événements périmés

  function clearAdvance() {
    if (advanceTimer) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
    }
    if (hoverVideo) hoverVideo.onended = null;
  }

  // cache tout (image et vidéo) et annule ce qui est en attente
  function hideMedia() {
    showToken++;
    clearAdvance();
    stopVideo();
    hoverImage.style.opacity = 0;
    // plus aucune image périmée dans l'élément caché : au prochain affichage
    // on ne peut donc pas voir l'image du projet précédent
    hoverImage.removeAttribute("src");
  }

  // place le média sous le curseur : appelé quand sa taille est connue,
  // et AVANT de l'afficher (sinon il apparaît ailleurs puis saute)
  function placeAtPointer() {
    if (isMobile) return; // mobile : l'image est centrée par l'overlay
    positionImageAt(
      currentMouseX || window.innerWidth / 2,
      currentMouseY || window.innerHeight / 2
    );
  }

  // mobile : l'image ET la vidéo s'affichent centrées sur l'écran
  function applyMobileOverlay() {
    [hoverImage, hoverVideo].forEach(el => {
      if (!el) return;
      el.style.position = "fixed";
      el.style.left = "50%";
      el.style.top = "50%";
      el.style.transform = "translate(-50%, -50%)";
      el.style.maxWidth = "70%";
      el.style.maxHeight = "70%";
      el.style.zIndex = "100";
    });
  }

  document.querySelectorAll(".project-row").forEach(row => {
    const images = parseMedia(row.dataset.images);
    let currentIndex = 0;

    // passe au média suivant (boucle sur la liste)
    function goNext() {
      currentIndex = (currentIndex + 1) % images.length;
      showMedia();
    }

    // affiche le média courant : image (timer IMAGE_DELAY) ou vidéo (lecture auto, pas de timer)
    function showMedia() {
      const src = images[currentIndex];
      if (!src) return;

      const token = ++showToken; // invalide tout affichage encore en attente
      clearAdvance();
      const current = () => token === showToken;

      // images : on attend IMAGE_DELAY puis on passe au média suivant
      const scheduleNext = () => {
        if (images.length > 1 && !advanceTimer) {
          advanceTimer = setTimeout(() => {
            advanceTimer = null;
            if (current()) goNext();
          }, IMAGE_DELAY);
        }
      };

      // --- vidéo : lecture automatique, aucun timer ---------------------
      if (isVideo(src)) {
        hoverVideo.loop = images.length === 1; // seule dans la ligne : en boucle
        hoverVideo.onplaying = () => {
          if (!current()) return;
          videoActive = true;
          placeAtPointer();                 // taille de la vidéo connue : on la place AVANT de l'afficher
          hoverImage.style.opacity = 0;
          hoverVideo.style.opacity = 1;
        };
        // on ne passe à la suite qu'à la FIN de la vidéo
        hoverVideo.onended = () => {
          if (current()) goNext();
        };
        // fichier introuvable / lecture impossible : on ne reste pas bloqué
        hoverVideo.onerror = () => {
          if (current()) scheduleNext();
        };
        hoverVideo.src = src;
        const playing = hoverVideo.play();
        if (playing) playing.catch(() => {
          if (current()) scheduleNext();
        });
        return;
      }

      // --- image : préparée hors écran, affichée seulement une fois prête ---
      // (pendant ce temps, l'écran garde le média précédent du MÊME projet,
      // ou rien du tout si on vient d'entrer dans la ligne)
      loadImage(src)
        .then(() => {
          if (!current()) return;
          hoverImage.src = src;
          // l'élément a bien pris la nouvelle image (garde-fou)
          return decodeImage(hoverImage).catch(() => {});
        })
        .then(() => {
          if (!current()) return;
          stopVideo();       // la vidéo précédente s'efface au même instant
          placeAtPointer();  // taille connue : on place AVANT d'afficher
          hoverImage.style.opacity = 1;
          scheduleNext();
        })
        .catch(() => {
          // image introuvable : on ne reste pas bloqué
          if (current()) scheduleNext();
        });
    }

    function moveImageWithCursor(e) {
      positionImageAt(e.clientX, e.clientY);
    }

    if (!isMobile) {
      // Desktop
      row.addEventListener("mouseenter", (e) => {
        if (images.length === 0) return;

        // coordonnées de l'entrée : fiables même sans mouvement préalable
        currentMouseX = e.clientX;
        currentMouseY = e.clientY;

        currentIndex = 0;
        showMedia();
      });

      row.addEventListener("mousemove", (e) => {
        if (images.length > 0) {
          moveImageWithCursor(e);
        }
      });

      row.addEventListener("mouseleave", () => {
        hideMedia();
      });

      row.addEventListener("click", () => {
        if (images.length <= 1) return;

        goNext(); // showMedia remet à zéro le timer / l'attente de fin de vidéo
      });

    } else {
      // Mobile
      row.addEventListener("click", () => {
        if (!MOBILE_TAP_SHOWS_MEDIA) return;
        if (images.length === 0) return;

        currentIndex = (currentIndex + 1) % images.length;
        applyMobileOverlay();
        showMedia();
      });
    }
  });

  // Couleurs pastel : getRandomPaleColor() vient de color.js
  // (c'est là que se trouve l'interrupteur pour les passer en blanc)

  if (!isMobile) {
    document.querySelectorAll(".project-row").forEach(row => {
      row.addEventListener("mouseenter", () => {
        row.dataset.originalBg = row.style.backgroundColor || "";
        row.style.backgroundColor = getRandomPaleColor();
      });

      row.addEventListener("mouseleave", () => {
        row.style.backgroundColor = row.dataset.originalBg;
      });
    });
  }
  // mobile : plus aucun changement de fond au toucher (seul le desktop colore la ligne, au survol)
}

// Lancer l'initialisation
init();