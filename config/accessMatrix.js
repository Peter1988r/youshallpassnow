// Role-based Access Control Matrix
// Maps crew roles to access levels for event accreditation

const ACCESS_LEVELS = {
    LEVEL_1: 'RESTRICTED',      // Limited access - basic areas only
    LEVEL_2: 'STANDARD',        // Standard access - most areas
    LEVEL_3: 'EXTENDED',        // Extended access - technical areas
    LEVEL_4: 'FULL',           // Full access - all areas including restricted
    LEVEL_5: 'ADMIN'           // Administrative access - complete control
};

const ROLE_ACCESS_MATRIX = {
    // Media & Press
    'media_personnel': ACCESS_LEVELS.LEVEL_1,
    'photographer': ACCESS_LEVELS.LEVEL_1,
    'journalist': ACCESS_LEVELS.LEVEL_1,
    'broadcaster': ACCESS_LEVELS.LEVEL_1,
    
    // Support Staff
    'catering': ACCESS_LEVELS.LEVEL_1,
    'security': ACCESS_LEVELS.LEVEL_2,
    'cleaner': ACCESS_LEVELS.LEVEL_1,
    'volunteer': ACCESS_LEVELS.LEVEL_1,
    
    // Technical Staff
    'mechanic': ACCESS_LEVELS.LEVEL_3,
    'engineer': ACCESS_LEVELS.LEVEL_3,
    'technician': ACCESS_LEVELS.LEVEL_3,
    'electrician': ACCESS_LEVELS.LEVEL_3,
    
    // Management
    'team_manager': ACCESS_LEVELS.LEVEL_4,
    'technical_director': ACCESS_LEVELS.LEVEL_4,
    'team_principal': ACCESS_LEVELS.LEVEL_4,
    
    // Drivers & Athletes
    'driver': ACCESS_LEVELS.LEVEL_3,
    'pilot': ACCESS_LEVELS.LEVEL_3,
    'athlete': ACCESS_LEVELS.LEVEL_2,
    
    // Officials
    'race_official': ACCESS_LEVELS.LEVEL_4,
    'steward': ACCESS_LEVELS.LEVEL_4,
    'marshal': ACCESS_LEVELS.LEVEL_2,
    
    // Administrative
    'event_coordinator': ACCESS_LEVELS.LEVEL_5,
    'event_manager': ACCESS_LEVELS.LEVEL_5,
    'admin': ACCESS_LEVELS.LEVEL_5
};

// Access level descriptions for PDF badges
const ACCESS_LEVEL_DESCRIPTIONS = {
    [ACCESS_LEVELS.LEVEL_1]: 'RESTRICTED ACCESS - Media & Support Areas Only',
    [ACCESS_LEVELS.LEVEL_2]: 'STANDARD ACCESS - Public & Support Areas',
    [ACCESS_LEVELS.LEVEL_3]: 'EXTENDED ACCESS - Technical & Team Areas',
    [ACCESS_LEVELS.LEVEL_4]: 'FULL ACCESS - All Areas Including Restricted',
    [ACCESS_LEVELS.LEVEL_5]: 'ADMINISTRATIVE ACCESS - Complete Control'
};

// Color coding for access levels (for PDF badges)
const ACCESS_LEVEL_COLORS = {
    [ACCESS_LEVELS.LEVEL_1]: '#FF6B6B', // Red
    [ACCESS_LEVELS.LEVEL_2]: '#4ECDC4', // Teal
    [ACCESS_LEVELS.LEVEL_3]: '#45B7D1', // Blue
    [ACCESS_LEVELS.LEVEL_4]: '#96CEB4', // Green
    [ACCESS_LEVELS.LEVEL_5]: '#FFEAA7'  // Yellow
};

module.exports = {
    ACCESS_LEVELS,
    ROLE_ACCESS_MATRIX,
    ACCESS_LEVEL_DESCRIPTIONS,
    ACCESS_LEVEL_COLORS
}; 