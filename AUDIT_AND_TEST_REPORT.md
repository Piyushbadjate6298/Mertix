# LGW MERITX question-paper workflow audit and test report

Date: 21 October 2026

## Original implementation audit

The repository is a React 19/Vite frontend with an Express 5 API and PostgreSQL. JWT authentication and role checks already existed, as did student registrations, timed attempts, autosave, a small static exam catalogue, and a basic paper-approval screen.

The uncommitted question-bank work present at the start could parse basic XLS/XLSX and searchable PDFs, but it had these material gaps:

- no CSV import;
- only one correct option could be stored or evaluated;
- the subject was limited to four hard-coded values;
- approval attached content to a static catalogue item and had no separate publish operation;
- no reject-with-reason/resubmit lifecycle;
- accuracy used attempted questions as the denominator instead of all questions;
- imported examinations were not first-class persisted catalogue records;
- student history did not provide a complete persisted answer review;
- UI still displayed `+4 / -1` although this importer must be count/accuracy based;
- student and admin interfaces did not support multiple-correct selection and review;
- scanned-PDF OCR and embedded image extraction were not implemented.

## Implemented workflow

- Case-insensitive Excel/CSV aliases, arbitrary column order, empty-row skipping, duplicate ID/content detection, single- and multiple-correct normalization, custom subjects, and exactly preserved row counts.
- Searchable-PDF extraction with missing-answer validation. Missing answers are never guessed.
- Draft, submitted, approved, published, and rejected/resubmitted states, with rejection reasons and an event audit table.
- Independent admin preview, approval, rejection, and atomic publication.
- Persisted `published_exams` records generated directly from approved banks; no re-entry of questions is required.
- Immutable question snapshots on student attempts, server-side autosave, exact-set multiple-correct grading, overall and subject-wise counts/accuracy, and post-submission detailed review.
- Student question APIs omit correct answers and explanations before submission.
- KaTeX-compatible TeX rendering through the existing Temml renderer plus question and option image URL rendering.

## Database changes

`backend/migrations/003_examination_workflow.sql` adds lifecycle metadata, multi-answer fields, option-image metadata, custom subjects, published examinations, and question-bank audit events. It also changes imported-attempt score defaults to zero because this workflow reports counts and accuracy rather than positive/negative marks.

The migration was applied successfully to the configured PostgreSQL database on 21 October 2026.

## Automated verification

`npm.cmd test` in `backend`: **16/16 passed**.

Coverage includes validation, CORS, safe database failures, rate limiting, Excel, CSV aliases, searchable PDF extraction, missing-answer protection, signature rejection, exact 30-question preservation, and exact-set multiple-correct evaluation.

`npm.cmd run build` in `frontend`: **passed** (1,626 modules transformed).

## Live authenticated API test

`node tests/e2e-live.mjs` was run against the current backend on isolated port 5001 and the configured PostgreSQL database.

| Stage | Actual result |
|---|---:|
| Excel questions imported | 30 |
| Questions submitted | 30 |
| Questions approved | 30 |
| Questions published | 30 |
| Questions returned to student | 30 |
| Correct | 22 |
| Wrong | 6 |
| Unanswered | 2 |
| Accuracy across all questions | 73.33% |

The student response contained no answer keys or explanations before submission. Subject totals were Physics 10, Chemistry 10, and Mathematics 10. The saved final result reported Physics 80%, Chemistry 70%, and Mathematics 70%.

Created live verification records:

- bank: `bank-fadcb2a0-e58`
- published exam: `exam-dd5639a0-11e`
- attempt: `attempt-96d5d164-5a1`

An earlier draft-only live record was created while detecting a stale-server test condition; it was not submitted, approved, or published.

## Development credentials

These accounts are seeded only when `SEED_DEMO_USERS=true`:

- Teacher: `teacher@meritx.demo` / `Teacher@123`
- Admin: `admin@meritx.demo` / `Admin@123`
- Student: `student@meritx.demo` / `Student@123`
- Super Admin: `superadmin@meritx.demo` / `Super@123`

## Remaining genuine limitations

- OCR for scanned/image-only PDFs is not bundled. Such files are detected and blocked with an actionable warning; convert them to searchable PDFs or add an OCR provider before production use.
- Arbitrary PDF layout reconstruction is not guaranteed. Searchable PDFs should use numbered questions, labelled options, and answer lines. Complex multi-column layouts require a layout-aware extraction/OCR service.
- Binary embedded-image extraction from Excel/PDF is not implemented. HTTPS question/option image columns are preserved and rendered, but embedded drawing anchors and PDF raster association require dedicated media storage and document-layout processing.
- Mathematical text and `$...$`/`$$...$$` TeX render correctly; equation images embedded in unsupported document structures remain subject to the image limitation above.
- The repository did not include the user's original 30-question workbook or a representative diagram PDF. The 30-question live test generated the documented JEE-style schema, so the exact external files still need a final acceptance upload.
- Automated interruption/oversize tests cover validation paths, but a real browser-level network drop and server-restart persistence test were not executed in this session.
