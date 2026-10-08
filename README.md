# 🫧 Glass Widget — Apple Liquid Glass New Tab Extension

<div align="center">

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Chrome Compatible](https://img.shields.io/badge/Chrome-Extension-0F9D58?style=for-the-badge&logo=google-chrome&logoColor=white)](https://www.google.com/chrome/)
[![Edge Compatible](https://img.shields.io/badge/Edge-Compatible-0078D7?style=for-the-badge&logo=microsoftedge&logoColor=white)](https://www.microsoft.com/edge)
[![Brave Compatible](https://img.shields.io/badge/Brave-Compatible-FB542B?style=for-the-badge&logo=brave&logoColor=white)](https://brave.com/)
[![Pure Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript%20ES2024-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![CSS3 Glassmorphism](https://img.shields.io/badge/CSS3-Liquid%20Glass%20Physics-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=for-the-badge)](https://github.com/Akash7037/Glass-Widget-/pulls)

<p align="center">
  <b>A futuristic, crystal-clear new tab dashboard for Chromium browsers featuring Apple WWDC 2025 Liquid Glass refraction physics, live Radar news, daily web browsing screen-time analytics, modular drag-and-drop widgets, and an intelligent Pomodoro focus shield.</b>
</p>

[Key Features](#-key-features) •
[Installation Guide](#-installation-guide) •
[Widgets & Capabilities](#-widgets--capabilities) •
[Liquid Glass Physics](#-liquid-glass-physics-architecture) •
[Controls & Customization](#-controls--customization) •
[Special Thanks & Credits](#-special-thanks--credits) •
[Privacy & Permissions](#-privacy--security)

</div>

---

## ✨ Key Features

- ⚡ **Animated Boot Reveal & Zero-FOUC**: Zero flash of unstyled content on page refresh or tab open! Features an ultra-smooth animated splash unveil where a centered search/glass emblem scales down and glides upward directly into the search bar while dissolving the dark curtain to reveal your widgets.
- 🔍 **Google Lens Visual Search**: Search by image directly from your new tab search bar! Features an interactive Google Lens modal with drag-and-drop file upload, native file picker, paste image link, and clipboard image pasting (`Ctrl + V`), fully routed via native extension tab APIs (`chrome.tabs.create`) with zero active file chooser popup blocking.
- 📊 **Dedicated Analytics & Focus Studio**: A minimalist, high-contrast analytics dashboard (`analytics.html`) crafted with clean developer aesthetics ("vibe coded", non-glassmorphic, fast & distraction-free) to keep the home page uncluttered.
- 🏷️ **Smart Website Categorization**: Automatically groups visited domains into intuitive categories:
  - 📚 **Study & Learning** (Coursera, LeetCode, edX, Khan Academy, Wikipedia, .edu portals)
  - 🔬 **Research & Academic** (arXiv, Google Scholar, PubMed, ScienceDirect, ResearchGate)
  - 💻 **Development & Coding** (GitHub, StackOverflow, MDN, Dev.to, Vercel, AWS)
  - ⚡ **Productivity & Work** (Notion, Google Docs, Figma, ChatGPT, Claude, Slack)
  - 🎬 **Entertainment & Media** (YouTube, Netflix, Twitch, Spotify, Disney+)
  - 💬 **Social Media** (X / Twitter, Reddit, Instagram, Discord, LinkedIn)
  - 📰 **News & Reading** (Hacker News, TechCrunch, The Verge, BBC)
  - 🌐 **Other & Utilities** + instant one-click custom category re-assignment!
- 📈 **Interactive Visual Charts**:
  - 🍩 **Category Donut / Pie Chart**: SVG-rendered interactive wheel with slice hover highlights, central duration readout, and dynamic percentage legends.
  - 📊 **Category Time Bar Chart**: Proportional horizontal distribution bars comparing minutes across categories.
- 🎯 **Post-Session Accomplishment Logger**: Prompted immediately after every focus sprint on the New Tab page to log what you accomplished (e.g. solved 3 problems, summarized paper, fixed auth bug).
- 📜 **Focus Accomplishment History & Management**: Chronological timeline of all completed study sessions with duration pills, accomplishment quotes, category tags, search filters, single item removal, and one-click **Clear History** with confirmation.
- ➕ **Manual Focus Session Logging & Data Export**: Log offline study sessions manually and export your complete browsing analytics and focus history as JSON anytime.
- 💎 **Apple Liquid Glass Optics (WWDC 2025)**: Models physical light refraction using Snell's Law ($n_1 \sin\theta_1 = n_2 \sin\theta_2$), dual-layer 3D specular bevels, rainbow prismatic chromatic rim dispersion (cyan & violet), and dynamic cursor sheen tracking.
- ⚡ **Zero-Dependency Vanilla Architecture**: Built entirely with Vanilla HTML5, CSS3 Custom Properties, and ES2024 JavaScript. Zero npm runtime dependencies, sub-20ms instant cold boot.
- 🛡️ **Pomodoro Focus Shield with Site Blocker**: Native Chrome `declarativeNetRequest` rule engine dynamically blocking distracting domains during focus sprints.
- 📐 **Modular Freeform Canvas**: Seamlessly toggle between a structured responsive grid and a freeform drag-and-drop canvas where every widget can be freely positioned and resized (`⌟`).

---

## 🚀 Installation Guide

Works natively on **Google Chrome**, **Microsoft Edge**, **Brave**, **Opera**, **Vivaldi**, and **Arc**.

### Step 1: Clone or Download the Repository

```bash
git clone https://github.com/Akash7037/Glass-Widget-.git
```

*(Alternatively, click **Code → Download ZIP** on GitHub and extract the folder to your preferred directory).*

### Step 2: Load Unpacked into Chromium Browser

1. Open your browser and navigate to the Extensions manager:
   - **Chrome**: `chrome://extensions`
   - **Brave**: `brave://extensions`
   - **Edge**: `edge://extensions`
   - **Arc**: `arc://extensions`
2. Toggle on **Developer mode** (switch located in the top-right corner).
3. Click the **Load unpacked** button in the top-left toolbar.
4. Select the cloned folder (`Glass-Widget-` or `liquid-glass-newtab`).
5. Open a new tab (`Ctrl + T` on Windows/Linux or `Cmd + T` on macOS) to experience your new liquid glass dashboard!

---

## 🧩 Widgets & Capabilities

| Widget / Feature | Capabilities |
| :--- | :--- |
| **Google Lens Search** | Native visual reverse-image search integrated into the search bar. Drag & drop images, upload from disk, paste direct image URLs, or paste from clipboard (`Ctrl + V`). |
| **Analytics & Focus Studio** | Dedicated standalone dashboard (`analytics.html`) featuring minimalist developer styling, auto domain categorization (Study, Research, Coding, etc.), and interactive charts. |
| **Category Visual Charts** | Interactive SVG Donut / Pie chart with dynamic slice hover readouts and percentages, paired with comparative category duration bar graphs. |
| **Accomplishment History** | Post-focus completion modal prompting you to log what you accomplished. Searchable history timeline with category badges, duration pills, and one-click Clear History. |
| **Clock & Greetings** | Crisp liquid glass time display with live seconds, weekday, calendar date, timezone, quick 12H/24H toggle, and randomized inspirational vibe-coding quotes. |
| **News Radar** | Live real-time headline aggregator featuring 3 categorized feeds (AI Tech, Vibe Coding, World Breaking) with Hacker News live API integration and manual refresh. |
| **Weather** | Real-time weather and 5-day forecasts powered by Open-Meteo with zero API key required. Geolocation auto-detection or instant city search with °C / °F switching. |
| **Today (Tasks)** | Lightweight task organizer featuring instant add, inline completion check, task deletion, and remaining task counter. |
| **Saved Links** | Full CRUD bookmark manager: add new sites, click the pencil icon (`✎`) to edit existing titles and URLs, delete items, and auto-fetch favicons. |
| **Notes** | Autosaving liquid glass scratchpad for code snippets, markdown, or thoughts with immediate local storage synchronization. |
| **Focus Timer** | Pomodoro session timer integrated with Chrome's native `declarativeNetRequest` rules to block distracting websites during focus sprints. |

---

## 🔮 Liquid Glass Physics Architecture

Unlike standard CSS `backdrop-filter: blur()`, true Liquid Glass models how light actually bends when passing through curved convex optical glass:

```
                  Light Source (Ray at θ = -60°)
                            \
                             \   Specular Highlight Peak
                              v  /
         _____________________.-''''-._____________________
        |                    /  Bevel \                    |
        |                   | Refract  |                   |
        |                   |  Shadow  |                   |
        |===================\==========/===================|
        |                Liquid Glass Body                 |
        |  Backdrop Wallpaper refracted by Snell's Law     |
        |__________________________________________________|
```

### 1. Snell's Law Refraction ($n_1 \sin\theta_1 = n_2 \sin\theta_2$)
Light incident from inside the glass medium ($n_1 = 1.5$) bends according to the local surface normal $(-f'(x), 1)$ of the bezel before emerging into ambient air ($n_2 = 1.0$).

### 2. Apple Squircle Profile
The bezel utilizes Apple's signature curvature profile:
$$y = \left(1 - (1 - x)^4\right)^{1/4}$$
This produces a smooth, continuous transition from curvature into the planar center without harsh boundary creases.

### 3. Prismatic Chromatic Dispersion
Light splitting along the edges creates spectral rainbow dispersion:
- **Cyan Sheen (`#38bdf8`)**: Primary refractive dispersion on the light-facing rim.
- **Violet Sheen (`#c084fc`)**: Secondary chromatic refraction on the counter-angled rim.
- **Pure White Crest (`#ffffff`)**: Luminous specular reflection aligned to the light source vector.

---

## 🎛️ Controls & Customization

Click the **Gear Icon (⚙)** in the top right to open the **Settings Drawer**:

- **Glass Appearance**:
  - **Blur (0px – 40px)**: Slide down to 0px for pure crystal transparency; slide up to 40px for deep frosted glass.
  - **Opacity (2% – 90%)**: Adjusts optical glass density without muddy color tinting.
  - **Radius (8px – 44px)**: Adjusts corner curvature from tight squircle to pill capsule.
  - **Accent Color Picker**: Dynamically re-themes buttons, progress bars, and highlights.
  - **Wallpaper Engine**: 4 curated gradients or upload any custom high-resolution photo.
- **Liquid Glass Physics**:
  - **Refraction Scale (5px – 60px)**: Calibrates internal optical caustic depth.
  - **Bezel Width (10px – 44px)**: Expands or contracts the physical 3D bevel edge and chromatic rim stroke.
  - **Rim Gleam (5% – 100%)**: Adjusts the intensity of the pure white specular reflection.
  - **Rim Saturation (0x – 12x)**: Adjusts the vibrancy of the rainbow chromatic dispersion.
  - **Light Angle (-180° – 180°)**: Rotates the physical 3D light vector around the widgets in real time.

### Keyboard Shortcuts

| Shortcut | Action |
| :---: | :--- |
| `E` | Toggle **Edit Layout Mode** (drag widgets and resize freely) |
| `/` | Instantly focus the **Search Bar** |
| `Esc` | Close Settings Drawer / Exit Edit Mode |
| `Click on Clock` | Instant toggle between **12-Hour** and **24-Hour** format |
| `Click on 🎲` | Reroll the inspirational **Vibe Coding Greeting** |

---

## 📁 Project Structure

```text
Glass-Widget-/
├── manifest.json        # Chrome Extension MV3 Manifest
├── newtab.html          # Semantic HTML5 layout and widget architecture
├── newtab.css           # Hardware-accelerated CSS3 liquid glass design system
├── newtab.js            # Core application state, Google Lens, Focus accomplishment prompt
├── analytics.html       # Standalone minimalist Analytics & Focus Studio page
├── analytics.css        # High-contrast, non-glassmorphic responsive dashboard styles
├── analytics.js         # Category taxonomy engine, interactive SVG charts & history manager
├── liquid.js            # Liquid glass physics engine, Snell's law SDF & ray-tracing
├── background.js        # Service worker (screen time logging, Lens upload, focus blocker)
├── blocked.html         # Custom motivational landing page for blocked sites
├── blocked.css          # Styling for focus-blocked notification screen
├── blocked.js           # Logic and countdown timer for blocked page
├── icons/               # High-res extension icons (16px, 32px, 48px, 128px)
├── .gitignore           # Git ignore rules for clean repository state
└── README.md            # Comprehensive project documentation
```

---

## 🔒 Privacy & Security

Glass Widget is built with a **strict privacy-first architecture**:
- **100% Local Storage**: All settings, notes, tasks, bookmarks, and screen time statistics are stored exclusively in your browser via `chrome.storage.local`.
- **Zero Telemetry**: No third-party trackers, no tracking pixels, and no analytics SDKs.
- **Zero External CDNs**: All scripts, fonts, and stylesheets are bundled locally for offline security and instant page loads.
- **Minimal Permissions**:
  - `storage`: Preserves your layout, tasks, notes, and custom preferences.
  - `declarativeNetRequest`: Enables non-intrusive domain redirection for the Focus blocker.
  - `topSites` / `tabs`: Powers the private Web Screen Time analytics widget locally.

---

## 🙏 Special Thanks & Credits

A massive, heartfelt shoutout and credit to:

* **[kube.io](https://kube.io)** for their seminal, ground-breaking research article:  
  📖 **[Liquid Glass in the Browser: Refraction with CSS and SVG](https://kube.io/blog/liquid-glass-css-svg/)**  
  Which laid out the foundational mathematics of Snell's Law ray-tracing, Apple Squircle surface normals, dynamic 2D displacement maps, and specular lighting in modern web browsers.
* **[Z1Code/glass-refraction](https://github.com/Z1Code/glass-refraction)** and the open-source web optics community for pioneering experiments translating physical refractive shaders into accessible CSS and SVG graphics.
* **Apple Design Team** for the visionary Liquid Glass aesthetic introduced at WWDC 2025.

---

## 🤝 Contributing

Contributions, feature suggestions, and bug reports are warmly welcomed!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m "Add some AmazingFeature"`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

<div align="center">
  <sub>Crafted with passion for clean design, optical physics, and productivity. Vibe Code by <a href="https://github.com/Akash7037">Akash</a>. with Antigravity</sub>
</div>
