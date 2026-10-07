/* =========================================================================
   Liquid Glass Refraction Engine
   Faithfully recreates Apple's Liquid Glass (WWDC 2025) using SVG
   displacement maps, Snell's law physics, and specular rim highlights
   applied through backdrop-filter.

   Reference & Technique:
   "Liquid Glass in the Browser: Refraction with CSS and SVG" — kube.io
   ========================================================================= */

(function () {
  "use strict";

  var SAMPLES = 128;

  var SETTINGS = {
    enabled: true,
    profile: "convex-squircle", // Apple's signature Squircle
    bezel: 24, // Optimized bezel width perfectly matched to border-radius
    thickness: 0.95, // Glass thickness factor
    ior: 1.5, // Index of refraction (glass ~ 1.5)
    refractionScale: 20, // Kube.io calibrated scale (crisp optical warp, zero seams)
    lightAngle: -60, // Degrees: light from top-left
    shininess: 6, // Specular shininess exponent
    specularOpacity: 0.40, // Delicate, elegant specular rim gleam
    specularSaturation: 6.0,
    blurLevel: 0.8
  };

  /* ---------- 1. Surface profile functions f(x) for x in [0, 1] ----------- */
  /* x = 0 at the outer border; x = 1 at the inner boundary of the bezel */

  function smootherstep(x) {
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  function convexSquircle(x) {
    // Apple's signature Squircle: y = (1 - (1 - x)^4)^(1/4)
    return Math.pow(Math.max(0, 1 - Math.pow(1 - x, 4)), 0.25);
  }

  function convexCircle(x) {
    // Spherical dome: y = sqrt(1 - (1 - x)^2)
    return Math.sqrt(Math.max(0, 1 - Math.pow(1 - x, 2)));
  }

  function concave(x) {
    return 1 - convexCircle(x);
  }

  function lip(x) {
    var s = smootherstep(x);
    return (1 - s) * convexCircle(x) + s * concave(x);
  }

  var profiles = {
    "convex-squircle": convexSquircle,
    "convex-circle": convexCircle,
    "lip": lip,
    "concave": concave
  };

  /* ---------- 2. Physics: Snell's Law Ray Tracing on Bezel Half-Slice ----- */

  function displacementAt(profileName, distance, thickness, ior) {
    var f = profiles[profileName] || convexSquircle;
    var delta = 0.001;
    var t = Math.max(0, Math.min(1, distance));
    var height = f(t);
    var derivative =
      (f(Math.min(1, t + delta)) - f(Math.max(0, t - delta))) / (2 * delta);

    // Outward surface normal (-derivative, 1) normalized
    var nx = -derivative;
    var ny = 1;
    var normalLen = Math.hypot(nx, ny) || 1;
    nx /= normalLen;
    ny /= normalLen;

    // Ray incident from inside the glass towards viewer (0, 1)
    var incidentX = 0;
    var incidentY = 1;

    var cosTheta1 = nx * incidentX + ny * incidentY;
    var sinTheta1 = Math.sqrt(Math.max(0, 1 - cosTheta1 * cosTheta1));

    // Snell's Law: n1 * sin(theta1) = n2 * sin(theta2), with n2 = 1.0 (air)
    var n1 = ior || 1.5;
    var sinTheta2 = n1 * sinTheta1;
    var sinTheta2c = Math.max(-1, Math.min(1, sinTheta2));
    var cosTheta2 = Math.sqrt(Math.max(0, 1 - sinTheta2c * sinTheta2c));

    var ratio = n1;
    var r = ratio * cosTheta1 - cosTheta2;
    var refractedX = ratio * incidentX + r * nx;
    var refractedY = ratio * incidentY + r * ny;
    if (refractedY <= 0) return 0;

    // Lateral displacement on the background plane
    return -(refractedX * height * thickness) / refractedY;
  }

  function computeDisplacementField(profileName, thickness, ior) {
    var samples = [];
    var maxD = 1e-6;
    for (var i = 0; i < SAMPLES; i++) {
      var d = displacementAt(profileName, i / (SAMPLES - 1), thickness, ior);
      samples.push(d);
      maxD = Math.max(maxD, Math.abs(d));
    }
    return { samples: samples, max: maxD };
  }

  function sampleDisplacementField(field, t) {
    var clamped = Math.max(0, Math.min(1, t));
    var idx = clamped * (field.samples.length - 1);
    var i0 = Math.floor(idx);
    var i1 = Math.min(field.samples.length - 1, i0 + 1);
    var frac = idx - i0;
    return field.samples[i0] * (1 - frac) + field.samples[i1] * frac;
  }

  /* ---------- 3. Mathematically Exact 2D Rounded Box Signed Distance Field & Normal --------- */

  function roundedRectSdf(x, y, w, h, radius) {
    var halfW = w / 2;
    var halfH = h / 2;
    var r = Math.min(radius, halfW, halfH);

    // Centered coordinates relative to box midpoint
    var px = x - halfW;
    var py = y - halfH;

    // Distance to inner core rectangle
    var qx = Math.abs(px) - (halfW - r);
    var qy = Math.abs(py) - (halfH - r);

    // Outside corner vector
    var ox = Math.max(qx, 0);
    var oy = Math.max(qy, 0);
    var cornerDist = Math.hypot(ox, oy);

    // Inside box depth (negative when inside)
    var insideDist = Math.min(Math.max(qx, qy), 0);

    // True signed distance from the outer perimeter (0 at boundary, negative inside)
    var distance = insideDist + cornerDist - r;

    // Exact outward normal vector gradient of the SDF
    var nx = 0;
    var ny = 0;
    if (qx > 0 && qy > 0) {
      // Corner quadrant: radial gradient
      var l = cornerDist || 1;
      nx = (ox / l) * (px < 0 ? -1 : 1);
      ny = (oy / l) * (py < 0 ? -1 : 1);
    } else if (qx > qy) {
      // Left or right straight edge
      nx = px < 0 ? -1 : 1;
      ny = 0;
    } else {
      // Top or bottom straight edge
      nx = 0;
      ny = py < 0 ? -1 : 1;
    }

    return { distance: distance, nx: nx, ny: ny };
  }

  /* ---------- 4. Texture Generation (Displacement Map & Specular Map) ------ */

  var canvasPool = null;
  function getCanvas(w, h) {
    if (!canvasPool) canvasPool = document.createElement("canvas");
    canvasPool.width = w;
    canvasPool.height = h;
    return canvasPool;
  }

  /**
   * Generates RG displacement map:
   * Red = X displacement (0-255, 128 neutral)
   * Green = Y displacement (0-255, 128 neutral)
   */
  function generateDisplacementTexture(w, h, bezelPx, radiusPx, profileName, thickness, ior) {
    w = Math.max(16, Math.round(w));
    h = Math.max(16, Math.round(h));
    bezelPx = Math.max(10, Math.min(bezelPx, Math.min(w, h) / 2));
    radiusPx = Math.max(0, Math.min(radiusPx, Math.min(w, h) / 2));

    var canvas = getCanvas(w, h);
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    var imageData = ctx.createImageData(w, h);
    var data = imageData.data;
    var field = computeDisplacementField(profileName, thickness, ior);

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = (y * w + x) * 4;
        var sdf = roundedRectSdf(x, y, w, h, radiusPx);

        // Outside or on boundary: neutral 128 (no displacement)
        if (sdf.distance >= 0) {
          data[idx] = 128;
          data[idx + 1] = 128;
          data[idx + 2] = 128;
          data[idx + 3] = 255;
          continue;
        }

        var distInside = -sdf.distance;
        if (distInside >= bezelPx) {
          // Flat interior: neutral 128
          data[idx] = 128;
          data[idx + 1] = 128;
          data[idx + 2] = 128;
          data[idx + 3] = 255;
          continue;
        }

        var t = distInside / bezelPx;
        var mag = sampleDisplacementField(field, t);
        var normMag = field.max > 0 ? mag / field.max : 0;

        // Zero-clipping envelope: displacement smoothly tapers to 0 at the outer border (t=0)
        // and at the inner border (t=1). This prevents sampling outside element bounds!
        var envelope = Math.sin(t * Math.PI);
        var effectiveMag = normMag * envelope;

        // Inward displacement vector: opposite to outward normal
        var dirX = -sdf.nx;
        var dirY = -sdf.ny;

        // Map [-1, 1] to [0, 255]
        var rx = Math.round(128 + dirX * effectiveMag * 127);
        var ry = Math.round(128 + dirY * effectiveMag * 127);

        data[idx] = Math.max(0, Math.min(255, rx));
        data[idx + 1] = Math.max(0, Math.min(255, ry));
        data[idx + 2] = 128;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  }

  /**
   * Generates Specular Map:
   * Pure white rim highlight with alpha derived from light vector and normal
   */
  function generateSpecularTexture(w, h, bezelPx, radiusPx, profileName, lightAngleDeg, shininess, opacity) {
    w = Math.max(16, Math.round(w));
    h = Math.max(16, Math.round(h));
    bezelPx = Math.max(10, Math.min(bezelPx, Math.min(w, h) / 2));
    radiusPx = Math.max(0, Math.min(radiusPx, Math.min(w, h) / 2));

    var canvas = getCanvas(w, h);
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    var imageData = ctx.createImageData(w, h);
    var data = imageData.data;

    // Light direction (incoming)
    var rad = ((lightAngleDeg != null ? lightAngleDeg : -60) * Math.PI) / 180;
    // Vector towards light source
    var lx = -Math.cos(rad);
    var ly = -Math.sin(rad);

    var maxOpacity = opacity != null ? opacity : 0.65;
    var shin = shininess || 6;

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = (y * w + x) * 4;
        var sdf = roundedRectSdf(x, y, w, h, radiusPx);

        if (sdf.distance >= 0 || -sdf.distance >= bezelPx) {
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = 0;
          continue;
        }

        var distInside = -sdf.distance;
        var t = distInside / bezelPx;

        // Outward surface normal is (sdf.nx, sdf.ny)
        var dot = sdf.nx * lx + sdf.ny * ly;
        var lightIntensity = Math.pow(Math.max(0, dot), shin);

        // Add soft ambient rim reflection all around
        var ambientGlow = 0.24;
        var totalIntensity = Math.min(1, lightIntensity * 0.76 + ambientGlow);

        // Falloff from outer edge towards center
        var falloff = Math.pow(1 - t, 1.4);
        var alpha = totalIntensity * falloff * maxOpacity;

        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  }

  /* ---------- 5. SVG Filter Construction (Kube.io Standard) ---------------- */

  var svgContainer = null;
  function getSvgContainer() {
    if (!svgContainer) {
      svgContainer = document.getElementById("lg-svg-defs-container");
      if (!svgContainer) {
        svgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgContainer.id = "lg-svg-defs-container";
        svgContainer.setAttribute("aria-hidden", "true");
        svgContainer.style.cssText =
          "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;z-index:-999";
        var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        svgContainer.appendChild(defs);
        document.body.appendChild(svgContainer);
      }
    }
    return svgContainer.querySelector("defs");
  }

  function svgElement(name, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (var k in attrs) {
      el.setAttribute(k, attrs[k]);
    }
    return el;
  }

  /**
   * Constructs the clean Kube.io SVG Filter Graph:
   * 1. feGaussianBlur (smooth pre-blur inside the filter)
   * 2. feImage (displacement map)
   * 3. feDisplacementMap (Snell's law refraction)
   * 4. feImage (specular white rim gleam)
   * 5. feBlend mode="screen" (luminous highlight overlay, zero darkening)
   */
  function createLiquidFilter(filterId, w, h, dispUrl, specUrl, s) {
    var defs = getSvgContainer();
    var old = document.getElementById(filterId);
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var filter = svgElement("filter", {
      id: filterId,
      x: "0",
      y: "0",
      width: String(w),
      height: String(h),
      filterUnits: "userSpaceOnUse",
      primitiveUnits: "userSpaceOnUse",
      "color-interpolation-filters": "sRGB"
    });

    // 1. Soft anti-aliasing pre-blur
    filter.appendChild(
      svgElement("feGaussianBlur", {
        in: "SourceGraphic",
        stdDeviation: String(s.blurLevel || 0.8),
        result: "blurred_source"
      })
    );

    // 2. Refraction Displacement Map
    filter.appendChild(
      svgElement("feImage", {
        href: dispUrl,
        x: "0",
        y: "0",
        width: String(w),
        height: String(h),
        result: "displacement_map"
      })
    );

    filter.appendChild(
      svgElement("feDisplacementMap", {
        in: "blurred_source",
        in2: "displacement_map",
        xChannelSelector: "R",
        yChannelSelector: "G",
        scale: String(s.refractionScale || 65),
        result: "displaced"
      })
    );

    // 3. Specular Highlight Map (White rim gleam)
    filter.appendChild(
      svgElement("feImage", {
        href: specUrl,
        x: "0",
        y: "0",
        width: String(w),
        height: String(h),
        result: "specular_layer"
      })
    );

    // 4. Screen blend: adds pure luminous gleam over displaced background without darkening or clipping
    filter.appendChild(
      svgElement("feBlend", {
        in: "specular_layer",
        in2: "displaced",
        mode: "screen"
      })
    );

    defs.appendChild(filter);
    return filter;
  }

  /* ---------- 6. Dynamic Element Manager & Registry ------------------------ */

  var registeredElements = new Map();
  var resizeObserver = null;
  var filterCounter = 0;

  function getElementRadius(el) {
    try {
      var cs = window.getComputedStyle(el);
      var r = parseFloat(cs.borderRadius) || 26;
      return r;
    } catch (e) {
      return 26;
    }
  }

  function applyFilterToElement(el, customOpts) {
    if (!SETTINGS.enabled) return;
    var rect = el.getBoundingClientRect();
    var w = Math.round(rect.width) || el.offsetWidth || 300;
    var h = Math.round(rect.height) || el.offsetHeight || 200;
    if (w <= 10 || h <= 10) return;

    var s = Object.assign({}, SETTINGS, customOpts || {});
    var radius = customOpts && customOpts.radius != null ? customOpts.radius : getElementRadius(el);
    var bezel = Math.min(s.bezel, Math.max(10, Math.min(radius, Math.min(w, h) / 3)));

    // Clean up old filter node if any
    var oldFilterId = el.dataset.lgFilterId;
    if (oldFilterId) {
      var oldFilter = document.getElementById(oldFilterId);
      if (oldFilter && oldFilter.parentNode) oldFilter.parentNode.removeChild(oldFilter);
    }

    // Always increment filterCounter to give a fresh ID.
    // Changing the filter ID forces Chromium's style engine to invalidate
    // the cached backdrop-filter texture and repaint immediately!
    var filterId = "lg-filter-" + (++filterCounter);
    el.dataset.lgFilterId = filterId;

    var dispUrl = generateDisplacementTexture(w, h, bezel, radius, s.profile, s.thickness, s.ior);
    var specUrl = generateSpecularTexture(w, h, bezel, radius, s.profile, s.lightAngle, s.shininess, s.specularOpacity);

    el.classList.add("has-liquid-glass");

    // Wire dynamic fluid specular light tracking
    if (!el.dataset.liquidWired) {
      el.dataset.liquidWired = "true";
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var x = ((e.clientX - r.left) / r.width) * 100;
        var y = ((e.clientY - r.top) / r.height) * 100;
        el.style.setProperty("--mx", x.toFixed(1) + "%");
        el.style.setProperty("--my", y.toFixed(1) + "%");
      });
      el.addEventListener("pointerleave", function () {
        el.style.removeProperty("--mx");
        el.style.removeProperty("--my");
      });
      el.addEventListener("pointerdown", function (e) {
        // Trigger subtle liquid refraction ripple
        var r = el.getBoundingClientRect();
        var ripple = document.createElement("span");
        ripple.className = "liquid-ripple";
        ripple.style.left = (e.clientX - r.left) + "px";
        ripple.style.top = (e.clientY - r.top) + "px";
        el.appendChild(ripple);
        setTimeout(function () { if (ripple.parentNode) ripple.parentNode.removeChild(ripple); }, 800);
      });
    }
  }

  function removeFilterFromElement(el) {
    el.style.backdropFilter = "";
    el.style.webkitBackdropFilter = "";
    el.classList.remove("has-liquid-glass");
    var filterId = el.dataset.lgFilterId;
    if (filterId) {
      var oldFilter = document.getElementById(filterId);
      if (oldFilter && oldFilter.parentNode) oldFilter.parentNode.removeChild(oldFilter);
    }
  }

  function registerElement(el, customOpts) {
    if (!el) return;
    registeredElements.set(el, customOpts || {});

    if (resizeObserver) {
      resizeObserver.observe(el);
    }

    applyFilterToElement(el, customOpts);
  }

  function unregisterElement(el) {
    if (!el) return;
    registeredElements.delete(el);
    if (resizeObserver) resizeObserver.unobserve(el);
    removeFilterFromElement(el);
  }

  function refreshAll() {
    if (!SETTINGS.enabled) {
      document.documentElement.classList.remove("liquid");
      document.documentElement.classList.add("no-liquid");
      return;
    }

    document.documentElement.classList.add("liquid");
    document.documentElement.classList.remove("no-liquid");
  }

  function togglePrecisionLens() {
    return false;
  }

  /* ---------- 8. Public Initialization & Engine API ------------------------- */

  function init() {
    try {
      if (typeof window === "undefined" || !document.body) return false;

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(function (entries) {
          entries.forEach(function (entry) {
            var el = entry.target;
            if (registeredElements.has(el)) {
              applyFilterToElement(el, registeredElements.get(el));
            }
          });
        });
      }

      document.documentElement.classList.add("liquid");

      // Register card widgets and search bar (clean individual glass elements)
      var cards = document.querySelectorAll(".card, .search");
      cards.forEach(function (el) {
        registerElement(el);
      });

      return true;
    } catch (err) {
      console.warn("LiquidGlass initialization error:", err);
      return false;
    }
  }

  function updateSettings(newSettings) {
    Object.assign(SETTINGS, newSettings || {});
    refreshAll();
  }

  function toggle(enabled) {
    SETTINGS.enabled = !!enabled;
    refreshAll();
  }

  // Export engine
  window.LiquidGlass = {
    init: init,
    settings: SETTINGS,
    profiles: Object.keys(profiles),
    registerElement: registerElement,
    unregisterElement: unregisterElement,
    applyToElement: applyFilterToElement,
    updateSettings: updateSettings,
    refresh: refreshAll,
    toggle: toggle,
    togglePrecisionLens: togglePrecisionLens
  };
})();
