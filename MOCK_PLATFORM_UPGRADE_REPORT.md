# LGW MeritX mock-platform upgrade report

Date: 22 October 2026

## Delivered

- Versioned, database-backed patterns for JEE Main 2026, JEE Advanced 2026, MHT-CET PCM 2026, and NEET UG 2026.
- Immutable configuration snapshots on publication and lock protection after attempts exist.
- Configurable course catalog and landing-page content with admin create/edit/publish/archive controls.
- Explicit compatible-practice and strict-standard workbook modes.
- Extended question schema for single-correct, multiple-correct, numerical, matching-list, linked-numerical, paper/section numbers, precision, and stem IDs.
- Maker-checker question-bank workflow with review, rejection reason, resubmission, approval, audit events, and publication configuration.
- Candidate instruction acceptance before the timer starts, server deadline, autosave, resume, final submission, and detailed result review.
- Pattern-aware scoring including negative marking, JEE Advanced subset partial marks, numerical tolerance, and MHT-CET Mathematics weighting.
- MHT-CET Physics/Chemistry then Mathematics segment enforcement on both the client and server.
- Free registration and an explicit secure failure for paid exams until a server-verified payment provider is configured.

## Supplied workbook verification

| Workbook | Rows | Answers mapped | Compatible result | Strict-standard result |
|---|---:|---:|---|---|
| JEE Advanced | 102 | 102 | Preserves all 102 with limitations | Blocked: five repeated texts plus missing genuine numerical, matching-list, linked-stem, and paper metadata |
| JEE Main | 75 | 75 | Preserves all 75 | Blocked at publication: all 75 source rows are single-correct; five native numerical records per subject are absent |
| MHT-CET PCM | 150 | 150 | Preserves all 150 | Pattern-compatible: 50 Physics, 50 Chemistry, 50 Mathematics; single-correct format |
| NEET UG | 180 | 180 | Preserves all 180 | Pattern-compatible: 45 Physics, 45 Chemistry, 90 Biology; single-correct format |

The importer never relabels legacy option-based questions as native numerical or matching-list records. Compatible papers carry a visible practice label and use their actual question count and attainable maximum marks.

## Verification results

- PostgreSQL migration `004_mock_platform.sql`: applied successfully to the configured database.
- Backend tests: 23/23 passed.
- Frontend production build: passed; 1,625 modules transformed.
- Live authenticated workflow on isolated port 5001: imported 30, submitted 30, approved 30, published 30, displayed 30, saved and submitted successfully; result 22 correct, 6 incorrect, 2 unanswered, 73.33% accuracy.
- Pre-submission student API response contains no correct options, numerical answers, explanations, or matching answer data.

## Production boundaries

- No payment gateway credentials or webhook contract were supplied. Paid registration is deliberately disabled instead of simulating payment success.
- OCR for image-only PDFs and binary embedded-image extraction are not bundled. Searchable PDFs and HTTPS image columns remain supported.
- No reference screenshots were attached with the request, so the existing MeritX visual language was retained and extended.
- The four supplied Excel files are source fixtures and were not modified.

## Standards references used

- JEE Advanced 2026 information brochure and official sample papers: <https://jeeadv.ac.in/>
- JEE Main information bulletins: <https://jeemain.nta.nic.in/information-bulletin/>
- MHT-CET 2026 information brochure: <https://cetcell.mahacet.org/>
- NEET UG information bulletin: <https://neet.nta.nic.in/document/information-bulletin-english/>
