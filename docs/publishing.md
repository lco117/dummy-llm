# Publishing to npm

## Why publish at all

Publishing does not host anything — npm stores a tarball, not a running server. What it buys you:

| what you get | why it matters |
| --- | --- |
| `npx parrot-llm` | The single biggest adoption lever. Someone can try it in 5 seconds without cloning, installing or reading anything. |
| `npm i -D parrot-llm` | It becomes a pinned dev dependency. A `pretest` script can boot it and every developer on the team gets the same fake LLM. |
| Discoverability | npm search, libraries.io, npmtrends, Socket.dev, Dependabot alerts. A downloads badge is social proof. |
| Versioning as a contract | Consumers can pin `0.1.x`. Semver becomes a promise you can keep. |
| Provenance | Publishing from GitHub Actions with `--provenance` attaches a signed link between the tarball and the commit that built it. |

It does **not** make your Worker public, deploy anything, or auto-update anyone.

## What actually ships

The `files` whitelist in `package.json` is `["dist", "src", "README.md", "LICENSE", "wrangler.jsonc"]`,
so the tarball is roughly 60 KB: the esbuild bundle, the TypeScript sources and the licence.
No tests, no docs, no lockfile.

```bash
npm pack --dry-run          # see exactly what would be uploaded
```

## 0. Create the npm account

1. Open <https://www.npmjs.com/signup> and fill in a username, email and password.
   (There is usually a **Sign up with GitHub** button as well — either way works.)
2. Verify the email address npm sends you. Nothing publishes until this is done.
3. Enable **two-factor authentication** in **Account settings → Two-factor authentication**.
   npm requires 2FA from anyone who publishes. A TOTP app (1Password, Authy, Google
   Authenticator) is the simplest option; passkeys and security keys also work.
4. Your username is also your scope: it is what ```yourname/package` would use. The package here
   is unscoped (`parrot-llm`), so the username does not appear in the install command.

**The registry gotcha (read this if you are in China).** If `npm config get registry` points at a
mirror such as `registry.npmmirror.com`, then `npm login` and `npm publish` would try to talk to
the mirror, which does not accept publishes. Pin the real registry for those two commands:

```bash
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
```

Installs can keep using the mirror — which is why `package.json` carries

```json
"publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" }
```

`publishConfig` only affects publishing, so `npm install` stays on the fast mirror while
`npm publish` always reaches the real registry.

Modern npm (10+) opens a browser for `npm login` and stores a session token in `~/.npmrc`. You
can also skip the CLI entirely: create a **Granular Access Token** on the website (see
"Turning on automated publishing") and write it into `~/.npmrc` yourself.

## First publish (manual, once)

```bash
npm login                                   # interactive — only you can do this
npm whoami                                  # confirm the account
npm view parrot-llm version                 # 404 means the name is still free

npm run typecheck && npm test               # must be green
npm publish --access public                 # prepublishOnly runs the build for you

npx parrot-llm@latest --help                # verify from a clean cache
```

The name `parrot-llm` was free when this repository was created. If it has been taken since,
either publish under a scope (```yourname/parrot-llm`) or rename.

## Every publish after that

```bash
git push --follow-tags        # tag first, or: npm version patch && git push --follow-tags
```

[`.github/workflows/release.yml`](../.github/workflows/release.yml) then runs the tests, publishes
to npm (when the secret exists), pushes the Docker image and opens a GitHub Release with generated
notes. That is the "one click".

## Turning on automated publishing

1. npmjs.com → **Access Tokens** → **Granular Access Token**
   - name: `parrot-llm CI`
   - permissions: **Read and write**, packages: `parrot-llm` only
   - enable **Bypass 2FA** for automation (or use a classic **Automation** token)
2. GitHub → the repo → **Settings → Secrets and variables → Actions → New repository secret**
   - name: `NPM_TOKEN`, value: the token
3. Push a tag. The workflow publishes with `--provenance` (it needs `id-token: write`, already set).

Without the secret the publish step is skipped and the rest of the release still runs, so a missing
token never blocks a release.

## Versioning rules

| bump | when |
| --- | --- |
| patch | docs, bug fixes, internal refactors |
| minor | new config, new protocol, new behaviour that does not change existing bytes |
| **major** | **any change to an existing protocol's frames** |

The wire format *is* the API here. Changing a frame is a breaking change even if the TypeScript
signature did not move.

## If something goes wrong

```bash
npm deprecate parrot-llm@0.1.0 "broken SSE framing, use 0.1.1"
```

Unpublishing is only possible for 72 hours, and consumers may already depend on the version.
Prefer deprecation plus a fixed release.

## Checklist after publishing

- [ ] `npx parrot-llm@latest --help` works on a clean machine
- [ ] the npm badge in the README resolves
- [ ] the tarball size is sane (`npm view parrot-llm dist.unpackedSize`)
- [ ] the GitHub Release exists and links the tag
- [ ] `docs/launch.md` section 3 is ready to paste
