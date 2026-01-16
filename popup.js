(function() {
  'use strict';

  const CONFIG = {
    constantSpeed: 0.5, // vitesse constante en pixels par frame
    fallbackSpeed: 0.5, // vitesse si pas de tracé (rebond)
    selector: '.bouncing-popup',
    trailLineWidth: 50,
    trailMaxLength: 30000, // Longueur maximale du tracé visible (en pixels)
    canvasId: 'popup-trail-canvas',
    bounceVariation: 0.3
  };

  // depart
  let state = {
    x: 0,
    y: 0,
    dx: CONFIG.fallbackSpeed,
    dy: CONFIG.fallbackSpeed,
    width: 0,
    height: 0,
    block: null,
    canvas: null,
    ctx: null,
    trailPoints: [],
    currentStrokeColor: getRandomPaleColor(),
    
    // données du tracé enregistré
    recordedTrail: null,
    currentTargetIndex: 0,
    distanceTraveled: 0,
    playbackMode: false, // true = suit le tracé, false = rebondit
    movingForward: true, // true = avance dans le tracé, false = recule
  };

  // tools/infos
  function getRandomPaleColor() {
    const r = 190 + Math.floor(Math.random() * 55);
    const g = 190 + Math.floor(Math.random() * 55);
    const b = 190 + Math.floor(Math.random() * 55);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function getTotalLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }

  function organicBounce(velocity, variation) {
    let newVelocity = -velocity;
    const randomVariation = (Math.random() - 0.5) * 2 * variation * CONFIG.fallbackSpeed;
    newVelocity += randomVariation;
    
    const minSpeed = CONFIG.fallbackSpeed * 0.3;
    if (Math.abs(newVelocity) < minSpeed) {
      newVelocity = newVelocity > 0 ? minSpeed : -minSpeed;
    }
    
    return newVelocity;
  }

  // charger le tracé
  function loadRecordedTrail() {
    try {
      const saved = localStorage.getItem('mouseTrail');
      if (saved) {
        state.recordedTrail = JSON.parse(saved);
        state.playbackMode = true;
        console.log(`tracé chargé : ${state.recordedTrail.length} points`);
        console.log(`le popup va suivre votre tracé`);
        return true;
      }
    } catch (e) {
      console.error("erreur lors du chargement du tracé:", e);
    }
    
    console.log("pas de tracé enregistré, mode rebond activé");
    return false;
  }

  // canvas
  function createCanvas() {
    let canvas = document.getElementById(CONFIG.canvasId);
    
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = CONFIG.canvasId;
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '0';
      document.body.insertBefore(canvas, document.body.firstChild);
    }

    state.canvas = canvas;
    state.ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    state.canvas.width = window.innerWidth * dpr;
    state.canvas.height = window.innerHeight * dpr;
    state.canvas.style.width = `${window.innerWidth}px`;
    state.canvas.style.height = `${window.innerHeight}px`;
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);
    state.ctx.scale(dpr, dpr);
  }

  // dessin
  function drawTrail() {
    state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    
    if (state.trailPoints.length > 1) {
      for (let i = 1; i < state.trailPoints.length; i++) {
        state.ctx.beginPath();
        state.ctx.moveTo(state.trailPoints[i - 1].x, state.trailPoints[i - 1].y);
        state.ctx.lineTo(state.trailPoints[i].x, state.trailPoints[i].y);
        state.ctx.strokeStyle = state.trailPoints[i - 1].color;
        state.ctx.lineWidth = CONFIG.trailLineWidth;
        state.ctx.lineJoin = 'round';
        state.ctx.lineCap = 'round';
        state.ctx.stroke();
      }
    }
  }

  // init
  function init() {
    state.block = document.querySelector(CONFIG.selector);
    
    if (!state.block) {
      console.error('Bouncing popup: Aucun élément trouvé avec le sélecteur', CONFIG.selector);
      return;
    }

    createCanvas();
    loadRecordedTrail();
    
    requestAnimationFrame(() => {
      state.width = state.block.offsetWidth;
      state.height = state.block.offsetHeight;
      
      if (state.playbackMode && state.recordedTrail.length > 0) {
        // Commencer au premier point du tracé
        state.x = state.recordedTrail[0].x - state.width / 2;
        state.y = state.recordedTrail[0].y - state.height / 2;
        state.currentStrokeColor = state.recordedTrail[0].color || getRandomPaleColor();
      } else {
        // Position aléatoire si pas de tracé
        state.x = Math.random() * (window.innerWidth - state.width);
        state.y = Math.random() * (window.innerHeight - state.height);
        
        const angle = Math.random() * Math.PI * 2;
        state.dx = Math.cos(angle) * CONFIG.fallbackSpeed;
        state.dy = Math.sin(angle) * CONFIG.fallbackSpeed;
      }
      
      state.block.style.left = state.x + 'px';
      state.block.style.top = state.y + 'px';
      
      animate();
    });
    
    window.addEventListener('resize', handleResize);
  }

  // animation
  function animate() {
    if (state.playbackMode && state.recordedTrail) {
      // mode: suivre le tracé enregistré
      animateFollowTrail();
    } else {
      // mode: sebondir
      animateBounce();
    }

    // dessiner le tracé
    drawTrail();
    requestAnimationFrame(animate);
  }

  function animateFollowTrail() {
    if (state.recordedTrail.length === 0) return;
    
    const currentCenter = {
      x: state.x + state.width / 2,
      y: state.y + state.height / 2
    };
    
    let targetPoint = state.recordedTrail[state.currentTargetIndex];
    
    // calculer la distance jusqu'au point (prochaine position)
    const dx = targetPoint.x - currentCenter.x;
    const dy = targetPoint.y - currentCenter.y;
    const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
    
    // si on est arrivé au point cible, passer au suivant/au précédent
    if (distanceToTarget < CONFIG.constantSpeed) {
      if (state.movingForward) {
        // avance dans le tracé
        state.currentTargetIndex++;
        
        // si on arrive à la fin, on change de direction
        if (state.currentTargetIndex >= state.recordedTrail.length) {
          state.movingForward = false;
          state.currentTargetIndex = state.recordedTrail.length - 2; // reculer d'un point
          if (state.currentTargetIndex < 0) state.currentTargetIndex = 0;
          
          // changer de couleur quand on fait demi-tour
          state.currentStrokeColor = getRandomPaleColor();
        }
      } else {
        // recule dans le tracé
        state.currentTargetIndex--;
        
        // si on arrive au début, change de direction
        if (state.currentTargetIndex < 0) {
          state.movingForward = true;
          state.currentTargetIndex = 1; // avancer d'un point
          if (state.currentTargetIndex >= state.recordedTrail.length) {
            state.currentTargetIndex = state.recordedTrail.length - 1;
          }
          
          // changer de couleur quand on fait demi-tour
          state.currentStrokeColor = getRandomPaleColor();
        }
      }
      
      // maj le point cible
      if (state.currentTargetIndex >= 0 && state.currentTargetIndex < state.recordedTrail.length) {
        targetPoint = state.recordedTrail[state.currentTargetIndex];
      }
    }
    
    // calculer la direction vers le point cible
    const newDx = targetPoint.x - currentCenter.x;
    const newDy = targetPoint.y - currentCenter.y;
    const distance = Math.sqrt(newDx * newDx + newDy * newDy);
    
    // vitesse constante
    if (distance > 0) {
      const moveX = (newDx / distance) * CONFIG.constantSpeed;
      const moveY = (newDy / distance) * CONFIG.constantSpeed;
      
      state.x += moveX;
      state.y += moveY;
    }
    
    // utiliser la couleur du point si disponible
    if (targetPoint.color) {
      state.currentStrokeColor = targetPoint.color;
    }
    
    // go position
    state.block.style.left = state.x + 'px';
    state.block.style.top = state.y + 'px';
    
    // ajouter au tracé visuel
    const newCenterX = state.x + state.width / 2;
    const newCenterY = state.y + state.height / 2;
    
    state.trailPoints.push({ 
      x: newCenterX, 
      y: newCenterY, 
      color: state.currentStrokeColor 
    });
    
    // limiter la longueur du tracé en pixels (pas en nombre de points)
    while (getTotalLength(state.trailPoints) > CONFIG.trailMaxLength) {
      state.trailPoints.shift();
    }
  }

  function animateBounce() {
    state.x += state.dx;
    state.y += state.dy;

    const maxX = window.innerWidth - state.width;
    const maxY = window.innerHeight - state.height;

    if (state.x <= 0 || state.x >= maxX) {
      state.dx = organicBounce(state.dx, CONFIG.bounceVariation);
      state.x = Math.max(0, Math.min(state.x, maxX));
      state.currentStrokeColor = getRandomPaleColor();
    }

    if (state.y <= 0 || state.y >= maxY) {
      state.dy = organicBounce(state.dy, CONFIG.bounceVariation);
      state.y = Math.max(0, Math.min(state.y, maxY));
      state.currentStrokeColor = getRandomPaleColor();
    }

    state.block.style.left = state.x + 'px';
    state.block.style.top = state.y + 'px';

    const centerX = state.x + state.width / 2;
    const centerY = state.y + state.height / 2;
    
    state.trailPoints.push({ 
      x: centerX, 
      y: centerY, 
      color: state.currentStrokeColor 
    });

    // limiter la longueur du tracé en pixels
    while (getTotalLength(state.trailPoints) > CONFIG.trailMaxLength) {
      state.trailPoints.shift();
    }
  }

  function handleResize() {
    if (!state.block) return;
    
    state.width = state.block.offsetWidth;
    state.height = state.block.offsetHeight;
    
    const maxX = window.innerWidth - state.width;
    const maxY = window.innerHeight - state.height;
    state.x = Math.min(state.x, maxX);
    state.y = Math.min(state.y, maxY);
  }

  // start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();