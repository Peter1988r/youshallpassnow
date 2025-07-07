// Field Validation App JavaScript

class FieldValidationApp {
    constructor() {
        this.authToken = localStorage.getItem('field_auth_token');
        this.scanHistory = [];
        this.currentScreen = 'auth';
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthStatus();
        this.checkUrlParameters();
    }

    bindEvents() {
        // Auth form
        document.getElementById('field-login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Manual entry
        document.getElementById('manual-entry-btn').addEventListener('click', () => this.showManualEntry());

        // Manual entry modal
        document.getElementById('validate-manual-btn').addEventListener('click', () => this.validateManualEntry());
        document.getElementById('cancel-manual-btn').addEventListener('click', () => this.hideManualEntry());

        // Navigation
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('view-all-logs-btn').addEventListener('click', () => this.showLogsScreen());
        document.getElementById('back-to-scanner-btn').addEventListener('click', () => this.showScannerScreen());
        document.getElementById('refresh-logs-btn').addEventListener('click', () => this.loadScanLogs());

        // Modal backdrop click
        document.getElementById('manual-entry-modal').addEventListener('click', (e) => {
            if (e.target.id === 'manual-entry-modal') {
                this.hideManualEntry();
            }
        });
    }

    checkAuthStatus() {
        if (this.authToken) {
            this.showScannerScreen();
        } else {
            this.showAuthScreen();
        }
    }

    checkUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Check for error messages
        const error = urlParams.get('error');
        if (error) {
            let errorMessage = 'Unknown error occurred';
            switch(error) {
                case 'no-token':
                    errorMessage = 'QR code validation link is missing required data';
                    break;
                case 'invalid-token':
                    errorMessage = 'QR code validation link is invalid or corrupted';
                    break;
                case 'validation-failed':
                    errorMessage = 'QR code validation failed';
                    break;
            }
            this.showUrlError(errorMessage);
        }
        
        // Check for auto-validation
        const autoValidate = urlParams.get('auto');
        if (autoValidate === 'true') {
            this.handleAutoValidation();
        }
        
        // Clean up URL parameters
        if (urlParams.has('error') || urlParams.has('auto')) {
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        }
    }

    showUrlError(message) {
        // Show error in auth screen if not logged in, or in scanner screen if logged in
        const currentScreen = this.authToken ? 'scanner' : 'auth';
        
        if (currentScreen === 'auth') {
            const errorElement = document.getElementById('auth-error');
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        } else {
            this.displayError(message);
        }
    }

    async handleAutoValidation() {
        // Check if user is authenticated
        if (!this.authToken) {
            // Store intent to auto-validate after login
            localStorage.setItem('pending_auto_validation', 'true');
            this.showUrlError('Please log in to validate the QR code');
            return;
        }
        
        // Get the pending validation token from cookie
        const pendingToken = this.getCookie('pending_validation');
        if (!pendingToken) {
            this.displayError('Validation session expired. Please scan the QR code again.');
            return;
        }
        
        try {
            // Decode and validate the token
            const qrData = atob(pendingToken.replace(/-/g, '+').replace(/_/g, '/'));
            
            // Clear the cookie
            this.deleteCookie('pending_validation');
            
            // Show scanner screen and auto-validate
            this.showScannerScreen();
            
            // Validate the QR code data
            this.validateQRCode(qrData);
            
        } catch (error) {
            console.error('Auto-validation error:', error);
            this.displayError('Failed to auto-validate QR code. Please try scanning again.');
        }
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    deleteCookie(name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }

    showAuthScreen() {
        this.switchScreen('auth');
    }

    showScannerScreen() {
        this.switchScreen('scanner');
        this.loadEvents();
        this.loadRecentScans();
    }

    showLogsScreen() {
        this.switchScreen('logs');
        this.loadScanLogs();
    }

    switchScreen(screenName) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(`${screenName}-screen`).classList.add('active');
        this.currentScreen = screenName;
    }

    async handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorElement = document.getElementById('auth-error');
        const submitButton = document.querySelector('#field-login-form button[type="submit"]');

        try {
            submitButton.classList.add('loading');
            submitButton.disabled = true;
            errorElement.style.display = 'none';

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                if (data.user.role !== 'field_admin') {
                    throw new Error('Access denied: Field admin role required');
                }
                
                this.authToken = data.token;
                localStorage.setItem('field_auth_token', data.token);
                this.showScannerScreen();
                
                // Check if there was a pending auto-validation after login
                if (localStorage.getItem('pending_auto_validation') === 'true') {
                    localStorage.removeItem('pending_auto_validation');
                    this.handleAutoValidation();
                }
            } else {
                throw new Error(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            errorElement.textContent = error.message;
            errorElement.style.display = 'block';
        } finally {
            submitButton.classList.remove('loading');
            submitButton.disabled = false;
        }
    }

    logout() {
        this.authToken = null;
        localStorage.removeItem('field_auth_token');
        this.showAuthScreen();
    }



    async validateQRCode(qrData) {
        const scanLocation = document.getElementById('location-input').value.trim();
        
        try {
            const response = await fetch('/api/qr/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    qrData: qrData,
                    scanLocation: scanLocation
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.displayValidationResult(result);
                this.addToScanHistory(result);
            } else {
                throw new Error(result.error || 'Validation failed');
            }
        } catch (error) {
            console.error('Validation error:', error);
            this.displayError('Validation failed: ' + error.message);
        }
    }

    displayValidationResult(result) {
        const resultsContainer = document.getElementById('validation-results');
        const statusElement = document.getElementById('result-status');
        const timestampElement = document.getElementById('result-timestamp');

        // Show results container
        resultsContainer.style.display = 'block';

        // Set status
        statusElement.textContent = this.getStatusText(result.result);
        statusElement.className = `result-status ${result.result}`;

        // Set timestamp
        timestampElement.textContent = new Date(result.timestamp).toLocaleString();

        if (result.valid && result.crew_member) {
            this.displayCrewInfo(result.crew_member);
            this.displayEventInfo(result.event);
        } else {
            this.displayInvalidResult(result.result);
        }

        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }

    displayCrewInfo(crewMember) {
        document.getElementById('crew-name').textContent = crewMember.name;
        document.getElementById('crew-role').textContent = `Role: ${crewMember.role.replace(/_/g, ' ')}`;
        document.getElementById('crew-company').textContent = `Company: ${crewMember.company_name || 'N/A'}`;
        document.getElementById('crew-badge').textContent = `Badge: ${crewMember.badge_number}`;

        // Display access zones
        const zonesList = document.getElementById('zones-list');
        zonesList.innerHTML = '';
        
        if (crewMember.access_zones && crewMember.access_zones.length > 0) {
            crewMember.access_zones.forEach(zone => {
                const zoneBadge = document.createElement('span');
                zoneBadge.className = 'zone-badge';
                zoneBadge.textContent = `Zone ${zone}`;
                zonesList.appendChild(zoneBadge);
            });
        } else {
            zonesList.innerHTML = '<span class="zone-badge">No zones assigned</span>';
        }
    }

    displayEventInfo(event) {
        document.getElementById('event-name').textContent = event.name;
        document.getElementById('event-location').textContent = event.location;
    }

    displayInvalidResult(resultType) {
        // Hide crew and event info for invalid results
        document.getElementById('crew-info').style.display = 'none';
        document.getElementById('event-info').style.display = 'none';
        document.getElementById('access-zones').style.display = 'none';
        
        // Show error message based on result type
        const errorMessages = {
            'invalid': 'QR code is invalid or corrupted',
            'expired': 'Badge has expired',
            'not_found': 'Badge not found in system',
            'not_approved': 'Badge holder is not approved',
            'invalid_signature': 'QR code signature is invalid',
            'invalid_format': 'QR code format is not recognized'
        };

        const errorMessage = errorMessages[resultType] || 'Validation failed';
        this.displayError(errorMessage);
    }

    displayError(message) {
        const resultsContainer = document.getElementById('validation-results');
        resultsContainer.innerHTML = `
            <div class="error-message show">
                <strong>Validation Failed:</strong> ${message}
            </div>
            <div class="next-scan" style="margin-top: 1rem;">
                <p>🔄 Ready for next validation</p>
                <small>Simply scan another QR code with your camera app</small>
            </div>
        `;
        resultsContainer.style.display = 'block';
    }



    showManualEntry() {
        document.getElementById('manual-entry-modal').style.display = 'flex';
        document.getElementById('manual-qr-data').focus();
    }

    hideManualEntry() {
        document.getElementById('manual-entry-modal').style.display = 'none';
        document.getElementById('manual-qr-data').value = '';
    }

    async validateManualEntry() {
        const qrData = document.getElementById('manual-qr-data').value.trim();
        
        if (!qrData) {
            alert('Please enter QR code data');
            return;
        }

        this.hideManualEntry();
        await this.validateQRCode(qrData);
    }



    addToScanHistory(result) {
        this.scanHistory.unshift(result);
        if (this.scanHistory.length > 10) {
            this.scanHistory = this.scanHistory.slice(0, 10);
        }
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';

        this.scanHistory.forEach(scan => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            const name = scan.crew_member ? scan.crew_member.name : 'Unknown';
            const time = new Date(scan.timestamp).toLocaleTimeString();
            
            historyItem.innerHTML = `
                <div class="history-item-info">
                    <div class="history-item-name">${name}</div>
                    <div class="history-item-details">${time} - ${this.getStatusText(scan.result)}</div>
                </div>
                <span class="history-item-status ${scan.result}">${scan.result}</span>
            `;
            
            historyList.appendChild(historyItem);
        });
    }

    async loadEvents() {
        try {
            const response = await fetch('/api/events');
            const events = await response.json();
            
            const eventFilter = document.getElementById('event-filter');
            eventFilter.innerHTML = '<option value="">All Events</option>';
            
            events.forEach(event => {
                const option = document.createElement('option');
                option.value = event.id;
                option.textContent = event.name;
                eventFilter.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading events:', error);
        }
    }

    async loadRecentScans() {
        try {
            const response = await fetch('/api/qr/scan-logs?limit=5', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (response.ok) {
                const logs = await response.json();
                // Convert to scan history format
                this.scanHistory = logs.map(log => ({
                    timestamp: log.scanned_at,
                    result: log.validation_result,
                    crew_member: log.first_name ? {
                        name: `${log.first_name} ${log.last_name}`,
                        badge_number: log.badge_number
                    } : null
                }));
                this.updateHistoryDisplay();
            }
        } catch (error) {
            console.error('Error loading recent scans:', error);
        }
    }

    async loadScanLogs() {
        const eventFilter = document.getElementById('event-filter');
        const dateFilter = document.getElementById('date-filter');
        const logsContainer = document.getElementById('logs-container');
        
        try {
            let url = '/api/qr/scan-logs?limit=50';
            
            if (eventFilter.value) {
                url += `&eventId=${eventFilter.value}`;
            }
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (response.ok) {
                const logs = await response.json();
                this.displayScanLogs(logs);
            } else {
                throw new Error('Failed to load scan logs');
            }
        } catch (error) {
            console.error('Error loading scan logs:', error);
            logsContainer.innerHTML = `
                <div class="error-message show">
                    Failed to load scan logs: ${error.message}
                </div>
            `;
        }
    }

    displayScanLogs(logs) {
        const logsContainer = document.getElementById('logs-container');
        
        if (logs.length === 0) {
            logsContainer.innerHTML = `
                <div class="log-item">
                    <div class="log-item-main">
                        <div class="log-item-name">No scan logs found</div>
                        <div class="log-item-details">No scans have been recorded yet</div>
                    </div>
                </div>
            `;
            return;
        }

        logsContainer.innerHTML = '';
        
        logs.forEach(log => {
            const logItem = document.createElement('div');
            logItem.className = 'log-item';
            
            const name = log.first_name ? `${log.first_name} ${log.last_name}` : 'Unknown';
            const badge = log.badge_number ? ` (${log.badge_number})` : '';
            const event = log.event_name || 'Unknown Event';
            const location = log.scan_location || 'Unknown Location';
            const timestamp = new Date(log.scanned_at).toLocaleString();
            
            logItem.innerHTML = `
                <div class="log-item-main">
                    <div class="log-item-name">${name}${badge}</div>
                    <div class="log-item-details">
                        ${event} • ${location} • ${this.getStatusText(log.validation_result)}
                    </div>
                </div>
                <div class="log-item-timestamp">
                    <span class="result-status ${log.validation_result}" style="margin-bottom: 0.25rem; display: inline-block;">
                        ${log.validation_result}
                    </span><br>
                    ${timestamp}
                </div>
            `;
            
            logsContainer.appendChild(logItem);
        });
    }

    getStatusText(status) {
        const statusTexts = {
            'valid': 'Valid',
            'invalid': 'Invalid',
            'expired': 'Expired',
            'not_found': 'Not Found',
            'not_approved': 'Not Approved',
            'invalid_signature': 'Invalid Signature',
            'invalid_format': 'Invalid Format'
        };
        
        return statusTexts[status] || status;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FieldValidationApp();
}); 