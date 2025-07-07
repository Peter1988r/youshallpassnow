// Field Validation App JavaScript

class FieldValidationApp {
    constructor() {
        this.authToken = localStorage.getItem('field_auth_token');
        this.html5QrCode = null;
        this.scanHistory = [];
        this.currentScreen = 'auth';
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthStatus();
    }

    bindEvents() {
        // Auth form
        document.getElementById('field-login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Scanner controls
        document.getElementById('start-scan-btn').addEventListener('click', () => this.startScanning());
        document.getElementById('stop-scan-btn').addEventListener('click', () => this.stopScanning());
        document.getElementById('manual-entry-btn').addEventListener('click', () => this.showManualEntry());
        document.getElementById('scan-another-btn').addEventListener('click', () => this.resetScanner());

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
        this.stopScanning();
        this.showAuthScreen();
    }

    async startScanning() {
        const startBtn = document.getElementById('start-scan-btn');
        const stopBtn = document.getElementById('stop-scan-btn');
        const statusElement = document.getElementById('scanner-status');

        try {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            statusElement.textContent = 'Starting camera...';

            this.html5QrCode = new Html5Qrcode("qr-reader");
            
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };

            await this.html5QrCode.start(
                { facingMode: "environment" }, // Use rear camera
                config,
                (qrCodeMessage) => {
                    this.onScanSuccess(qrCodeMessage);
                },
                (errorMessage) => {
                    // Handle scan failure (usually just no QR code found)
                    // Don't log every scan failure as it's normal
                }
            );

            statusElement.textContent = 'Scanning for QR codes...';
        } catch (error) {
            console.error('Error starting scanner:', error);
            statusElement.textContent = 'Camera access failed. Please check permissions.';
            this.showCameraError();
            startBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
        }
    }

    async stopScanning() {
        const startBtn = document.getElementById('start-scan-btn');
        const stopBtn = document.getElementById('stop-scan-btn');
        const statusElement = document.getElementById('scanner-status');

        if (this.html5QrCode) {
            try {
                await this.html5QrCode.stop();
                this.html5QrCode = null;
                statusElement.textContent = 'Scanner stopped';
            } catch (error) {
                console.error('Error stopping scanner:', error);
                statusElement.textContent = 'Scanner stopped';
            }
        }

        startBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
    }

    showCameraError() {
        const scannerArea = document.getElementById('scanner-area');
        scannerArea.innerHTML = `
            <div class="camera-permission">
                <h3>Camera Access Required</h3>
                <p>To scan QR codes, please allow camera access in your browser settings.</p>
                <p>On mobile devices, you may need to:</p>
                <ul style="text-align: left; max-width: 300px; margin: 0 auto;">
                    <li>Refresh this page</li>
                    <li>Check browser permissions</li>
                    <li>Use manual entry as an alternative</li>
                </ul>
            </div>
        `;
    }

    async onScanSuccess(qrData) {
        // Stop scanning immediately to prevent multiple scans
        await this.stopScanning();
        
        // Validate the QR code
        await this.validateQRCode(qrData);
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
            <button id="scan-another-btn" class="btn btn-primary" style="margin-top: 1rem;">Try Another Scan</button>
        `;
        resultsContainer.style.display = 'block';
        
        // Re-bind the scan another button
        document.getElementById('scan-another-btn').addEventListener('click', () => this.resetScanner());
    }

    resetScanner() {
        // Hide results
        document.getElementById('validation-results').style.display = 'none';
        
        // Reset crew and event info visibility
        document.getElementById('crew-info').style.display = 'block';
        document.getElementById('event-info').style.display = 'block';
        document.getElementById('access-zones').style.display = 'block';
        
        // Clear location input
        document.getElementById('location-input').value = '';
        
        // Reset scanner status
        document.getElementById('scanner-status').textContent = 'Ready to scan';
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