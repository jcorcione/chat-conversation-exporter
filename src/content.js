// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getConversation') {
        try {
            const conversation = extractConversation();
            sendResponse({ status: 'success', conversation });
        } catch (error) {
            console.error("Error in content script (getConversation):", error);
            sendResponse({ status: 'error', error: { message: error.message, details: error.stack } });
        }
        return true; // Required to use sendResponse asynchronously
    }
    // Add other actions if needed
});

// Extract conversation data from the page
function extractConversation() {
    const messages = [];
    
    // --- Common selectors for chat elements (these need to be adapted to the target chat sites) ---
    // This is a generic example. You'll need to inspect the HTML structure of
    // the chat applications you want to support and update these selectors.
    const messageSelectors = [
        // Example for a generic chat structure:
        '.message-container', // A container for each message
        '.chat-message',      // Another common class name
        '[data-testid="chat-message"]', // For apps using data-testid attributes
        // Add more selectors based on target websites
        // For ChatGPT (example, might change with UI updates):
        '.group.w-full.text-token-text-primary', // Main message container
        // Common classes for user messages
        '.user-message',
        '[class*="user-msg"]',
        // Common classes for assistant/bot messages
        '.assistant-message',
        '.bot-message',
        '[class*="assistant-msg"]',
        '[class*="bot-msg"]',
        // More generic, but potentially useful
        'div[class*="message"] > div[class*="content"]',
        'article[class*="message"]',
    ];

    let messageElements = [];
    for (const selector of messageSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            messageElements = Array.from(elements);
            // Prioritize selectors that seem more specific for message roles
            if (selector.includes('user-') || selector.includes('assistant-') || selector.includes('bot-')) {
                break; 
            }
        }
    }
    
    if (messageElements.length === 0) {
        // Try a more general approach if specific selectors fail.
        const logElements = document.querySelectorAll('[role="log"] [role="listitem"], [aria-live="polite"] > div, main [role="presentation"] > div > div > div');
        if (logElements.length > 0) {
            messageElements = Array.from(logElements).filter(el => el.textContent.trim().length > 10); // Filter out very short/empty items
        } else {
            const allDivs = document.querySelectorAll('div');
            const potentialMessages = Array.from(allDivs).filter(div => 
                (/(message|msg|chat|conversation|dialogue|text|content|bubble)/i.test(div.className) && 
                 div.textContent.trim().length > 20 && // Heuristic: messages usually have some length
                 div.children.length < 5 && // Heuristic: messages are often simple containers
                 !div.querySelector('button') && !div.querySelector('input')) // Heuristic: avoid interactive elements
            );
            if(potentialMessages.length > 0) {
                messageElements = potentialMessages;
            } else {
                 throw new Error('No conversation elements found. The extension might not be compatible with this website or chat structure. Please try selecting a more specific part of the chat if possible.');
            }
        }
    }

    // Process found elements
    messageElements.forEach((element, index) => {
        let role = 'assistant'; // Default to assistant
        let content = '';
        let timestamp = null; // Placeholder for timestamp

        // Attempt to determine role (more specific checks first)
        const classListString = element.classList.toString().toLowerCase();
        const dataRole = element.dataset.role || element.getAttribute('data-author');

        if (dataRole === 'user' || classListString.includes('user') || classListString.includes('sent')) {
            role = 'user';
        } else if (dataRole === 'assistant' || dataRole === 'bot' || classListString.includes('assistant') || classListString.includes('received') || classListString.includes('bot')) {
            role = 'assistant';
        } else {
            // Fallback: Check parent elements for role indicators if the current element is too generic
            let parent = element.parentElement;
            for (let i = 0; i < 3 && parent; i++) { // Check up to 3 levels
                const parentClassList = parent.classList.toString().toLowerCase();
                if (parentClassList.includes('user')) { role = 'user'; break; }
                if (parentClassList.includes('assistant') || parentClassList.includes('bot')) { role = 'assistant'; break; }
                parent = parent.parentElement;
            }
        }

        // Attempt to extract content
        // Prioritize elements with specific content classes, then try innerText
        const contentElement = element.querySelector('.content, .message-text, .message-body, [data-testid="message-content"]');
        content = contentElement ? contentElement.innerText.trim() : element.innerText.trim();
        
        // If content is still empty, try to get it from a deeper, common structure for ChatGPT
        if (!content && element.querySelector('div > div > div > div[class*="markdown"]')) {
            content = element.querySelector('div > div > div > div[class*="markdown"]').innerText.trim();
        }


        // Attempt to extract timestamp (very site-specific)
        const timeElement = element.querySelector('.timestamp, .time, [data-timestamp]');
        if (timeElement) {
            const timeString = timeElement.dataset.timestamp || timeElement.textContent.trim();
            // This parsing is highly dependent on the format of the timestamp on the page.
            // You might need a more robust date parsing library or specific regex.
            const parsedDate = Date.parse(timeString);
            if (!isNaN(parsedDate)) {
                timestamp = new Date(parsedDate).toISOString();
            } else {
                // Fallback for relative times like "2m ago" - this is tricky and often not precise
                // For now, we'll just use the current time as a rough estimate if parsing fails
                timestamp = new Date().toISOString(); 
            }
        } else {
            // If no specific timestamp, use current time or slightly offset based on message order
            timestamp = new Date(Date.now() - (messageElements.length - index) * 1000).toISOString();
        }


        if (content) {
            messages.push({
                role: role,
                content: content,
                timestamp: timestamp // Add timestamp to each message
            });
        }
    });

    if (messages.length === 0) {
        throw new Error('No messages could be extracted from the identified conversation elements. The page structure might be too complex or unsupported.');
    }

    // Create conversation object
    return {
        title: document.title || 'Exported Conversation',
        timestamp: new Date().toISOString(), // Timestamp for the export itself
        messages: messages
    };
}
