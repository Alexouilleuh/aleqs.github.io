document.addEventListener("DOMContentLoaded", () => {
  const favicon = document.getElementById("favicon");
  if (!favicon) return; // stop si pas de favicon trouvé

  const icons = ["icon-b.ico", "icon-n.ico"];
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const imgA = new Image();
  const imgB = new Image();

  let direction = 1;
  let progress = 0;
  const fadeDuration = 8000;
  let lastTime = null;

  imgA.src = icons[0];
  imgB.src = icons[1];

  function animate(time) {
    if (!lastTime) lastTime = time;
    const delta = time - lastTime;
    lastTime = time;

    progress += (delta / fadeDuration) * direction;

    if (progress >= 1) {
      progress = 1;
      direction = -1;
    } else if (progress <= 0) {
      progress = 0;
      direction = 1;
    }

    ctx.clearRect(0, 0, size, size);

    ctx.globalAlpha = 1;
    ctx.drawImage(imgA, 0, 0, size, size);

    ctx.globalAlpha = progress;
    ctx.drawImage(imgB, 0, 0, size, size);

    favicon.href = canvas.toDataURL("image/png");

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
});