# Christian Lawas — Portfolio

Vite + GSAP static site, published to GitHub Pages.
Live: https://justindiango-hype.github.io/christianlawas/

## Run it locally
```bash
npm install      # once
npm run dev      # converts any new photos, then opens a live preview
```
Open the address it prints (http://localhost:5173/christianlawas/).

## Change details
- Email, WhatsApp, footer credit: `site.config.js`
- Chapter text: `index.html`
- Background light & dust strength per chapter: top of `src/js/ambient.js`
- Photos: drop files into `photos/<category>/`. The first file listed in that
  folder's `order.txt` is the chapter cover.

## Publish
Every push to `main` builds and publishes the site automatically
(`.github/workflows/deploy.yml`). In VS Code: Source Control → write a message
→ Commit → Sync Changes.

One-time setup on GitHub: repository **Settings → Pages → Source: GitHub Actions**.

## Using your own domain later
1. Add a file `public/CNAME` containing the domain, e.g. `christianlawas.com`.
2. In `vite.config.js`, change `base` to `'/'`.
3. In `site.config.js`, change `siteUrl` to the new address
   (and update the two URLs in `public/robots.txt` and `public/sitemap.xml`).
4. Point the domain's DNS at GitHub Pages (Settings → Pages shows the records).
