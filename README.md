# ASCII Smuggler

Payload encoding toolkit for Unicode smuggling, steganography, and text obfuscation.

**[Live Demo →](https://ascii-smuggler.pages.dev)**

![ASCII Smuggler](https://img.shields.io/badge/astro-5-purple) ![Tailwind](https://img.shields.io/badge/tailwind-4-blue) ![Cloudflare Pages](https://img.shields.io/badge/deploy-cloudflare_pages-orange)

## What it does

Encode and decode text using 8 different smuggling techniques:

| Technique | Category | Risk | Description |
|---|---|---|---|
| Unicode Confusables | Visual | High | Cyrillic/Greek lookalike substitution |
| Zero-Width Encoding | Steganographic | Critical | Invisible zero-width character encoding |
| Hex Escape Encoding | Obfuscation | Medium | `\xNN` hex escape sequences |
| Chunked Base64 | Obfuscation | Medium | Indexed base64 segments |
| RTL Override | Directional | High | Right-to-left text direction spoofing |
| HTML Comment Injection | Structural | Medium | Payload hidden in HTML comments |
| Case-Bit Steganography | Steganographic | Low | Binary data in letter casing |
| Multi-Script Homoglyphs | Visual | High | Cross-script character substitution |

## Features

- **Pipeline mode** — chain multiple techniques together
- **Diff view** — see exactly which codepoints changed
- **Hex dump** — raw byte inspection
- **Codepoint inspector** — visual Unicode analysis
- **Operation log** — track every encoding step
- **Copy / Reverse** — quick workflow actions
- **Responsive** — works on mobile

## Stack

- [Astro](https://astro.build) — static site framework
- [React](https://react.dev) — interactive island
- [Tailwind CSS v4](https://tailwindcss.com) — styling
- [Cloudflare Pages](https://pages.cloudflare.com) — hosting

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Deploy to Cloudflare Pages

### Option 1: Git integration

1. Push to GitHub
2. Go to [Cloudflare Pages](https://dash.cloudflare.com/?to=/:account/pages/new/provider/github)
3. Select the repo
4. Settings:
   - **Build command**: `npm run build`
   - **Build output**: `dist`
   - **Node version**: 18+

### Option 2: Direct upload

```bash
npm run build
npx wrangler pages deploy dist --project-name=ascii-smuggler
```

## Educational Purpose

This tool is built for **security research and education**. Understanding these encoding techniques helps defenders build better detection systems. Use responsibly.

## License

MIT
