<!-- omnex:begin -->
# AGENTS.md

Dosis-Dings: titration and date helper

## Project
- Specs: `resources/specs.md`. Read them before changing anything and follow them step by step.
- Web address: https://dosis-dings.omn.n00dle.net
- This project is managed by Omnex. Omnex handles the git repo (Forgejo), the web server and the subdomain. Do not set those up yourself.

## Running and checking
- The web server serves the files in this folder directly. There is no build step and no restart: a saved change is live at once.
- After a change, check it: `curl -sI https://dosis-dings.omn.n00dle.net` should return 200.
- Do not use SSH and do not touch the host.
- If the server needs a restart or its logs, stop and ask me.

## Rules
- Work only inside this folder. Never read or write tokens, keys or other projects.
- Do not commit secrets. Do not commit or push yourself: Omnex commits and pushes when the session ends.
- Install nothing globally. If a package is missing, say so instead of working around it.
- Work through the spec in small steps. After each step, check it works before starting the next.
- If the spec is unclear or needs something you cannot do, stop and say what is missing. Don't guess.
<!-- omnex:end -->
