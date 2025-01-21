// Popup UI functionality
document.addEventListener('DOMContentLoaded', () => {
    // Get references to UI elements
    const formatSelect = document.getElementById('format');
    const downloadBtn = document.getElementById('download');
    const statusText = document.getElementById('status');

    // Handle download button click
    downloadBtn.addEventListener('click', async () => {
        try {
            statusText.textContent = 'Exporting...';
            downloadBtn.disabled = true;

            // Get active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Get conversation data from content script
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getConversation' });
            
            if (!response || !response.conversation) {
                throw new Error('Failed to get conversation data');
            }

            const format = formatSelect.value;
            const conversation = response.conversation;
            
            // Format the conversation based on selected format
            let content, filename, type;
            
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
                    
                default:
                    content = JSON.stringify(conversation, null, 2);
                    filename = 'conversation.json';
                    type = 'application/json';
            }

            // Create download
            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            statusText.textContent = 'Export complete!';
            setTimeout(() => {
                statusText.textContent = '';
            }, 2000);

        } catch (error) {
            console.error('Export failed:', error);
            statusText.textContent = 'Export failed! ' + error.message;
        } finally {
            downloadBtn.disabled = false;
        }
    });
});

// Format conversation as Markdown
function formatMarkdown(conversation) {
    let markdown = `# ${conversation.title}\n\n`;
    markdown += `Exported on: ${new Date(conversation.timestamp).toLocaleString()}\n\n`;
    
    conversation.messages.forEach(msg => {
        const role = msg.role === 'user' ? '**User**' : '**Assistant**';
        markdown += `### ${role}\n\n${msg.content}\n\n`;
    });
    
    return markdown;
}

// Format conversation as HTML
function formatHTML(conversation) {
    let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${conversation.title}</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        .message { margin-bottom: 20px; padding: 15px; border-radius: 8px; }
        .user { background-color: #f0f0f0; }
        .assistant { background-color: #f8f8f8; }
        .role { font-weight: bold; margin-bottom: 5px; }
        .timestamp { color: #666; font-size: 0.9em; margin-bottom: 20px; }
    </style>
</head>
<body>
    <h1>${conversation.title}</h1>
    <div class="timestamp">Exported on: ${new Date(conversation.timestamp).toLocaleString()}</div>`;

    conversation.messages.forEach(msg => {
        html += `
    <div class="message ${msg.role}">
        <div class="role">${msg.role === 'user' ? 'User' : 'Assistant'}</div>
        <div class="content">${msg.content.replace(/\n/g, '<br>')}</div>
    </div>`;
    });

    html += `
</body>
</html>`;

    return html;
}

// Format conversation as PDF
async function formatPDF(conversation) {
    // Create new jsPDF instance
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Set title
    doc.setFontSize(20);
    doc.text(conversation.title, 20, 20);
    
    // Set timestamp
    doc.setFontSize(12);
    doc.text(`Exported on: ${new Date(conversation.timestamp).toLocaleString()}`, 20, 30);
    
    // Add messages
    let y = 40;
    doc.setFontSize(12);
    
    for (const msg of conversation.messages) {
        // Add role header
        doc.setFont(undefined, 'bold');
        doc.text(msg.role === 'user' ? 'User' : 'Assistant', 20, y);
        y += 10;
        
        // Add message content
        doc.setFont(undefined, 'normal');
        const lines = doc.splitTextToSize(msg.content, 170);
        
        // Check if we need a new page
        if (y + lines.length * 7 > 280) {
            doc.addPage();
            y = 20;
        }
        
        doc.text(lines, 20, y);
        y += lines.length * 7 + 10;
        
        // Add new page if near bottom
        if (y > 280) {
            doc.addPage();
            y = 20;
        }
    }
    
    return doc.output('arraybuffer');
}