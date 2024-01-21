#!/bin/sh

rsync -avh --ignore-existing --info=progress2 ~/Repos/dotfiles/.local ~/.local
rsync -avh --ignore-existing --info=progress2 ~/Repos/dotfiles/nvim ~/.config/nvim

rsync -avh --ignore-existing --info=progress2 ~/Repos/dotfiles/alacritty/ ~/.config/alacritty/
cp -v ~/Repos/dotfiles/zshrc/.zshrc ~/.zshrc
