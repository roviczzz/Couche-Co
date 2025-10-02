// Global variables
let currentConversationId = null;
let currentRecipientId = null;
let messages = [];
// These will be set by the templates on window object
let users = [];
let conversations = [];
let currentUserId = '';
let apiBase = '/admin/messages/api'; // Default will be overridden by templates

// Export the initialization function
export function initMessaging() {
    // Get data from window object set by template
    users = window.users || [];
    conversations = window.conversations || [];
    currentUserId = window.currentUserId || '';
    apiBase = window.apiBase || '/admin/messages/api';

    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        initializeMessaging();
    });
}

function initializeMessaging() {
    // Use pre-loaded data instead of fetching
    populateRecipientSelect();
    renderConversations(conversations);
    setupEventListeners();
    setupAutoRefresh();
}

function setupEventListeners() {
    // Compose modal
    const composeBtn = document.getElementById('composeBtn');
    if (composeBtn) {
        composeBtn.addEventListener('click', openComposeModal);
    }

    const closeComposeModalBtn = document.getElementById('closeComposeModal');
    if (closeComposeModalBtn) {
        closeComposeModalBtn.addEventListener('click', closeComposeModal);
    }

    const cancelComposeBtn = document.getElementById('cancelCompose');
    if (cancelComposeBtn) {
        cancelComposeBtn.addEventListener('click', closeComposeModal);
    }

    // Compose form
    const composeForm = document.getElementById('composeForm');
    if (composeForm) {
        composeForm.addEventListener('submit', handleComposeMessage);
    }

    // Reply modal
    const closeReplyModalBtn = document.getElementById('closeReplyModal');
    if (closeReplyModalBtn) {
        closeReplyModalBtn.addEventListener('click', closeReplyModal);
    }

    const cancelReplyBtn = document.getElementById('cancelReply');
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', closeReplyModal);
    }

    // Reply form
    const replyForm = document.getElementById('replyForm');
    if (replyForm) {
        replyForm.addEventListener('submit', handleReplyMessage);
    }

    // New conversation modal (legacy - make conditional)
    const newConversationBtn = document.getElementById('newConversationBtn');
    if (newConversationBtn) {
        newConversationBtn.addEventListener('click', openNewConversationModal);
    }

    const closeNewConversationModalBtn = document.getElementById('closeNewConversationModal');
    if (closeNewConversationModalBtn) {
        closeNewConversationModalBtn.addEventListener('click', closeNewConversationModal);
    }

    const cancelNewConversationBtn = document.getElementById('cancelNewConversation');
    if (cancelNewConversationBtn) {
        cancelNewConversationBtn.addEventListener('click', closeNewConversationModal);
    }

    // New conversation form
    const newConversationForm = document.getElementById('newConversationForm');
    if (newConversationForm) {
        newConversationForm.addEventListener('submit', handleNewConversation);
    }

    // Format tools
    setupFormatTools();

    // Modal file attachment
    const modalAttachBtn = document.getElementById('modalAttachBtn');
    const modalFileInput = document.getElementById('modalFileInput');
    if (modalAttachBtn && modalFileInput) {
        modalAttachBtn.addEventListener('click', () => modalFileInput.click());
        modalFileInput.addEventListener('change', handleModalFileUpload);
    }

    // Message input (legacy chat interface - may not exist in email view)
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }

    // Send button (legacy chat interface - may not exist in email view)
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    // File upload (legacy chat interface - may not exist in email view)
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }
}

function setupAutoRefresh() {
    // Refresh conversations every 30 seconds
    setInterval(() => {
        loadConversations().catch(error => {
            console.error('Auto-refresh conversations error:', error);
        });
    }, 30000);

    // Refresh messages every 10 seconds if conversation is active
    setInterval(() => {
        if (currentConversationId) {
            loadMessages(currentConversationId).catch(error => {
                console.error('Auto-refresh messages error:', error);
            });
        }
    }, 10000);
}

async function loadUsers() {
    try {
        const response = await fetch(`${apiBase}/users`);
        users = await response.json();
        populateRecipientSelect();
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function populateRecipientSelect() {
    const select = document.getElementById('recipientSelect');
    if (!select) return;

    // Clear existing options except the first one
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }

    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user._id;
        option.textContent = `${user.fullname} (${user.role})`;
        select.appendChild(option);
    });
}

async function loadConversations() {
    try {
        const response = await fetch(`${apiBase}/conversations`);
        const newConversations = await response.json();

        if (response.ok) {
            conversations = newConversations;
            renderConversations(conversations);
        } else {
            console.error('Error loading conversations:', newConversations.error);
        }
    } catch (error) {
        console.error('Error loading conversations:', error);
    }
}

function renderConversations(conversations) {
    const container = document.getElementById('conversationsList');
    if (!container) return;

    if (conversations.length === 0) {
        container.innerHTML = `
            <div class="no-conversations">
                <i class="fas fa-comments"></i>
                <p>No conversations yet</p>
                <small>Start a new conversation to get connected</small>
            </div>
        `;
        return;
    }

    container.innerHTML = conversations.map(conv => `
        <div class="conversation-item ${conv.conversationId === currentConversationId ? 'active' : ''}" onclick="selectConversation('${conv.conversationId}')">
            <div class="conversation-avatar">${getInitials(conv.participantName || 'Unknown')}</div>
            <div class="conversation-info">
                <div class="conversation-name">${conv.participantName || 'Unknown User'}</div>
                <div class="conversation-last-message">${conv.lastMessage || 'Sent an attachment'}</div>
            </div>
            <div class="conversation-time">${formatTime(conv.lastMessageTime)}</div>
        </div>
    `).join('');
}

function selectConversation(conversationId) {
    console.log('selectConversation called with:', conversationId);
    currentConversationId = conversationId;
    console.log('currentConversationId set to:', currentConversationId);

    // Show loading feedback
    const container = document.getElementById('messageView');
    container.innerHTML = `
        <div class="message-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <h3>Loading Message...</h3>
        </div>
    `;

    loadMessages(conversationId);
    loadConversations(); // Refresh to show active state
}

// Export functions to window for onclick handlers
window.selectConversation = selectConversation;
window.openReplyModal = openReplyModal;
window.openImageGallery = openImageGallery;

async function loadMessages(conversationId) {
    try {
        const response = await fetch(`${apiBase}/messages/${conversationId}`);
        const loadedMessages = await response.json();

        if (response.ok) {
            messages = loadedMessages; // Update global messages variable
            renderMessages(messages);
        } else {
            console.error('Error loading messages:', loadedMessages.error);
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function renderMessages(messages) {
    const container = document.getElementById('messageView');

    if (!currentConversationId) {
        container.innerHTML = `
            <div class="message-placeholder">
                <i class="fas fa-envelope-open-text"></i>
                <h3>Select a message</h3>
                <p>Choose a conversation from the inbox to view messages</p>
            </div>
        `;
        return;
    }

    // Find conversation participant
    const conversation = conversations.find(c => c.conversationId === currentConversationId);
    const participantName = conversation ? conversation.participantName : 'Unknown';
    const participant = users.find(u => u._id === conversation?.participantId);

    container.innerHTML = `
        <div class="email-message-thread">
            ${messages.length === 0 ? `
                <div class="no-messages">
                    <p>No messages yet. Start the conversation!</p>
                </div>
            ` : messages.map((msg, index) => renderEmailMessage(msg, index === messages.length - 1)).join('')}
        </div>
        ${messages.length > 0 ? `
            <div class="message-thread-actions">
                <button class="reply-to-conversation-btn" onclick="openReplyModal('${messages[messages.length - 1]._id}')">
                    <i class="fas fa-reply"></i>
                    Reply to Conversation
                </button>
            </div>
        ` : ''}
    `;

    // Scroll to bottom
    const messageThread = container.querySelector('.email-message-thread');
    if (messageThread) {
        messageThread.scrollTop = messageThread.scrollHeight;
    }
}

function renderMessage(message) {
    const isOwn = message.senderId === currentUserId;
    const sender = users.find(u => u._id === message.senderId);
    const senderName = sender ? sender.fullname : (isOwn ? 'You' : 'Unknown');

    return `
        <div class="message ${isOwn ? 'own' : ''}">
            <div class="message-avatar">${getInitials(senderName)}</div>
            <div class="message-content">
                <p class="message-text">${formatMessage(message.content)}</p>
                ${message.attachments ? message.attachments.map(att => `
                    <div class="message-attachment">
                        <i class="fas fa-${getFileIcon(att.mimetype)}"></i>
                        <a href="${att.url || '/uploads/messages/' + att.filename}" target="_blank">${att.originalName}</a>
                    </div>
                `).join('') : ''}
                <div class="message-time">${formatTime(message.timestamp)}</div>
            </div>
        </div>
    `;
}

function setupMessageEventListeners() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const fileInput = document.getElementById('fileInput');

    if (messageInput) {
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
            // Shift+Enter will add a new line (default behavior)
        });

        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;

    const content = messageInput.value.trim();
    if (!content && !attachedFiles.length) return;

    if (!currentConversationId) {
        console.error('No conversation selected');
        alert('Please select a conversation first');
        return;
    }

    console.log('Sending message, currentConversationId:', currentConversationId);
    console.log('currentUserId:', currentUserId);

    try {
        // Parse conversation ID to get recipient
        const [user1, user2] = currentConversationId.split('_');
        console.log('Parsed conversation users:', user1, user2);

        const recipientId = user1 === currentUserId ? user2 : user1;
        console.log('Recipient ID:', recipientId);

        const response = await fetch(`${apiBase}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
                body: JSON.stringify({
                    recipientId: recipientId,
                    content: content,
                    attachments: attachedFiles
                })
        });

        const result = await response.json();
        console.log('Send message response:', result);

        if (response.ok) {
            attachedFiles = [];
            messageInput.value = '';
            messageInput.style.height = 'auto';

            // Reload messages and conversations
            loadMessages(currentConversationId);
            loadConversations();
        } else {
            console.error('Error sending message:', result.error);
            alert('Failed to send message. Please try again.');
        }

    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

let attachedFiles = [];

async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Check file sizes (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = files.filter(file => file.size > maxSize);

    if (oversizedFiles.length > 0) {
        alert(`Some files are too large. Maximum file size is 10MB.`);
        e.target.value = '';
        return;
    }

    try {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });

        const response = await fetch(`${apiBase}/upload`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            attachedFiles = result.files;
            updateAttachedFilesDisplay();
        } else {
            console.error('Error uploading files:', result.error);
            alert('Failed to upload files. Please try again.');
        }
    } catch (error) {
        console.error('Error uploading files:', error);
        alert('Failed to upload files. Please try again.');
    }

    // Clear the file input
    e.target.value = '';
}

function updateAttachedFilesDisplay() {
    const container = document.querySelector('.chat-input-area');
    if (!container) return;

    // Remove existing attachment preview
    const existingPreview = container.querySelector('.attachment-preview');
    if (existingPreview) {
        existingPreview.remove();
    }

    if (attachedFiles.length === 0) return;

    // Create attachment preview
    const preview = document.createElement('div');
    preview.className = 'attachment-preview';
    preview.innerHTML = `
        <div class="attachment-list">
            ${attachedFiles.map((file, index) => `
                <div class="attachment-item">
                    <i class="fas fa-${getFileIcon(file.mimetype)}"></i>
                    <span class="attachment-name">${file.originalName}</span>
                    <button type="button" class="attachment-remove" onclick="removeAttachment(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('')}
        </div>
    `;

    // Insert before the chat form
    const chatForm = container.querySelector('.chat-form');
    if (chatForm) {
        container.insertBefore(preview, chatForm);
    }
}

function removeAttachment(index) {
    attachedFiles.splice(index, 1);
    updateAttachedFilesDisplay();
}

function openNewConversationModal() {
    document.getElementById('newConversationModal').classList.add('show');
}

function closeNewConversationModal() {
    document.getElementById('newConversationModal').classList.remove('show');
    document.getElementById('newConversationForm').reset();
    // Clear modal attachments
    modalAttachedFiles = [];
    updateModalAttachmentPreview();
}

let modalAttachedFiles = [];

function setupFormatTools() {
    // Setup compose modal format tools
    const composeFormatButtons = document.querySelectorAll('#composeModal .format-btn');
    const composeTextarea = document.getElementById('messageTextarea');

    composeFormatButtons.forEach(button => {
        button.addEventListener('click', function() {
            const format = this.getAttribute('data-format');
            applyFormatting(composeTextarea, format);
        });
    });

    // Setup reply modal format tools
    const replyFormatButtons = document.querySelectorAll('#replyModal .format-btn');
    const replyTextarea = document.getElementById('replyTextarea');

    replyFormatButtons.forEach(button => {
        button.addEventListener('click', function() {
            const format = this.getAttribute('data-format');
            applyFormatting(replyTextarea, format);
        });
    });

    // Setup legacy modal format tools
    const modalFormatButtons = document.querySelectorAll('#newConversationModal .format-btn');
    const modalTextarea = document.getElementById('initialMessage');

    modalFormatButtons.forEach(button => {
        button.addEventListener('click', function() {
            const format = this.getAttribute('data-format');
            applyFormatting(modalTextarea, format);
        });
    });

    // Setup chat format tools (will be set up when chat is rendered)
    setupChatFormatTools();
}

function setupChatFormatTools() {
    const chatFormatButtons = document.querySelectorAll('.chat-format-tools .format-btn');
    const chatTextarea = document.getElementById('messageInput');

    chatFormatButtons.forEach(button => {
        button.addEventListener('click', function() {
            const format = this.getAttribute('data-format');
            applyFormatting(chatTextarea, format);
        });
    });
}

function applyFormatting(textarea, format) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    let replacement = '';

    switch (format) {
        case 'bold':
            replacement = `**${selectedText || 'bold text'}**`;
            break;
        case 'italic':
            replacement = `*${selectedText || 'italic text'}*`;
            break;
        case 'underline':
            replacement = `<u>${selectedText || 'underlined text'}</u>`;
            break;
        case 'list':
            replacement = selectedText ? `• ${selectedText}` : '• List item';
            break;
        case 'link':
            replacement = `[${selectedText || 'link text'}](url)`;
            break;
    }

    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    textarea.focus();
    textarea.setSelectionRange(start + replacement.length, start + replacement.length);
}


async function handleModalFileUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Check file sizes (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = files.filter(file => file.size > maxSize);

    if (oversizedFiles.length > 0) {
        alert(`Some files are too large. Maximum file size is 10MB.`);
        e.target.value = '';
        return;
    }

    try {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });

        const response = await fetch(`${apiBase}/upload`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            modalAttachedFiles = result.files;
            updateModalAttachmentPreview();
        } else {
            console.error('Error uploading files:', result.error);
            alert('Failed to upload files. Please try again.');
        }
    } catch (error) {
        console.error('Error uploading files:', error);
        alert('Failed to upload files. Please try again.');
    }

    // Clear the file input
    e.target.value = '';
}

function updateModalAttachmentPreview() {
    const preview = document.getElementById('modalAttachmentPreview');

    if (modalAttachedFiles.length === 0) {
        preview.style.display = 'none';
        return;
    }

    preview.style.display = 'block';
    preview.innerHTML = `
        <div class="attachment-list">
            ${modalAttachedFiles.map((file, index) => `
                <div class="attachment-item">
                    <i class="fas fa-${getFileIcon(file.mimetype)}"></i>
                    <span class="attachment-name">${file.originalName}</span>
                    <button type="button" class="attachment-remove" onclick="removeModalAttachment(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

function removeModalAttachment(index) {
    modalAttachedFiles.splice(index, 1);
    updateModalAttachmentPreview();
}

async function handleNewConversation(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const recipientId = formData.get('recipientId');
    const message = formData.get('message');

    if (!recipientId || (!message.trim() && modalAttachedFiles.length === 0)) return;

    console.log('Creating new conversation with recipient:', recipientId);

    try {
        const response = await fetch(`${apiBase}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipientId: recipientId,
                content: message,
                attachments: modalAttachedFiles
            })
        });

        const result = await response.json();
        console.log('New conversation response:', result);

        if (response.ok) {
            closeNewConversationModal();

            // Reload conversations and select the new one
            await loadConversations();
            console.log('Conversations after reload:', conversations);

            // Find the conversation that was just created
            const newConversation = conversations.find(conv => conv.participantId === recipientId);
            console.log('New conversation found:', newConversation);

            if (newConversation) {
                selectConversation(newConversation.conversationId);
            } else {
                // If conversation not found immediately, wait a bit and try again
                setTimeout(async () => {
                    await loadConversations();
                    const retryConversation = conversations.find(conv => conv.participantId === recipientId);
                    if (retryConversation) {
                        selectConversation(retryConversation.conversationId);
                    }
                }, 500);
            }
        } else {
            console.error('Error creating conversation:', result.error);
            alert('Failed to start conversation. Please try again.');
        }

    } catch (error) {
        console.error('Error creating conversation:', error);
        alert('Failed to start conversation. Please try again.');
    }
}

// Utility functions
function getInitials(name) {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(timestamp) {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

    return date.toLocaleDateString();
}

function formatLastLogin(lastLogin) {
    if (!lastLogin) return 'Unknown';

    const date = new Date(lastLogin);
    const now = new Date();
    const diff = now - date;

    // If last login was less than 5 minutes ago, show as "Active now"
    if (diff < 300000) return 'Active now';

    // If last login was today, show time
    if (date.toDateString() === now.toDateString()) {
        return `today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    // If last login was yesterday, show "yesterday"
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return `yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    // If last login was within the last week, show day name
    if (diff < 604800000) { // 7 days
        return date.toLocaleDateString([], { weekday: 'long' });
    }

    // Otherwise show the date
    return date.toLocaleDateString();
}

function formatMessage(content) {
    // Simple message formatting - convert line breaks and basic markdown
    return content
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1');
}

function getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'music';
    if (mimeType === 'application/pdf') return 'file-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'file-excel';
    return 'file';
}


function openComposeModal() {
    document.getElementById('composeModal').classList.add('show');
    // Reset form
    document.getElementById('composeForm').reset();
    // Clear attachments
    composeAttachedFiles = [];
    updateComposeAttachmentPreview();
}

function closeComposeModal() {
    document.getElementById('composeModal').classList.remove('show');
    document.getElementById('composeForm').reset();
    // Clear attachments
    composeAttachedFiles = [];
    updateComposeAttachmentPreview();
}

async function handleComposeMessage(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const recipientId = formData.get('recipientId');
    const subject = formData.get('subject');
    const message = formData.get('message');

    if (!recipientId) {
        alert('Please select a recipient');
        return;
    }
    if (!subject.trim()) {
        alert('Please enter a subject');
        return;
    }
    if (!message.trim() && composeAttachedFiles.length === 0) {
        alert('Please enter a message or attach a file');
        return;
    }

    try {
        const response = await fetch(`${apiBase}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipientId: recipientId,
                subject: subject,
                content: message,
                attachments: composeAttachedFiles
            })
        });

        const result = await response.json();

        if (response.ok) {
            closeComposeModal();
            // Reload conversations and select the new one
            await loadConversations();
            const newConversation = conversations.find(conv => conv.participantId === recipientId);
            if (newConversation) {
                selectConversation(newConversation.conversationId);
            }
        } else {
            alert('Failed to send message. Please try again.');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

function openReplyModal(messageId) {
    const message = messages.find(msg => msg._id === messageId);
    if (!message) return;

    // Set up reply form
    const replyRecipient = document.getElementById('replyRecipient');
    const replySubject = document.getElementById('replySubject');
    const replyQuote = document.getElementById('replyQuote');

    if (replyRecipient) {
        const sender = users.find(u => u._id === message.senderId);
        replyRecipient.textContent = sender ? `${sender.fullname} (${sender.role})` : 'Unknown User';
    }

    if (replySubject) {
        const currentSubject = message.subject || 'No Subject';
        replySubject.value = currentSubject.startsWith('Re: ') ? currentSubject : `Re: ${currentSubject}`;
    }

    if (replyQuote) {
        const sender = users.find(u => u._id === message.senderId);
        const senderName = sender ? sender.fullname : 'Unknown User';
        replyQuote.innerHTML = `
            <strong>On ${formatTime(message.timestamp)}, ${senderName} wrote:</strong><br>
            <blockquote style="margin: 8px 0; padding: 8px 12px; background: #f8f9fa; border-left: 3px solid #a05c2f;">
                ${message.content.replace(/\n/g, '<br>')}
            </blockquote>
        `;
    }

    // Clear attachments
    replyAttachedFiles = [];
    updateReplyAttachmentPreview();

    document.getElementById('replyModal').classList.add('show');
}

function closeReplyModal() {
    document.getElementById('replyModal').classList.remove('show');
    document.getElementById('replyForm').reset();
    // Clear attachments
    replyAttachedFiles = [];
    updateReplyAttachmentPreview();
}

async function handleReplyMessage(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const subject = formData.get('subject');
    const message = formData.get('message');

    if (!subject.trim()) {
        alert('Please enter a subject');
        return;
    }
    if (!message.trim() && replyAttachedFiles.length === 0) {
        alert('Please enter a message or attach a file');
        return;
    }

    if (!currentConversationId) {
        alert('No conversation selected');
        return;
    }

    try {
        // Parse conversation ID to get recipient
        const [user1, user2] = currentConversationId.split('_');
        const recipientId = user1 === currentUserId ? user2 : user1;

        const response = await fetch(`${apiBase}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipientId: recipientId,
                subject: subject,
                content: message,
                attachments: replyAttachedFiles
            })
        });

        const result = await response.json();

        if (response.ok) {
            closeReplyModal();
            // Reload messages
            loadMessages(currentConversationId);
            loadConversations();
        } else {
            alert('Failed to send reply. Please try again.');
        }
    } catch (error) {
        console.error('Error sending reply:', error);
        alert('Failed to send reply. Please try again.');
    }
}

function renderEmailMessage(message, isLastMessage) {
    const isOwn = message.senderId === currentUserId;
    const sender = users.find(u => u._id === message.senderId);
    const senderName = sender ? sender.fullname : (isOwn ? 'You' : 'Unknown');
    const displayId = sender ? sender.staffId : '';

    let attachmentHtml = '';
    if (message.attachments && message.attachments.length > 0) {
        attachmentHtml = '\n                <div class="email-message-attachments">\n                    <h4><i class="fas fa-paperclip"></i> Attachments (' + message.attachments.length + ')</h4>\n                    <div class="attachment-list">' +
            message.attachments.map((att, index) => {
                const isImage = att.mimetype && att.mimetype.startsWith('image/');
                const imageUrl = att.url || '/uploads/messages/' + att.filename;
                if (isImage) {
                    return '\n                                    <div class="attachment-item image-preview" onclick="openImageGallery(\'' + message._id + '\', ' + index + ')">\n                                        <img src="' + imageUrl + '" alt="' + att.originalName + '" class="attachment-thumbnail" />\n                                        <div class="attachment-overlay">\n                                            <i class="fas fa-expand"></i>\n                                        </div>\n                                    </div>\n                                ';
                } else {
                    return '\n                                    <div class="attachment-item">\n                                        <i class="fas fa-' + getFileIcon(att.mimetype) + '"></i>\n                                        <a href="' + imageUrl + '" target="_blank" class="attachment-name">' + att.originalName + '</a>\n                                        <a href="' + imageUrl + '" target="_blank" class="attachment-download">\n                                            <i class="fas fa-download"></i>\n                                        </a>\n                                    </div>\n                                ';
                }
            }).join('') + '\n                    </div>\n                </div>\n            ';
    }

    const replyButton = !isOwn ? '\n                <button class="email-reply-btn" onclick="openReplyModal(\'' + message._id + '\')">\n                    <i class="fas fa-reply"></i>\n                    Reply\n                </button>\n            ' : '';

    return `
        <div class="email-message">
            <div class="email-message-header">
                <div class="email-message-avatar">${getInitials(senderName)}</div>
                <div class="email-message-info">
                    <div class="email-message-sender">${senderName}</div>
                    <div class="email-message-staff-id" style="font-size: 12px; color: #666; margin-top: 2px;">ID: ${displayId}</div>
                    <div class="email-message-time">${formatTime(message.timestamp)}</div>
                </div>
            </div>
            ${message.subject ? '<div class="email-message-subject">' + message.subject + '</div>' : ''}
            <div class="email-message-content">${(message.content && message.content.trim()) || (message.attachments && message.attachments.length > 0 ? 'Sent an attachment' : '&nbsp;')}</div>
            ${attachmentHtml}
            ${replyButton}
        </div>
    `;
}

// Compose modal attachment handling
let composeAttachedFiles = [];

function updateComposeAttachmentPreview() {
    const preview = document.getElementById('composeAttachmentPreview');

    if (composeAttachedFiles.length === 0) {
        preview.style.display = 'none';
        return;
    }

    preview.style.display = 'block';
    preview.innerHTML = `
        <div class="attachment-list">
            ${composeAttachedFiles.map((file, index) => `
                <div class="attachment-item">
                    <i class="fas fa-${getFileIcon(file.mimetype)}"></i>
                    <span class="attachment-name">${file.originalName}</span>
                    <button type="button" class="attachment-remove" onclick="removeComposeAttachment(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

function removeComposeAttachment(index) {
    composeAttachedFiles.splice(index, 1);
    updateComposeAttachmentPreview();
}

// Reply modal attachment handling
let replyAttachedFiles = [];

function updateReplyAttachmentPreview() {
    const preview = document.getElementById('replyAttachmentPreview');

    if (replyAttachedFiles.length === 0) {
        preview.style.display = 'none';
        return;
    }

    preview.style.display = 'block';
    preview.innerHTML = `
        <div class="attachment-list">
            ${replyAttachedFiles.map((file, index) => `
                <div class="attachment-item">
                    <i class="fas fa-${getFileIcon(file.mimetype)}"></i>
                    <span class="attachment-name">${file.originalName}</span>
                    <button type="button" class="attachment-remove" onclick="removeReplyAttachment(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

function removeReplyAttachment(index) {
    replyAttachedFiles.splice(index, 1);
    updateReplyAttachmentPreview();
}

// Event listeners for compose and reply attachments
document.addEventListener('DOMContentLoaded', function() {
    // Compose attachments
    const composeAttachBtn = document.getElementById('composeAttachBtn');
    const composeFileInput = document.getElementById('composeFileInput');
    if (composeAttachBtn && composeFileInput) {
        composeAttachBtn.addEventListener('click', () => composeFileInput.click());
        composeFileInput.addEventListener('change', handleComposeFileUpload);
    }

    // Reply attachments
    const replyAttachBtn = document.getElementById('replyAttachBtn');
    const replyFileInput = document.getElementById('replyFileInput');
    if (replyAttachBtn && replyFileInput) {
        replyAttachBtn.addEventListener('click', () => replyFileInput.click());
        replyFileInput.addEventListener('change', handleReplyFileUpload);
    }
});

async function handleComposeFileUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Check file sizes (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = files.filter(file => file.size > maxSize);

    if (oversizedFiles.length > 0) {
        alert(`Some files are too large. Maximum file size is 10MB.`);
        e.target.value = '';
        return;
    }

    try {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });

        const response = await fetch(`${apiBase}/upload`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            composeAttachedFiles = result.files;
            updateComposeAttachmentPreview();
        } else {
            alert('Failed to upload files. Please try again.');
        }
    } catch (error) {
        console.error('Error uploading files:', error);
        alert('Failed to upload files. Please try again.');
    }

    // Clear the file input
    e.target.value = '';
}

async function handleReplyFileUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Check file sizes (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = files.filter(file => file.size > maxSize);

    if (oversizedFiles.length > 0) {
        alert(`Some files are too large. Maximum file size is 10MB.`);
        e.target.value = '';
        return;
    }

    try {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });

        const response = await fetch(`${apiBase}/upload`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            replyAttachedFiles = result.files;
            updateReplyAttachmentPreview();
        } else {
            alert('Failed to upload files. Please try again.');
        }
    } catch (error) {
        console.error('Error uploading files:', error);
        alert('Failed to upload files. Please try again.');
    }

    // Clear the file input
    e.target.value = '';
}

// Image Gallery functionality
let currentGalleryImages = [];
let currentGalleryIndex = 0;

function openImageGallery(messageId, startIndex) {
    const message = messages.find(msg => msg._id === messageId);
    if (!message) return;

    const attachments = message.attachments.map(a => ({ url: a.url || '/uploads/messages/' + a.filename, name: a.originalName, isImage: a.mimetype && a.mimetype.startsWith('image/') }));

    // Filter only images from attachments
    currentGalleryImages = attachments.filter(att => att.isImage);
    currentGalleryIndex = startIndex;

    if (currentGalleryImages.length === 0) return;

    // Update modal content
    const galleryImage = document.getElementById('galleryImage');
    const galleryCounter = document.getElementById('galleryCounter');
    const galleryFilename = document.getElementById('galleryFilename');

    galleryImage.src = currentGalleryImages[currentGalleryIndex].url;
    galleryImage.alt = currentGalleryImages[currentGalleryIndex].name;
    galleryCounter.textContent = `${currentGalleryIndex + 1} / ${currentGalleryImages.length}`;
    galleryFilename.textContent = currentGalleryImages[currentGalleryIndex].name;

    // Show/hide navigation buttons
    const galleryPrev = document.getElementById('galleryPrev');
    const galleryNext = document.getElementById('galleryNext');

    galleryPrev.style.display = currentGalleryImages.length > 1 ? 'block' : 'none';
    galleryNext.style.display = currentGalleryImages.length > 1 ? 'block' : 'none';

    // Show modal
    document.getElementById('imageGalleryModal').classList.add('show');

    // Setup navigation event listeners
    galleryPrev.onclick = () => navigateGallery(-1);
    galleryNext.onclick = () => navigateGallery(1);

    // Keyboard navigation
    document.addEventListener('keydown', handleGalleryKeydown);
}

function navigateGallery(direction) {
    currentGalleryIndex += direction;

    if (currentGalleryIndex < 0) {
        currentGalleryIndex = currentGalleryImages.length - 1;
    } else if (currentGalleryIndex >= currentGalleryImages.length) {
        currentGalleryIndex = 0;
    }

    const galleryImage = document.getElementById('galleryImage');
    const galleryCounter = document.getElementById('galleryCounter');
    const galleryFilename = document.getElementById('galleryFilename');

    galleryImage.src = currentGalleryImages[currentGalleryIndex].url;
    galleryImage.alt = currentGalleryImages[currentGalleryIndex].name;
    galleryCounter.textContent = `${currentGalleryIndex + 1} / ${currentGalleryImages.length}`;
    galleryFilename.textContent = currentGalleryImages[currentGalleryIndex].name;
}

function handleGalleryKeydown(e) {
    if (!document.getElementById('imageGalleryModal').classList.contains('show')) return;

    switch (e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            navigateGallery(-1);
            break;
        case 'ArrowRight':
            e.preventDefault();
            navigateGallery(1);
            break;
        case 'Escape':
            e.preventDefault();
            closeImageGalleryModal();
            break;
    }
}

function closeImageGalleryModal() {
    document.getElementById('imageGalleryModal').classList.remove('show');
    document.removeEventListener('keydown', handleGalleryKeydown);
    currentGalleryImages = [];
    currentGalleryIndex = 0;
}

// Setup image gallery modal event listeners
document.addEventListener('DOMContentLoaded', function() {
    const closeGalleryBtn = document.getElementById('closeImageGalleryModal');
    if (closeGalleryBtn) {
        closeGalleryBtn.addEventListener('click', closeImageGalleryModal);
    }

    // Close modal when clicking outside
    const galleryModal = document.getElementById('imageGalleryModal');
    if (galleryModal) {
        galleryModal.addEventListener('click', function(e) {
            if (e.target === galleryModal) {
                closeImageGalleryModal();
            }
        });
    }
});
