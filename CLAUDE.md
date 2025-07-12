# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Workflow

### Production-First Development Process
**CRITICAL**: This repository follows a **production-first development workflow**:

1. **Code editing** is done locally with Claude Code assistance
2. **No local testing** - all testing happens on the live environment
3. **All changes must be committed to GitHub** before testing
4. **Vercel auto-deploys** from GitHub commits, triggering production updates
5. **Request explicit permission** before committing any changes to GitHub

**Development Pattern**:
```bash
# 1. Edit code locally with Claude
# 2. ALWAYS ask for permission before committing:
git add .
git commit -m "Description of changes"
git push origin main  # Triggers Vercel deployment
# 3. Test changes on live site: https://youshallpass.me
```

**Code Quality Requirements**:
- **All code must work on first deployment** - no local testing safety net
- **Defensive programming** - handle edge cases and errors gracefully
- **Thorough validation** - check all scenarios before committing
- **Backward compatibility** - ensure existing functionality remains intact

## Commands

### Development
```bash
npm run dev              # Start server with nodemon (auto-restart) - LOCAL ONLY
npm run dev:debug        # Start with debugging enabled - LOCAL ONLY
npm start                # Production start (used by Vercel)
npm run logs             # View application logs
```

### Database
```bash
node init-db.js          # Initialize database schema and seed data
node migrate-db.js       # Run database migrations
node migrate-templates.js # Migrate badge templates to new format
```

**Note**: Database commands are typically run in production environment via Vercel deployments.

## Architecture Overview

### System Structure
YouShallPass is a **multi-tenant event accreditation system** with four user roles:
- **Super Admin**: System-wide control, company management
- **Company Admin**: Company-specific event and crew management  
- **Field Admin**: Badge validation and scanning capabilities
- **Regular Users**: Basic access to assigned events

### Core Components

#### 1. Authentication & Authorization
- JWT-based authentication with role-based access control
- `authenticateToken` middleware validates JWT tokens
- `requireSuperAdmin` middleware restricts Super Admin endpoints
- Multi-company isolation ensures data security
- **Field validation system** with separate authentication for field admins

#### 2. Field Validation System
**Location**: `/public/field-validation/`

**Purpose**: Mobile-friendly badge scanning and validation interface for field administrators

**Key Features**:
- **QR Code Scanning**: Camera-based QR code validation using device's native camera app
- **Manual Entry**: Fallback option for manual QR data input
- **Real-time Validation**: Instant badge verification with crew and event details
- **Scan History**: Track validation logs with timestamps and locations
- **Access Zone Verification**: Display crew member's authorized access zones

**Workflow**:
1. Field admin logs in with dedicated credentials (`fieldadmin@youshallpass.me`)
2. QR codes on badges contain validation URLs that redirect to this interface
3. Automatic validation via URL parameters or manual QR data entry
4. Results show crew photo, details, event info, and access permissions
5. All scans logged for audit trail

**Technical Implementation**:
- Separate authentication token (`field_auth_token`) for field access
- URL parameter handling for automatic validation from QR scans
- Mobile-responsive interface optimized for field use
- Integration with main validation API endpoints

#### 3. Badge Template System (Complex)
**Location**: `/public/js/event-detail.js`, `/services/pdfGenerator.js`

The badge template system supports **dual formats** for backward compatibility:
- **New format**: `badge_field_layout` (JSONB) + `badge_template_image_path`
- **Legacy format**: `custom_badge_field_mapping` (JSONB) + `custom_badge_template_path`

**Key Components**:
- **Template Editor**: Drag-and-drop field positioning with visual preview
- **Field Persistence**: Position, size, and styling data stored as relative coordinates
- **PDF Generation**: Custom template rendering with fallback to default A5 badges
- **Supabase Integration**: Template images stored in cloud with base64 fallback

**Critical Implementation Details**:
- Field positions use both absolute (x,y) and relative (relativeX, relativeY) coordinates
- Styling data (font, size, color) preserved during field repositioning
- Template loading supports data URIs, HTTP URLs, and local file paths
- **QR codes include digital signatures** for validation by field admins

#### 4. QR Code Validation System
**Location**: `/services/pdfGenerator.js` (generation), `/index.js` (validation API)

**QR Code Generation**:
- Digital signatures using HMAC-SHA256 with secret key
- Payload includes crew member details, event info, access zones
- Expiration timestamps (event end date + 48 hours)
- Validation URL format: `{BASE_URL}/field-validation/validate?token={encryptedToken}`

**Validation API**:
- Signature verification to prevent QR code forgery
- Expiration checking for time-bound access
- Access logging for audit trail
- Response includes crew details and authorized access zones

#### 5. PDF Generation Service
**Location**: `/services/pdfGenerator.js`

**Badge Types**:
- `generateCustomBadge()`: Uses event's custom template if configured
- `generateA5Badge()`: Default professional badge format
- `generateCrewListDirect()`: Multi-page crew roster PDFs

**Generation Flow**:
1. Detect template format (new vs legacy)
2. Load background image from various sources
3. Position fields based on stored coordinates
4. Render with custom styling
5. **Generate secure QR codes** with validation URLs
6. Return PDF buffer

#### 6. Database Layer
**Location**: `/database/schema.js`

**PostgreSQL with Supabase** hosting:
- Connection pooling with automatic reconnection
- Migration-safe column additions using `DO $$ BEGIN ... END $$`
- JSONB columns for complex data (field layouts, access zones)

**Key Tables**:
- `companies`: Multi-tenant company data
- `events`: Badge template columns (both new and legacy)
- `crew_members`: Badge numbers, access zones, QR data
- `event_companies`: Many-to-many event assignment
- **`access_logs`**: Field validation scan history and audit trail

#### 7. Access Zone System
**Location**: `/public/js/event-detail.js` (zones 0-21)

- Flexible zone numbering (0-21 zones per event)
- Zone-based crew member access control
- Dynamic zone creation/editing in event management
- Zone assignments stored as JSONB arrays
- **Field validation displays authorized zones** for each crew member

### File Organization

#### Frontend Structure
- `/public/admin/`: Super Admin dashboard and event management
- `/public/dashboard/`: Company Admin interface
- **`/public/field-validation/`**: Mobile field validation interface
- `/public/js/event-detail.js`: **Complex event management with badge template editor**
- `/public/css/`: Responsive styling with dark theme support

#### Backend Structure
- `/index.js`: Main Express server with all API routes (including validation endpoints)
- `/services/pdfGenerator.js`: **Complex PDF generation with QR code validation URLs**
- `/database/schema.js`: PostgreSQL schema and query functions
- `/config/accessMatrix.js`: Role-based permission mapping

### Environment Configuration
Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Token signing secret
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`: Template image storage
- **`QR_SECRET_KEY`**: QR code digital signature key (critical for validation security)
- **`BASE_URL`**: QR code validation URL base (used in generated QR codes)

### Production-First Development Considerations

**Code Quality Standards**:
- **Error handling must be comprehensive** - no unhandled exceptions in production
- **Input validation required** on all user inputs and API endpoints
- **Graceful degradation** - features should fail safely without breaking the application
- **Database migration safety** - all schema changes must be backward compatible

**Testing Strategy**:
- **Manual testing on live environment** after each deployment
- **Incremental changes** - small, focused commits that can be easily tested
- **Rollback readiness** - ability to quickly revert changes if issues arise
- **User role testing** - verify functionality across all user types (Super Admin, Company Admin, Field Admin)

**Deployment Safety**:
- **Always preserve existing data** - no destructive database operations
- **Maintain API backward compatibility** - existing integrations must continue working
- **Monitor production logs** for errors after deployment
- **Test critical paths** immediately after deployment (auth, badge generation, field validation)

### Field Validation Development Notes

**QR Code Generation**:
- QR codes contain validation URLs, not direct data
- URLs format: `{BASE_URL}/field-validation/validate?token={encrypted_payload}`
- Encrypted payload includes all validation data + digital signature
- Expiration based on event end date + 48 hour grace period

**Field Validation Interface**:
- Designed for mobile use with large touch targets
- Supports both automatic (URL scan) and manual validation modes
- Maintains scan history with location data for audit compliance
- Separate authentication system from main admin interface

**Security Considerations**:
- QR codes digitally signed to prevent forgery
- Time-based expiration prevents replay attacks
- All validation attempts logged for audit trail
- Field admin credentials separate from main system

### Badge Template Development Notes

**When working with badge templates**:
1. **Always preserve existing field data** when updating positions/styling
2. **Use relative coordinates** for cross-template compatibility  
3. **Test both template formats** (new and legacy) for backward compatibility
4. **Handle image loading failures** gracefully with fallbacks
5. **Validate field positions** are within template bounds
6. **Ensure QR codes include proper validation URLs** for field scanning

**Common Issues**:
- Field styling lost during repositioning (use spread operator to preserve)
- Template loading failures (implement multiple fallback paths)
- QR code expiration calculations (ensure event_end_date availability)
- Memory leaks in template editor (clean up event listeners)

### API Patterns

**Multi-tenant data access**:
```javascript
// Company Admin: Filter by user's company
const events = await query(`
    SELECT e.* FROM events e
    JOIN event_companies ec ON e.id = ec.event_id
    WHERE ec.company_id = $1
`, [userCompanyId]);

// Super Admin: Access all data
const events = await query('SELECT * FROM events');
```

**Badge generation endpoints**:
- `/api/admin/crew/:id/badge/pdf`: Individual badge with custom template and QR code
- `/api/events/:id/crew/pdf`: Crew list with company filtering
- `/api/admin/events/:id/badge-template`: Template CRUD operations

**Field validation endpoints**:
- `/field-validation/validate`: QR code validation entry point
- `/api/field/validate`: Validation API with signature verification
- `/api/field/logs`: Scan history for audit trail

### Security Considerations
- Multi-company data isolation enforced at API level
- File upload validation (type, size) with Supabase storage
- **QR codes digitally signed to prevent forgery**
- **Field validation system separate from main admin authentication**
- Rate limiting on authentication endpoints
- JWT token validation on all protected routes
- **Access logging for compliance and audit requirements**

### Development Workflow
1. **Database changes**: Update schema.js with migration-safe SQL
2. **Badge templates**: Test with both new and legacy template formats
3. **Multi-company features**: Ensure proper company isolation
4. **PDF generation**: Verify fallback mechanisms work correctly
5. **QR code validation**: Test signature verification and expiration logic
6. **Field validation**: Test mobile interface and camera integration
7. **Production deployment**: Request permission, commit, verify on live site
8. **User role testing**: Test with Super Admin, Company Admin, and Field Admin roles

---

## Lessons Learned - Production Deployment Issues (Session: Jan 2025)

### Critical Production Readiness Issues Found

#### 🚨 **Database Connection Issues - Root Causes & Solutions**

**Problem**: Database connection failures in production despite correct credentials
**Attempts**: Multiple environment variable updates, fresh Vercel projects, credential rotation
**Root Cause**: Multiple layers of credential override causing confusion

**Key Learnings**:
1. **Hardcoded credentials in vercel.json override dashboard settings** - Always check vercel.json for env vars
2. **dotenv conflicts with Vercel environment variables** - Disable dotenv in production with `if (process.env.NODE_ENV !== 'production')`
3. **Connection string format matters** - Pooled vs direct connection have different hostnames:
   - Direct: `postgresql://postgres:pass@db.project.supabase.co:5432/postgres`
   - Pooled: `postgresql://postgres:pass@aws-region.pooler.supabase.com:6543/postgres`
4. **DNS resolution issues** - Some Supabase hostnames (db.project.supabase.co) may not resolve properly
5. **Environment variable caching** - Vercel can cache old values; requires complete project recreation in extreme cases

**Debugging Strategy**:
- Add debug endpoint to show actual environment variables being used
- Test DNS resolution manually: `nslookup hostname`
- Check git history for hardcoded credentials
- Verify environment variable scope (Production vs Preview vs Development)

#### 🔒 **Security Vulnerabilities - Critical Findings**

**Major Security Issues Discovered**:
1. **Debug endpoints exposed in production** - `/test-users`, `/test-db`, `/init-db`, `/fix-tables` exposed sensitive data
2. **Hardcoded default passwords** - admin123/company123 still in database schema
3. **Security headers disabled** - Helmet middleware commented out, permissive CSP
4. **Information disclosure** - Detailed error messages revealing internal structure

**Security Audit Process**:
- Systematic search for hardcoded credentials across all files
- Review of all API endpoints for debug/test routes
- Check for proper security header implementation
- Verify error handling doesn't leak sensitive information

#### 🛠 **Deployment Process Issues**

**Shell Environment Problems**:
- Shell snapshot file corruption: `/var/folders/.../claude-shell-snapshot-xxxx`
- Persistent across multiple sessions
- Workaround: Manual git commands while using file editing tools

**Vercel Deployment Issues**:
- Environment variables not updating despite UI changes
- Function cache persistence requiring complete project recreation
- Build cache conflicts with environment variable updates

### Best Practices Established

#### 🔍 **Pre-Production Security Checklist**
1. **Remove all debug endpoints** - Search for patterns: `/test-*`, `/debug-*`, `/init-*`, `/fix-*`
2. **Verify environment variables** - Check vercel.json for hardcoded values
3. **Enable security headers** - Ensure Helmet is enabled with proper CSP
4. **Change default passwords** - Never deploy with hardcoded admin credentials
5. **Test database connections** - Use proper connection string format for environment
6. **Audit error handling** - Ensure production errors don't expose internals

#### 🚀 **Deployment Strategy**
1. **Create debug endpoints temporarily** for troubleshooting complex issues
2. **Use systematic approach** to isolate problems (environment → code → platform)
3. **Document exact error messages** for faster diagnosis
4. **Keep production and development environments clearly separated**
5. **Always test fresh deployments** immediately after major changes

#### 🔧 **Environment Management**
1. **Never use dotenv in production** - Only for local development
2. **Verify DNS resolution** for external service hostnames
3. **Use pooled connections** when direct connections fail
4. **Maintain separate environment variable documentation**
5. **Test environment variable changes** with debug endpoints before removing them

#### 🛡 **Security Hardening Process**
1. **Scan for exposed credentials** using multiple search patterns
2. **Remove debug functionality** completely from production builds
3. **Implement proper error handling** that doesn't leak information
4. **Enable all security headers** with appropriate CSP policies
5. **Audit authentication flows** for weak defaults or hardcoded values

### Resolution Timeline Pattern

**Typical Issue Resolution Flow**:
1. **Initial symptoms** - Generic error messages or connection failures
2. **Environment investigation** - Check variables, DNS, credentials
3. **Code audit** - Search for hardcoded values or conflicts
4. **Platform issues** - Vercel caching, deployment problems
5. **Nuclear options** - Complete project recreation if caching persists
6. **Security audit** - Comprehensive review of production readiness

**Time-Saving Tips**:
- Always check vercel.json first for hardcoded environment variables
- Use debug endpoints early to see actual runtime values
- Test DNS resolution manually before debugging connection issues
- Search entire codebase for old credentials when rotating secrets
- Document exact error messages and solutions for future reference

---

## Pre-Launch Security Show Stoppers

**Status: CURRENTLY USING DEMO CREDENTIALS FOR TESTING**
**Action: Address these issues before production launch**

### 🚨 **CRITICAL - LAUNCH BLOCKERS** (Fix Before Launch)

#### 1. Hardcoded Default Passwords - CRITICAL
**Current State**: Demo credentials active for testing
**Locations**:
- `database/schema.js:346` - Super Admin: `admin123`
- `database/schema.js:372` - Company Admin: `company123` 
- `database/schema.js:381` - Field Admin: `admin123`
- `index.js:1450` - API company creation: `admin123`
- `public/debug.html:180` - Debug interface: `admin123`

**Security Strategy for Production**:

```bash
# Required Environment Variables
JWT_SECRET=randomly-generated-64-char-string
QR_SECRET_KEY=another-random-64-char-string
INITIAL_SUPER_ADMIN_EMAIL=your-admin@company.com
INITIAL_SUPER_ADMIN_PASSWORD=secure-random-password
INITIAL_FIELD_ADMIN_PASSWORD=another-secure-password
DEFAULT_COMPANY_ADMIN_PASSWORD=secure-random-password
```

**Password Security Implementation**:
```javascript
// Secure password storage (bcrypt hashing)
// 1. Environment variables provide initial passwords
// 2. bcrypt.hashSync() creates secure hashes
// 3. Only hashes stored in database (users.password_hash)
// 4. bcrypt.compareSync() verifies login attempts
// 5. Force password change on first login (recommended)

// Example implementation:
const adminPassword = bcrypt.hashSync(process.env.INITIAL_SUPER_ADMIN_PASSWORD || 'temp-dev-only', 10);
// Store adminPassword hash in database, not plain text

// Verification on login:
const isValid = bcrypt.compareSync(userEnteredPassword, storedHashFromDB);
```

**Force Password Change System** (Recommended):
1. Generate random temporary passwords
2. Mark accounts as `password_change_required: true`
3. Force password change on first login
4. This way no permanent passwords stored in environment variables

#### 2. Weak Cryptographic Secrets - CRITICAL
**Current Issues**:
- `JWT_SECRET` defaults to `'your-secret-key-change-in-production'` (index.js:100)
- `QR_SECRET_KEY` defaults to `'default-secret-key-change-in-production'` (services/pdfGenerator.js:723)

**Fix Strategy**:
```javascript
// Add startup validation in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key-change-in-production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  if (!process.env.QR_SECRET_KEY || process.env.QR_SECRET_KEY === 'default-secret-key-change-in-production') {
    throw new Error('QR_SECRET_KEY must be set in production');
  }
}
```

#### 3. Debug Endpoints Exposing Data - CRITICAL
**Remove Before Launch**:
- `index.js:1939` - `/debug-env` (exposes environment variables)
- `index.js:3573` - `/debug-public` (exposes database structure)
- `index.js:3541` - `/test-companies` (exposes company data)
- `public/debug.html` - Entire debug interface with hardcoded credentials

**Implementation Strategy**:
```javascript
// Environment-based debug routes
if (process.env.NODE_ENV !== 'production') {
  // Only load debug routes in development
  app.get('/debug-env', ...);
  app.get('/debug-public', ...);
}
```

### ⚠️ **HIGH PRIORITY** (Fix Within 24 Hours of Launch)

#### 4. Information Disclosure in Error Messages
**Issue**: Detailed error messages leak internal structure
**Locations**: Multiple locations in `index.js` (lines 213, 759, 880)
**Fix**: Implement generic error responses for production

#### 5. Production Debug Files
**Issue**: `public/debug.html` accessible in production with hardcoded credentials
**Fix**: Remove from production build or add authentication gate

#### 6. Field Admin Authentication Security
**Issue**: Field admin uses same weak default password, tokens in localStorage
**Fix**: Implement stronger field admin auth, use httpOnly cookies

### 🔶 **MEDIUM PRIORITY** (Fix Within 1 Week)

#### 7. CORS Configuration
**Issue**: CORS origin defaults to localhost, may not be configured for production
**Fix**: Set explicit CORS origins for production environment

#### 8. Field Token Storage
**Issue**: Field authentication tokens stored in localStorage (client-side)
**Fix**: Move to httpOnly cookies for better security

### **Environment Variable Security Checklist**

**For Vercel Production**:
1. Set all required environment variables in Vercel Dashboard
2. **Critical**: Check `vercel.json` doesn't override with hardcoded values
3. Verify variables scope (Production vs Preview vs Development)
4. Test with debug endpoint before removing debug functionality

**For Local Development**:
1. Use `.env` file (already gitignored)
2. Only loads when `NODE_ENV !== 'production'`
3. Keep demo credentials for testing until ready for production

**Security Validation**:
```javascript
// Recommended startup check
const requiredSecrets = ['JWT_SECRET', 'QR_SECRET_KEY', 'DATABASE_URL'];
const missingSecrets = requiredSecrets.filter(secret => !process.env[secret]);

if (process.env.NODE_ENV === 'production' && missingSecrets.length > 0) {
  throw new Error(`Missing required environment variables: ${missingSecrets.join(', ')}`);
}
```

### **Pre-Launch Security Audit Checklist**

- [ ] All hardcoded passwords removed/changed
- [ ] Strong secrets configured in environment variables  
- [ ] Debug endpoints removed from production
- [ ] Error messages sanitized for production
- [ ] `debug.html` removed from production build
- [ ] Field authentication strengthened
- [ ] CORS properly configured for production domain
- [ ] Security headers verified (Helmet enabled)
- [ ] Environment variable validation implemented
- [ ] Password change enforcement implemented (recommended)

**Current Status**: Demo credentials active for testing - **NOT PRODUCTION READY**

---

## Email Notification System - Expansion Plan

### Current State Analysis

**Existing Email Infrastructure**:
- User email addresses stored in database (`companies.contact_email`, `users.email`, `crew_members.email`)
- Approval workflow with status tracking (`pending_approval`, `approved`, `rejected`)
- **Placeholder notifications** currently implemented as console.log statements

**Current Email Placeholders in Codebase**:
- `index.js:1022` - Crew approval notification
- `index.js:1306` - Super Admin approval notification  
- `index.js:1335` - Super Admin rejection notification
- No notifications currently for: crew applications, company creation, event assignments

### Email Service Architecture

#### Service Provider Options
**Recommended: SendGrid**
```javascript
// Environment variables needed
EMAIL_SERVICE_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM_ADDRESS=noreply@youshallpass.me
EMAIL_FROM_NAME=YouShallPass
```

**Alternative: Nodemailer with SMTP**
```javascript
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@youshallpass.me
SMTP_PASS=app_specific_password
```

#### Centralized Email Service Module
**Location**: `/services/emailService.js`

**Core Functions**:
```javascript
// Template-based email system
sendNotificationEmail(template, recipient, data)
sendBulkNotification(template, recipients, data)
logEmailDelivery(recipient, status, error)
retryFailedEmails()
```

### Database Schema Extensions

#### Notification Preferences Table
```sql
CREATE TABLE notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    company_id INTEGER REFERENCES companies(id),
    event_notifications BOOLEAN DEFAULT TRUE,
    approval_notifications BOOLEAN DEFAULT TRUE,
    security_notifications BOOLEAN DEFAULT TRUE,
    digest_frequency TEXT DEFAULT 'immediate', -- immediate, daily, weekly
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Email Delivery Tracking
```sql
CREATE TABLE email_logs (
    id SERIAL PRIMARY KEY,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    template_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, sent, failed, bounced
    sent_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    event_id INTEGER REFERENCES events(id),
    crew_id INTEGER REFERENCES crew_members(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Email Templates and Notification Events

#### Template Types Required

**1. Crew Member Notifications**
- `crew-application-submitted.html` - Confirmation to crew member
- `accreditation-approved.html` - Approval with badge download link
- `accreditation-rejected.html` - Rejection with reason
- `access-zones-updated.html` - Access level changes
- `event-reminder.html` - Event start reminders

**2. Company Admin Notifications**
- `new-crew-application.html` - New application requiring review
- `event-assigned.html` - Company assigned to new event
- `approval-summary.html` - Daily/weekly approval digest
- `event-updates.html` - Event details changed

**3. Super Admin Notifications**
- `company-created.html` - New company account created
- `security-alert.html` - Suspicious field validation activity
- `system-summary.html` - Weekly system activity report

**4. System Notifications**
- `password-reset.html` - Password reset requests
- `account-created.html` - Welcome email for new accounts
- `unsubscribe-confirmation.html` - Unsubscribe confirmations

#### Template Structure
```javascript
// Example template data structure
{
    to: 'user@example.com',
    template: 'accreditation-approved',
    data: {
        firstName: 'John',
        lastName: 'Doe',
        eventName: 'World Championship 2024',
        accessLevel: 'General Access',
        accessZones: ['Zone 1', 'Zone 3'],
        badgeDownloadUrl: 'https://youshallpass.me/badges/download/...',
        eventStartDate: '2024-08-15',
        companyName: 'Demo Company'
    }
}
```

### Implementation Phases

#### Phase 1: Core Notifications (Priority: High)
**Timeline**: 1-2 days

1. **Setup Email Service**
   - Install SendGrid package
   - Configure environment variables
   - Create basic email service module

2. **Replace Existing Placeholders**
   - Convert console.log statements to actual emails
   - Implement crew approval/rejection notifications
   - Add basic HTML email templates

3. **Integration Points**:
   - `PUT /api/admin/approvals/:crewId/approve` (line 1281)
   - `PUT /api/admin/approvals/:crewId/reject` (line 1319)
   - `PUT /api/crew/:crewId/approve` (line 997)

#### Phase 2: Enhanced Features (Priority: Medium)
**Timeline**: 2-3 days

1. **Template System**
   - Create HTML email templates with Handlebars
   - Add email template management
   - Implement template versioning

2. **New Notification Types**
   - Crew application notifications to company admins
   - Company creation notifications
   - Event assignment notifications

3. **User Preferences**
   - Add notification preferences table
   - Implement user email settings interface
   - Add unsubscribe functionality

4. **Integration Points**:
   - `POST /api/events/:eventId/crew` (line 671) - New applications
   - `POST /api/admin/events` (line 1625) - Event creation
   - `POST /api/admin/events/:eventId/companies` (line 2324) - Company assignments

#### Phase 3: Advanced Features (Priority: Low)
**Timeline**: 2-3 days

1. **Email Queue and Reliability**
   - Implement Bull queue for email processing
   - Add retry logic for failed emails
   - Implement rate limiting compliance

2. **Admin Interface**
   - Email delivery status monitoring
   - Failed email retry management
   - Notification template editor
   - Bulk notification tools

3. **Analytics and Reporting**
   - Email delivery rates tracking
   - User engagement metrics
   - Notification effectiveness analysis

### Integration Points

#### API Endpoints Requiring Email Triggers

**Existing Endpoints to Update**:
```javascript
// Crew Management
PUT /api/admin/approvals/:crewId/approve     // Line 1281 - Replace console.log
PUT /api/admin/approvals/:crewId/reject      // Line 1319 - Replace console.log
PUT /api/crew/:crewId/approve                // Line 997 - Replace console.log

// New Email Triggers to Add
POST /api/events/:eventId/crew               // Line 671 - New crew application
POST /api/admin/companies                    // Line 1530 - Company creation
POST /api/admin/events/:eventId/companies   // Line 2324 - Event assignment
PUT /api/admin/events/:eventId              // Line 1980 - Event updates
```

#### File Locations for Implementation
- **Email Service**: `/services/emailService.js` (new file)
- **Email Templates**: `/templates/emails/` (new directory)
- **Admin Interface**: `/public/admin/notifications.html` (new file)
- **Settings API**: Add to `/index.js` (new endpoints)

### Required Package Dependencies

```json
{
  "dependencies": {
    "@sendgrid/mail": "^8.1.0",
    "handlebars": "^4.7.8",
    "bull": "^4.12.0",
    "ioredis": "^5.3.0"
  }
}
```

### Security and Compliance

#### Email Security Measures
1. **API Key Protection**: Store in environment variables only
2. **Rate Limiting**: Comply with SendGrid rate limits (100 emails/second)
3. **Unsubscribe Links**: Include in all marketing-type emails
4. **Email Validation**: Verify email addresses before sending
5. **Audit Logging**: Log all email activity for compliance

#### Privacy Compliance
- GDPR compliance for EU users
- Clear opt-out mechanisms
- Data retention policies for email logs
- User consent tracking

### Testing Strategy

#### Unit Tests
```javascript
// Email service tests
describe('EmailService', () => {
  test('sendApprovalNotification sends correct template');
  test('retry logic works for failed emails');
  test('email validation prevents invalid sends');
});
```

#### Integration Tests
- Test all notification triggers
- Verify template rendering with real data
- Test email delivery in staging environment
- Validate unsubscribe functionality

#### Staging Verification
- Use test email addresses for validation
- Monitor delivery rates and bounce rates
- Test all notification scenarios
- Verify mobile email rendering

### Monitoring and Maintenance

#### Key Metrics to Track
- Email delivery success rate (target: >95%)
- Bounce rate (target: <5%)
- Unsubscribe rate (target: <2%)
- Time to delivery (target: <30 seconds)
- Failed email retry success rate

#### Operational Procedures
- Daily monitoring of email delivery logs
- Weekly review of bounce and unsubscribe rates
- Monthly template performance analysis
- Quarterly security review of email service

### Cost Considerations

#### SendGrid Pricing (Estimated)
- **Free Tier**: 100 emails/day (sufficient for development)
- **Essentials**: $14.95/month for 50,000 emails (suitable for small events)
- **Pro**: $89.95/month for 1.5M emails (suitable for large events)

#### Development Time Investment
- **Phase 1**: 16-20 hours (core functionality)
- **Phase 2**: 24-32 hours (enhanced features)
- **Phase 3**: 24-32 hours (advanced features)
- **Total**: 64-84 hours (8-10.5 days) for complete system

### Future Enhancements

#### Advanced Features (Post-Launch)
1. **SMS Notifications**: Integrate with Twilio for critical alerts
2. **Push Notifications**: Mobile app integration
3. **Email Templates Editor**: Visual template designer for admins
4. **A/B Testing**: Test different email templates for effectiveness
5. **Multi-language Support**: Localized email templates
6. **Email Analytics Dashboard**: Advanced reporting and insights

This email notification system will significantly enhance user experience by providing timely, relevant communications throughout the event accreditation workflow while maintaining security and compliance standards.