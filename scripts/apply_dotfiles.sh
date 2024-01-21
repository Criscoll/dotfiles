#!/bin/sh

echo "=== Applying Neovim Config==="
rsync -avh ~/Repos/dotfiles/local/share/nvim/ ~/.local/share/nvim/
rsync -avh ~/Repos/dotfiles/nvim ~/.config/nvim
echo "=== Done ==="
echo ""

echo "=== Applying Scripts ==="
rsync -avh ~/Repos/dotfiles/scripts/ ~/Scripts/
echo "=== Done ==="
echo ""

echo "=== Applying Alacritty Config ==="
rsync -avh ~/Repos/dotfiles/alacritty/ ~/.config/alacritty/
echo "=== Done ==="
echo ""

echo "=== Applying .zshrc ==="
cp -v ~/Repos/dotfiles/zshrc/.zshrc ~/.zshrc
echo "=== Done ==="
echo ""
