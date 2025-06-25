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
        loadUsersTab(),
        loadRolesTab()
    ]);
    loadPendingApprovals();
}

// Companies Tab
async function loadCompaniesTab() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('companiesTableContainer');
    container.innerHTML = '<div>Loading companies...</div>';
    try {
        const res = await fetch('/api/admin/companies', { headers: { 'Authorization': `Bearer ${token}` } });
        const companies = await res.json();
        let html = `<table class="admin-table"><thead><tr><th>Name</th><th>Domain</th><th>Contact Email</th><th>Phone</th><th>Events</th><th>Users</th><th>Actions</th></tr></thead><tbody>`;
        companies.forEach(c => {
            html += `<tr>
                <td>${c.name}</td>
                <td>${c.domain || ''}</td>
                <td>${c.contact_email || ''}</td>
                <td>${c.contact_phone || ''}</td>
                <td>${c.event_count || 0}</td>
                <td>${c.user_count || 0}</td>
                <td>
                    <button class="btn-icon" title="Delete" onclick="deleteCompany(${c.id})">🗑️</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div class="error">Failed to load companies</div>';
    }
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
                        <div class="event-card-company">🏢 ${event.company_name || 'No Company Assigned'}</div>
                        <div class="event-card-status">
                            <span class="status-badge ${statusClass}">${status}</span>
                        </div>
                        <div class="event-card-actions">
                            <button class="btn-secondary" onclick="editEvent(${event.id})">Edit</button>
                            <button class="btn-danger" onclick="deleteEvent(${event.id})">Delete</button>
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

// Users Tab
async function loadUsersTab() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('usersTableContainer');
    container.innerHTML = '<div>Loading users...</div>';
    try {
        const res = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } });
        const users = await res.json();
        let html = `<table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Company</th><th>Actions</th></tr></thead><tbody>`;
        users.forEach(u => {
            html += `<tr>
                <td>${u.first_name} ${u.last_name}</td>
                <td>${u.email}</td>
                <td>${u.role}</td>
                <td>${u.company_name || 'No Company'}</td>
                <td>
                    <button class="btn-icon" title="Delete" onclick="deleteUser(${u.id})">🗑️</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div class="error">Failed to load users</div>';
    }
}

// Roles Tab
async function loadRolesTab() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('rolesManagementContainer');
    container.innerHTML = '<div>Loading roles...</div>';
    try {
        const res = await fetch('/api/admin/roles', { headers: { 'Authorization': `Bearer ${token}` } });
        const roles = await res.json();
        let html = `<table class="admin-table"><thead><tr><th>Role Name</th><th>Company</th><th>Access Level</th><th>Actions</th></tr></thead><tbody>`;
        roles.forEach(r => {
            html += `<tr>
                <td>${r.name}</td>
                <td>${r.company_name || 'Global'}</td>
                <td>${r.access_level}</td>
                <td>
                    <button class="btn-icon" title="Edit" onclick="editRole(${r.id})">✏️</button>
                    <button class="btn-icon" title="Delete" onclick="deleteRole(${r.id})">🗑️</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div class="error">Failed to load roles</div>';
    }
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

// Pending Approvals: Add access level assignment and fix approve/reject/view
async function loadPendingApprovals() {
    const token = localStorage.getItem('token');
    const tbody = document.getElementById('approvalsTableBody');
    tbody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
    try {
        const res = await fetch('/api/admin/approvals', { headers: { 'Authorization': `Bearer ${token}` } });
        const approvals = await res.json();
        let html = '';
        approvals.forEach(a => {
            html += `<tr>
                <td><input type="checkbox" class="approval-checkbox" data-id="${a.id}"></td>
                <td>${a.company_name}</td>
                <td>${a.event_name}</td>
                <td>${a.first_name} ${a.last_name}</td>
                <td>${a.role}</td>
                <td>${a.email || ''}</td>
                <td>${a.created_at}</td>
                <td>
                    <select class="access-level-select" data-id="${a.id}">
                        <option value="RESTRICTED">Restricted</option>
                        <option value="STANDARD">Standard</option>
                        <option value="EXTENDED">Extended</option>
                        <option value="FULL">Full</option>
                        <option value="ADMIN">Admin</option>
                    </select>
                    <button class="btn-approve" data-id="${a.id}">Approve</button>
                    <button class="btn-reject" data-id="${a.id}">Reject</button>
                    <button class="btn-view" data-id="${a.id}">View</button>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;
        setupApprovalButtons();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="8">Failed to load approvals</td></tr>';
    }
}

function setupApprovalButtons() {
    document.querySelectorAll('.btn-approve').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.id;
            const accessLevel = document.querySelector(`.access-level-select[data-id='${id}']`).value;
            const token = localStorage.getItem('token');
            await fetch(`/api/admin/approvals/${id}/approve`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessLevel })
            });
            loadPendingApprovals();
        };
    });
    document.querySelectorAll('.btn-reject').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.id;
            const token = localStorage.getItem('token');
            await fetch(`/api/admin/approvals/${id}/reject`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            loadPendingApprovals();
        };
    });
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.onclick = () => {
            alert('View details coming soon!');
        };
    });
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
        addCompanyBtn.addEventListener('click', () => {
            console.log('Opening company modal');
            addCompanyModal.style.display = 'block';
        });
    }
    
    if (addEventBtn) {
        addEventBtn.addEventListener('click', () => {
            console.log('Opening event modal');
            addEventModal.style.display = 'block';
            loadCompaniesForSelect('eventCompany');
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
            loadCompaniesForSelect('roleCompany');
        });
    }
    
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateReport);
    }
    if (signOutBtn) {
        signOutBtn.addEventListener('click', signOut);
    }
    
    // Hide modals
    const hideModal = (modal) => {
        console.log('Hiding modal:', modal.id);
        modal.style.display = 'none';
    };
    
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
    const addUserForm = document.getElementById('addUserForm');
    const addRoleForm = document.getElementById('addRoleForm');
    
    console.log('Found forms:', {
        addCompanyForm: !!addCompanyForm,
        addEventForm: !!addEventForm,
        addUserForm: !!addUserForm,
        addRoleForm: !!addRoleForm
    });
    
    if (addCompanyForm) {
        addCompanyForm.addEventListener('submit', handleAddCompany);
    }
    if (addEventForm) {
        addEventForm.addEventListener('submit', handleAddEvent);
    }
    if (addUserForm) {
        addUserForm.addEventListener('submit', handleAddUser);
    }
    if (addRoleForm) {
        addRoleForm.addEventListener('submit', handleAddRole);
    }
    
    // Approval actions
    const bulkApproveBtn = document.getElementById('bulkApproveBtn');
    const refreshApprovalsBtn = document.getElementById('refreshApprovalsBtn');
    
    if (bulkApproveBtn) {
        bulkApproveBtn.addEventListener('click', bulkApproveApprovals);
    }
    if (refreshApprovalsBtn) {
        refreshApprovalsBtn.addEventListener('click', loadPendingApprovals);
    }
    
    console.log('Event listeners setup complete');
}

// Load companies for select dropdowns
async function loadCompaniesForSelect(selectId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/companies', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load companies');
        
        const companies = await response.json();
        const select = document.getElementById(selectId);
        
        select.innerHTML = '<option value="">Select a company</option>';
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = company.name;
            select.appendChild(option);
        });
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
    console.log('Company data:', data);
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/companies', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
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
    console.log('Event data:', data);
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
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

// Handle add user
async function handleAddUser(e) {
    console.log('handleAddUser called');
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    console.log('User data:', data);
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add user');
        }
        
        const result = await response.json();
        console.log('User added successfully:', result);
        showMessage('User added successfully!', 'success');
        
        // Hide modal and reset form
        document.getElementById('addUserModal').style.display = 'none';
        e.target.reset();
        
        // Reload dashboard data
        loadDashboardData();
        
    } catch (error) {
        console.error('Error adding user:', error);
        showMessage('Failed to add user: ' + error.message, 'error');
    }
}

// Handle add role
async function handleAddRole(e) {
    console.log('handleAddRole called');
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    console.log('Role data:', data);
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/roles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add role');
        }
        
        const result = await response.json();
        console.log('Role added successfully:', result);
        showMessage('Role added successfully!', 'success');
        
        // Hide modal and reset form
        document.getElementById('addRoleModal').style.display = 'none';
        e.target.reset();
        
        // Reload dashboard data
        loadDashboardData();
        
    } catch (error) {
        console.error('Error adding role:', error);
        showMessage('Failed to add role: ' + error.message, 'error');
    }
}

// Edit role function
async function editRole(roleId) {
    // For now, show a simple prompt. In a full implementation, you'd open a modal
    const newName = prompt('Enter new role name:');
    const newAccessLevel = prompt('Enter new access level (RESTRICTED/STANDARD/EXTENDED/FULL/ADMIN):');
    
    if (newName && newAccessLevel) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/admin/roles/${roleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: newName,
                    access_level: newAccessLevel
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update role');
            }
            
            showMessage('Role updated successfully!', 'success');
            loadDashboardData();
            
        } catch (error) {
            console.error('Error updating role:', error);
            showMessage('Failed to update role: ' + error.message, 'error');
        }
    }
}

// Delete role function
async function deleteRole(roleId) {
    if (!confirm('Are you sure you want to delete this role?')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/roles/${roleId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete role');
        }
        
        showMessage('Role deleted successfully!', 'success');
        loadDashboardData();
        
    } catch (error) {
        console.error('Error deleting role:', error);
        showMessage('Failed to delete role: ' + error.message, 'error');
    }
}

// Delete company function
async function deleteCompany(companyId) {
    if (!confirm('Are you sure you want to delete this company? This will also delete all associated events, users, and crew members.')) {
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

// Delete event function
async function deleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event? This will also delete all associated crew members.')) {
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

// Delete user function
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete user');
        }
        
        showMessage('User deleted successfully!', 'success');
        loadDashboardData();
        
    } catch (error) {
        console.error('Error deleting user:', error);
        showMessage('Failed to delete user: ' + error.message, 'error');
    }
}

// Global functions for approval actions
window.approveApproval = async (id) => {
    const accessLevel = document.querySelector(`.access-level-select[data-id='${id}']`).value;
    const token = localStorage.getItem('token');
    await fetch(`/api/admin/approvals/${id}/approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessLevel })
    });
    loadPendingApprovals();
};

window.rejectApproval = async (id) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/admin/approvals/${id}/reject`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    loadPendingApprovals();
};

window.viewApproval = (id) => {
    alert('View details coming soon!');
};

// Global functions for role management
window.editRole = editRole;
window.deleteRole = deleteRole;

// Global functions for company, event, and user management
window.deleteCompany = deleteCompany;
window.deleteEvent = deleteEvent;
window.deleteUser = deleteUser;

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

// Setup approval checkboxes functionality
function setupApprovalCheckboxes() {
    const selectAllCheckbox = document.getElementById('selectAllApprovals');
    const approvalCheckboxes = document.querySelectorAll('.approval-checkbox');
    const bulkApproveBtn = document.getElementById('bulkApproveBtn');
    
    // Select all functionality
    selectAllCheckbox.addEventListener('change', (e) => {
        approvalCheckboxes.forEach(checkbox => {
            checkbox.checked = e.target.checked;
        });
        updateBulkApproveButton();
    });
    
    // Individual checkbox functionality
    approvalCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateBulkApproveButton);
    });
    
    function updateBulkApproveButton() {
        const checkedCount = document.querySelectorAll('.approval-checkbox:checked').length;
        bulkApproveBtn.disabled = checkedCount === 0;
        bulkApproveBtn.textContent = checkedCount > 0 ? `Bulk Approve (${checkedCount})` : 'Bulk Approve Selected';
    }
}

// Bulk approve selected approvals
async function bulkApproveApprovals() {
    const selectedCheckboxes = document.querySelectorAll('.approval-checkbox:checked');
    const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    
    if (selectedIds.length === 0) {
        showMessage('No approvals selected', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to approve ${selectedIds.length} accreditation(s)?`)) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const promises = selectedIds.map(id => 
            fetch(`/api/admin/approvals/${id}/approve`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
        );
        
        const results = await Promise.all(promises);
        const failedCount = results.filter(r => !r.ok).length;
        const successCount = results.length - failedCount;
        
        if (successCount > 0) {
            showMessage(`Successfully approved ${successCount} accreditation(s)!`, 'success');
        }
        
        if (failedCount > 0) {
            showMessage(`Failed to approve ${failedCount} accreditation(s)`, 'error');
        }
        
        // Reload data
        loadPendingApprovals();
        loadStats();
        
    } catch (error) {
        console.error('Error bulk approving:', error);
        showMessage('Failed to bulk approve accreditations', 'error');
    }
}

// View applicant details
window.viewApplicantDetails = async (crewId) => {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/approvals/${crewId}/details`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load applicant details');
        
        const details = await response.json();
        
        // Create and show modal with details
        showApplicantDetailsModal(details);
        
    } catch (error) {
        console.error('Error loading applicant details:', error);
        showMessage('Failed to load applicant details', 'error');
    }
};

// Show applicant details modal
function showApplicantDetailsModal(details) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Applicant Details</h3>
                <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="applicant-details">
                <div class="detail-row">
                    <strong>Name:</strong> ${details.first_name} ${details.last_name}
                </div>
                <div class="detail-row">
                    <strong>Email:</strong> ${details.email}
                </div>
                <div class="detail-row">
                    <strong>Role:</strong> ${details.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div class="detail-row">
                    <strong>Company:</strong> ${details.company_name}
                </div>
                <div class="detail-row">
                    <strong>Event:</strong> ${details.event_name}
                </div>
                <div class="detail-row">
                    <strong>Requested:</strong> ${formatTime(details.created_at)}
                </div>
                <div class="detail-row">
                    <strong>Badge Number:</strong> ${details.badge_number}
                </div>
                <div class="detail-row">
                    <strong>Access Level:</strong> ${details.access_level}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                <button class="approve-btn" onclick="approveAccreditation(${details.id}); this.closest('.modal').remove()">Approve</button>
                <button class="reject-btn" onclick="rejectAccreditation(${details.id}); this.closest('.modal').remove()">Reject</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Edit event function
function editEvent(eventId) {
    window.location.href = `/admin/event-detail?id=${eventId}`;
} 