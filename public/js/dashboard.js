// Force dark mode permanently
document.documentElement.setAttribute('data-theme', 'dark');
localStorage.removeItem('theme'); // Clear any stored theme preference

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/signin';
        return;
    }

    // DOM Elements
    const eventsSection = document.getElementById('eventsSection');
    const eventCards = document.getElementById('eventCards');
    const eventDetails = document.getElementById('eventDetails');
    const eventTitle = document.getElementById('eventTitle');
    const eventStatus = document.getElementById('eventStatus');
    const crewCount = document.getElementById('crewCount');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const crewTableBody = document.getElementById('crewTableBody');
    const backToEventsBtn = document.getElementById('backToEventsBtn');
    
    // Modal Elements
    const addCrewModal = document.getElementById('addCrewModal');
    const addCrewBtn = document.getElementById('addCrewBtn');
    const cancelAddCrew = document.getElementById('cancelAddCrew');
    const closeModal = document.querySelector('.close-modal');
    
    let currentEventId = null;
    let events = [];
    let userInfo = null;

    // Initialize dashboard
    loadUserInfo();
    loadCompanyEvents();

    // Load user info to determine role
    async function loadUserInfo() {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                userInfo = await response.json();
                console.log('User info loaded:', userInfo);
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }

    // Load company events
    async function loadCompanyEvents() {
        try {
            eventCards.innerHTML = '<div class="loading-events"><p>Loading your events...</p></div>';
            
            console.log('Fetching company events...');
            const response = await fetch('/api/company/events', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('API Error:', errorData);
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            events = await response.json();
            console.log('Events loaded:', events);
            
            if (events.length === 0) {
                eventCards.innerHTML = '<div class="no-events"><p>No events assigned to your company yet.</p></div>';
                return;
            }
            
            displayEvents(events);
        } catch (error) {
            console.error('Error loading events:', error);
            eventCards.innerHTML = `<div class="no-events"><p>Error loading events: ${error.message}</p></div>`;
        }
    }

    // Display events as cards
    function displayEvents(events) {
        eventCards.innerHTML = '';
        
        events.forEach((event, index) => {
            const eventCard = document.createElement('div');
            eventCard.className = 'event-card';
            eventCard.dataset.eventId = event.id;
            
            // Format dates
            const startDate = new Date(event.start_date);
            const endDate = new Date(event.end_date);
            const dateRange = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            
            // Get color variant and icon based on index and event type
            const colorVariant = `variant-${(index % 5) + 1}`;
            const eventIcon = getEventIcon(event.name);
            
            // Use event photo if available, fallback to gradient with icon
            const eventImage = event.event_photo_path || null;
            
            let headerContent;
            if (eventImage) {
                headerContent = `
                    <div class="event-card-image">
                        <img src="${eventImage}" alt="${event.name}" onerror="this.parentNode.innerHTML='<div class=&quot;event-card-header ${colorVariant}&quot;><div class=&quot;event-card-icon&quot;>${eventIcon}</div></div>'">
                    </div>
                `;
            } else {
                headerContent = `
                    <div class="event-card-header ${colorVariant}">
                        <div class="event-card-icon">${eventIcon}</div>
                    </div>
                `;
            }
            
            eventCard.innerHTML = `
                ${headerContent}
                <div class="event-info">
                    <h3>${event.name}</h3>
                    <p>${event.location}</p>
                    <span class="event-date">${dateRange}</span>
                </div>
            `;
            
            eventCard.addEventListener('click', () => selectEvent(event.id));
            eventCards.appendChild(eventCard);
        });
    }

    // Get event icon based on event name
    function getEventIcon(eventName) {
        const name = eventName.toLowerCase();
        if (name.includes('formula e') || name.includes('formula-e') || name.includes('racing')) {
            return '🏎️';
        } else if (name.includes('extreme e') || name.includes('extreme-e') || name.includes('desert')) {
            return '🏜️';
        } else if (name.includes('e1') || name.includes('powerboat') || name.includes('boat')) {
            return '🚤';
        } else if (name.includes('conference') || name.includes('meeting')) {
            return '📊';
        } else if (name.includes('festival') || name.includes('music')) {
            return '🎵';
        } else if (name.includes('sport') || name.includes('competition')) {
            return '🏆';
        } else {
            return '��';
        }
    }

    // Select an event and show details
    async function selectEvent(eventId) {
        currentEventId = eventId;
        
        // Update active card
        document.querySelectorAll('.event-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-event-id="${eventId}"]`).classList.add('active');
        
        // Show event details
        eventsSection.style.display = 'none';
        eventDetails.style.display = 'block';
        
        // Load event details and crew
        await loadEventDetails(eventId);
        await loadCrewMembers(eventId);
    }

    // Load event details
    async function loadEventDetails(eventId) {
        const event = events.find(e => e.id == eventId);
        if (event) {
            eventTitle.textContent = event.name;
            eventStatus.textContent = event.status || 'Active';
        }
    }

    // Load crew members for selected event
    async function loadCrewMembers(eventId) {
        try {
            const response = await fetch(`/api/events/${eventId}/crew`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to load crew members');
            
            const crewMembers = await response.json();
            updateCrewTable(crewMembers);
            updateProgressBar(crewMembers);
        } catch (error) {
            console.error('Error loading crew members:', error);
            showMessage('Failed to load crew members', 'error');
        }
    }

    // Handle crew action button clicks
    function handleCrewActions(e) {
        const button = e.target.closest('[data-action]');
        if (!button) return;
        
        const action = button.dataset.action;
        const crewId = button.dataset.crewId;
        const badgeNumber = button.dataset.badgeNumber;
        
        switch (action) {
            case 'approve':
                approveCrewMember(crewId);
                break;
            case 'delete':
                deleteCrewMember(crewId);
                break;
            case 'download':
                downloadBadge(badgeNumber);
                break;
        }
    }

    // Update crew table
    function updateCrewTable(crewMembers) {
        crewTableBody.innerHTML = '';

        if (crewMembers.length === 0) {
            crewTableBody.innerHTML = '<tr><td colspan="6" class="no-crew">No crew members for this event</td></tr>';
            return;
        }

        crewMembers.forEach(member => {
            const row = document.createElement('tr');
            let statusClass, statusText;
            
            if (member.status === 'approved') {
                statusClass = 'complete';
                statusText = 'Approved';
            } else if (member.status === 'rejected') {
                statusClass = 'rejected';
                statusText = 'Rejected';
            } else {
                statusClass = 'pending';
                statusText = 'Pending Approval';
            }
            
            // Company admins can only delete crew members, not approve them
            let actionsHtml = '';
            if (userInfo && userInfo.is_super_admin) {
                // Super admins can approve/delete
                actionsHtml = `
                    ${member.status === 'pending_approval' ? 
                        `<button class="btn-icon" title="Approve" data-crew-id="${member.id}" data-action="approve">✓</button>` : 
                        `<button class="btn-icon" title="Download Badge" data-badge-number="${member.badge_number}" data-action="download">📄</button>`
                    }
                    <button class="btn-icon" title="Delete" data-crew-id="${member.id}" data-action="delete">🗑️</button>
                `;
            } else {
                // Company admins can only delete
                actionsHtml = `
                    <button class="btn-icon" title="Delete" data-crew-id="${member.id}" data-action="delete">🗑️</button>
                `;
            }
            
            // Format access zones display
            let accessZonesDisplay = 'No zones assigned';
            if (member.access_zones && Array.isArray(member.access_zones) && member.access_zones.length > 0) {
                accessZonesDisplay = member.access_zones.map(zone => `Zone ${zone}`).join(', ');
            }
            
            row.innerHTML = `
                <td>${member.first_name} ${member.last_name}</td>
                <td>${member.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                <td><span class="access-zones">${accessZonesDisplay}</span></td>
                <td>${member.email || ''}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${actionsHtml}</td>
            `;
            crewTableBody.appendChild(row);
        });
        
        // Add event delegation for crew action buttons (remove existing listeners first)
        crewTableBody.removeEventListener('click', handleCrewActions);
        crewTableBody.addEventListener('click', handleCrewActions);
    }

    // Update progress bar
    function updateProgressBar(crewMembers) {
        const total = crewMembers.length;
        const completed = crewMembers.filter(m => m.status === 'approved').length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}% Complete`;
        crewCount.textContent = `${completed} Approved / ${total} Total`;
    }

    // Back to events button
    backToEventsBtn.addEventListener('click', () => {
        eventsSection.style.display = 'block';
        eventDetails.style.display = 'none';
        document.querySelectorAll('.event-card').forEach(card => {
            card.classList.remove('active');
        });
        currentEventId = null;
    });

    // Modal functionality
    addCrewBtn.addEventListener('click', () => {
        if (!currentEventId) {
            showMessage('Please select an event first', 'error');
            return;
        }
        addCrewModal.style.display = 'block';
        loadRoles();
    });
    
    const hideModal = () => {
        addCrewModal.style.display = 'none';
    };
    
    cancelAddCrew.addEventListener('click', hideModal);
    closeModal.addEventListener('click', hideModal);
    
    window.addEventListener('click', (e) => {
        if (e.target === addCrewModal) {
            hideModal();
        }
    });

    // Load available roles
    async function loadRoles() {
        try {
            const response = await fetch('/api/company/roles', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const roles = await response.json();
            
            const roleSelect = document.getElementById('role');
            roleSelect.innerHTML = '<option value="">Select a role</option>';
            
            roles.forEach(role => {
                const option = document.createElement('option');
                option.value = role;
                option.textContent = role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                roleSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading roles:', error);
        }
    }

    // Handle form submission
    const addCrewForm = document.getElementById('addCrewForm');
    addCrewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(addCrewForm);
        const data = Object.fromEntries(formData);
        
        if (!currentEventId) {
            showMessage('Please select an event first', 'error');
            return;
        }
        
        // Handle photo upload
        const photoFile = formData.get('photo');
        let photoPath = null;
        
        // Upload photo first if provided
        if (photoFile && photoFile.size > 0) {
            try {
                const photoFormData = new FormData();
                photoFormData.append('photo', photoFile);
                
                const uploadResponse = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: photoFormData
                });
                
                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    console.error('Upload response error:', uploadResponse.status, errorText);
                    throw new Error(`Failed to upload photo: ${uploadResponse.status} - ${errorText}`);
                }
                
                const uploadResult = await uploadResponse.json();
                photoPath = uploadResult.path;
                console.log('Photo uploaded successfully:', photoPath);
            } catch (uploadError) {
                console.error('Photo upload error:', uploadError);
                showMessage('Failed to upload photo: ' + uploadError.message, 'error');
                return;
            }
        }
        
        try {
            const response = await fetch(`/api/events/${currentEventId}/crew`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    role: data.role,
                    photoPath: photoPath
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add crew member');
            }
            
            const result = await response.json();
            
            showMessage('Crew Member added successfully! Accreditation is pending approval.', 'success');
            hideModal();
            addCrewForm.reset();
            
            // Reload crew members
            loadCrewMembers(currentEventId);
            
        } catch (error) {
            console.error('Error adding crew member:', error);
            showMessage('Failed to add crew member: ' + error.message, 'error');
        }
    });

    // Generate crew list PDF
    const generateCrewListBtn = document.getElementById('generateCrewListBtn');
    if (generateCrewListBtn) {
        generateCrewListBtn.addEventListener('click', async () => {
            if (!currentEventId) {
                showMessage('Please select an event first', 'error');
                return;
            }
            
            try {
                generateCrewListBtn.disabled = true;
                generateCrewListBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
                
                const response = await fetch(`/api/events/${currentEventId}/crew/pdf`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || 'Failed to generate crew list');
                }
                
                // Get the PDF blob
                const blob = await response.blob();
                
                // Extract filename from Content-Disposition header
                const contentDisposition = response.headers.get('content-disposition');
                let filename = 'crew-list.pdf';
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                    if (filenameMatch) {
                        filename = filenameMatch[1];
                    }
                }
                
                // Create download link
                const downloadLink = document.createElement('a');
                downloadLink.href = URL.createObjectURL(blob);
                downloadLink.download = filename;
                downloadLink.style.display = 'none';
                
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                
                // Clean up the blob URL
                URL.revokeObjectURL(downloadLink.href);
                
                showMessage('Crew list PDF downloaded successfully!', 'success');
                
            } catch (error) {
                console.error('Error generating crew list:', error);
                showMessage('Failed to generate crew list: ' + error.message, 'error');
            } finally {
                generateCrewListBtn.disabled = false;
                generateCrewListBtn.innerHTML = '<i class="fas fa-download"></i> Generate Crew List PDF';
            }
        });
    }

    // Global functions for table actions
    window.approveCrewMember = async (crewId) => {
        // Only super admins can approve
        if (!userInfo || !userInfo.is_super_admin) {
            showMessage('Only Super Admins can approve crew members. Please contact your administrator.', 'error');
            return;
        }
        
        if (!confirm('Are you sure you want to approve this crew member\'s accreditation?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/crew/${crewId}/approve`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to approve accreditation');
            
            const result = await response.json();
            showMessage('Accreditation approved! Notification sent to crew member.', 'success');
            
            if (currentEventId) {
                loadCrewMembers(currentEventId);
            }
            
        } catch (error) {
            console.error('Error approving accreditation:', error);
            showMessage('Failed to approve accreditation', 'error');
        }
    };

    window.downloadBadge = async (badgeNumber) => {
        showMessage(`Badge ${badgeNumber} download feature coming soon!`, 'info');
    };

    window.deleteCrewMember = async (crewId) => {
        if (!confirm('Are you sure you want to delete this crew member?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/crew/${crewId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to delete crew member');
            
            showMessage('Crew member deleted successfully!', 'success');
            
            if (currentEventId) {
                loadCrewMembers(currentEventId);
            }
            
        } catch (error) {
            console.error('Error deleting crew member:', error);
            showMessage('Failed to delete crew member', 'error');
        }
    };

    // Helper function to show messages
    function showMessage(message, type = 'info') {
        const existingMessage = document.querySelector('.dashboard-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageEl = document.createElement('div');
        messageEl.className = `dashboard-message dashboard-message-${type}`;
        messageEl.textContent = message;
        
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

        document.body.appendChild(messageEl);

        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 5000);
    }

    // Sign out functionality
    const signOutBtn = document.querySelector('.btn-primary');
    if (signOutBtn && signOutBtn.textContent === 'Sign Out') {
        signOutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/signin';
        });
    }
}); 