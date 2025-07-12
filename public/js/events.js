// Events page functionality
let allEvents = []; // Store all events for filtering

// Load real events from API
async function loadEvents() {
    try {
        const response = await fetch('/api/events');
        if (!response.ok) {
            throw new Error('Failed to fetch events');
        }
        
        allEvents = await response.json();
        displayEvents(allEvents);
    } catch (error) {
        console.error('Error loading events:', error);
        showErrorMessage('Failed to load events. Please try again later.');
    }
}

// Filter events based on search and date range
function filterEvents() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const dateRange = document.getElementById('dateRangeFilter').value;
    
    let filteredEvents = allEvents.filter(event => {
        // Search filter - check name, location
        const matchesSearch = !searchTerm || 
            event.name.toLowerCase().includes(searchTerm) ||
            event.location.toLowerCase().includes(searchTerm) ||
            (event.description && event.description.toLowerCase().includes(searchTerm));
        
        // Date range filter - filter by event start date
        let matchesDateRange = true;
        if (dateRange) {
            const today = new Date();
            const eventStartDate = new Date(event.start_date);
            
            switch (dateRange) {
                case 'upcoming':
                    matchesDateRange = eventStartDate > today;
                    break;
                case 'this-month':
                    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    matchesDateRange = eventStartDate >= startOfMonth && eventStartDate <= endOfMonth;
                    break;
                case 'next-3-months':
                    const threeMonthsFromNow = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
                    matchesDateRange = eventStartDate >= today && eventStartDate <= threeMonthsFromNow;
                    break;
                case 'this-year':
                    matchesDateRange = eventStartDate.getFullYear() === today.getFullYear();
                    break;
                case 'past':
                    matchesDateRange = eventStartDate < today;
                    break;
            }
        }
        
        return matchesSearch && matchesDateRange;
    });
    
    displayEvents(filteredEvents);
}

// Display events in the grid
function displayEvents(events) {
    const eventsGrid = document.getElementById('eventsGrid');
    
    if (events.length === 0) {
        eventsGrid.innerHTML = '<div class="no-events"><p>No events found matching your criteria.</p></div>';
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
        
        eventsHTML += `
            <div class="event-card" onclick="redirectToSignin()">
                <div class="event-image">
                    <img src="${eventImage}" alt="${event.name}" onerror="this.src='/assets/YSPlogoV2.png'">
                </div>
                <div class="event-content">
                    <h3>${event.name}</h3>
                    <p class="event-location">📍 ${event.location}</p>
                    <p class="event-date-info">📅 ${dateRange}</p>
                    <div class="event-footer">
                        <span class="event-status ${statusClass}">${statusText}</span>
                        <button class="btn-primary" onclick="event.stopPropagation(); redirectToSignin()">Apply for Access</button>
                    </div>
                </div>
            </div>
        `;
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
    return `${start} - ${end}`;
}

// Clear all filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('dateRangeFilter').value = '';
    displayEvents(allEvents);
}

// Show error message
function showErrorMessage(message) {
    const eventsGrid = document.getElementById('eventsGrid');
    eventsGrid.innerHTML = `
        <div class="error-message">
            <p>${message}</p>
            <button onclick="loadEvents()" class="btn-primary">Retry</button>
        </div>
    `;
}

// Redirect to sign in page
function redirectToSignin() {
    window.location.href = '/signin';
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadEvents();
    
    // Add event listeners for filters
    document.getElementById('searchInput').addEventListener('input', filterEvents);
    document.getElementById('dateRangeFilter').addEventListener('change', filterEvents);
    document.getElementById('clearFilters').addEventListener('click', clearFilters);
});

// Force dark mode permanently
document.documentElement.setAttribute('data-theme', 'dark');
document.body.classList.add('dark-mode');
localStorage.removeItem('theme');