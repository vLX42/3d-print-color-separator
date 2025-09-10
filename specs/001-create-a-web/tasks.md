# Tasks: Web App for PNG Color Separation and SVG Conversion

**Input**: Design documents from `/specs/001-create-a-web/`
**Prerequisites**: plan.md (required)

## Execution Flow (main)
```
1. Load plan.md from feature directory
2. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: integration tests for user stories
   → Core: models, services, UI components
   → Polish: unit tests, performance, docs
3. Number tasks sequentially (T001, T002...)
4. Create parallel execution examples
5. Validate task completeness
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup
- [ ] T001 Create Next.js 15 project in `web/` with TypeScript
- [ ] T002 Install dependencies: `tailwindcss`, `shadcn/ui`, `@zhuowenli/image-trace`, `color-thief`, `jest`, `react-testing-library` in `web/`
- [ ] T003 [P] Configure linting and formatting tools in `web/`

## Phase 3.2: Tests First (TDD)
- [ ] T004 [P] Integration test: PNG upload and color selection in `web/tests/integration/upload.test.ts`
- [ ] T005 [P] Integration test: color quantization and separation in `web/tests/integration/quantize.test.ts`
- [ ] T006 [P] Integration test: image-to-SVG conversion in `web/tests/integration/svg.test.ts`
- [ ] T007 [P] Integration test: joined SVG download in `web/tests/integration/download.test.ts`

## Phase 3.3: Core Implementation
- [ ] T008 [P] Implement PNG upload UI in `web/src/components/Upload.tsx`
- [ ] T009 [P] Implement color selection UI in `web/src/components/ColorSelector.tsx`
- [ ] T010 [P] Implement color quantization logic in `web/src/lib/quantize.ts`
- [ ] T011 [P] Implement PNG separation logic in `web/src/lib/separateColors.ts`
- [ ] T012 [P] Implement image-to-SVG conversion logic in `web/src/lib/imageToSvg.ts`
- [ ] T013 [P] Implement joined SVG creation logic in `web/src/lib/joinSvg.ts`
- [ ] T014 [P] Implement download buttons for each step in `web/src/components/DownloadButtons.tsx`
- [ ] T015 [P] Implement process bar UI in `web/src/components/ProcessBar.tsx`
- [ ] T016 [P] Implement debug mode toggle in `web/src/components/DebugToggle.tsx`
- [ ] T017 [P] Integrate Tailwind and shadcn UI in `web/src/pages/_app.tsx`
- [ ] T018 [P] Ensure Vercel deployment readiness in `web/vercel.json`

## Phase 3.4: Polish
- [ ] T019 [P] Unit tests for color quantization in `web/tests/unit/quantize.test.ts`
- [ ] T020 [P] Unit tests for image-to-SVG conversion in `web/tests/unit/imageToSvg.test.ts`
- [ ] T021 [P] Performance tests for PNG processing in `web/tests/unit/performance.test.ts`
- [ ] T022 [P] Update documentation in `web/README.md`

## Dependencies
- Setup (T001-T003) before everything
- Tests (T004-T007) before implementation (T008-T018)
- Core implementation tasks (T008-T018) can run in parallel
- Polish tasks (T019-T022) after implementation

## Parallel Example
```
# Launch T004-T007 together:
Task: "Integration test: PNG upload and color selection in web/tests/integration/upload.test.ts"
Task: "Integration test: color quantization and separation in web/tests/integration/quantize.test.ts"
Task: "Integration test: image-to-SVG conversion in web/tests/integration/svg.test.ts"
Task: "Integration test: joined SVG download in web/tests/integration/download.test.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task
- Avoid: vague tasks, same file conflicts
