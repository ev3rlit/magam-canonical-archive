# Debug Session: Phase 01 New Document Create Fails with ENOENT

## Symptom

On a newly created draft document, creating the first shape fails with:

`ENOENT: no such file or directory, open '/Users/danghamo/Documents/gituhb/magam-feature-database-first-canvas-platform/examples/untitled-2.graph.tsx'`

## Root Cause

The "new document" flow is client-only. `WorkspaceClient` registers a draft path, opens a tab, and seeds `draft:empty-canvas` into the store, but it never creates the backing `.graph.tsx` file. The first `node.create` mutation still goes through the normal WS patch path, which resolves relative paths under `MAGAM_TARGET_DIR` and immediately reads the target file for `ensureBaseVersion` and `patchNodeCreate`. Because the file does not exist yet, the mutation fails with `ENOENT`.

## Evidence

- `app/components/editor/WorkspaceClient.tsx`
  - `handleCreateDraftDocument()` only calls `registerDraftDocument()` and `openTabByPath()`.
  - `renderFile()` special-cases `draftDocuments` by seeding `sourceVersions[currentFile] = 'draft:empty-canvas'` without writing a file.
- `app/hooks/useFileSync.ts`
  - `withCommon()` treats the draft sourceVersion as valid and sends the relative `filePath` to RPC methods.
- `app/ws/methods.ts`
  - `resolveWorkspaceFilePath()` resolves relative paths under `MAGAM_TARGET_DIR`.
  - `mutateWithContract()` calls `ensureBaseVersion()` before patching, which reads the file from disk.

## Suggested Fix Direction

- Materialize a new draft document into a real `.graph.tsx` file before the first mutation, or introduce an explicit create-document RPC that creates the file atomically and returns a real sourceVersion.
- Cover the exact flow: new document -> first canvas shape creation.
