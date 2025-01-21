// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getConversation') {
        try {
            const conversation = extractConversation();
            sendResponse({ conversation });
        } catch (error) {
            sendResponse({ error: error.message });
        }
    }
    return true; // Required to use sendResponse asynchronously
});

// Extract conversation data from the page
function extractConversation() {
    // Get all chat messages
    const messages = [];
    const messageElements = document.querySelectorAll('[class*="message"], [class*="chat"], [class*="conversation"]');
    
    messageElements.forEach(element => {
        // Try to determine if it's a user or assistant message
        const isUser = element.classList.toString().toLowerCase().includes('user') ||
                      element.getAttribute('data-author') === 'user';
        
        const content = element.textContent.trim();
        if (content) {
            messages.push({
                role: isUser ? 'user' : 'assistant',
                content: content
            });
        }
    });

    // If no messages found, throw error
    if (messages.length === 0) {
        throw new Error('No conversation found on this page');
    }

    // Create conversation object
    return {
        title: document.title || 'Exported Conversation',
        timestamp: new Date().toISOString(),
        messages: messages
    };
}