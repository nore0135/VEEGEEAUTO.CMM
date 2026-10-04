# Company handover and storage changes

Keep the backend and repository in company-controlled accounts from the beginning. This avoids tying daily CMM operations to a departing employee's personal account.

## Changing the upload folder

1. The company Google account running Apps Script must have write access to the new private folder.
2. The portal owner changes the folder ID in Settings and saves it.
3. Upload one test PDF and confirm that it appears in the new folder.
4. Download an older report and confirm it still works.
5. Keep access to all previous folders. The portal retains their file IDs; it does not copy or move old files.

The new folder's inherited sharing permissions apply to newly created files. Check those permissions before using it.

## Transferring the portal role

1. Add the incoming CMM owner as one of the three administrators.
2. Have them sign in successfully.
3. Arrange the Google and GitHub handover below.
4. Use Settings → Transfer ownership to select that administrator.
5. The old owner becomes an administrator, and all sessions are invalidated. The new owner signs in and can remove the departing employee from the admin list.

## Transferring Google and GitHub control

A portal role is separate from the Google account that executes the service.

- Preserve the database spreadsheet, private PDF folders, Apps Script project, its configuration, and the GitHub repository.
- Use your organization's approved Drive ownership/Shared Drive process. Cross-domain and personal-account transfers can be restricted by Google or company policy.
- Ensure the incoming company Google account can read the old PDFs, write to the new folder, and edit the database.
- If the original company deployment account remains in use, avoid redeploying unnecessarily. If that account changes, have the new owner redeploy the script to execute as the new account and authorize it.
- If a new Apps Script project is needed, copy the source and privately restore the existing `CONFIG`, `DATABASE_ID`, and `SESSION_SECRET` Script Properties. Do not publish those properties or paste them into GitHub. Retain the existing database; do not run `setup()` against a configured project.
- Rotate `SESSION_SECRET` to a new long random value through Script Properties during handover to invalidate old sessions. Never remove or relax the backend allowlist to regain access.
- Update `config.js` with the new `/exec` URL when it changes, then publish GitHub Pages again.
- Delete the old owner's `sendOverdueDigest` trigger from the old account/project. Run `restoreNotificationTrigger()` once from the new owner's script editor to create the new trigger if reminders are enabled. Triggers run as the account that created them and are not transferred by changing portal roles.
- If necessary, transfer the GitHub repository to the company account or organization. Check Pages settings, repository permissions, and the published URL afterward.
- Verify sign-in, request creation, PDF upload, old PDF download, roster changes, and one authorized notification under the new owner before disabling the outgoing account.

Do not delete the original folders, spreadsheet, project, or account until the replacement has been verified and company backups exist.
