#!/bin/sh

rsync -avh --ignore-existing --info=progress2 ~/.config/nvim ~/Repos/dotfiles/
rsync -avh --ignore-existing --info=progress2 --exclude='.git/' ~/.local/share/nvim/ ~/Repos/dotfiles/local/share/nvim

rsync -avh --ignore-existing --info=progress2 ~/.config/alacritty ~/Repos/dotfiles/
cp -v ~/.zshrc ~/Repos/dotfiles/zshrc
