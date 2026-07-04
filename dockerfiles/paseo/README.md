# paseo

Builds `paseo-with-agents`, a [Paseo](https://github.com/getpaseo/paseo) daemon image
(`ghcr.io/getpaseo/paseo`) with Claude Code, pi, and uv installed on top, so agent
sessions launched through Paseo have those CLIs available.

Run via `docker compose up -d` from this directory on the host. Requires a `.env`
file (see `.env.example`) with `TS_IP`, `PASEO_PASSWORD`, and `OPENROUTER_API_KEY` —
kept outside this repo since it holds secrets.
