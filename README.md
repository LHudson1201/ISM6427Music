# SongForge — AI Music Generator

A web app that lets anyone turn an idea into a full song using the [sunoapi.org](https://docs.sunoapi.org/) music API. Built as a static site and Netlify Functions. There is no build step and there are no dependencies.

## Features
- **Simple mode**: describe a song in plain English and the AI writes the lyrics and produces it.
- **Custom mode**: add your own title, lyrics, style, styles to exclude, vocal gender, duration, style adherence, weirdness and variety.
- **AI lyric writer**: generate lyric options from a theme and drop one into the song with a click.
- **Models**: V6 (best quality), V6 Wild (more creative) and V6 Mini (fastest).
- **Live progress**: songs appear as streaming previews, then switch to the final MP3 when it's ready.
- **Library and player**: songs are saved in your browser, and you can play, see the lyrics and download each one.
- **Credit balance** shown in the header.

## How it works
```
Browser (public/)  ──►  /api/*  (netlify/functions/)  ──►  https://api.sunoapi.org
                         adds Authorization: Bearer $SUNO_API_KEY
```
The API key is stored **only** as a Netlify environment variable. It is never sent to the browser or committed to git.

| Route | Suno endpoint |
|---|---|
| `POST /api/generate` | `POST /api/v1/generate` |
| `GET /api/status?taskId=` | `GET /api/v1/generate/record-info` |
| `POST /api/lyrics`, `GET /api/lyrics?taskId=` | `POST /api/v1/lyrics`, `GET /api/v1/lyrics/record-info` |
| `GET /api/credits` | `GET /api/v1/generate/credit` |
| `POST /api/callback` | Receives Suno's required callback (no-op; the app polls) |

## Deploy to Netlify
1. In Netlify, choose **Add new site → Import an existing project** and pick this repo and the `main` branch.
2. Leave the build command empty. `netlify.toml` already sets the publish directory to `public` and the functions directory to `netlify/functions`.
3. Go to **Site configuration → Environment variables** and add:
   - `SUNO_API_KEY` = your key from https://sunoapi.org/api-key
4. Deploy, or trigger a redeploy if you added the variable after the first deploy.

## Local development
```bash
npm i -g netlify-cli
SUNO_API_KEY=your_key netlify dev
```
