# Release Notes

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Read the DOM of the chat tab the user has open, only when they click the extension icon. No background tab access. |
| `storage` | Persist user preferences (popup theme colors, export options) between sessions. |
| `host_permissions: *://*.googleapis.com/` | Upload exported conversations to the user's Google Drive when they choose that destination (`src/background.js` calls `www.googleapis.com/upload/drive/v3/files`). |

## Changelog

### 1.5.0 — 2026-09-07
- Rebuilt `extractConversation()` in `src/content.js` with platform-specific extractors for ChatGPT, Claude.ai, and Gemini, keyed on `location.hostname`.
- 1.4 claimed multi-platform support via manifest `content_scripts.matches` domains; 1.5 implements it. Previously all three sites fell through to a generic class-name guess list that only reliably matched ChatGPT's older DOM.
- Fixed Gemini exporting the wrong/first conversation (root cause: generic selectors picked up stale or unrelated DOM nodes instead of the current `<user-query>` / `<model-response>` turns).
- Selectors used, confirmed against live DOM on 2026-09-07:
  - **ChatGPT** (chatgpt.com, chat.openai.com): `[data-message-author-role="user"|"assistant"]`, content from `.markdown`.
  - **Claude.ai**: user turns `[data-testid="user-message"]`, assistant turns `.font-claude-response`.
  - **Gemini**: user turns `<user-query>` (text from `.query-text-line`, skipping the visually-hidden a11y label), assistant turns `<model-response>` (text from `.markdown`).
- Generic heuristic extractor kept as fallback for unsupported sites and as a safety net if a platform's DOM changes again.

### 1.4.1 and earlier
- See git history — no structured changelog was kept prior to 1.5.0.

## Rollback

1. Chrome Web Store Developer Dashboard → this item → **Package** tab → prior version's uploaded zip is listed under version history.
2. Select the last-known-good version (1.4.1, `../chat-conversation-exporter_1.3.zip` is an older local archive, not 1.4.1 — pull the actual 1.4.1 package from the dashboard's version history, not from this repo's zip files) and click **Rollback to this version**, or re-zip that tagged commit and submit as a new version if the dashboard doesn't offer direct rollback.
3. If DOM selectors break again on one platform, the generic fallback in `extractGeneric()` still runs automatically — check the exported file before assuming a full rollback is needed.

## Testing checklist (before this submission)

- [x] Read current `manifest.json` and `src/content.js` to confirm scope of the bug matched the handoff notes.
- [x] Opened chatgpt.com, claude.ai, gemini.google.com with a real logged-in session and inspected live DOM for each platform's message structure.
- [x] Injected the exact new extractor functions into each live page and confirmed correct `role` + clean `content` (no UI chrome, no a11y label leakage) for a real conversation on all three platforms.
- [x] Confirmed output shape (`{role, content, timestamp}`) is unchanged, so downstream format generation (Markdown/HTML/PDF/JSON in `popup.js`) is unaffected by this change.
- [ ] Manual: load unpacked in `chrome://extensions`, click the toolbar icon on a real conversation, export at least one format per platform. Skipped by explicit decision (2026-09-07) — shipping on the strength of the live-DOM extraction test above, since that's the part that was actually broken. Popup/format-generation code is unchanged by this release.
