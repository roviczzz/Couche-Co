console.log('messages.js loaded');

let currentConversationId = null;
let currentRecipientId = null;
let messages = [];
let users = [];
let conversations = [];
let currentUserId = '';
let apiBase = '/admin/messages/api';

let attachedFiles = [];
let modalAttachedFiles = [];
let composeAttachedFiles = [];
let replyAttachedFiles = [];

let currentGalleryImages = [];
let currentGalleryIndex = 0;

function createToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type = 'info', duration = 5000) {
    const container = createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? 'fas fa-check-circle' :
                 type === 'error' ? 'fas fa-exclamation-circle' :
                 type === 'warning' ? 'fas fa-exclamation-triangle' : 'fas fa-info-circle';

    toast.innerHTML = `
        <i class="${icon} toast-icon"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }, duration);
}

function formatMessageContent(content) {
    if (!content) return '';
    
    let formatted = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/&lt;u&gt;(.+?)&lt;\/u&gt;/g, '<u>$1</u>');
    formatted = formatted.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    formatted = formatted.replace(/^• (.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

function formatMessage(content) {
    return formatMessageContent(content);
}

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

function getFileIcon(mimeType) {
    if (!mimeType) return 'file';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'music';
    if (mimeType === 'application/pdf') return 'file-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'file-excel';
    return 'file';
}

export function initMessaging() {
    users = window.users || [];
    conversations = window.conversations || [];
    currentUserId = window.currentUserId || '';
    apiBase = window.apiBase || '/admin/messages/api';

    document.addEventListener('submit', (e) => {
        if (e.target.id !== 'composeForm' && e.target.id !== 'replyForm' && e.target.id !== 'newConversationForm') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }, true);

    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' && !e.target.target) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeMessaging);
    } else {
        initializeMessaging();
    }
}

function initializeMessaging() {
    populateRecipientSelect();
    renderConversations(conversations);
    
    setTimeout(() => {
        setupEventListeners();
    }, 100);
    
    setupAutoRefresh();
}

function setupEventListeners() {
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
        cancelComposeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeComposeModal();
        });
    }

    const composeForm = document.getElementById('composeForm');
    if (composeForm) {
        composeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleComposeMessage(e);
            return false;
        });
    }

    const closeReplyModalBtn = document.getElementById('closeReplyModal');
    if (closeReplyModalBtn) {
        closeReplyModalBtn.addEventListener('click', closeReplyModal);
    }

    const cancelReplyBtn = document.getElementById('cancelReply');
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeReplyModal();
        });
    }

    const replyForm = document.getElementById('replyForm');
    if (replyForm) {
        replyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleReplyMessage(e);
            return false;
        });
    }

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
        cancelNewConversationBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeNewConversationModal();
        });
    }

    const newConversationForm = document.getElementById('newConversationForm');
    if (newConversationForm) {
        newConversationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleNewConversation(e);
            return false;
        });
    }

    setupFormatTools();
    setupAttachmentHandlers();
    setupImageGallery();

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

    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }
}

function setupAttachmentHandlers() {
    const composeAttachBtn = document.getElementById('composeAttachBtn');
    if (composeAttachBtn) {
        composeAttachBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            openFileDialog('compose');
            return false;
        });
    }

    const replyAttachBtn = document.getElementById('replyAttachBtn');
    if (replyAttachBtn) {
        replyAttachBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            openFileDialog('reply');
            return false;
        });
    }

    const modalAttachBtn = document.getElementById('modalAttachBtn');
    if (modalAttachBtn) {
        modalAttachBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            openFileDialog('modal');
            return false;
        });
    }
}

function openFileDialog(type) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';
    input.style.visibility = 'hidden';
    input.style.position = 'fixed';
    input.style.top = '-9999px';
    input.style.left = '-9999px';

    let handled = false;

    input.addEventListener('change', async (e) => {
        if (handled) return;
        handled = true;
        
        try {
            const files = Array.from(input.files || []);
            if (files.length === 0) return;

            const uploaded = await uploadFiles(files);
            
            if (uploaded) {
                if (type === 'compose') {
                    composeAttachedFiles = [...composeAttachedFiles, ...uploaded];
                    updateComposeAttachmentPreview();
                } else if (type === 'reply') {
                    replyAttachedFiles = [...replyAttachedFiles, ...uploaded];
                    updateReplyAttachmentPreview();
                } else if (type === 'modal') {
                    modalAttachedFiles = [...modalAttachedFiles, ...uploaded];
                    updateModalAttachmentPreview();
                }
            }
        } finally {
            document.body.removeChild(input);
        }
    }, { once: true });

    document.body.appendChild(input);
    input.click();
}

function setupImageGallery() {
    const closeGalleryBtn = document.getElementById('closeImageGalleryModal');
    if (closeGalleryBtn) {
        closeGalleryBtn.addEventListener('click', closeImageGalleryModal);
    }

    const galleryModal = document.getElementById('imageGalleryModal');
    if (galleryModal) {
        galleryModal.addEventListener('click', function(e) {
            if (e.target === galleryModal) {
                closeImageGalleryModal();
            }
        });
    }
}

function setupAutoRefresh() {
    setInterval(() => {
        loadConversations().catch(console.error);
    }, 30000);

    setInterval(() => {
        if (currentConversationId) {
            loadMessages(currentConversationId).catch(console.error);
        }
    }, 10000);
}

function populateRecipientSelect() {
    const selects = [
        document.getElementById('recipientSelect'),
        document.getElementById('newConversationRecipientSelect')
    ];

    selects.forEach(select => {
        if (!select) return;

        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }

        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user._id;
            option.textContent = `${user.fullname} (${user.role})`;
            select.appendChild(option);
        });
    });
}

async function loadConversations() {
    try {
        const response = await fetch(`${apiBase}/conversations`);
        const newConversations = await response.json();

        if (response.ok) {
            conversations = newConversations;
            renderConversations(conversations);
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
                <div class="conversation-name">${conv.participantName || 'Unknown User'} ${conv.unreadCount > 0 ? '<span class="unread-badge">' + (conv.unreadCount > 99 ? '99+' : conv.unreadCount) + '</span>' : ''}</div>
                <div class="conversation-last-message">${conv.lastMessage ? formatMessage(conv.lastMessage) : 'Sent an attachment'}</div>
            </div>
            <div class="conversation-time">${formatTime(conv.lastMessageTime)}</div>
        </div>
    `).join('');
}

async function updateSidebarBadge() {
    try {
        const response = await fetch(`${apiBase}/unread-count`);
        if (response.ok) {
            const data = await response.json();
            const badge = document.getElementById('messages-badge');
            if (badge) {
                if (data.unreadCount > 0) {
                    badge.textContent = data.unreadCount > 99 ? '99+' : data.unreadCount;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    } catch (error) {
        console.error('Error fetching unread count:', error);
    }
}

function selectConversation(conversationId) {
    currentConversationId = conversationId;

    // Add class for mobile view toggling
    const emailGrid = document.querySelector('.email-grid');
    if (emailGrid) {
        emailGrid.classList.add('mobile-view-active');
    }

    const container = document.getElementById('messageView');
    container.innerHTML = `
        <div class="message-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <h3>Loading Message...</h3>
        </div>
    `;

    loadMessages(conversationId).then(() => {
        loadConversations();
        updateSidebarBadge();
    });
}

function closeMessageView() {
    const emailGrid = document.querySelector('.email-grid');
    if (emailGrid) {
        emailGrid.classList.remove('mobile-view-active');
    }
    currentConversationId = null;
    
    // Reset message view to placeholder
    const container = document.getElementById('messageView');
    if (container) {
        container.innerHTML = `
            <div class="message-placeholder">
                <i class="fas fa-envelope-open-text"></i>
                <h3>Select a message</h3>
                <p>Choose a conversation from the inbox to view messages</p>
            </div>
        `;
    }
    
    // Remove active class from conversation items
    const activeItems = document.querySelectorAll('.conversation-item.active');
    activeItems.forEach(item => item.classList.remove('active'));
}

window.selectConversation = selectConversation;
window.closeMessageView = closeMessageView;
window.openReplyModal = openReplyModal;
window.openImageGallery = openImageGallery;
window.removeComposeAttachment = removeComposeAttachment;
window.removeReplyAttachment = removeReplyAttachment;
window.removeModalAttachment = removeModalAttachment;
window.removeAttachment = removeAttachment;

async function loadMessages(conversationId) {
    try {
        const response = await fetch(`${apiBase}/messages/${conversationId}`);
        const loadedMessages = await response.json();

        if (response.ok) {
            messages = loadedMessages;
            renderMessages(messages);
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

    container.innerHTML = `
        <div class="message-view-header mobile-only" style="display: none; padding: 10px; border-bottom: 1px solid #eee; margin-bottom: 10px;">
            <button class="btn-back" onclick="closeMessageView()" style="background: none; border: none; font-size: 16px; color: #333; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-arrow-left"></i> Back to Inbox
            </button>
        </div>
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

    const messageThread = container.querySelector('.email-message-thread');
    if (messageThread) {
        messageThread.scrollTop = messageThread.scrollHeight;
    }
}

function renderEmailMessage(message, isLastMessage) {
    const isOwn = message.senderId === currentUserId;
    const conversation = conversations.find(c => c.conversationId === currentConversationId);
    const participant = users.find(u => u._id === conversation?.participantId);
    const recipientName = participant ? participant.fullname : (conversation?.participantName || 'Unknown');
    const displayId = participant ? participant.staffId : '';

    let attachmentHtml = '';
    if (message.attachments && message.attachments.length > 0) {
        attachmentHtml = `
            <div class="email-message-attachments">
                <h4><i class="fas fa-paperclip"></i> Attachments (${message.attachments.length})</h4>
                <div class="attachment-list">
                    ${message.attachments.map((att, index) => {
                        const isImage = att.mimetype && att.mimetype.startsWith('image/');
                        const imageUrl = att.url || '/uploads/messages/' + att.filename;
                        if (isImage) {
                            return `
                                <div class="attachment-item image-preview" onclick="openImageGallery('${message._id}', ${index})">
                                    <img src="${imageUrl}" alt="${att.originalName}" class="attachment-thumbnail" />
                                    <div class="attachment-overlay">
                                        <i class="fas fa-expand"></i>
                                    </div>
                                </div>
                            `;
                        } else {
                            return `
                                <div class="attachment-item">
                                    <i class="fas fa-${getFileIcon(att.mimetype)}"></i>
                                    <a href="${imageUrl}" target="_blank" class="attachment-name">${att.originalName}</a>
                                    <a href="${imageUrl}" target="_blank" class="attachment-download">
                                        <i class="fas fa-download"></i>
                                    </a>
                                </div>
                            `;
                        }
                    }).join('')}
                </div>
            </div>
        `;
    }

    const replyButton = !isOwn ? `
        <button class="email-reply-btn" onclick="openReplyModal('${message._id}')">
            <i class="fas fa-reply"></i>
            Reply
        </button>
    ` : '';

    return `
        <div class="email-message">
            <div class="email-message-header">
                <div class="email-message-avatar">${getInitials(recipientName)}</div>
                <div class="email-message-info">
                    <div class="email-message-sender">${recipientName}</div>
                    <div class="email-message-staff-id" style="font-size: 12px; color: #666; margin-top: 2px;">ID: ${displayId}</div>
                    <div class="email-message-time">${formatTime(message.timestamp)}</div>
                </div>
            </div>
            ${message.subject ? '<div class="email-message-subject">' + message.subject + '</div>' : ''}
            <div class="email-message-content">${(message.content && message.content.trim()) ? formatMessageContent(message.content) : (message.attachments && message.attachments.length > 0 ? 'Sent an attachment' : '&nbsp;')}</div>
            ${attachmentHtml}
            ${replyButton}
        </div>
    `;
}

function setupFormatTools() {
    const composeFormatButtons = document.querySelectorAll('#composeModal .format-btn');
    const composeTextarea = document.getElementById('messageTextarea');

    composeFormatButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const format = this.getAttribute('data-format');
            applyFormatting(composeTextarea, format);
        });
    });

    const replyFormatButtons = document.querySelectorAll('#replyModal .format-btn');
    const replyTextarea = document.getElementById('replyTextarea');

    replyFormatButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const format = this.getAttribute('data-format');
            applyFormatting(replyTextarea, format);
        });
    });

    const modalFormatButtons = document.querySelectorAll('#newConversationModal .format-btn');
    const modalTextarea = document.getElementById('initialMessage');

    modalFormatButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const format = this.getAttribute('data-format');
            applyFormatting(modalTextarea, format);
        });
    });

    const chatFormatButtons = document.querySelectorAll('.chat-format-tools .format-btn');
    const chatTextarea = document.getElementById('messageInput');

    chatFormatButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const format = this.getAttribute('data-format');
            applyFormatting(chatTextarea, format);
        });
    });
}

function applyFormatting(textarea, format) {
    if (!textarea) return;
    
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
        default:
            return;
    }

    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    textarea.focus();
    textarea.setSelectionRange(start + replacement.length, start + replacement.length);
}

function openComposeModal() {
    const modal = document.getElementById('composeModal');
    if (modal) {
        modal.classList.add('show');
    }
    const form = document.getElementById('composeForm');
    if (form) {
        form.reset();
    }
    composeAttachedFiles = [];
    updateComposeAttachmentPreview();
}

function closeComposeModal() {
    const modal = document.getElementById('composeModal');
    if (modal) {
        modal.classList.remove('show');
    }
    const form = document.getElementById('composeForm');
    if (form) {
        form.reset();
    }
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
        showToast('Please select a recipient', 'error');
        return;
    }
    if (!subject.trim()) {
        showToast('Please enter a subject', 'error');
        return;
    }
    if (!message.trim() && composeAttachedFiles.length === 0) {
        showToast('Please enter a message or attach a file', 'error');
        return;
    }

    try {
        const response = await fetch(`${apiBase}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId,
                subject,
                content: message,
                attachments: composeAttachedFiles
            })
        });

        const result = await response.json();

        if (response.ok) {
            showToast('Message sent successfully!', 'success');
            closeComposeModal();
            await loadConversations();
            const newConversation = conversations.find(conv => conv.participantId === recipientId);
            if (newConversation) {
                selectConversation(newConversation.conversationId);
            }
        } else {
            showToast('Failed to send message. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message. Please try again.', 'error');
    }
}

function openReplyModal(messageId) {
    const message = messages.find(msg => msg._id === messageId);
    if (!message) return;

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
                ${formatMessage(message.content)}
            </blockquote>
        `;
    }

    replyAttachedFiles = [];
    updateReplyAttachmentPreview();

    document.getElementById('replyModal').classList.add('show');
}

function closeReplyModal() {
    document.getElementById('replyModal').classList.remove('show');
    document.getElementById('replyForm').reset();
    replyAttachedFiles = [];
    updateReplyAttachmentPreview();
}

async function handleReplyMessage(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const subject = formData.get('subject');
    const message = formData.get('message');

    if (!subject.trim()) {
        showToast('Please enter a subject', 'error');
        return;
    }
    if (!message.trim() && replyAttachedFiles.length === 0) {
        showToast('Please enter a message or attach a file', 'error');
        return;
    }

    if (!currentConversationId) {
        showToast('No conversation selected', 'error');
        return;
    }

    try {
        const [user1, user2] = currentConversationId.split('_');
        const recipientId = user1 === currentUserId ? user2 : user1;

        const response = await fetch(`${apiBase}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId,
                subject,
                content: message,
                attachments: replyAttachedFiles
            })
        });

        if (response.ok) {
            showToast('Reply sent successfully!', 'success');
            closeReplyModal();
            loadMessages(currentConversationId);
            loadConversations();
        } else {
            showToast('Failed to send reply. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error sending reply:', error);
        showToast('Failed to send reply. Please try again.', 'error');
    }
}

function openNewConversationModal() {
    document.getElementById('newConversationModal').classList.add('show');
}

function closeNewConversationModal() {
    document.getElementById('newConversationModal').classList.remove('show');
    document.getElementById('newConversationForm').reset();
    modalAttachedFiles = [];
    updateModalAttachmentPreview();
}

async function handleNewConversation(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const recipientId = formData.get('recipientId');
    const message = formData.get('message');

    if (!recipientId || (!message.trim() && modalAttachedFiles.length === 0)) return;

    try {
        const response = await fetch(`${apiBase}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId,
                content: message,
                attachments: modalAttachedFiles
            })
        });

        if (response.ok) {
            closeNewConversationModal();
            await loadConversations();
            const newConversation = conversations.find(conv => conv.participantId === recipientId);
            if (newConversation) {
                selectConversation(newConversation.conversationId);
            }
        } else {
            showToast('Failed to start conversation. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error creating conversation:', error);
        showToast('Failed to start conversation. Please try again.', 'error');
    }
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;

    const content = messageInput.value.trim();
    if (!content && !attachedFiles.length) return;

    if (!currentConversationId) {
        showToast('Please select a conversation first', 'error');
        return;
    }

    try {
        const [user1, user2] = currentConversationId.split('_');
        const recipientId = user1 === currentUserId ? user2 : user1;

        const response = await fetch(`${apiBase}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId,
                content,
                attachments: attachedFiles
            })
        });

        if (response.ok) {
            attachedFiles = [];
            messageInput.value = '';
            messageInput.style.height = 'auto';
            loadMessages(currentConversationId);
            loadConversations();
        } else {
            showToast('Failed to send message. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message. Please try again.', 'error');
    }
}

async function uploadFiles(files) {
    const maxSize = 10 * 1024 * 1024;
    const oversizedFiles = files.filter(file => file.size > maxSize);

    if (oversizedFiles.length > 0) {
        showToast('Some files are too large. Maximum file size is 10MB.', 'error');
        return null;
    }

    try {
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));

        const response = await fetch(`${apiBase}/upload`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            return result.files;
        } else {
            showToast('Failed to upload files. Please try again.', 'error');
            return null;
        }
    } catch (error) {
        console.error('Error uploading files:', error);
        showToast('Failed to upload files. Please try again.', 'error');
        return null;
    }
}

async function handleFileUpload(e) {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const uploaded = await uploadFiles(files);
    if (uploaded) {
        attachedFiles = uploaded;
        updateAttachedFilesDisplay();
    }
    e.target.value = '';
    return false;
}

async function handleComposeFileUpload(e) {
    return false;
}

async function handleReplyFileUpload(e) {
    return false;
}

async function handleModalFileUpload(e) {
    return false;
}

function updateAttachedFilesDisplay() {
    const container = document.querySelector('.chat-input-area');
    if (!container) return;

    const existingPreview = container.querySelector('.attachment-preview');
    if (existingPreview) existingPreview.remove();

    if (attachedFiles.length === 0) return;

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

    const chatForm = container.querySelector('.chat-form');
    if (chatForm) {
        container.insertBefore(preview, chatForm);
    }
}

function updateComposeAttachmentPreview() {
    const preview = document.getElementById('composeAttachmentPreview');
    if (!preview) return;

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

function updateReplyAttachmentPreview() {
    const preview = document.getElementById('replyAttachmentPreview');
    if (!preview) return;

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

function updateModalAttachmentPreview() {
    const preview = document.getElementById('modalAttachmentPreview');
    if (!preview) return;

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

function removeAttachment(index) {
    attachedFiles.splice(index, 1);
    updateAttachedFilesDisplay();
}

function removeComposeAttachment(index) {
    composeAttachedFiles.splice(index, 1);
    updateComposeAttachmentPreview();
}

function removeReplyAttachment(index) {
    replyAttachedFiles.splice(index, 1);
    updateReplyAttachmentPreview();
}

function removeModalAttachment(index) {
    modalAttachedFiles.splice(index, 1);
    updateModalAttachmentPreview();
}

function openImageGallery(messageId, startIndex) {
    const message = messages.find(msg => msg._id === messageId);
    if (!message) return;

    const attachments = message.attachments.map(a => ({
        url: a.url || '/uploads/messages/' + a.filename,
        name: a.originalName,
        isImage: a.mimetype && a.mimetype.startsWith('image/')
    }));

    currentGalleryImages = attachments.filter(att => att.isImage);
    currentGalleryIndex = startIndex;

    if (currentGalleryImages.length === 0) return;

    const galleryImage = document.getElementById('galleryImage');
    const galleryCounter = document.getElementById('galleryCounter');
    const galleryFilename = document.getElementById('galleryFilename');

    galleryImage.src = currentGalleryImages[currentGalleryIndex].url;
    galleryImage.alt = currentGalleryImages[currentGalleryIndex].name;
    galleryCounter.textContent = `${currentGalleryIndex + 1} / ${currentGalleryImages.length}`;
    galleryFilename.textContent = currentGalleryImages[currentGalleryIndex].name;

    const galleryPrev = document.getElementById('galleryPrev');
    const galleryNext = document.getElementById('galleryNext');

    galleryPrev.style.display = currentGalleryImages.length > 1 ? 'block' : 'none';
    galleryNext.style.display = currentGalleryImages.length > 1 ? 'block' : 'none';

    document.getElementById('imageGalleryModal').classList.add('show');

    galleryPrev.onclick = () => navigateGallery(-1);
    galleryNext.onclick = () => navigateGallery(1);

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
