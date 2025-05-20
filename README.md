**Chat Conversation Exporter**

A Chrome extension that allows you to export chat conversations from popular LLM platforms like ChatGPT, Google Gemini, and Anthropic Claude into multiple formats (Markdown, PDF, HTML, JSON).

**Features**

-   Export to Markdown (.md)
-   Export to PDF Document (.pdf)
-   Export to HTML Document (.html)
-   Export to JSON (.json)
-   Customizable theme color for the popup.
-   Options to include/exclude timestamps and metadata in exports.
-   Designed with Manifest V3 requirements in mind.

**Supported Platforms (Tested)**

-   OpenAI ChatGPT (https://chat.openai.com/\*)
-   Google Gemini (https://gemini.google.com/\*)
-   Anthropic Claude (https://claude.ai/\*)

**Installation**

1.  Download the extension files (e.g., clone the repository or download the ZIP and extract it).
2.  Open Google Chrome and navigate to chrome://extensions/.
3.  Enable "Developer mode" (usually a toggle switch in the top-right corner).
4.  Click the "Load unpacked" button.
5.  Select the directory where you extracted the extension files (the folder containing manifest.json).

**Required Icon Files**

For the extension to load correctly and pass Chrome Web Store review, ensure you have an icons folder in the root of the extension directory with the following files:

-   icons/icon16.png
-   icons/icon48.png
-   icons/icon128.png

These are referenced in the manifest.json.

**Permissions Used**

This extension requests the following permissions:

-   `activeTab`: To access the content of the currently active page for extracting the conversation when the user clicks the extension icon on a supported platform.
-   `storage`: To save user preferences, such as the selected theme color.
-   `host\_permissions` for `\*://\*.googleapis.com/`: (If the Google Drive save feature in background.js is active) This is required to allow the extension to make API calls to Google Drive for saving exported files.

**Key Changes & Fixes (for Chrome Web Store Review)**

-   **Broad Host Permissions:** The content script (content.js) is now specifically matched to run only on chat.openai.com, gemini.google.com, and claude.ai to address concerns about broad host permissions.
-   **Remotely Hosted Code:** Addressed a violation where a feature within the included jspdf.umd.min.js library attempted to load pdfobject.min.js from a remote CDN. The code path in popup.js triggering this jsPDF feature has been removed.
-   **Manifest Validity:** The manifest.json has been updated to be fully compliant with Manifest V3.
-   **Icons:** Local icon inclusion is correctly configured.

**Development & Testing**

-   After making any code changes, reload the extension from chrome://extensions/.
-   Use Chrome Developer Tools to debug.

**Troubleshooting**

-   **"No conversation found" on supported sites:** The HTML structure of the chat website might have changed. The selectors in content.js may need updating.
-   **Google Drive Save Fails (if feature is active):**
    -   Ensure the `identity` permission is added to `manifest.json` if you are using `chrome.identity.getAuthToken`.
    -   Check the service worker console for errors.
```
