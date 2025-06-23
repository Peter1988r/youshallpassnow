document.addEventListener('DOMContentLoaded', () => {
    // Password visibility toggle
    const passwordInput = document.getElementById('password');
    const toggleButton = document.querySelector('.password-toggle');
    
    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            toggleButton.classList.toggle('show');
        });
    }

    // Form submission
    const signinForm = document.getElementById('signinForm');
    
    if (signinForm) {
        signinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(signinForm);
            const data = Object.fromEntries(formData);
            
            // Show loading state
            const submitBtn = signinForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Signing in...';
            submitBtn.disabled = true;

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: data.email,
                        password: data.password
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    // Store token and user data
                    localStorage.setItem('token', result.token);
                    localStorage.setItem('user', JSON.stringify(result.user));
                    
                    // Show success message
                    showMessage('Sign in successful! Redirecting...', 'success');
                    
                    // Redirect based on user type
                    setTimeout(() => {
                        if (result.user.is_super_admin) {
                            window.location.href = '/admin';
                        } else {
                            window.location.href = '/dashboard';
                        }
                    }, 1000);
                } else {
                    throw new Error(result.error || 'Sign in failed');
                }
                
            } catch (error) {
                showMessage('Sign in failed: ' + error.message, 'error');
                console.error('Sign in error:', error);
            } finally {
                // Reset button state
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Helper function to show messages
    function showMessage(message, type = 'info') {
        // Remove existing messages
        const existingMessage = document.querySelector('.auth-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `auth-message auth-message-${type}`;
        messageEl.textContent = message;
        
        // Style the message
        messageEl.style.cssText = `
            padding: 12px;
            margin: 16px 0;
            border-radius: 6px;
            text-align: center;
            font-weight: 500;
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

        // Insert message after the form
        const authBox = document.querySelector('.auth-box');
        authBox.appendChild(messageEl);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 5000);
    }

    // Add demo credentials helper (remove in production)
    const authBox = document.querySelector('.auth-box');
    if (authBox) {
        const demoHelper = document.createElement('div');
        demoHelper.style.cssText = `
            margin-top: 20px;
            padding: 12px;
            background-color: #f3f4f6;
            border-radius: 6px;
            font-size: 12px;
            color: #6b7280;
            text-align: center;
        `;
        demoHelper.innerHTML = `
            <strong>Demo Credentials:</strong><br>
            <strong>Super Admin:</strong> admin@youshallpass.com / admin123<br>
            <strong>Company Admin:</strong> company@demo.youshallpass.com / company123
        `;
        authBox.appendChild(demoHelper);
    }
}); 