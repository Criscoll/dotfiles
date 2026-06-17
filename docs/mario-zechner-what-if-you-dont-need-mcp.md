# What If You Don't Need MCP?

> **Source:** [Mario Zechner — "What if you don't need MCP at all?"](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)
> **Published:** 2025-11-02

---

## Core Tenets

### 1. Bash + Code Over MCP

Agents already know how to write code and use Bash. This built-in capability often eliminates the need for MCP servers
entirely. Instead of bolting on a special protocol, lean on what the model already understands — shell scripts and
program logic.

> *"Bash and code are composable. So what's simpler than having your agent just invoke CLI tools and write code?"*

### 2. Minimal Tool Surface Area

Provide only the tools your actual use case requires. A 225-token README with four scripts is more effective than a 13,000–18,000 token MCP server that covers every possible scenario.

| Setup | Tools | Token cost |
|---|---|---|
| Playwright MCP | 21 tools | ~13.7k tokens |
| Chrome DevTools MCP | 26 tools | ~18.0k tokens |
| Zechner's browser scripts | 4 scripts | ~225 tokens |

Large tool surfaces confuse agents and eat precious context.

### 3. Composability Through Unix Primitives

MCP servers are not composable — their outputs must pass through the agent's context to be combined or saved. Bash commands and code compose naturally via pipes, files, and temporary storage. An agent can chain invocations, persist results directly to disk, and process them with further code — all without loading data into context first.

### 4. Easy Extension

Adding a new capability is a two-step process: write a script, add a README entry. No MCP server codebase to understand, no PR to submit, no protocol to re-debug.

> *"It took not even a minute for me to instruct Claude to create that tool, add it to the readme, and away we went."*

### 5. Progressive Disclosure

The tool README is only loaded when the agent needs it — not prepended to every session. This is analogous to Anthropic's skills system but simpler and works with any coding agent.

---

## Example: Browser DevTools (Full Stack)

Zechner's concrete case: browser automation without Playwright MCP or Chrome DevTools MCP.

### The Four Core Scripts

| Script | Purpose |
|---|---|
| `start.js` | Launch Chrome with remote debugging on `:9222`. Optionally rsync your default profile for logged-in sessions. |
| `nav.js` | Navigate to a URL in the current tab or a new tab. |
| `eval.js` | Execute arbitrary JavaScript in the active page context. Returns structured output (arrays, objects, scalars). |
| `screenshot.js` | Capture the current viewport to a PNG in `tmpdir()`, returns the file path. |

The agent reads a 225-token README once and knows the full API. All scripts are simple Puppeteer Core Node.js scripts under ~30 lines each.

### Extending: The Pick Tool

An interactive element picker — the agent tells the user to run `./pick.js "Click the submit button"`, the user hovers/clicks on DOM elements, and structured element info is returned to the agent's context. Built for collaborating on scraper selectors without the agent needing to guess DOM structure.

### Extending: The Cookies Tool

When scraping required HTTP-only cookies (inaccessible from page-context JS), a script was generated in under a minute to extract them via CDP directly.

---

## Values

- **Simplicity over feature-completeness** — Ship the four tools you need, not the thirty you might one day want.
- **Token efficiency** — Every token in context is one the model can't use for reasoning. Conserve aggressively.
- **Leverage existing knowledge** — Models already know Bash, JavaScript, and the DOM API. Don't re-describe what they already understand.
- **Agent-agnostic** — Works with Claude Code, pi, GitHub Copilot, or any harness that can execute shell commands and read files.
- **User agency** — You own the code, you modify it, you extend it. No dependency on an MCP server maintainer.
- **Context isolation** — Tool outputs go to files, not context. The agent decides what to bring in.
- **Frictionless prototyping** — Adding a new tool is writing a script and appending to a README. No build step, no protocol, no deployment.

---

## The Counter-Argument

Zechner acknowledges the trade-off:

> *"With great power comes great responsibility though. You will have to come up with a structure for how you build and maintain those tools yourself."*

But argues this is a feature, not a bug — owning the structure means you can shape it to your exact needs, and the cost of maintaining a few shell scripts is far lower than the cost of fighting a general-purpose MCP server.

---

## Key Quotes

> *"I'm a simple boy, so I like simple things."*

> *"Think outside the MCP box and you'll find that this is much more powerful than the more rigid structure you have to follow with MCP."*

> *"This efficiency comes from the fact that models know how to write code and use Bash. I'm conserving context space by relying heavily on their existing knowledge."*

---

## Related

- [MCP vs CLI](https://mariozechner.at/posts/2025-08-15-mcp-vs-cli/) — Earlier benchmark comparing Bash tools and MCP servers for a specific task.
- [Prompts Are Code](https://mariozechner.at/posts/2025-06-02-prompts-are-code/) — Zechner's earlier post on treating prompts as code, same ethos of simplicity.
- [Armin Ronacher — Code MCPs](https://lucumr.pocoo.org/2025/8/18/code-mcps/) — Related argument for the power of Bash and code over MCPs.
- [browser-tools (GitHub)](https://github.com/badlogic/browser-tools) — The actual repo for the scripts described in the post.
