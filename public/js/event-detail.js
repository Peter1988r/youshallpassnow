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
    loadCrewApprovals(eventId);
    loadApprovedCrew(eventId);
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

// Load crew approvals for this event
async function loadCrewApprovals(eventId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}/crew-approvals`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load crew approvals');
        }
        
        const approvals = await response.json();
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
        tbody.innerHTML = '<tr><td colspan="6" class="no-approvals">No pending approvals for this event</td></tr>';
        return;
    }
    
    let html = '';
    approvals.forEach(approval => {
        const requestedDate = new Date(approval.created_at).toLocaleDateString();
        const accessLevel = approval.access_level || 'No Clearance';
        
        html += `
            <tr>
                <td>${approval.first_name} ${approval.last_name}</td>
                <td>${approval.email}</td>
                <td>${approval.role}</td>
                <td>${requestedDate}</td>
                <td>
                    <select class="access-level-select" onchange="updateAccessLevel(${approval.id}, this.value)">
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
                        <button class="btn-view" onclick="viewCrewDetails(${approval.id})">View</button>
                        <button class="btn-approve" onclick="approveCrewMember(${approval.id})">Approve</button>
                        <button class="btn-reject" onclick="rejectCrewMember(${approval.id})">Reject</button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
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
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Crew Member Details</h3>
                <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="crew-details">
                    <p><strong>Name:</strong> ${details.first_name} ${details.last_name}</p>
                    <p><strong>Email:</strong> ${details.email}</p>
                    <p><strong>Role:</strong> ${details.role}</p>
                    <p><strong>Badge Number:</strong> ${details.badge_number}</p>
                    <p><strong>Status:</strong> ${details.status}</p>
                    <p><strong>Requested:</strong> ${new Date(details.created_at).toLocaleString()}</p>
                    ${details.approved_at ? `<p><strong>Approved:</strong> ${new Date(details.approved_at).toLocaleString()}</p>` : ''}
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Approve crew member
async function approveCrewMember(crewId) {
    if (!confirm('Are you sure you want to approve this crew member?')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/crew/${crewId}/approve`, {
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
        const response = await fetch(`/api/admin/crew/${crewId}/reject`, {
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
        let url = `/api/admin/events/${eventId}/approved-crew`;
        if (companyId) {
            url += `?company_id=${companyId}`;
        }
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load approved crew');
        }
        
        const approvedCrew = await response.json();
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
        tbody.innerHTML = '<tr><td colspan="6" class="no-approved-crew">No approved crew members for this event</td></tr>';
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
                <td>${crew.email}</td>
                <td>${crew.role}</td>
                <td>${companyName}</td>
                <td>${accessLevel}</td>
                <td>${approvedDate}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
} 