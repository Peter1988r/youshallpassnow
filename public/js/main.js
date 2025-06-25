// DOM Elements
const navbar = document.querySelector('.navbar');
const navLinks = document.querySelector('.nav-links');

// Add mobile menu button to navbar
const createMobileMenu = () => {
    const mobileMenuBtn = document.createElement('button');
    mobileMenuBtn.className = 'mobile-menu-btn';
    mobileMenuBtn.setAttribute('aria-label', 'Toggle menu');
    mobileMenuBtn.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;
    navbar.querySelector('.nav-container').appendChild(mobileMenuBtn);
    return mobileMenuBtn;
};

// Mobile menu functionality
const initMobileMenu = () => {
    const mobileMenuBtn = createMobileMenu();
    
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenuBtn.classList.toggle('active');
        navLinks.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navbar.contains(e.target) && navLinks.classList.contains('active')) {
            mobileMenuBtn.classList.remove('active');
            navLinks.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
    });
};

// Smooth scroll for anchor links
const initSmoothScroll = () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                // Close mobile menu if open
                navLinks.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });
    });
};

// Navbar scroll behavior
const initNavbarScroll = () => {
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        // Add/remove background when scrolling
        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        // Hide/show navbar based on scroll direction
        if (currentScroll > lastScroll && currentScroll > 500) {
            navbar.classList.add('nav-hidden');
        } else {
            navbar.classList.remove('nav-hidden');
        }
        
        lastScroll = currentScroll;
    });
};

// Form submission handling (if needed)
const initForms = () => {
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const formData = new FormData(form);
                const requestOptions = {
                    method: form.method || 'POST'
                };
                
                // Only add body for non-GET requests
                if (requestOptions.method !== 'GET') {
                    requestOptions.body = formData;
                }
                
                const response = await fetch(form.action, requestOptions);
                
                if (!response.ok) throw new Error('Form submission failed');
                
                // Handle success (you can customize this)
                console.log('Form submitted successfully');
                form.reset();
                
            } catch (error) {
                console.error('Error:', error);
                // Handle error (you can customize this)
            }
        });
    });
};

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initSmoothScroll();
    initNavbarScroll();
    initForms();
});

// Add some CSS for the new mobile menu button
const addMobileStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
        .mobile-menu-btn {
            display: none;
            flex-direction: column;
            justify-content: space-around;
            width: 30px;
            height: 25px;
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 0;
            z-index: 10;
        }

        .mobile-menu-btn span {
            width: 30px;
            height: 3px;
            background: var(--secondary-color);
            border-radius: 10px;
            transition: all 0.3s linear;
            position: relative;
            transform-origin: 1px;
        }

        .mobile-menu-btn.active span:first-child {
            transform: rotate(45deg);
        }

        .mobile-menu-btn.active span:nth-child(2) {
            opacity: 0;
        }

        .mobile-menu-btn.active span:last-child {
            transform: rotate(-45deg);
        }

        @media (max-width: 768px) {
            .mobile-menu-btn {
                display: flex;
            }

            .nav-links.active {
                display: flex;
                flex-direction: column;
                position: absolute;
                top: 64px;
                left: 0;
                right: 0;
                background: var(--white);
                padding: 1rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            body.menu-open {
                overflow: hidden;
            }
        }
    `;
    document.head.appendChild(style);
};

// Add mobile styles when the script loads
addMobileStyles(); 