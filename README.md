# Workspace Studio

> **v1.1.0 — community plugin for DeepSeek Harness.**
>
> This is an independent community project by [m3159584479](https://github.com/m3159584479). It is **not** an official DeepSeek repository and is not endorsed by DeepSeek.

Workspace Studio extends the DeepSeek Harness workspace sidebar with real nested workspaces, reversible hiding, and an optional plugin-repair chat.

## Features

- **New sub-workspace** — every workspace's `…` menu can create a real folder inside that workspace and register it as a child workspace.
- **Workspace Tree** — after creation, the native **View options → Group by → Workspace Tree** view renders the path hierarchy. Nested workspaces can themselves contain more workspaces.
- **Collapse vs hide** — a workspace can collapse its sessions and child workspaces while keeping its own row, or hide the whole workspace into the top-level hidden list. Both states persist.
- **Focus mode** — show only one workspace, its ancestors, and its descendants; a compact focus bar exits the mode. Other workspaces are temporarily hidden without changing the saved hidden set.
- **Quick switch** — `Ctrl+Shift+K` opens a search over workspaces and sessions. Opening a workspace uses the native workspace navigation.
- **View presets** — save the current hidden/collapsed view under a name and switch between workspace sets.
- **Workspace health** — a Host check reports missing paths, non-directories, symlinks, duplicate registrations, empty workspaces, and deep nesting.
- **Recently removed** — when a workspace registration disappears, a local history keeps its title and path. Restoring the parent re-registers its folder; child workspace registrations stay and re-nest by path, so they do not need to be opened again. The history only contains previously registered workspaces; ordinary folders are never adopted automatically.
- **Hide / restore** — hiding a child workspace stays inside its parent's menu. Only root hidden workspaces appear in the global hidden strip.
- **Delete workspace folder** — sub-workspaces get a separate red action that permanently removes the real folder after an explicit confirmation. It refuses paths that contain other registered workspaces, symlinks, and non-directories.
- **Plugin chats** — Settings → Plugins gains a **Plugin chats** tab for non-official plugins. Selecting a plugin and clicking Chat opens a repair conversation with the package identity, optional note, and source-lookup steps prefilled.

## Why a small Host half?

The shipped native directory picker does not implement `createDirectory` (the composed picker serves `native`). Workspace Studio therefore exposes four local, path-validated Host routes:

- `POST /plugin-studio/create-child`
- `POST /plugin-studio/delete-child`
- `POST /plugin-studio/health`
- `POST /plugin-studio/restore-workspace`

They only accept registered workspace paths (or direct children for creation) and a local `x-plugin-studio: 1` header; the health route is read-only.

## Requirements

- DeepSeek Harness `>=0.2.1-rc.2`
- Local workspaces whose folders are writable by the Harness process

## Install

From this repository:

```sh
dsh plugin --profile desktop add github:m3159584479/dsh-workspace-studio
```

Or clone it and install the local package:

```sh
git clone https://github.com/m3159584479/dsh-workspace-studio.git
dsh plugin --profile desktop add ./dsh-workspace-studio
```

Or add a market index that lists it under **Plugins → Discover → Index sources**.

## Usage

1. Open a workspace's `…` menu.
2. Choose **New sub-workspace…**, enter a folder name, and confirm.
3. Leave **Switch to Workspace Tree view after creating** checked, or switch manually in **View options → Group by → Workspace Tree**.
4. To remove a sub-workspace permanently, use **Delete workspace folder…** and confirm.
5. Use **Collapse** to keep the workspace row but fold its sessions/children, and **Focus** to isolate one branch.
6. Open **Settings → Plugins → Workspace** for quick switch, health checks, and saved view presets.

Only sub-workspaces expose the real-folder delete action. Top-level workspaces keep the shipped **Delete workspace** behavior, which removes the registration but leaves files on disk.

## Limitations and review notes

- **Local filesystem only.** The Host routes use `node:fs`; remote/SSH workspace filesystems are not supported.
- **Restore only re-registers known workspaces.** The history comes from the plugin's local snapshot; it never scans a folder and adopts ordinary directories as workspaces. Restoring a parent keeps existing child registrations and lets Workspace Tree re-nest them by path.
- **UI integration is additive but version-sensitive.** Menu items and the hidden-workspaces strip are injected into the shipped workspace browser using `data-row-key` and the native menu labels. A future DSH UI rewrite may require an update.
- **Real deletion is intentionally narrow.** Only sub-workspaces expose it. The Host refuses paths that are not registered workspaces, that are not inside another registered workspace, that contain other registered workspaces, or that are symlinks/non-directories.
- **Top-level workspaces keep files.** The shipped **Delete workspace** action still only removes the registration.
- **No security audit.** The routes accept only registered workspace paths, but they are local HTTP routes; review the code before installing.
- **Plugin chats** filters out official plugins and starts ordinary DSH conversations; it does not bypass approvals or permissions.

## Development

- `client.js` — Client UI, menu decoration, dialogs, workspace-tree/hide/collapse/focus behavior, quick switch, health/preset tab, plugin chats.
- `index.js` — Host routes for creating/deleting real folders, restoring registrations, and the read-only health check.
- `cordis.patch.yml` — Loader patch.
- `locale/` — Plugin Manager display metadata.
- `icon.svg` — Plugin icon.

## License

MIT. See [LICENSE](./LICENSE).
