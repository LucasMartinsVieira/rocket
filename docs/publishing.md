---
title: Publishing the documentation
---

[Documentation home](index.md)

# Publishing the documentation

GitHub Pages hosts static websites from a repository. For Rocket, GitHub uses Jekyll to turn the Markdown files in `docs/` into web pages. `docs/index.md` is the home page, and `docs/_config.yml` sets the title and theme. This publishes the **guides**, not the Android app or an APK.

## Enable Pages once

1. Commit the documentation and push it to the GitHub repository's `main` branch.
2. In the repository on GitHub, open **Settings → Pages**. You need permission to manage the repository's Pages settings.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose branch **`main`** and folder **`/docs`**, then click **Save**.
5. Check the repository's **Actions** tab for the Pages build. When it succeeds, use **Visit site** from the Pages settings. Rocket's expected project URL is `https://lucasmartinsvieira.github.io/rocket/`.

You don't need a custom workflow or an Expo build. If the site doesn't appear, check that the docs are on `main` and inspect the Pages build log in **Actions**. See [GitHub's publishing-source guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Update the site

Edit the Markdown files in `docs/`, then commit and push or merge the changes into `main`. GitHub rebuilds the site automatically. To add a guide, create a Markdown file with a `title` in its front matter and link it from `docs/index.md`.

Assume the published documentation is public. Don't put personal backups, test credentials, signing keys, or private screenshots under `docs/`.
