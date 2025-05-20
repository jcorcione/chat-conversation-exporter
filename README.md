Chat Conversation Exporter
A Chrome extension that allows you to export chat conversations from various web pages into multiple formats, including Markdown, PDF, HTML, and JSON.

Features
Export to Markdown (.md)

Export to PDF Document (.pdf)

Export to HTML Document (.html)

Export to JSON (.json)

Customizable theme color for the popup.

Options to include/exclude timestamps and metadata in exports.

Designed with Manifest V3 requirements in mind.

Installation
Download the extension files (e.g., clone the repository or download the ZIP and extract it).

Open Google Chrome and navigate to chrome://extensions/.

Enable "Developer mode" (usually a toggle switch in the top-right corner).

Click the "Load unpacked" button.

Select the directory where you extracted the extension files (the folder containing manifest.json).

Required Icon Files
For the extension to load correctly and pass Chrome Web Store review, ensure you have an icons folder in the root of the extension directory with the following files:

icons/icon16.png

icons/icon48.png

icons/icon128.png

These are referenced in the manifest.json.

Permissions Used
This extension requests the following permissions:

activeTab: To access the content of the currently active page for extracting the conversation when the user clicks the extension icon.

storage: To save user preferences, such as the selected theme color, and potentially for features like license management or usage counts.

host_permissions for *://*.googleapis.com/: (If the Google Drive save feature in background.js is active) This is required to allow the extension to make API calls to Google Drive for saving exported files.

Key Changes & Fixes (for Chrome Web Store Review)
Remotely Hosted Code: Addressed a violation where a feature within the included jspdf.umd.min.js library attempted to load pdfobject.min.js from a remote CDN. The code path in popup.js triggering this jsPDF feature has been removed to ensure all operational code is contained within the extension package, complying with Manifest V3 policies.

Manifest Validity: The manifest.json has been updated to be fully compliant with Manifest V3, including the declaration of a service worker for background.js and ensuring correct JSON formatting.

Icons: Instructions and manifest entries are set up for local icon inclusion.

Permissions: Permissions are scoped to what is necessary for the extension's functionality.

Development & Testing
After making any code changes, reload the extension from chrome://extensions/ by clicking the refresh icon for the extension.

Use Chrome Developer Tools to debug:

Popup: Right-click inside the popup and select "Inspect."

Content Script: On the page where the content script is active, right-click and select "Inspect."

Service Worker (background.js): From chrome://extensions/, find your extension and click the "service worker" link.

Troubleshooting
"No conversation found": The selectors in content.js might not match the HTML structure of the specific chat website you are on. You may need to inspect the website's HTML and update the messageSelectors in content.js for broader compatibility.

"Could not connect to the content script": Ensure the extension has permissions for the site (if necessary, beyond activeTab for automatic injection, though this setup primarily relies on activeTab). Try refreshing the target page and the extension.

Google Drive Save Fails (if feature is active):

Ensure the identity permission is added to manifest.json if you are using chrome.identity.getAuthToken.

Check the service worker console for authentication or API errors.