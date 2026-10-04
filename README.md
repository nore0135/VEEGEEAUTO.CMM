# CMM Work Control

A professional CMM work portal for **YTA, YTB, YED, AXLE, YY8, BOP, CCB, and YMC**.

The front end is ready for GitHub Pages. Google Apps Script provides the backend; Google Drive holds private PDFs, and a Google Sheet holds the work records. No paid framework, database subscription, or email provider is required for this starter. Hosting, storage, email, and execution remain subject to provider quotas and company policy.

**Current delivery status:** the source and sample workspace are built. A company Google deployment is required before real sign-in, shared records, PDF uploads/downloads, and scheduled email work. No real company records or credentials are included. A blank `config.js` opens a clearly labeled, temporary sample workspace.

## What is included

- Live workload totals from saved inspection requests, line filters, and search.
- Requests with part name, drawing/part number, line, quantity, priority, due date, and inspection instructions.
- Requested → Planned → In progress → Completed, plus On hold. Administrators set the actual workflow status.
- An inspection PDF must be attached before a part can be completed.
- Daily and monthly work views, with separate plan PDF attachments.
- Private PDFs in the owner's configured Google Drive folder; viewers download through the authenticated backend, with no public Drive sharing required.
- Exactly one owner and up to three additional administrators. Up to 50 approved viewers in this starter.
- Passwordless email-code sign-in. Viewers can create inspection requests and read/download; admins additionally plan, upload, and manage the roster; only the owner manages access and storage.
- Sunday-to-Saturday roster entry, holidays, configurable shift times, and overnight-shift calculations in IST.
- Daily overdue email digest between approximately 08:00 and 09:00 IST, once enabled in Settings. Includes planned/in-progress/on-hold work due before today; completed work and unplanned requests are excluded.
- Change the Drive folder for future uploads without losing existing file references.
- Owner handover and session revocation on transfer.

## Start with the company Google account

Use a company-controlled Google account to create and deploy the backend. This account owns the files and runs the service even when other users sign in. Your CMM owner email can be a different approved email address.

1. In Google Drive, create a **restricted** folder called `CMM Inspection Reports`. Do not enable “Anyone with the link.” Ensure its inherited permissions are suitable for your company documents.
2. Copy the folder ID from its URL: `https://drive.google.com/drive/folders/FOLDER_ID`.
3. Go to [Google Apps Script](https://script.google.com/) and create a standalone project named `CMM Work Control`.
4. Replace `Code.gs` with `Code.gs` from this package.
5. In **Project Settings**, enable **Show appsscript.json manifest file in editor**. Replace that manifest with `appsscript.json`.
6. In **Project Settings → Script properties**, add the values below. Do not put them in the GitHub repository.

| Property | Required value |
| --- | --- |
| `OWNER_EMAIL` | Your email address, which becomes portal owner |
| `DRIVE_FOLDER_ID` | The ID of the private report folder |
| `ADMIN_EMAILS` | Optional: up to three administrator emails, comma-separated |
| `VIEWER_EMAILS` | Optional: approved viewer emails, comma-separated |
| `ALERT_EMAIL` | Optional: the exact company inbox for overdue reminders |

7. Run **setup** once from the Apps Script editor, and review/authorize the Google permissions. It creates the work-record spreadsheet and a private session-signing secret. The database URL appears in the execution log. Keep this spreadsheet private as well.
8. Deploy → **New deployment** → **Web app**. Choose **Execute as: Me** (the company account), **Who has access: Anyone**. The web endpoint is public but every data operation requires a verified portal session; anonymous requests cannot retrieve records or files. If your company prohibits this deployment mode, stop and ask IT for an approved hosting/authentication arrangement—do not weaken the code's permission checks.
9. Copy the deployment URL ending in `/exec` into `config.js` as `apiUrl`. This URL is public configuration, not a password. Never place session secrets, email lists, or document data in the front end.
10. After publishing the front end, sign in with `OWNER_EMAIL`. The code is delivered to that mailbox. Add approved administrators and viewers in Settings, check the Drive folder and shift times, set the exact reminder inbox, and enable reminders only when ready.

### GitHub Pages deployment

This repository uses branch-based GitHub Pages: **main / (root)**. The public front end is the HTML, CSS, and JavaScript in this directory. `Code.gs` and `appsscript.json` are the Google backend source; they do not execute on GitHub Pages. The bundled `CMM-Work-Control.zip` contains the original organized source, automated tests, and an offline preview.

Set the deployed Google Apps Script `/exec` URL in `config.js` and commit it to connect the website. Never commit private records, approved email lists, session secrets, or credentials. A blank API URL intentionally shows sample data.

GitHub Free requires a public repository for Pages. Company data stays in the private Google backend; the HTML and source code are public.

## First-day checklist

- Sign in as the owner, one admin, and one viewer using the actual approved mailboxes.
- Viewer submits one test request for a non-confidential sample part.
- Admin plans it, assigns an engineer and due date, and marks it in progress.
- Admin uploads a small test PDF. Viewer opens and downloads it.
- Confirm that completion before PDF upload is rejected and completion after upload succeeds.
- Verify the file is in the intended restricted Drive folder and the record is in the database sheet.
- Publish the roster for the coming Sunday–Saturday, including holidays. Confirm a night shift across midnight.
- Enable reminders with the approved destination inbox. Check that the trigger appears in Apps Script → Triggers. A scheduled trigger runs approximately during the selected hour, not precisely at 08:00.
- Test an overdue planned record. Verify the email after the scheduled run; avoid manually running `sendOverdueDigest` unless you intend to send a real message.
- Remove the test data from the private database/Drive only when finished testing. Never upload real inspection records into demo mode.

## Operational details and limits

- **10 MB per PDF**. Uploads/downloads pass through Apps Script as base64. This starter suits a small internal CMM team; larger reports or high traffic need a stronger backend or a signed-download design.
- Email-code sign-in and reminders share the Google sender's daily email quota. The code reserves quota for operational mail, limits login requests globally to 80/day and per approved email to 8/day, requires at least 60 seconds between sends, and locks a code after five incorrect guesses. The code expires after 10 minutes; sessions expire after six hours.
- Session tokens are kept in page memory. Refreshing the browser requires signing in again. Signing out clears the local token. Removing a viewer takes effect on the next request; ownership transfer invalidates all issued tokens.
- No passwords or session tokens are committed to GitHub. Do not add company data to demo fixtures.
- The owner is included in the four-admin total. Only the owner can change the allowlist, reminder inbox, storage folder, or ownership. Access is checked server-side on every request.
- Records are JSON rows in a private spreadsheet. Do not reorder or edit its two-column schema. Make periodic company-controlled backups of both the spreadsheet and Drive folder. No destructive delete UI is included.
- New requests and file uploads carry stable IDs to reduce duplicate writes when retried. Job updates use version checks to prevent two administrators silently overwriting each other.
- Plan PDFs are **not automatically parsed**. Create a request for each part and mark it Planned with a date so it appears in workload counts and reminders.
- “On shift now” means **scheduled**, not clocked in. Today’s Holiday entry overrides availability, including a shift carried over from yesterday. Night shifts use the date they start.
- A folder change affects only future uploads. Existing documents remain in their original folders, which must stay accessible to the backend owner. Physical migration is a separate operation.
- Scheduled email delivery depends on Google quotas and trigger execution. There is no guaranteed delivery SLA, retry queue, or live attendance system.
- If a save reports a connection problem, refresh the record list to see whether it succeeded before resubmitting. Authentication, Drive permissions, email deliverability, cross-origin requests, and the trigger must be verified against the real deployment before using this for company operations.

## Company handover

Read [HANDOVER.md](HANDOVER.md) before changing employees or storage accounts. A portal role transfer alone does not change the account running Apps Script or the owner of Drive files.

## Local preview and checks

Open `index.html` to explore sample data, or run a static server:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. No npm install or build is required.

```sh
node --check app.js
node tests/backend.test.cjs # from the extracted source package
```

The backend tests use mocked Google services. They verify authorization, report-before-completion, concurrency, input validation, login/session rules, and ownership/storage behavior. They do not prove the live Google deployment or scheduled delivery.

## Official service references

- [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Apps Script web apps](https://developers.google.com/apps-script/guides/web)
- [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
- [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app)
- [Time-based triggers](https://developers.google.com/apps-script/reference/script/clock-trigger-builder)

Reviewed 3 October 2026. Provider limits can change. A custom domain, extra Google storage, or paid organization features can introduce costs.
