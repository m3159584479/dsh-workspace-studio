/**
 * Host half of the Plugin Studio bundle.
 *
 * The Client half renders the workspace menu additions and the dialogs. This
 * half owns the two filesystem operations that the shipped directory picker
 * cannot serve when the composed picker is the native one:
 *
 *   POST /plugin-studio/create-child  { parentPath, name }
 *   POST /plugin-studio/delete-child  { path, confirm }
 *
 * Both routes validate against the durable workspace registry: create only
 * accepts a registered parent and a direct child name; delete only accepts a
 * registered workspace that is itself inside another registered workspace,
 * has no registered child workspaces, is a real directory (not a symlink), and
 * arrives with an explicit confirmation.
 */
import { lstat, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

export const inject = ['webServer', 'workspaceRegistry'];

const ROUTE_CREATE = '/plugin-studio/create-child';
const ROUTE_DELETE = '/plugin-studio/delete-child';
const ROUTE_HEALTH = '/plugin-studio/health';
const ROUTE_RESTORE = '/plugin-studio/restore-workspace';
const MAX_BODY_BYTES = 16 * 1024;

function pathKey(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
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

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body is too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.trim() === '') return {};
  const value = JSON.parse(text);
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sendJson(res, status, payload) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

function guardRequest(ctx, req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, code: 'method', message: 'POST required' });
    return false;
  }
  if (req.headers['x-plugin-studio'] !== '1') {
    sendJson(res, 403, { ok: false, code: 'forbidden', message: 'Missing plugin-studio request header' });
    return false;
  }
  return true;
}

function workspaceByPath(ctx, value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  let wanted;
  try {
    wanted = pathKey(value);
  } catch (_) {
    return null;
  }
  for (const workspace of ctx.workspaceRegistry.list()) {
    if (pathKey(workspace.path) === wanted) return workspace;
  }
  return null;
}

function parentWorkspace(ctx, workspace) {
  const byPath = new Map(ctx.workspaceRegistry.list().map((candidate) => [pathKey(candidate.path), candidate]));
  let current = path.dirname(workspace.path);
  while (current !== path.dirname(current)) {
    const found = byPath.get(pathKey(current));
    if (found !== undefined && found.id !== workspace.id) return found;
    current = path.dirname(current);
  }
  return null;
}

function hasChildWorkspace(ctx, workspace) {
  return ctx.workspaceRegistry.list().some((candidate) => {
    if (candidate.id === workspace.id) return false;
    const relative = path.relative(workspace.path, candidate.path);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  });
}

async function createChild(ctx, req, res) {
  if (!guardRequest(ctx, req, res)) return;
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    sendJson(res, error.status === 413 ? 413 : 400, { ok: false, code: 'bad-request', message: error.message });
    return;
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!validFolderName(name)) {
    sendJson(res, 400, { ok: false, code: 'invalid-name', message: 'Invalid folder name' });
    return;
  }
  const parent = workspaceByPath(ctx, body.parentPath);
  if (parent === null) {
    sendJson(res, 403, { ok: false, code: 'unknown-parent', message: 'The parent path is not a registered workspace' });
    return;
  }
  const target = path.resolve(parent.path, name);
  if (path.dirname(target) !== path.resolve(parent.path)) {
    sendJson(res, 400, { ok: false, code: 'invalid-name', message: 'The child must be a direct folder of the parent' });
    return;
  }
  const existing = await stat(target).catch(() => undefined);
  if (existing !== undefined) {
    sendJson(res, 409, { ok: false, code: 'exists', message: 'A file or folder already exists at this path' });
    return;
  }
  try {
    await mkdir(target);
  } catch (error) {
    sendJson(res, 500, { ok: false, code: 'mkdir-failed', message: error instanceof Error ? error.message : String(error) });
    return;
  }
  try {
    const workspace = await ctx.workspaceRegistry.create(target);
    sendJson(res, 200, {
      ok: true,
      path: workspace.path,
      workspaceId: workspace.id,
      title: workspace.title,
    });
  } catch (error) {
    await rm(target, { recursive: true, force: true }).catch(() => {});
    sendJson(res, 500, { ok: false, code: 'register-failed', message: error instanceof Error ? error.message : String(error) });
  }
}

async function deleteChild(ctx, req, res) {
  if (!guardRequest(ctx, req, res)) return;
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    sendJson(res, error.status === 413 ? 413 : 400, { ok: false, code: 'bad-request', message: error.message });
    return;
  }
  if (body.confirm !== true) {
    sendJson(res, 400, { ok: false, code: 'confirm-required', message: 'Explicit confirmation is required' });
    return;
  }
  const workspace = workspaceByPath(ctx, body.path);
  if (workspace === null) {
    sendJson(res, 403, { ok: false, code: 'unknown-workspace', message: 'The path is not a registered workspace' });
    return;
  }
  if (parentWorkspace(ctx, workspace) === null) {
    sendJson(res, 403, { ok: false, code: 'not-a-child', message: 'Only a workspace inside another workspace can be deleted this way' });
    return;
  }
  if (hasChildWorkspace(ctx, workspace)) {
    sendJson(res, 409, { ok: false, code: 'has-children', message: 'This workspace contains other registered workspaces; remove them first' });
    return;
  }
  const info = await lstat(workspace.path).catch(() => undefined);
  if (info === undefined || !info.isDirectory() || info.isSymbolicLink()) {
    sendJson(res, 409, { ok: false, code: 'not-directory', message: 'The workspace path is not a regular directory' });
    return;
  }
  try {
    await rm(workspace.path, { recursive: true, force: false });
  } catch (error) {
    sendJson(res, 500, { ok: false, code: 'rm-failed', message: error instanceof Error ? error.message : String(error) });
    return;
  }
  let recordDeleted = false;
  try {
    recordDeleted = await ctx.workspaceRegistry.delete(workspace.id);
  } catch (_) {
    // The folder is gone; the Client can still remove a stale registration with
    // the shipped "Delete workspace" action if this write failed.
  }
  sendJson(res, 200, { ok: true, path: workspace.path, workspaceId: workspace.id, recordDeleted });
}

async function healthCheck(ctx, req, res) {
  if (!guardRequest(ctx, req, res)) return;
  const workspaces = ctx.workspaceRegistry.list();
  const issues = [];
  const byPath = new Map();
  for (const workspace of workspaces) {
    let key;
    try {
      key = pathKey(workspace.path);
    } catch (_) {
      issues.push({
        code: 'invalid-path',
        severity: 'error',
        workspaceId: workspace.id,
        title: workspace.title,
        path: String(workspace.path),
        message: 'The workspace path cannot be resolved',
      });
      continue;
    }
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key).push(workspace);
  }
  for (const [key, entries] of byPath) {
    if (entries.length < 2) continue;
    for (const workspace of entries) {
      issues.push({
        code: 'duplicate',
        severity: 'warning',
        workspaceId: workspace.id,
        title: workspace.title,
        path: workspace.path,
        message: `Another workspace registration resolves to the same path (${key})`,
      });
    }
  }
  for (const workspace of workspaces) {
    const info = await lstat(workspace.path).catch(() => undefined);
    if (info === undefined) {
      issues.push({
        code: 'missing',
        severity: 'error',
        workspaceId: workspace.id,
        title: workspace.title,
        path: workspace.path,
        message: 'The registered folder does not exist',
      });
      continue;
    }
    if (info.isSymbolicLink()) {
      issues.push({
        code: 'symlink',
        severity: 'warning',
        workspaceId: workspace.id,
        title: workspace.title,
        path: workspace.path,
        message: 'The workspace is a symbolic link',
      });
    } else if (!info.isDirectory()) {
      issues.push({
        code: 'not-directory',
        severity: 'error',
        workspaceId: workspace.id,
        title: workspace.title,
        path: workspace.path,
        message: 'The registered path is not a directory',
      });
    }
    if (Array.isArray(workspace.sessionIds) && workspace.sessionIds.length === 0) {
      issues.push({
        code: 'empty',
        severity: 'info',
        workspaceId: workspace.id,
        title: workspace.title,
        path: workspace.path,
        message: 'The workspace has no sessions',
      });
    }
    let depth = 0;
    let parent = parentWorkspace(ctx, workspace);
    while (parent !== null) {
      depth += 1;
      parent = parentWorkspace(ctx, parent);
    }
    if (depth > 3) {
      issues.push({
        code: 'deep',
        severity: 'warning',
        workspaceId: workspace.id,
        title: workspace.title,
        path: workspace.path,
        message: `The workspace is nested ${depth} levels deep`,
      });
    }
  }
  issues.sort((a, b) => {
    const rank = { error: 0, warning: 1, info: 2 };
    return (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3);
  });
  sendJson(res, 200, {
    ok: true,
    checked: workspaces.length,
    issues,
    generatedAt: new Date().toISOString(),
  });
}

async function restoreWorkspace(ctx, req, res) {
  if (!guardRequest(ctx, req, res)) return;
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    sendJson(res, error.status === 413 ? 413 : 400, { ok: false, code: 'bad-request', message: error.message });
    return;
  }
  if (typeof body.path !== 'string' || body.path.trim() === '') {
    sendJson(res, 400, { ok: false, code: 'invalid-path', message: 'A directory path is required' });
    return;
  }
  let target;
  try {
    target = path.resolve(body.path.trim());
  } catch (error) {
    sendJson(res, 400, { ok: false, code: 'invalid-path', message: error instanceof Error ? error.message : String(error) });
    return;
  }
  const existing = workspaceByPath(ctx, target);
  if (existing !== null) {
    sendJson(res, 200, {
      ok: true,
      existing: true,
      path: existing.path,
      workspaceId: existing.id,
      title: existing.title,
    });
    return;
  }
  const info = await stat(target).catch(() => undefined);
  if (info === undefined) {
    sendJson(res, 404, { ok: false, code: 'missing', message: 'The folder no longer exists' });
    return;
  }
  if (!info.isDirectory()) {
    sendJson(res, 409, { ok: false, code: 'not-directory', message: 'The path is not a directory' });
    return;
  }
  try {
    const title = typeof body.title === 'string' && body.title.trim() !== ''
      ? body.title.trim().slice(0, 120)
      : undefined;
    const workspace = await ctx.workspaceRegistry.create(target, title);
    sendJson(res, 200, {
      ok: true,
      existing: false,
      path: workspace.path,
      workspaceId: workspace.id,
      title: workspace.title,
    });
  } catch (error) {
    sendJson(res, 500, { ok: false, code: 'register-failed', message: error instanceof Error ? error.message : String(error) });
  }
}

export function apply(ctx) {
  const createHandler = (req, res) => {
    createChild(ctx, req, res).catch((error) => {
      sendJson(res, 500, { ok: false, code: 'internal', message: error instanceof Error ? error.message : String(error) });
    });
  };
  const deleteHandler = (req, res) => {
    deleteChild(ctx, req, res).catch((error) => {
      sendJson(res, 500, { ok: false, code: 'internal', message: error instanceof Error ? error.message : String(error) });
    });
  };
  const healthHandler = (req, res) => {
    healthCheck(ctx, req, res).catch((error) => {
      sendJson(res, 500, { ok: false, code: 'internal', message: error instanceof Error ? error.message : String(error) });
    });
  };
  const restoreHandler = (req, res) => {
    restoreWorkspace(ctx, req, res).catch((error) => {
      sendJson(res, 500, { ok: false, code: 'internal', message: error instanceof Error ? error.message : String(error) });
    });
  };
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: ROUTE_CREATE, handler: createHandler }), 'plugin-studio: create child route');
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: ROUTE_DELETE, handler: deleteHandler }), 'plugin-studio: delete child route');
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: ROUTE_HEALTH, handler: healthHandler }), 'plugin-studio: health route');
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: ROUTE_RESTORE, handler: restoreHandler }), 'plugin-studio: restore workspace route');
}
