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
    let messages;

    switch (location.hostname) {
        case 'chatgpt.com':
        case 'chat.openai.com':
        case 'www.chatgpt.com':
            messages = extractChatGPT();
            break;
        case 'claude.ai':
            messages = extractClaude();
            break;
        case 'gemini.google.com':
            messages = extractGemini();
            break;
        default:
            messages = extractGeneric();
    }

    if (messages.length === 0) {
        // Site-specific extractor found nothing (e.g. UI update broke selectors) — fall back to generic scan.
        messages = extractGeneric();
    }

    if (messages.length === 0) {
        throw new Error('No messages could be extracted from the identified conversation elements. The page structure might be too complex or unsupported.');
    }

    return {
        title: document.title || 'Exported Conversation',
        timestamp: new Date().toISOString(), // Timestamp for the export itself
        messages: messages
    };
}

function makeTimestamp(index, total) {
    return new Date(Date.now() - (total - index) * 1000).toISOString();
}

// ChatGPT: turns carry data-message-author-role="user"|"assistant"; text lives in .markdown (assistant) or plain innerText (user).
function extractChatGPT() {
    const nodes = Array.from(document.querySelectorAll('[data-message-author-role]'));
    const messages = [];
    nodes.forEach((node, index) => {
        const role = node.getAttribute('data-message-author-role') === 'user' ? 'user' : 'assistant';
        const contentEl = node.querySelector('.markdown') || node;
        const content = contentEl.innerText.trim();
        if (content) {
            messages.push({ role, content, timestamp: makeTimestamp(index, nodes.length) });
        }
    });
    return messages;
}

// Claude.ai: user turns are [data-testid="user-message"]; assistant turns are .font-claude-response.
function extractClaude() {
    const userNodes = Array.from(document.querySelectorAll('[data-testid="user-message"]')).map(el => ({ el, role: 'user' }));
    const assistantNodes = Array.from(document.querySelectorAll('.font-claude-response')).map(el => ({ el, role: 'assistant' }));
    const turns = userNodes.concat(assistantNodes).sort((a, b) => {
        const pos = a.el.compareDocumentPosition(b.el);
        return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    const messages = [];
    turns.forEach((turn, index) => {
        const content = turn.el.innerText.trim();
        if (content) {
            messages.push({ role: turn.role, content, timestamp: makeTimestamp(index, turns.length) });
        }
    });
    return messages;
}

// Gemini: user turns are <user-query>, assistant turns are <model-response>.
// <user-query> duplicates its text in a visually-hidden a11y label, so read the .query-text-line paragraphs instead.
function extractGemini() {
    const userNodes = Array.from(document.querySelectorAll('user-query')).map(el => ({ el, role: 'user' }));
    const assistantNodes = Array.from(document.querySelectorAll('model-response')).map(el => ({ el, role: 'assistant' }));
    const turns = userNodes.concat(assistantNodes).sort((a, b) => {
        const pos = a.el.compareDocumentPosition(b.el);
        return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    const messages = [];
    turns.forEach((turn, index) => {
        let content;
        if (turn.role === 'user') {
            const lines = turn.el.querySelectorAll('.query-text-line');
            content = lines.length
                ? Array.from(lines).map(l => l.innerText.trim()).join('\n')
                : turn.el.innerText.trim();
        } else {
            const md = turn.el.querySelector('.markdown');
            content = (md || turn.el).innerText.trim();
        }
        if (content) {
            messages.push({ role: turn.role, content, timestamp: makeTimestamp(index, turns.length) });
        }
    });
    return messages;
}

// Fallback for unsupported sites: generic class-name heuristics.
function extractGeneric() {
    const messageSelectors = [
        '.message-container',
        '.chat-message',
        '[data-testid="chat-message"]',
        '.group.w-full.text-token-text-primary',
        '.user-message',
        '[class*="user-msg"]',
        '.assistant-message',
        '.bot-message',
        '[class*="assistant-msg"]',
        '[class*="bot-msg"]',
        'div[class*="message"] > div[class*="content"]',
        'article[class*="message"]',
    ];

    let messageElements = [];
    for (const selector of messageSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            messageElements = Array.from(elements);
            if (selector.includes('user-') || selector.includes('assistant-') || selector.includes('bot-')) {
                break;
            }
        }
    }

    if (messageElements.length === 0) {
        const logElements = document.querySelectorAll('[role="log"] [role="listitem"], [aria-live="polite"] > div, main [role="presentation"] > div > div > div');
        if (logElements.length > 0) {
            messageElements = Array.from(logElements).filter(el => el.textContent.trim().length > 10);
        } else {
            const allDivs = document.querySelectorAll('div');
            messageElements = Array.from(allDivs).filter(div =>
                (/(message|msg|chat|conversation|dialogue|text|content|bubble)/i.test(div.className) &&
                 div.textContent.trim().length > 20 &&
                 div.children.length < 5 &&
                 !div.querySelector('button') && !div.querySelector('input'))
            );
        }
    }

    const messages = [];
    messageElements.forEach((element, index) => {
        let role = 'assistant';
        const classListString = element.classList.toString().toLowerCase();
        const dataRole = element.dataset.role || element.getAttribute('data-author');

        if (dataRole === 'user' || classListString.includes('user') || classListString.includes('sent')) {
            role = 'user';
        } else if (dataRole === 'assistant' || dataRole === 'bot' || classListString.includes('assistant') || classListString.includes('received') || classListString.includes('bot')) {
            role = 'assistant';
        } else {
            let parent = element.parentElement;
            for (let i = 0; i < 3 && parent; i++) {
                const parentClassList = parent.classList.toString().toLowerCase();
                if (parentClassList.includes('user')) { role = 'user'; break; }
                if (parentClassList.includes('assistant') || parentClassList.includes('bot')) { role = 'assistant'; break; }
                parent = parent.parentElement;
            }
        }

        const contentElement = element.querySelector('.content, .message-text, .message-body, [data-testid="message-content"]');
        let content = contentElement ? contentElement.innerText.trim() : element.innerText.trim();
        if (!content && element.querySelector('div > div > div > div[class*="markdown"]')) {
            content = element.querySelector('div > div > div > div[class*="markdown"]').innerText.trim();
        }

        if (content) {
            messages.push({ role, content, timestamp: makeTimestamp(index, messageElements.length) });
        }
    });

    return messages;
}