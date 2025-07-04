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
    // Don't load crew data initially - will be loaded when tabs are activated
    setupEventListeners();
    
    // Ensure only overview tab is active on page load
    switchTab('overview');
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
    
    // Format dates for HTML date inputs (yyyy-MM-dd)
    document.getElementById('startDate').value = formatDateForInput(event.start_date);
    document.getElementById('endDate').value = formatDateForInput(event.end_date);
    
    document.getElementById('eventDescription').value = event.description || '';
    document.getElementById('eventStatusSelect').value = event.status || 'active';
    
    // Update status badge
    updateStatusBadge(event.status);
}

// Helper function to format date for HTML date input
function formatDateForInput(dateString) {
    if (!dateString) return '';
    
    // Handle both ISO format and already formatted dates
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    // Format as yyyy-MM-dd
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// Format event dates for display
function formatEventDates(startDate, endDate) {
    if (!startDate) return 'TBD';
    
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    };
    
    const startFormatted = start.toLocaleDateString('en-US', options);
    
    if (!end || start.toDateString() === end.toDateString()) {
        return startFormatted;
    }
    
    const endFormatted = end.toLocaleDateString('en-US', options);
    return `${startFormatted} - ${endFormatted}`;
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
        populateCompanyFilter(companies);
        
    } catch (error) {
        console.error('Error loading assigned companies:', error);
        showMessage('Failed to load assigned companies', 'error');
    }
}

// Populate company filter dropdown
function populateCompanyFilter(companies) {
    const filterSelect = document.getElementById('companyFilter');
    
    // Clear existing options except "All Companies"
    filterSelect.innerHTML = '<option value="">All Companies</option>';
    
    // Add company options
    companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company.id;
        option.textContent = company.name;
        filterSelect.appendChild(option);
    });
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
        const assignedDate = new Date(company.assigned_at).toLocaleDateString();
        html += `
            <div class="company-tag">
                <span>${company.name}</span>
                <small>Assigned: ${assignedDate}</small>
                <button data-company-id="${company.id}" data-action="remove-company" title="Remove company">×</button>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Add event listener for remove company buttons
    container.addEventListener('click', (e) => {
        const button = e.target.closest('[data-action="remove-company"]');
        if (button) {
            const companyId = button.dataset.companyId;
            removeCompanyFromEvent(companyId);
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Back button
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = '/admin';
    });
    
    // Tab switching functionality
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
    
    // Add company to event
    document.getElementById('addCompanyToEvent').addEventListener('click', showAddCompanyModal);
    
    // Refresh crew approvals
    document.getElementById('refreshApprovalsBtn').addEventListener('click', () => {
        const eventId = new URLSearchParams(window.location.search).get('id');
        loadCrewApprovals(eventId);
    });
    
    // Refresh approved crew
    document.getElementById('refreshApprovedCrewBtn').addEventListener('click', () => {
        const eventId = new URLSearchParams(window.location.search).get('id');
        const companyFilter = document.getElementById('companyFilter').value;
        loadApprovedCrew(eventId, companyFilter || null);
    });
    
    // Company filter for approved crew
    document.getElementById('companyFilter').addEventListener('change', () => {
        const eventId = new URLSearchParams(window.location.search).get('id');
        const companyFilter = document.getElementById('companyFilter').value;
        loadApprovedCrew(eventId, companyFilter || null);
    });
    
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

    // Auto-save functionality
    setupAutoSave();
}

// Tab switching function
function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    // Remove active class from all tabs and panels
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Add active class to selected tab and panel
    const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedPanel = document.querySelector(`.tab-panel[data-tab="${tabName}"]`);
    
    console.log('Selected tab element:', selectedTab);
    console.log('Selected panel element:', selectedPanel);
    
    if (selectedTab) {
        selectedTab.classList.add('active');
    } else {
        console.error('Tab element not found for:', tabName);
    }
    if (selectedPanel) {
        selectedPanel.classList.add('active');
    } else {
        console.error('Panel element not found for:', tabName);
    }
    
    // Load data based on the selected tab
    const eventId = new URLSearchParams(window.location.search).get('id');
    
    if (tabName === 'approvals') {
        loadCrewApprovals(eventId);
    } else if (tabName === 'accredited') {
        const companyFilter = document.getElementById('companyFilter');
        const filterValue = companyFilter ? companyFilter.value : '';
        loadApprovedCrew(eventId, filterValue || null);
    } else if (tabName === 'badge-template') {
        loadBadgeTemplate(eventId);
        setupBadgeTemplateListeners();
    }
    
    // Smooth scroll to the section
    if (selectedPanel) {
        selectedPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Auto-save functionality
function setupAutoSave() {
    const eventId = new URLSearchParams(window.location.search).get('id');
    let saveTimeout;
    
    // Get all form fields that should auto-save
    const autoSaveFields = [
        'eventName',
        'eventLocation', 
        'startDate',
        'endDate',
        'eventDescription',
        'eventStatusSelect'
    ];
    
    // Add event listeners to all auto-save fields
    autoSaveFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    autoSaveEvent(eventId);
                }, 1000); // Save after 1 second of inactivity
            });
            
            // For select elements, use change event
            if (field.tagName === 'SELECT') {
                field.addEventListener('change', () => {
                    clearTimeout(saveTimeout);
                    saveTimeout = setTimeout(() => {
                        autoSaveEvent(eventId);
                    }, 500); // Save immediately for select changes
                });
            }
        }
    });
}

// Auto-save event function
async function autoSaveEvent(eventId) {
    const indicator = document.getElementById('autoSaveIndicator');
    
    try {
        // Show saving indicator
        indicator.textContent = 'Saving...';
        indicator.classList.add('show', 'saving');
        
        const formData = {
            name: document.getElementById('eventName').value,
            location: document.getElementById('eventLocation').value,
            start_date: document.getElementById('startDate').value,
            end_date: document.getElementById('endDate').value,
            description: document.getElementById('eventDescription').value,
            status: document.getElementById('eventStatusSelect').value
        };
        
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to auto-save event');
        }
        
        // Update status badge if status changed
        updateStatusBadge(formData.status);
        
        // Show success indicator
        indicator.textContent = 'Auto-saved';
        indicator.classList.remove('saving');
        
        // Hide indicator after 2 seconds
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
        
        console.log('✅ Event auto-saved');
        
    } catch (error) {
        console.error('Error auto-saving event:', error);
        
        // Show error indicator
        indicator.textContent = 'Save failed';
        indicator.classList.remove('saving');
        indicator.style.background = 'rgba(239, 68, 68, 0.9)';
        
        // Hide indicator after 3 seconds
        setTimeout(() => {
            indicator.classList.remove('show');
            indicator.style.background = '';
        }, 3000);
    }
}

// Show add company modal
async function showAddCompanyModal() {
    try {
        const token = localStorage.getItem('token');
        const eventId = new URLSearchParams(window.location.search).get('id');
        
        // Get all companies
        const companiesResponse = await fetch('/api/admin/companies', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!companiesResponse.ok) {
            throw new Error('Failed to load companies');
        }
        
        const allCompanies = await companiesResponse.json();
        
        // Get already assigned companies
        const assignedResponse = await fetch(`/api/admin/events/${eventId}/companies`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!assignedResponse.ok) {
            throw new Error('Failed to load assigned companies');
        }
        
        const assignedCompanies = await assignedResponse.json();
        const assignedIds = assignedCompanies.map(c => c.id);
        
        // Filter out already assigned companies
        const availableCompanies = allCompanies.filter(company => !assignedIds.includes(company.id));
        
        const select = document.getElementById('companyToAssign');
        
        // Clear existing options
        select.innerHTML = '<option value="">Select a company</option>';
        
        if (availableCompanies.length === 0) {
            select.innerHTML = '<option value="">All companies are already assigned</option>';
            select.disabled = true;
        } else {
            // Add available company options
            availableCompanies.forEach(company => {
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = company.name;
                select.appendChild(option);
            });
        }
        
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

// Load crew approvals
async function loadCrewApprovals(eventId) {
    try {
        const token = localStorage.getItem('token');
        console.log('Loading crew approvals for event:', eventId);
        console.log('Token exists:', !!token);
        console.log('Token length:', token ? token.length : 0);
        
        const response = await fetch(`/api/admin/events/${eventId}/crew-approvals`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('Approvals response status:', response.status);
        console.log('Approvals response ok:', response.ok);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Approvals response error text:', errorText);
            throw new Error(`Failed to load crew approvals: ${response.status} ${errorText}`);
        }
        
        const approvals = await response.json();
        console.log('Crew approvals data:', approvals);
        displayCrewApprovals(approvals);
        
    } catch (error) {
        console.error('Error loading crew approvals:', error);
        showMessage('Failed to load crew approvals', 'error');
    }
}

// Display crew approvals
function displayCrewApprovals(approvals) {
    const tbody = document.getElementById('crewApprovalsTableBody');
    
    if (approvals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-approvals">No pending approvals for this event</td></tr>';
        return;
    }
    
    let html = '';
    approvals.forEach(approval => {
        const requestedDate = new Date(approval.created_at).toLocaleDateString();
        const accessLevel = approval.access_level || 'No Clearance';
        const companyName = approval.company_name || 'No Company';
        
        html += `
            <tr>
                <td>${approval.first_name} ${approval.last_name}</td>
                <td>${companyName}</td>
                <td>${approval.email}</td>
                <td>${approval.role}</td>
                <td>${requestedDate}</td>
                <td>
                    <select class="access-level-select" data-crew-id="${approval.id}">
                        <option value="No Clearance" ${accessLevel === 'No Clearance' ? 'selected' : ''}>No Clearance</option>
                        <option value="RESTRICTED" ${accessLevel === 'RESTRICTED' ? 'selected' : ''}>Restricted</option>
                        <option value="STANDARD" ${accessLevel === 'STANDARD' ? 'selected' : ''}>Standard</option>
                        <option value="EXTENDED" ${accessLevel === 'EXTENDED' ? 'selected' : ''}>Extended</option>
                        <option value="FULL" ${accessLevel === 'FULL' ? 'selected' : ''}>Full</option>
                        <option value="ADMIN" ${accessLevel === 'ADMIN' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td>
                    <div class="approval-actions">
                        <button class="btn-view" data-crew-id="${approval.id}" data-action="view">View</button>
                        <button class="btn-approve" data-crew-id="${approval.id}" data-action="approve">Approve</button>
                        <button class="btn-reject" data-crew-id="${approval.id}" data-action="reject">Reject</button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    // Add event listeners for approval actions
    tbody.addEventListener('click', (e) => {
        const button = e.target.closest('[data-action]');
        if (!button) return;
        
        const crewId = button.dataset.crewId;
        const action = button.dataset.action;
        
        switch (action) {
            case 'view':
                viewCrewDetails(crewId);
                break;
            case 'approve':
                approveCrewMember(crewId);
                break;
            case 'reject':
                rejectCrewMember(crewId);
                break;
        }
    });
    
    // Add event listeners for access level changes
    tbody.addEventListener('change', (e) => {
        if (e.target.classList.contains('access-level-select')) {
            const crewId = e.target.dataset.crewId;
            const accessLevel = e.target.value;
            updateAccessLevel(crewId, accessLevel);
        }
    });
}

// Update access level for crew member
async function updateAccessLevel(crewId, accessLevel) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/crew/${crewId}/access-level`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ access_level: accessLevel })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update access level');
        }
        
        showMessage('Access level updated successfully', 'success');
        
    } catch (error) {
        console.error('Error updating access level:', error);
        showMessage('Failed to update access level', 'error');
    }
}

// View crew member details
async function viewCrewDetails(crewId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/crew/${crewId}/details`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load crew details');
        }
        
        const details = await response.json();
        showCrewDetailsModal(details);
        
    } catch (error) {
        console.error('Error loading crew details:', error);
        showMessage('Failed to load crew details', 'error');
    }
}

// Show crew details modal
function showCrewDetailsModal(details) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    // Create badge-like popup with photo
    const photoSection = details.photo_path ? 
        `<div class="badge-photo">
            <img class="crew-photo-img" src="${details.photo_path}" alt="Crew Photo" style="width: 120px; height: 120px; border-radius: 8px; object-fit: cover;">
            <div class="photo-error-fallback" style="width: 120px; height: 120px; border-radius: 8px; background: #fee2e2; display: none; align-items: center; justify-content: center; color: #991b1b; text-align: center; font-size: 10px;">
                Photo failed to load<br>
                <small style="word-break: break-all;">${details.photo_path}</small>
            </div>
        </div>` : 
        `<div class="badge-photo">
            <div style="width: 120px; height: 120px; border-radius: 8px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #666;">
                No Photo
            </div>
        </div>`;
    
    modal.innerHTML = `
        <div class="modal-content badge-modal">
            <div class="modal-header">
                <h3>🏷️ Crew Badge Details</h3>
                <button class="close-modal" data-action="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="badge-container">
                    ${photoSection}
                    <div class="badge-info">
                        <h4>${details.first_name} ${details.last_name}</h4>
                        <div class="badge-field">
                            <strong>Role:</strong> ${details.role}
                        </div>
                        <div class="badge-field">
                            <strong>Email:</strong> ${details.email}
                        </div>
                        <div class="badge-field">
                            <strong>Badge #:</strong> ${details.badge_number || 'Not assigned'}
                        </div>
                        <div class="badge-field">
                            <strong>Access Level:</strong> ${details.access_level || 'Not set'}
                        </div>
                        <div class="badge-field">
                            <strong>Status:</strong> 
                            <span class="status-badge ${details.status}">${details.status}</span>
                        </div>
                        <div class="badge-field">
                            <strong>Requested:</strong> ${new Date(details.created_at).toLocaleString()}
                        </div>
                        ${details.approved_at ? `
                        <div class="badge-field">
                            <strong>Approved:</strong> ${new Date(details.approved_at).toLocaleString()}
                        </div>` : ''}
                        ${details.company_name ? `
                        <div class="badge-field">
                            <strong>Company:</strong> ${details.company_name}
                        </div>` : ''}
                        ${details.event_name ? `
                        <div class="badge-field">
                            <strong>Event:</strong> ${details.event_name}
                        </div>` : ''}
                        ${details.event_location ? `
                        <div class="badge-field">
                            <strong>Location:</strong> ${details.event_location}
                        </div>` : ''}
                        ${details.event_start_date ? `
                        <div class="badge-field">
                            <strong>Event Dates:</strong> ${formatEventDates(details.event_start_date, details.event_end_date)}
                        </div>` : ''}
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" data-action="close-modal">Close</button>
            </div>
        </div>
    `;
    
    // Add event listeners for the modal
    const closeButtons = modal.querySelectorAll('[data-action="close-modal"]');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            modal.remove();
        });
    });
    
    // Handle image loading errors
    const crewImg = modal.querySelector('.crew-photo-img');
    if (crewImg) {
        crewImg.addEventListener('error', () => {
            crewImg.style.display = 'none';
            const errorFallback = modal.querySelector('.photo-error-fallback');
            if (errorFallback) {
                errorFallback.style.display = 'flex';
            }
        });
    }
    
    document.body.appendChild(modal);
}

// Approve crew member
async function approveCrewMember(crewId) {
    if (!confirm('Are you sure you want to approve this crew member?')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/approvals/${crewId}/approve`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to approve crew member');
        }
        
        showMessage('Crew member approved successfully', 'success');
        
        // Reload approvals
        const eventId = new URLSearchParams(window.location.search).get('id');
        loadCrewApprovals(eventId);
        
    } catch (error) {
        console.error('Error approving crew member:', error);
        showMessage('Failed to approve crew member', 'error');
    }
}

// Reject crew member
async function rejectCrewMember(crewId) {
    if (!confirm('Are you sure you want to reject this crew member?')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/approvals/${crewId}/reject`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to reject crew member');
        }
        
        showMessage('Crew member rejected successfully', 'success');
        
        // Reload approvals
        const eventId = new URLSearchParams(window.location.search).get('id');
        loadCrewApprovals(eventId);
        
    } catch (error) {
        console.error('Error rejecting crew member:', error);
        showMessage('Failed to reject crew member', 'error');
    }
}

// Load approved crew members
async function loadApprovedCrew(eventId, companyId = null) {
    try {
        const token = localStorage.getItem('token');
        console.log('Loading approved crew for event:', eventId);
        console.log('Token exists:', !!token);
        console.log('Token length:', token ? token.length : 0);
        
        let url = `/api/admin/events/${eventId}/approved-crew`;
        if (companyId) {
            url += `?company_id=${companyId}`;
        }
        
        console.log('Requesting URL:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error text:', errorText);
            throw new Error(`Failed to load approved crew: ${response.status} ${errorText}`);
        }
        
        const approvedCrew = await response.json();
        console.log('Approved crew data:', approvedCrew);
        displayApprovedCrew(approvedCrew);
        
    } catch (error) {
        console.error('Error loading approved crew:', error);
        showMessage('Failed to load approved crew', 'error');
    }
}

// Display approved crew members
function displayApprovedCrew(approvedCrew) {
    const tbody = document.getElementById('approvedCrewTableBody');
    
    if (approvedCrew.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-approved-crew">No approved crew members for this event</td></tr>';
        return;
    }
    
    let html = '';
    approvedCrew.forEach(crew => {
        const approvedDate = new Date(crew.approved_at).toLocaleDateString();
        const accessLevel = crew.access_level || 'No Clearance';
        const companyName = crew.company_name || 'No Company';
        
        html += `
            <tr>
                <td>${crew.first_name} ${crew.last_name}</td>
                <td>${companyName}</td>
                <td>${crew.email}</td>
                <td>${crew.role}</td>
                <td>${accessLevel}</td>
                <td>${approvedDate}</td>
                <td>
                    <div class="crew-actions">
                        <button class="btn-view" data-crew-id="${crew.id}" data-action="view">View</button>
                        <button class="btn-download" data-crew-id="${crew.id}" data-action="download-pdf" title="Download A5 Badge PDF">📄 PDF</button>
                        <button class="btn-print" data-crew-id="${crew.id}" data-action="print-badge" title="Print A5 Badge">🖨️ Print</button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    // Add event listeners for action buttons in approved crew table
    tbody.addEventListener('click', (e) => {
        const button = e.target.closest('[data-action]');
        if (!button) return;
        
        const crewId = button.dataset.crewId;
        const action = button.dataset.action;
        
        switch (action) {
            case 'view':
                viewCrewDetails(crewId);
                break;
            case 'download-pdf':
                downloadBadgePDF(crewId);
                break;
            case 'print-badge':
                printBadge(crewId);
                break;
        }
    });
}

// Download badge PDF
async function downloadBadgePDF(crewId) {
    try {
        const token = localStorage.getItem('token');
        const eventId = new URLSearchParams(window.location.search).get('id');
        
        showMessage('Generating badge PDF...', 'info');
        
        const response = await fetch(`/api/admin/crew/${crewId}/badge/pdf?eventId=${eventId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate badge PDF');
        }
        
        // Get the PDF blob and download it
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Get crew member name for filename
        const detailsResponse = await fetch(`/api/admin/crew/${crewId}/details`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const details = await detailsResponse.json();
        const filename = `badge_${details.first_name}_${details.last_name}_${details.badge_number}.pdf`;
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showMessage('Badge PDF downloaded successfully', 'success');
        
    } catch (error) {
        console.error('Error downloading badge PDF:', error);
        showMessage('Failed to download badge PDF: ' + error.message, 'error');
    }
}

// Print badge
async function printBadge(crewId) {
    try {
        const token = localStorage.getItem('token');
        const eventId = new URLSearchParams(window.location.search).get('id');
        
        showMessage('Preparing badge for printing...', 'info');
        
        const response = await fetch(`/api/admin/crew/${crewId}/badge/pdf?eventId=${eventId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate badge for printing');
        }
        
        // Get the PDF blob and create object URL
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Open in new window for printing
        const printWindow = window.open(url, '_blank');
        
        if (printWindow) {
            printWindow.onload = () => {
                // Auto-trigger print dialog after a short delay
                setTimeout(() => {
                    printWindow.print();
                }, 500);
            };
            
            showMessage('Badge opened for printing', 'success');
        } else {
            showMessage('Please allow pop-ups to print badges', 'error');
        }
        
        // Cleanup after some time
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
        }, 30000); // 30 seconds
        
    } catch (error) {
        console.error('Error printing badge:', error);
        showMessage('Failed to prepare badge for printing: ' + error.message, 'error');
    }
}

// Badge Template Management Functions

// Load badge template configuration for the event
async function loadBadgeTemplate(eventId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}/badge-template`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load badge template configuration');
        }
        
        const template = await response.json();
        populateBadgeTemplateForm(template);
        
    } catch (error) {
        console.error('Error loading badge template:', error);
        showMessage('Failed to load badge template configuration', 'error');
    }
}

// Populate badge template form with existing data
function populateBadgeTemplateForm(template) {
    // Set checkbox for custom badge usage
    document.getElementById('useCustomBadge').checked = template.useCustomBadge || false;
    
    // Set template name
    document.getElementById('templateName').value = template.templateName || '';
    
    // Populate field mapping if available
    const fieldMapping = template.fieldMapping || {};
    
    // Set display options
    document.getElementById('showPhoto').checked = fieldMapping.show_photo !== false;
    document.getElementById('showName').checked = fieldMapping.show_name !== false;
    document.getElementById('showRole').checked = fieldMapping.show_role !== false;
    document.getElementById('showCompany').checked = fieldMapping.show_company !== false;
    document.getElementById('showBadgeNumber').checked = fieldMapping.show_badge_number !== false;
    document.getElementById('showAccessLevel').checked = fieldMapping.show_access_level !== false;
    document.getElementById('showEventDetails').checked = fieldMapping.show_event_details !== false;
    document.getElementById('showAccessZones').checked = fieldMapping.show_access_zones || false;
    document.getElementById('showQRCode').checked = fieldMapping.show_qr_code !== false;
    
    // Set color scheme
    document.getElementById('backgroundColor').value = fieldMapping.background_color || '#1B5E20';
    document.getElementById('textColor').value = fieldMapping.text_color || '#FFFFFF';
    document.getElementById('accentColor').value = fieldMapping.accent_color || '#FFD700';
    
    // Update form visibility based on custom badge setting
    updateBadgeTemplateFormVisibility();
}

// Update form visibility based on custom badge checkbox
function updateBadgeTemplateFormVisibility() {
    const useCustomBadge = document.getElementById('useCustomBadge').checked;
    const templateNameGroup = document.getElementById('templateNameGroup');
    const templateUploadGroup = document.getElementById('templateUploadGroup');
    const fieldMappingCard = document.getElementById('fieldMappingCard');
    
    if (useCustomBadge) {
        templateNameGroup.style.opacity = '1';
        templateNameGroup.style.pointerEvents = 'auto';
        templateUploadGroup.style.opacity = '1';
        templateUploadGroup.style.pointerEvents = 'auto';
        fieldMappingCard.style.opacity = '1';
        fieldMappingCard.style.pointerEvents = 'auto';
    } else {
        templateNameGroup.style.opacity = '0.5';
        templateNameGroup.style.pointerEvents = 'none';
        templateUploadGroup.style.opacity = '0.5';
        templateUploadGroup.style.pointerEvents = 'none';
        fieldMappingCard.style.opacity = '0.5';
        fieldMappingCard.style.pointerEvents = 'none';
    }
}

// Save badge template configuration
async function saveBadgeTemplate() {
    try {
        const eventId = new URLSearchParams(window.location.search).get('id');
        const token = localStorage.getItem('token');
        
        // Collect form data
        const templateConfig = {
            templateName: document.getElementById('templateName').value,
            useCustomBadge: document.getElementById('useCustomBadge').checked,
            fieldMapping: {
                show_photo: document.getElementById('showPhoto').checked,
                show_name: document.getElementById('showName').checked,
                show_role: document.getElementById('showRole').checked,
                show_company: document.getElementById('showCompany').checked,
                show_badge_number: document.getElementById('showBadgeNumber').checked,
                show_access_level: document.getElementById('showAccessLevel').checked,
                show_event_details: document.getElementById('showEventDetails').checked,
                show_access_zones: document.getElementById('showAccessZones').checked,
                show_qr_code: document.getElementById('showQRCode').checked,
                background_color: document.getElementById('backgroundColor').value,
                text_color: document.getElementById('textColor').value,
                accent_color: document.getElementById('accentColor').value
            }
        };
        
        showMessage('Saving badge template configuration...', 'info');
        
        const response = await fetch(`/api/admin/events/${eventId}/badge-template`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(templateConfig)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save badge template configuration');
        }
        
        const result = await response.json();
        showMessage('Badge template configuration saved successfully', 'success');
        
        // Update approved crew table buttons to use custom badge
        updateCrewActionButtons();
        
    } catch (error) {
        console.error('Error saving badge template:', error);
        showMessage('Failed to save badge template configuration: ' + error.message, 'error');
    }
}

// Update crew action buttons to include custom badge options
function updateCrewActionButtons() {
    const approvedCrewRows = document.querySelectorAll('#approvedCrewTableBody tr');
    
    approvedCrewRows.forEach(row => {
        const actionsCell = row.querySelector('.crew-actions');
        if (actionsCell && !actionsCell.querySelector('[data-action="download-custom-pdf"]')) {
            const crewId = actionsCell.querySelector('[data-crew-id]')?.dataset.crewId;
            if (crewId) {
                // Add custom badge buttons
                const customPdfBtn = document.createElement('button');
                customPdfBtn.className = 'btn-custom';
                customPdfBtn.dataset.crewId = crewId;
                customPdfBtn.dataset.action = 'download-custom-pdf';
                customPdfBtn.title = 'Download Custom Badge PDF';
                customPdfBtn.innerHTML = '🎨 Custom';
                
                const customPrintBtn = document.createElement('button');
                customPrintBtn.className = 'btn-custom';
                customPrintBtn.dataset.crewId = crewId;
                customPrintBtn.dataset.action = 'print-custom-badge';
                customPrintBtn.title = 'Print Custom Badge';
                customPrintBtn.innerHTML = '🖨️ Custom';
                
                actionsCell.appendChild(customPdfBtn);
                actionsCell.appendChild(customPrintBtn);
            }
        }
    });
    
    // Add event listeners for custom badge actions
    document.getElementById('approvedCrewTableBody').addEventListener('click', (e) => {
        const button = e.target.closest('[data-action]');
        if (!button) return;
        
        const crewId = button.dataset.crewId;
        const action = button.dataset.action;
        
        if (action === 'download-custom-pdf') {
            downloadCustomBadgePDF(crewId);
        } else if (action === 'print-custom-badge') {
            printCustomBadge(crewId);
        }
    });
}

// Download custom badge PDF
async function downloadCustomBadgePDF(crewId) {
    try {
        const token = localStorage.getItem('token');
        const eventId = new URLSearchParams(window.location.search).get('id');
        
        showMessage('Generating custom badge PDF...', 'info');
        
        const response = await fetch(`/api/admin/crew/${crewId}/badge/custom-pdf?eventId=${eventId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate custom badge PDF');
        }
        
        // Get the PDF blob and download it
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Get crew member name for filename
        const detailsResponse = await fetch(`/api/admin/crew/${crewId}/details`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const details = await detailsResponse.json();
        const filename = `badge_${details.first_name}_${details.last_name}_${details.badge_number}_custom.pdf`;
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showMessage('Custom badge PDF downloaded successfully', 'success');
        
    } catch (error) {
        console.error('Error downloading custom badge PDF:', error);
        showMessage('Failed to download custom badge PDF: ' + error.message, 'error');
    }
}

// Print custom badge
async function printCustomBadge(crewId) {
    try {
        const token = localStorage.getItem('token');
        const eventId = new URLSearchParams(window.location.search).get('id');
        
        showMessage('Preparing custom badge for printing...', 'info');
        
        const response = await fetch(`/api/admin/crew/${crewId}/badge/custom-pdf?eventId=${eventId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate custom badge for printing');
        }
        
        // Get the PDF blob and create object URL
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Open in new window for printing
        const printWindow = window.open(url, '_blank');
        
        if (printWindow) {
            printWindow.onload = () => {
                // Auto-trigger print dialog after a short delay
                setTimeout(() => {
                    printWindow.print();
                }, 500);
            };
            
            showMessage('Custom badge opened for printing', 'success');
        } else {
            showMessage('Please allow pop-ups to print badges', 'error');
        }
        
        // Cleanup after some time
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
        }, 30000); // 30 seconds
        
    } catch (error) {
        console.error('Error printing custom badge:', error);
        showMessage('Failed to prepare custom badge for printing: ' + error.message, 'error');
    }
}

// Preview badge template
async function previewBadgeTemplate() {
    try {
        showMessage('Generating template preview...', 'info');
        
        // For now, show a simple preview message
        // In a full implementation, you would generate a sample badge
        const previewContainer = document.querySelector('.template-preview');
        
        previewContainer.innerHTML = `
            <div class="preview-content">
                <h4>Template Preview</h4>
                <p>Custom badge template is configured and ready to use.</p>
                <p><strong>Template Name:</strong> ${document.getElementById('templateName').value || 'Unnamed Template'}</p>
                <p><strong>Background Color:</strong> ${document.getElementById('backgroundColor').value}</p>
                <p><strong>Text Color:</strong> ${document.getElementById('textColor').value}</p>
                <p><strong>Accent Color:</strong> ${document.getElementById('accentColor').value}</p>
                <p><em>Custom badges will be generated with the World Pool Championship style as shown in your reference image.</em></p>
            </div>
        `;
        
        showMessage('Template preview updated', 'success');
        
    } catch (error) {
        console.error('Error generating template preview:', error);
        showMessage('Failed to generate template preview', 'error');
    }
}

// Setup badge template event listeners
function setupBadgeTemplateListeners() {
    // Use custom badge checkbox
    document.getElementById('useCustomBadge').addEventListener('change', updateBadgeTemplateFormVisibility);
    
    // Save template button
    document.getElementById('saveBadgeTemplate').addEventListener('click', saveBadgeTemplate);
    
    // Preview template buttons
    document.getElementById('previewCustomBadge').addEventListener('click', previewBadgeTemplate);
    document.getElementById('generatePreview').addEventListener('click', previewBadgeTemplate);
}