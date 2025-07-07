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
        document.getElementById('camera-app-btn').addEventListener('click', () => this.showCameraInstructions());
        document.getElementById('manual-entry-btn').addEventListener('click', () => this.showManualEntry());
        document.getElementById('scan-another-btn').addEventListener('click', () => this.resetScanner());

        // Camera app instructions
        document.getElementById('validate-camera-data-btn').addEventListener('click', () => this.validateCameraData());
        document.getElementById('hide-instructions-btn').addEventListener('click', () => this.hideCameraInstructions());

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
            
            // Optimized config for mobile devices and better QR detection
            const config = {
                fps: 20, // Higher FPS for better detection
                qrbox: function(viewfinderWidth, viewfinderHeight) {
                    // Dynamic qrbox sizing based on screen
                    let minEdgePercentage = 0.7; // 70% of the smaller edge
                    let minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
                    let qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
                    return {
                        width: Math.min(qrboxSize, 400),
                        height: Math.min(qrboxSize, 400)
                    };
                },
                // Enhanced detection settings
                aspectRatio: undefined, // Let the library choose optimal ratio
                videoConstraints: {
                    facingMode: "environment",
                    focusMode: "continuous",
                    advanced: [
                        { focusMode: "continuous" },
                        { focusDistance: { ideal: 0.3 } }
                    ]
                },
                // Better algorithm settings for QR detection
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                },
                rememberLastUsedCamera: true
            };

            // Try multiple camera configurations for iOS compatibility
            let cameraConfig = { facingMode: "environment" };
            
            try {
                await this.html5QrCode.start(
                    cameraConfig,
                    config,
                    (qrCodeMessage) => {
                        console.log('QR Code detected:', qrCodeMessage);
                        this.onScanSuccess(qrCodeMessage);
                    },
                    (errorMessage) => {
                        // Only log significant errors, not routine "no QR found" messages
                        if (!errorMessage.includes('No QR code found') && 
                            !errorMessage.includes('NotFoundException')) {
                            console.warn('QR scan error:', errorMessage);
                        }
                    }
                );
                
                statusElement.innerHTML = `
                    <div style="color: #10B981; text-align: center;">
                        📷 Camera active - Point at QR code<br>
                        <small style="color: #666; margin-top: 0.5rem; display: block;">
                            Having trouble? Try the <strong>📱 Use Camera App</strong> button above
                        </small>
                    </div>
                `;
                
            } catch (startError) {
                console.warn('Failed with environment camera, trying any camera:', startError);
                
                try {
                    // Fallback: try any available camera
                    cameraConfig = true;
                    await this.html5QrCode.start(
                        cameraConfig,
                        config,
                        (qrCodeMessage) => {
                            console.log('QR Code detected:', qrCodeMessage);
                             this.onScanSuccess(qrCodeMessage);
                         },
                         (errorMessage) => {
                             if (!errorMessage.includes('No QR code found') && 
                                 !errorMessage.includes('NotFoundException')) {
                                 console.warn('QR scan error:', errorMessage);
                             }
                         }
                     );
                 } catch (fallbackError) {
                     console.warn('Advanced config failed, trying simple config:', fallbackError);
                     
                     // Final fallback: use very simple configuration for older devices
                     const simpleConfig = {
                         fps: 10,
                         qrbox: 250,
                         aspectRatio: 1.0
                     };
                     
                     await this.html5QrCode.start(
                         { facingMode: "environment" },
                         simpleConfig,
                         (qrCodeMessage) => {
                             console.log('QR Code detected (simple mode):', qrCodeMessage);
                             this.onScanSuccess(qrCodeMessage);
                         },
                         (errorMessage) => {
                             if (!errorMessage.includes('No QR code found') && 
                                 !errorMessage.includes('NotFoundException')) {
                                 console.warn('QR scan error (simple mode):', errorMessage);
                             }
                         }
                     );
                 }
             }

            statusElement.textContent = 'Ready to scan QR codes - Point camera at QR code';
            
            // Add helpful tips for mobile users
            if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                statusElement.innerHTML = `
                    <div style="text-align: center;">
                        <div style="color: #10B981; font-weight: bold; margin-bottom: 0.5rem;">📱 Scanning Active</div>
                        <div style="font-size: 0.9rem;">Point camera at QR code</div>
                        <div style="font-size: 0.8rem; margin-top: 0.5rem; color: #6B7280;">
                            Tip: Hold steady, ensure good lighting
                        </div>
                    </div>
                `;
            }
            
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
                <h3>📷 Camera Scanner Issue</h3>
                <p>The web camera scanner isn't working properly on your device.</p>
                
                <div style="margin: 1rem 0; padding: 1.5rem; background: rgba(255, 107, 53, 0.1); border: 2px solid #FF6B35; border-radius: 0.5rem; color: #FF6B35;">
                    <strong style="font-size: 1.1em;">📱 RECOMMENDED SOLUTION</strong><br>
                    <div style="color: #E0E0E0; margin-top: 0.5rem;">
                        Click the <strong style="color: #FF6B35;">"📱 Use Camera App"</strong> button above.<br>
                        Your device's native camera app works much better!
                    </div>
                </div>
                
                <div style="margin: 1rem 0; padding: 1rem; background: #FEF3C7; border-radius: 0.5rem; color: #92400E;">
                    <strong>📱 For iPhone/iPad users:</strong><br>
                    • Use the "📱 Use Camera App" button (most reliable)<br>
                    • Or allow camera access in Safari if you want to try web scanning<br>
                    • Make sure you're using Safari browser for best compatibility
                </div>
                
                <p style="font-size: 0.9em; color: #999;"><strong>Other options:</strong> Manual Entry button • Browser settings • Try refreshing</p>
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

    showCameraInstructions() {
        const instructions = document.getElementById('camera-instructions');
        instructions.style.display = 'block';
        
        // If iOS device, add specific instructions
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
            const instructionCard = instructions.querySelector('.instruction-card ol');
            instructionCard.innerHTML = `
                <li>Open your iPhone's <strong>Camera app</strong></li>
                <li>Point it at the QR code on the badge</li>
                <li>Tap the yellow banner or notification that appears at the top</li>
                <li>This will open Safari with the QR code data displayed as text</li>
                <li>Long-press and select "Copy All" to copy all the text</li>
                <li>Return to this app and paste it in the box below</li>
            `;
        }
        
        // Auto-focus the textarea
        setTimeout(() => {
            document.getElementById('camera-app-data').focus();
        }, 300);
    }

    hideCameraInstructions() {
        document.getElementById('camera-instructions').style.display = 'none';
        document.getElementById('camera-app-data').value = '';
    }

    async validateCameraData() {
        const qrData = document.getElementById('camera-app-data').value.trim();
        if (qrData) {
            this.hideCameraInstructions();
            await this.validateQRCode(qrData);
        } else {
            this.displayError('Please paste the QR code data from your camera app');
        }
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