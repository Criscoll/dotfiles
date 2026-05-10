# Scenario: Lazy plugin with stale/corrupted submodule checkout

**Symptom in `:Lazy update`:**
```
● PluginName  status failed
  You have local changes in `/home/.../.local/share/nvim/lazy/PluginName`:
    * deps/jsregexp
    * ...
  Please remove them to update.
```

**nvim log / lazy output:**
```
fatal: not a git repository: ../../.git/modules/deps/jsregexpXXX
fatal: could not reset submodule index
```

**Cause:** A previous update or install attempt failed mid-way and left stale submodule
clone directories behind (e.g. `deps/jsregexp005`, `deps/jsregexp006`). Git sees these as
local modifications and refuses to advance the branch.

## Confirm

```bash
ls ~/.local/share/nvim/lazy/<PluginName>/deps/
# Multiple numbered copies (jsregexp, jsregexp005, jsregexp006) confirm stale clones
```

## Fix

Delete the plugin directory entirely and let lazy reinstall from scratch:

```bash
rm -rf ~/.local/share/nvim/lazy/<PluginName>
```

Then run `:Lazy install` (or `:Lazy sync`) in Neovim. Lazy will clone the plugin fresh
with a clean submodule checkout.

**Known affected plugin:** LuaSnip (`deps/jsregexp` submodule). The numbered copies
accumulate across failed installs and are harmless to delete.
