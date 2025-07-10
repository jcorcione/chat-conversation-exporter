// Popup UI functionality
document.addEventListener('DOMContentLoaded', () => {
    // Get references to UI elements
    const formatSelect = document.getElementById('format');
    const downloadBtn = document.getElementById('download');
    const statusText = document.getElementById('status');
    const colorPicker = document.querySelector('.color-picker');
    const includeTimestampsCheckbox = document.getElementById('includeTimestamps');
    const includeMetadataCheckbox = document.getElementById('includeMetadata');


    // --- Initialize Theme ---
    // Function to set the theme color
    function setThemeColor(color) {
        document.documentElement.style.setProperty('--theme-color', color);
        if (downloadBtn) {
            downloadBtn.style.backgroundColor = color;
        }
        // Store the selected color in local storage
        if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ selectedThemeColor: color });
        }
    }

    // Load saved theme color or set default
    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['selectedThemeColor'], (result) => {
            if (result.selectedThemeColor) {
                setThemeColor(result.selectedThemeColor);
                // Update selected class in color picker
                document.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('selected');
                    if (opt.dataset.color === result.selectedThemeColor) {
                        opt.classList.add('selected');
                    }
                });
            } else {
                // Set default if no color is saved (e.g., first option)
                const defaultColorOption = document.querySelector('.color-option');
                if (defaultColorOption) {
                    defaultColorOption.classList.add('selected');
                    setThemeColor(defaultColorOption.dataset.color);
                }
            }
        });
    } else {
        // Fallback for environments where chrome.storage.local is not available (e.g. testing)
         const defaultColorOption = document.querySelector('.color-option.selected') || document.querySelector('.color-option');
         if (defaultColorOption) {
            setThemeColor(defaultColorOption.dataset.color);
         }
    }


    // Handle color theme selection
    if (colorPicker) {
        colorPicker.addEventListener('click', (e) => {
            const colorOption = e.target.closest('.color-option');
            if (!colorOption) return;

            document.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            colorOption.classList.add('selected');
            setThemeColor(colorOption.dataset.color);
        });
    }


    // Handle download button click
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            // Check License and Usage (Example - can be expanded)
            if (window.LicenseManager && window.Storage) { // Ensure objects are available
                const isLicensed = await LicenseManager.checkLicense();
                const canUseFree = await LicenseManager.isWithinFreeLimit(5); // Example: 5 free exports

                if (!isLicensed && !canUseFree) {
                    updateStatus('Free export limit reached. Please upgrade for unlimited exports.', 'error');
                    // Optionally, redirect to a licensing page or show a modal
                    // For example: chrome.tabs.create({ url: 'YOUR_LICENSING_PAGE_URL' });
                    return; 
                }
                
                if (!isLicensed) {
                    await LicenseManager.incrementUsage();
                }
            }


            try {
                updateStatus('Exporting...', 'info');
                downloadBtn.disabled = true;

                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                
                if (!tab || tab.id === undefined) { // Check for undefined tab.id as well
                    throw new Error('No active tab found or tab ID is missing.');
                }
                
                // Check if the tab is a privileged URL (e.g., chrome://, about:)
                if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('about:'))) {
                    throw new Error(`Cannot access content on this page: ${tab.url}. Try a different page.`);
                }


                // Get conversation data from content script
                let response;
                try {
                     response = await chrome.tabs.sendMessage(tab.id, { action: 'getConversation' });
                } catch (e) {
                    console.error("Error sending message to content script:", e);
                    if (e.message.includes("Receiving end does not exist")) {
                         throw new Error("Could not connect to the content script. Please refresh the page and try again. Ensure the extension has permissions for this site.");
                    }
                    throw new Error(`Communication error with content script: ${e.message}`);
                }
                
                if (!response) {
                    throw new Error('No response from content script. Ensure it is injected and active.');
                }

                if (response.error) {
                    throw new Error(response.error.details || response.error.message || 'Unknown error from content script.');
                }

                if (!response.conversation || !response.conversation.messages) {
                    throw new Error('Invalid conversation data received from content script.');
                }

                const format = formatSelect.value;
                const conversationData = response.conversation;
                const exportOptions = {
                    includeTimestamps: includeTimestampsCheckbox.checked,
                    includeMetadata: includeMetadataCheckbox.checked,
                    // Add other options as needed
                };


                let content, filename, type;
                
                try {
                    switch (format) {
                        case 'markdown':
                            content = formatMarkdown(conversationData, exportOptions);
                            filename = `${generateFilename(conversationData.title)}.md`;
                            type = 'text/markdown;charset=utf-8';
                            break;
                            
                        case 'pdf':
                            content = await formatPDF(conversationData, exportOptions); // formatPDF is async
                            filename = `${generateFilename(conversationData.title)}.pdf`;
                            type = 'application/pdf';
                            break;
                            
                        case 'html':
                            content = formatHTML(conversationData, exportOptions);
                            filename = `${generateFilename(conversationData.title)}.html`;
                            type = 'text/html;charset=utf-8';
                            break;
                            
                        case 'json':
                            content = JSON.stringify(conversationData, null, 2);
                            filename = `${generateFilename(conversationData.title)}.json`;
                            type = 'application/json;charset=utf-8';
                            break;

                        default:
                            throw new Error('Unsupported export format selected.');
                    }
                } catch (formatError) {
                    console.error('Formatting error:', formatError);
                    throw new Error(`Error formatting conversation: ${formatError.message}`);
                }

                // Create download
                try {
                    const blob = new Blob([content], { type });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a); // Required for Firefox
                    a.click();
                    document.body.removeChild(a); // Clean up
                    URL.revokeObjectURL(url);
                } catch (downloadError) {
                    console.error('Download creation error:', downloadError);
                    throw new Error(`Error creating download: ${downloadError.message}`);
                }

                updateStatus('Export complete!', 'success');
                setTimeout(() => {
                    clearStatus();
                }, 3000); // Increased timeout

            } catch (error) {
                console.error('Full export process failed:', error);
                updateStatus(`Export failed: ${error.message}`, 'error');
            } finally {
                downloadBtn.disabled = false;
            }
        });
    }

    // Helper function to generate a safe filename
    function generateFilename(title) {
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const safeTitle = title ? title.replace(/[<>:"/\\|?*\s]+/g, '_').substring(0, 50) : 'conversation';
        return `${safeTitle}_${dateStr}_${timeStr}`;
    }


    // Helper function to update status message
    function updateStatus(message, type = 'info') {
        if (statusText) {
            statusText.textContent = message;
            statusText.className = `status ${type}`;
        }
    }

    // Helper function to clear status message
    function clearStatus() {
        if (statusText) {
            statusText.textContent = '';
            statusText.className = 'status';
        }
    }
});

// --- Formatting Functions ---

// Format conversation as Markdown
function formatMarkdown(conversation, options) {
    let markdown = '';

    if (options.includeMetadata) {
        markdown += `# ${conversation.title || 'Chat Conversation'}\n\n`;
        markdown += `## Conversation Details\n`;
        markdown += `- **Exported on:** ${new Date(conversation.timestamp).toLocaleString()}\n`;
        markdown += `- **Total Messages:** ${conversation.messages.length}\n\n`;
        markdown += '---\n\n';
    }
    
    // Optional: Table of Contents (can be complex for Markdown, keeping simple for now)
    // markdown += `## Table of Contents\n\n`;
    // conversation.messages.forEach((_, index) => {
    //     markdown += `${index + 1}. [Message #${index + 1}](#message-${index + 1})\n`;
    // });
    // markdown += '\n---\n\n';


    conversation.messages.forEach((msg, index) => {
        const role = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
        // markdown += `### <a name="message-${index + 1}"></a> Message #${index + 1} (${role})\n\n`; // Anchor for ToC
        markdown += `### ${role}`;
        if (options.includeTimestamps && msg.timestamp) {
             markdown += ` (${new Date(msg.timestamp).toLocaleTimeString()})`;
        }
        markdown += `\n\n`;
        markdown += `${msg.content.split('\n').map(line => `> ${line}`).join('\n')}\n\n`;
        if (index < conversation.messages.length - 1) {
            markdown += '---\n\n';
        }
    });

    return markdown;
}

// Format conversation as HTML
function formatHTML(conversation, options) {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${conversation.title || 'Chat Conversation'}</title>
    <style>
        :root {
            --user-color: #e3f2fd; /* Light blue for user */
            --assistant-color: #f1f8e9; /* Light green for assistant */
            --border-radius: 12px;
            --spacing: 16px;
            --text-color: #333;
            --meta-text-color: #555;
            --font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        body {
            font-family: var(--font-family);
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: var(--spacing);
            background-color: #fcfcfc;
            color: var(--text-color);
        }
        .header {
            text-align: center;
            margin-bottom: calc(var(--spacing) * 1.5);
            padding-bottom: var(--spacing);
            border-bottom: 1px solid #e0e0e0;
        }
        h1 {
            font-size: 1.8em;
            color: #1a1a1a;
            margin: 0 0 calc(var(--spacing) / 2) 0;
        }
        .export-timestamp {
            color: var(--meta-text-color);
            font-size: 0.85em;
        }
        .conversation {
            display: flex;
            flex-direction: column;
            gap: var(--spacing);
        }
        .message {
            padding: calc(var(--spacing) * 0.75) var(--spacing);
            border-radius: var(--border-radius);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
            position: relative;
        }
        .message.user {
            background-color: var(--user-color);
            margin-left: calc(var(--spacing) * 2);
            border-top-left-radius: 4px; /* Bubble tail effect */
            align-self: flex-end;
            max-width: 85%;
        }
        .message.assistant {
            background-color: var(--assistant-color);
            margin-right: calc(var(--spacing) * 2);
            border-top-right-radius: 4px; /* Bubble tail effect */
            align-self: flex-start;
            max-width: 85%;
        }
        .role {
            font-weight: 600;
            margin-bottom: 6px;
            color: #1a1a1a;
            font-size: 0.9em;
        }
         .message-timestamp {
            font-size: 0.75em;
            color: var(--meta-text-color);
            display: block;
            margin-bottom: 6px;
            text-align: right;
        }
        .content {
            white-space: pre-wrap;
            word-break: break-word;
        }
        @media (max-width: 600px) {
            body { padding: calc(var(--spacing) / 2); }
            .message.user, .message.assistant { margin-left: 0; margin-right: 0; max-width: 100%;}
        }
    </style>
</head>
<body>`;

    if (options.includeMetadata) {
        html += `
    <div class="header">
        <h1>${conversation.title || 'Chat Conversation'}</h1>
        <div class="export-timestamp">Exported on: ${new Date(conversation.timestamp).toLocaleString()}</div>
    </div>`;
    }
    
    html += `
    <div class="conversation">`;

    conversation.messages.forEach(msg => {
        const roleDisplay = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
        html += `
        <div class="message ${msg.role}">
            <div class="role">${roleDisplay}</div>`;
        if (options.includeTimestamps && msg.timestamp) {
             html += `<div class="message-timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</div>`;
        }
        html += `<div class="content">${msg.content.replace(/\n/g, '<br>')}</div>
        </div>`;
    });

    html += `
    </div>
</body>
</html>`;

    return html;
}

// Format conversation as PDF
async function formatPDF(conversation, options) {
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        throw new Error('jsPDF library is not loaded. Ensure lib/jspdf.umd.min.js is included and loaded correctly.');
    }
    const { jsPDF } = window.jspdf; // Destructure jsPDF from the global jspdf object
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    doc.setProperties({
        title: conversation.title || 'Chat Conversation',
        subject: 'Chat Conversation Export',
        creator: 'Chat Conversation Exporter'
    });

    const styles = {
        title: { fontSize: 18, fontStyle: 'bold' },
        timestamp: { fontSize: 9, textColor: [100, 100, 100] },
        roleUser: { fontSize: 10, fontStyle: 'bold', textColor: [0, 100, 200] }, // Blue for user
        roleAssistant: { fontSize: 10, fontStyle: 'bold', textColor: [0, 120, 0] }, // Green for assistant
        content: { fontSize: 10, lineHeight: 1.4 },
        messageTimestamp: { fontSize: 8, textColor: [120, 120, 120] }
    };

    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - (margin * 2);
    let y = margin;

    const addNewPageIfNeeded = (heightNeeded) => {
        if (y + heightNeeded > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
    };
    
    // Add Title and Metadata if enabled
    if (options.includeMetadata) {
        doc.setFontSize(styles.title.fontSize);
        doc.setFont(undefined, styles.title.fontStyle || 'normal'); // Ensure font style is set
        const titleLines = doc.splitTextToSize(conversation.title || 'Chat Conversation', maxWidth);
        addNewPageIfNeeded(titleLines.length * (styles.title.fontSize * 0.352778) * 1.2 + 5); // Approximate height + spacing
        doc.text(titleLines, margin, y);
        y += titleLines.length * (styles.title.fontSize * 0.352778) * 1.2 + 2; // Spacing after title

        doc.setFontSize(styles.timestamp.fontSize);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(styles.timestamp.textColor[0], styles.timestamp.textColor[1], styles.timestamp.textColor[2]);
        addNewPageIfNeeded(styles.timestamp.fontSize * 0.352778 + 5);
        doc.text(`Exported on: ${new Date(conversation.timestamp).toLocaleString()}`, margin, y);
        y += styles.timestamp.fontSize * 0.352778 + 8; // Spacing after timestamp
    }


    for (const msg of conversation.messages) {
        const isUser = msg.role === 'user';
        const roleStyle = isUser ? styles.roleUser : styles.roleAssistant;
        const bubbleMargin = isUser ? pageWidth / 3 - margin : 0; // User on right, Assistant on left
        const bubbleAlign = isUser ? 'right' : 'left';
        const bubbleX = margin + (isUser ? bubbleMargin : 0);
        const bubbleMaxWidth = pageWidth - (margin * 2) - (pageWidth / 3 - margin); // Max width for bubble

        // Role and Message Timestamp
        let roleText = isUser ? '👤 User' : '🤖 Assistant';
        if (options.includeTimestamps && msg.timestamp) {
            roleText += ` - ${new Date(msg.timestamp).toLocaleTimeString()}`;
        }
        
        doc.setFontSize(roleStyle.fontSize);
        doc.setFont(undefined, roleStyle.fontStyle || 'normal');
        doc.setTextColor(roleStyle.textColor[0], roleStyle.textColor[1], roleStyle.textColor[2]);
        
        const roleTextHeight = roleStyle.fontSize * 0.352778;
        addNewPageIfNeeded(roleTextHeight + 2); // Height for role text + spacing
        doc.text(roleText, bubbleX, y, { align: bubbleAlign, maxWidth: bubbleMaxWidth });
        y += roleTextHeight + 2; // Spacing after role

        // Content
        doc.setFontSize(styles.content.fontSize);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(50, 50, 50);

        const contentLines = doc.splitTextToSize(msg.content, bubbleMaxWidth - 10); // -10 for padding inside bubble
        const contentHeight = contentLines.length * (styles.content.fontSize * 0.352778 * styles.content.lineHeight);
        const bubbleHeight = contentHeight + 8; // 4mm padding top/bottom

        addNewPageIfNeeded(bubbleHeight + 8); // Bubble height + spacing after bubble

        // Draw bubble background
        doc.setFillColor(isUser ? 225 : 240, isUser ? 239 : 240, isUser ? 253 : 240); // Lighter user/assistant colors
        doc.roundedRect(bubbleX - (isUser ? 0 : 2), y, bubbleMaxWidth, bubbleHeight, 3, 3, 'F'); // x, y, w, h, rx, ry, style

        // Add message content
        doc.text(contentLines, bubbleX + (isUser ? bubbleMaxWidth - 4 : 4) , y + 4, { // 4mm padding
            align: bubbleAlign, 
            maxWidth: bubbleMaxWidth - 8, // -8 for padding
            lineHeightFactor: styles.content.lineHeight
        });
        y += bubbleHeight + 8; // Spacing after bubble
    }

    return doc.output('arraybuffer');
}
