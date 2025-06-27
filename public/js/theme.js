// Dark Mode Toggle Functionality
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.init();
    }

    init() {
        // Apply saved theme on page load
        this.applyTheme(this.theme);
        
        // Create theme toggle button if it doesn't exist
        this.createToggleButton();
        
        // Set up event listeners
        this.setupEventListeners();
    }

    createToggleButton() {
        // Check if we're on a page with navigation
        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;

        // Check if toggle already exists
        if (document.getElementById('theme-toggle')) return;

        // Create toggle button
        const toggleButton = document.createElement('button');
        toggleButton.id = 'theme-toggle';
        toggleButton.className = 'theme-toggle';
        toggleButton.setAttribute('aria-label', 'Toggle dark mode');
        toggleButton.innerHTML = this.theme === 'dark' ? '☀️' : '🌙';
        
        // Add to navigation
        navLinks.appendChild(toggleButton);
    }

    setupEventListeners() {
        // Listen for toggle button clicks
        document.addEventListener('click', (e) => {
            if (e.target.id === 'theme-toggle' || e.target.closest('#theme-toggle')) {
                this.toggleTheme();
            }
        });

        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addListener((e) => {
                if (!localStorage.getItem('theme')) {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.theme);
        this.saveTheme();
        this.updateToggleIcon();
    }

    applyTheme(theme) {
        const html = document.documentElement;
        
        if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
        } else {
            html.removeAttribute('data-theme');
        }

        this.theme = theme;
    }

    saveTheme() {
        localStorage.setItem('theme', this.theme);
    }

    updateToggleIcon() {
        const toggleButton = document.getElementById('theme-toggle');
        if (toggleButton) {
            toggleButton.innerHTML = this.theme === 'dark' ? '☀️' : '🌙';
        }
    }

    // Get current theme
    getCurrentTheme() {
        return this.theme;
    }

    // Set theme programmatically
    setTheme(theme) {
        if (theme === 'light' || theme === 'dark') {
            this.theme = theme;
            this.applyTheme(theme);
            this.saveTheme();
            this.updateToggleIcon();
        }
    }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});

// Also handle cases where this script loads after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.themeManager) {
            window.themeManager = new ThemeManager();
        }
    });
} else {
    if (!window.themeManager) {
        window.themeManager = new ThemeManager();
    }
} 