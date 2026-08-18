This fixture is not a git repo in source control (nested `.git` and `.env` are created by tests).

`envFileCommitted.test.ts` writes `.env`, runs `git init`, and `git add`s `.env` so it is tracked. `.env.example` is committed on purpose and must not be flagged.
