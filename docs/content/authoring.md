# Level authoring

The internal editor is available from the local Vite server at `/tools/level-editor/`. It is a standalone development page and is not linked from the player menu or compiled into the production entry.

## Four approval stages

1. **Design:** choose a mechanic and target count from the campaign block brief; sketch the floor silhouette and route before assigning directions.
2. **Solution:** edit cells, redirect arrows, tile stacks, launch arrows, and camera preset. Use **Test / solve** to replay the saved route with the game simulator and run bounded shortest-path search. Record `parMoves` as an estimate; the solver path is reported separately.
3. **Readability:** play the level by hand at reference size and a narrow touch viewport. Confirm the board fits, arrows can be identified, route turns are legible, Undo works, and no dead cell looks like a route instruction. Add the actual device/browser and evidence to `docs/content/level-reviews.md`.
4. **Release inclusion:** assign the next `level-NNN` id, export schema-version 1 JSON to `public/content/levels/NNN.json`, append its ordered path and SHA-256 to `public/content/catalog.json`, then run `pnpm validate:levels` and `pnpm check:full`. Keep the content version stable only for an additive change that does not alter the meaning of existing saves; schema or attempt compatibility changes require the save-migration task.

The editor can paint normal/redirect cells and stacks on the shared projected board, assign or rotate one of eight directions, erase objects, Undo editor actions, import/export JSON, save a board screenshot, and test the shared known solution. Invalid import leaves the current draft untouched. The tool does not publish levels or silently add drafts to the campaign.

## Release validator

`pnpm validate:levels` checks sequential IDs and file paths, extra/missing files, SHA-256, level schema and tile totals, known-solution replay, convergence to one stack, bounded solvability search, and initial launches that loop without reaching an edge. A shortest-search timeout does not invalidate a verified known solution, and `parMoves` is never silently relabeled as an optimal value. The check runs automatically in `pnpm check:full` and the CI workflow. The check receipt was versioned when the new gate was introduced.

Keep references, draft files, screenshots used only during authoring, and editor code outside `public/content/` and the release entry. Review each level for its own readability and difficulty; a valid checksum is not a design approval.
