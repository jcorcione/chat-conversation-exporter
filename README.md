# Chat Conversation Exporter

A Chrome extension that allows you to export chat conversations in various formats (Markdown, PDF, HTML, JSON).

## Features
- Multiple export formats
- Theme customization
- Easy to use interface
- Optional: Save to Google Drive (if `identity` permission is added and feature is fully implemented)

## Installation
1. Clone this repository or download the ZIP.
2. If downloaded, unzip the file.
3. Open Chrome and go to `chrome://extensions/`.
4. Enable "Developer mode" (usually a toggle in the top right).
5. Click "Load unpacked" and select the extension directory (the one containing `manifest.json`).

## Required Icon Files
Ensure you have an `icons` folder in the root of the extension directory with the following files:
- `icons/icon16.png`
- `icons/icon48.png`
- `icons/icon128.png`

These are referenced in the `manifest.json` and are required by the Chrome Web Store.

## Notes on Permissions
- `activeTab`: Used to access the content of the current page for extracting the conversation.
- `storage`: Used to save user preferences (like theme color) and potentially for features like license management or usage counts.
- `host_permissions` for `*://*.googleapis.com/`: This is required if you intend to use the "Save to Google Drive" functionality in `background.js`, as it needs to make API calls to Google.
- `identity` (optional): If the Google Drive save feature is a core part of your extension, you should explicitly add the `"identity"` permission (and possibly `"identity.email"`) to the `manifest.json`. This allows the extension to request an OAuth token for Google services. Without it, `chrome.identity.getAuthToken` might still prompt the user, but it's better practice to declare it.

## Development & Testing
- After making changes, reload the extension from `chrome://extensions/`.
- Use the Chrome Developer Tools (Inspect) to debug:
    - The popup (right-click inside the popup and select Inspect).
    - The content script (Inspect the page where the content script is running).
    - The service worker/background script (from the `chrome://extensions/` page, find your extension and click the "service worker" link).

## Potential Issues & Troubleshooting
- **No conversation found:** The selectors in `content.js` might not match the structure of the chat website you are on. You may need to inspect the website's HTML and update the `messageSelectors` in `content.js`.
- **Content script not connecting:** Ensure the extension has permissions for the site, or try refreshing the page. Check the console on the target page for errors.
- **Google Drive Save Fails:**
    - Ensure `identity` permission is in `manifest.json` if this is a core feature.
    - Check the background script's console for authentication or API errors.
    - Verify the Google Drive API and OAuth client ID are correctly configured if you set up your own project.
