/**
 * Plugin Studio
 * ---------------------------------------------------------------------------
 * Workspace tree tools and plugin repair conversations.
 *
 *   • Every workspace row's “…” menu gets “New sub-workspace…” and “Hide
 *     workspace”. A sub-workspace is a real folder created inside the parent
 *     workspace's directory and registered as a workspace; the built-in
 *     “Workspace Tree” grouping then renders the path hierarchy.
 *   • Hidden workspaces and their session rows are matched by `data-row-key`
 *     and hidden with a class, so the shipped browser keeps rendering
 *     underneath. A compact “Hidden workspaces” strip under the workspace
 *     header reveals and restores them.
 *   • A `plugins.tab` page and a `plugins.detail.actions` button open a repair
 *     conversation for any non-official plugin, with the optional note and the
 *     source-lookup + repair steps prefilled.
 *
 * Clicking “Chat” starts a normal conversation. If a target already has a
 * conversation, it is reopened; Shift+click forces a new one.
 */
window.__ModuleLoader__.load({
  id: '@315958/dsh-workspace-studio',
  factory(require) {
    'use strict';

    const React = require('react');
    const h = React.createElement;
    const NS = 'plugin-studio';
    const SELF_PACKAGE = '@315958/dsh-workspace-studio';
    const HIDDEN_KEY = 'dsh.plugin-studio.hidden-workspaces.v1';
    const SESSION_KEY = 'dsh.plugin-studio.sessions.v1';
    const COLLAPSED_KEY = 'dsh.plugin-studio.collapsed-workspaces.v1';
    const FOCUS_KEY = 'dsh.plugin-studio.focus-workspace.v1';
    const PRESETS_KEY = 'dsh.plugin-studio.view-presets.v1';
    const REMOVED_KEY = 'dsh.plugin-studio.removed-workspaces.v1';
    const SNAPSHOT_KEY = 'dsh.plugin-studio.workspace-snapshot.v1';
    const TOUR_KEY = 'dsh.plugin-studio.onboarding.v1';

    function readTourSeen() {
      try {
        return window.localStorage.getItem(TOUR_KEY) === '1';
      } catch (_) {
        return false;
      }
    }

    function writeTourSeen() {
      try {
        window.localStorage.setItem(TOUR_KEY, '1');
      } catch (_) {
        /* private mode: the tutorial may reappear next session */
      }
    }

    function notifyStateChanged() {
      try {
        window.dispatchEvent(new Event('plugin-studio:state-changed'));
      } catch (_) {
        /* no window in a detached test context */
      }
    }

    function readHiddenWorkspaces() {
      try {
        const raw = window.localStorage.getItem(HIDDEN_KEY);
        if (raw === null) return [];
        const value = JSON.parse(raw);
        if (!Array.isArray(value)) return [];
        const seen = new Set();
        const entries = [];
        for (const item of value) {
          if (item === null || typeof item !== 'object') continue;
          if (typeof item.key !== 'string' || item.key === '' || seen.has(item.key)) continue;
          seen.add(item.key);
          entries.push({
            key: item.key,
            title: typeof item.title === 'string' && item.title !== '' ? item.title : item.key,
          });
        }
        return entries;
      } catch (_) {
        return [];
      }
    }

    function writeHiddenWorkspaces(entries) {
      try {
        window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(entries));
      } catch (_) {
        /* private mode / unavailable storage: the session-only state still works */
      }
      notifyStateChanged();
    }

    function readCollapsedWorkspaces() {
      try {
        const raw = window.localStorage.getItem(COLLAPSED_KEY);
        if (raw === null) return [];
        const value = JSON.parse(raw);
        if (!Array.isArray(value)) return [];
        return [...new Set(value.filter((item) => typeof item === 'string' && item !== ''))];
      } catch (_) {
        return [];
      }
    }

    function writeCollapsedWorkspaces(ids) {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...new Set(ids)]));
      } catch (_) {
        /* private mode: collapsed state lasts for this page */
      }
      notifyStateChanged();
    }

    function readFocusWorkspace() {
      try {
        const raw = window.localStorage.getItem(FOCUS_KEY);
        return typeof raw === 'string' ? raw : '';
      } catch (_) {
        return '';
      }
    }

    function writeFocusWorkspace(id) {
      try {
        if (typeof id === 'string' && id !== '') window.localStorage.setItem(FOCUS_KEY, id);
        else window.localStorage.removeItem(FOCUS_KEY);
      } catch (_) {
        /* private mode: focus lasts for this page */
      }
      notifyStateChanged();
    }

    function readViewPresets() {
      try {
        const raw = window.localStorage.getItem(PRESETS_KEY);
        if (raw === null) return [];
        const value = JSON.parse(raw);
        if (!Array.isArray(value)) return [];
        const presets = [];
        const seen = new Set();
        for (const item of value) {
          if (item === null || typeof item !== 'object') continue;
          if (typeof item.id !== 'string' || item.id === '' || seen.has(item.id)) continue;
          if (typeof item.name !== 'string' || item.name.trim() === '') continue;
          const hidden = Array.isArray(item.hidden)
            ? item.hidden
              .filter((entry) => entry !== null && typeof entry === 'object' && typeof entry.key === 'string' && entry.key !== '')
              .map((entry) => ({
                key: entry.key,
                title: typeof entry.title === 'string' && entry.title !== '' ? entry.title : entry.key,
              }))
            : [];
          const collapsed = Array.isArray(item.collapsed)
            ? [...new Set(item.collapsed.filter((id) => typeof id === 'string' && id !== ''))]
            : [];
          seen.add(item.id);
          presets.push({
            id: item.id,
            name: item.name.trim().slice(0, 40),
            hidden,
            collapsed,
            createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
          });
        }
        return presets.slice(0, 40);
      } catch (_) {
        return [];
      }
    }

    function writeViewPresets(presets) {
      try {
        window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets.slice(0, 40)));
      } catch (_) {
        /* private mode: presets last for this page */
      }
      notifyStateChanged();
    }

    function readRemovedWorkspaces() {
      try {
        const raw = window.localStorage.getItem(REMOVED_KEY);
        if (raw === null) return [];
        const value = JSON.parse(raw);
        if (!Array.isArray(value)) return [];
        const entries = [];
        const seen = new Set();
        for (const item of value) {
          if (item === null || typeof item !== 'object') continue;
          if (typeof item.workspaceId !== 'string' || item.workspaceId === '') continue;
          if (typeof item.path !== 'string' || item.path === '') continue;
          if (seen.has(item.workspaceId)) continue;
          seen.add(item.workspaceId);
          entries.push({
            workspaceId: item.workspaceId,
            path: item.path,
            title: typeof item.title === 'string' && item.title !== '' ? item.title : item.path,
            removedAt: typeof item.removedAt === 'number' ? item.removedAt : Date.now(),
          });
        }
        return entries.slice(0, 20);
      } catch (_) {
        return [];
      }
    }

    function writeRemovedWorkspaces(entries) {
      try {
        window.localStorage.setItem(REMOVED_KEY, JSON.stringify(entries.slice(0, 20)));
      } catch (_) {
        /* private mode: the removal history lasts for this page */
      }
      notifyStateChanged();
    }

    function readWorkspaceSnapshot() {
      try {
        const raw = window.localStorage.getItem(SNAPSHOT_KEY);
        if (raw === null) return [];
        const value = JSON.parse(raw);
        if (!Array.isArray(value)) return [];
        return value
          .filter((item) => item !== null && typeof item === 'object')
          .filter((item) => typeof item.workspaceId === 'string' && typeof item.path === 'string')
          .map((item) => ({
            workspaceId: item.workspaceId,
            path: item.path,
            title: typeof item.title === 'string' ? item.title : '',
          }))
          .slice(0, 100);
      } catch (_) {
        return [];
      }
    }

    function writeWorkspaceSnapshot(items) {
      try {
        window.localStorage.setItem(
          SNAPSHOT_KEY,
          JSON.stringify(items.slice(0, 100).map((item) => ({
            workspaceId: item.workspaceId,
            path: item.path,
            title: item.title || '',
          }))),
        );
      } catch (_) {
        /* private mode: snapshot comparison is unavailable */
      }
    }

    function recordRemovedWorkspaces(items) {
      if (!Array.isArray(items) || items.length === 0) return;
      const removed = readRemovedWorkspaces();
      const known = new Set(removed.map((entry) => entry.workspaceId));
      const knownPaths = new Set(removed.map((entry) => entry.path.toLowerCase()));
      let changed = false;
      for (const item of items) {
        if (item === null || typeof item !== 'object') continue;
        if (typeof item.workspaceId !== 'string' || item.workspaceId === '') continue;
        if (typeof item.path !== 'string' || item.path === '') continue;
        if (known.has(item.workspaceId) || knownPaths.has(item.path.toLowerCase())) continue;
        removed.push({
          workspaceId: item.workspaceId,
          path: item.path,
          title: typeof item.title === 'string' && item.title !== '' ? item.title : item.path,
          removedAt: Date.now(),
        });
        known.add(item.workspaceId);
        knownPaths.add(item.path.toLowerCase());
        changed = true;
      }
      if (changed) writeRemovedWorkspaces(removed);
    }

    function pruneRestoredWorkspaces(items) {
      if (!Array.isArray(items)) return;
      const ids = new Set(
        items
          .filter((item) => item !== null && item !== undefined && typeof item.workspaceId === 'string')
          .map((item) => item.workspaceId),
      );
      const paths = new Set(
        items
          .filter((item) => item !== null && item !== undefined && typeof item.path === 'string')
          .map((item) => item.path.toLowerCase()),
      );
      const removed = readRemovedWorkspaces();
      const next = removed.filter((entry) => !ids.has(entry.workspaceId) && !paths.has(entry.path.toLowerCase()));
      if (next.length !== removed.length) writeRemovedWorkspaces(next);
    }

    function readSessionMap() {
      try {
        const raw = window.localStorage.getItem(SESSION_KEY);
        if (raw === null) return {};
        const value = JSON.parse(raw);
        return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
      } catch (_) {
        return {};
      }
    }

    function writeSessionMap(map) {
      try {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(map));
      } catch (_) {
        /* the search tag still rebuilds the link after a storage loss */
      }
    }

    /**
     * A derived cache: target → Session id. The Session log stays the source of
     * truth; the id is validated against the live Session list before use, and
     * the message-index search can rebuild the link after a storage loss.
     */
    const runtime = {
      ctx: null,
      mainId: null,
      pending: null,
      workspaces: [],
      lookup(key) {
        const map = readSessionMap();
        const id = map[key];
        if (typeof id !== 'string' || id === '') return undefined;
        const service = runtime.ctx === null ? undefined : runtime.ctx.sessions;
        const store = service === undefined || service === null ? undefined : service.list;
        if (store !== undefined && store !== null) {
          const state = store.getSnapshot();
          if (state !== undefined && state !== null && state.byId !== undefined && state.byId[id] === undefined) {
            delete map[key];
            writeSessionMap(map);
            return undefined;
          }
        }
        return id;
      },
      remember(key, id) {
        if (typeof key !== 'string' || typeof id !== 'string') return;
        const map = readSessionMap();
        map[key] = id;
        const keys = Object.keys(map);
        if (keys.length > 120) delete map[keys[0]];
        writeSessionMap(map);
      },
      beginPending(key) {
        const pending = { key, before: runtime.mainId, at: Date.now() };
        runtime.pending = pending;
        setTimeout(() => {
          if (runtime.pending === pending) runtime.pending = null;
        }, 8000);
      },
      recordMainSession(mainId) {
        runtime.mainId = mainId;
        const pending = runtime.pending;
        if (pending === null || mainId === null) return;
        if (mainId === pending.before) return;
        if (Date.now() - pending.at > 15000) {
          runtime.pending = null;
          return;
        }
        runtime.pending = null;
        runtime.remember(pending.key, mainId);
      },
    };

    function normalizePath(path) {
      return String(path === undefined || path === null ? '' : path)
        .replace(/[\\/]+/g, '/')
        .replace(/\/+$/, '')
        .toLowerCase();
    }

    function parentPathOf(path) {
      const normalized = normalizePath(path);
      const separator = normalized.lastIndexOf('/');
      return separator > 0 ? normalized.slice(0, separator) : '';
    }

    function joinPath(parent, name) {
      const separator = parent.includes('\\') ? '\\' : '/';
      return `${parent.replace(/[\\/]+$/, '')}${separator}${name}`;
    }

    function validFolderName(name) {
      if (typeof name !== 'string') return false;
      const value = name.trim();
      if (value === '' || value === '.' || value === '..') return false;
      if (value.length > 80) return false;
      if (/[\\/:*?"<>|]/.test(value)) return false;
      if (/[\u0000-\u001f]/.test(value)) return false;
      if (/[. ]$/.test(value)) return false;
      if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(value)) return false;
      return true;
    }

    const EN = {
      tabLabel: 'Plugin chats',
      tabIntro: 'Choose a non-official plugin, add an optional note, then open a repair conversation. Shift+click Chat to force a new conversation.',
      hiddenWorkspaces: 'Hidden workspaces',
      hiddenWorkspacesHint: 'Hidden workspaces — click to view or restore',
      hiddenTitle: 'Hidden workspaces',
      hiddenIntro: 'Every explicitly hidden workspace, including nested ones. Show restores its hidden parent chain too.',
      hiddenEmpty: 'No hidden workspaces.',
      hiddenParent: 'Parent',
      hideChildWorkspaces: 'Hide child workspaces',
      showChildWorkspaces: 'Show child workspaces',
      newChildWorkspace: 'New sub-workspace',
      newChildTitle: 'New sub-workspace',
      newChildParent: 'Parent workspace',
      newChildName: 'Folder name',
      newChildNamePlaceholder: 'e.g. experiments',
      newChildPreview: 'New workspace path',
      newChildUseTree: 'Switch to Workspace Tree view after creating',
      newChildCreate: 'Create sub-workspace',
      newChildCancel: 'Cancel',
      close: 'Close',
      newChildHint: 'Creates a new real folder and registers it as a child workspace. An existing folder is never adopted as a workspace.',
      newChildInvalidName: 'Enter a folder name without slashes, reserved characters, or a trailing dot/space.',
      newChildExists: 'A workspace at this path already exists.',
      newChildNoParent: 'The parent workspace path is not available yet. Try again in a moment.',
      newChildFailed: 'Could not create the sub-workspace.',
      deleteFolder: 'Delete workspace folder…',
      deleteFolderTitle: 'Delete workspace folder?',
      deleteFolderTarget: 'Workspace',
      deleteFolderWarning: 'This permanently deletes the folder and everything inside it. Close any session using it first. Session logs are kept, but the path will be gone. This cannot be undone.',
      deleteFolderConfirm: 'I understand this permanently deletes the folder',
      deleteFolderAction: 'Delete folder permanently',
      deleteFolderCancel: 'Cancel',
      deleteFolderFailed: 'Could not delete the folder.',
      deleteFolderHasChildren: 'This workspace contains other registered workspaces. Remove them first.',
      deleteFolderNotChild: 'Only a sub-workspace can be deleted this way.',
      deleteFolderUnknown: 'The workspace is no longer registered.',
      deleteFolderNotDirectory: 'The workspace path is not a regular directory.',
      hideWorkspace: 'Hide this workspace',
      showWorkspace: 'Show workspace',
      workspaceTabLabel: 'Workspace',
      workspaceTabIntro: 'Manage nesting, visibility, focus, and the health of your workspace tree.',
      collapseWorkspace: 'Collapse',
      expandWorkspace: 'Expand',
      focusWorkspace: 'Focus',
      exitFocus: 'Exit focus',
      focusLabel: 'Focus',
      focusHint: 'Only this workspace and its parent/child chain are visible. Exit focus to restore the full tree.',
      quickSwitch: 'Quick switch',
      quickSwitchHint: 'Search workspaces and sessions; Ctrl+Shift+K opens it from anywhere.',
      quickSwitchPlaceholder: 'Search workspaces, paths, or sessions…',
      quickSwitchEmpty: 'No matching workspaces or sessions.',
      quickSwitchUntitled: 'Untitled session',
      quickSwitchKeys: '↑↓ navigate · Enter open · Esc close',
      quickSwitchWorkspace: 'Workspace',
      tutorial: 'Tutorial',
      tourKicker: 'Interactive guide',
      tourTitle: 'Welcome to Workspace Studio',
      tourStep1Title: 'Open the workspace menu',
      tourStep1Body: 'Hover this workspace row and click the … button. New sub-workspace, collapse, focus, and hide live there.',
      tourStep1a: 'Open the workspace “…” menu and choose New sub-workspace.',
      tourStep1b: 'Enter a folder name; an existing folder is rejected.',
      tourStep1c: 'Switch to View options → Group by → Workspace Tree to see the real hierarchy.',
      tourStep2Title: 'Create a real sub-folder',
      tourStep2Body: 'Click New sub-workspace. It creates a real folder and registers it as a child workspace.',
      tourStep2a: 'Existing folders are rejected; they are never adopted.',
      tourStep2b: 'A child workspace gets a separate Delete workspace folder action.',
      tourStep2c: 'That delete is permanent and only applies to sub-workspaces.',
      tourInputTitle: 'Name the folder and create',
      tourInputBody: 'Type a folder name, then create. The new folder is registered as a child workspace immediately.',
      tourStep3Title: 'Update plugins by conversation',
      tourStep3Body: 'Open Settings → Plugins → Plugin chats, choose a non-official plugin or row, then click Chat.',
      tourStep3a: 'The conversation carries the plugin identity, source, and your note.',
      tourStep3b: 'An existing conversation is reused; Shift+click Chat starts a new one.',
      tourStep3c: 'The conversation proposes and applies changes only through the normal Agent confirmation flow.',
      tourBack: 'Back',
      tourNext: 'Next',
      tourStart: 'Done',
      tourSkip: 'Skip tutorial',
      tourClose: 'Close tutorial',
      quickSwitchSession: 'Session',
      healthTitle: 'Workspace health',
      healthIntro: 'Check registered paths, duplicate entries, empty workspaces, and overly deep nesting.',
      healthCheck: 'Check workspaces',
      healthChecking: 'Checking…',
      healthChecked: 'Checked {count} workspaces.',
      healthNoIssues: 'No issues found.',
      healthIssues: '{count} issue(s)',
      healthMissing: 'Path is missing',
      healthNotDir: 'Path is not a regular directory',
      healthSymlink: 'Path is a symbolic link',
      healthDuplicate: 'Duplicate workspace path',
      healthEmpty: 'Workspace has no sessions',
      healthDeep: 'Workspace nesting is deep',
      healthLocate: 'Open',
      healthCopy: 'Copy path',
      healthCopied: 'Copied',
      healthFailed: 'Could not check workspaces.',
      removedTitle: 'Recently removed workspaces',
      removedIntro: 'Restore a registration that disappeared. Child workspaces stay registered and re-nest automatically; if children were removed too, Restore also restores them from history.',
      removedEmpty: 'No removed workspaces recorded yet.',
      removedRestore: 'Restore',
      removedForget: 'Forget',
      removedBusy: 'Restoring…',
      removedFailed: 'Could not restore the workspace.',
      removedSuccess: 'Workspace restored.',
      removedMissing: 'The folder no longer exists; it cannot be restored.',
      presetsTitle: 'View presets',
      presetsIntro: 'Save the current hidden/collapsed view and switch between named workspace sets.',
      presetNamePlaceholder: 'e.g. Frontend, Writing, Plugin work',
      presetSave: 'Save current view',
      presetApply: 'Apply',
      presetDelete: 'Delete',
      presetEmpty: 'No presets yet.',
      presetSaved: 'View preset saved.',
      presetHint: 'A preset stores which workspaces are hidden and which are collapsed; focus is not included.',
      presetHiddenCount: '{count} hidden',
      presetCollapsedCount: '{count} collapsed',
      presetAllVisible: 'All visible',
      currentFocus: 'Current focus',
      clearFocus: 'Clear focus',
      noteLabel: 'What should change? (optional)',
      notePlaceholder: 'For example: explain the bug you see, or describe how the workspace hide control should behave.',
      noteHint: 'This note is written into the new conversation beside the plugin identity and the repair steps.',
      choosePlugin: 'Choose a plugin to adjust',
      choosePluginHint: 'Every bundle and every plugin row has its own conversation. An existing conversation is reopened; Shift+click forces a new one.',
      selfAction: 'Adjust this plugin',
      search: 'Search plugins or modules',
      refresh: 'Refresh',
      retry: 'Retry',
      loading: 'Loading plugins…',
      empty: 'No plugins match.',
      enabled: 'Enabled',
      disabled: 'Disabled',
      notInstalled: 'Not installed',
      official: 'Official',
      openDetails: 'Details',
      showRows: 'Plugin rows',
      loadFailed: 'Could not load the plugin list',
      remoteUnavailable: 'The plugin manager API is not available in this session.',
      action: 'Chat',
      rowAction: 'Chat',
      actionHint: 'Open this plugin’s adjustment conversation; Shift+click forces a new one',
      rowHint: 'Open this plugin row’s adjustment conversation; Shift+click forces a new one',
      opening: 'Opening…',
      tagNote: 'Adjustment chat tag (keep this line so the same conversation can be found again):',
      promptHeader: 'I picked a plugin in Plugin Studio to adjust through conversation. Target:',
      noteHeader: 'My note:',
      noteEmpty: '(No note was added. Review the plugin first, explain what you found, and ask me what to change before making large edits.)',
      promptSteps: [
        'Please inspect and improve this plugin.',
        '',
        'Steps:',
        '1. Resolve its real source directory first: read DSH_PROFILE_DIR/package.json dependencies (PowerShell: $env:DSH_PROFILE_DIR), then inspect DSH_PROFILE_DIR/node_modules/<package>. It may be a link/junction; resolve it to the actual source folder.',
        '2. Read package.json, cordis.patch.yml, client.js / index.js and locale/*.json to understand its current behavior.',
        '3. Use my note as the priority. If no note is present, review the code, reproduce what you can, and propose the change before a large rewrite.',
        '4. After editing, reinstall the bundle or let HMR update it, then verify in the affected page or in Settings → Plugins.',
        '5. Finish with a short summary: cause, files changed, how you verified it, and remaining risks. Do not modify unrelated plugins.',
      ].join('\n'),
    };

    const ZH = {
      tabLabel: '插件对话',
      tabIntro: '选择一个非官方插件，填写可选的调整说明，再点“对话”开始修复。Shift+点击“对话”可强制新建。',
      hiddenWorkspaces: '隐藏的工作区',
      hiddenWorkspacesHint: '隐藏的工作区 — 点击查看或恢复',
      hiddenTitle: '隐藏中的工作区',
      hiddenIntro: '列出所有被显式隐藏的工作区，包括嵌套在子工作区里的。显示时会同时恢复它被隐藏的父级链。',
      hiddenEmpty: '没有隐藏中的工作区。',
      hiddenParent: '父级',
      hideChildWorkspaces: '隐藏子工作区',
      showChildWorkspaces: '显示子工作区',
      newChildWorkspace: '新建子工作区',
      newChildTitle: '新建子工作区',
      newChildParent: '父工作区',
      newChildName: '文件夹名称',
      newChildNamePlaceholder: '例如：experiments',
      newChildPreview: '新工作区路径',
      newChildUseTree: '创建后切换到“按工作区树”视图',
      newChildCreate: '创建子工作区',
      newChildCancel: '取消',
      close: '关闭',
      newChildHint: '只会创建新的真实文件夹并注册为子工作区；已有文件夹不会被当成工作区。',
      newChildInvalidName: '请输入不含斜杠、保留字符或末尾空格/句点的文件夹名称。',
      newChildExists: '该路径下已经有工作区了。',
      newChildNoParent: '暂时找不到父工作区路径，请稍后再试。',
      newChildFailed: '创建子工作区失败。',
      deleteFolder: '删除工作区文件夹…',
      deleteFolderTitle: '删除工作区文件夹？',
      deleteFolderTarget: '工作区',
      deleteFolderWarning: '这会永久删除文件夹及其中的所有内容。请先关闭正在使用它的会话。会话记录会保留，但路径将消失，且无法撤销。',
      deleteFolderConfirm: '我确认永久删除这个文件夹',
      deleteFolderAction: '永久删除文件夹',
      deleteFolderCancel: '取消',
      deleteFolderFailed: '删除文件夹失败。',
      deleteFolderHasChildren: '这个工作区里还有其他已注册的工作区，请先删除它们。',
      deleteFolderNotChild: '只有子工作区可以用这种方式删除。',
      deleteFolderUnknown: '这个工作区已经不在列表中了。',
      deleteFolderNotDirectory: '这个工作区路径不是普通文件夹。',
      hideWorkspace: '隐藏此工作区',
      showWorkspace: '显示工作区',
      workspaceTabLabel: '工作区',
      workspaceTabIntro: '管理嵌套、显示状态、专注模式和工作区健康检查。',
      collapseWorkspace: '折叠',
      expandWorkspace: '展开',
      focusWorkspace: '专注',
      exitFocus: '退出专注',
      focusLabel: '专注',
      focusHint: '只显示这个工作区及其父/子链路；退出专注即可恢复完整工作区树。',
      quickSwitch: '快速切换',
      quickSwitchHint: '搜索工作区和会话；在任意位置按 Ctrl+Shift+K 打开。',
      quickSwitchPlaceholder: '搜索工作区、路径或会话…',
      quickSwitchEmpty: '没有匹配的工作区或会话。',
      quickSwitchUntitled: '未命名会话',
      quickSwitchKeys: '↑↓ 选择 · Enter 打开 · Esc 关闭',
      quickSwitchWorkspace: '工作区',
      tutorial: '使用教程',
      tourKicker: '互动引导',
      tourTitle: '欢迎使用工作区工作室',
      tourStep1Title: '先打开工作区菜单',
      tourStep1Body: '把鼠标移到这个工作区行，点击右侧的 …。新建子工作区、折叠、专注和隐藏都在这里。',
      tourStep1a: '打开工作区行的「…」菜单，选择「新建子工作区」。',
      tourStep1b: '输入文件夹名；已有文件夹会被拒绝，不会被自动接管。',
      tourStep1c: '在「视图选项 → 分组 → 按工作区树」中查看真实层级。',
      tourStep2Title: '创建真实子文件夹',
      tourStep2Body: '点击「新建子工作区」。它会创建一个真实文件夹，并注册成子工作区。',
      tourStep2a: '已有文件夹会被拒绝，不会被自动接管。',
      tourStep2b: '子工作区的「...」菜单会有单独的「删除工作区文件夹」。',
      tourStep2c: '这个删除是永久的，而且只对子工作区开放。',
      tourInputTitle: '输入文件夹名并创建',
      tourInputBody: '输入文件夹名后点创建。新文件夹会立刻注册成子工作区。',
      tourStep3Title: '用对话更新插件',
      tourStep3Body: '打开 Settings → Plugins → 插件对话，选择非官方插件或某一行，然后点「对话」。',
      tourStep3a: '会话会带上插件身份、来源和你的调整说明。',
      tourStep3b: '已有对话会复用；Shift+点击「对话」新建一条。',
      tourStep3c: '改动仍通过正常的 Agent 确认流程执行，不会绕过确认。',
      tourBack: '上一步',
      tourNext: '下一步',
      tourStart: '完成',
      tourSkip: '跳过教程',
      tourClose: '关闭教程',
      quickSwitchSession: '会话',
      healthTitle: '工作区健康',
      healthIntro: '检查注册路径、重复条目、空工作区和过深嵌套。',
      healthCheck: '检查工作区',
      healthChecking: '检查中…',
      healthChecked: '已检查 {count} 个工作区。',
      healthNoIssues: '没有发现问题。',
      healthIssues: '{count} 个问题',
      healthMissing: '路径不存在',
      healthNotDir: '路径不是普通文件夹',
      healthSymlink: '路径是符号链接',
      healthDuplicate: '工作区路径重复',
      healthEmpty: '工作区里还没有会话',
      healthDeep: '工作区嵌套较深',
      healthLocate: '打开',
      healthCopy: '复制路径',
      healthCopied: '已复制',
      healthFailed: '检查工作区失败。',
      removedTitle: '最近移除的工作区',
      removedIntro: '恢复消失的注册记录。子工作区注册仍保留并会在“按工作区树”里自动重新嵌套；如果子工作区也被移除，恢复时会一并从历史中恢复。',
      removedEmpty: '还没有记录到被移除的工作区。',
      removedRestore: '恢复',
      removedForget: '不再记录',
      removedBusy: '恢复中…',
      removedFailed: '恢复工作区失败。',
      removedSuccess: '工作区已恢复。',
      removedMissing: '文件夹已经不存在，无法恢复。',
      presetsTitle: '视图预设',
      presetsIntro: '保存当前的隐藏/折叠状态，并在命名的工作区集合之间切换。',
      presetNamePlaceholder: '例如：前端、写作、插件开发',
      presetSave: '保存当前视图',
      presetApply: '应用',
      presetDelete: '删除',
      presetEmpty: '还没有视图预设。',
      presetSaved: '视图预设已保存。',
      presetHint: '预设会保存哪些工作区被隐藏、哪些被折叠；不包含专注状态。',
      presetHiddenCount: '{count} 个隐藏',
      presetCollapsedCount: '{count} 个折叠',
      presetAllVisible: '全部可见',
      currentFocus: '当前专注',
      clearFocus: '清除专注',
      noteLabel: '想调整什么？（可选）',
      notePlaceholder: '例如：描述你遇到的问题，或者说明工作区隐藏按钮应该怎么工作。',
      noteHint: '这段说明会和新对话里的插件身份、修复步骤写在一起。',
      choosePlugin: '选择要调整的插件',
      choosePluginHint: '每个插件、每一行都有独立的对话入口。已有对话会直接打开；Shift+点击可强制新建。',
      selfAction: '调整本插件',
      search: '搜索插件或模块',
      refresh: '刷新',
      retry: '重试',
      loading: '正在读取插件列表…',
      empty: '没有匹配的插件。',
      enabled: '已启用',
      disabled: '未启用',
      notInstalled: '未安装',
      official: '官方',
      openDetails: '详情',
      showRows: '子插件行',
      loadFailed: '读取插件列表失败',
      remoteUnavailable: '当前会话无法访问插件管理接口。',
      action: '对话',
      rowAction: '对话',
      actionHint: '打开该插件的调整对话；Shift+点击强制新建',
      rowHint: '打开这一行插件的调整对话；Shift+点击强制新建',
      opening: '正在打开…',
      tagNote: '调整对话标记（请保留这一行，方便下次回到同一个对话）：',
      promptHeader: '我在插件工作室里选择了一个插件，准备通过对话调整它。目标插件：',
      noteHeader: '我的调整说明：',
      noteEmpty: '（没有填写说明。请先审查这个插件，说明你发现的问题，并在大改之前先问我希望怎么改。）',
      promptSteps: [
        '请检查并改进这个插件。',
        '',
        '步骤：',
        '1. 先定位它的真实源码目录：读取 DSH_PROFILE_DIR/package.json 的 dependencies（PowerShell 用 $env:DSH_PROFILE_DIR），再检查 DSH_PROFILE_DIR/node_modules/<包名>；它可能是 link/junction，请解析到真实源码目录。',
        '2. 读取 package.json、cordis.patch.yml、client.js / index.js 和 locale/*.json，理解它当前的行为。',
        '3. 以我的调整说明为优先。如果没有说明，先做代码审查并尽量复现；在大改之前先给方案，不要擅自重写。',
        '4. 修改后重新安装 bundle / 等待热更新，并在受影响的页面或 Settings → Plugins 实际验证。',
        '5. 最后用中文简要总结：原因、改了哪些文件、如何验证、剩余风险。不要改动无关插件。',
      ].join('\n'),
    };

    const CSS = `
.pst-ws-hidden{display:none!important}
.pst-menuItem{display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 10px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;white-space:nowrap;cursor:pointer}
.pst-menuItem:hover{background:var(--dsw-alias-bg-layer-2)}
.pst-menuItem:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.pst-menuItem svg{flex:none;opacity:.9}
.pst-menuLabel{min-width:0;overflow:hidden;text-overflow:ellipsis}
.pst-menuSeparator{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l1);opacity:.7;flex:none}
.pst-hiddenBar{box-sizing:border-box;display:flex;align-items:center;gap:7px;width:calc(100% - 8px);height:30px;margin:2px 4px 6px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;text-align:left;cursor:pointer;flex:none}
.pst-hiddenBar:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.pst-hiddenBar:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.pst-hiddenBarIcon{display:inline-flex;align-items:center;justify-content:center;flex:none;opacity:.8}
.pst-hiddenBarLabel{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto}
.pst-hiddenBarCount{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1;flex:none}
.pst-hiddenBarChevron{display:inline-flex;align-items:center;justify-content:center;margin-left:auto;color:var(--dsw-alias-label-tertiary);transition:transform .15s var(--ds-ease-in-out);flex:none}
.pst-hiddenBar[aria-expanded="true"] .pst-hiddenBarChevron{transform:rotate(90deg)}
.pst-focusBar{box-sizing:border-box;display:flex;align-items:center;gap:7px;width:calc(100% - 8px);height:30px;margin:2px 4px 6px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;flex:none}
.pst-focusBarIcon{display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-brand-primary);flex:none}
.pst-focusBarLabel{color:var(--dsw-alias-label-secondary);flex:none}
.pst-focusBarTitle{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);flex:1}
.pst-focusBarExit{height:22px;padding:0 7px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-brand-primary);font:inherit;font-size:11px;line-height:1;white-space:nowrap;cursor:pointer;flex:none}
.pst-focusBarExit:hover{background:var(--dsw-alias-bg-layer-1)}
.pst-focusBarExit:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
[data-slot="sidebar.workspaces"] [data-row-key^="workspace:"].pst-ws-collapsed [class*="folder"]{opacity:.55}
.pst-switcherBackdrop{position:fixed;inset:0;z-index:95;display:flex;align-items:flex-start;justify-content:center;padding:12vh 20px 20px;background:rgba(0,0,0,.35);backdrop-filter:blur(3px);pointer-events:auto}
.pst-switcher{box-sizing:border-box;display:flex;flex-direction:column;width:min(600px,100%);max-height:min(520px,72vh);border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-overlay);box-shadow:0 18px 60px rgba(0,0,0,.35);overflow:hidden}
.pst-switcherInput{box-sizing:border-box;width:100%;height:46px;padding:0 15px;border:0;border-bottom:.5px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;outline:none}
.pst-switcherInput::placeholder{color:var(--dsw-alias-label-tertiary)}
.pst-switcherList{box-sizing:border-box;display:flex;flex-direction:column;gap:1px;padding:6px;overflow:auto;min-height:0}
.pst-switcherItem{display:flex;align-items:center;gap:10px;width:100%;min-height:38px;padding:5px 9px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}
.pst-switcherItem:hover,.pst-switcherItemActive{background:var(--dsw-alias-bg-layer-2)}
.pst-switcherItem:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.pst-switcherKind{width:48px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1;text-transform:uppercase;letter-spacing:.04em;flex:none}
.pst-switcherText{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.pst-switcherTitle{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:18px}
.pst-switcherMeta{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.pst-switcherEmpty{padding:18px 10px;color:var(--dsw-alias-label-secondary);font-size:12px;text-align:center}
.pst-switcherFoot{padding:7px 14px;border-top:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.pst-tourLayer{position:fixed;inset:0;z-index:96;display:flex;align-items:center;justify-content:center;padding:20px;pointer-events:none}
.pst-tourBackdrop{position:absolute;inset:0;background:var(--dsw-alias-bg-base);opacity:.62;pointer-events:auto}
.pst-tourCard{position:relative;pointer-events:auto;box-sizing:border-box;display:flex;flex-direction:column;gap:11px;width:min(560px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:20px 22px 18px;border:.5px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 22px 70px rgba(0,0,0,.4)}
.pst-tourTop{display:flex;align-items:center;justify-content:space-between;gap:12px}
.pst-tourTopRight{display:flex;align-items:center;gap:8px}
.pst-tourKicker{color:var(--dsw-alias-brand-primary);font-size:11px;line-height:16px;font-weight:600;letter-spacing:.04em}
.pst-tourCount{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.pst-tourClose{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:18px;line-height:1;cursor:pointer}
.pst-tourClose:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.pst-tourClose:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.pst-tourArt{display:flex;align-items:center;justify-content:center;height:104px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary);flex:none}
.pst-tourArt svg{width:64px;height:64px}
.pst-tourTitle{margin:2px 0 0;font-size:18px;line-height:26px;font-weight:600}
.pst-tourBody{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px}
.pst-tourList{margin:0;padding-left:18px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px;display:flex;flex-direction:column;gap:4px}
.pst-tourFoot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:4px;padding-top:12px;border-top:.5px solid var(--dsw-alias-border-l1)}
.pst-tourSkip{padding:0;border:0;background:none;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;line-height:17px;cursor:pointer}
.pst-tourSkip:hover{color:var(--dsw-alias-label-primary);text-decoration:underline}
.pst-tourDots{display:flex;align-items:center;gap:5px}
.pst-tourDot{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-border-l2)}
.pst-tourDotActive{width:16px;border-radius:3px;background:var(--dsw-alias-brand-primary)}
.pst-tourActions{display:flex;align-items:center;gap:7px}
.pst-coachLayer{position:fixed;inset:0;z-index:97;pointer-events:none}
.pst-coachSpot{position:fixed;z-index:97;box-sizing:border-box;border:1.5px solid var(--dsw-alias-brand-primary);border-radius:8px;box-shadow:0 0 0 9999px rgba(0,0,0,.56);pointer-events:none;transition:left .16s ease,top .16s ease,width .16s ease,height .16s ease}
.pst-coachTip{position:fixed;z-index:98;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;pointer-events:auto;padding:14px 16px 12px;border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 16px 46px rgba(0,0,0,.42)}
.pst-coachTipCenter{position:fixed}
.pst-coachTop{display:flex;align-items:center;justify-content:space-between;gap:10px}
.pst-coachTopRight{display:flex;align-items:center;gap:7px}
.pst-coachKicker{color:var(--dsw-alias-brand-primary);font-size:10px;line-height:15px;font-weight:600;letter-spacing:.04em}
.pst-coachCount{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:15px}
.pst-coachClose{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:17px;line-height:1;cursor:pointer}
.pst-coachClose:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.pst-coachClose:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.pst-coachTitle{margin:0;font-size:15px;line-height:22px;font-weight:600}
.pst-coachBody{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.pst-coachList{margin:0;padding-left:16px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px;display:flex;flex-direction:column;gap:3px}
.pst-coachFoot{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:2px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l1)}
.pst-coachSkip{padding:0;border:0;background:none;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10px;line-height:16px;cursor:pointer}
.pst-coachSkip:hover{color:var(--dsw-alias-label-primary);text-decoration:underline}
.pst-coachDots{display:flex;align-items:center;gap:4px}
.pst-coachDot{width:4px;height:4px;border-radius:50%;background:var(--dsw-alias-border-l2)}
.pst-coachDotActive{width:13px;border-radius:2px;background:var(--dsw-alias-brand-primary)}
.pst-coachActions{display:flex;align-items:center;gap:6px}
.pst-hiddenPanel{box-sizing:border-box;display:flex;flex-direction:column;gap:1px;margin:0 4px 8px 26px;padding:2px 0 2px 8px;border-left:.5px solid var(--dsw-alias-border-l1);background:transparent;flex:none;max-height:240px;overflow:auto}
.pst-hiddenRow{display:flex;align-items:center;gap:8px;min-width:0;height:26px;padding:0 6px;border-radius:6px}
.pst-hiddenRow:hover{background:var(--dsw-alias-bg-layer-2)}
.pst-hiddenTitle{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;flex:1}
.pst-hiddenImplicit .pst-hiddenTitle{color:var(--dsw-alias-label-tertiary)}
.pst-showButton{height:20px;padding:0 5px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-brand-primary);font:inherit;font-size:11px;line-height:1;white-space:nowrap;cursor:pointer;flex:none}
.pst-showButton:hover{background:var(--dsw-alias-bg-layer-2)}
.pst-showButton:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.pst-childLayer{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:24px;pointer-events:none}
.pst-childBackdrop{position:absolute;inset:0;background:var(--dsw-alias-bg-base);opacity:.55;pointer-events:auto}
.pst-childModal{position:relative;pointer-events:auto;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;width:min(480px,100%);padding:18px 20px 16px;border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary)}
.pst-childHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.pst-childHeaderText{display:flex;flex-direction:column;gap:4px;min-width:0}
.pst-childTitleRow{display:flex;align-items:center;gap:9px}
.pst-childIcon{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary);flex:none}
.pst-childIconDanger{color:var(--dsw-alias-state-error-primary)}
.pst-childTitle{margin:0;font-size:15px;line-height:22px;font-weight:600}
.pst-childHint{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.pst-childWarning{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.pst-childClose{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none}
.pst-childClose:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.pst-childClose:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.pst-childParent{display:flex;flex-direction:column;gap:3px;padding:9px 11px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}
.pst-childParentLabel{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}
.pst-childParentName{font-size:12px;line-height:18px;font-weight:500;overflow-wrap:anywhere}
.pst-childParentPath{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}
.pst-childField{display:flex;flex-direction:column;gap:6px}
.pst-childLabel{font-size:12px;line-height:18px;font-weight:500}
.pst-childInput{box-sizing:border-box;width:100%;height:32px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
.pst-childInput:focus{border-color:var(--dsw-alias-brand-primary)}
.pst-childInput:disabled{opacity:.6}
.pst-childPreview{display:flex;flex-direction:column;gap:4px;margin-top:2px}
.pst-childPreviewLabel{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}
.pst-childPreviewBox{padding:7px 9px;border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}
.pst-childCheck{display:flex;align-items:center;gap:8px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;cursor:pointer}
.pst-childCheck input{margin:0;accent-color:var(--dsw-alias-brand-primary);flex:none}
.pst-childError{margin:0;padding:8px 10px;border:.5px solid var(--dsw-alias-state-error-primary);border-radius:8px;color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:17px;overflow-wrap:anywhere}
.pst-childActions{display:flex;justify-content:flex-end;gap:8px;margin-top:2px}
@media (max-width:640px){.pst-childLayer{padding:12px}}
.pst-tab{display:flex;flex-direction:column;gap:16px;padding:2px 0 28px;color:var(--dsw-alias-label-primary)}
.pst-tabHead{display:flex;flex-direction:column;gap:4px}
.pst-tabTitle{margin:0;font-size:16px;line-height:24px;font-weight:600}
.pst-wsToolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:2px 0 4px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.pst-wsStat{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px}
.pst-kbd{padding:1px 5px;border:.5px solid var(--dsw-alias-border-l1);border-radius:4px;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10px;line-height:15px;background:var(--dsw-alias-bg-layer-2)}
.pst-wsNotice{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px}
.pst-healthBody{display:flex;flex-direction:column;gap:7px;margin-top:10px}
.pst-healthList{display:flex;flex-direction:column;gap:5px}
.pst-healthIssue{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:7px 9px;border-left:2px solid var(--dsw-alias-border-l2);border-radius:0 6px 6px 0;background:var(--dsw-alias-bg-layer-2)}
.pst-healthIssue-error{border-left-color:var(--dsw-alias-state-error-primary)}
.pst-healthIssue-warning{border-left-color:var(--dsw-alias-state-warn-primary)}
.pst-healthIssue-info{border-left-color:var(--dsw-alias-border-l2)}
.pst-healthMain{min-width:0;display:flex;flex-direction:column;gap:2px}
.pst-healthTitle{color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;font-weight:500}
.pst-healthMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;overflow-wrap:anywhere}
.pst-healthActions{display:flex;align-items:center;gap:5px;flex:none;flex-wrap:wrap;justify-content:flex-end}
.pst-presetForm{display:flex;align-items:center;gap:7px;margin-top:10px}
.pst-presetInput{width:100%;max-width:none;flex:1}
.pst-presetList{display:flex;flex-direction:column;gap:5px;margin-top:9px}
.pst-presetRow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 8px;border:.5px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1)}
.pst-presetText{min-width:0;display:flex;flex-direction:column;gap:1px}
.pst-presetName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;font-weight:500}
.pst-presetMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;overflow-wrap:anywhere}
.pst-presetActions{display:flex;align-items:center;gap:5px;flex:none}
.pst-tabIntro{margin:0;max-width:680px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px}
.pst-picker{display:flex;flex-direction:column;gap:0}
.pst-field{display:flex;flex-direction:column;gap:7px;margin-top:0}
.pst-fieldLabel{font-size:12px;line-height:18px;font-weight:600}
.pst-textarea{box-sizing:border-box;width:100%;min-height:74px;resize:vertical;padding:9px 11px;border:.5px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:19px;outline:none}
.pst-textarea::placeholder{color:var(--dsw-alias-label-secondary)}
.pst-textarea:focus{border-color:var(--dsw-alias-brand-primary)}
.pst-hint{margin:0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px}
.pst-listHead{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:20px 0 10px}
.pst-listTitle{margin:0;font-size:13px;line-height:19px;font-weight:600}
.pst-listIntro{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px}
.pst-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pst-search{box-sizing:border-box;height:30px;width:220px;max-width:52vw;padding:0 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none}
.pst-search::placeholder{color:var(--dsw-alias-label-secondary)}
.pst-search:focus{border-color:var(--dsw-alias-brand-primary)}
.pst-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;font-weight:500;line-height:1;white-space:nowrap;cursor:pointer;transition:background .12s ease,border-color .12s ease}
.pst-btn:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.pst-btn:active{background:var(--dsw-alias-bg-layer-2)}
.pst-btn:disabled{opacity:.55;cursor:default}
.pst-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.pst-btn svg{flex:none;opacity:.92}
.pst-btnPrimary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.pst-btnPrimary:hover{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);filter:brightness(1.06)}
.pst-btnDanger{background:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-bg-base)}
.pst-btnDanger:hover{background:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);filter:brightness(1.06)}
.pst-link{border:0;background:none;padding:0;color:var(--dsw-alias-brand-primary);font:inherit;font-size:12px;cursor:pointer}
.pst-link:hover{text-decoration:underline}
.pst-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
.pst-card{border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:12px 14px}
.pst-cardTop{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.pst-cardText{min-width:0;flex:1}
.pst-titleLine{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pst-title{font-size:13px;font-weight:600;line-height:19px;overflow-wrap:anywhere}
.pst-chip{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:5px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1;white-space:nowrap}
.pst-chip.on{color:var(--dsw-alias-state-success-primary)}
.pst-meta{margin-top:3px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px;overflow-wrap:anywhere}
.pst-desc{margin:5px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.pst-cardActions{display:flex;align-items:center;gap:8px;flex:none;flex-wrap:wrap;justify-content:flex-end}
.pst-card .pst-btn{background:var(--dsw-alias-bg-layer-2)}
.pst-rows{list-style:none;margin:10px 0 0;padding:10px 0 0;border-top:.5px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;gap:6px}
.pst-rowsWrap{margin-top:10px;border-top:.5px solid var(--dsw-alias-border-l1);padding-top:8px}
.pst-rowsWrap>summary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;list-style-position:inside}
.pst-rowsWrap>summary:hover{color:var(--dsw-alias-label-primary)}
.pst-rowsWrap .pst-rows{margin:8px 0 0;padding:0;border:0}
.pst-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.pst-rowText{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;min-width:0}
.pst-rowTitle{font-size:12px;font-weight:500;overflow-wrap:anywhere}
.pst-rowModule{color:var(--dsw-alias-label-secondary);font-size:11px;overflow-wrap:anywhere}
.pst-chipButton{height:26px;padding:0 9px;border:.5px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;flex:none}
.pst-chipButton:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.pst-chipButton:disabled{opacity:.6;cursor:default}
.pst-chipButton:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.pst-empty{padding:22px 0;color:var(--dsw-alias-label-secondary);font-size:13px}
.pst-error{border:.5px solid var(--dsw-alias-state-error-primary);border-radius:10px;padding:12px 14px;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:19px;background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.pst-errorText{overflow-wrap:anywhere}
[data-slot="sidebar.workspaces"] [data-row-key^="workspace:"]{height:32px;border-radius:7px;margin-block:1px;transition:background .12s ease,box-shadow .12s ease}
[data-slot="sidebar.workspaces"] [data-row-key^="workspace:"]:hover{background:var(--dsw-alias-bg-layer-2)}
[data-slot="sidebar.workspaces"] [data-row-key^="workspace:"] [class*="title"]{font-size:13px;font-weight:600;letter-spacing:.005em}
[data-slot="sidebar.workspaces"] .pst-tree-group:not([data-pst-depth="0"]) [data-row-key^="workspace:"] [class*="title"]{font-weight:500}
[data-slot="sidebar.workspaces"] .pst-tree-group:not([data-pst-depth="0"]) [data-row-key^="workspace:"] [class*="folder"]{color:var(--dsw-alias-brand-primary);opacity:.9}
[data-slot="sidebar.workspaces"] [data-row-key^="workspace:"][class*="selected"]{background:var(--dsw-alias-bg-layer-2)}
[data-slot="sidebar.workspaces"] [data-row-key^="session:"]{height:30px;border-radius:6px;margin-block:1px;transition:background .12s ease}
[data-slot="sidebar.workspaces"] [data-row-key^="session:"]:hover{background:var(--dsw-alias-bg-layer-2)}
[data-slot="sidebar.workspaces"] [data-row-key^="session:"][class*="selected"]{background:var(--dsw-alias-bg-layer-2)}
[data-slot="sidebar.workspaces"] [data-row-key^="session:"] [class*="title"]{font-size:13px;font-weight:400;letter-spacing:.005em}
[data-slot="sidebar.workspaces"] [class*="groupSection"]+[class*="groupSection"]{margin-top:6px}
[data-slot="sidebar.workspaces"] .pst-tree-group{position:relative}
[data-slot="sidebar.workspaces"] .pst-tree-group[data-pst-depth="0"]{--dsh-workspace-indent:0px!important}
[data-slot="sidebar.workspaces"] .pst-tree-group[data-pst-depth="1"]{--dsh-workspace-indent:12px!important}
[data-slot="sidebar.workspaces"] .pst-tree-group[data-pst-depth="2"]{--dsh-workspace-indent:24px!important}
[data-slot="sidebar.workspaces"] .pst-tree-group[data-pst-depth="3"]{--dsh-workspace-indent:36px!important}
[data-slot="sidebar.workspaces"] .pst-tree-group[data-pst-depth="4"]{--dsh-workspace-indent:48px!important}
[data-slot="sidebar.workspaces"] .pst-tree-group[data-pst-depth="5"]{--dsh-workspace-indent:60px!important}
[data-slot="sidebar.workspaces"] .pst-tree-group[data-pst-depth="6"]{--dsh-workspace-indent:72px!important}
[data-slot="sidebar.workspaces"] .pst-tree-group[data-pst-depth="7"]{--dsh-workspace-indent:84px!important}
@media (max-width:640px){.pst-cardTop{flex-direction:column}.pst-cardActions{justify-content:flex-start}}
`;

    function text(t, key, fallback) {
      const value = typeof t === 'function' ? t(key) : undefined;
      return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
    }

    /** Resolve a locale-keyed metadata value. The Host sends `{ en, zh }` maps. */
    function resolveMeta(value, locale) {
      if (typeof value === 'string') return value;
      if (value === null || value === undefined || typeof value !== 'object') return undefined;
      const active = String(locale || '').toLowerCase();
      const base = active.split('-')[0];
      const keys = Object.keys(value);
      const exact = keys.find((key) => key.toLowerCase() === active);
      if (exact !== undefined && typeof value[exact] === 'string') return value[exact];
      const baseMatch = keys.find((key) => key.toLowerCase() === base);
      if (baseMatch !== undefined && typeof value[baseMatch] === 'string') return value[baseMatch];
      for (const key of ['zh', 'en']) {
        if (typeof value[key] === 'string') return value[key];
      }
      for (const key of keys) {
        if (typeof value[key] === 'string') return value[key];
      }
      return undefined;
    }

    function rowText(row) {
      if (row === null || row === undefined || typeof row !== 'object') return 'unknown';
      const parts = [];
      if (row.rowId !== undefined) parts.push(`rowId=${row.rowId}`);
      if (row.moduleName !== undefined) parts.push(`module=${row.moduleName}`);
      if (row.enabled !== undefined) parts.push(`enabled=${Boolean(row.enabled)}`);
      return parts.length === 0 ? 'unknown' : parts.join(', ');
    }

    /** The technical block is intentionally untranslated: names and ids are exact. */
    function describeSubject(subject) {
      const lines = [];
      if (subject === null || subject === undefined || typeof subject !== 'object') {
        lines.push('kind: unknown');
        return lines;
      }
      const pkg = subject.pkg;
      let hasSource = false;
      if ((subject.kind === 'bundle' || subject.kind === 'row') && pkg !== undefined && pkg !== null) {
        lines.push(`kind: ${subject.kind}`);
        lines.push(`package: ${pkg.name}`);
        if (pkg.version !== undefined) lines.push(`version: ${pkg.version}`);
        lines.push(`installed: ${Boolean(pkg.installed)}`);
        lines.push(`enabled: ${Boolean(pkg.enabled)}`);
        lines.push(`official: ${Boolean(pkg.official)}`);
        if (pkg.availability !== undefined) lines.push(`availability: ${pkg.availability}`);
        if (pkg.source !== undefined) {
          lines.push(`source: ${pkg.source}`);
          hasSource = true;
        }
        const rows = Array.isArray(pkg.rows) ? pkg.rows : [];
        if (rows.length === 0) {
          lines.push('rows: (none)');
        } else {
          lines.push('rows:');
          for (const row of rows) lines.push(`  - ${rowText(row)}`);
        }
        if (subject.kind === 'row') {
          lines.push(`target row: ${rowText(subject.row)}`);
        }
      } else if (subject.kind === 'item') {
        lines.push('kind: item');
        lines.push(`itemId: ${subject.id}`);
        lines.push('note: this is an official settings item rather than a complete bundle; resolve the package that provides it from the plugin inventory and configuration before repairing.');
      } else {
        lines.push(`kind: ${String(subject.kind)}`);
      }
      if (!hasSource) {
        lines.push('source: resolve it from the current DSH profile as described below.');
      }
      return lines;
    }

    function subjectKey(subject) {
      if (subject === null || subject === undefined || typeof subject !== 'object') return 'unknown';
      const pkg = subject.pkg;
      if (subject.kind === 'bundle') return `bundle:${pkg === undefined || pkg === null ? '' : pkg.name}`;
      if (subject.kind === 'row') {
        const name = pkg === undefined || pkg === null ? '' : pkg.name;
        const row = subject.row;
        const rowId = row === undefined || row === null ? '' : row.rowId;
        return `row:${name}#${rowId}`;
      }
      if (subject.kind === 'item') return `item:${subject.id}`;
      return `unknown:${String(subject.kind)}`;
    }

    /** A stable, searchable token per plugin target. */
    function markerFor(subject) {
      const key = subjectKey(subject);
      let hash = 2166136261;
      for (let i = 0; i < key.length; i++) {
        hash ^= key.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return `DSHSTUDIO${(hash >>> 0).toString(36).toUpperCase()}`;
    }

    function toPackageView(bundle, plugins, locale) {
      const liveById = new Map();
      for (const plugin of plugins) {
        if (plugin !== null && plugin !== undefined && plugin.entryId !== undefined) {
          liveById.set(plugin.entryId, plugin);
        }
      }
      const rawRows = Array.isArray(bundle.rows) ? bundle.rows : [];
      const rows = rawRows.map((row) => {
        const live = row.entryId === undefined ? undefined : liveById.get(row.entryId);
        const meta = row.meta;
        return {
          rowId: row.rowId,
          moduleName: row.moduleName,
          enabled: live === undefined ? Boolean(row.enabled) : Boolean(live.enabled),
          title: resolveMeta(meta === undefined ? undefined : meta.title, locale) || row.rowId || row.moduleName,
          description: resolveMeta(meta === undefined ? undefined : meta.description, locale),
        };
      });
      const refRows = rows.map((row) => ({
        rowId: row.rowId,
        moduleName: row.moduleName,
        enabled: row.enabled,
      }));
      const pkg = {
        name: bundle.name,
        ...(bundle.version === undefined ? {} : { version: bundle.version }),
        installed: bundle.installed,
        availability: bundle.availability,
        official: bundle.official,
        enabled: bundle.enabled,
        ...(bundle.source === undefined ? {} : { source: bundle.source }),
        rows: refRows,
      };
      return {
        name: bundle.name,
        title: resolveMeta(bundle.meta === undefined ? undefined : bundle.meta.title, locale) || bundle.name,
        description:
          resolveMeta(bundle.meta === undefined ? undefined : bundle.meta.description, locale)
          || (typeof bundle.description === 'string' ? bundle.description : undefined),
        version: bundle.version,
        installed: Boolean(bundle.installed),
        enabled: Boolean(bundle.enabled),
        official: Boolean(bundle.official),
        availability: bundle.availability,
        source: bundle.source,
        rows,
        pkg,
      };
    }

    function registerDictionary(ctx, locale, dictionary) {
      try {
        return ctx.locale.register(NS, locale, dictionary);
      } catch (_) {
        // A re-executed bundle can race its predecessor's cleanup; keeping the
        // previous dictionary is harmless, and a reload must not blank the UI.
        return () => {};
      }
    }

    function ChatGlyph() {
      return h(
        'svg',
        { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M2.2 3.3h11.6v7.1H8.7L5.4 12.8v-2.4H2.2z',
          stroke: 'currentColor',
          strokeWidth: 1.25,
          strokeLinejoin: 'round',
        }),
        h('path', {
          d: 'M11.9 1.2l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z',
          fill: 'currentColor',
          opacity: 0.9,
        }),
      );
    }

    function SlidersGlyph({ size }) {
      const s = size === undefined ? 16 : size;
      return h(
        'svg',
        { width: s, height: s, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('path', { d: 'M2.5 4.2h11M2.5 11.8h11', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
        h('circle', { cx: 6, cy: 4.2, r: 1.8, fill: 'var(--dsw-alias-bg-layer-1)', stroke: 'currentColor', strokeWidth: 1.3 }),
        h('circle', { cx: 10.5, cy: 11.8, r: 1.8, fill: 'var(--dsw-alias-bg-layer-1)', stroke: 'currentColor', strokeWidth: 1.3 }),
      );
    }

    function CloseGlyph() {
      return h(
        'svg',
        { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('path', { d: 'M3.5 3.5l9 9M12.5 3.5l-9 9', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
      );
    }

    function FolderPlusGlyph() {
      return h(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M1.8 4.2h4.1l1.2 1.6h6.1v6.2H1.8z',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinejoin: 'round',
        }),
        h('path', { d: 'M8 8.2v3M6.5 9.7h3', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
      );
    }

    function TrashGlyph() {
      return h(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('path', { d: 'M2.8 4.6h10.4M6.2 4.6V3h3.6v1.6', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
        h('path', {
          d: 'M4.3 4.6l.6 8.2h6.2l.6-8.2M6.7 7v3.6M9.3 7v3.6',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      );
    }

    return {
      inject: ['slots', 'locale', 'uiWorkspace', 'sessions', 'remote', 'remote.pluginManager'],
      apply(ctx) {
        runtime.ctx = ctx;
        ctx.effect(() => {
          const disposeEn = registerDictionary(ctx, 'en', EN);
          const disposeZh = registerDictionary(ctx, 'zh', ZH);
          return () => {
            disposeEn();
            disposeZh();
          };
        }, 'plugin-studio: dictionaries');

        const t = ctx.locale.bind(NS);
        const activeLocale = () => {
          try {
            const value = ctx.locale.getLocale();
            return value !== null && value !== undefined && typeof value.active === 'string' ? value.active : '';
          } catch (_) {
            return '';
          }
        };
        const fallbackFor = (key) => {
          const locale = activeLocale().toLowerCase();
          const dict = locale.startsWith('zh') ? ZH : EN;
          return dict[key] !== undefined ? dict[key] : EN[key];
        };
        const tr = (key) => text(t, key, fallbackFor(key));

        let childDialog = {
          open: false,
          parentId: '',
          parentTitle: '',
          parentPath: '',
          name: '',
          error: '',
          busy: false,
          useTree: true,
        };
        const childDialogListeners = new Set();
        const subscribeChildDialog = (listener) => {
          childDialogListeners.add(listener);
          return () => {
            childDialogListeners.delete(listener);
          };
        };
        const getChildDialog = () => childDialog;
        const setChildDialog = (patch) => {
          childDialog = { ...childDialog, ...patch };
          for (const listener of Array.from(childDialogListeners)) {
            try {
              listener();
            } catch (error) {
              console.error('plugin-studio child dialog listener failed', error);
            }
          }
        };
        const useChildDialog = () => {
          const [value, setValue] = React.useState(getChildDialog);
          React.useEffect(() => {
            setValue(getChildDialog());
            return subscribeChildDialog(() => setValue(getChildDialog()));
          }, []);
          return value;
        };
        const openChildDialog = (parent, displayTitle) => {
          const path = parent !== null && parent !== undefined && typeof parent.path === 'string' ? parent.path : '';
          setChildDialog({
            open: true,
            parentId: parent !== null && parent !== undefined && typeof parent.workspaceId === 'string' ? parent.workspaceId : '',
            parentTitle:
              typeof displayTitle === 'string' && displayTitle !== ''
                ? displayTitle
                : parent !== null && parent !== undefined && typeof parent.title === 'string'
                  ? parent.title
                  : '',
            parentPath: path,
            name: '',
            error: path === '' ? tr('newChildNoParent') : '',
            busy: false,
            useTree: true,
          });
        };

        const callPluginRoute = async (route, body) => {
          const response = await fetch(route, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'content-type': 'application/json',
              'x-plugin-studio': '1',
            },
            body: JSON.stringify(body),
          });
          let payload = null;
          try {
            payload = await response.json();
          } catch (_) {
            payload = null;
          }
          if (!response.ok || payload === null || payload.ok !== true) {
            const error = new Error(
              payload !== null && typeof payload.message === 'string'
                ? payload.message
                : `Request failed (${response.status})`,
            );
            error.code = payload !== null && typeof payload.code === 'string' ? payload.code : 'http';
            throw error;
          }
          return payload;
        };

        const friendlyRouteError = (error, fallbackKey) => {
          const code = error !== null && error !== undefined && typeof error.code === 'string' ? error.code : '';
          const key = {
            exists: 'newChildExists',
            'invalid-name': 'newChildInvalidName',
            'unknown-parent': 'newChildNoParent',
            'has-children': 'deleteFolderHasChildren',
            'not-a-child': 'deleteFolderNotChild',
            'unknown-workspace': 'deleteFolderUnknown',
            'not-directory': 'deleteFolderNotDirectory',
          }[code];
          if (key !== undefined) return tr(key);
          return `${tr(fallbackKey)} ${error instanceof Error ? error.message : String(error)}`;
        };

        const parentWorkspaceOf = (workspace) => {
          if (workspace === null || workspace === undefined || typeof workspace.path !== 'string') return null;
          const byPath = new Map();
          for (const candidate of runtime.workspaces) {
            if (candidate !== null && candidate !== undefined && typeof candidate.path === 'string') {
              byPath.set(normalizePath(candidate.path), candidate);
            }
          }
          let path = parentPathOf(workspace.path);
          while (path !== '') {
            const found = byPath.get(path);
            if (found !== undefined && found.workspaceId !== workspace.workspaceId) return found;
            path = parentPathOf(path);
          }
          return null;
        };

        const directChildrenOf = (workspace) => {
          if (workspace === null || workspace === undefined || typeof workspace.path !== 'string') return [];
          const parentKey = normalizePath(workspace.path);
          return runtime.workspaces.filter(
            (candidate) =>
              candidate !== null &&
              candidate !== undefined &&
              candidate.workspaceId !== workspace.workspaceId &&
              typeof candidate.path === 'string' &&
              parentPathOf(candidate.path) === parentKey,
          );
        };

        let deleteDialog = {
          open: false,
          targetId: '',
          targetTitle: '',
          targetPath: '',
          confirm: false,
          error: '',
          busy: false,
        };
        const deleteDialogListeners = new Set();
        const subscribeDeleteDialog = (listener) => {
          deleteDialogListeners.add(listener);
          return () => {
            deleteDialogListeners.delete(listener);
          };
        };
        const getDeleteDialog = () => deleteDialog;
        const setDeleteDialog = (patch) => {
          deleteDialog = { ...deleteDialog, ...patch };
          for (const listener of Array.from(deleteDialogListeners)) {
            try {
              listener();
            } catch (error) {
              console.error('plugin-studio delete dialog listener failed', error);
            }
          }
        };
        const useDeleteDialog = () => {
          const [value, setValue] = React.useState(getDeleteDialog);
          React.useEffect(() => {
            setValue(getDeleteDialog());
            return subscribeDeleteDialog(() => setValue(getDeleteDialog()));
          }, []);
          return value;
        };
        const openDeleteDialog = (workspace, displayTitle) => {
          const path = workspace !== null && workspace !== undefined && typeof workspace.path === 'string' ? workspace.path : '';
          setDeleteDialog({
            open: true,
            targetId: workspace !== null && workspace !== undefined && typeof workspace.workspaceId === 'string' ? workspace.workspaceId : '',
            targetTitle:
              typeof displayTitle === 'string' && displayTitle !== ''
                ? displayTitle
                : workspace !== null && workspace !== undefined && typeof workspace.title === 'string'
                  ? workspace.title
                  : '',
            targetPath: path,
            confirm: false,
            error: path === '' ? tr('deleteFolderNotChild') : '',
            busy: false,
          });
        };

        function WorkspaceObserver(props) {
          const items = props.useWorkspaces((state) => state.items);
          React.useEffect(() => {
            const next = Array.isArray(items) ? items : [];
            const previous = runtime.workspaces;
            const snapshot = readWorkspaceSnapshot();
            if (next.length === 0 && (previous.length > 0 || snapshot.length > 0)) {
              // An empty update is usually a reconnect/reload, not a deliberate
              // deletion of every workspace. Keep the history and snapshot intact.
              runtime.workspaces = next;
              window.dispatchEvent(new Event('plugin-studio:workspaces-changed'));
              return;
            }
            if (previous.length > 0) {
              const nextIds = new Set(next.map((workspace) => workspace.workspaceId));
              recordRemovedWorkspaces(previous.filter((workspace) => !nextIds.has(workspace.workspaceId)));
            } else if (snapshot.length > 0) {
              const nextIds = new Set(next.map((workspace) => workspace.workspaceId));
              recordRemovedWorkspaces(snapshot.filter((workspace) => !nextIds.has(workspace.workspaceId)));
            }
            runtime.workspaces = next;
            pruneRestoredWorkspaces(next);
            writeWorkspaceSnapshot(next);
            window.dispatchEvent(new Event('plugin-studio:workspaces-changed'));
          }, [items]);
          return null;
        }

        function activateWorkspaceTree() {
          const root = document.querySelector('[data-slot="sidebar.workspaces"]');
          const head = root === null ? null : root.querySelector('[class*="sectionHeader"]');
          const actions = head === null ? null : head.querySelector('[class*="headerActions"]');
          if (actions === null) return;
          const trigger = actions.querySelector('button[aria-label="视图选项"], button[aria-label="View options"]');
          if (trigger === null) return;
          trigger.click();
          let attempts = 0;
          const selectTree = () => {
            attempts += 1;
            const labels = ['按工作区树', 'Workspace Tree'];
            const items = document.querySelectorAll('button, [role="menuitem"]');
            for (const item of items) {
              if (item.getClientRects().length === 0) continue;
              const text = item.textContent.trim();
              if (!labels.some((label) => text.includes(label))) continue;
              item.click();
              return;
            }
            if (attempts < 4) {
              setTimeout(selectTree, 120);
              return;
            }
            trigger.click();
          };
          setTimeout(selectTree, 160);
        }

        function NewChildWorkspaceDialog() {
          const state = useChildDialog();
          const inputRef = React.useRef(null);

          React.useEffect(() => {
            if (!state.open) return;
            const timer = setTimeout(() => {
              if (inputRef.current !== null) inputRef.current.focus();
            }, 0);
            return () => clearTimeout(timer);
          }, [state.open]);

          if (!state.open) return null;

          const close = () => {
            if (!state.busy) setChildDialog({ open: false, error: '' });
          };
          const previewName = state.name.trim() === '' ? tr('newChildNamePlaceholder') : state.name.trim();
          const preview = state.parentPath === '' ? tr('newChildNoParent') : joinPath(state.parentPath, previewName);
          const submit = async () => {
            if (state.busy) return;
            const name = state.name.trim();
            if (!validFolderName(name)) {
              setChildDialog({ error: tr('newChildInvalidName') });
              return;
            }
            if (state.parentPath === '') {
              setChildDialog({ error: tr('newChildNoParent') });
              return;
            }
            const candidatePath = joinPath(state.parentPath, name);
            if (runtime.workspaces.some((workspace) => normalizePath(workspace.path) === normalizePath(candidatePath))) {
              setChildDialog({ error: tr('newChildExists') });
              return;
            }
            setChildDialog({ busy: true, error: '' });
            try {
              await callPluginRoute('/plugin-studio/create-child', {
                parentPath: state.parentPath,
                name,
              });
              const useTree = state.useTree;
              setChildDialog({ open: false, busy: false, error: '' });
              if (useTree) activateWorkspaceTree();
            } catch (error) {
              setChildDialog({
                busy: false,
                error: friendlyRouteError(error, 'newChildFailed'),
              });
            }
          };

          return h(
            'div',
            { className: 'pst-childLayer' },
            h('div', {
              className: 'pst-childBackdrop',
              'aria-hidden': 'true',
              onMouseDown: close,
            }),
            h(
              'div',
              {
                className: 'pst-childModal',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': 'pst-child-title',
                onKeyDown: (event) => {
                  if (event.key !== 'Escape') return;
                  event.preventDefault();
                  close();
                },
              },
              h(
                'div',
                { className: 'pst-childHeader' },
                h(
                  'div',
                  { className: 'pst-childHeaderText' },
                  h(
                    'div',
                    { className: 'pst-childTitleRow' },
                    h('span', { className: 'pst-childIcon' }, h(FolderPlusGlyph)),
                    h('h3', { className: 'pst-childTitle', id: 'pst-child-title' }, tr('newChildTitle')),
                  ),
                  h('p', { className: 'pst-childHint' }, tr('newChildHint')),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'pst-childClose',
                    title: tr('close'),
                    'aria-label': tr('close'),
                    onClick: close,
                  },
                  h(CloseGlyph),
                ),
              ),
              h(
                'div',
                { className: 'pst-childParent' },
                h('span', { className: 'pst-childParentLabel' }, tr('newChildParent')),
                h('span', { className: 'pst-childParentName' }, state.parentTitle || tr('newChildParent')),
                h('span', { className: 'pst-childParentPath' }, state.parentPath || tr('newChildNoParent')),
              ),
              h(
                'label',
                { className: 'pst-childField' },
                h('span', { className: 'pst-childLabel' }, tr('newChildName')),
                h('input', {
                  ref: inputRef,
                  className: 'pst-childInput',
                  value: state.name,
                  placeholder: tr('newChildNamePlaceholder'),
                  disabled: state.busy,
                  'aria-invalid': state.error !== '',
                  onChange: (event) => setChildDialog({ name: event.target.value, error: '' }),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      submit();
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      close();
                    }
                  },
                }),
                h(
                  'div',
                  { className: 'pst-childPreview' },
                  h('span', { className: 'pst-childPreviewLabel' }, tr('newChildPreview')),
                  h('span', { className: 'pst-childPreviewBox' }, preview),
                ),
              ),
              h(
                'label',
                { className: 'pst-childCheck' },
                h('input', {
                  type: 'checkbox',
                  checked: state.useTree,
                  disabled: state.busy,
                  onChange: (event) => setChildDialog({ useTree: event.target.checked }),
                }),
                h('span', null, tr('newChildUseTree')),
              ),
              state.error === ''
                ? null
                : h('div', { className: 'pst-childError', role: 'alert' }, state.error),
              h(
                'div',
                { className: 'pst-childActions' },
                h(
                  'button',
                  { type: 'button', className: 'pst-btn', disabled: state.busy, onClick: close },
                  tr('newChildCancel'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'pst-btn pst-btnPrimary',
                    disabled: state.busy || state.name.trim() === '' || state.parentPath === '',
                    onClick: submit,
                  },
                  state.busy ? tr('opening') : tr('newChildCreate'),
                ),
              ),
            ),
          );
        }

        function DeleteWorkspaceFolderDialog() {
          const state = useDeleteDialog();
          const confirmRef = React.useRef(null);
          React.useEffect(() => {
            if (!state.open) return;
            const timer = setTimeout(() => {
              if (confirmRef.current !== null) confirmRef.current.focus();
            }, 0);
            return () => clearTimeout(timer);
          }, [state.open]);
          const close = () => {
            if (!state.busy) setDeleteDialog({ open: false, error: '' });
          };
          const submit = async () => {
            if (state.busy || !state.confirm) return;
            setDeleteDialog({ busy: true, error: '' });
            try {
              await callPluginRoute('/plugin-studio/delete-child', {
                path: state.targetPath,
                confirm: true,
              });
              setDeleteDialog({ open: false, busy: false, error: '' });
            } catch (error) {
              setDeleteDialog({ busy: false, error: friendlyRouteError(error, 'deleteFolderFailed') });
            }
          };
          if (!state.open) return null;
          return h(
            'div',
            { className: 'pst-childLayer' },
            h('div', {
              className: 'pst-childBackdrop',
              'aria-hidden': 'true',
              onMouseDown: close,
            }),
            h(
              'div',
              {
                className: 'pst-childModal',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': 'pst-delete-title',
                onKeyDown: (event) => {
                  if (event.key !== 'Escape') return;
                  event.preventDefault();
                  close();
                },
              },
              h(
                'div',
                { className: 'pst-childHeader' },
                h(
                  'div',
                  { className: 'pst-childHeaderText' },
                  h(
                    'div',
                    { className: 'pst-childTitleRow' },
                    h('span', { className: 'pst-childIcon pst-childIconDanger' }, h(TrashGlyph)),
                    h('h3', { className: 'pst-childTitle', id: 'pst-delete-title' }, tr('deleteFolderTitle')),
                  ),
                  h('p', { className: 'pst-childWarning' }, tr('deleteFolderWarning')),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'pst-childClose',
                    title: tr('close'),
                    'aria-label': tr('close'),
                    onClick: close,
                  },
                  h(CloseGlyph),
                ),
              ),
              h(
                'div',
                { className: 'pst-childParent' },
                h('span', { className: 'pst-childParentLabel' }, tr('deleteFolderTarget')),
                h('span', { className: 'pst-childParentName' }, state.targetTitle || tr('deleteFolderTarget')),
                h('span', { className: 'pst-childParentPath' }, state.targetPath),
              ),
              h(
                'label',
                { className: 'pst-childCheck' },
                h('input', {
                  ref: confirmRef,
                  type: 'checkbox',
                  checked: state.confirm,
                  disabled: state.busy,
                  onChange: (event) => setDeleteDialog({ confirm: event.target.checked }),
                }),
                h('span', null, tr('deleteFolderConfirm')),
              ),
              state.error === ''
                ? null
                : h('div', { className: 'pst-childError', role: 'alert' }, state.error),
              h(
                'div',
                { className: 'pst-childActions' },
                h(
                  'button',
                  { type: 'button', className: 'pst-btn', disabled: state.busy, onClick: close },
                  tr('deleteFolderCancel'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'pst-btn pst-btnDanger',
                    disabled: state.busy || !state.confirm || state.targetPath === '',
                    onClick: submit,
                  },
                  state.busy ? tr('opening') : tr('deleteFolderAction'),
                ),
              ),
            ),
          );
        }

        let hidden = readHiddenWorkspaces();
        let hiddenOpen = false;

        const hiddenKeyOf = (row) =>
          row === null || row === undefined ? '' : row.getAttribute('data-row-key') || '';
        const isHidden = (key) => hidden.some((entry) => entry.key === key);
        const rememberHidden = (key, title) => {
          if (typeof key !== 'string' || key === '' || isHidden(key)) return;
          hidden.push({ key, title: typeof title === 'string' && title !== '' ? title : key });
          writeHiddenWorkspaces(hidden);
        };
        const forgetHidden = (key) => {
          hidden = hidden.filter((entry) => entry.key !== key);
          writeHiddenWorkspaces(hidden);
        };

        ctx.effect(() => {
          let timer = 0;
          let bar = null;
          let panel = null;
          let focusBar = null;
          let collapsed = new Set(readCollapsedWorkspaces());
          let focusId = readFocusWorkspace();
          let barSignature = '';
          let panelSignature = '';
          let focusSignature = '';
          const style = document.createElement('style');
          style.dataset.plugin = '@315958/dsh-workspace-studio';
          style.textContent = CSS;
          document.head.appendChild(style);
          for (const stale of document.querySelectorAll('.pst-headerToggle, .pst-restoreBar, .pst-hiddenBar, .pst-hiddenPanel')) stale.remove();

          const region = () => document.querySelector('[data-slot="sidebar.workspaces"]');
          const header = () => {
            const root = region();
            return root === null ? null : root.querySelector('[class*="sectionHeader"]');
          };
          const rowTitle = (row) => {
            if (row === null) return '';
            const node = row.querySelector('[class*="title"]');
            const text = node === null ? '' : node.textContent.trim();
            return text !== '' ? text : row.textContent.trim();
          };
          const indentOf = (group) => {
            if (group === null) return 0;
            const raw = getComputedStyle(group).getPropertyValue('--dsh-workspace-indent');
            const parsed = Number.parseFloat(raw);
            return Number.isFinite(parsed) ? parsed : 0;
          };
          const workspaceDepthOf = (workspace) => {
            let depth = 0;
            let parent = parentWorkspaceOf(workspace);
            while (parent !== null) {
              depth += 1;
              parent = parentWorkspaceOf(parent);
            }
            return depth;
          };
          const applyTreeLayout = () => {
            const root = region();
            if (root === null) return;
            const groups = Array.from(root.querySelectorAll('[class*="groupSection"]'));
            for (const group of groups) {
              const project = projectRowOfGroup(group);
              const key = hiddenKeyOf(project);
              const workspaceId = key.startsWith('workspace:') ? key.slice('workspace:'.length) : '';
              const workspace = runtime.workspaces.find((candidate) => candidate.workspaceId === workspaceId) || null;
              const depth = workspace === null
                ? Math.max(0, Math.round(indentOf(group) / 12))
                : workspaceDepthOf(workspace);
              group.classList.add('pst-tree-group');
              group.setAttribute('data-pst-depth', String(depth));
            }
            const inTree = groups.length > 0;
            for (const row of root.querySelectorAll('[data-row-key^="session:"], [class*="sessionRow"]')) {
              row.classList.remove('pst-draft-session');
              if (!inTree) {
                row.style.removeProperty('--dsh-workspace-indent');
                continue;
              }
              let group = row.closest('[class*="groupSection"]');
              if (group === null) {
                let cursor = row.previousElementSibling;
                let project = null;
                while (cursor !== null) {
                  if (typeof cursor.matches === 'function' && cursor.matches('[data-row-key^="workspace:"]')) {
                    project = cursor;
                    break;
                  }
                  const nested = typeof cursor.querySelector === 'function'
                    ? cursor.querySelector('[data-row-key^="workspace:"]')
                    : null;
                  if (nested !== null) {
                    project = nested;
                    break;
                  }
                  cursor = cursor.previousElementSibling;
                }
                group = project === null ? null : project.closest('[class*="groupSection"]');
              }
              const base = indentOf(group);
              row.style.setProperty('--dsh-workspace-indent', `${base}px`);
            }
          };
          const effectiveHiddenKeys = () => {
            const result = new Set(hidden.map((entry) => entry.key));
            if (!Array.isArray(runtime.workspaces) || runtime.workspaces.length === 0) return result;
            const byPath = new Map();
            for (const workspace of runtime.workspaces) {
              if (workspace !== null && workspace !== undefined && typeof workspace.path === 'string') {
                byPath.set(normalizePath(workspace.path), workspace);
              }
            }
            const hiddenIds = new Set(
              hidden.map((entry) =>
                entry.key.startsWith('workspace:') ? entry.key.slice('workspace:'.length) : '',
              ),
            );
            for (const workspace of runtime.workspaces) {
              if (workspace === null || workspace === undefined) continue;
              if (typeof workspace.workspaceId !== 'string' || hiddenIds.has(workspace.workspaceId)) continue;
              let path = parentPathOf(workspace.path);
              while (path !== '') {
                const parent = byPath.get(path);
                if (parent !== undefined && hiddenIds.has(parent.workspaceId)) {
                  result.add(`workspace:${workspace.workspaceId}`);
                  break;
                }
                path = parentPathOf(path);
              }
            }
            return result;
          };
          const effectiveHiddenEntries = () => {
            const explicitByKey = new Map(hidden.map((entry) => [entry.key, entry]));
            const hiddenIds = new Set(
              hidden.map((entry) =>
                entry.key.startsWith('workspace:') ? entry.key.slice('workspace:'.length) : '',
              ),
            );
            if (!Array.isArray(runtime.workspaces) || runtime.workspaces.length === 0) {
              return hidden.map((entry) => ({
                key: entry.key,
                title: entry.title,
                workspaceId: '',
                depth: 0,
                explicit: true,
              }));
            }
            const entries = [];
            const known = new Set();
            for (const workspace of runtime.workspaces) {
              if (workspace === null || workspace === undefined || typeof workspace.path !== 'string') continue;
              if (typeof workspace.workspaceId !== 'string') continue;
              const key = `workspace:${workspace.workspaceId}`;
              known.add(key);
              if (!hiddenIds.has(workspace.workspaceId)) continue;
              // A hidden workspace inside a visible parent is restored from that
              // parent's “Show child workspaces” action, not from the global strip.
              // Only root hidden workspaces, or orphans whose parent is gone, are
              // surfaced outside the tree.
              if (parentWorkspaceOf(workspace) !== null) continue;
              entries.push({
                key,
                title:
                  explicitByKey.get(key) === undefined
                    ? workspace.title || workspace.workspaceId
                    : explicitByKey.get(key).title,
                workspaceId: workspace.workspaceId,
                depth: 0,
                explicit: true,
              });
            }
            for (const entry of hidden) {
              if (known.has(entry.key)) continue;
              entries.push({ key: entry.key, title: entry.title, workspaceId: '', depth: 0, explicit: true });
            }
            entries.sort((a, b) => a.title.localeCompare(b.title));
            return entries;
          };
          const workspaceOfRow = (row) => {
            const key = hiddenKeyOf(row);
            if (!key.startsWith('workspace:')) return null;
            const id = key.slice('workspace:'.length);
            return runtime.workspaces.find((candidate) => candidate.workspaceId === id) || null;
          };
          const projectRowOfGroup = (group) => {
            if (group === null) return null;
            for (const row of group.querySelectorAll('[data-row-key^="workspace:"]')) {
              if (row.closest('[class*="groupSection"]') === group) return row;
            }
            return null;
          };
          const workspaceOfSessionRow = (row) => {
            let group = row.closest('[class*="groupSection"]');
            if (group !== null) {
              return workspaceOfRow(projectRowOfGroup(group));
            }
            let cursor = row.previousElementSibling;
            while (cursor !== null) {
              if (typeof cursor.matches === 'function' && cursor.matches('[data-row-key^="workspace:"]')) {
                return workspaceOfRow(cursor);
              }
              if (typeof cursor.matches === 'function' && cursor.matches('[class*="groupSection"]')) {
                return workspaceOfRow(projectRowOfGroup(cursor));
              }
              const nested = typeof cursor.querySelector === 'function'
                ? cursor.querySelector('[data-row-key^="workspace:"]')
                : null;
              if (nested !== null) return workspaceOfRow(nested);
              cursor = cursor.previousElementSibling;
            }
            return null;
          };
          const focusVisible = (workspace) => {
            if (focusId === '') return true;
            const target = runtime.workspaces.find((candidate) => candidate.workspaceId === focusId) || null;
            if (target === null) return true;
            if (workspace.workspaceId === target.workspaceId) return true;
            let parent = parentWorkspaceOf(target);
            while (parent !== null) {
              if (parent.workspaceId === workspace.workspaceId) return true;
              parent = parentWorkspaceOf(parent);
            }
            parent = parentWorkspaceOf(workspace);
            while (parent !== null) {
              if (parent.workspaceId === target.workspaceId) return true;
              parent = parentWorkspaceOf(parent);
            }
            return false;
          };
          const focusSessionVisible = (workspace) => {
            if (focusId === '') return true;
            const target = runtime.workspaces.find((candidate) => candidate.workspaceId === focusId) || null;
            if (target === null) return true;
            if (workspace.workspaceId === target.workspaceId) return true;
            let parent = parentWorkspaceOf(workspace);
            while (parent !== null) {
              if (parent.workspaceId === target.workspaceId) return true;
              parent = parentWorkspaceOf(parent);
            }
            return false;
          };
          const hasCollapsedAncestor = (workspace) => {
            let parent = parentWorkspaceOf(workspace);
            while (parent !== null) {
              if (collapsed.has(parent.workspaceId)) return true;
              parent = parentWorkspaceOf(parent);
            }
            return false;
          };
          const isCollapsedIncludingSelf = (workspace) =>
            collapsed.has(workspace.workspaceId) || hasCollapsedAncestor(workspace);
          const applyHidden = () => {
            const root = region();
            if (root === null) return;
            const effective = effectiveHiddenKeys();
            const nodes = root.querySelectorAll('[data-row-key]');
            for (const node of nodes) {
              const key = hiddenKeyOf(node);
              if (key.startsWith('workspace:')) {
                const workspace = workspaceOfRow(node);
                let visible = !effective.has(key);
                if (workspace !== null) {
                  visible = visible && focusVisible(workspace) && !hasCollapsedAncestor(workspace);
                }
                node.classList.toggle('pst-ws-hidden', !visible);
                node.classList.toggle(
                  'pst-ws-collapsed',
                  workspace !== null && collapsed.has(workspace.workspaceId),
                );
              } else if (key.startsWith('session:')) {
                const workspace = workspaceOfSessionRow(node);
                const visible = workspace === null
                  ? focusId === ''
                  : !effective.has(`workspace:${workspace.workspaceId}`)
                    && focusSessionVisible(workspace)
                    && !isCollapsedIncludingSelf(workspace);
                node.classList.toggle('pst-ws-hidden', !visible);
              }
            }
          };

          const removePanel = () => {
            if (panel !== null) {
              panel.remove();
              panel = null;
              panelSignature = '';
            }
          };
          const removeBar = () => {
            removePanel();
            if (bar !== null) {
              bar.remove();
              bar = null;
              barSignature = '';
            }
          };
          const removeFocusBar = () => {
            if (focusBar !== null) {
              focusBar.remove();
              focusBar = null;
              focusSignature = '';
            }
          };

          const showEntry = (entry) => {
            const keys = new Set([entry.key]);
            const workspace =
              entry.workspaceId === ''
                ? null
                : runtime.workspaces.find((candidate) => candidate.workspaceId === entry.workspaceId) || null;
            let parent = workspace === null ? null : parentWorkspaceOf(workspace);
            while (parent !== null) {
              keys.add(`workspace:${parent.workspaceId}`);
              parent = parentWorkspaceOf(parent);
            }
            const before = hidden.length;
            hidden = hidden.filter((candidate) => !keys.has(candidate.key));
            if (hidden.length !== before) writeHiddenWorkspaces(hidden);
            applyHidden();
            renderBar();
          };

          const renderPanel = (entries) => {
            if (!hiddenOpen || entries.length === 0 || bar === null || !bar.isConnected) {
              removePanel();
              return;
            }
            if (panel === null || !panel.isConnected) {
              panel = document.createElement('div');
              panel.className = 'pst-hiddenPanel';
              panel.id = 'pst-hidden-workspaces-panel';
              panel.setAttribute('role', 'group');
              bar.insertAdjacentElement('afterend', panel);
              panelSignature = '';
            }
            const signature = `${activeLocale()}|${entries.map((entry) => `${entry.key}\u0000${entry.title}\u0000${entry.depth}\u0000${entry.explicit ? '1' : '0'}`).join('\u0001')}`;
            if (signature === panelSignature) return;
            panelSignature = signature;
            panel.textContent = '';
            for (const entry of entries) {
              const row = document.createElement('div');
              row.className = `pst-hiddenRow${entry.explicit ? '' : ' pst-hiddenImplicit'}`;
              row.style.paddingInlineStart = `${6 + Math.max(0, entry.depth) * 12}px`;
              const title = document.createElement('span');
              title.className = 'pst-hiddenTitle';
              title.textContent = entry.title;
              title.title = entry.title;
              const show = document.createElement('button');
              show.type = 'button';
              show.className = 'pst-showButton';
              show.textContent = tr('showWorkspace');
              show.setAttribute('aria-label', `${tr('showWorkspace')}: ${entry.title}`);
              show.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                showEntry(entry);
              });
              row.append(title, show);
              panel.append(row);
            }
          };

          const renderBar = () => {
            const head = header();
            const entries = effectiveHiddenEntries();
            if (head === null || entries.length === 0) {
              if (entries.length === 0) hiddenOpen = false;
              removeBar();
              return;
            }
            if (bar === null || !bar.isConnected) {
              removePanel();
              bar = document.createElement('button');
              bar.type = 'button';
              bar.className = 'pst-hiddenBar';
              bar.addEventListener('click', () => {
                hiddenOpen = !hiddenOpen;
                renderBar();
              });
              const anchor = focusBar !== null && focusBar.isConnected ? focusBar : head;
              anchor.insertAdjacentElement('afterend', bar);
              barSignature = '';
            }
            const signature = `${activeLocale()}|${entries.map((entry) => `${entry.key}\u0000${entry.title}\u0000${entry.depth}\u0000${entry.explicit ? '1' : '0'}`).join('\u0001')}`;
            if (signature !== barSignature) {
              barSignature = signature;
              bar.textContent = '';
              const icon = document.createElement('span');
              icon.className = 'pst-hiddenBarIcon';
              icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.6 8s2.4-4 6.4-4 6.4 4 6.4 4-2.4 4-6.4 4S1.6 8 1.6 8z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.9" stroke="currentColor" stroke-width="1.2"/></svg>';
              const label = document.createElement('span');
              label.className = 'pst-hiddenBarLabel';
              label.textContent = tr('hiddenWorkspaces');
              const count = document.createElement('span');
              count.className = 'pst-hiddenBarCount';
              count.textContent = `(${entries.length})`;
              const chevron = document.createElement('span');
              chevron.className = 'pst-hiddenBarChevron';
              chevron.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3.5l5 4.5-5 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
              bar.append(icon, label, count, chevron);
            }
            bar.setAttribute('aria-expanded', hiddenOpen ? 'true' : 'false');
            bar.setAttribute('aria-controls', 'pst-hidden-workspaces-panel');
            bar.title = tr('hiddenWorkspacesHint');
            bar.setAttribute('aria-label', tr('hiddenWorkspacesHint'));
            renderPanel(entries);
          };

          const renderFocusBar = () => {
            const head = header();
            if (focusId !== '') {
              const target = runtime.workspaces.find((candidate) => candidate.workspaceId === focusId) || null;
              if (target === null) {
                focusId = '';
                writeFocusWorkspace('');
              }
            }
            if (head === null || focusId === '') {
              removeFocusBar();
              return;
            }
            const target = runtime.workspaces.find((candidate) => candidate.workspaceId === focusId) || null;
            if (target === null) {
              removeFocusBar();
              return;
            }
            if (focusBar === null || !focusBar.isConnected) {
              focusBar = document.createElement('div');
              focusBar.className = 'pst-focusBar';
              focusBar.setAttribute('role', 'status');
              const icon = document.createElement('span');
              icon.className = 'pst-focusBarIcon';
              icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="5.2" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="1.8" fill="currentColor"/><path d="M8 1.2v2M8 12.8v2M1.2 8h2M12.8 8h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
              const label = document.createElement('span');
              label.className = 'pst-focusBarLabel';
              const title = document.createElement('span');
              title.className = 'pst-focusBarTitle';
              const exit = document.createElement('button');
              exit.type = 'button';
              exit.className = 'pst-focusBarExit';
              exit.addEventListener('click', () => {
                focusId = '';
                writeFocusWorkspace('');
                applyHidden();
                renderFocusBar();
                renderBar();
              });
              focusBar.append(icon, label, title, exit);
              head.insertAdjacentElement('afterend', focusBar);
              focusSignature = '';
            } else if (focusBar.previousElementSibling !== head) {
              head.insertAdjacentElement('afterend', focusBar);
            }
            focusBar.title = tr('focusHint');
            const signature = `${activeLocale()}|${focusId}|${target.title || target.path || ''}`;
            if (signature !== focusSignature) {
              focusSignature = signature;
              const label = focusBar.querySelector('.pst-focusBarLabel');
              const title = focusBar.querySelector('.pst-focusBarTitle');
              const exit = focusBar.querySelector('.pst-focusBarExit');
              if (label !== null) label.textContent = tr('focusLabel');
              if (title !== null) title.textContent = target.title || target.path || '';
              if (exit !== null) exit.textContent = tr('exitFocus');
            }
          };

          const openWorkspaceRow = () => {
            const rows = document.querySelectorAll('[data-row-key^="workspace:"][class*="menuOpen"]');
            return rows.length === 0 ? null : rows[rows.length - 1];
          };
          const findMenu = () => {
            const row = openWorkspaceRow();
            if (row === null) return null;
            const candidates = document.querySelectorAll('button, [role="menuitem"]');
            for (const item of candidates) {
              if (row.contains(item) || item.getClientRects().length === 0) continue;
              const text = item.textContent.trim();
              if (!text.includes('删除工作区') && !text.includes('Delete workspace')) continue;
              const dangerTemplate = item;
              let container = item.parentElement;
              while (container !== null && container !== document.body) {
                if (container.querySelectorAll('button, [role="menuitem"]').length >= 2) break;
                container = container.parentElement;
              }
              if (container === null || container === document.body) break;
              let itemNode = item;
              while (itemNode.parentElement !== container) itemNode = itemNode.parentElement;
              let template = null;
              for (const peer of container.querySelectorAll('button, [role="menuitem"]')) {
                const peerText = peer.textContent.trim();
                if (peerText.includes('重命名') || peerText.includes('Rename')) {
                  template = peer;
                  break;
                }
              }
              return { container, itemNode, template, dangerTemplate };
            }
            const menus = document.querySelectorAll('[role="menu"]');
            for (let i = menus.length - 1; i >= 0; i -= 1) {
              const menu = menus[i];
              if (menu.getClientRects().length === 0) continue;
              const items = menu.querySelectorAll('[role="menuitem"]');
              if (items.length >= 2) {
                return {
                  container: menu,
                  itemNode: items[items.length - 1],
                  template: items[0],
                  dangerTemplate: items[items.length - 1],
                };
              }
            }
            return null;
          };
          const closeMenu = (row) => {
            if (row === null) return;
            const trigger =
              row.querySelector('button[aria-haspopup="menu"]')
              || row.querySelector('button[aria-expanded="true"]')
              || row.querySelector('[class*="rowActions"] button');
            if (trigger !== null) {
              try {
                trigger.click();
              } catch (_) {
                /* the menu also closes on outside pointerdown */
              }
            }
          };
          const SHOW_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.6 8s2.4-4 6.4-4 6.4 4 6.4 4-2.4 4-6.4 4S1.6 8 1.6 8z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.9" stroke="currentColor" stroke-width="1.2"/></svg>';
          const COLLAPSE_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.2 6.1L8 10.4l4.8-4.3" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          const EXPAND_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6.1 3.2L10.4 8l-4.3 4.8" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          const CHILD_HIDE_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.8 4.2h4.1l1.2 1.6h6.1v6.2H1.8z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M2.7 2.9l10.6 10.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
          const CHILD_SHOW_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.8 4.2h4.1l1.2 1.6h6.1v6.2H1.8z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 7.4v3.2M6.4 9h3.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
          const FOCUS_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="5.1" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="1.7" fill="currentColor"/><path d="M8 1.2v2M8 12.8v2M1.2 8h2M12.8 8h2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>';
          const HIDE_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 3l10 10M6.7 4.3A7.5 7.5 0 0 1 8 4c4 0 6.4 4 6.4 4a12 12 0 0 1-2.2 2.4M4.2 6.1A13 13 0 0 0 1.6 8S4 12 8 12c1.1 0 2.1-.3 3-.7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          const TRASH_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.8 4.6h10.4M6.2 4.6V3h3.6v1.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M4.3 4.6l.6 8.2h6.2l.6-8.2M6.7 7v3.6M9.3 7v3.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          const setMenuLabel = (item, label, original) => {
            const spans = item.querySelectorAll('span');
            for (const span of spans) {
              if (span.textContent.trim() === original) {
                span.textContent = label;
                return;
              }
            }
            const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
            let last = null;
            let node = walker.nextNode();
            while (node !== null) {
              if (node.nodeValue.trim() === original) {
                node.nodeValue = label;
                return;
              }
              if (node.nodeValue.trim() !== '') last = node;
              node = walker.nextNode();
            }
            if (last !== null) last.nodeValue = label;
            else item.appendChild(document.createTextNode(label));
          };
          const ensureMenuItem = () => {
            const target = findMenu();
            const row = openWorkspaceRow();
            if (target === null || row === null) return;
            const key = hiddenKeyOf(row);
            const title = rowTitle(row);
            const workspaceId = key.startsWith('workspace:') ? key.slice('workspace:'.length) : '';
            const workspace = runtime.workspaces.find((candidate) => candidate.workspaceId === workspaceId) || null;
            const parentOfTarget = workspace === null ? null : parentWorkspaceOf(workspace);
            const children = workspace === null ? [] : directChildrenOf(workspace);
            const hiddenChildren = children.filter((child) => isHidden(`workspace:${child.workspaceId}`));
            const showChildren = hiddenChildren.length > 0;
            const build = (marker, label, icon, handler, source) => {
              if (target.container.querySelector(`[${marker}]`) !== null) return;
              const template = source !== undefined && source !== null ? source : target.template;
              const originalLabel = template === null ? '' : template.textContent.trim();
              let item = null;
              if (template !== null) {
                item = template.cloneNode(true);
                item.removeAttribute('id');
                item.removeAttribute('data-testid');
                item.removeAttribute('aria-checked');
                item.removeAttribute('aria-disabled');
                item.removeAttribute('aria-keyshortcuts');
                item.removeAttribute('aria-expanded');
                item.removeAttribute('aria-haspopup');
                item.removeAttribute('aria-label');
                item.removeAttribute('aria-labelledby');
                item.removeAttribute('disabled');
                item.removeAttribute('title');
                for (const shortcut of item.querySelectorAll('kbd, [class*="shortcut"], [class*="Shortcut"]')) {
                  shortcut.remove();
                }
                setMenuLabel(item, label, originalLabel);
                const oldIcon = item.querySelector('svg');
                if (oldIcon === null) item.insertAdjacentHTML('afterbegin', icon);
                else oldIcon.outerHTML = icon;
              } else {
                item = document.createElement('button');
                item.type = 'button';
                item.className = 'pst-menuItem';
                item.innerHTML = `${icon}<span class="pst-menuLabel"></span>`;
                item.querySelector('.pst-menuLabel').textContent = label;
              }
              item.setAttribute(marker, '');
              if (item.tagName === 'BUTTON') item.type = 'button';
              item.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                handler();
              });
              if (target.itemNode === null || target.itemNode.parentElement !== target.container) return;
              try {
                target.container.insertBefore(item, target.itemNode);
              } catch (_) {
                /* the menu closed between discovery and insertion */
              }
            };
            const buildSeparator = (marker) => {
              if (target.container.querySelector(`[${marker}]`) !== null) return;
              if (target.itemNode === null || target.itemNode.parentElement !== target.container) return;
              const separator = document.createElement('div');
              separator.className = 'pst-menuSeparator';
              separator.setAttribute('role', 'separator');
              separator.setAttribute(marker, '');
              try {
                target.container.insertBefore(separator, target.itemNode);
              } catch (_) {
                /* the menu closed between discovery and insertion */
              }
            };
            const canCreate = workspace !== null && typeof workspace.path === 'string' && workspace.path !== '';
            if (canCreate) {
              build(
                'data-pst-new-child',
                tr('newChildWorkspace'),
                '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.8 4.2h4.1l1.2 1.6h6.1v6.2H1.8z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 8.2v3M6.5 9.7h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
                () => {
                  openChildDialog(workspace, title);
                  closeMenu(row);
                },
              );
              buildSeparator('data-pst-sep-create');
            }
            if (workspace !== null) {
              const isFocused = focusId === workspace.workspaceId;
              build(
                'data-pst-focus-workspace',
                isFocused ? tr('exitFocus') : tr('focusWorkspace'),
                FOCUS_ICON,
                () => {
                  focusId = isFocused ? '' : workspace.workspaceId;
                  writeFocusWorkspace(focusId);
                  applyHidden();
                  renderFocusBar();
                  renderBar();
                  closeMenu(row);
                },
              );
              const isCollapsed = collapsed.has(workspace.workspaceId);
              const hasMembers = children.length > 0
                || (Array.isArray(workspace.sessionIds) && workspace.sessionIds.length > 0);
              if (hasMembers) {
                build(
                  'data-pst-collapse-workspace',
                  isCollapsed ? tr('expandWorkspace') : tr('collapseWorkspace'),
                  isCollapsed ? EXPAND_ICON : COLLAPSE_ICON,
                  () => {
                    if (isCollapsed) collapsed.delete(workspace.workspaceId);
                    else collapsed.add(workspace.workspaceId);
                    writeCollapsedWorkspaces([...collapsed]);
                    applyHidden();
                    renderBar();
                    closeMenu(row);
                  },
                );
              }
            }
            if (children.length > 0) {
              build(
                'data-pst-toggle-children',
                showChildren
                  ? `${tr('showChildWorkspaces')} (${hiddenChildren.length})`
                  : `${tr('hideChildWorkspaces')} (${children.length})`,
                showChildren ? CHILD_SHOW_ICON : CHILD_HIDE_ICON,
                () => {
                  if (showChildren) {
                    for (const child of children) forgetHidden(`workspace:${child.workspaceId}`);
                  } else {
                    for (const child of children) {
                      rememberHidden(`workspace:${child.workspaceId}`, child.title || child.workspaceId);
                    }
                  }
                  applyHidden();
                  renderBar();
                  closeMenu(row);
                },
              );
            }
            buildSeparator('data-pst-sep-danger');
            build(
              'data-pst-hide-workspace',
              tr('hideWorkspace'),
              HIDE_ICON,
              () => {
                rememberHidden(key, title);
                applyHidden();
                renderBar();
                closeMenu(row);
              },
            );
            if (workspace !== null && parentOfTarget !== null) {
              build(
                'data-pst-delete-folder',
                tr('deleteFolder'),
                TRASH_ICON,
                () => {
                  openDeleteDialog(workspace, title);
                  closeMenu(row);
                },
                target.dangerTemplate,
              );
            }
          };

          const refresh = () => {
            timer = 0;
            applyHidden();
            applyTreeLayout();
            ensureMenuItem();
            renderFocusBar();
            renderBar();
          };
          const schedule = () => {
            if (timer !== 0) return;
            timer = setTimeout(refresh, 120);
          };
          const reloadState = () => {
            hidden = readHiddenWorkspaces();
            collapsed = new Set(readCollapsedWorkspaces());
            focusId = readFocusWorkspace();
            schedule();
          };
          const onPointerDown = (event) => {
            if (!hiddenOpen) return;
            const target = event.target;
            if (bar !== null && target instanceof Node && bar.contains(target)) return;
            if (panel !== null && target instanceof Node && panel.contains(target)) return;
            hiddenOpen = false;
            renderBar();
          };
          const observer = new MutationObserver(schedule);
          observer.observe(document.body, { childList: true, subtree: true });
          const localeOff = ctx.locale.subscribe(schedule);
          const onWorkspacesChanged = () => schedule();
          window.addEventListener('plugin-studio:workspaces-changed', onWorkspacesChanged);
          window.addEventListener('plugin-studio:state-changed', reloadState);
          document.addEventListener('pointerdown', onPointerDown, true);
          schedule();

          return () => {
            observer.disconnect();
            localeOff();
            window.removeEventListener('plugin-studio:workspaces-changed', onWorkspacesChanged);
            window.removeEventListener('plugin-studio:state-changed', reloadState);
            document.removeEventListener('pointerdown', onPointerDown, true);
            if (timer !== 0) clearTimeout(timer);
            removeBar();
            removeFocusBar();
            style.remove();
          };
        }, 'plugin-studio: workspace menu and hidden list');


        let opening = false;

        async function findAdjustSession(marker) {
          try {
            const controller = new AbortController();
            const search = ctx.sessions.search(marker, controller.signal).catch(() => undefined);
            let timer = 0;
            const timeout = new Promise((resolve) => {
              timer = setTimeout(() => {
                controller.abort();
                resolve(undefined);
              }, 2500);
            });
            const result = await Promise.race([search, timeout]);
            clearTimeout(timer);
            if (result === undefined || result === null || result.ok !== true) return undefined;
            const items = result.value !== undefined && result.value !== null && Array.isArray(result.value.items)
              ? result.value.items
              : [];
            return items.length === 0 ? undefined : items[0].sessionId;
          } catch (_) {
            return undefined;
          }
        }

        function buildPrompt(subject, marker, note) {
          const cleaned = typeof note === 'string' ? note.trim() : '';
          return [
            tr('promptHeader'),
            '',
            ...describeSubject(subject),
            '',
            tr('noteHeader'),
            cleaned === '' ? tr('noteEmpty') : cleaned,
            '',
            tr('promptSteps'),
            '',
            `${tr('tagNote')} ${marker}`,
          ].join('\n');
        }

        const openAdjust = async (subject, options) => {
          if (opening) return false;
          opening = true;
          try {
            const key = subjectKey(subject);
            const marker = markerFor(subject);
            const forceNew = options !== undefined && options.forceNew === true;
            if (!forceNew) {
              const remembered = runtime.lookup(key);
              if (remembered !== undefined) {
                ctx.uiWorkspace.openSession(remembered);
                return true;
              }
              const found = await findAdjustSession(marker);
              if (found !== undefined) {
                runtime.remember(key, found);
                ctx.uiWorkspace.openSession(found);
                return true;
              }
            }
            // Record the Session id as soon as the new conversation becomes
            // the retained main view, even when the user never sends the draft.
            runtime.beginPending(key);
            ctx.uiWorkspace.startSession(undefined, {
              prompt: buildPrompt(subject, marker, options === undefined ? undefined : options.note),
              clearPreviousDraft: true,
            });
            return true;
          } finally {
            opening = false;
          }
        };

        const selfSubject = () => ({
          kind: 'bundle',
          pkg: {
            name: SELF_PACKAGE,
            installed: true,
            enabled: true,
            official: false,
            availability: 'profile',
            rows: [],
          },
        });

        /**
         * Always-mounted, invisible observer in `shell.overlay`. The picker
         * unmounts when the new Session opens, so it cannot record the id it
         * just created; this observer follows the retained main-view Session and
         * finishes the pending target → Session mapping.
         */
        function MainSessionObserver(props) {
          const mainId = props.useSessions((state) => {
            if (state === undefined || state === null || state.byId === undefined) return null;
            for (const id of Object.keys(state.byId)) {
              const item = state.byId[id];
              if (item !== undefined && (item.retainedBy !== undefined && item.retainedBy !== null && (item.retainedBy.mainView || 0) > 0)) return id;
            }
            return null;
          });

          React.useEffect(() => {
            runtime.recordMainSession(mainId);
          }, [mainId]);

          return null;
        }

        function PluginPicker(props) {
          const [query, setQuery] = React.useState('');
          const [note, setNote] = React.useState('');
          const [list, setList] = React.useState({ status: 'loading', items: [], error: null });
          const [busy, setBusy] = React.useState(null);
          const generation = React.useRef(0);

          const load = React.useCallback(async () => {
            const run = generation.current + 1;
            generation.current = run;
            setList((previous) => ({ ...previous, status: 'loading', error: null }));
            try {
              const manager = ctx.remote === undefined ? undefined : ctx.remote.pluginManager;
              if (manager === undefined || manager === null) {
                throw new Error(tr('remoteUnavailable'));
              }
              const [bundlesResult, pluginsResult] = await Promise.all([
                manager.listBundles(),
                manager.listPlugins(),
              ]);
              if (generation.current !== run) return;
              if (bundlesResult === null || bundlesResult === undefined || bundlesResult.ok !== true) {
                throw new Error(
                  (bundlesResult && bundlesResult.error && bundlesResult.error.message)
                  || tr('loadFailed'),
                );
              }
              if (pluginsResult === null || pluginsResult === undefined || pluginsResult.ok !== true) {
                throw new Error(
                  (pluginsResult && pluginsResult.error && pluginsResult.error.message)
                  || tr('loadFailed'),
                );
              }
              const locale = activeLocale();
              const livePlugins = Array.isArray(pluginsResult.value) ? pluginsResult.value : [];
              const items = (Array.isArray(bundlesResult.value) ? bundlesResult.value : [])
                .map((bundle) => toPackageView(bundle, livePlugins, locale))
                .filter((item) => !item.official);
              items.sort((a, b) => {
                if (a.installed !== b.installed) return a.installed ? -1 : 1;
                return a.title.localeCompare(b.title);
              });
              setList({ status: 'ready', items, error: null });
            } catch (error) {
              if (generation.current !== run) return;
              setList({
                status: 'error',
                items: [],
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }, []);

          React.useEffect(() => {
            load();
            return () => {
              generation.current += 1;
            };
          }, [load]);

          const run = (key, subject, forceNew) => {
            if (busy !== null) return;
            setBusy(key);
            Promise.resolve(openAdjust(subject, { forceNew, note }))
              .catch((error) => {
                console.error('plugin-studio: could not open adjustment conversation', error);
              })
              .finally(() => setBusy(null));
          };

          const needle = query.trim().toLowerCase();
          const items = needle === ''
            ? list.items
            : list.items.filter((item) => {
                if (item.title.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle)) return true;
                return item.rows.some((row) =>
                  `${row.title} ${row.rowId} ${row.moduleName}`.toLowerCase().includes(needle),
                );
              });

          const enabledText = tr('enabled');
          const disabledText = tr('disabled');
          const notInstalledText = tr('notInstalled');
          const officialText = tr('official');
          const actionText = tr('action');
          const rowActionText = tr('rowAction');
          const openingText = tr('opening');
          const detailsText = tr('openDetails');

          return h(
            'div',
            { className: 'pst-picker' },
            h('style', null, CSS),
            h(
              'label',
              { className: 'pst-field' },
              h('span', { className: 'pst-fieldLabel' }, tr('noteLabel')),
              h('textarea', {
                className: 'pst-textarea',
                value: note,
                rows: 3,
                placeholder: tr('notePlaceholder'),
                onChange: (event) => setNote(event.target.value),
              }),
              h('span', { className: 'pst-hint' }, tr('noteHint')),
            ),
            h(
              'div',
              { className: 'pst-listHead' },
              h(
                'div',
                null,
                h('h4', { className: 'pst-listTitle' }, tr('choosePlugin')),
                h('p', { className: 'pst-listIntro' }, tr('choosePluginHint')),
              ),
              h(
                'div',
                { className: 'pst-tools' },
                h('input', {
                  className: 'pst-search',
                  type: 'search',
                  value: query,
                  placeholder: tr('search'),
                  'aria-label': tr('search'),
                  onChange: (event) => setQuery(event.target.value),
                }),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'pst-btn',
                    title: tr('selfAction'),
                    disabled: busy !== null,
                    onClick: () => run('self', selfSubject(), false),
                  },
                  h(SlidersGlyph, { size: 14 }),
                  busy === 'self' ? openingText : tr('selfAction'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'pst-btn',
                    onClick: load,
                    disabled: list.status === 'loading',
                  },
                  tr('refresh'),
                ),
              ),
            ),
            list.status === 'error'
              ? h(
                  'div',
                  { className: 'pst-error', role: 'alert' },
                  h('div', { className: 'pst-errorText' }, `${tr('loadFailed')}${list.error === null ? '' : `: ${list.error}`}`),
                  h('button', { type: 'button', className: 'pst-btn', onClick: load }, tr('retry')),
                )
              : null,
            list.status === 'loading' && list.items.length === 0
              ? h('div', { className: 'pst-empty' }, tr('loading'))
              : null,
            list.status !== 'error' && list.items.length > 0 && items.length === 0
              ? h('div', { className: 'pst-empty' }, tr('empty'))
              : null,
            items.length > 0
              ? h(
                  'ul',
                  { className: 'pst-list' },
                  ...items.map((item) =>
                    h(
                      'li',
                      { className: 'pst-card', key: item.name },
                      h(
                        'div',
                        { className: 'pst-cardTop' },
                        h(
                          'div',
                          { className: 'pst-cardText' },
                          h(
                            'div',
                            { className: 'pst-titleLine' },
                            h('span', { className: 'pst-title' }, item.title),
                            h(
                              'span',
                              { className: `pst-chip${item.enabled ? ' on' : ''}` },
                              item.enabled ? enabledText : disabledText,
                            ),
                            item.installed ? null : h('span', { className: 'pst-chip' }, notInstalledText),
                            item.official ? h('span', { className: 'pst-chip' }, officialText) : null,
                          ),
                          h(
                            'div',
                            { className: 'pst-meta', title: item.source === undefined ? undefined : item.source },
                            `${item.name}${item.version === undefined ? '' : ` · v${item.version}`}${item.availability === undefined ? '' : ` · ${item.availability}`}`,
                          ),
                          item.description === undefined
                            ? null
                            : h('p', { className: 'pst-desc' }, item.description),
                        ),
                        h(
                          'div',
                          { className: 'pst-cardActions' },
                          h(
                            'button',
                            {
                              type: 'button',
                              className: 'pst-btn',
                              title: tr('actionHint'),
                              disabled: busy !== null,
                              onClick: (event) =>
                                run(
                                  `bundle:${item.name}`,
                                  { kind: 'bundle', pkg: item.pkg },
                                  event.shiftKey,
                                ),
                            },
                            h(ChatGlyph),
                            busy === `bundle:${item.name}` ? openingText : actionText,
                          ),
                          typeof props.openPackage === 'function'
                            ? h(
                                'button',
                                {
                                  type: 'button',
                                  className: 'pst-link',
                                  onClick: () => props.openPackage(item.name),
                                },
                                detailsText,
                              )
                            : null,
                        ),
                      ),
                      item.rows.length === 0
                        ? null
                        : h(
                            'details',
                            { className: 'pst-rowsWrap' },
                            h('summary', null, `${tr('showRows')} (${item.rows.length})`),
                            h(
                              'ul',
                              { className: 'pst-rows' },
                              ...item.rows.map((row) =>
                                h(
                                  'li',
                                  { className: 'pst-row', key: `${item.name}#${row.rowId}` },
                                  h(
                                    'div',
                                    { className: 'pst-rowText' },
                                    h('span', { className: 'pst-rowTitle' }, row.title),
                                    h('span', { className: 'pst-rowModule' }, row.moduleName),
                                    h(
                                      'span',
                                      { className: `pst-chip${row.enabled ? ' on' : ''}` },
                                      row.enabled ? enabledText : disabledText,
                                    ),
                                  ),
                                  h(
                                    'button',
                                    {
                                      type: 'button',
                                      className: 'pst-chipButton',
                                      title: tr('rowHint'),
                                      disabled: busy !== null,
                                      onClick: (event) =>
                                        run(
                                          `row:${item.name}#${row.rowId}`,
                                          {
                                            kind: 'row',
                                            pkg: item.pkg,
                                            row: {
                                              rowId: row.rowId,
                                              moduleName: row.moduleName,
                                              enabled: row.enabled,
                                            },
                                          },
                                          event.shiftKey,
                                        ),
                                    },
                                    busy === `row:${item.name}#${row.rowId}` ? openingText : rowActionText,
                                  ),
                                ),
                              ),
                            ),
                          ),
                    ),
                  ),
                )
              : null,
          );
        }

        function TourGlyph({ step }) {
          const base = { width: 64, height: 64, viewBox: '0 0 64 64', fill: 'none', 'aria-hidden': 'true' };
          if (step === 0) {
            return h(
              'svg',
              base,
              h('path', { d: 'M9 22h20l5 6h21v22H9z', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }),
              h('path', { d: 'M9 22v-5h17l5 5', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }),
              h('circle', { cx: 46, cy: 44, r: 10, fill: 'var(--dsw-alias-bg-layer-1)', stroke: 'currentColor', strokeWidth: 2 }),
              h('path', { d: 'M46 39v10M41 44h10', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
            );
          }
          if (step === 1) {
            return h(
              'svg',
              base,
              h('path', { d: 'M32 8l19 7v13c0 12-8 21-19 27-11-6-19-15-19-27V15z', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }),
              h('path', { d: 'M23 31l6 6 13-13', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
              h('path', { d: 'M17 16h10M17 22h7', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeOpacity: 0.55 }),
            );
          }
          return h(
            'svg',
            base,
            h('path', { d: 'M11 14h31a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H28l-9 8v-8h-8a5 5 0 0 1-5-5V19a5 5 0 0 1 5-5z', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }),
            h('path', { d: 'M18 23h20M18 29h13', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }),
            h('path', { d: 'M48 12l1.8 5.2L55 19l-5.2 1.8L48 26l-1.8-5.2L41 19l5.2-1.8z', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' }),
          );
        }

        function Onboarding() {
          const [open, setOpen] = React.useState(() => !readTourSeen());
          const [step, setStep] = React.useState(0);

          React.useEffect(() => {
            const onOpen = () => {
              setStep(0);
              setOpen(true);
            };
            window.addEventListener('plugin-studio:onboarding', onOpen);
            return () => window.removeEventListener('plugin-studio:onboarding', onOpen);
          }, []);

          const close = () => {
            writeTourSeen();
            setOpen(false);
            setStep(0);
          };

          React.useEffect(() => {
            if (!open) return undefined;
            const onKeyDown = (event) => {
              if (event.key === 'Escape') close();
            };
            window.addEventListener('keydown', onKeyDown);
            return () => window.removeEventListener('keydown', onKeyDown);
          }, [open]);

          if (!open) return null;

          const steps = [
            {
              title: tr('tourStep1Title'),
              body: tr('tourStep1Body'),
              items: [tr('tourStep1a'), tr('tourStep1b'), tr('tourStep1c')],
            },
            {
              title: tr('tourStep2Title'),
              body: tr('tourStep2Body'),
              items: [tr('tourStep2a'), tr('tourStep2b'), tr('tourStep2c')],
            },
            {
              title: tr('tourStep3Title'),
              body: tr('tourStep3Body'),
              items: [tr('tourStep3a'), tr('tourStep3b'), tr('tourStep3c')],
            },
          ];
          const current = steps[step];
          const last = step === steps.length - 1;

          return h(
            'div',
            { className: 'pst-tourLayer' },
            h('div', { className: 'pst-tourBackdrop' }),
            h(
              'div',
              {
                className: 'pst-tourCard',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': 'pst-tour-title',
              },
              h(
                'div',
                { className: 'pst-tourTop' },
                h('div', { className: 'pst-tourKicker' }, tr('tourKicker')),
                h('div', { className: 'pst-tourTopRight' },
                  h('span', { className: 'pst-tourCount' }, `${step + 1} / ${steps.length}`),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'pst-tourClose',
                      onClick: close,
                      'aria-label': tr('tourClose'),
                    },
                    '×',
                  ),
                ),
              ),
              h('div', { className: 'pst-tourArt' }, h(TourGlyph, { step })),
              h('h2', { className: 'pst-tourTitle', id: 'pst-tour-title' }, current.title),
              h('p', { className: 'pst-tourBody' }, current.body),
              h(
                'ul',
                { className: 'pst-tourList' },
                current.items.map((item, index) => h('li', { key: index }, item)),
              ),
              h(
                'div',
                { className: 'pst-tourFoot' },
                h('button', { type: 'button', className: 'pst-tourSkip', onClick: close }, tr('tourSkip')),
                h(
                  'div',
                  { className: 'pst-tourDots' },
                  steps.map((item, index) =>
                    h('span', {
                      key: item.title,
                      className: `pst-tourDot${index === step ? ' pst-tourDotActive' : ''}`,
                    })),
                ),
                h(
                  'div',
                  { className: 'pst-tourActions' },
                  step === 0
                    ? null
                    : h(
                      'button',
                      {
                        type: 'button',
                        className: 'pst-btn',
                        onClick: () => setStep((value) => Math.max(0, value - 1)),
                      },
                      tr('tourBack'),
                    ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'pst-btn pst-btnPrimary',
                      onClick: () => {
                        if (last) close();
                        else setStep((value) => Math.min(steps.length - 1, value + 1));
                      },
                    },
                    last ? tr('tourStart') : tr('tourNext'),
                  ),
                ),
              ),
            ),
          );
        }

        function CoachTour() {
          const [open, setOpen] = React.useState(() => !readTourSeen());
          const [step, setStep] = React.useState(0);
          const [tick, setTick] = React.useState(0);
          const hadChildDialog = React.useRef(false);

          const findVisible = (selector) => {
            for (const element of document.querySelectorAll(selector)) {
              const rect = element.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight) return element;
            }
            return null;
          };
          const findText = (labels) => {
            for (const element of document.querySelectorAll('[role="tab"], button')) {
              const text = (element.textContent || '').trim();
              if (!labels.some((label) => text === label || text.startsWith(`${label} `))) continue;
              const rect = element.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight) return element;
            }
            return null;
          };
          const targetForStep = (value) => {
            if (value === 0) {
              return findVisible('[data-slot="sidebar.workspaces"] [data-row-key^="workspace:"]')
                || findVisible('[data-row-key^="workspace:"]');
            }
            if (value === 1) return findVisible('[data-pst-new-child]');
            if (value === 2) return findVisible('.pst-childInput') || findVisible('.pst-childModal');
            if (value === 3) {
              return findText([tr('tabLabel'), 'Plugin chats', '插件对话'])
                || findVisible('button[aria-label*="Settings"], button[aria-label*="设置"], [role="button"][aria-label*="Settings"], [role="button"][aria-label*="设置"]');
            }
            return null;
          };

          React.useEffect(() => {
            const onOpen = () => {
              setStep(0);
              setOpen(true);
            };
            window.addEventListener('plugin-studio:onboarding', onOpen);
            return () => window.removeEventListener('plugin-studio:onboarding', onOpen);
          }, []);

          React.useEffect(() => {
            if (!open) return undefined;
            const id = window.setInterval(() => setTick((value) => value + 1), 250);
            return () => window.clearInterval(id);
          }, [open]);

          React.useEffect(() => {
            if (!open) return;
            if (step === 0 && findVisible('[data-pst-new-child]') !== null) setStep(1);
            else if (step === 1 && findVisible('.pst-childModal') !== null) {
              hadChildDialog.current = true;
              setStep(2);
            } else if (step === 2) {
              if (findVisible('.pst-childModal') !== null) {
                hadChildDialog.current = true;
              } else if (hadChildDialog.current) {
                hadChildDialog.current = false;
                setStep(3);
              }
            }
          }, [open, step, tick]);

          const close = () => {
            writeTourSeen();
            setOpen(false);
            setStep(0);
          };

          React.useEffect(() => {
            if (!open) return undefined;
            const onKeyDown = (event) => {
              if (event.key === 'Escape') close();
            };
            window.addEventListener('keydown', onKeyDown);
            return () => window.removeEventListener('keydown', onKeyDown);
          }, [open]);

          if (!open) return null;

          const steps = [
            {
              title: tr('tourStep1Title'),
              body: tr('tourStep1Body'),
              items: [],
            },
            {
              title: tr('tourStep2Title'),
              body: tr('tourStep2Body'),
              items: [tr('tourStep2a'), tr('tourStep2b'), tr('tourStep2c')],
            },
            {
              title: tr('tourInputTitle'),
              body: tr('tourInputBody'),
              items: [tr('tourStep1c'), tr('tourStep2b')],
            },
            {
              title: tr('tourStep3Title'),
              body: tr('tourStep3Body'),
              items: [tr('tourStep3a'), tr('tourStep3b'), tr('tourStep3c')],
            },
          ];
          const current = steps[step];
          const target = targetForStep(step);
          const rect = target === null ? null : target.getBoundingClientRect();
          const tipWidth = Math.max(260, Math.min(360, window.innerWidth - 24));
          let left = rect === null
            ? (window.innerWidth - tipWidth) / 2
            : rect.left + rect.width / 2 - tipWidth / 2;
          left = Math.max(12, Math.min(left, window.innerWidth - tipWidth - 12));
          let top = rect === null ? Math.max(20, window.innerHeight / 2 - 120) : rect.bottom + 12;
          const estimatedHeight = 260;
          if (rect !== null && step === 2) {
            top = Math.max(12, rect.top - estimatedHeight - 12);
          } else if (rect !== null && top + estimatedHeight > window.innerHeight) {
            top = Math.max(12, rect.top - estimatedHeight - 12);
          }
          const last = step === steps.length - 1;

          return h(
            'div',
            { className: 'pst-coachLayer', 'aria-live': 'polite' },
            rect === null
              ? null
              : h('div', {
                className: 'pst-coachSpot',
                style: {
                  left: `${Math.max(0, rect.left - 6)}px`,
                  top: `${Math.max(0, rect.top - 6)}px`,
                  width: `${rect.width + 12}px`,
                  height: `${rect.height + 12}px`,
                },
              }),
            h(
              'div',
              {
                className: `pst-coachTip${rect === null ? ' pst-coachTipCenter' : ''}`,
                style: { left: `${left}px`, top: `${top}px`, width: `${tipWidth}px` },
                role: 'dialog',
                'aria-modal': 'false',
                'aria-labelledby': 'pst-coach-title',
              },
              h(
                'div',
                { className: 'pst-coachTop' },
                h('div', { className: 'pst-coachKicker' }, tr('tourKicker')),
                h(
                  'div',
                  { className: 'pst-coachTopRight' },
                  h('span', { className: 'pst-coachCount' }, `${step + 1} / ${steps.length}`),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'pst-coachClose',
                      onClick: close,
                      'aria-label': tr('tourClose'),
                    },
                    '×',
                  ),
                ),
              ),
              h('h2', { className: 'pst-coachTitle', id: 'pst-coach-title' }, current.title),
              h('p', { className: 'pst-coachBody' }, current.body),
              current.items.length === 0
                ? null
                : h(
                  'ul',
                  { className: 'pst-coachList' },
                  current.items.map((item, index) => h('li', { key: index }, item)),
                ),
              h(
                'div',
                { className: 'pst-coachFoot' },
                h('button', { type: 'button', className: 'pst-coachSkip', onClick: close }, tr('tourSkip')),
                h(
                  'div',
                  { className: 'pst-coachDots' },
                  steps.map((item, index) =>
                    h('span', {
                      key: item.title,
                      className: `pst-coachDot${index === step ? ' pst-coachDotActive' : ''}`,
                    })),
                ),
                h(
                  'div',
                  { className: 'pst-coachActions' },
                  step === 0
                    ? null
                    : h(
                      'button',
                      {
                        type: 'button',
                        className: 'pst-btn',
                        onClick: () => setStep((value) => Math.max(0, value - 1)),
                      },
                      tr('tourBack'),
                    ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'pst-btn pst-btnPrimary',
                      onClick: () => {
                        if (last) close();
                        else setStep((value) => Math.min(steps.length - 1, value + 1));
                      },
                    },
                    last ? tr('tourStart') : tr('tourNext'),
                  ),
                ),
              ),
            ),
          );
        }

        function QuickSwitcher(props) {
          const [open, setOpen] = React.useState(false);
          const [query, setQuery] = React.useState('');
          const [active, setActive] = React.useState(0);
          const inputRef = React.useRef(null);
          const workspaceItems = props.useWorkspaces((state) =>
            (state === undefined || state === null ? undefined : state.items));
          const sessionState = props.useSessions((state) => state);
          const workspaces = Array.isArray(workspaceItems) ? workspaceItems : [];

          React.useEffect(() => {
            const onKeyDown = (event) => {
              const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
              if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'k') {
                event.preventDefault();
                setOpen((value) => !value);
                return;
              }
              if (event.key === 'Escape') setOpen(false);
            };
            const onOpen = () => setOpen(true);
            window.addEventListener('keydown', onKeyDown);
            window.addEventListener('plugin-studio:quick-switcher', onOpen);
            return () => {
              window.removeEventListener('keydown', onKeyDown);
              window.removeEventListener('plugin-studio:quick-switcher', onOpen);
            };
          }, []);

          React.useEffect(() => {
            if (!open) {
              setQuery('');
              return undefined;
            }
            setActive(0);
            const handle = window.setTimeout(() => {
              if (inputRef.current !== null) inputRef.current.focus();
            }, 0);
            return () => window.clearTimeout(handle);
          }, [open]);

          const results = React.useMemo(() => {
            const needle = query.trim().toLowerCase();
            const owner = new Map();
            for (const workspace of workspaces) {
              for (const sessionId of workspace.sessionIds || []) owner.set(sessionId, workspace);
            }
            const items = [];
            for (const workspace of workspaces) {
              const title = workspace.title || workspace.path || workspace.workspaceId;
              const haystack = `${title} ${workspace.path || ''}`.toLowerCase();
              if (needle !== '' && !haystack.includes(needle)) continue;
              items.push({
                kind: 'workspace',
                id: workspace.workspaceId,
                title,
                subtitle: workspace.path || '',
              });
            }
            const sessions = [];
            if (sessionState !== undefined && sessionState !== null && sessionState.ids !== undefined) {
              for (const sessionId of sessionState.ids) {
                const summary = sessionState.byId === undefined ? undefined : sessionState.byId[sessionId];
                if (summary === undefined || summary === null || summary.blank) continue;
                const workspace = owner.get(sessionId);
                const title = summary.title || tr('quickSwitchUntitled');
                const subtitle = workspace === undefined
                  ? (summary.cwd || '')
                  : (workspace.title || workspace.path || '');
                const haystack = `${title} ${subtitle}`.toLowerCase();
                if (needle !== '' && !haystack.includes(needle)) continue;
                sessions.push({
                  kind: 'session',
                  id: sessionId,
                  title,
                  subtitle,
                  updatedAt: typeof summary.updatedAt === 'number' ? summary.updatedAt : 0,
                });
              }
            }
            sessions.sort((a, b) => b.updatedAt - a.updatedAt);
            return [...items, ...sessions].slice(0, 40);
          }, [query, sessionState, workspaces]);

          React.useEffect(() => {
            setActive((value) => Math.max(0, Math.min(value, results.length - 1)));
          }, [results.length]);

          if (!open) return null;

          const choose = (item) => {
            if (item === undefined) return;
            try {
              if (item.kind === 'workspace') {
                const opened = ctx.uiWorkspace.openWorkspace(item.id);
                if (opened !== undefined && opened !== null && typeof opened.catch === 'function') opened.catch(() => {});
              } else {
                ctx.uiWorkspace.openSession(item.id);
              }
            } catch (_) {
              /* the workspace or session may have disappeared between search and open */
            }
            setOpen(false);
          };

          const onInputKeyDown = (event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((value) => Math.min(value + 1, Math.max(0, results.length - 1)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((value) => Math.max(0, value - 1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              choose(results[active]);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
            }
          };

          return h(
            'div',
            {
              className: 'pst-switcherBackdrop',
              onMouseDown: () => setOpen(false),
            },
            h(
              'div',
              {
                className: 'pst-switcher',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': tr('quickSwitch'),
                onMouseDown: (event) => event.stopPropagation(),
              },
              h('input', {
                ref: inputRef,
                className: 'pst-switcherInput',
                value: query,
                placeholder: tr('quickSwitchPlaceholder'),
                onChange: (event) => {
                  setQuery(event.target.value);
                  setActive(0);
                },
                onKeyDown: onInputKeyDown,
              }),
              h(
                'div',
                { className: 'pst-switcherList', role: 'listbox' },
                results.length === 0
                  ? h('div', { className: 'pst-switcherEmpty' }, tr('quickSwitchEmpty'))
                  : results.map((item, index) =>
                    h(
                      'button',
                      {
                        key: `${item.kind}:${item.id}`,
                        type: 'button',
                        role: 'option',
                        'aria-selected': index === active ? 'true' : 'false',
                        className: `pst-switcherItem${index === active ? ' pst-switcherItemActive' : ''}`,
                        onMouseEnter: () => setActive(index),
                        onClick: () => choose(item),
                      },
                      h('span', { className: 'pst-switcherKind' }, tr(item.kind === 'workspace' ? 'quickSwitchWorkspace' : 'quickSwitchSession')),
                      h(
                        'span',
                        { className: 'pst-switcherText' },
                        h('span', { className: 'pst-switcherTitle' }, item.title),
                        item.subtitle === '' ? null : h('span', { className: 'pst-switcherMeta' }, item.subtitle),
                      ),
                    )),
              ),
              h('div', { className: 'pst-switcherFoot' }, tr('quickSwitchKeys')),
            ),
          );
        }

        function WorkspaceStudioTab(props) {
          const workspaceItems = props.useWorkspaces((state) =>
            (state === undefined || state === null ? undefined : state.items));
          const workspaces = Array.isArray(workspaceItems) ? workspaceItems : [];
          const [health, setHealth] = React.useState({ status: 'idle', data: null, error: '' });
          const [presets, setPresets] = React.useState(() => readViewPresets());
          const [removed, setRemoved] = React.useState(() => readRemovedWorkspaces());
          const [hiddenEntries, setHiddenEntries] = React.useState(() => readHiddenWorkspaces());
          const [restoreBusy, setRestoreBusy] = React.useState('');
          const [presetName, setPresetName] = React.useState('');
          const [focus, setFocus] = React.useState(() => readFocusWorkspace());
          const [collapsedCount, setCollapsedCount] = React.useState(() => readCollapsedWorkspaces().length);
          const [notice, setNotice] = React.useState('');

          React.useEffect(() => {
            const refresh = () => {
              setPresets(readViewPresets());
              setRemoved(readRemovedWorkspaces());
              setHiddenEntries(readHiddenWorkspaces());
              setFocus(readFocusWorkspace());
              setCollapsedCount(readCollapsedWorkspaces().length);
            };
            window.addEventListener('plugin-studio:state-changed', refresh);
            return () => window.removeEventListener('plugin-studio:state-changed', refresh);
          }, []);

          const focusTarget = workspaces.find((workspace) => workspace.workspaceId === focus) || null;
          const focusTitle = focusTarget === null ? focus : (focusTarget.title || focusTarget.path || focus);
          const hiddenCount = hiddenEntries.length;
          const parentOfWorkspace = (workspace) => {
            const targetPath = normalizePath(workspace.path);
            return workspaces
              .filter((candidate) =>
                candidate !== null
                && candidate !== undefined
                && candidate.workspaceId !== workspace.workspaceId
                && typeof candidate.path === 'string')
              .filter((candidate) => targetPath.startsWith(`${normalizePath(candidate.path)}/`))
              .sort((a, b) => b.path.length - a.path.length)[0] || null;
          };
          const showHidden = (entry) => {
            const workspaceId = entry.key.startsWith('workspace:') ? entry.key.slice('workspace:'.length) : '';
            const workspace = workspaces.find((candidate) => candidate.workspaceId === workspaceId) || null;
            const keys = new Set([entry.key]);
            if (workspace !== null) {
              let parent = parentOfWorkspace(workspace);
              while (parent !== null) {
                keys.add(`workspace:${parent.workspaceId}`);
                parent = parentOfWorkspace(parent);
              }
            }
            const next = readHiddenWorkspaces().filter((item) => !keys.has(item.key));
            writeHiddenWorkspaces(next);
            setHiddenEntries(next);
            const collapsedBefore = readCollapsedWorkspaces();
            const collapsed = collapsedBefore.filter((id) => !keys.has(`workspace:${id}`));
            if (collapsed.length !== collapsedBefore.length) {
              writeCollapsedWorkspaces(collapsed);
            }
            if (readFocusWorkspace() !== '') {
              writeFocusWorkspace('');
              setFocus('');
            }
          };

          const runHealth = async () => {
            setHealth({ status: 'loading', data: null, error: '' });
            try {
              const response = await fetch('/plugin-studio/health', {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-plugin-studio': '1' },
                body: '{}',
              });
              const payload = await response.json();
              if (!response.ok || payload === null || payload.ok !== true) {
                throw new Error(payload !== null && typeof payload.message === 'string' ? payload.message : 'health failed');
              }
              setHealth({ status: 'ready', data: payload, error: '' });
            } catch (error) {
              setHealth({
                status: 'error',
                data: null,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          };

          const savePreset = () => {
            const name = presetName.trim();
            if (name === '') return;
            const preset = {
              id: `pst-${Date.now().toString(36)}`,
              name: name.slice(0, 40),
              hidden: readHiddenWorkspaces(),
              collapsed: readCollapsedWorkspaces(),
              createdAt: Date.now(),
            };
            const next = [preset, ...presets].slice(0, 40);
            writeViewPresets(next);
            setPresets(next);
            setPresetName('');
            setNotice(tr('presetSaved'));
          };

          const applyPreset = (preset) => {
            writeHiddenWorkspaces(Array.isArray(preset.hidden) ? preset.hidden : []);
            writeCollapsedWorkspaces(Array.isArray(preset.collapsed) ? preset.collapsed : []);
            writeFocusWorkspace('');
            setFocus('');
            setNotice(preset.name);
          };

          const deletePreset = (preset) => {
            const next = presets.filter((item) => item.id !== preset.id);
            writeViewPresets(next);
            setPresets(next);
          };

          const copyPath = (issue) => {
            if (typeof issue.path !== 'string' || issue.path === '') return;
            const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
            if (clipboard === undefined || clipboard === null || typeof clipboard.writeText !== 'function') return;
            clipboard.writeText(issue.path).then(() => setNotice(tr('healthCopied'))).catch(() => {});
          };

          const openIssue = (issue) => {
            if (typeof issue.workspaceId !== 'string' || issue.workspaceId === '') return;
            try {
              const opened = ctx.uiWorkspace.openWorkspace(issue.workspaceId);
              if (opened !== undefined && opened !== null && typeof opened.catch === 'function') opened.catch(() => {});
            } catch (_) {
              /* a missing workspace cannot be opened */
            }
          };

          const restoreRemoved = async (entry) => {
            if (restoreBusy !== '') return;
            setRestoreBusy(entry.workspaceId);
            const parentPath = normalizePath(entry.path);
            const descendants = readRemovedWorkspaces().filter((other) => {
              if (other.workspaceId === entry.workspaceId) return false;
              const candidate = normalizePath(other.path);
              return candidate !== parentPath && candidate.startsWith(`${parentPath}/`);
            });
            const targets = [entry, ...descendants].sort((a, b) => a.path.length - b.path.length);
            const succeeded = new Set();
            const succeededPaths = new Set();
            const failures = [];
            try {
              for (const target of targets) {
                try {
                  const response = await fetch('/plugin-studio/restore-workspace', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', 'x-plugin-studio': '1' },
                    body: JSON.stringify({ path: target.path, title: target.title }),
                  });
                  const payload = await response.json();
                  if (!response.ok || payload === null || payload.ok !== true) {
                    const code = payload !== null && typeof payload.code === 'string' ? payload.code : '';
                    throw new Error(code === 'missing' ? tr('removedMissing') : (payload !== null && typeof payload.message === 'string' ? payload.message : tr('removedFailed')));
                  }
                  succeeded.add(target.workspaceId);
                  succeededPaths.add(normalizePath(target.path));
                } catch (error) {
                  failures.push(`${target.title}: ${error instanceof Error ? error.message : String(error)}`);
                }
              }
              const next = readRemovedWorkspaces().filter(
                (item) => !succeeded.has(item.workspaceId) && !succeededPaths.has(normalizePath(item.path)),
              );
              writeRemovedWorkspaces(next);
              setRemoved(next);
              const hiddenBefore = readHiddenWorkspaces();
              const hiddenNext = hiddenBefore.filter((item) => {
                const id = item.key.startsWith('workspace:') ? item.key.slice('workspace:'.length) : '';
                return !succeeded.has(id);
              });
              if (hiddenNext.length !== hiddenBefore.length) writeHiddenWorkspaces(hiddenNext);
              const collapsedBefore = readCollapsedWorkspaces();
              const collapsedNext = collapsedBefore.filter((id) => !succeeded.has(id));
              if (collapsedNext.length !== collapsedBefore.length) writeCollapsedWorkspaces(collapsedNext);
              if (succeeded.has(readFocusWorkspace())) {
                writeFocusWorkspace('');
                setFocus('');
              }
              setNotice(
                succeeded.size === 0
                  ? `${tr('removedFailed')} ${failures.join('；')}`
                  : failures.length === 0
                    ? tr('removedSuccess')
                    : `${tr('removedSuccess')} ${failures.join('；')}`,
              );
            } catch (error) {
              setNotice(`${tr('removedFailed')} ${error instanceof Error ? error.message : String(error)}`);
            } finally {
              setRestoreBusy('');
            }
          };

          const forgetRemoved = (entry) => {
            const next = readRemovedWorkspaces().filter((item) => item.workspaceId !== entry.workspaceId);
            writeRemovedWorkspaces(next);
            setRemoved(next);
          };

          const issueLabel = (code) => {
            if (code === 'missing') return tr('healthMissing');
            if (code === 'not-directory') return tr('healthNotDir');
            if (code === 'symlink') return tr('healthSymlink');
            if (code === 'duplicate') return tr('healthDuplicate');
            if (code === 'empty') return tr('healthEmpty');
            if (code === 'deep') return tr('healthDeep');
            return code;
          };

          const issues = health.status === 'ready' && health.data !== null && Array.isArray(health.data.issues)
            ? health.data.issues
            : [];

          return h(
            'div',
            { className: 'pst-tab pst-workspaceTab' },
            h(
              'header',
              { className: 'pst-tabHead' },
              h('h3', { className: 'pst-tabTitle' }, tr('workspaceTabLabel')),
              h('p', { className: 'pst-tabIntro' }, tr('workspaceTabIntro')),
            ),
            h(
              'div',
              { className: 'pst-wsToolbar' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'pst-btn',
                  onClick: () => window.dispatchEvent(new Event('plugin-studio:quick-switcher')),
                },
                tr('quickSwitch'),
                h('kbd', { className: 'pst-kbd' }, 'Ctrl+Shift+K'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'pst-btn',
                  onClick: () => window.dispatchEvent(new Event('plugin-studio:onboarding')),
                },
                tr('tutorial'),
              ),
              h('span', { className: 'pst-wsStat' }, tr('presetHiddenCount').replace('{count}', String(hiddenCount))),
              h('span', { className: 'pst-wsStat' }, tr('presetCollapsedCount').replace('{count}', String(collapsedCount))),
              focus === ''
                ? null
                : h(
                  'button',
                  {
                    type: 'button',
                    className: 'pst-btn',
                    onClick: () => {
                      writeFocusWorkspace('');
                      setFocus('');
                    },
                  },
                  `${tr('currentFocus')}: ${focusTitle} · ${tr('clearFocus')}`,
                ),
            ),
            notice === '' ? null : h('div', { className: 'pst-wsNotice' }, notice),
            h(
              'section',
              { className: 'pst-card' },
              h(
                'div',
                { className: 'pst-cardTop' },
                h(
                  'div',
                  { className: 'pst-cardText' },
                  h('div', { className: 'pst-title' }, tr('hiddenTitle')),
                  h('p', { className: 'pst-desc' }, tr('hiddenIntro')),
                ),
              ),
              hiddenEntries.length === 0
                ? h('div', { className: 'pst-empty' }, tr('hiddenEmpty'))
                : h(
                  'div',
                  { className: 'pst-presetList' },
                  hiddenEntries.map((entry) => {
                    const workspaceId = entry.key.startsWith('workspace:') ? entry.key.slice('workspace:'.length) : '';
                    const workspace = workspaces.find((candidate) => candidate.workspaceId === workspaceId) || null;
                    const parent = workspace === null ? null : parentOfWorkspace(workspace);
                    const title = workspace === null ? entry.title : (workspace.title || workspace.path || entry.title);
                    const meta = parent === null
                      ? (workspace === null ? entry.key : workspace.path)
                      : `${tr('hiddenParent')}: ${parent.title || parent.path}`;
                    return h(
                      'div',
                      { key: entry.key, className: 'pst-presetRow' },
                      h(
                        'div',
                        { className: 'pst-presetText' },
                        h('div', { className: 'pst-presetName' }, title),
                        h('div', { className: 'pst-presetMeta' }, meta),
                      ),
                      h(
                        'div',
                        { className: 'pst-presetActions' },
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'pst-chipButton',
                            onClick: () => showHidden(entry),
                          },
                          tr('showWorkspace'),
                        ),
                      ),
                    );
                  }),
                ),
            ),
            h(
              'section',
              { className: 'pst-card' },
              h(
                'div',
                { className: 'pst-cardTop' },
                h(
                  'div',
                  { className: 'pst-cardText' },
                  h('div', { className: 'pst-title' }, tr('removedTitle')),
                  h('p', { className: 'pst-desc' }, tr('removedIntro')),
                ),
              ),
              removed.length === 0
                ? h('div', { className: 'pst-empty' }, tr('removedEmpty'))
                : h(
                  'div',
                  { className: 'pst-presetList' },
                  removed.map((entry) =>
                    h(
                      'div',
                      { key: entry.workspaceId, className: 'pst-presetRow' },
                      h(
                        'div',
                        { className: 'pst-presetText' },
                        h('div', { className: 'pst-presetName' }, entry.title),
                        h('div', { className: 'pst-presetMeta' }, entry.path),
                      ),
                      h(
                        'div',
                        { className: 'pst-presetActions' },
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'pst-chipButton',
                            disabled: restoreBusy !== '',
                            onClick: () => { restoreRemoved(entry).catch(() => {}); },
                          },
                          restoreBusy === entry.workspaceId ? tr('removedBusy') : tr('removedRestore'),
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'pst-chipButton',
                            onClick: () => forgetRemoved(entry),
                          },
                          tr('removedForget'),
                        ),
                      ),
                    )),
                ),
            ),
            h(
              'section',
              { className: 'pst-card' },
              h(
                'div',
                { className: 'pst-cardTop' },
                h(
                  'div',
                  { className: 'pst-cardText' },
                  h('div', { className: 'pst-title' }, tr('healthTitle')),
                  h('p', { className: 'pst-desc' }, tr('healthIntro')),
                ),
                h(
                  'div',
                  { className: 'pst-cardActions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'pst-btn pst-btnPrimary',
                      disabled: health.status === 'loading',
                      onClick: () => { runHealth().catch(() => {}); },
                    },
                    health.status === 'loading' ? tr('healthChecking') : tr('healthCheck'),
                  ),
                ),
              ),
              health.status === 'idle'
                ? null
                : health.status === 'error'
                  ? h('p', { className: 'pst-childError' }, `${tr('healthFailed')} ${health.error}`)
                  : h(
                    'div',
                    { className: 'pst-healthBody' },
                    h(
                      'p',
                      { className: 'pst-hint' },
                      `${tr('healthChecked').replace('{count}', String(health.data === null ? 0 : health.data.checked))} ${issues.length === 0 ? tr('healthNoIssues') : tr('healthIssues').replace('{count}', String(issues.length))}`,
                    ),
                    issues.length === 0
                      ? null
                      : h(
                        'div',
                        { className: 'pst-healthList' },
                        issues.map((issue, index) =>
                          h(
                            'div',
                            {
                              key: `${issue.code}:${issue.workspaceId}:${issue.path}:${index}`,
                              className: `pst-healthIssue pst-healthIssue-${issue.severity || 'info'}`,
                            },
                            h(
                              'div',
                              { className: 'pst-healthMain' },
                              h('div', { className: 'pst-healthTitle' }, issueLabel(issue.code)),
                              h('div', { className: 'pst-healthMeta' }, `${issue.title || issue.workspaceId} · ${issue.path}`),
                            ),
                            h(
                              'div',
                              { className: 'pst-healthActions' },
                              h('button', {
                                type: 'button',
                                className: 'pst-chipButton',
                                onClick: () => copyPath(issue),
                              }, tr('healthCopy')),
                              issue.workspaceId === ''
                                ? null
                                : h('button', {
                                  type: 'button',
                                  className: 'pst-chipButton',
                                  onClick: () => openIssue(issue),
                                }, tr('healthLocate')),
                            ),
                          )),
                      ),
                  ),
            ),
            h(
              'section',
              { className: 'pst-card' },
              h(
                'div',
                { className: 'pst-cardTop' },
                h(
                  'div',
                  { className: 'pst-cardText' },
                  h('div', { className: 'pst-title' }, tr('presetsTitle')),
                  h('p', { className: 'pst-desc' }, tr('presetsIntro')),
                ),
                h(
                  'div',
                  { className: 'pst-cardActions' },
                  h('button', {
                    type: 'button',
                    className: 'pst-chipButton',
                    onClick: () => {
                      writeHiddenWorkspaces([]);
                      writeCollapsedWorkspaces([]);
                      writeFocusWorkspace('');
                      setFocus('');
                      setNotice(tr('presetAllVisible'));
                    },
                  }, tr('presetAllVisible')),
                ),
              ),
              h(
                'div',
                { className: 'pst-presetForm' },
                h('input', {
                  className: 'pst-search pst-presetInput',
                  value: presetName,
                  placeholder: tr('presetNamePlaceholder'),
                  onChange: (event) => setPresetName(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      savePreset();
                    }
                  },
                }),
                h('button', {
                  type: 'button',
                  className: 'pst-btn',
                  disabled: presetName.trim() === '',
                  onClick: savePreset,
                }, tr('presetSave')),
              ),
              h('p', { className: 'pst-hint' }, tr('presetHint')),
              presets.length === 0
                ? h('div', { className: 'pst-empty' }, tr('presetEmpty'))
                : h(
                  'div',
                  { className: 'pst-presetList' },
                  presets.map((preset) =>
                    h(
                      'div',
                      { key: preset.id, className: 'pst-presetRow' },
                      h(
                        'div',
                        { className: 'pst-presetText' },
                        h('div', { className: 'pst-presetName' }, preset.name),
                        h(
                          'div',
                          { className: 'pst-presetMeta' },
                          `${tr('presetHiddenCount').replace('{count}', String(preset.hidden.length))} · ${tr('presetCollapsedCount').replace('{count}', String(preset.collapsed.length))}`,
                        ),
                      ),
                      h(
                        'div',
                        { className: 'pst-presetActions' },
                        h('button', {
                          type: 'button',
                          className: 'pst-chipButton',
                          onClick: () => applyPreset(preset),
                        }, tr('presetApply')),
                        h('button', {
                          type: 'button',
                          className: 'pst-chipButton',
                          onClick: () => deletePreset(preset),
                        }, tr('presetDelete')),
                      ),
                    )),
                ),
            ),
          );
        }

        function PluginTab(props) {
          return h(
            'div',
            { className: 'pst-tab' },
            h(
              'header',
              { className: 'pst-tabHead' },
              h('h3', { className: 'pst-tabTitle' }, tr('tabLabel')),
              h('p', { className: 'pst-tabIntro' }, tr('tabIntro')),
            ),
            h(PluginPicker, { mode: 'tab', openPackage: props.openPackage }),
          );
        }

        function DetailAction(props) {
          const [busy, setBusy] = React.useState(false);
          const subject = props.subject;
          const pkg = subject === null || subject === undefined ? undefined : subject.pkg;
          const official =
            (pkg !== undefined && pkg !== null && pkg.official === true)
            || (subject !== null && subject !== undefined && subject.official === true);
          if (official) return null;
          const label = busy ? tr('opening') : tr('action');
          return h(
            React.Fragment,
            null,
            h('style', null, CSS),
            h(
              'button',
              {
                type: 'button',
                className: 'pst-btn',
                title: tr('actionHint'),
                disabled: busy,
                onClick: (event) => {
                  if (busy) return;
                  setBusy(true);
                  Promise.resolve(openAdjust(props.subject, { forceNew: event.shiftKey }))
                    .catch((error) => console.error('plugin-studio: could not open adjustment conversation', error))
                    .finally(() => setBusy(false));
                },
              },
              h(ChatGlyph),
              label,
            ),
          );
        }

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'plugin-studio.observer',
              order: 41,
            },
            MainSessionObserver,
          ),
        );

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'plugin-studio.child-dialog',
              order: 42,
            },
            NewChildWorkspaceDialog,
          ),
        );

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'plugin-studio.workspaces-observer',
              order: 43,
            },
            WorkspaceObserver,
          ),
        );

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'plugin-studio.delete-dialog',
              order: 44,
            },
            DeleteWorkspaceFolderDialog,
          ),
        );

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'plugin-studio.quick-switcher',
              order: 45,
            },
            QuickSwitcher,
          ),
        );

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'plugin-studio.onboarding',
              order: 46,
            },
            CoachTour,
          ),
        );

        ctx.slots.inject('plugins.tab', () =>
          ctx.slots.register(
            {
              name: 'plugins.tab',
              id: 'plugin-studio.workspaces',
              order: 20,
              label: () => tr('workspaceTabLabel'),
            },
            WorkspaceStudioTab,
          ),
        );

        ctx.slots.inject('plugins.tab', () =>
          ctx.slots.register(
            {
              name: 'plugins.tab',
              id: 'plugin-studio',
              order: 21,
              label: () => tr('tabLabel'),
            },
            PluginTab,
          ),
        );

        ctx.slots.inject('plugins.detail.actions', () =>
          ctx.slots.register(
            {
              name: 'plugins.detail.actions',
              id: 'plugin-studio',
              order: 12,
            },
            DetailAction,
          ),
        );
      },
    };
  },
});
