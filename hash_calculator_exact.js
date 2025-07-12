const crypto = require('crypto');

// Extract just the content between script tags for script 2
const script2_content = `        // Force dark mode permanently
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-mode');
        localStorage.removeItem('theme');`;

function calculateHash(script) {
    return crypto.createHash('sha256').update(script).digest('base64');
}

console.log('Script 2 content hash:', calculateHash(script2_content));
console.log('Target hash: Tts/1SPznKqC6oT6QmVCB48rzh7RBtfnDiZSTnWjVeQ=');

// Let's try the script 1 content too (the main events script)
const script1_content = `        // Load real events from API
        async function loadEvents() {
            try {
                const response = await fetch('/api/events');
                if (\!response.ok) {
                    throw new Error('Failed to fetch events');
                }
                
                const events = await response.json();
                displayEvents(events);
            } catch (error) {
                console.error('Error loading events:', error);
                showErrorMessage('Failed to load events. Please try again later.');
            }
        }

        // Display events in the grid
        function displayEvents(events) {
            const eventsGrid = document.getElementById('eventsGrid');
            
            if (events.length === 0) {
                eventsGrid.innerHTML = '<div class="no-events"><p>No events available at this time.</p></div>';
                return;
            }

            let eventsHTML = '';
            events.forEach(event => {
                const startDate = new Date(event.start_date);
                const endDate = new Date(event.end_date);
                const isOngoing = new Date() >= startDate && new Date() <= endDate;
                const isPast = new Date() > endDate;
                const isFuture = new Date() < startDate;
                
                // Format dates
                const dateRange = formatEventDates(startDate, endDate);
                
                // Determine status
                let statusText = 'Registration Open';
                let statusClass = 'registration-open';
                
                if (isPast) {
                    statusText = 'Event Completed';
                    statusClass = 'completed';
                } else if (isOngoing) {
                    statusText = 'Event Ongoing';
                    statusClass = 'ongoing';
                } else if (isFuture) {
                    statusText = 'Upcoming';
                    statusClass = 'upcoming';
                }
                
                // Use event photo if available, fallback to logo
                const eventImage = event.event_photo_path || '/assets/YSPlogoV2.png';
                
                eventsHTML += \`
                    <div class="event-card" onclick="redirectToSignin()">
                        <div class="event-image">
                            <img src="\${eventImage}" alt="\${event.name}" onerror="this.src='/assets/YSPlogoV2.png'">
                        </div>
                        <div class="event-content">
                            <h3>\${event.name}</h3>
                            <p class="event-location">📍 \${event.location}</p>
                            <p class="event-date-info">📅 \${dateRange}</p>
                            <div class="event-footer">
                                <span class="event-status \${statusClass}">\${statusText}</span>
                                <button class="btn-primary" onclick="event.stopPropagation(); redirectToSignin()">Apply for Access</button>
                            </div>
                        </div>
                    </div>
                \`;
            });
            
            eventsGrid.innerHTML = eventsHTML;
        }

        // Format event dates
        function formatEventDates(startDate, endDate) {
            const options = { month: 'short', day: 'numeric', year: 'numeric' };
            const start = startDate.toLocaleDateString('en-US', options).toUpperCase();
            
            if (startDate.toDateString() === endDate.toDateString()) {
                return start;
            }
            
            const end = endDate.toLocaleDateString('en-US', options).toUpperCase();
            return \`\${start} - \${end}\`;
        }

        // Show error message
        function showErrorMessage(message) {
            const eventsGrid = document.getElementById('eventsGrid');
            eventsGrid.innerHTML = \`
                <div class="error-message">
                    <p>\${message}</p>
                    <button onclick="loadEvents()" class="btn-primary">Retry</button>
                </div>
            \`;
        }

        // Redirect to sign in page
        function redirectToSignin() {
            window.location.href = '/signin';
        }

        // Initialize page
        document.addEventListener('DOMContentLoaded', function() {
            loadEvents();
        });`;

console.log('Script 1 content hash:', calculateHash(script1_content));
