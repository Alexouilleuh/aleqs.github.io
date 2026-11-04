(function () {
  // le contenu texte de la page (Formation, Expériences, Références,
  // Contact) est maintenant écrit directement dans infos.html.
  //
  // ce fichier ne s'occupe plus que de l'animation des mots-liens
  // .info-link qu'on y trouve : une couleur pâle aléatoire, et — sur
  // desktop uniquement — une image qui suit le curseur au survol pour
  // ceux qui ont un data-images renseigné (même principe que
  // projets.html). Pour ajouter une image à un lien, il suffit de
  // renseigner son attribut data-images="chemin1.jpg,chemin2.jpg"
  // directement dans le HTML.

  // couleur pâle aléatoire : getRandomPaleColor() vient de color.js
  // (c'est là que se trouve l'interrupteur pour les passer en blanc)

  const isMobile = isMobileLayout(); // voir color.js (fenêtre étroite OU appareil tactile)

  // attribue une couleur pâle à chaque mot-lien, et — uniquement sur
  // desktop — affiche une image qui suit le curseur au survol, sur le
  // même principe que le survol des lignes sur projets.html
  function setupInfoLinks() {
    const links = document.querySelectorAll(".info-link");

    // la couleur est assignée sur tous les devices
    links.forEach((linkEl) => {
      linkEl.style.color = getRandomPaleColor();
    });

    if (isMobile) return; // pas d'image au survol sur mobile

    const hoverImage = document.getElementById("hover-image-infos");
    if (!hoverImage) return;

    let currentMouseX = window.innerWidth / 2;
    let currentMouseY = window.innerHeight / 2;
    document.addEventListener("mousemove", (e) => {
      currentMouseX = e.clientX;
      currentMouseY = e.clientY;
    });

    // --- chargement SANS image fantôme --------------------------------
    // une <img> rendue visible avant que sa nouvelle image soit décodée montre
    // un instant l'ancienne (image fantôme). On prépare donc l'image HORS
    // ÉCRAN, et on ne touche à l'élément affiché qu'une fois qu'elle est prête.
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

    function positionImageAt(x, y) {
      const imageWidth = hoverImage.offsetWidth;
      const imageHeight = hoverImage.offsetHeight;
      // taille encore inconnue : on ne place rien plutôt que de calculer avec
      // une taille fictive (l'image partait dans un coin de l'écran)
      if (!imageWidth || !imageHeight) return;

      const margin = 20;
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      let left = x + margin;
      if (left + imageWidth > screenWidth) {
        left = x - imageWidth - margin;
      }
      left = Math.max(margin, left);

      const ratio = y / screenHeight;
      let top = y - imageHeight * ratio;
      top = Math.max(margin, Math.min(top, screenHeight - imageHeight - margin));

      hoverImage.style.left = `${left}px`;
      hoverImage.style.top = `${top}px`;
    }

    const INFO_DELAY = 3000; // ms avant l'image suivante (même cadence que sur projets.html)
    let advanceTimer = null;
    let showToken = 0; // n° du dernier affichage demandé : ignore les chargements périmés

    function clearAdvance() {
      if (advanceTimer) {
        clearTimeout(advanceTimer);
        advanceTimer = null;
      }
    }

    // cache l'image et vide l'élément : au prochain survol on ne peut pas
    // voir l'image du lien précédent
    function hideImage() {
      showToken++;
      clearAdvance();
      hoverImage.style.opacity = 0;
      hoverImage.removeAttribute("src");
    }

    links.forEach((linkEl) => {
      const images = (linkEl.dataset.images || "")
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean);

      if (images.length === 0) return; // lien coloré sans photo : rien au survol

      let currentIndex = 0;

      function showImage() {
        const src = images[currentIndex];
        const token = ++showToken;
        clearAdvance();
        const current = () => token === showToken;

        const scheduleNext = () => {
          if (images.length > 1 && !advanceTimer) {
            advanceTimer = setTimeout(() => {
              advanceTimer = null;
              if (!current()) return;
              currentIndex = (currentIndex + 1) % images.length;
              showImage();
            }, INFO_DELAY);
          }
        };

        // pendant le chargement, l'écran garde l'image précédente du MÊME lien
        // (ou rien du tout si on vient d'entrer sur le lien)
        loadImage(src)
          .then(() => {
            if (!current()) return;
            hoverImage.src = src;
            return decodeImage(hoverImage).catch(() => {}); // garde-fou
          })
          .then(() => {
            if (!current()) return;
            positionImageAt(currentMouseX, currentMouseY); // taille connue : on place AVANT d'afficher
            hoverImage.style.opacity = 1;
            scheduleNext();
          })
          .catch(() => {
            if (current()) scheduleNext(); // image introuvable : on ne reste pas bloqué
          });
      }

      linkEl.addEventListener("mouseenter", (e) => {
        currentMouseX = e.clientX;
        currentMouseY = e.clientY;
        currentIndex = 0;
        showImage();
      });

      linkEl.addEventListener("mousemove", (e) => {
        positionImageAt(e.clientX, e.clientY);
      });

      linkEl.addEventListener("mouseleave", () => {
        hideImage();
      });
    });
  }

  setupInfoLinks();
})();