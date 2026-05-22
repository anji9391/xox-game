# Snake

A smooth, modern Snake game built with vanilla HTML, CSS, and JavaScript — ready for [GitHub Pages](https://pages.github.com/).

## Play locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Deploy to GitHub Pages

1. Create a repo on GitHub and push this folder.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose branch `main` (or `master`) and folder **`/ (root)`**.
5. Save. Your game will be live at `https://<username>.github.io/<repo>/`.

If the repo lives in a monorepo subfolder, either make this folder the repo root or set **Pages** to publish from the branch that contains these files at root.

## Controls

| Input | Action |
|-------|--------|
| Arrow keys / WASD | Move |
| Swipe (mobile) | Move |
| On-screen D-pad | Move (mobile) |
| Space / P | Pause |
| Play / Resume buttons | Start or continue |

## Features

- Interpolated snake movement for smooth animation
- Particle effects when eating food
- Speed increases as you score
- High score saved in `localStorage`
- Responsive layout with touch controls
