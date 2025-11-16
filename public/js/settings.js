// Phone number formatting
document.getElementById('phone').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    // Limit to 11 digits
    value = value.slice(0, 11);
    e.target.value = value;
});

// Phone validation and formatting
document.getElementById('phone').addEventListener('blur', function(e) {
    let cleaned = e.target.value.replace(/\D/g, '');
    if (cleaned) {
        if (cleaned.length === 10) {
            cleaned = '0' + cleaned;
        } else if (cleaned.length === 11) {
            if (!cleaned.startsWith('09')) {
                if (cleaned.startsWith('0')) {
                    cleaned = '09' + cleaned.slice(1);
                } else {
                    cleaned = '09' + cleaned.slice(0, 8);
                }
            }
        } else {
            alert('Please enter a valid 11-digit Philippines phone number');
            return;
        }
        e.target.value = cleaned;
    }
});

// Form submit validation
document.getElementById('profileForm').addEventListener('submit', function(e) {
    const phoneValue = document.getElementById('phone').value.replace(/\D/g, '');
    if (phoneValue && phoneValue.length !== 11) {
        alert('Please enter a valid 11-digit Philippines phone number');
        e.preventDefault();
        document.getElementById('phone').focus();
        return false;
    }
});

// Form handling - profile form now submits via POST

document.getElementById('passwordForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match!');
        return;
    }

    if (newPassword.length < 6) {
        alert('Password must be at least 6 characters long!');
        return;
    }

    // Add password change logic here
    alert('Password changed successfully!');
    document.getElementById('passwordForm').reset();
});

// Function to apply dark mode
function applyDarkMode(enabled) {
    if (enabled) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

// Function to update checkbox state
function updateCheckbox(checkboxId, enabled) {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
        checkbox.checked = enabled;
    }
}

// Preference handling
document.querySelectorAll('.toggle-switch input').forEach(toggle => {
    toggle.addEventListener('change', function() {
        // For dark mode, apply immediately
        if (this.id === 'darkMode') {
            applyDarkMode(this.checked);
        }
        savePreferences();
    });
});

// Number input handling for admin low stock alert range
const lowStockInput = document.getElementById('lowStockAlertRange');
if (lowStockInput) {
    lowStockInput.addEventListener('change', function() {
        savePreferences();
    });
}

// Load saved preferences - now done server-side in template

// Function to save preferences to server
async function savePreferences() {
    try {
        const preferences = {};

        // Get toggle values
        document.querySelectorAll('.toggle-switch input').forEach(toggle => {
            preferences[toggle.id] = toggle.checked;
        });

        // Get number input if exists (admin only)
        const lowStockRange = document.getElementById('lowStockAlertRange');
        if (lowStockRange) {
            preferences.lowStockAlertRange = parseInt(lowStockRange.value);
        }

        // Determine if admin or staff
        const isAdmin = window.location.pathname.startsWith('/admin');

        const response = await fetch(`${isAdmin ? '/admin' : '/staff'}/settings/preferences`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(preferences)
        });

        const result = await response.json();
        if (result.success) {
            console.log('Preferences saved successfully');
        } else {
            console.error('Failed to save preferences:', result.message);
        }
    } catch (error) {
        console.error('Error saving preferences:', error);
    }
}

// Quick actions
function exportSettings() {
    const settings = {
        soundEnabled: document.getElementById('soundEnabled').checked,
        printReceipts: document.getElementById('printReceipts').checked,
        darkMode: document.getElementById('darkMode').checked,
        orderConfirmations: document.getElementById('orderConfirmations').checked
    };

    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'staff-settings.json';
    link.click();
    URL.revokeObjectURL(url);
}

function resetSettings() {
    showConfirm('Are you sure you want to reset all settings to default?', 'Reset Settings',
        () => {
            document.querySelectorAll('.toggle-switch input').forEach(toggle => {
                toggle.checked = toggle.id === 'soundEnabled' || toggle.id === 'orderConfirmations';
                localStorage.removeItem(toggle.id);
            });
            alert('Settings reset to default!');
        }
    );
}

function logoutAllDevices() {
    showConfirm('Are you sure you want to logout from all devices? You will need to login again.', 'Logout All Devices',
        () => {
            // Add logout logic here
            alert('Logged out from all devices!');
        }
    );
}

// Password visibility toggle for account creation form
const passwordToggle = document.getElementById('passwordToggle');
const accountPassword = document.getElementById('accountPassword');
const passwordIcon = document.getElementById('passwordIcon');

if (passwordToggle && accountPassword && passwordIcon) {
    passwordToggle.addEventListener('click', function() {
        const isPassword = accountPassword.type === 'password';
        accountPassword.type = isPassword ? 'text' : 'password';

        // Add visual feedback class for smooth transitions
        passwordToggle.classList.add('toggle-visible');

        // Toggle active state for icon animation
        setTimeout(() => {
            if (isPassword) {
                passwordToggle.classList.add('active');
            } else {
                passwordToggle.classList.remove('active');
            }
            passwordToggle.classList.remove('toggle-visible');
        }, 0);
    });
}

// Account creation form handling
const createAccountForm = document.getElementById('createAccountForm');
if (createAccountForm) {
    createAccountForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const createAccountBtn = document.getElementById('createAccountBtn');
        const btnText = createAccountBtn.querySelector('.btn-text');
        const btnLoader = createAccountBtn.querySelector('.btn-loader');

        // Show loading state
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline';

        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());

        // Remove any empty optional fields
        Object.keys(data).forEach(key => {
            if (data[key] === '') {
                delete data[key];
            }
        });

        try {
            const response = await fetch('/admin/settings/create-account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                // Display all entered credentials in confirmation
                const confirmationMessage = `${result.message}\n\n═══ ACCOUNT CREDENTIALS ═══\n` +
                    `Username: ${data.username}\n` +
                    `Password: ${data.password}\n` +
                    `Role: ${data.role}\n` +
                    `Staff ID: ${result.user.staffId}\n\n` +
                    `⚠️  IMPORTANT: Please securely store these credentials!\n` +
                    `The new user can log in immediately.`;

                alert(confirmationMessage);
                createAccountForm.reset();
                // Reset password visibility after form reset
                if (passwordToggle) {
                    passwordToggle.classList.remove('active');
                }
                if (accountPassword) {
                    accountPassword.type = 'password';
                }
            } else {
                alert('Error creating account: ' + result.message);
            }
        } catch (error) {
            console.error('Account creation error:', error);
            alert('Failed to create account. Please try again.');
        } finally {
            // Hide loading state
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
        }
    });
}
