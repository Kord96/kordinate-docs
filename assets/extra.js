/* Mermaid rendering + click-to-zoom.
   Runs early to capture pre.mermaid content before Material strips it.
   Stores diagram text, then renders after mermaid loads. */
(function () {
  /* Phase 1: Capture mermaid source from pre.mermaid>code before Material empties them */
  var captured = [];
  function capture() {
    document.querySelectorAll("pre.mermaid").forEach(function (pre) {
      if (pre.dataset.captured) return;
      pre.dataset.captured = "true";
      var code = pre.querySelector("code");
      if (code && code.textContent.trim()) {
        captured.push({ pre: pre, text: code.textContent });
      }
    });
  }

  /* Phase 2: Replace pre elements with rendered mermaid divs */
  function render() {
    if (captured.length === 0 || typeof mermaid === "undefined") return false;

    captured.forEach(function (item, i) {
      /* Find the element — Material may have replaced pre with a div */
      var target = item.pre;
      if (!target.parentElement) {
        /* pre was removed by Material — find the empty div.mermaid it created */
        var divs = document.querySelectorAll("div.mermaid");
        if (divs[i] && !divs[i].querySelector("svg")) {
          target = divs[i];
        } else {
          return;
        }
      }

      var div = document.createElement("div");
      div.className = "mermaid";
      div.textContent = item.text;
      target.parentElement.insertBefore(div, target);
      target.remove();
    });

    captured = [];
    mermaid.initialize({ startOnLoad: false, theme: "dark" });
    mermaid.run();
    return true;
  }

  /* Phase 3: Make rendered diagrams clickable */
  function makeClickable() {
    document.querySelectorAll(".mermaid").forEach(function (container) {
      var svg = container.querySelector("svg");
      if (!svg || container.dataset.clickReady) return;
      container.dataset.clickReady = "true";
      container.style.cursor = "pointer";
      container.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var clone = svg.cloneNode(true);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        var style = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "style"
        );
        style.textContent = "svg { background: #1e1e2e; padding: 2rem; }";
        clone.insertBefore(style, clone.firstChild);
        var data = new XMLSerializer().serializeToString(clone);
        var blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
        window.open(URL.createObjectURL(blob), "_blank");
      });
    });
  }

  /* Run capture immediately and repeatedly until we find elements */
  capture();
  var rendered = false;
  var timer = setInterval(function () {
    capture();
    if (!rendered) rendered = render();
    makeClickable();
  }, 200);
  setTimeout(function () { clearInterval(timer); }, 30000);
})();
