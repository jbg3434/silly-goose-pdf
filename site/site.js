(() => {
  const CAPTIONS = {
    honk: "Gus honks.",
    "double-honk": "Gus honks twice.",
    squawk: "Gus squawks loudly.",
    celebrate: "Gus does a triumphant three-note honk.",
    "sad-honk": "Gus lets out a deflated honk.",
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const caption = document.getElementById("gus-caption");
  const heroImg = document.getElementById("hero-gus-img");
  const heroBox = document.querySelector(".hero-gus");
  let captionTimer;
  let heroTimer;

  function say(text) {
    caption.textContent = text;
    caption.classList.add("show");
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => caption.classList.remove("show"), 2200);
  }

  function play(cue) {
    if (!cue) return;
    const audio = new Audio(`sounds/${cue}.wav`);
    audio.volume = 0.6;
    audio.play().catch(() => {});
    say(CAPTIONS[cue]);
  }

  function animate(el, cls) {
    if (reduceMotion) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  document.querySelectorAll("[data-honk]").forEach((btn) =>
    btn.addEventListener("click", () => {
      heroImg.src = "brand/gus-honk-dark.svg";
      heroImg.alt = "Gus honking with beak wide open";
      heroBox.classList.add("honking");
      animate(heroImg, "wiggle");
      play("honk");
      clearTimeout(heroTimer);
      heroTimer = setTimeout(() => {
        heroImg.src = "brand/gus-idle-dark.svg";
        heroImg.alt = "Gus standing by, looking smug";
        heroBox.classList.remove("honking");
      }, 900);
    }),
  );

  document.querySelectorAll(".pose").forEach((btn) =>
    btn.addEventListener("click", () => {
      animate(btn.querySelector("img"), "wiggle");
      if (btn.dataset.cue) play(btn.dataset.cue);
      else say("Gus is dozing. Shh.");
    }),
  );
})();
