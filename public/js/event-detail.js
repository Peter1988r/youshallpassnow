document.addEventListener('DOMContentLoaded', () => {
    console.log('Event detail page loaded, initializing...');
    
    // Check super admin authentication
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No token found, redirecting to signin');
        window.location.href = '/signin';
        return;
    }

    // Get event ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    
    if (!eventId) {
        alert('No event ID provided');
        window.location.href = '/admin';
        return;
    }

    // Initialize page
    loadEventDetails(eventId);
    setupEventListeners();
});

// Load event details
async function loadEventDetails(eventId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load event details');
        }
        
        const event = await response.json();
        populateEventForm(event);
        loadAssignedCompanies(eventId);
        
    } catch (error) {
        console.error('Error loading event details:', error);
        showMessage('Failed to load event details', 'error');
    }
}

// Populate the form with event data
function populateEventForm(event) {
    document.getElementById('eventTitle').textContent = event.name;
    document.getElementById('eventSubtitle').textContent = `Manage ${event.name} settings`;
    
    document.getElementById('eventName').value = event.name;
    document.getElementById('eventLocation').value = event.location;
    document.getElementById('startDate').value = event.start_date;
    document.getElementById('endDate').value = event.end_date;
    document.getElementById('eventDescription').value = event.description || '';
    document.getElementById('eventStatusSelect').value = event.status || 'active';
    
    // Update status badge
    updateStatusBadge(event.status);
}

// Update status badge
function updateStatusBadge(status) {
    const badge = document.getElementById('statusBadge');
    const statusClass = status === 'active' ? 'active' : 
                       status === 'ongoing' ? 'ongoing' : 
                       status === 'ended' ? 'ended' : 'cancelled';
    
    badge.textContent = status;
    badge.className = `status-badge ${statusClass}`;
}

// Load assigned companies
async function loadAssignedCompanies(eventId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}/companies`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load assigned companies');
        }
        
        const companies = await response.json();
        displayAssignedCompanies(companies);
        
    } catch (error) {
        console.error('Error loading assigned companies:', error);
        showMessage('Failed to load assigned companies', 'error');
    }
}

// Display assigned companies
function displayAssignedCompanies(companies) {
    const container = document.getElementById('assignedCompanies');
    
    if (companies.length === 0) {
        container.innerHTML = '<p class="no-companies">No companies assigned to this event.</p>';
        return;
    }
    
    let html = '';
    companies.forEach(company => {
        html += `
            <div class="company-tag">
                <span>${company.name}</span>
                <button onclick="removeCompanyFromEvent(${company.id})" title="Remove company">×</button>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Setup event listeners
function setupEventListeners() {
    // Back button
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = '/admin';
    });
    
    // Form submission
    document.getElementById('eventDetailForm').addEventListener('submit', handleEventUpdate);
    
    // Add company to event
    document.getElementById('addCompanyToEvent').addEventListener('click', showAddCompanyModal);
    
    // Cancel event
    document.getElementById('cancelEventBtn').addEventListener('click', cancelEvent);
    
    // Delete event
    document.getElementById('deleteEventBtn').addEventListener('click', showDeleteConfirmation);
    
    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });
    
    // Add company to event form
    document.getElementById('addCompanyToEventForm').addEventListener('submit', handleAddCompanyToEvent);
    
    // Delete confirmation
    document.getElementById('confirmDelete').addEventListener('click', deleteEvent);
    document.getElementById('cancelDelete').addEventListener('click', () => {
        document.getElementById('confirmDeleteModal').style.display = 'none';
    });
}

// Handle event update
async function handleEventUpdate(e) {
    e.preventDefault();
    
    const eventId = new URLSearchParams(window.location.search).get('id');
    const formData = new FormData(e.target);
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: formData.get('eventName'),
                location: formData.get('eventLocation'),
                start_date: formData.get('startDate'),
                end_date: formData.get('endDate'),
                description: formData.get('eventDescription'),
                status: formData.get('eventStatus')
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update event');
        }
        
        const result = await response.json();
        showMessage('Event updated successfully', 'success');
        
        // Update status badge
        updateStatusBadge(formData.get('eventStatus'));
        
    } catch (error) {
        console.error('Error updating event:', error);
        showMessage('Failed to update event', 'error');
    }
}

// Show add company modal
async function showAddCompanyModal() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/companies', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load companies');
        }
        
        const companies = await response.json();
        const select = document.getElementById('companyToAssign');
        
        // Clear existing options
        select.innerHTML = '<option value="">Select a company</option>';
        
        // Add company options
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = company.name;
            select.appendChild(option);
        });
        
        document.getElementById('addCompanyToEventModal').style.display = 'flex';
        
    } catch (error) {
        console.error('Error loading companies:', error);
        showMessage('Failed to load companies', 'error');
    }
}

// Handle add company to event
async function handleAddCompanyToEvent(e) {
    e.preventDefault();
    
    const eventId = new URLSearchParams(window.location.search).get('id');
    const companyId = e.target.companyToAssign.value;
    
    if (!companyId) {
        showMessage('Please select a company', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}/companies`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ company_id: companyId })
        });
        
        if (!response.ok) {
            throw new Error('Failed to assign company to event');
        }
        
        showMessage('Company assigned to event successfully', 'success');
        document.getElementById('addCompanyToEventModal').style.display = 'none';
        
        // Reload assigned companies
        loadAssignedCompanies(eventId);
        
    } catch (error) {
        console.error('Error assigning company to event:', error);
        showMessage('Failed to assign company to event', 'error');
    }
}

// Remove company from event
async function removeCompanyFromEvent(companyId) {
    const eventId = new URLSearchParams(window.location.search).get('id');
    
    if (!confirm('Are you sure you want to remove this company from the event?')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}/companies/${companyId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to remove company from event');
        }
        
        showMessage('Company removed from event successfully', 'success');
        loadAssignedCompanies(eventId);
        
    } catch (error) {
        console.error('Error removing company from event:', error);
        showMessage('Failed to remove company from event', 'error');
    }
}

// Cancel event
async function cancelEvent() {
    const eventId = new URLSearchParams(window.location.search).get('id');
    
    if (!confirm('Are you sure you want to cancel this event?')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}/cancel`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to cancel event');
        }
        
        showMessage('Event cancelled successfully', 'success');
        updateStatusBadge('cancelled');
        document.getElementById('eventStatusSelect').value = 'cancelled';
        
    } catch (error) {
        console.error('Error cancelling event:', error);
        showMessage('Failed to cancel event', 'error');
    }
}

// Show delete confirmation
function showDeleteConfirmation() {
    document.getElementById('confirmDeleteModal').style.display = 'flex';
}

// Delete event
async function deleteEvent() {
    const eventId = new URLSearchParams(window.location.search).get('id');
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete event');
        }
        
        showMessage('Event deleted successfully', 'success');
        setTimeout(() => {
            window.location.href = '/admin';
        }, 1500);
        
    } catch (error) {
        console.error('Error deleting event:', error);
        showMessage('Failed to delete event', 'error');
    }
}

// Show message
function showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessage = document.querySelector('.event-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `event-message event-message-${type}`;
    messageEl.textContent = message;
    
    // Style the message
    messageEl.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        font-weight: 500;
        z-index: 1000;
        max-width: 300px;
    `;

    if (type === 'success') {
        messageEl.style.backgroundColor = '#d1fae5';
        messageEl.style.color = '#065f46';
        messageEl.style.border = '1px solid #a7f3d0';
    } else if (type === 'error') {
        messageEl.style.backgroundColor = '#fee2e2';
        messageEl.style.color = '#991b1b';
        messageEl.style.border = '1px solid #fecaca';
    } else {
        messageEl.style.backgroundColor = '#dbeafe';
        messageEl.style.color = '#1e40af';
        messageEl.style.border = '1px solid #bfdbfe';
    }

    // Insert message
    document.body.appendChild(messageEl);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.remove();
        }
    }, 5000);
} 