// Popup UI functionality
document.addEventListener('DOMContentLoaded', () => {
    // Get references to UI elements
    const formatSelect = document.getElementById('format');
    const downloadBtn = document.getElementById('download');
    const statusText = document.getElementById('status');
    const colorPicker = document.querySelector('.color-picker');

    // Handle color theme selection
    colorPicker.addEventListener('click', (e) => {
        const colorOption = e.target.closest('.color-option');
        if (!colorOption) return;

        // Remove selected class from all options
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('selected');
        });

        // Add selected class to clicked option
        colorOption.classList.add('selected');

        // Update theme color
        const color = colorOption.dataset.color;
        document.documentElement.style.setProperty('--theme-color', color);
        
        // Update button and UI elements
        downloadBtn.style.backgroundColor = color;
    });

    // Handle download button click
    downloadBtn.addEventListener('click', async () => {
        try {
            updateStatus('Exporting...', 'info');
            downloadBtn.disabled = true;

            // Get active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                throw new Error('No active tab found');
            }

            // Get conversation data from content script
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getConversation' });
            
            if (!response) {
                throw new Error('No response from content script');
            }

            if (response.error) {
                throw new Error(response.error.details || response.error.message);
            }

            if (!response.conversation || !response.conversation.messages) {
                throw new Error('Invalid conversation data received');
            }

            const format = formatSelect.value;
            const conversation = response.conversation;

            // Format the conversation based on selected format
            let content, filename, type;
            
            try {
                switch (format) {
                    case 'markdown':
                        content = formatMarkdown(conversation);
                        filename = 'conversation.md';
                        type = 'text/markdown';
                        break;
                        
                    case 'pdf':
                        content = await formatPDF(conversation);
                        filename = 'conversation.pdf';
                        type = 'application/pdf';
                        break;
                        
                    case 'html':
                        content = formatHTML(conversation);
                        filename = 'conversation.html';
                        type = 'text/html';
                        break;
                        
                    case 'json':
                        content = JSON.stringify(conversation, null, 2);
                        filename = 'conversation.json';
                        type = 'application/json';
                        break;

                    default:
                        throw new Error('Unsupported export format');
                }
            } catch (formatError) {
                throw new Error(`Error formatting conversation: ${formatError.message}`);
            }

            // Create download
            try {
                const blob = new Blob([content], { type });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            } catch (downloadError) {
                throw new Error(`Error creating download: ${downloadError.message}`);
            }

            updateStatus('Export complete!', 'success');
            setTimeout(() => {
                clearStatus();
            }, 2000);

        } catch (error) {
            console.error('Export failed:', error);
            updateStatus(error.message, 'error');
        } finally {
            downloadBtn.disabled = false;
        }
    });

    // Helper function to update status message
    function updateStatus(message, type = 'info') {
        statusText.textContent = message;
        statusText.className = `status ${type}`;
    }

    // Helper function to clear status message
    function clearStatus() {
        statusText.textContent = '';
        statusText.className = 'status';
    }
});

// Format conversation as Markdown
function formatMarkdown(conversation) {
    // Create metadata section
    const metadata = [
        `# ${conversation.title}`,
        '',
        '## Conversation Details',
        '',
        `- **Exported on:** ${new Date(conversation.timestamp).toLocaleString()}`,
        `- **Total Messages:** ${conversation.messages.length}`,
        '',
        '---',
        ''
    ].join('\n');

    // Format messages
    const messages = conversation.messages.map((msg, index) => {
        const role = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
        const messageNumber = index + 1;
        
        return [
            `### Message #${messageNumber} (${role})`,
            '',
            msg.content.split('\n').map(line => `> ${line}`).join('\n'),
            '',
            '---',
            ''
        ].join('\n');
    }).join('\n');

    // Create table of contents
    const toc = [
        '## Table of Contents',
        '',
        '1. [Conversation Details](#conversation-details)',
        ...conversation.messages.map((_, index) => 
            `${index + 2}. [Message #${index + 1}](#message-${index + 1})`
        ),
        '',
        '---',
        ''
    ].join('\n');

    // Combine all sections
    return [
        metadata,
        toc,
        messages
    ].join('\n');
}

// Format conversation as HTML
function formatHTML(conversation) {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${conversation.title}</title>
    <style>
        :root {
            --user-color: #e3f2fd;
            --assistant-color: #f5f5f5;
            --border-radius: 12px;
            --spacing: 20px;
        }
        
        body {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: var(--spacing);
            background-color: #ffffff;
            color: #333333;
        }
        
        .header {
            text-align: center;
            margin-bottom: calc(var(--spacing) * 2);
            padding-bottom: var(--spacing);
            border-bottom: 1px solid #e0e0e0;
        }
        
        h1 {
            font-size: 2em;
            color: #1a1a1a;
            margin: 0 0 var(--spacing) 0;
        }
        
        .timestamp {
            color: #666666;
            font-size: 0.9em;
        }
        
        .conversation {
            display: flex;
            flex-direction: column;
            gap: var(--spacing);
        }
        
        .message {
            padding: var(--spacing);
            border-radius: var(--border-radius);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .message.user {
            background-color: var(--user-color);
            margin-left: var(--spacing);
            border-top-left-radius: 4px;
        }
        
        .message.assistant {
            background-color: var(--assistant-color);
            margin-right: var(--spacing);
            border-top-right-radius: 4px;
        }
        
        .role {
            font-weight: 600;
            margin-bottom: 8px;
            color: #1a1a1a;
        }
        
        .content {
            white-space: pre-wrap;
            word-break: break-word;
        }
        
        @media (max-width: 600px) {
            body {
                padding: calc(var(--spacing) / 2);
            }
            
            .message {
                margin-left: 0;
                margin-right: 0;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${conversation.title}</h1>
        <div class="timestamp">Exported on: ${new Date(conversation.timestamp).toLocaleString()}</div>
    </div>
    
    <div class="conversation">`;

    conversation.messages.forEach(msg => {
        html += `
        <div class="message ${msg.role}">
            <div class="role">${msg.role === 'user' ? 'User' : 'Assistant'}</div>
            <div class="content">${msg.content.replace(/\n/g, '<br>')}</div>
        </div>`;
    });

    html += `
    </div>
</body>
</html>`;

    return html;
}

// Format conversation as PDF
async function formatPDF(conversation) {
    // Create new jsPDF instance using the global jspdf object
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    // Set document properties
    doc.setProperties({
        title: conversation.title,
        subject: 'Chat Conversation Export',
        creator: 'Chat Conversation Exporter'
    });

    // Define styles with improved visual hierarchy
    const styles = {
        title: { fontSize: 24, fontStyle: 'bold' },
        timestamp: { fontSize: 10, textColor: [128, 128, 128] },
        roleUser: { fontSize: 12, fontStyle: 'bold', textColor: [33, 150, 243] },
        roleAssistant: { fontSize: 12, fontStyle: 'bold', textColor: [76, 175, 80] },
        content: { fontSize: 11, lineHeight: 1.5 }
    };

    // Page settings
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    const maxWidth = pageWidth - (margin * 2);
    let y = margin;

    // Helper function to add a new page
    const addNewPage = () => {
        doc.addPage();
        y = margin;
        return y;
    };

    // Helper function to check and add new page if needed
    const checkNewPage = (height) => {
        if (y + height > doc.internal.pageSize.height - margin) {
            return addNewPage();
        }
        return y;
    };

    // Add title
    doc.setFontSize(styles.title.fontSize);
    doc.setFont(undefined, 'bold');
    const titleLines = doc.splitTextToSize(conversation.title, maxWidth);
    y = checkNewPage(titleLines.length * 10 + 15);
    doc.text(titleLines, margin, y);
    y += (titleLines.length * 10) + 10;

    // Add timestamp
    doc.setFontSize(styles.timestamp.fontSize);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(styles.timestamp.textColor[0], styles.timestamp.textColor[1], styles.timestamp.textColor[2]);
    y = checkNewPage(8);
    doc.text(`Exported on: ${new Date(conversation.timestamp).toLocaleString()}`, margin, y);
    y += 15;

    // Process each message
    for (const msg of conversation.messages) {
        const isUser = msg.role === 'user';
        const style = isUser ? styles.roleUser : styles.roleAssistant;
        const bubbleMargin = isUser ? 30 : 10;
        const bubbleWidth = maxWidth - 40;

        // Add role label with icon
        doc.setFontSize(style.fontSize);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(style.textColor[0], style.textColor[1], style.textColor[2]);
        y = checkNewPage(25);
        doc.text(isUser ? '👤 User' : '🤖 Assistant', margin + bubbleMargin, y);
        y += 6;

        // Add message content in a bubble-like format
        doc.setFontSize(styles.content.fontSize);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);

        // Draw message bubble background
        const contentLines = doc.splitTextToSize(msg.content, bubbleWidth);
        const bubbleHeight = (contentLines.length * styles.content.fontSize * 0.5) + 10;
        y = checkNewPage(bubbleHeight + 5);
        
        // Draw bubble background using rect instead of roundedRect
        doc.setFillColor(isUser ? 230 : 245, isUser ? 242 : 245, isUser ? 255 : 245);
        doc.rect(
            margin + bubbleMargin - 5,
            y - 5,
            bubbleWidth + 10,
            bubbleHeight,
            'F'
        );

        // Add message content
        contentLines.forEach(line => {
            y = checkNewPage(styles.content.fontSize * 0.5);
            doc.text(line, margin + bubbleMargin, y);
            y += styles.content.fontSize * 0.5;
        });

        y += 15; // Add space between messages
    }

    return doc.output('arraybuffer');
}