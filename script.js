const container = document.getElementById("container");
const imageA = document.getElementById("hover-image-homepage-a");
const imageB = document.getElementById("hover-image-homepage-b");

let intervalId = null;
let hideTimeout = null;
let currentHoverSpan = null;
let currentImageEl = imageA;
let nextImageEl = imageB;

const occupiedRects = [];

// enregistrement du tracé de la souris
let recordedTrail = [];
let isRecording = false;
const MAX_TRAIL_POINTS = 3000; // max points

// avoir navbar height pour la safe zone
function getNavbarHeight() {
  const navbar = document.querySelector('.navbar');
  return navbar ? navbar.offsetHeight : 0;
}

// calculer les marges de la safezone
function getSafeZone() {
  const margin = 20; // safezone en px
  const navbarHeight = getNavbarHeight();
  
  return {
    top: margin,
    right: margin,
    bottom: navbarHeight + margin,
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

function normalizeImageSize(img) {
  const maxSize = window.innerWidth * 0.45;

  img.style.width = "";
  img.style.height = "";

  const ratio = img.naturalWidth / img.naturalHeight;

  if (ratio > 1) {
    img.style.width = maxSize + "px";
    img.style.height = "auto";
  } else if (ratio < 1) {
    img.style.width = "auto";
    img.style.height = maxSize + "px";
  } else {
    img.style.width = maxSize + "px";
    img.style.height = maxSize + "px";
  }
}

// précharge images
document.querySelectorAll(".text-item").forEach(span => {
  const images = span.dataset.images.split(",").map(i => i.trim());
  images.forEach(src => {
    const img = new Image();
    img.src = src;
  });
});

document.querySelectorAll(".text-item").forEach(span => {
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

  const images = span.dataset.images.split(",").map(i => i.trim());
  let currentIndex = 0;

  function showImage(index) {
    const newSrc = images[index];
    if (currentImageEl.src === newSrc) return;

    const tempImg = new Image();
    tempImg.onload = () => {
      nextImageEl.src = newSrc;
      normalizeImageSize(nextImageEl);
      nextImageEl.style.opacity = 1;
      currentImageEl.style.opacity = 0;

      const temp = currentImageEl;
      currentImageEl = nextImageEl;
      nextImageEl = temp;
    };
    tempImg.src = newSrc;
  }

  function startInterval() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
      currentIndex = (currentIndex + 1) % images.length;
      showImage(currentIndex);
    }, 2000);
  }

  span.addEventListener("mouseenter", () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    currentHoverSpan = span;
    currentIndex = 0;
    showImage(currentIndex);

    if (images.length > 1) startInterval();
  });

  span.addEventListener("mouseleave", () => {
    hideTimeout = setTimeout(() => {
      if (currentHoverSpan === span) {
        currentImageEl.style.opacity = 0;
        nextImageEl.style.opacity = 0;
        currentImageEl.src = "";
        nextImageEl.src = "";
        currentHoverSpan = null;
      }
    }, 0);
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  });

  span.addEventListener("click", () => {
    if (images.length <= 1) return;
    currentIndex = (currentIndex + 1) % images.length;
    showImage(currentIndex);
    if (intervalId) clearInterval(intervalId);
    startInterval();
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
window.addEventListener("resize", resizeCanvas);

let points = [];
const maxLength = 7500;
let trailActive = true;

function getRandomPaleColor() {
  const r = 190 + Math.floor(Math.random() * 55);
  const g = 190 + Math.floor(Math.random() * 55);
  const b = 190 + Math.floor(Math.random() * 55);
  return `rgb(${r}, ${g}, ${b})`;
}

let currentStrokeColor = getRandomPaleColor();
document.querySelectorAll('.text-item').forEach(item => {
  item.addEventListener("mouseenter", () => {
    currentStrokeColor = getRandomPaleColor();
  });
});

function getTotalLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

// enregistrer le tracé
function startRecording() {
  isRecording = true;
  recordedTrail = [];
  console.log("enregistrement du tracé démarré...");
}

function stopRecording() {
  if (isRecording && recordedTrail.length > 0) {
    isRecording = false;
    
    // Simplifier le tracé (garder  point sur 3 pour réduire la taille)
    const simplifiedTrail = recordedTrail.filter((_, index) => index % 3 === 0);
    
    // sauvegarder dans localStorage
    try {
      localStorage.setItem('mouseTrail', JSON.stringify(simplifiedTrail));
      console.log(`tracé enregistré : ${simplifiedTrail.length} points`);
    } catch (e) {
      console.error("erreur lors de l'enregistrement du tracé:", e);
    }
  }
}

document.addEventListener("mousemove", (e) => {
  if (!trailActive) return;
  
  points.push({ x: e.clientX, y: e.clientY, color: currentStrokeColor });
  
  // enregistrer pour le replay
  if (isRecording && recordedTrail.length < MAX_TRAIL_POINTS) {
    recordedTrail.push({ 
      x: e.clientX, 
      y: e.clientY, 
      color: currentStrokeColor,
      timestamp: Date.now()
    });
  }
  
  while (getTotalLength(points) > maxLength) {
    points.shift();
  }
});

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (trailActive && points.length > 1) {
    for (let i = 1; i < points.length; i++) {
      ctx.beginPath();
      ctx.moveTo(points[i - 1].x, points[i - 1].y);
      ctx.lineTo(points[i].x, points[i].y);
      ctx.strokeStyle = points[i - 1].color;
      ctx.lineWidth = 50;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }
  requestAnimationFrame(draw);
}
draw();

// eye
const toggleEye = document.getElementById("toggle-eye");
const pupil = toggleEye.querySelector(".pupil");
let activated = true;

toggleEye.classList.add("eye-on");
toggleEye.classList.remove("eye-off");
pupil.style.top = "50%";
pupil.style.left = "50%";

toggleEye.addEventListener("click", () => {
  activated = !activated;
  toggleEye.classList.toggle("eye-on", activated);
  toggleEye.classList.toggle("eye-off", !activated);
  trailActive = activated;

  if (!activated) {
    pupil.style.top = "50%";
    pupil.style.left = "50%";
    
    // stop l'enregistrement
    stopRecording();
  } else {
    // reset le tracé quand on réactive
    points = [];
    
    // démarrer l'enregistrement
    startRecording();
  }
});

window.addEventListener("mousemove", (e) => {
  if (!activated) return;

  const rect = toggleEye.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const maxDistance = (rect.width / 2) - (pupil.offsetWidth / 2) - 4;

  const dx = e.clientX - centerX;
  const dy = e.clientY - centerY;

  const distance = Math.min(Math.sqrt(dx * dx + dy * dy), maxDistance);
  const angle = Math.atan2(dy, dx);

  const pupilX = centerX + distance * Math.cos(angle);
  const pupilY = centerY + distance * Math.sin(angle);

  const relativeX = ((pupilX - rect.left) / rect.width) * 100;
  const relativeY = ((pupilY - rect.top) / rect.height) * 100;

  pupil.style.left = `${relativeX}%`;
  pupil.style.top = `${relativeY}%`;
});

// démarrer l'enregistrement au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  // check si index.html en regardant si le container existe
  const container = document.getElementById("container");
  if (container) {
    startRecording();
  }
});

// save si on quitte la page
window.addEventListener('beforeunload', () => {
  stopRecording();
});

// save si on clique sur un lien
document.querySelectorAll('a[href="alexis.html"]').forEach(link => {
  link.addEventListener('click', (e) => {
    stopRecording();
  });
});



//  ??
document.querySelectorAll('p').forEach(p => {
  p.innerHTML = p.innerHTML.replace(/ (\S+)$/, '&nbsp;$1');
});
