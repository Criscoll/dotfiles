#!/bin/sh

echo "====== Syncing Neovim Config ======"
rsync -avh --info=progress2 ~/.config/nvim ~/Repos/dotfiles/
rsync -avh --info=progress2 --exclude='.git/' ~/.local/share/nvim/ ~/Repos/dotfiles/local/share/nvim
echo "====== Done ======"
echo ""

echo "====== Syncing Scripts ======"
rsync -avh --info=progress2 ~/Scripts/ ~/Repos/dotfiles/scripts/
echo "====== Done ======"
echo ""

echo "====== Syncing Alacritty Config ==="
rsync -avh --info=progress2 ~/.config/alacritty ~/Repos/dotfiles/
echo "=== Done ==="
echo ""

echo "=== Syncing .zshrc ==="
cp -v ~/.zshrc ~/Repos/dotfiles/zshrc
echo "=== Done ==="
echo ""
