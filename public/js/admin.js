// Force dark mode permanently
document.documentElement.setAttribute('data-theme', 'dark');
localStorage.removeItem('theme'); // Clear any stored theme preference

document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin page loaded, initializing...');
    
    // Check super admin authentication
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No token found, redirecting to signin');
        window.location.href = '/signin';
        return;
    }

    console.log('Token found, verifying super admin...');
    // Verify super admin status
    verifySuperAdmin();

    console.log('Setting up admin tabs...');
    // Setup tabs
    setupAdminTabs();

    console.log('Loading dashboard data...');
    // Initialize dashboard
    loadDashboardData();
    
    console.log('Setting up event listeners...');
    setupEventListeners();
    
    // Setup role management event listeners
    setupRoleEventListeners();
    
    // Setup migration button
    const migrateDbBtn = document.getElementById('migrateDbBtn');
    if (migrateDbBtn) {
        migrateDbBtn.addEventListener('click', async () => {
            if (confirm('This will update the database schema to fix the roles table. Continue?')) {
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch('/api/admin/migrate', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || 'Migration failed');
                    }
                    
                    showMessage('Database schema updated successfully!', 'success');
                    loadDashboardData(); // Reload to show updated roles
                } catch (error) {
                    showMessage('Migration failed: ' + error.message, 'error');
                }
            }
        });
    }
    
    console.log('Admin page initialization complete');
});

// Verify user is super admin
async function verifySuperAdmin() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Authentication failed');
        }
        
        const user = await response.json();
        if (!user.is_super_admin) {
            alert('Access denied. Super admin privileges required.');
            window.location.href = '/dashboard';
        }
    } catch (error) {
        console.error('Auth verification failed:', error);
        window.location.href = '/signin';
    }
}

// Tab switching logic
function setupAdminTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });
}

// Refactor dashboard data loading to load into tab panels
async function loadDashboardData() {
    await Promise.all([
        loadCompaniesTab(),
        loadEventsTab(),
        loadRolesTab()
    ]);
}

// Companies Tab
async function loadCompaniesTab() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('companiesTableContainer');
    container.innerHTML = '<div>Loading companies...</div>';
    
    console.log('Loading companies tab...');
    console.log('Token exists:', !!token);
    
    try {
        const res = await fetch('/api/admin/companies', { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        console.log('Companies response status:', res.status);
        console.log('Companies response ok:', res.ok);
        
        if (!res.ok) {
            const errorData = await res.json();
            console.error('Companies API error:', errorData);
            throw new Error(`API Error: ${errorData.error || res.statusText}`);
        }
        
        const companies = await res.json();
        console.log('Companies loaded:', companies);
        
        let html = `<table class="admin-table"><thead><tr><th>Name</th><th>Domain</th><th>Admin Email</th><th>Phone</th><th>Assigned Roles</th><th>Events</th><th>Users</th><th>Actions</th></tr></thead><tbody>`;
        companies.forEach(c => {
            html += `<tr>
                <td>${c.name}</td>
                <td>${c.domain || ''}</td>
                <td>${c.admin_email || ''}</td>
                <td>${c.contact_phone || ''}</td>
                <td>${c.assigned_roles || 'No roles assigned'}</td>
                <td>${c.event_count || 0}</td>
                <td>${c.user_count || 0}</td>
                <td>
                    <button class="btn-icon edit-company-btn" title="Edit" data-company-id="${c.id}">✏️</button>
                    <button class="btn-icon delete-company-btn" title="Delete" data-company-id="${c.id}">🗑️</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
        
        // Add event listeners to delete buttons
        setupCompanyTableEventListeners();
        
        console.log('Companies table rendered successfully');
    } catch (e) {
        console.error('Error loading companies:', e);
        container.innerHTML = `<div class="error">Failed to load companies: ${e.message}</div>`;
    }
}

// Setup event listeners for company table buttons
function setupCompanyTableEventListeners() {
    // Edit company buttons
    document.querySelectorAll('.edit-company-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const companyId = parseInt(btn.getAttribute('data-company-id'));
            console.log('Edit company clicked:', companyId);
            await editCompany(companyId);
        });
    });
    
    // Delete company buttons
    document.querySelectorAll('.delete-company-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const companyId = parseInt(btn.getAttribute('data-company-id'));
            console.log('Delete company clicked:', companyId);
            await deleteCompany(companyId);
        });
    });
}

// Events Tab
async function loadEventsTab() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('eventsGrid');
    container.innerHTML = '<div>Loading events...</div>';
    
    try {
        const res = await fetch('/api/admin/events', { headers: { 'Authorization': `Bearer ${token}` } });
        const events = await res.json();
        
        // Update stats
        document.getElementById('totalEvents').textContent = events.filter(e => e.status === 'active').length;
        document.getElementById('ongoingEvents').textContent = events.filter(e => e.status === 'ongoing').length;
        document.getElementById('upcomingEvents').textContent = events.filter(e => {
            const startDate = new Date(e.start_date);
            const now = new Date();
            return startDate > now && e.status === 'active';
        }).length;
        
        if (events.length === 0) {
            container.innerHTML = '<div class="no-events">No events found. Create your first event!</div>';
            return;
        }
        
        let html = '';
        events.forEach(event => {
            const startDate = new Date(event.start_date);
            const endDate = new Date(event.end_date);
            const now = new Date();
            
            // Determine status
            let status = event.status;
            if (status === 'active' && startDate <= now && endDate >= now) {
                status = 'ongoing';
            } else if (status === 'active' && endDate < now) {
                status = 'ended';
            }
            
            const statusClass = status === 'active' ? 'active' : 
                              status === 'ongoing' ? 'ongoing' : 
                              status === 'ended' ? 'ended' : 'cancelled';
            
            html += `
                <div class="event-card" data-event-id="${event.id}">
                    <div class="event-card-header">
                        <h3>${event.name}</h3>
                        <div class="event-card-location">📍 ${event.location}</div>
                        <div class="event-card-dates">
                            <span>📅 ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="event-card-body">
                        <div class="event-card-company">🏢 ${event.company_names || 'No Companies Assigned'}</div>
                        <div class="event-card-status">
                            <span class="status-badge ${statusClass}">${status}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Add click handlers for event cards
        document.querySelectorAll('.event-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    const eventId = card.dataset.eventId;
                    window.location.href = `/admin/event-detail?id=${eventId}`;
                }
            });
        });
        
    } catch (e) {
        container.innerHTML = '<div class="error">Failed to load events</div>';
    }
}

// Roles Tab
async function loadRolesTab() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('rolesLibraryContainer');
    container.innerHTML = '<div>Loading roles library...</div>';
    try {
        const res = await fetch('/api/admin/roles', { headers: { 'Authorization': `Bearer ${token}` } });
        const roles = await res.json();
        let html = `<table class="admin-table"><thead><tr><th>Role Name</th><th>Description</th><th>Actions</th></tr></thead><tbody>`;
        roles.forEach(role => {
            html += `<tr>
                <td>${role.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                <td>${role.description || 'No description available'}</td>
                <td>
                    <button class="btn-icon edit-role-btn" title="Edit" data-role-id="${role.id}">✏️</button>
                    <button class="btn-icon delete-role-btn" title="Delete" data-role-id="${role.id}">🗑️</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
        
        // Add event listeners to the buttons
        setupRoleTableEventListeners();
    } catch (e) {
        container.innerHTML = '<div class="error">Failed to load roles library</div>';
    }
}

// Setup event listeners for role table buttons
function setupRoleTableEventListeners() {
    // Edit role buttons
    document.querySelectorAll('.edit-role-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const roleId = parseInt(btn.getAttribute('data-role-id'));
            console.log('Edit role clicked:', roleId);
            await editRole(roleId);
        });
    });
    
    // Delete role buttons
    document.querySelectorAll('.delete-role-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const roleId = parseInt(btn.getAttribute('data-role-id'));
            console.log('Delete role clicked:', roleId);
            await deleteRole(roleId);
        });
    });
}

// Load statistics
async function loadStats() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load stats');
        
        const stats = await response.json();
        
        document.getElementById('totalCompanies').textContent = stats.totalCompanies;
        document.getElementById('totalEvents').textContent = stats.totalEvents;
        document.getElementById('totalUsers').textContent = stats.totalUsers;
        document.getElementById('pendingApprovals').textContent = stats.pendingApprovals;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/activity', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load activity');
        
        const activities = await response.json();
        const activityList = document.getElementById('activityList');
        
        if (activities.length === 0) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <h3>No Recent Activity</h3>
                    <p>Activity will appear here as companies and users interact with the system.</p>
                </div>
            `;
            return;
        }
        
        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">${getActivityIcon(activity.type)}</div>
                <div class="activity-content">
                    <h4>${activity.title}</h4>
                    <p>${activity.description}</p>
                </div>
                <div class="activity-time">${formatTime(activity.created_at)}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading activity:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Modal elements
    const addCompanyModal = document.getElementById('addCompanyModal');
    const addEventModal = document.getElementById('addEventModal');
    const addUserModal = document.getElementById('addUserModal');
    const addRoleModal = document.getElementById('addRoleModal');
    
    // Buttons
    const addCompanyBtn = document.getElementById('addCompanyBtn');
    const addEventBtn = document.getElementById('addEventBtn');
    const addUserBtn = document.getElementById('addUserBtn');
    const addRoleBtn = document.getElementById('addRoleBtn');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const cleanupEventsBtn = document.getElementById('cleanupEventsBtn');
    
    // Close buttons
    const closeModals = document.querySelectorAll('.close-modal');
    const cancelButtons = document.querySelectorAll('[id^="cancelAdd"]');
    
    console.log('Found elements:', {
        addCompanyBtn: !!addCompanyBtn,
        addEventBtn: !!addEventBtn,
        addUserBtn: !!addUserBtn,
        addRoleBtn: !!addRoleBtn,
        closeModals: closeModals.length,
        cancelButtons: cancelButtons.length
    });
    
    // Show modals
    if (addCompanyBtn) {
        addCompanyBtn.addEventListener('click', async () => {
            console.log('Opening company modal');
            addCompanyModal.style.display = 'block';
            await loadRolesForCompanySelect('assignedRoles');
        });
    }
    
    if (addEventBtn) {
        addEventBtn.addEventListener('click', () => {
            console.log('Opening event modal');
            addEventModal.style.display = 'block';
            loadCompaniesForSelect('eventCompanies');
        });
    }
    
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            console.log('Opening user modal');
            addUserModal.style.display = 'block';
            loadCompaniesForSelect('userCompany');
        });
    }
    
    if (addRoleBtn) {
        addRoleBtn.addEventListener('click', () => {
            console.log('Opening role modal');
            addRoleModal.style.display = 'block';
        });
    }
    
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateReport);
    }
    if (signOutBtn) {
        signOutBtn.addEventListener('click', signOut);
    }
    if (cleanupEventsBtn) {
        cleanupEventsBtn.addEventListener('click', cleanupEvents);
    }
    
    closeModals.forEach(btn => {
        btn.addEventListener('click', (e) => {
            console.log('Close button clicked');
            const modal = btn.closest('.modal');
            if (modal) {
                hideModal(modal);
            }
        });
    });
    
    cancelButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            console.log('Cancel button clicked');
            const modal = btn.closest('.modal');
            if (modal) {
                hideModal(modal);
            }
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            console.log('Clicked outside modal');
            hideModal(e.target);
        }
    });
    
    // Form submissions
    const addCompanyForm = document.getElementById('addCompanyForm');
    const addEventForm = document.getElementById('addEventForm');
    const addRoleForm = document.getElementById('addRoleForm');
    
    console.log('Found forms:', {
        addCompanyForm: !!addCompanyForm,
        addEventForm: !!addEventForm,
        addRoleForm: !!addRoleForm
    });
    
    if (addCompanyForm) {
        addCompanyForm.addEventListener('submit', handleAddCompany);
    }
    if (addEventForm) {
        addEventForm.addEventListener('submit', handleAddEvent);
    }
    if (addRoleForm) {
        addRoleForm.addEventListener('submit', handleAddRole);
    }
    
    // Setup role edit/delete event listeners
    setupRoleEventListeners();
    
    console.log('Event listeners setup complete');
}

// Load companies for select dropdowns
async function loadCompaniesForSelect(selectId) {
    try {
        console.log('Loading companies for select:', selectId);
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/companies', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load companies');
        
        const companies = await response.json();
        console.log('Companies loaded:', companies);
        
        const select = document.getElementById(selectId);
        console.log('Select element found:', !!select);
        
        if (!select) {
            console.error('Select element not found:', selectId);
            return;
        }
        
        // Clear existing options
        select.innerHTML = '';
        
        // Add appropriate placeholder based on select type
        if (selectId === 'eventCompanies') {
            // Multi-select for event companies - no placeholder needed
            // Companies will be loaded directly
        } else {
            // Single select for other forms
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Select a company';
            select.appendChild(placeholder);
        }
        
        // Add company options
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = company.name;
            select.appendChild(option);
        });
        
        console.log('Companies added to select:', selectId, select.options.length);
    } catch (error) {
        console.error('Error loading companies:', error);
    }
}

// Handle add company
async function handleAddCompany(e) {
    console.log('handleAddCompany called');
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Handle multiple role selections
    const roleSelect = document.getElementById('assignedRoles');
    const selectedRoles = Array.from(roleSelect.selectedOptions).map(option => option.value);
    
    // Remove the empty option if it's selected
    const filteredRoles = selectedRoles.filter(role => role !== '');
    
    if (filteredRoles.length === 0) {
        showMessage('Please select at least one role', 'error');
        return;
    }
    
    // Create the company data with role assignments
    const companyData = {
        companyName: data.companyName,
        companyDomain: data.companyDomain,
        companyAdminEmail: data.companyAdminEmail,
        contactPhone: data.contactPhone,
        companyAddress: data.companyAddress,
        assignedRoles: filteredRoles
    };
    
    console.log('Company data:', companyData);
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/companies', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(companyData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add company');
        }
        
        const result = await response.json();
        console.log('Company added successfully:', result);
        showMessage('Company added successfully!', 'success');
        
        // Hide modal and reset form
        document.getElementById('addCompanyModal').style.display = 'none';
        e.target.reset();
        
        // Reload dashboard data
        loadDashboardData();
        
    } catch (error) {
        console.error('Error adding company:', error);
        showMessage('Failed to add company: ' + error.message, 'error');
    }
}

// Handle add event
async function handleAddEvent(e) {
    console.log('handleAddEvent called');
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Handle multiple company selections
    const companySelect = document.getElementById('eventCompanies');
    const selectedCompanies = Array.from(companySelect.selectedOptions).map(option => option.value);
    
    // Remove the empty option if it's selected
    const filteredCompanies = selectedCompanies.filter(companyId => companyId !== '');
    
    if (filteredCompanies.length === 0) {
        showMessage('Please select at least one company', 'error');
        return;
    }
    
    // Create the event data with company IDs
    const eventData = {
        name: data.eventName,
        location: data.eventLocation,
        start_date: data.startDate,
        end_date: data.endDate,
        description: data.eventDescription,
        company_ids: filteredCompanies
    };
    
    console.log('Event data:', eventData);
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(eventData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create event');
        }
        
        const result = await response.json();
        console.log('Event created successfully:', result);
        showMessage('Event created successfully!', 'success');
        
        // Hide modal and reset form
        document.getElementById('addEventModal').style.display = 'none';
        e.target.reset();
        
        // Reload dashboard data
        loadDashboardData();
        
    } catch (error) {
        console.error('Error creating event:', error);
        showMessage('Failed to create event: ' + error.message, 'error');
    }
}

// Global hideModal function
function hideModal(modal) {
    if (modal) modal.style.display = 'none';
}

// Setup role management event listeners
function setupRoleEventListeners() {
    console.log('Setting up role and company event listeners...');
    
    // Edit role form
    const editRoleForm = document.getElementById('editRoleForm');
    console.log('Edit role form found:', !!editRoleForm);
    if (editRoleForm) {
        editRoleForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const roleName = document.getElementById('editRoleName').value.trim();
            const roleDescription = document.getElementById('editRoleDescription').value.trim();
            if (!roleName || !roleDescription) return;
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/admin/roles/${currentEditRoleId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ roleName, roleDescription })
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to update role');
                }
                showMessage('Role updated successfully!', 'success');
                hideModal(document.getElementById('editRoleModal'));
                loadDashboardData();
            } catch (error) {
                showMessage('Failed to update role: ' + error.message, 'error');
            }
        });
    }

    // Cancel edit role button
    const cancelEditRole = document.getElementById('cancelEditRole');
    console.log('Cancel edit role button found:', !!cancelEditRole);
    if (cancelEditRole) {
        cancelEditRole.addEventListener('click', function() {
            hideModal(document.getElementById('editRoleModal'));
        });
    }
    
    // Edit company form
    const editCompanyForm = document.getElementById('editCompanyForm');
    console.log('Edit company form found:', !!editCompanyForm);
    if (editCompanyForm) {
        console.log('Setting up edit company form event listener');
        editCompanyForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Edit company form submitted');
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            console.log('Form data:', data);
            
            // Handle multiple role selections
            const roleSelect = document.getElementById('editAssignedRoles');
            const selectedRoles = Array.from(roleSelect.selectedOptions).map(option => option.value);
            const filteredRoles = selectedRoles.filter(role => role !== '');
            
            console.log('Selected roles:', selectedRoles);
            console.log('Filtered roles:', filteredRoles);
            
            if (filteredRoles.length === 0) {
                showMessage('Please select at least one role', 'error');
                return;
            }
            
            const companyData = {
                ...data,
                assignedRoles: filteredRoles
            };
            
            console.log('Sending company data:', companyData);
            console.log('Current edit company ID:', currentEditCompanyId);
            
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/admin/companies/${currentEditCompanyId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(companyData)
                });
                
                console.log('Response status:', response.status);
                
                if (!response.ok) {
                    const error = await response.json();
                    console.error('Response error:', error);
                    throw new Error(error.error || 'Failed to update company');
                }
                
                const result = await response.json();
                console.log('Update successful:', result);
                
                showMessage('Company updated successfully!', 'success');
                hideModal(document.getElementById('editCompanyModal'));
                loadDashboardData();
            } catch (error) {
                console.error('Error updating company:', error);
                showMessage('Failed to update company: ' + error.message, 'error');
            }
        });
    } else {
        console.error('Edit company form not found!');
    }

    // Cancel edit company button
    const cancelEditCompany = document.getElementById('cancelEditCompany');
    console.log('Cancel edit company button found:', !!cancelEditCompany);
    if (cancelEditCompany) {
        cancelEditCompany.addEventListener('click', function() {
            hideModal(document.getElementById('editCompanyModal'));
        });
    }
    
    console.log('Role and company event listeners setup complete');
}

// Global variable for current edit role
let currentEditRoleId = null;

// Global variable for current edit company
let currentEditCompanyId = null;

function openEditRoleModal(role) {
    currentEditRoleId = role.id;
    document.getElementById('editRoleName').value = role.name;
    document.getElementById('editRoleDescription').value = role.description;
    document.getElementById('editRoleModal').style.display = 'block';
}

function openEditCompanyModal(company) {
    console.log('Opening edit company modal with data:', company);
    currentEditCompanyId = company.id;
    
    // Check if all form elements exist
    const nameField = document.getElementById('editCompanyName');
    const domainField = document.getElementById('editCompanyDomain');
    const emailField = document.getElementById('editCompanyAdminEmail');
    const phoneField = document.getElementById('editCompanyPhone');
    const addressField = document.getElementById('editCompanyAddress');
    const modal = document.getElementById('editCompanyModal');
    
    console.log('Form elements found:', {
        nameField: !!nameField,
        domainField: !!domainField,
        emailField: !!emailField,
        phoneField: !!phoneField,
        addressField: !!addressField,
        modal: !!modal
    });
    
    if (!nameField || !domainField || !emailField || !phoneField || !addressField || !modal) {
        console.error('Some form elements are missing!');
        showMessage('Error: Edit form elements not found', 'error');
        return;
    }
    
    // Populate form fields
    nameField.value = company.name || '';
    domainField.value = company.domain || '';
    emailField.value = company.admin_email || '';
    phoneField.value = company.contact_phone || '';
    addressField.value = company.address || '';
    
    console.log('Form fields populated:', {
        name: nameField.value,
        domain: domainField.value,
        adminEmail: emailField.value,
        phone: phoneField.value,
        address: addressField.value
    });
    
    // Load roles for the select dropdown first
    loadRolesForCompanySelect('editAssignedRoles').then(() => {
        // Set the currently assigned roles after roles are loaded
        const roleSelect = document.getElementById('editAssignedRoles');
        if (roleSelect && company.assigned_roles) {
            console.log('Setting assigned roles:', company.assigned_roles);
            const assignedRoles = company.assigned_roles.split(', ').map(role => role.trim());
            console.log('Parsed assigned roles:', assignedRoles);
            
            Array.from(roleSelect.options).forEach(option => {
                option.selected = assignedRoles.includes(option.value);
            });
        }
    });
    
    modal.style.display = 'block';
    console.log('Edit company modal displayed');
}

// Update handleAddRole to send correct keys
async function handleAddRole(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const roleName = formData.get('roleName');
    const roleDescription = formData.get('roleDescription');
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/roles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ roleName, roleDescription })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add role');
        }
        showMessage('Role added successfully!', 'success');
        hideModal(document.getElementById('addRoleModal'));
        e.target.reset();
        loadDashboardData();
    } catch (error) {
        showMessage('Failed to add role: ' + error.message, 'error');
    }
}

// Update editRole to use modal
async function editRole(roleId) {
    console.log('editRole function called with roleId:', roleId);
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/admin/roles`, { headers: { 'Authorization': `Bearer ${token}` } });
        const roles = await res.json();
        console.log('All roles loaded:', roles);
        const role = roles.find(r => r.id === roleId);
        console.log('Found role to edit:', role);
        if (role) {
            openEditRoleModal(role);
        } else {
            showMessage('Role not found for editing', 'error');
        }
    } catch (e) {
        console.error('Error in editRole:', e);
        showMessage('Failed to load role for editing', 'error');
    }
}

// Delete role function (unchanged, but ensure reload)
async function deleteRole(roleId) {
    console.log('deleteRole function called with roleId:', roleId);
    if (!confirm('Are you sure you want to delete this role?')) {
        console.log('Delete cancelled by user');
        return;
    }
    try {
        const token = localStorage.getItem('token');
        console.log('Sending delete request for role:', roleId);
        const response = await fetch(`/api/admin/roles/${roleId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Delete response status:', response.status);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete role');
        }
        showMessage('Role deleted successfully!', 'success');
        loadDashboardData();
    } catch (error) {
        console.error('Error in deleteRole:', error);
        showMessage('Failed to delete role: ' + error.message, 'error');
    }
}

// Delete company function
async function deleteCompany(companyId) {
    if (!confirm('Are you sure you want to delete this company? This will delete the company, its users, and crew members. Events will be preserved but the company will be removed from event assignments.')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/companies/${companyId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete company');
        }
        
        showMessage('Company deleted successfully!', 'success');
        loadDashboardData();
        
    } catch (error) {
        console.error('Error deleting company:', error);
        showMessage('Failed to delete company: ' + error.message, 'error');
    }
}

// Edit company function
async function editCompany(companyId) {
    console.log('editCompany function called with companyId:', companyId);
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/admin/companies/${companyId}`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        const company = await res.json();
        console.log('Company data for editing:', company);
        if (company) {
            openEditCompanyModal(company);
        } else {
            showMessage('Company not found for editing', 'error');
        }
    } catch (e) {
        console.error('Error in editCompany:', e);
        showMessage('Failed to load company for editing', 'error');
    }
}

// Delete event
async function deleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/events/${eventId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete event');
        }
        
        showMessage('Event deleted successfully!', 'success');
        loadDashboardData();
        
    } catch (error) {
        console.error('Error deleting event:', error);
        showMessage('Failed to delete event: ' + error.message, 'error');
    }
}

// Generate report
async function generateReport() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/reports/generate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to generate report');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `youshallpass-report-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showMessage('Report generated and downloaded successfully!', 'success');
        
    } catch (error) {
        console.error('Error generating report:', error);
        showMessage('Failed to generate report', 'error');
    }
}

// Sign out
function signOut() {
    localStorage.removeItem('token');
    window.location.href = '/signin';
}

// Helper functions
function getActivityIcon(type) {
    const icons = {
        'company': '🏢',
        'event': '📅',
        'user': '👤',
        'approval': '✅'
    };
    return icons[type] || '📊';
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
}

function showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessage = document.querySelector('.admin-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `admin-message admin-message-${type}`;
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

// Edit event function
function editEvent(eventId) {
    window.location.href = `/admin/event-detail?id=${eventId}`;
}

// Cleanup events function
async function cleanupEvents() {
    if (!confirm('⚠️ WARNING: This will delete ALL events completely. This action cannot be undone!\n\nAre you sure you want to delete ALL events?')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/cleanup-events', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            showMessage(`✅ ${result.message} (${result.deletedEvents} events deleted)`, 'success');
            console.log('Deleted events:', result.deletedEvents);
            
            // Refresh the events tab
            await loadEventsTab();
            
            // Show remaining events in console
            setTimeout(() => {
                console.log('📋 Remaining events after cleanup:', result.remainingEvents.length);
                if (result.remainingEvents.length > 0) {
                    console.log('⚠️ Warning: Some events still remain:', result.remainingEvents);
                }
            }, 1000);
            
        } else {
            const error = await response.json();
            showMessage(`❌ Cleanup failed: ${error.error || 'Unknown error'}`, 'error');
        }
        
    } catch (error) {
        console.error('Error during cleanup:', error);
        showMessage(`❌ Error: ${error.message}`, 'error');
    }
}

// Load roles for company select
async function loadRolesForCompanySelect(selectId) {
    try {
        console.log('Loading roles for select:', selectId);
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/roles', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load roles');
        
        const roles = await response.json();
        console.log('Roles loaded:', roles);
        
        const select = document.getElementById(selectId);
        console.log('Select element found:', !!select);
        
        if (!select) {
            console.error('Select element not found:', selectId);
            return;
        }
        
        // Clear existing options except the first placeholder
        select.innerHTML = '<option value="">Select roles to assign to this company</option>';
        
        // Add role options
        roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.name;
            option.textContent = role.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            select.appendChild(option);
        });
        
        console.log('Roles added to select:', selectId, select.options.length);
        return Promise.resolve(); // Return a resolved promise
    } catch (error) {
        console.error('Error loading roles:', error);
        return Promise.reject(error); // Return a rejected promise
    }
} 