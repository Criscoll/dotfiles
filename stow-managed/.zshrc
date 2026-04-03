# === Powerlevel10k ===
#
# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

source ~/powerlevel10k/powerlevel10k.zsh-theme
# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

# === Completion ===

zstyle ':completion:*' menu select
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
autoload -Uz compinit
compinit

# === History ===

setopt SHARE_HISTORY          # Share history between all sessions
setopt INC_APPEND_HISTORY     # Add commands as they are typed, not at shell exit
setopt HIST_EXPIRE_DUPS_FIRST # Expire duplicate entries first
setopt HIST_IGNORE_DUPS       # Don't record duplicate commands
setopt HIST_IGNORE_ALL_DUPS   # Remove older duplicate commands from history
setopt HIST_FIND_NO_DUPS      # Do not display duplicates when searching
setopt HIST_IGNORE_SPACE      # Don't record commands starting with a space
setopt HIST_SAVE_NO_DUPS      # Don't write duplicate entries to history file

HISTSIZE=10000
SAVEHIST=10000
HISTFILE=~/.zsh_history

# === Environment & PATH ===

export PATH="$HOME/Repos/tmux:$PATH"
export PATH="$HOME/Repos/alacritty/target/release:$PATH"
export PATH="$HOME/Applications/nvim-linux-x86_64/bin:$PATH"
export PATH="$HOME/Applications/helix:$PATH"
export PATH="$HOME/.cargo/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"
export PATH="$HOME/Applications/llama_cpp/build/bin:$PATH"
export PATH="/usr/local/cuda-12/bin:$PATH"
export PATH=$PATH:/usr/local/go/bin
export PATH="$PATH:/home/cristian/.lmstudio/bin"  # Added by LM Studio CLI (lms)

export PNPM_HOME="/home/cristian/.local/share/pnpm"
[[ ":$PATH:" != *":$PNPM_HOME:"* ]] && export PATH="$PNPM_HOME:$PATH"

export GOPATH="$HOME/.go/"
export TERM="tmux-256color"

# === Keybindings ===

# Word navigation
bindkey "^[[1;3D" backward-word     # Option+left
bindkey "^[[1;3C" forward-word      # Option+right

# Line start/end
bindkey "^[[1;5D" beginning-of-line # Ctrl+left
bindkey "^[[1;5C" end-of-line       # Ctrl+right

# Fuzzy comma-command picker (Ctrl+E)
function select_comma_command() {
    local selected_command=$(compgen -ac | grep '^,' | sort -u | fzf)
    if [[ -n $selected_command ]]; then
        LBUFFER+="$selected_command"
    fi
    zle redisplay
}
zle -N select_comma_command
bindkey '^e' select_comma_command

# === Aliases ===

alias open="xdg-open"

# Color
alias ls="ls --color=auto"
alias lsr="ls -1tr"
alias l="ls -lah --color=auto"
alias dir="dir --color=auto"
alias vdir="vdir --color=auto"
alias grep="grep --color=auto"
alias fgrep="fgrep --color=auto"
alias egrep="egrep --color=auto"

# Tools
alias fd="fdfind"
alias py="python3"
alias apts="apt search --names-only"
alias update_all="snap refresh && flatpak update && sudo apt update"
alias gcalcli_activate="source ~/Repos/gcalcli/venv/bin/activate"

# Navigation
alias notes="type notes; cd /home/cristian/Documents/Obsidian"
alias workbench="type workbench; cd /home/cristian/Documents/Obsidian/02_Workbench/"
alias tasks="type tasks; cd /home/cristian/Documents/Obsidian/02_Workbench/02_Tasks"
alias projects="type projects; cd /home/cristian/Repos/01_Projects"

# Maven
alias mvn_build='mvn clean install -T 1C'
alias mvn_build_offline='mvn clean install --offline -T 1C'

# Jupytext
alias ,jupytext-ipynb-to-py="jupytext --set-formats ipynb,py:percent *.py"
alias ,jupytext-py-to-ipynb="jupytext --set-formats ipynb,py:percent *.ipynb"

# --- Git ---

alias sgs="stg series"
alias sgss="stg series; git status"
alias sgra="type sgra; git add .; stg refresh"
alias sgp="type sgp; stg pop --all; sgss; git pull --rebase"

alias gp="git pull --rebase"
alias gpl="git pull --rebase"
alias gs="git status"
alias ga="git add ."
alias gcm="git commit -m"
alias gca="git commit --amend"
alias gcae="git commit --amend --no-edit"

alias gd="git diff --stat -p | delta --line-numbers"
alias gdnl="git diff --stat -p"
alias gds="git diff --stat -p | delta --side-by-side"

alias gl="git log --color --pretty=format:'%C(yellow)%h %C(reset)%C(cyan)(%ar)%C(reset) %C(white)%s - %C(reset)%C(green)%an%C(reset)'"
alias gll="gl | head"
alias glm="gl --author='Cristian Bernal'"
alias gllm="gl --author='Cristian Bernal'| head"
alias gla="git log --oneline --graph"
alias gld="git log --color --date=short --stat -p"

alias glh="git show --stat -p -U30 HEAD | delta --line-numbers"
alias glhf="git show --name-only HEAD"
alias glhs="git show --stat -p -U30 HEAD | delta --line-numbers --side-by-side"
alias glhsnl="git show --stat -p -U30 HEAD | delta --side-by-side"
alias glhnl="git show --stat -p -U30 HEAD"

alias glinl="git show --color --stat -p -U30"
alias glif="git show --name-only"
alias gbl="git blame -w -M -C"
alias grh="git restore --source=HEAD^ --"

function gli() {
    if [[ -z "$1" ]]; then
        echo "Usage: gli <commit-hash>"
        return 1
    fi

    local context_lines=30
    if [[ -n "$2" ]]; then
        context_lines=$2
    fi

    cmd="git show --color --stat -p -U$context_lines $1 | delta --line-numbers"
    echo $cmd
    eval $cmd
}

function glis() {
    if [[ -z "$1" ]]; then
        echo "Usage: glis <commit-hash>"
        return 1
    fi

    local context_lines=30
    if [[ -n "$2" ]]; then
        context_lines=$2
    fi

    cmd="git show --color --stat -p -U$context_lines $1 | delta --line-numbers --side-by-side"
    echo $cmd
    eval $cmd
}

function ,gli_range() {
    if [[ -z "$1" ]]; then
        echo "Usage: ,gli_range <commit-hash-start> [<commit-hash-end>] [<context-lines>]"
        return 1
    fi

    local start_commit="$1"
    local end_commit="HEAD"
    local context_lines=30

    if [[ -n "$2" ]]; then
        end_commit="$2"
    fi

    if [[ -n "$3" ]]; then
        context_lines="$3"
    fi

    local commit_range="${start_commit}..${end_commit}"
    cmd="git log --color --stat -p -U${context_lines} ${commit_range} | delta --line-numbers"
    echo $cmd
    eval $cmd
}

function ,glis_range() {
    if [[ -z "$1" ]]; then
        echo "Usage: ,glis_range <commit-hash-start> [<commit-hash-end>] [<context-lines>]"
        return 1
    fi

    local start_commit="$1"
    local end_commit="HEAD"
    local context_lines=30

    if [[ -n "$2" ]]; then
        end_commit="$2"
    fi

    if [[ -n "$3" ]]; then
        context_lines="$3"
    fi

    local commit_range="${start_commit}..${end_commit}"
    cmd="git log --color --stat -p -U${context_lines} ${commit_range} | delta --line-numbers --side-by-side"
    echo $cmd
    eval $cmd
}

# === Utilities ===

alias ,upload_notes="source /home/cristian/Scripts/upload.sh"
alias ,download_notes="source /home/cristian/Scripts/download.sh"
alias ,alacritty_new_window="type ,alacritty_new_window; alacritty msg create-window || alacritty"
alias ,clipboard="xclip -selection clipboard <"
alias ,rg_max_columns="rg --hidden --max-columns 100"

# Then put source -> destination afterwards
alias ,myrsync="type ,myrsync; rsync -avh --ignore-existing --info=progress2 --info=name0"
alias ,myrsync_dryrun="type ,myrsync_dryrun; rsync -avh --dry-run -i --ignore-existing --info=progress2 --info=name0"
alias ,myrsync_match_sync="type ,myrsync_match_sync; rsync -avh --delete --info=progress2 --info=name0"
alias ,myrsync_match_sync_dryrun="type ,myrsync_match_sync_dryrun; rsync -avh --delete --dry-run -i --info=progress2 --info=name0"

function ,file_count() {
    for i in *; do
        if [[ -d "$i" ]]; then
            echo "$i: $(ls "$i" | wc -l)"
        fi
    done
}

function ,aptsearch() {
    if [ -z "$1" ]; then
        echo "Usage: aptsearch <package-name>"
        return 1
    fi
    apt-cache search --names-only "^$1" | fzf --preview "echo {} | awk '{print \$1}' | xargs -I % apt-cache show % | grep -E 'Description|Package'"
}

function ,pdfcompress() {
    local resolution=${2:-144}
    echo "Using resolution value: $resolution for compression"
    ghostscript -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pdfwrite -dCompatibilityLevel=1.3 -dPDFSETTINGS=/ebook -dEmbedAllFonts=true -dSubsetFonts=true -dColorImageDownsampleType=/Bicubic -dColorImageResolution=$resolution -dGrayImageDownsampleType=/Bicubic -dGrayImageResolution=$resolution -dMonoImageDownsampleType=/Bicubic -dMonoImageResolution=$resolution -sOutputFile=$1.compressed.pdf $1
}

function ,pdfcompress_higherquality() {
    local resolution=${2:-144}
    echo "Using resolution value: $resolution for compression"
    ghostscript -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pdfwrite -dCompatibilityLevel=1.3 -dPDFSETTINGS=/printer -dEmbedAllFonts=true -dSubsetFonts=true -dColorImageDownsampleType=/Bicubic -dColorImageResolution=$resolution -dGrayImageDownsampleType=/Bicubic -dGrayImageResolution=$resolution -dMonoImageDownsampleType=/Bicubic -dMonoImageResolution=$resolution -sOutputFile=$1.compressed.pdf $1
}

# === FZF ===

[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh
source <(fzf --zsh)
export FZF_DEFAULT_COMMAND='rg --files'

function fzf_rg_select() {
    local file file=$(rg --files | fzf)
    if [[ -n $file ]]; then
        BUFFER+="$file"
        CURSOR=$#BUFFER
    fi
}
zle -N fzf_rg_select
bindkey '^T' fzf_rg_select

# === NVM ===

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

source ~/.zshrc.local
