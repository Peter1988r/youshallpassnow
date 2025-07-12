// Force dark mode permanently
document.documentElement.setAttribute('data-theme', 'dark');
localStorage.removeItem('theme'); // Clear any stored theme preference

document.addEventListener('DOMContentLoaded', () => {
    console.log('Event detail page loaded, initializing...');
    
    // Check super admin authentication
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No token found, redirecting to signin');
        window.location.href = '/signin';
        return;
    }

    // Check user role and hide badge template features for non-Super Admins
    const userStr = localStorage.getItem('user');
    if (userStr) {
        const user = JSON.parse(userStr);
        if (!user.is_super_admin) {
            // Hide badge template tab and section for Company Admins
            const badgeTemplateTab = document.querySelector('[data-tab="badge-template"]');
            const badgeTemplateSection = document.querySelector('[data-tab="badge-template"].tab-panel');
            
            if (badgeTemplateTab) {
                badgeTemplateTab.style.display = 'none';
            }
            if (badgeTemplateSection) {
                badgeTemplateSection.style.display = 'none';
            }
            
            console.log('Badge template features hidden for Company Admin');
        }
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
    
    // Load event photo if available
    if (event.event_photo_path) {
        const eventPhotoPreviewImg = document.getElementById('eventPhotoPreviewImg');
        const eventPhotoPreview = document.getElementById('eventPhotoPreview');
        
        eventPhotoPreviewImg.src = event.event_photo_path;
        eventPhotoPreview.style.display = 'block';
    }
    
    // Load event layout if available
    if (event.event_layout_path) {
        const eventLayoutPreviewImg = document.getElementById('eventLayoutPreviewImg');
        const eventLayoutPreview = document.getElementById('eventLayoutPreview');
        
        if (eventLayoutPreviewImg && eventLayoutPreview) {
            eventLayoutPreviewImg.src = event.event_layout_path;
            eventLayoutPreview.style.display = 'block';
        }
    }
    
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
    setupZoneManagement();
    
    // Event photo upload functionality
    setupEventPhotoUpload();
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
    
    if (tabName === 'access') {
        loadEventZones(eventId);
    } else if (tabName === 'approvals') {
        loadCrewApprovals(eventId);
    } else if (tabName === 'accredited') {
        const companyFilter = document.getElementById('companyFilter');
        const filterValue = companyFilter ? companyFilter.value : '';
        loadApprovedCrew(eventId, filterValue || null);
    } else if (tabName === 'badge-template') {
        // Only initialize template editor once to prevent duplicate listeners
        if (!templateEditor.initialized) {
            setupBadgeTemplateListeners();
            templateEditor.initialized = true;
        }
        loadBadgeTemplate(eventId);
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

// ===== ZONE MANAGEMENT FUNCTIONS =====
function setupZoneManagement() {
    const addZoneBtn = document.getElementById('addZoneBtn');
    if (addZoneBtn) {
        addZoneBtn.addEventListener('click', showAddZoneForm);
    }
    
    // Setup event layout image upload
    setupEventLayoutUpload();
}

// Global variable to store current event zones
let eventZones = [];

// Load access zones for the event
async function loadEventZones(eventId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}/zones`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load event zones');
        }
        
        eventZones = await response.json();
        displayEventZones(eventZones);
        updateZoneCount(eventZones.length);
        
    } catch (error) {
        console.error('Error loading event zones:', error);
        // If endpoint doesn't exist yet, initialize empty zones
        eventZones = [];
        displayEventZones(eventZones);
        updateZoneCount(0);
    }
}

// Display event zones in the UI
function displayEventZones(zones) {
    const zonesList = document.getElementById('zonesList');
    const noZonesMessage = document.getElementById('noZonesMessage');
    
    if (zones.length === 0) {
        if (noZonesMessage) {
            noZonesMessage.style.display = 'block';
        }
        if (zonesList) {
            zonesList.innerHTML = '';
        }
        return;
    }
    
    if (noZonesMessage) {
        noZonesMessage.style.display = 'none';
    }
    
    let html = '';
    zones.forEach((zone, index) => {
        const isDefault = zone.is_default || false;
        html += `
            <div class="zone-item" data-zone-id="${index}" data-zone-db-id="${zone.id || ''}">
                <div class="zone-number">${zone.zone_number}</div>
                <div class="zone-info">
                    <div class="zone-name" data-original="${zone.area_name}">${zone.area_name}</div>
                    <div class="zone-description">Zone ${zone.zone_number} • Area Access Control</div>
                </div>
                <div class="zone-default-setting">
                    <label class="default-checkbox">
                        <input type="checkbox" ${isDefault ? 'checked' : ''} onchange="toggleDefaultZone(${index}, this.checked)">
                        <span class="checkbox-label">Default Zone</span>
                    </label>
                    <small class="default-help">Check to auto-assign this zone to new crew members</small>
                </div>
                <div class="zone-actions">
                    <button class="btn-edit-zone" onclick="editZone(${index})">
                        ✏️ Edit
                    </button>
                    <button class="btn-delete-zone" onclick="deleteZone(${index})">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    });
    
    if (zonesList) {
        zonesList.innerHTML = html;
    }
}

// Update zone count display
function updateZoneCount(count) {
    const zoneCountElement = document.getElementById('zoneCount');
    if (zoneCountElement) {
        zoneCountElement.textContent = count;
    }
}

// Show add zone form
function showAddZoneForm() {
    if (eventZones.length >= 21) {
        showMessage('Maximum of 21 zones allowed per event', 'error');
        return;
    }
    
    // Determine next zone number (0, 1, 2, etc.)
    const nextZoneNumber = eventZones.length === 0 ? 0 : Math.max(...eventZones.map(z => z.zone_number)) + 1;
    
    const formHtml = `
        <div class="add-zone-form active" id="addZoneForm">
            <h4>Add Zone ${nextZoneNumber}</h4>
            <div class="form-group">
                <label for="newZoneAreaName">Area Name</label>
                <input type="text" id="newZoneAreaName" placeholder="e.g., Paddock, Pit Lane, VIP Area" required>
                <small class="form-help">Enter a descriptive name for this access zone</small>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="cancelAddZone()">Cancel</button>
                <button type="button" class="btn-primary" onclick="saveNewZone(${nextZoneNumber})">Add Zone</button>
            </div>
        </div>
    `;
    
    const zonesList = document.getElementById('zonesList');
    if (zonesList) {
        zonesList.insertAdjacentHTML('afterbegin', formHtml);
    }
    
    // Focus on the input
    const newZoneInput = document.getElementById('newZoneAreaName');
    if (newZoneInput) {
        newZoneInput.focus();
    }
}

// Cancel adding zone
function cancelAddZone() {
    const form = document.getElementById('addZoneForm');
    if (form) {
        form.remove();
    }
}

// Save new zone
async function saveNewZone(zoneNumber) {
    const areaNameInput = document.getElementById('newZoneAreaName');
    if (!areaNameInput) {
        showMessage('Area name input not found', 'error');
        return;
    }
    
    const areaName = areaNameInput.value.trim();
    
    if (!areaName) {
        showMessage('Please enter an area name', 'error');
        areaNameInput.focus();
        return;
    }
    
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get('id');
        const token = localStorage.getItem('token');
        
        const response = await fetch(`/api/admin/events/${eventId}/zones`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                zone_number: zoneNumber,
                area_name: areaName
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create zone');
        }
        
        // Reload zones
        await loadEventZones(eventId);
        showMessage(`Zone ${zoneNumber} created successfully`, 'success');
        
        // Remove the form
        cancelAddZone();
        
    } catch (error) {
        console.error('Error creating zone:', error);
        showMessage('Failed to create zone', 'error');
    }
}

// Edit zone
async function editZone(zoneIndex) {
    const zone = eventZones[zoneIndex];
    if (!zone) return;
    
    const zoneItem = document.querySelector(`[data-zone-id="${zoneIndex}"]`);
    const zoneNameElement = zoneItem.querySelector('.zone-name');
    const actionsElement = zoneItem.querySelector('.zone-actions');
    
    // Add editing class
    zoneItem.classList.add('editing');
    
    // Replace name with input
    const originalName = zoneNameElement.dataset.original;
    zoneNameElement.innerHTML = `<input type="text" class="zone-name editable" value="${originalName}" data-zone-index="${zoneIndex}">`;
    
    // Replace actions with save/cancel
    actionsElement.innerHTML = `
        <button class="btn-save-zone" onclick="saveZoneEdit(${zoneIndex})">
            ✅ Save
        </button>
        <button class="btn-cancel-zone" onclick="cancelZoneEdit(${zoneIndex})">
            ❌ Cancel
        </button>
    `;
    
    // Focus on input
    const input = zoneNameElement.querySelector('input');
    input.focus();
    input.select();
}

// Save zone edit
async function saveZoneEdit(zoneIndex) {
    const zone = eventZones[zoneIndex];
    if (!zone) return;
    
    const zoneItem = document.querySelector(`[data-zone-id="${zone.id || zoneIndex}"]`);
    const input = zoneItem.querySelector('.zone-name input');
    const newAreaName = input.value.trim();
    
    if (!newAreaName) {
        showMessage('Please enter an area name', 'error');
        input.focus();
        return;
    }
    
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get('id');
        const token = localStorage.getItem('token');
        
        const response = await fetch(`/api/admin/events/${eventId}/zones/${zone.id || zoneIndex}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                area_name: newAreaName
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update zone');
        }
        
        // Update local data
        eventZones[zoneIndex].area_name = newAreaName;
        
        // Refresh display
        displayEventZones(eventZones);
        showMessage('Zone updated successfully', 'success');
        
    } catch (error) {
        console.error('Error updating zone:', error);
        showMessage('Failed to update zone', 'error');
        // Refresh display to revert changes
        displayEventZones(eventZones);
    }
}

// Cancel zone edit
function cancelZoneEdit(zoneIndex) {
    // Simply refresh the display to revert changes
    displayEventZones(eventZones);
}

// Delete zone
async function deleteZone(zoneIndex) {
    const zone = eventZones[zoneIndex];
    if (!zone) return;
    
    if (!confirm(`Are you sure you want to delete Zone ${zone.zone_number} (${zone.area_name})?\n\nThis will remove access to this zone from all crew members.`)) {
        return;
    }
    
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get('id');
        const token = localStorage.getItem('token');
        
        const response = await fetch(`/api/admin/events/${eventId}/zones/${zone.id || zoneIndex}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete zone');
        }
        
        // Reload zones
        await loadEventZones(eventId);
        showMessage(`Zone ${zone.zone_number} deleted successfully`, 'success');
        
    } catch (error) {
        console.error('Error deleting zone:', error);
        showMessage('Failed to delete zone', 'error');
    }
}

// Toggle default zone setting
async function toggleDefaultZone(zoneIndex, isDefault) {
    const zone = eventZones[zoneIndex];
    if (!zone) {
        console.error('Zone not found at index:', zoneIndex);
        return;
    }
    
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get('id');
        const token = localStorage.getItem('token');
        
        console.log('Toggling default zone:', {
            zoneIndex,
            zone,
            eventId,
            isDefault,
            zoneId: zone.id || zoneIndex,
            hasZoneId: !!zone.id
        });
        
        const response = await fetch(`/api/admin/events/${eventId}/zones/${zone.id || zoneIndex}/default`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_default: isDefault })
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', response.status, errorText);
            throw new Error(`Failed to update default zone setting: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Success result:', result);
        
        // Update local zone data
        eventZones[zoneIndex].is_default = isDefault;
        
        const statusText = isDefault ? 'set as default' : 'removed from default';
        showMessage(`Zone ${zone.zone_number} ${statusText}`, 'success');
        
    } catch (error) {
        console.error('Error updating default zone:', error);
        showMessage('Failed to update default zone setting', 'error');
        
        // Revert checkbox state on error
        const checkbox = document.querySelector(`[data-zone-id="${zoneIndex}"] .default-checkbox input`);
        if (checkbox) {
            checkbox.checked = !isDefault;
        }
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
        const companyName = approval.company_name || 'No Company';
        const currentZones = approval.access_zones || [];
        
        // Generate zone checkboxes based on event zones
        let zoneHtml = '';
        if (eventZones.length === 0) {
            zoneHtml = '<small style="color: #666;">No zones defined</small>';
        } else {
            zoneHtml = '<div class="zone-checkboxes" data-crew-id="' + approval.id + '">';
            eventZones.forEach(zone => {
                // Check if zone is already assigned or if it's a default zone for new crew
                const isCurrentlyAssigned = currentZones.includes(zone.zone_number);
                const isDefaultZone = zone.is_default || false;
                const shouldBeChecked = isCurrentlyAssigned || (currentZones.length === 0 && isDefaultZone);
                
                const defaultIndicator = isDefaultZone ? ' <span class="default-indicator" title="Default zone">⭐</span>' : '';
                
                zoneHtml += `
                    <label class="zone-checkbox ${isDefaultZone ? 'default-zone' : ''}">
                        <input type="checkbox" value="${zone.zone_number}" ${shouldBeChecked ? 'checked' : ''}>
                        Zone ${zone.zone_number}${defaultIndicator}
                    </label>
                `;
            });
            zoneHtml += '</div>';
        }
        
        html += `
            <tr>
                <td>${approval.first_name} ${approval.last_name}</td>
                <td>${companyName}</td>
                <td>${approval.email}</td>
                <td>${approval.role}</td>
                <td>${requestedDate}</td>
                <td>
                    ${zoneHtml}
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
    
    // Remove existing event listeners by cloning and replacing the tbody
    const newTbody = tbody.cloneNode(false);
    tbody.parentNode.replaceChild(newTbody, tbody);
    
    // Set the HTML content on the clean tbody
    newTbody.innerHTML = html;
    
    // Add event listeners for approval actions
    newTbody.addEventListener('click', (e) => {
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
    
    // Add event listeners for zone checkbox changes
    newTbody.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox' && e.target.closest('.zone-checkboxes')) {
            const crewId = e.target.closest('.zone-checkboxes').dataset.crewId;
            updateCrewAccessZones(crewId);
        }
    });
}

// Update access zones for crew member
async function updateCrewAccessZones(crewId) {
    try {
        // Get all selected zones for this crew member
        const zoneCheckboxes = document.querySelector(`.zone-checkboxes[data-crew-id="${crewId}"]`);
        if (!zoneCheckboxes) return;
        
        const selectedZones = [];
        zoneCheckboxes.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            selectedZones.push(parseInt(checkbox.value));
        });
        
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/crew/${crewId}/access-zones`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ access_zones: selectedZones })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update access zones');
        }
        
        const zoneNames = selectedZones.length > 0 ? 
            selectedZones.map(z => `Zone ${z}`).join(', ') : 
            'No zones';
        showMessage(`Access zones updated: ${zoneNames}`, 'success');
        
    } catch (error) {
        console.error('Error updating access zones:', error);
        showMessage('Failed to update access zones', 'error');
    }
}

// Update access level for crew member (legacy function)
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
                            <strong>Access Zones:</strong> ${details.access_zones && Array.isArray(details.access_zones) && details.access_zones.length > 0 ? details.access_zones.map(zone => `Zone ${zone}`).join(', ') : 'No zones assigned'}
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
        const companyName = crew.company_name || 'No Company';
        const assignedZones = crew.access_zones || [];
        
        // Generate zone tags for display
        let zoneHtml = '';
        if (assignedZones.length === 0) {
            zoneHtml = '<div class="zone-tags"><span class="zone-tag no-zones">No zones assigned</span></div>';
        } else {
            zoneHtml = '<div class="zone-tags">';
            assignedZones.forEach(zoneNumber => {
                // Find zone name from eventZones
                const zone = eventZones.find(z => z.zone_number === zoneNumber);
                const zoneName = zone ? zone.area_name : `Zone ${zoneNumber}`;
                zoneHtml += `<span class="zone-tag" title="${zoneName}">Zone ${zoneNumber}</span>`;
            });
            zoneHtml += '</div>';
        }
        
        html += `
            <tr>
                <td>${crew.first_name} ${crew.last_name}</td>
                <td>${companyName}</td>
                <td>${crew.email}</td>
                <td>${crew.role}</td>
                <td>${zoneHtml}</td>
                <td>${approvedDate}</td>
                <td>
                    <div class="crew-actions">
                        <button class="btn-view" data-crew-id="${crew.id}" data-action="view">View</button>
                        <button class="btn-download" data-crew-id="${crew.id}" data-action="download-pdf" title="Download Badge PDF (Custom template if configured)">📄 PDF</button>
                        <button class="btn-print" data-crew-id="${crew.id}" data-action="print-badge" title="Print Badge (Custom template if configured)">🖨️ Print</button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    // Remove existing event listeners by cloning and replacing the tbody
    const newTbody = tbody.cloneNode(false);
    tbody.parentNode.replaceChild(newTbody, tbody);
    
    // Set the HTML content on the clean tbody
    newTbody.innerHTML = html;
    
    // Add event listeners for action buttons in approved crew table
    newTbody.addEventListener('click', (e) => {
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
        
        // Get crew member name for filename - filename will be auto-generated by server to include badge type
        const detailsResponse = await fetch(`/api/admin/crew/${crewId}/details`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const details = await detailsResponse.json();
        const filename = `badge_${details.first_name}_${details.last_name}_${details.badge_number}_auto.pdf`;
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showMessage('Badge PDF downloaded successfully (used custom template if configured)', 'success');
        
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
        // Check if user is super admin before attempting to load badge template
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            console.log('No user found in localStorage');
            return;
        }
        
        const user = JSON.parse(userStr);
        if (!user.is_super_admin) {
            console.log('Badge template access restricted to Super Admins only');
            return;
        }
        
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

// Populate badge template form with existing data (SIMPLIFIED VERSION)
function populateBadgeTemplateForm(template) {
    // Set checkbox for custom badge usage
    document.getElementById('useCustomBadge').checked = template.useCustomBadge || false;
    
    // Set template name
    document.getElementById('templateName').value = template.templateName || '';
    
    // Store original image dimensions if available
    if (template.originalWidth && template.originalHeight) {
        templateEditor.originalWidth = template.originalWidth;
        templateEditor.originalHeight = template.originalHeight;
        console.log('Restored original dimensions from database:', {
            originalWidth: templateEditor.originalWidth,
            originalHeight: templateEditor.originalHeight
        });
    }
    
    // Load existing template image and field layout if available
    const templateImagePath = template.templateImagePath || template.templatePath; // Support both new and legacy
    const fieldLayout = template.fieldLayout || template.fieldMapping?.field_positions || {};
    
    if (templateImagePath && Object.keys(fieldLayout).length > 0) {
        loadExistingTemplate(templateImagePath, fieldLayout);
    } else if (templateImagePath) {
        // Load template image even if no fields are positioned yet
        loadExistingTemplate(templateImagePath, {});
    }
    
    // Update form visibility based on custom badge setting
    updateBadgeTemplateFormVisibility();
}

// Load existing template and field positions
async function loadExistingTemplate(templatePath, fieldPositions) {
    try {
        // Create an image element to load the background
        const img = new Image();
        img.onload = function() {
            // Display the template background
            displayTemplateBackground(img, templatePath);
            
            // Set template data for persistence (convert base64 back to usable format if needed)
            if (templatePath.startsWith('data:')) {
                // Store the data URL for persistence
                templateEditor.templateDataUrl = templatePath;
            }
            
            // Wait a bit for the background to render, then restore field positions
            setTimeout(() => {
                restoreFieldPositions(fieldPositions);
            }, 100);
        };
        img.onerror = function() {
            console.warn('Failed to load existing template image');
            showMessage('Failed to load existing template image', 'warning');
        };
        img.src = templatePath;
        
    } catch (error) {
        console.error('Error loading existing template:', error);
    }
}

// Restore field positions from saved data
function restoreFieldPositions(fieldPositions) {
    try {
        // Clear existing positioned fields
        templateEditor.positionedFields.forEach((fieldElement) => {
            fieldElement.remove();
        });
        templateEditor.positionedFields.clear();
        
        // Restore each positioned field
        for (const [fieldType, position] of Object.entries(fieldPositions)) {
            // Convert relative coordinates back to display coordinates using original dimensions
            let x, y;
            
            if (position.x && position.y) {
                // Use absolute coordinates if available
                x = position.x;
                y = position.y;
            } else if (templateEditor.originalWidth && templateEditor.originalHeight) {
                // Convert from relative using original dimensions for accuracy
                const bgRect = templateEditor.backgroundImage.getBoundingClientRect();
                const scaleX = bgRect.width / templateEditor.originalWidth;
                const scaleY = bgRect.height / templateEditor.originalHeight;
                
                x = (position.relativeX * templateEditor.originalWidth) * scaleX;
                y = (position.relativeY * templateEditor.originalHeight) * scaleY;
                
                console.log('Restored field position using original dimensions:', {
                    fieldType,
                    relativePos: { x: position.relativeX, y: position.relativeY },
                    originalDimensions: { width: templateEditor.originalWidth, height: templateEditor.originalHeight },
                    displayDimensions: { width: bgRect.width, height: bgRect.height },
                    scale: { x: scaleX, y: scaleY },
                    restoredPos: { x, y }
                });
            } else {
                // Fallback to display dimensions (less accurate)
                x = position.relativeX * templateEditor.backgroundImage.offsetWidth;
                y = position.relativeY * templateEditor.backgroundImage.offsetHeight;
                console.warn('Restored field position using display dimensions (less accurate) - original dimensions not available');
            }
            
            const fieldElement = createPositionedField(fieldType, x, y);
            
            // Restore field size if available
            let width, height;
            if (position.relativeWidth && position.relativeHeight && templateEditor.originalWidth && templateEditor.originalHeight) {
                // Convert relative size using original dimensions for accuracy
                const bgRect = templateEditor.backgroundImage.getBoundingClientRect();
                const scaleX = bgRect.width / templateEditor.originalWidth;
                const scaleY = bgRect.height / templateEditor.originalHeight;
                
                width = (position.relativeWidth * templateEditor.originalWidth) * scaleX;
                height = (position.relativeHeight * templateEditor.originalHeight) * scaleY;
                
                fieldElement.style.width = width + 'px';
                fieldElement.style.height = height + 'px';
            } else if (position.width && position.height) {
                // Use absolute size as fallback
                width = position.width;
                height = position.height;
                fieldElement.style.width = width + 'px';
                fieldElement.style.height = height + 'px';
            }
            
            // Update size display
            if (width && height) {
                const sizeElement = fieldElement.querySelector('.field-size');
                if (sizeElement) {
                    sizeElement.textContent = `${Math.round(width)}×${Math.round(height)}`;
                }
            }
            
            // Restore styling if available - FIX FOR FONT PERSISTENCE
            if (position.styling) {
                fieldElement.classList.add('has-custom-styling');
                
                // Add styling indicator
                const indicator = document.createElement('div');
                indicator.className = 'styling-indicator';
                indicator.textContent = 'S';
                indicator.title = 'Custom styling applied';
                fieldElement.appendChild(indicator);
                
                // Apply visual styling to field label
                const fieldLabel = fieldElement.querySelector('.field-label');
                if (fieldLabel) {
                    fieldLabel.style.fontFamily = position.styling.font && position.styling.font.includes('Bold') ? 'bold' : 'normal';
                    fieldLabel.style.fontSize = Math.min(position.styling.fontSize || 12, 14) + 'px';
                    fieldLabel.style.color = position.styling.color || '#000000';
                }
                
                // Store the styling in templateEditor for persistence
                if (!templateEditor.fieldPositions[fieldType]) {
                    templateEditor.fieldPositions[fieldType] = {};
                }
                templateEditor.fieldPositions[fieldType].styling = position.styling;
            }
        }
        
        // Update field positions reference - ENSURE COMPLETE PERSISTENCE
        templateEditor.fieldPositions = JSON.parse(JSON.stringify(fieldPositions));
        
        console.log('Field positions restored:', Object.keys(fieldPositions).length, 'fields');
        showMessage('Template and field positions loaded successfully', 'success');
        
    } catch (error) {
        console.error('Error restoring field positions:', error);
        showMessage('Template loaded but field positions could not be restored', 'warning');
    }
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

// Save badge template configuration - FIX FOR MULTIPLE PDF ISSUE
async function saveBadgeTemplate() {
    try {
        // Check if user is super admin before attempting to save badge template
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            showMessage('Authentication required', 'error');
            return;
        }
        
        const user = JSON.parse(userStr);
        if (!user.is_super_admin) {
            showMessage('Badge template management is restricted to Super Admins only', 'error');
            return;
        }
        
        const eventId = new URLSearchParams(window.location.search).get('id');
        const token = localStorage.getItem('token');
        
        // Prevent multiple simultaneous saves
        const saveButton = document.getElementById('saveBadgeTemplate');
        if (saveButton.disabled) {
            return;
        }
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
        
        // Validate template configuration
        const useCustomBadge = document.getElementById('useCustomBadge').checked;
        
        if (useCustomBadge && !templateEditor.backgroundImage) {
            showMessage('Please upload a template image before saving', 'warning');
            saveButton.disabled = false;
            saveButton.textContent = 'Save Template';
            return;
        }
        
        if (useCustomBadge && Object.keys(templateEditor.fieldPositions).length === 0) {
            showMessage('Please position at least one field on the template before saving', 'warning');
            saveButton.disabled = false;
            saveButton.textContent = 'Save Template';
            return;
        }
        
        // Create FormData for file upload
        const formData = new FormData();
        
        // Add template file only if a new file is uploaded
        const templateFile = document.getElementById('templateFile').files[0];
        if (templateFile) {
            formData.append('templateFile', templateFile);
        }
        // Note: If no new file, the server will preserve the existing template image path
        
        // Add other form data
        formData.append('templateName', document.getElementById('templateName').value);
        formData.append('useCustomBadge', useCustomBadge);
        
        // Add original image dimensions if available (for new uploads)
        if (templateEditor.originalWidth && templateEditor.originalHeight) {
            formData.append('originalWidth', templateEditor.originalWidth);
            formData.append('originalHeight', templateEditor.originalHeight);
            console.log('Including original dimensions:', {
                originalWidth: templateEditor.originalWidth,
                originalHeight: templateEditor.originalHeight
            });
        }
        
        // Create simplified field layout object - ONLY positioned fields with styling
        const fieldLayout = templateEditor.fieldPositions;
        
        formData.append('fieldLayout', JSON.stringify(fieldLayout));
        
        showMessage('Saving badge template configuration...', 'info');
        
        const response = await fetch(`/api/admin/events/${eventId}/badge-template`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
                // Don't set Content-Type header - let browser set it for FormData
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error response:', {
                status: response.status,
                statusText: response.statusText,
                responseText: errorText,
                url: response.url,
                headers: Object.fromEntries(response.headers.entries())
            });
            
            // Show more specific error message
            let errorMessage = errorText;
            if (response.status === 403) {
                errorMessage = 'Access denied: Badge template management requires Super Admin privileges';
            } else if (response.status === 413) {
                errorMessage = 'Template file too large. Maximum size is 10MB';
            } else if (response.status === 500) {
                errorMessage = 'Server error while saving template. Please check console for details.';
            }
            
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        showMessage('Badge template configuration saved successfully', 'success');
        
        // Update template data for future saves
        if (result.templateImagePath) {
            templateEditor.templateDataUrl = result.templateImagePath;
        }
        
    } catch (error) {
        console.error('Error saving badge template:', error);
        showMessage('Failed to save badge template configuration: ' + error.message, 'error');
    } finally {
        // Re-enable save button
        const saveButton = document.getElementById('saveBadgeTemplate');
        saveButton.disabled = false;
        saveButton.textContent = 'Save Template';
    }
}

// Setup badge template event listeners - PREVENT DUPLICATE LISTENERS
function setupBadgeTemplateListeners() {
    // Prevent duplicate event listeners
    if (templateEditor.listenersSetup) {
        return;
    }
    
    // Use custom badge checkbox
    document.getElementById('useCustomBadge').addEventListener('change', updateBadgeTemplateFormVisibility);
    
    // Save template button
    document.getElementById('saveBadgeTemplate').addEventListener('click', saveBadgeTemplate);
    
    // Preview template buttons
    
    // Styling panel buttons
    document.getElementById('applyFieldStyling').addEventListener('click', applyFieldStyling);
    document.getElementById('closeFieldStyling').addEventListener('click', closeFieldStyling);
    
    // Initialize template editor
    initializeTemplateEditor();
    
    templateEditor.listenersSetup = true;
}

// Variables for field styling
let currentStyledField = null;

// Show field styling panel
function showFieldStyling(fieldElement) {
    currentStyledField = fieldElement;
    const panel = document.getElementById('fieldStylingPanel');
    const fieldType = fieldElement.dataset.field;
    
    // Load existing styling if any
    const fieldPosition = templateEditor.fieldPositions[fieldType];
    if (fieldPosition && fieldPosition.styling) {
        document.getElementById('fieldFont').value = fieldPosition.styling.font || 'Helvetica';
        document.getElementById('fieldFontSize').value = fieldPosition.styling.fontSize || 12;
        document.getElementById('fieldTextColor').value = fieldPosition.styling.color || '#000000';
        document.getElementById('fieldAlignment').value = fieldPosition.styling.alignment || 'center';
    } else {
        // Reset to defaults
        document.getElementById('fieldFont').value = 'Helvetica';
        document.getElementById('fieldFontSize').value = '12';
        document.getElementById('fieldTextColor').value = '#000000';
        document.getElementById('fieldAlignment').value = 'center';
    }
    
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth' });
}

// Apply field styling
function applyFieldStyling() {
    if (!currentStyledField) return;
    
    const fieldType = currentStyledField.dataset.field;
    const font = document.getElementById('fieldFont').value;
    const fontSize = document.getElementById('fieldFontSize').value;
    const color = document.getElementById('fieldTextColor').value;
    const alignment = document.getElementById('fieldAlignment').value;
    
    // Store styling in field position - preserve existing position data
    const existingFieldData = templateEditor.fieldPositions[fieldType] || {};
    templateEditor.fieldPositions[fieldType] = {
        ...existingFieldData,  // Preserve existing position data
        styling: {
            font: font,
            fontSize: parseInt(fontSize),
            color: color,
            alignment: alignment
        }
    };
    
    // Add visual indicator to field
    currentStyledField.classList.add('has-custom-styling');
    
    // Add or update styling indicator
    let indicator = currentStyledField.querySelector('.styling-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'styling-indicator';
        indicator.textContent = 'S';
        indicator.title = 'Custom styling applied';
        currentStyledField.appendChild(indicator);
    }
    
    // Update field preview styling (visual feedback)
    const fieldLabel = currentStyledField.querySelector('.field-label');
    if (fieldLabel) {
        fieldLabel.style.fontFamily = font.includes('Bold') ? 'bold' : 'normal';
        fieldLabel.style.fontSize = Math.min(parseInt(fontSize), 14) + 'px';
        fieldLabel.style.color = color;
    }
    
    // Apply alignment to the field element itself
    currentStyledField.style.textAlign = alignment;
    currentStyledField.style.justifyContent = 
        alignment === 'left' ? 'flex-start' : 
        alignment === 'right' ? 'flex-end' : 'center';
    
    console.log(`Styling applied to ${fieldType}:`, templateEditor.fieldPositions[fieldType]);
    showMessage(`Styling applied to ${getFieldData(fieldType).label}`, 'success');
    closeFieldStyling();
}

// Close field styling panel
function closeFieldStyling() {
    document.getElementById('fieldStylingPanel').style.display = 'none';
    currentStyledField = null;
}

// Template Editor Variables - Add initialization flag
let templateEditor = {
    canvas: null,
    backgroundImage: null,
    positionedFields: new Map(),
    draggedField: null,
    canvasRect: null,
    fieldPositions: {},
    initialized: false,
    zonesLoaded: false,
    templateData: null // Store template file data for persistence
};

// Initialize template editor
function initializeTemplateEditor() {
    const canvas = document.getElementById('templateCanvas');
    const fileInput = document.getElementById('templateFile');
    
    templateEditor.canvas = canvas;
    
    // Prevent duplicate event listeners
    if (templateEditor.listenersAttached) {
        return;
    }
    
    // File upload handler
    fileInput.addEventListener('change', handleTemplateUpload);
    
    // Setup drag and drop
    setupDragAndDrop();
    
    // Setup toolbar buttons
    document.getElementById('resetFieldPositions').addEventListener('click', resetFieldPositions);
    document.getElementById('previewBadge').addEventListener('click', previewBadgeWithData);
    
    // Setup keyboard controls for field movement
    setupKeyboardControls();
    
    // Setup canvas click to deselect fields
    canvas.addEventListener('click', (e) => {
        if (e.target === canvas) {
            deselectField();
        }
    });
    
    // Load zones only once
    const eventId = new URLSearchParams(window.location.search).get('id');
    if (eventId && !templateEditor.zonesLoaded) {
        loadZonesForTemplate(eventId);
        templateEditor.zonesLoaded = true;
    }
    
    templateEditor.listenersAttached = true;
}

// Setup keyboard controls for precise field movement
function setupKeyboardControls() {
    // Only attach once to avoid duplicate listeners
    if (document.keyboardControlsAttached) return;
    
    document.addEventListener('keydown', (e) => {
        // Only handle arrow keys when a field is selected and we're in the template editor
        if (!selectedField || !templateEditor.canvas) return;
        
        // Check if we're focused on an input/textarea to avoid interfering with normal typing
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }
        
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault(); // Prevent page scrolling
            
            // Use Shift for faster movement (10px instead of 1px)
            const step = e.shiftKey ? 10 : 1;
            moveSelectedFieldWithStep(e.key, step);
        }
        
        // Escape to deselect
        if (e.key === 'Escape') {
            deselectField();
        }
    });
    
    document.keyboardControlsAttached = true;
}

// Move selected field with custom step size
function moveSelectedFieldWithStep(direction, step) {
    if (!selectedField || !templateEditor.backgroundImage) return;
    
    const currentLeft = parseInt(selectedField.style.left);
    const currentTop = parseInt(selectedField.style.top);
    
    let newLeft = currentLeft;
    let newTop = currentTop;
    
    switch (direction) {
        case 'ArrowUp':
            newTop = currentTop - step;
            break;
        case 'ArrowDown':
            newTop = currentTop + step;
            break;
        case 'ArrowLeft':
            newLeft = currentLeft - step;
            break;
        case 'ArrowRight':
            newLeft = currentLeft + step;
            break;
    }
    
    // Check bounds relative to background image
    const bgRect = templateEditor.backgroundImage.getBoundingClientRect();
    const canvasRect = templateEditor.canvas.getBoundingClientRect();
    const bgLeft = bgRect.left - canvasRect.left;
    const bgTop = bgRect.top - canvasRect.top;
    const bgRight = bgLeft + bgRect.width;
    const bgBottom = bgTop + bgRect.height;
    
    const fieldWidth = selectedField.offsetWidth;
    const fieldHeight = selectedField.offsetHeight;
    
    // Keep field within background image bounds
    if (newLeft >= bgLeft && newLeft + fieldWidth <= bgRight) {
        selectedField.style.left = newLeft + 'px';
    }
    if (newTop >= bgTop && newTop + fieldHeight <= bgBottom) {
        selectedField.style.top = newTop + 'px';
    }
    
    // Update field position data
    updateFieldPosition(selectedField);
}

// Handle template file upload
async function handleTemplateUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
        showMessage('Please upload a PNG or JPG image', 'error');
        return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showMessage('Image file too large. Maximum size is 10MB', 'error');
        return;
    }
    
    try {
        showMessage('Loading template image...', 'info');
        
        // Store template file data for persistence
        templateEditor.templateData = file;
        
        // Create object URL for preview
        const imageUrl = URL.createObjectURL(file);
        
        // Create and load image
        const img = new Image();
        img.onload = function() {
            // Store original image dimensions for accurate coordinate scaling
            templateEditor.originalWidth = img.naturalWidth;
            templateEditor.originalHeight = img.naturalHeight;
            
            console.log('Template image loaded:', {
                originalWidth: templateEditor.originalWidth,
                originalHeight: templateEditor.originalHeight,
                fileSize: file.size
            });
            
            displayTemplateBackground(img, imageUrl);
            showMessage('Template loaded successfully', 'success');
        };
        img.onerror = function() {
            showMessage('Failed to load template image', 'error');
        };
        img.src = imageUrl;
        
    } catch (error) {
        console.error('Error loading template:', error);
        showMessage('Failed to load template image', 'error');
    }
}

// Display template background
function displayTemplateBackground(img, imageUrl) {
    const canvas = templateEditor.canvas;
    const placeholder = canvas.querySelector('.template-placeholder');
    
    // Remove placeholder
    if (placeholder) {
        placeholder.remove();
    }
    
    // Remove existing background
    const existingBg = canvas.querySelector('.template-background');
    if (existingBg) {
        existingBg.remove();
    }
    
    // Create background image element
    const bgImg = document.createElement('img');
    bgImg.src = imageUrl;
    bgImg.className = 'template-background';
    bgImg.alt = 'Badge Template Background';
    
    // Calculate and set canvas size based on image aspect ratio
    const maxWidth = canvas.offsetWidth;
    const maxHeight = canvas.offsetHeight;
    const aspectRatio = img.width / img.height;
    
    let displayWidth, displayHeight;
    
    if (aspectRatio > maxWidth / maxHeight) {
        displayWidth = maxWidth;
        displayHeight = maxWidth / aspectRatio;
    } else {
        displayHeight = maxHeight;
        displayWidth = maxHeight * aspectRatio;
    }
    
    bgImg.style.width = displayWidth + 'px';
    bgImg.style.height = displayHeight + 'px';
    bgImg.style.left = '50%';
    bgImg.style.top = '50%';
    bgImg.style.transform = 'translate(-50%, -50%)';
    
    canvas.appendChild(bgImg);
    templateEditor.backgroundImage = bgImg;
    
    // Add size indicator only
    addCanvasSizeIndicator();
    
    // Update canvas rect for positioning
    updateCanvasRect();
}

// Setup drag and drop functionality
function setupDragAndDrop() {
    const canvas = templateEditor.canvas;
    const fieldItems = document.querySelectorAll('.field-item');
    
    // Setup draggable field items
    fieldItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });
    
    // Setup canvas drop zone
    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('drop', handleDrop);
    canvas.addEventListener('dragenter', handleDragEnter);
    canvas.addEventListener('dragleave', handleDragLeave);
}

// Drag start handler
function handleDragStart(event) {
    const fieldType = event.target.dataset.field;
    templateEditor.draggedField = fieldType;
    event.target.classList.add('dragging');
    
    // Set drag data
    event.dataTransfer.setData('text/plain', fieldType);
    event.dataTransfer.effectAllowed = 'copy';
}

// Drag end handler
function handleDragEnd(event) {
    event.target.classList.remove('dragging');
    templateEditor.draggedField = null;
}

// Drag over handler
function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
}

// Drag enter handler
function handleDragEnter(event) {
    event.preventDefault();
    if (templateEditor.backgroundImage) {
        templateEditor.canvas.classList.add('drag-over');
    }
}

// Drag leave handler
function handleDragLeave(event) {
    // Only remove drag-over if leaving the canvas completely
    if (!templateEditor.canvas.contains(event.relatedTarget)) {
        templateEditor.canvas.classList.remove('drag-over');
    }
}

// Drop handler
function handleDrop(event) {
    event.preventDefault();
    templateEditor.canvas.classList.remove('drag-over');
    
    if (!templateEditor.backgroundImage) {
        showMessage('Please upload a template image first', 'warning');
        return;
    }
    
    const fieldType = event.dataTransfer.getData('text/plain');
    if (!fieldType) return;
    
    // Calculate drop position relative to background image
    const canvasRect = templateEditor.canvas.getBoundingClientRect();
    const bgRect = templateEditor.backgroundImage.getBoundingClientRect();
    
    let x = event.clientX - bgRect.left;
    const y = event.clientY - bgRect.top;
    
    // Auto-center horizontally: center the field properly in the background image
    // Account for field width to truly center the field (QR codes are larger)
    const defaultFieldWidth = fieldType === 'qr_code' ? 100 : 80;
    x = (bgRect.width / 2) - (defaultFieldWidth / 2);
    
    // Ensure drop is within background image bounds
    if (x < 0 || y < 0 || x > bgRect.width || y > bgRect.height) {
        showMessage('Please drop fields within the template image area', 'warning');
        return;
    }
    
    // Create positioned field
    createPositionedField(fieldType, x, y);
    
    updateCanvasRect();
}

// Create positioned field on canvas
function createPositionedField(fieldType, x, y) {
    const fieldData = getFieldData(fieldType);
    
    // Remove existing field of same type
    const existingField = templateEditor.positionedFields.get(fieldType);
    if (existingField) {
        existingField.remove();
    }
    
    // Create field element
    const fieldElement = document.createElement('div');
    fieldElement.className = 'positioned-field newly-placed';
    fieldElement.dataset.field = fieldType;
    
    fieldElement.innerHTML = `
        <span class="field-icon">${fieldData.icon}</span>
        <span class="field-label">${fieldData.label}</span>
        <div class="field-buttons">
            <button class="style-field" onclick="showFieldStyling(this.closest('.positioned-field'))" title="Style field">🎨</button>
            <button class="remove-field" onclick="removePositionedField('${fieldType}')" title="Remove field">×</button>
        </div>
    `;
    
    // Position relative to background image with PDF alignment compensation
    const bgRect = templateEditor.backgroundImage.getBoundingClientRect();
    const canvasRect = templateEditor.canvas.getBoundingClientRect();
    
    // Apply visual offset to better match PDF output
    const visualOffset = getVisualAlignmentOffset(fieldType);
    
    fieldElement.style.left = (bgRect.left - canvasRect.left + x + visualOffset.x) + 'px';
    fieldElement.style.top = (bgRect.top - canvasRect.top + y + visualOffset.y) + 'px';
    
    // Add to canvas
    templateEditor.canvas.appendChild(fieldElement);
    
    // Store field reference
    templateEditor.positionedFields.set(fieldType, fieldElement);
    
    // Store position data - preserve existing styling if field already has it
    const existingFieldData = templateEditor.fieldPositions[fieldType] || {};
    
    // Calculate relative coordinates using original image dimensions for accuracy
    let relativeX, relativeY;
    if (templateEditor.originalWidth && templateEditor.originalHeight) {
        // Use original dimensions to ensure PDF matches editor positioning
        const scaleX = templateEditor.originalWidth / bgRect.width;
        const scaleY = templateEditor.originalHeight / bgRect.height;
        relativeX = (x * scaleX) / templateEditor.originalWidth;
        relativeY = (y * scaleY) / templateEditor.originalHeight;
        
        console.log('Coordinate calculation using original dimensions:', {
            displayPos: { x, y },
            displaySize: { width: bgRect.width, height: bgRect.height },
            originalSize: { width: templateEditor.originalWidth, height: templateEditor.originalHeight },
            scale: { x: scaleX, y: scaleY },
            relativePos: { x: relativeX, y: relativeY }
        });
    } else {
        // Fallback to display dimensions (less accurate)
        relativeX = x / bgRect.width;
        relativeY = y / bgRect.height;
        console.warn('Using display dimensions for coordinates (less accurate) - original dimensions not available');
    }
    
    templateEditor.fieldPositions[fieldType] = {
        ...existingFieldData,  // Preserve existing properties like styling
        x: x,
        y: y,
        relativeX: relativeX,
        relativeY: relativeY
    };

    
    // Apply existing styling if available
    const savedFieldData = templateEditor.fieldPositions[fieldType] || {};
    if (savedFieldData.styling) {
        fieldElement.classList.add('has-custom-styling');
        
        // Add styling indicator
        let indicator = fieldElement.querySelector('.styling-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'styling-indicator';
            indicator.textContent = 'S';
            indicator.title = 'Custom styling applied';
            fieldElement.appendChild(indicator);
        }
        
        // Apply visual styling to field label
        const fieldLabel = fieldElement.querySelector('.field-label');
        if (fieldLabel) {
            fieldLabel.style.fontFamily = savedFieldData.styling.font && savedFieldData.styling.font.includes('Bold') ? 'bold' : 'normal';
            fieldLabel.style.fontSize = Math.min(savedFieldData.styling.fontSize || 12, 14) + 'px';
            fieldLabel.style.color = savedFieldData.styling.color || '#000000';
        }
        
        // Apply alignment to the field element
        const alignment = savedFieldData.styling.alignment || 'center';
        fieldElement.style.textAlign = alignment;
        fieldElement.style.justifyContent = 
            alignment === 'left' ? 'flex-start' : 
            alignment === 'right' ? 'flex-end' : 'center';
        
        console.log(`Applied existing styling to recreated field ${fieldType}:`, savedFieldData.styling);
    } else {
        // Apply default center alignment to new fields
        fieldElement.style.textAlign = 'center';
        fieldElement.style.justifyContent = 'center';
    }
    
    // Setup field dragging
    setupFieldDragging(fieldElement);
    
    // Remove animation class after animation completes
    setTimeout(() => {
        fieldElement.classList.remove('newly-placed');
    }, 500);
    
    showMessage(`${fieldData.label} field positioned`, 'success');
    
    return fieldElement;
}

// Add size indicator to template canvas
function addCanvasSizeIndicator() {
    const container = document.querySelector('.template-canvas-container');
    if (!container) return;
    
    // Remove existing indicator
    container.querySelectorAll('.canvas-size-indicator').forEach(el => el.remove());
    
    // Add size indicator
    const sizeIndicator = document.createElement('div');
    sizeIndicator.className = 'canvas-size-indicator';
    sizeIndicator.textContent = 'A5 Portrait (420×595px) • 14.8×21.0cm';
    container.appendChild(sizeIndicator);
}

// Get field data
function getFieldData(fieldType) {
    const fieldData = {
        photo: { icon: '📷', label: 'Photo' },
        name: { icon: '👤', label: 'Name' },
        role: { icon: '💼', label: 'Role' },
        company: { icon: '🏢', label: 'Company' },
        badge_number: { icon: '🏷️', label: 'Badge #' },
        qr_code: { icon: '📱', label: 'QR Code' },
        access_zones: { icon: '🎯', label: 'Access Zones' }
    };
    
    // Check if it's a zone field
    if (fieldType.startsWith('zone_')) {
        const zoneNumber = fieldType.replace('zone_', '');
        return { icon: '🔒', label: `Zone ${zoneNumber}` };
    }
    
    return fieldData[fieldType] || { icon: '❓', label: 'Unknown' };
}

// Get visual alignment offset to better match PDF output
function getVisualAlignmentOffset(fieldType) {
    // These offsets compensate for the difference between CSS positioning and PDFKit text rendering
    // Values determined through visual calibration with actual PDF output
    
    const offsets = {
        // Text fields need adjustment for PDFKit text baseline and centering differences
        'name': { x: -8, y: -4 },           // Names typically need left and up adjustment
        'role': { x: -8, y: -4 },           // Roles same as names
        'company': { x: -8, y: -4 },        // Company same as names  
        'badge_number': { x: -8, y: -4 },   // Badge numbers same as text
        'access_zones': { x: -8, y: -4 },   // Access zones same as text
        
        // Photo fields need same adjustment as text fields
        'photo': { x: -8, y: -4 },          // Photos need left and up adjustment
        
        // QR codes need same adjustment as text fields  
        'qr_code': { x: -8, y: -4 },        // QR codes need left and up adjustment
        
        // Zone fields same as text
        'zone_': { x: -8, y: -4 }           // Zone fields same as text (will be matched by startsWith)
    };
    
    // Check for temporary overrides (for calibration)
    if (window.visualAlignmentOverrides && window.visualAlignmentOverrides[fieldType]) {
        return window.visualAlignmentOverrides[fieldType];
    }
    
    // Check for zone fields
    if (fieldType.startsWith('zone_')) {
        return offsets.zone_;
    }
    
    // Return specific offset or default for text fields
    return offsets[fieldType] || { x: -8, y: -4 };
}

// Helper function to calibrate visual alignment (for debugging/fine-tuning)
function calibrateVisualAlignment(fieldType, offsetX, offsetY) {
    console.log(`Calibrating ${fieldType}: setting offset to x:${offsetX}, y:${offsetY}`);
    
    // Update the offset temporarily (this would need to be persistent in a real implementation)
    window.visualAlignmentOverrides = window.visualAlignmentOverrides || {};
    window.visualAlignmentOverrides[fieldType] = { x: offsetX, y: offsetY };
    
    // If there's a selected field of this type, update its position immediately
    if (selectedField && selectedField.dataset.field === fieldType) {
        const bgRect = templateEditor.backgroundImage.getBoundingClientRect();
        const canvasRect = templateEditor.canvas.getBoundingClientRect();
        
        // Get current logical position
        const currentOffset = getVisualAlignmentOffset(fieldType);
        const currentX = parseInt(selectedField.style.left) - (bgRect.left - canvasRect.left) - currentOffset.x;
        const currentY = parseInt(selectedField.style.top) - (bgRect.top - canvasRect.top) - currentOffset.y;
        
        // Apply new visual position
        const newOffset = { x: offsetX, y: offsetY };
        selectedField.style.left = (bgRect.left - canvasRect.left + currentX + newOffset.x) + 'px';
        selectedField.style.top = (bgRect.top - canvasRect.top + currentY + newOffset.y) + 'px';
        
        console.log(`Updated visual position for ${fieldType}`);
    }
}

// Global variable to track selected field for keyboard controls
let selectedField = null;

// Setup field dragging for repositioning and resizing
function setupFieldDragging(fieldElement) {
    let isDragging = false;
    let isResizing = false;
    let startX, startY, startLeft, startTop, startWidth, startHeight;
    
    // Add mouse move listener to show resize cursor
    fieldElement.addEventListener('mousemove', (e) => {
        if (isDragging || isResizing) return;
        
        const rect = fieldElement.getBoundingClientRect();
        const edgeThreshold = 12;
        
        const isNearRightEdge = (e.clientX > rect.right - edgeThreshold);
        const isNearBottomEdge = (e.clientY > rect.bottom - edgeThreshold);
        const isNearLeftEdge = (e.clientX < rect.left + edgeThreshold);
        const isNearTopEdge = (e.clientY < rect.top + edgeThreshold);
        
        if (isNearRightEdge || isNearLeftEdge) {
            fieldElement.style.cursor = 'ew-resize';
        } else if (isNearTopEdge || isNearBottomEdge) {
            fieldElement.style.cursor = 'ns-resize';
        } else {
            fieldElement.style.cursor = 'move';
        }
    });
    
    fieldElement.addEventListener('mouseleave', () => {
        fieldElement.style.cursor = 'move';
    });
    
    // Add click handler for field selection
    fieldElement.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-field') || e.target.classList.contains('style-field')) return;
        selectField(fieldElement);
        e.stopPropagation();
    });
    
    fieldElement.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('remove-field') || e.target.classList.contains('style-field')) return;
        
        selectField(fieldElement);
        
        const rect = fieldElement.getBoundingClientRect();
        const edgeThreshold = 12;
        
        // Check if near any edge for resizing
        const isNearRightEdge = (e.clientX > rect.right - edgeThreshold);
        const isNearBottomEdge = (e.clientY > rect.bottom - edgeThreshold);
        const isNearLeftEdge = (e.clientX < rect.left + edgeThreshold);
        const isNearTopEdge = (e.clientY < rect.top + edgeThreshold);
        
        if (isNearRightEdge || isNearBottomEdge || isNearLeftEdge || isNearTopEdge) {
            // Start resizing
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(fieldElement.style.left);
            startTop = parseInt(fieldElement.style.top);
            startWidth = fieldElement.offsetWidth;
            startHeight = fieldElement.offsetHeight;
        } else {
            // Start dragging
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(fieldElement.style.left);
            startTop = parseInt(fieldElement.style.top);
        }
        
        fieldElement.classList.add(isResizing ? 'resizing' : 'dragging');
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        e.preventDefault();
    });
    
    function handleMouseMove(e) {
        if (isDragging) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const newLeft = startLeft + deltaX;
            const newTop = startTop + deltaY;
            
            fieldElement.style.left = newLeft + 'px';
            fieldElement.style.top = newTop + 'px';
        } else if (isResizing) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const newWidth = Math.max(80, startWidth + deltaX);
            const newHeight = Math.max(35, startHeight + deltaY);
            
            // Center-based resizing: adjust position to keep field centered
            const widthChange = newWidth - startWidth;
            const heightChange = newHeight - startHeight;
            
            fieldElement.style.width = newWidth + 'px';
            fieldElement.style.height = newHeight + 'px';
            fieldElement.style.left = (startLeft - widthChange / 2) + 'px';
            fieldElement.style.top = (startTop - heightChange / 2) + 'px';
        }
    }
    
    function handleMouseUp(e) {
        if (!isDragging && !isResizing) return;
        
        const wasResizing = isResizing;
        isDragging = false;
        isResizing = false;
        
        fieldElement.classList.remove('dragging', 'resizing');
        
        // Update field data
        const fieldType = fieldElement.dataset.field;
        const bgRect = templateEditor.backgroundImage.getBoundingClientRect();
        const canvasRect = templateEditor.canvas.getBoundingClientRect();
        
        // Remove visual offset to get the actual logical position
        const visualOffset = getVisualAlignmentOffset(fieldType);
        const x = parseInt(fieldElement.style.left) - (bgRect.left - canvasRect.left) - visualOffset.x;
        const y = parseInt(fieldElement.style.top) - (bgRect.top - canvasRect.top) - visualOffset.y;
        const width = fieldElement.offsetWidth;
        const height = fieldElement.offsetHeight;
        
        // Calculate relative coordinates using original image dimensions for accuracy
        let relativeX, relativeY, relativeWidth, relativeHeight;
        if (templateEditor.originalWidth && templateEditor.originalHeight) {
            // Use original dimensions to ensure PDF matches editor positioning
            const scaleX = templateEditor.originalWidth / bgRect.width;
            const scaleY = templateEditor.originalHeight / bgRect.height;
            relativeX = (x * scaleX) / templateEditor.originalWidth;
            relativeY = (y * scaleY) / templateEditor.originalHeight;
            relativeWidth = (width * scaleX) / templateEditor.originalWidth;
            relativeHeight = (height * scaleY) / templateEditor.originalHeight;
            
            console.log('Updated coordinate calculation using original dimensions:', {
                displayPos: { x, y, width, height },
                displaySize: { width: bgRect.width, height: bgRect.height },
                originalSize: { width: templateEditor.originalWidth, height: templateEditor.originalHeight },
                scale: { x: scaleX, y: scaleY },
                relativePos: { x: relativeX, y: relativeY, width: relativeWidth, height: relativeHeight }
            });
        } else {
            // Fallback to display dimensions (less accurate)
            relativeX = x / bgRect.width;
            relativeY = y / bgRect.height;
            relativeWidth = width / bgRect.width;
            relativeHeight = height / bgRect.height;
            console.warn('Using display dimensions for coordinate update (less accurate) - original dimensions not available');
        }

        // Preserve existing styling and other properties when updating position/size
        const existingFieldData = templateEditor.fieldPositions[fieldType] || {};
        templateEditor.fieldPositions[fieldType] = {
            ...existingFieldData,  // Preserve existing properties like styling
            x: x,
            y: y,
            width: width,
            height: height,
            relativeX: relativeX,
            relativeY: relativeY,
            relativeWidth: relativeWidth,
            relativeHeight: relativeHeight
        };

        // Update coordinate and size display
        const coordElement = fieldElement.querySelector('.field-coordinates');
        if (coordElement) {
            coordElement.textContent = `${Math.round(x)},${Math.round(y)} (${(relativeX * 100).toFixed(1)}%,${(relativeY * 100).toFixed(1)}%)`;
            coordElement.title = `Display: ${Math.round(x)},${Math.round(y)} | Relative: ${relativeX.toFixed(3)},${relativeY.toFixed(3)}`;
        }

        const sizeElement = fieldElement.querySelector('.field-size');
        if (sizeElement) {
            sizeElement.textContent = `${width}×${height}`;
        }
        
        if (wasResizing) {
            showMessage(`${getFieldData(fieldType).label} resized to ${width}×${height}`, 'info');
        }
        
        // Debug: Log field data to verify styling preservation
        console.log(`Position updated for ${fieldType}:`, templateEditor.fieldPositions[fieldType]);
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }
}

// Field selection for keyboard controls
function selectField(fieldElement) {
    // Remove selection from previously selected field
    if (selectedField) {
        selectedField.classList.remove('selected');
    }
    
    // Select the new field
    selectedField = fieldElement;
    fieldElement.classList.add('selected');
    
    console.log(`Selected field: ${fieldElement.dataset.field}`);
}

// Deselect field
function deselectField() {
    if (selectedField) {
        selectedField.classList.remove('selected');
        selectedField = null;
    }
}


// Update field position data after keyboard movement
function updateFieldPosition(fieldElement) {
    const fieldType = fieldElement.dataset.field;
    const bgRect = templateEditor.backgroundImage.getBoundingClientRect();
    const canvasRect = templateEditor.canvas.getBoundingClientRect();
    
    // Remove visual offset to get the actual logical position
    const visualOffset = getVisualAlignmentOffset(fieldType);
    const x = parseInt(fieldElement.style.left) - (bgRect.left - canvasRect.left) - visualOffset.x;
    const y = parseInt(fieldElement.style.top) - (bgRect.top - canvasRect.top) - visualOffset.y;
    
    // Calculate relative coordinates using original image dimensions for accuracy
    let relativeX, relativeY;
    if (templateEditor.originalWidth && templateEditor.originalHeight) {
        const scaleX = templateEditor.originalWidth / bgRect.width;
        const scaleY = templateEditor.originalHeight / bgRect.height;
        relativeX = (x * scaleX) / templateEditor.originalWidth;
        relativeY = (y * scaleY) / templateEditor.originalHeight;
    } else {
        relativeX = x / bgRect.width;
        relativeY = y / bgRect.height;
    }
    
    // Update stored position
    const existingFieldData = templateEditor.fieldPositions[fieldType] || {};
    templateEditor.fieldPositions[fieldType] = {
        ...existingFieldData,
        x: x,
        y: y,
        relativeX: relativeX,
        relativeY: relativeY
    };
}

// Remove positioned field
function removePositionedField(fieldType) {
    const fieldElement = templateEditor.positionedFields.get(fieldType);
    if (fieldElement) {
        fieldElement.remove();
        templateEditor.positionedFields.delete(fieldType);
        delete templateEditor.fieldPositions[fieldType];
        
        const fieldData = getFieldData(fieldType);
        showMessage(`${fieldData.label} field removed`, 'info');
    }
}

// Make removePositionedField available globally
window.removePositionedField = removePositionedField;

// Reset field positions
function resetFieldPositions() {
    templateEditor.positionedFields.forEach((fieldElement, fieldType) => {
        fieldElement.remove();
    });
    
    templateEditor.positionedFields.clear();
    templateEditor.fieldPositions = {};
    
    showMessage('All field positions reset', 'info');
}

// Update canvas rect for positioning calculations
function updateCanvasRect() {
    templateEditor.canvasRect = templateEditor.canvas.getBoundingClientRect();
}

// Preview badge with real crew data
async function previewBadgeWithData() {
    try {
        if (!templateEditor.backgroundImage) {
            showMessage('Please upload a template image first', 'warning');
            return;
        }
        
        if (Object.keys(templateEditor.fieldPositions).length === 0) {
            showMessage('Please position at least one field on the template', 'warning');
            return;
        }
        
        showMessage('Generating badge preview...', 'info');
        
        const eventId = new URLSearchParams(window.location.search).get('id');
        const token = localStorage.getItem('token');
        
        // Get first crew member for preview (try approved crew first, then all crew)
        let response = await fetch(`/api/admin/events/${eventId}/approved-crew`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            console.log('Approved crew fetch failed, trying all crew members...');
            // Fallback to all crew members if approved-crew endpoint fails
            response = await fetch(`/api/events/${eventId}/crew`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Crew fetch error:', {
                status: response.status,
                statusText: response.statusText,
                errorText: errorText,
                eventId: eventId
            });
            throw new Error(`Failed to fetch crew members for preview: ${response.status} ${response.statusText}`);
        }
        
        const crewMembers = await response.json();
        
        if (!crewMembers || crewMembers.length === 0) {
            showMessage('No crew members found for preview. Please add crew members to the event first via the "Crew Management" tab, then try the preview again.', 'warning');
            return;
        }
        
        // Use first crew member for preview
        const previewCrewId = crewMembers[0].id;
        
        console.log('Using crew member for preview:', {
            id: crewMembers[0].id,
            name: `${crewMembers[0].first_name} ${crewMembers[0].last_name}`,
            totalCrew: crewMembers.length
        });
        
        // Generate badge PDF for preview
        const badgeResponse = await fetch(`/api/admin/crew/${previewCrewId}/badge/pdf?eventId=${eventId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!badgeResponse.ok) {
            throw new Error('Failed to generate badge preview');
        }
        
        // Get the PDF blob and create object URL
        const blob = await badgeResponse.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Open in new window for preview
        const previewWindow = window.open(url, '_blank', 'width=600,height=800');
        
        if (previewWindow) {
            showMessage('Badge preview opened in new window', 'success');
        } else {
            showMessage('Please allow pop-ups to preview badges', 'error');
        }
        
        // Cleanup after some time
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
        }, 30000); // 30 seconds
        
    } catch (error) {
        console.error('Error generating template preview:', error);
        showMessage('Failed to generate template preview: ' + error.message, 'error');
    }
}

// Load zones for template editor
async function loadZonesForTemplate(eventId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}/zones`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const zones = await response.json();
            updateFieldPalette(zones);
        }
    } catch (error) {
        console.error('Error loading zones for template:', error);
    }
}

// Update field palette with zone fields
function updateFieldPalette(zones) {
    const fieldPalette = document.querySelector('.field-palette');
    if (!fieldPalette) return;
    
    // Remove existing zone fields
    fieldPalette.querySelectorAll('.field-item[data-field^="zone_"]').forEach(item => {
        item.remove();
    });
    
    // Add zone fields after the main fields
    zones.forEach(zone => {
        const zoneFieldElement = document.createElement('div');
        zoneFieldElement.className = 'field-item';
        zoneFieldElement.draggable = true;
        zoneFieldElement.dataset.field = `zone_${zone.zone_number}`;
        
        zoneFieldElement.innerHTML = `
            <span class="field-icon">🔒</span>
            <span class="field-label">Zone ${zone.zone_number}</span>
            <div class="field-hint">${zone.area_name}</div>
        `;
        
        fieldPalette.appendChild(zoneFieldElement);
    });
    
    // Add access zones summary field
    const accessZonesElement = document.createElement('div');
    accessZonesElement.className = 'field-item';
    accessZonesElement.draggable = true;
    accessZonesElement.dataset.field = 'access_zones';
    
    accessZonesElement.innerHTML = `
        <span class="field-icon">🎯</span>
        <span class="field-label">Access Zones</span>
        <div class="field-hint">All assigned zones</div>
    `;
    
    fieldPalette.appendChild(accessZonesElement);
    
    // Re-setup drag and drop for new fields
    setupDragAndDrop();
}

// Event photo upload functionality
function setupEventPhotoUpload() {
    const eventPhotoFile = document.getElementById('eventPhotoFile');
    const eventPhotoPreview = document.getElementById('eventPhotoPreview');
    const eventPhotoPreviewImg = document.getElementById('eventPhotoPreviewImg');
    const removeEventPhoto = document.getElementById('removeEventPhoto');
    
    if (!eventPhotoFile) return;
    
    // Handle photo file selection
    eventPhotoFile.addEventListener('change', handleEventPhotoSelection);
    
    // Handle photo removal
    if (removeEventPhoto) {
        removeEventPhoto.addEventListener('click', handleEventPhotoRemoval);
    }
    
    // Note: existing photo will be loaded when populateEventForm is called
}

// Handle event photo file selection
async function handleEventPhotoSelection(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file
    if (!file.type.startsWith('image/')) {
        showMessage('Please select an image file', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showMessage('Image file size must be less than 5MB', 'error');
        return;
    }
    
    // Show preview immediately
    const reader = new FileReader();
    reader.onload = function(e) {
        const eventPhotoPreviewImg = document.getElementById('eventPhotoPreviewImg');
        const eventPhotoPreview = document.getElementById('eventPhotoPreview');
        
        eventPhotoPreviewImg.src = e.target.result;
        eventPhotoPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
    
    // Upload photo
    await uploadEventPhoto(file);
}

// Upload event photo to server
async function uploadEventPhoto(file) {
    const eventId = new URLSearchParams(window.location.search).get('id');
    const indicator = document.getElementById('autoSaveIndicator');
    
    try {
        // Show uploading indicator
        indicator.textContent = 'Uploading photo...';
        indicator.classList.add('show', 'saving');
        
        const formData = new FormData();
        formData.append('eventPhoto', file);
        
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}/photo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to upload event photo');
        }
        
        const result = await response.json();
        
        // Show success indicator
        indicator.textContent = 'Photo uploaded';
        indicator.classList.remove('saving');
        
        // Hide indicator after 2 seconds
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
        
        showMessage('Event photo uploaded successfully', 'success');
        console.log('✅ Event photo uploaded successfully');
        
    } catch (error) {
        console.error('Error uploading event photo:', error);
        
        // Show error indicator
        indicator.textContent = 'Upload failed';
        indicator.classList.remove('saving');
        indicator.style.background = 'rgba(239, 68, 68, 0.9)';
        
        // Hide indicator after 3 seconds
        setTimeout(() => {
            indicator.classList.remove('show');
            indicator.style.background = '';
        }, 3000);
        
        showMessage('Failed to upload event photo', 'error');
    }
}

// Handle event photo removal
async function handleEventPhotoRemoval() {
    const eventId = new URLSearchParams(window.location.search).get('id');
    const indicator = document.getElementById('autoSaveIndicator');
    
    try {
        // Show removing indicator
        indicator.textContent = 'Removing photo...';
        indicator.classList.add('show', 'saving');
        
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}/photo`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to remove event photo');
        }
        
        // Hide preview
        const eventPhotoPreview = document.getElementById('eventPhotoPreview');
        const eventPhotoFile = document.getElementById('eventPhotoFile');
        
        eventPhotoPreview.style.display = 'none';
        eventPhotoFile.value = '';
        
        // Show success indicator
        indicator.textContent = 'Photo removed';
        indicator.classList.remove('saving');
        
        // Hide indicator after 2 seconds
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
        
        showMessage('Event photo removed successfully', 'success');
        console.log('✅ Event photo removed successfully');
        
    } catch (error) {
        console.error('Error removing event photo:', error);
        
        // Show error indicator
        indicator.textContent = 'Remove failed';
        indicator.classList.remove('saving');
        indicator.style.background = 'rgba(239, 68, 68, 0.9)';
        
        // Hide indicator after 3 seconds
        setTimeout(() => {
            indicator.classList.remove('show');
            indicator.style.background = '';
        }, 3000);
        
        showMessage('Failed to remove event photo', 'error');
    }
}

// Event layout image upload functionality
function setupEventLayoutUpload() {
    const eventLayoutFile = document.getElementById('eventLayoutFile');
    const eventLayoutPreview = document.getElementById('eventLayoutPreview');
    const eventLayoutPreviewImg = document.getElementById('eventLayoutPreviewImg');
    const removeEventLayout = document.getElementById('removeEventLayout');
    
    if (!eventLayoutFile) return;
    
    // Handle layout file selection
    eventLayoutFile.addEventListener('change', handleEventLayoutSelection);
    
    // Handle layout removal
    if (removeEventLayout) {
        removeEventLayout.addEventListener('click', handleEventLayoutRemoval);
    }
    
    // Note: existing layout will be loaded when populateEventForm is called
}

// Handle event layout file selection
async function handleEventLayoutSelection(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file
    if (!file.type.startsWith('image/')) {
        showMessage('Please select an image file', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showMessage('Image file size must be less than 5MB', 'error');
        return;
    }
    
    // Show preview immediately
    const reader = new FileReader();
    reader.onload = function(e) {
        const eventLayoutPreviewImg = document.getElementById('eventLayoutPreviewImg');
        const eventLayoutPreview = document.getElementById('eventLayoutPreview');
        
        eventLayoutPreviewImg.src = e.target.result;
        eventLayoutPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
    
    // Upload layout
    await uploadEventLayout(file);
}

// Upload event layout to server
async function uploadEventLayout(file) {
    const eventId = new URLSearchParams(window.location.search).get('id');
    const indicator = document.getElementById('autoSaveIndicator');
    
    try {
        // Show uploading indicator
        indicator.textContent = 'Uploading layout...';
        indicator.classList.add('show', 'saving');
        
        const formData = new FormData();
        formData.append('eventLayout', file);
        
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}/layout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to upload event layout');
        }
        
        const result = await response.json();
        
        // Show success indicator
        indicator.textContent = 'Layout uploaded';
        indicator.classList.remove('saving');
        
        // Hide indicator after 2 seconds
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
        
        showMessage('Event layout uploaded successfully', 'success');
        console.log('✅ Event layout uploaded successfully');
        
    } catch (error) {
        console.error('Error uploading event layout:', error);
        
        // Show error indicator
        indicator.textContent = 'Upload failed';
        indicator.classList.remove('saving');
        indicator.style.background = 'rgba(239, 68, 68, 0.9)';
        
        // Hide indicator after 3 seconds
        setTimeout(() => {
            indicator.classList.remove('show');
            indicator.style.background = '';
        }, 3000);
        
        showMessage('Failed to upload event layout', 'error');
    }
}

// Handle event layout removal
async function handleEventLayoutRemoval() {
    const eventId = new URLSearchParams(window.location.search).get('id');
    const indicator = document.getElementById('autoSaveIndicator');
    
    try {
        // Show removing indicator
        indicator.textContent = 'Removing layout...';
        indicator.classList.add('show', 'saving');
        
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}/layout`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to remove event layout');
        }
        
        // Hide preview
        const eventLayoutPreview = document.getElementById('eventLayoutPreview');
        const eventLayoutFile = document.getElementById('eventLayoutFile');
        
        eventLayoutPreview.style.display = 'none';
        eventLayoutFile.value = '';
        
        // Show success indicator
        indicator.textContent = 'Layout removed';
        indicator.classList.remove('saving');
        
        // Hide indicator after 2 seconds
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
        
        showMessage('Event layout removed successfully', 'success');
        console.log('✅ Event layout removed successfully');
        
    } catch (error) {
        console.error('Error removing event layout:', error);
        
        // Show error indicator
        indicator.textContent = 'Remove failed';
        indicator.classList.remove('saving');
        indicator.style.background = 'rgba(239, 68, 68, 0.9)';
        
        // Hide indicator after 3 seconds
        setTimeout(() => {
            indicator.classList.remove('show');
            indicator.style.background = '';
        }, 3000);
        
        showMessage('Failed to remove event layout', 'error');
    }
}



