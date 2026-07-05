FROM ghcr.io/getpaseo/paseo:0.1.103

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    procps \
    python3 \
    python3-pip \
    python3-venv \
    ripgrep \
    build-essential \
    jq \
    less \
    unzip \
    wget \
    stow \
    git-crypt \
    poppler-utils \
    fd-find \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent@0.80.2

# git-delta isn't packaged for bookworm; install the upstream .deb directly.
RUN wget -qO /tmp/git-delta.deb \
    https://github.com/dandavison/delta/releases/download/0.19.2/git-delta_0.19.2_amd64.deb \
    && dpkg -i /tmp/git-delta.deb \
    && rm /tmp/git-delta.deb

# /workspace is only populated at runtime (bind mount), but scripts that fall
# back to ~/Repos/dotfiles (e.g. dotfiles-audit) need the path to resolve.
RUN ln -s /workspace /home/paseo/Repos

USER paseo
RUN curl -fsSL https://claude.ai/install.sh | bash -s 2.1.201
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/home/paseo/bin:/home/paseo/.local/bin:${PATH}"

# /etc/profile unconditionally overwrites (not appends to) PATH for login
# shells, discarding the ENV PATH above — an actual interactive agent session
# uses a login shell, so it needs this too.
USER root
RUN echo 'export PATH="/home/paseo/bin:/home/paseo/.local/bin:$PATH"' \
    > /etc/profile.d/paseo-agent-path.sh
USER paseo

# Pre-warm crawl4ai's Playwright chromium so the first `webcrawl` call isn't
# slow/networked. System libs need root; the browser binary itself installs
# into paseo's cache since that's the user webcrawl runs as. crawl4ai-setup
# internally calls `playwright install --with-deps`, which tries to escalate
# via `su` and fails (paseo has no root password) — harmless (it still does
# its own DB init), but it means the browser download needs a direct call
# without --with-deps afterwards.
USER root
RUN npx --yes playwright install-deps chromium
USER paseo
RUN uvx --from 'crawl4ai==0.9.0' crawl4ai-setup || true
RUN uv run --with 'crawl4ai==0.9.0' python3 -m playwright install chromium

USER root
COPY provision-agents.sh /usr/local/bin/provision-agents.sh
RUN chmod +x /usr/local/bin/provision-agents.sh
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/provision-agents.sh"]
