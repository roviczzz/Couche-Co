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

// Preference handling
document.querySelectorAll('.toggle-switch input').forEach(toggle => {
    toggle.addEventListener('change', function() {
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
    if (confirm('Are you sure you want to reset all settings to default?')) {
        document.querySelectorAll('.toggle-switch input').forEach(toggle => {
            toggle.checked = toggle.id === 'soundEnabled' || toggle.id === 'orderConfirmations';
            localStorage.removeItem(toggle.id);
        });
        alert('Settings reset to default!');
    }
}

function logoutAllDevices() {
    if (confirm('Are you sure you want to logout from all devices? You will need to login again.')) {
        // Add logout logic here
        alert('Logged out from all devices!');
    }
}
