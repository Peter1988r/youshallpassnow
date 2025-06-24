document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/signin';
        return;
    }

    // Modal Elements
    const addCrewModal = document.getElementById('addCrewModal');
    const addCrewBtn = document.getElementById('addCrewBtn');
    const cancelAddCrew = document.getElementById('cancelAddCrew');
    const closeModal = document.querySelector('.close-modal');
    
    // Event Cards
    const eventCards = document.querySelectorAll('.event-card');
    
    // Show modal
    addCrewBtn.addEventListener('click', () => {
        addCrewModal.style.display = 'block';
        loadRoles();
    });
    
    // Hide modal
    const hideModal = () => {
        addCrewModal.style.display = 'none';
    };
    
    cancelAddCrew.addEventListener('click', hideModal);
    closeModal.addEventListener('click', hideModal);
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === addCrewModal) {
            hideModal();
        }
    });

    // Load available roles
    async function loadRoles() {
        try {
            const response = await fetch('/api/roles');
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

    // Update crew table
    function updateCrewTable(crewMembers) {
        const tbody = document.querySelector('.crew-table tbody');
        tbody.innerHTML = '';

        crewMembers.forEach(member => {
            const statusClass = member.status === 'approved' ? 'complete' : 'pending';
            const statusText = member.status === 'approved' ? 'Approved' : 'Pending Approval';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${member.first_name} ${member.last_name}</td>
                <td>${member.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                <td>${member.access_level || ''}</td>
                <td>${member.email || ''}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    ${member.status === 'pending_approval' ? 
                        `<button class="btn-icon" title="Approve" onclick="approveCrewMember(${member.id})">
                            <i class="icon-approve"></i>
                        </button>` : 
                        `<button class="btn-icon" title="Download Badge" onclick="downloadBadge('${member.badge_number}')">
                            <i class="icon-download"></i>
                        </button>`
                    }
                    <button class="btn-icon" title="Delete" onclick="deleteCrewMember(${member.id})">
                        <i class="icon-delete"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Update progress bar
    function updateProgressBar(crewMembers) {
        const total = crewMembers.length;
        const completed = crewMembers.filter(m => m.status === 'approved').length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        const progressBar = document.querySelector('.progress');
        const progressText = document.querySelector('.progress-bar + p');
        
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}% Complete`;
        
        // Update crew count
        const crewCount = document.querySelector('.info-card:nth-child(2) p');
        crewCount.textContent = `${completed} Approved / ${total} Total`;
    }

    // Handle form submission
    const addCrewForm = document.getElementById('addCrewForm');
    addCrewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(addCrewForm);
        const data = Object.fromEntries(formData);
        
        // Get selected event
        const activeEventCard = document.querySelector('.event-card.active');
        if (!activeEventCard) {
            showMessage('Please select an event first', 'error');
            return;
        }
        
        const eventId = activeEventCard.dataset.eventId;
        
        // Handle photo upload
        const photoFile = formData.get('photo');
        let photoPath = null;
        
        if (photoFile && photoFile.size > 0) {
            // For MVP, we'll store the file name as a placeholder
            // In production, you'd upload to cloud storage
            photoPath = `/uploads/photos/${Date.now()}_${photoFile.name}`;
        }
        
        try {
            const response = await fetch(`/api/events/${eventId}/crew`, {
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
            loadCrewMembers(eventId);
            
        } catch (error) {
            console.error('Error adding crew member:', error);
            showMessage('Failed to add crew member: ' + error.message, 'error');
        }
    });
    
    // Handle event card selection
    eventCards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove active class from all cards
            eventCards.forEach(c => c.classList.remove('active'));
            // Add active class to clicked card
            card.classList.add('active');
            
            // Load crew members for selected event
            const eventId = card.dataset.eventId;
            loadCrewMembers(eventId);
        });
    });

    // Generate crew list PDF
    const generateCrewListBtn = document.getElementById('generateCrewListBtn');
    if (generateCrewListBtn) {
        generateCrewListBtn.addEventListener('click', async () => {
            const activeEventCard = document.querySelector('.event-card.active');
            if (!activeEventCard) {
                showMessage('Please select an event first', 'error');
                return;
            }
            
            const eventId = activeEventCard.dataset.eventId;
            
            try {
                const response = await fetch(`/api/events/${eventId}/crew/pdf`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) throw new Error('Failed to generate crew list');
                
                const result = await response.json();
                
                // Download the PDF
                window.open(result.url, '_blank');
                showMessage('Crew list PDF generated successfully!', 'success');
                
            } catch (error) {
                console.error('Error generating crew list:', error);
                showMessage('Failed to generate crew list', 'error');
            }
        });
    }

    // Global functions for table actions
    window.approveCrewMember = async (crewId) => {
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
            
            // Reload crew members
            const activeEventCard = document.querySelector('.event-card.active');
            if (activeEventCard) {
                loadCrewMembers(activeEventCard.dataset.eventId);
            }
            
        } catch (error) {
            console.error('Error approving accreditation:', error);
            showMessage('Failed to approve accreditation', 'error');
        }
    };

    window.downloadBadge = async (badgeNumber) => {
        // This would typically download the individual badge PDF
        // For now, we'll show a message
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
            
            // Reload crew members
            const activeEventCard = document.querySelector('.event-card.active');
            if (activeEventCard) {
                loadCrewMembers(activeEventCard.dataset.eventId);
            }
            
        } catch (error) {
            console.error('Error deleting crew member:', error);
            showMessage('Failed to delete crew member', 'error');
        }
    };

    // Helper function to show messages
    function showMessage(message, type = 'info') {
        // Remove existing messages
        const existingMessage = document.querySelector('.dashboard-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `dashboard-message dashboard-message-${type}`;
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

    // Sign out functionality
    const signOutBtn = document.querySelector('.btn-primary');
    if (signOutBtn && signOutBtn.textContent === 'Sign Out') {
        signOutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/signin';
        });
    }

    // Load initial data
    if (eventCards.length > 0) {
        // Select first event by default
        eventCards[0].click();
    }
});

// Function to update event details
function updateEventDetails(eventId) {
    // This would typically fetch data from an API
    const eventDetails = {
        'formula-e': {
            title: 'Formula E World Championship',
            location: 'São Paulo, Brazil',
            date: 'MAR 15-16, 2024',
            crewCount: '24/30',
            progress: '80'
        },
        'extreme-e': {
            title: 'Extreme E Desert X Prix',
            location: 'Saudi Arabia',
            date: 'APR 3-4, 2024',
            crewCount: '18/25',
            progress: '60'
        },
        'e1-series': {
            title: 'E1 Series Championship',
            location: 'Venice, Italy',
            date: 'MAY 20-21, 2024',
            crewCount: '15/20',
            progress: '40'
        }
    };
    
    const details = eventDetails[eventId];
    if (details) {
        // Update UI with event details
        document.querySelector('.event-details h2').textContent = details.title;
        document.querySelector('.info-card:nth-child(2) p').textContent = details.crewCount;
        document.querySelector('.progress').style.width = `${details.progress}%`;
        document.querySelector('.progress-bar + p').textContent = `${details.progress}% Complete`;
    }
} 