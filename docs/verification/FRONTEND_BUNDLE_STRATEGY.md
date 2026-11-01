# Frontend bundle strategy

The application keeps the initial route lightweight by loading the larger workbench panels only when they are rendered:

- Entry details, new-entry proposals, submissions, moderation, and export panels are lazy-loaded.
- The methodology section and authentication dialog are loaded on demand.
- Vite separates React, Supabase, charting, and schema-validation dependencies into independent vendor chunks.
- The build keeps Vite's default chunk-size warning enabled; the warning is not suppressed by raising the threshold.

Bundle sizes are checked from the production build in GitHub Actions. Image assets are tracked separately from JavaScript chunks and should be optimized independently if their transfer cost becomes significant.
