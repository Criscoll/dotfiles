# Emergency rollback — restore to pre-pull state

If the sync went wrong and you want to get back to exactly where things were before pulling:

## Step R1: Find the pre-pull commit

```bash
git -C $REPO_DIR reflog | head -20
```

Look for the entry immediately before `pull` (will read something like `HEAD@{1}: pull: Fast-forward`). Note the SHA — call it `PRE_PULL_SHA`.

## Step R2: Reset the repo

```bash
git -C $REPO_DIR reset --hard $PRE_PULL_SHA
git -C $REPO_DIR log --oneline -5
```

## Step R3: Restore stashed local changes (if Step 4 created a stash)

```bash
git -C $REPO_DIR stash list
git -C $REPO_DIR stash pop stash@{0}
```

If the pop produces conflicts, load `scenarios/merge_conflicts.md`. To discard the stash entirely: `git -C $REPO_DIR stash drop stash@{0}`.

## Step R4: Verify stow is clean

```bash
stow --simulate -v -t $HOME_DIR $REPO_DIR/stow-managed 2>&1
```

## Step R5: Confirm the environment is healthy

```bash
ls -la $HOME_DIR/.zshrc $HOME_DIR/.tmux.conf $HOME_DIR/.config/nvim/init.lua
zsh -i -c "echo shell ok"
```

If anything still looks wrong after the rollback, stop and describe the symptom — do not apply further fixes blindly.
