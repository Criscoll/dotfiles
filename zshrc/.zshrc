# === General Settings ===
export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="agnoster"
plugins=(git)
source $ZSH/oh-my-zsh.sh
DEFAULT_USER=$USER

## ------------------------- Environment Variables -----------------------------

export PATH="$HOME/Repos/tmux:$PATH"
export PATH="$HOME/Repos/alacritty/target/release:$PATH"
export PATH="$HOME/Applications/nvim-linux64/bin:$PATH"
export PATH="$HOME/.cargo/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"
export PATH="$HOME/.go/bin:$PATH"

## pnpm
export PNPM_HOME="/home/cristian/.local/share/pnpm"
[[ ":$PATH:" != *":$PNPM_HOME:"* ]] && export PATH="$PNPM_HOME:$PATH"


export GOPATH="$HOME/.go/"


## ------------------------- Aliases -----------------------------

alias open="xdg-open"

# Git Aliases
alias sgs="type sgs; stg status"
alias sgss="type sgss; stg series; git status"
alias sgra="type sgra; git add .; stg refresh"
alias sgp="type sgp; stg pop --all; sgss; git pull --rebase"
alias gp="git pull --rebase"
alias gs="git status"
alias gl="git log --oneline --color"
alias gpl="git pull --rebase"
alias ga="git add ."
alias gcm="git commit -m"
alias gca="git commit --amend"
alias gcae="git commit --amend --no-edit"
alias gds="git diff | delta --side-by-side"
alias gla="git log --oneline --graph"
alias gl="git log --color --pretty=format:'%C(yellow)%h %C(reset)%C(cyan)(%ar)%C(reset) %C(white)%s - %C(reset)%C(green)%an%C(reset)'"
alias gll="gl | head"
alias gld="git log --color --date=short --stat -p"
alias gli="git show --color --stat -p"
alias glh="git show --stat -p HEAD"

alias update_all="snap refresh && flatpak update && sudo apt update"
alias apts="apt search --names-only"
alias rg="rg --hidden --max-columns 100"
alias python="python3"
alias py="python3"

alias gcalcli_activate="source ~/Repos/gcalcli/venv/bin/activate"

alias mvn_build='mvn clean install -T 1C'
alias mvn_build_offline='mvn clean install --offline -T 1C'
alias notes="type notes; cd /home/cristian/Documents/Obsidian"
alias workbench="type tasks; cd /home/cristian/Documents/Obsidian/02_Workbench/"
alias tasks="type tasks; cd /home/cristian/Documents/Obsidian/02_Workbench/02_Tasks"
alias projects="type projects; cd /home/cristian/Repos/01_Projects"

## ------------------------- Utils -----------------------------
alias ,upload_notes="source /home/cristian/Scripts/upload.sh"
alias ,download_notes="source /home/cristian/Scripts/download.sh"
alias ,alacritty_new_window="type ,alacritty_new_window; alacritty msg create-window || alacritty"
# Then put source -> destination afterwards
alias ,myrsync="type ,myrsync; rsync -avh --ignore-existing --info=progress2 --info=name0"

function ,file_count() {
    for i in *; do
        if [[ -d "$i" ]]; then
            echo "$i: $(ls "$i" | wc -l)"
        fi
    done
}

function select_comma_command() {
    local selected_command=$(compgen -ac | grep '^,' | sort -u | fzf)
    if [[ -n $selected_command ]]; then
        LBUFFER+="$selected_command"
    fi
    zle redisplay
}
zle -N select_comma_command
bindkey '^e' select_comma_command

function ,aptsearch() {
  if [ -z "$1" ]; then
    echo "Usage: aptsearch <package-name>"
    return 1
  fi
  apt-cache search --names-only "^$1" | fzf --preview "echo {} | awk '{print \$1}' | xargs -I % apt-cache show % | grep -E 'Description|Package'"
}

function ,fzf_rg_select() {
	local file file=$(rg --files | fzf)
	if [[ -n $file ]]; then
		BUFFER+="$file"
		CURSOR=$#BUFFER
	fi
}
zle -N fzf_rg_select
bindkey '^T' fzf_rg_select


function ,pdfcompress() {
    # Default resolution is set to 144
    local resolution=${2:-144}
    echo "Using resolution value: $resolution for compression"

    ghostscript -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pdfwrite -dCompatibilityLevel=1.3 -dPDFSETTINGS=/ebook -dEmbedAllFonts=true -dSubsetFonts=true -dColorImageDownsampleType=/Bicubic -dColorImageResolution=$resolution -dGrayImageDownsampleType=/Bicubic -dGrayImageResolution=$resolution -dMonoImageDownsampleType=/Bicubic -dMonoImageResolution=$resolution -sOutputFile=$1.compressed.pdf $1; 
}

function ,pdfcompress_higherquality()
{
    # Default resolution is set to 144
    local resolution=${2:-144}
    echo "Using resolution value: $resolution for compression"

    ghostscript -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pdfwrite -dCompatibilityLevel=1.3 -dPDFSETTINGS=/printer -dEmbedAllFonts=true -dSubsetFonts=true -dColorImageDownsampleType=/Bicubic -dColorImageResolution=$resolution -dGrayImageDownsampleType=/Bicubic -dGrayImageResolution=$resolution -dMonoImageDownsampleType=/Bicubic -dMonoImageResolution=$resolution -sOutputFile=$1.compressed.pdf $1; 
}



## _________________FZF__________________
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh


## _______________NVM__________________
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion


