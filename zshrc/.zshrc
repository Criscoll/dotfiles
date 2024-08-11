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

alias glh="git log --stat -p --max-count=1"





#
alias update_all="snap refresh && flatpak update && sudo apt update"
alias apts="apt search --names-only"
alias rg="rg --hidden --max-columns 100"

alias ,upload_notes="source /home/cristian/Scripts/upload.sh"
alias ,download_notes="source /home/cristian/Scripts/download.sh"

alias python="python3"
alias py="python3"
alias gcalcli_activate="source ~/Repos/gcalcli/venv/bin/activate"

alias gs="git status"
alias gl="git log"
alias gpl="git pull --rebase"
alias ga="git add ."
alias gcm="git commit -m"
alias gca="git commit --amend"
alias gcae="git commit --amend --no-edit"
alias gds="git diff | delta --side-by-side"
alias gla="git log --oneline --graph"

alias open="xdg-open"

alias mvn_build='mvn clean install -T 1C'
alias mvn_build_offline='mvn clean install --offline -T 1C'

alias notes="type notes; cd /home/cristian/Documents/Obsidian"
alias tasks="type tasks; cd /home/cristian/Documents/Obsidian/03_Tasks"


alias ,alacritty_new_window="type ,alacritty_new_window; alacritty msg create-window || alacritty"


## ------------------------- Utils -----------------------------

function aptsearch() {
  if [ -z "$1" ]; then
    echo "Usage: aptsearch <package-name>"
    return 1
  fi
  apt-cache search --names-only "^$1" | fzf --preview "echo {} | awk '{print \$1}' | xargs -I % apt-cache show % | grep -E 'Description|Package'"
}

function fzf_rg_select() {
	local file file=$(rg --files | fzf)
	if [[ -n $file ]]; then
		BUFFER+="$file"
		CURSOR=$#BUFFER
	fi
}

zle -N fzf_rg_select

function pdfcompress() {
    # Default resolution is set to 144
    local resolution=${2:-144}
    echo "Using resolution value: $resolution for compression"

    ghostscript -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pdfwrite -dCompatibilityLevel=1.3 -dPDFSETTINGS=/ebook -dEmbedAllFonts=true -dSubsetFonts=true -dColorImageDownsampleType=/Bicubic -dColorImageResolution=$resolution -dGrayImageDownsampleType=/Bicubic -dGrayImageResolution=$resolution -dMonoImageDownsampleType=/Bicubic -dMonoImageResolution=$resolution -sOutputFile=$1.compressed.pdf $1; 
}

function pdfcompress_higherquality()
{
    # Default resolution is set to 144
    local resolution=${2:-144}
    echo "Using resolution value: $resolution for compression"

    ghostscript -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pdfwrite -dCompatibilityLevel=1.3 -dPDFSETTINGS=/printer -dEmbedAllFonts=true -dSubsetFonts=true -dColorImageDownsampleType=/Bicubic -dColorImageResolution=$resolution -dGrayImageDownsampleType=/Bicubic -dGrayImageResolution=$resolution -dMonoImageDownsampleType=/Bicubic -dMonoImageResolution=$resolution -sOutputFile=$1.compressed.pdf $1; 


}


## ------------------------- Keybindings -----------------------------
bindkey '^T' fzf_rg_select


## ------------------------- Misc -----------------------------

## _________________FZF__________________
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh


## _______________Timetrap________________
autoload -U compinit
compinit
fpath=(/var/lib/gems/3.0.0/gems/timetrap-*/completions/zsh $fpath)



## _______________Kakoune__________________
export KAKOUNE_CONFIG_DIR=~/.config/kak
alias kak='~/Repos/kakoune/src/kak'

## _______________NVM__________________
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion


