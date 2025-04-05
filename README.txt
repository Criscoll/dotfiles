




# Installation
1. Clone this repository
2. Run the following (make sure gnu stow is installed)
```
stow -v -t ~ <cloned-repo-path>/stow-managed/
```

This will crete symlinks in your home directory to the dotfiles in the stow managed directory


## Install Programs

### redshift


### Alacritty


### ohmyzsh


### Tmux


### Rclone
Upon installation, you will need to run `rclone config` to get things setup.
To keep this aligned with the scripts, make sure you use the same remote name as defined in the
script files.

### 



# Stow Commands

Create new symlinks in the -t directory from the stow package directory
```
stow -v -t ~ <cloned-repo-path>/stow-managed/
```

Simulate changes before applying them
```
stow -v -t ~ <cloned-repo-path>/stow-managed/ --simulate
```

Move matching files that are not links or directories from -t to the stow package and then create
the symlinks. Will override you stow directory files so make sure that it is in version control.
```
stow -v --adopt -t ~ <cloned-repo-path>/stow-managed/
```

Simulate changes before applying them
```
stow -v --adopt -t ~ <cloned-repo-path>/stow-managed/ --simulate
```
