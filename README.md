# YouShallPass - Event Accreditation MVP

<!-- Last updated: 2024-12-19 -->

A professional event accreditation system with PDF badge generation, role-based access control, and **multi-company management**.

## 🚀 7-Day MVP Features

### ✅ **Completed Features**
- **Multi-Company Management**: Super Admin can manage multiple companies
- **Super Admin Dashboard**: Complete system oversight and management
- **User Authentication**: Secure login with JWT tokens (Super Admin & Company Admin)
- **Event Management**: Create and manage events for different companies
- **Crew Management**: Add, edit, and delete crew members
- **Role-Based Access Control**: 5 access levels mapped to roles
- **PDF Badge Generation**: Individual crew member badges
- **Crew List PDF**: Complete crew roster with details
- **Database**: SQLite with proper schemas and relationships
- **Security**: Rate limiting, CORS, helmet.js
- **Modern UI**: Responsive design with professional styling

### 🎯 **Access Levels**
- **LEVEL 1 (RESTRICTED)**: Media & Support Areas Only
- **LEVEL 2 (STANDARD)**: Public & Support Areas  
- **LEVEL 3 (EXTENDED)**: Technical & Team Areas
- **LEVEL 4 (FULL)**: All Areas Including Restricted
- **LEVEL 5 (ADMIN)**: Complete Control

## 🛠️ Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```

3. **Access the Application**
   - Open: http://localhost:3000
   - **Super Admin**: admin@youshallpass.com / admin123
   - **Company Admin**: company@demo.youshallpass.com / company123

## 👑 Super Admin Features

### **Dashboard Overview**
- **System Statistics**: View total companies, events, users, and pending approvals
- **Recent Activity**: Monitor system-wide activity and new accreditation requests
- **Pending Approvals**: Approve or reject accreditations across all companies
- **Quick Actions**: Add companies, create events, add users, generate reports

### **Company Management**
- Add new companies with subscription plans
- Manage company domains and contact information
- View company statistics (events, users)
- Monitor company activity

### **Event Management**
- Create events for any company
- Set event dates, locations, and descriptions
- Track event status and crew members

### **User Management**
- Add company admins and users
- Assign users to specific companies
- Manage user roles and permissions

### **System Reports**
- Generate comprehensive system reports
- Export data for analysis
- Monitor system usage and trends

## 🏢 Company Admin Features

### **Dashboard**
- View company-specific events
- Manage crew members for company events
- Track onboarding progress
- Generate PDF reports

### **Crew Management**
- Add employees to events
- Approve accreditations
- Generate individual badges
- Create crew lists

## 📁 Project Structure

```
WeAccredit/
├── config/
│   └── accessMatrix.js      # Role-based access control
├── database/
│   └── schema.js           # Database setup and queries
├── services/
│   └── pdfGenerator.js     # PDF badge generation
├── public/
│   ├── admin/              # Super Admin dashboard
│   ├── css/               # Stylesheets
│   ├── js/                # Frontend JavaScript
│   ├── assets/            # Images and resources
│   ├── badges/            # Generated PDF badges
│   └── *.html             # Frontend pages
├── index.js               # Main server file
├── package.json           # Dependencies
└── README.md             # This file
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info

### Super Admin APIs
- `GET /api/admin/stats` - Get system statistics
- `GET /api/admin/activity` - Get recent activity
- `GET /api/admin/approvals` - Get pending approvals
- `PUT /api/admin/approvals/:id/approve` - Approve accreditation
- `PUT /api/admin/approvals/:id/reject` - Reject accreditation
- `GET /api/admin/companies` - Get all companies
- `POST /api/admin/companies` - Add new company
- `POST /api/admin/events` - Create new event
- `POST /api/admin/users` - Add new user
- `POST /api/admin/reports/generate` - Generate system report

### Company APIs
- `GET /api/events` - Get company events
- `GET /api/events/:id/crew` - Get crew for event
- `POST /api/events/:id/crew` - Add crew member
- `GET /api/events/:id/crew/pdf` - Generate crew list PDF
- `PUT /api/crew/:id/approve` - Approve crew member
- `GET /api/roles` - Get available roles

## 🎨 Features Overview

### **Super Admin Dashboard**
- System-wide statistics and monitoring
- Multi-company management interface
- Approval workflow oversight
- Report generation and analytics

### **Company Dashboard**
- Company-specific event management
- Crew member management
- Accreditation approval workflow
- PDF badge and list generation

### **PDF Badges**
- Individual crew member badges
- Color-coded by access level
- Professional design with company branding
- Event details included

### **Crew List PDF**
- Complete roster view
- No email addresses (privacy)
- Access level matrix
- Professional formatting

## 🔐 Security Features

- **JWT Authentication**: Secure token-based auth
- **Role-Based Access**: Super Admin vs Company Admin
- **Password Hashing**: bcrypt for password security
- **Rate Limiting**: Prevents brute force attacks
- **CORS Protection**: Cross-origin request security
- **Helmet.js**: Security headers
- **Input Validation**: Server-side validation

## 📊 Database Schema

### Companies Table
- id, name, domain, contact_email, contact_phone, address, logo_path, status, subscription_plan, timestamps

### Users Table
- id, company_id, email, password_hash, first_name, last_name, role, is_super_admin, timestamps

### Events Table  
- id, company_id, name, location, start_date, end_date, description, status, timestamps

### Crew Members Table
- id, event_id, first_name, last_name, email, role, access_level, badge_number, status, timestamps

### Access Logs Table
- id, crew_member_id, event_id, access_time, location, action

## 🚀 Deployment Ready

The MVP is ready for deployment with:
- Environment variable support
- Production-ready security
- Database persistence
- Static file serving
- Error handling
- Multi-company architecture

## 📝 Development Notes

### **Day 1-2**: Backend Foundation ✅
- Database setup and schemas
- Authentication system
- Basic API endpoints

### **Day 3-4**: Core Features ✅  
- Crew management
- PDF generation
- Role-based access control

### **Day 5-6**: Multi-Company & Super Admin ✅
- Company management system
- Super Admin dashboard
- Multi-company API endpoints
- User role management

### **Day 7**: Polish & Deploy ✅
- UI/UX improvements
- Testing and bug fixes
- Documentation
- Deployment preparation

## 🔑 Access Credentials

### **Super Admin**
- Email: `admin@youshallpass.com`
- Password: `admin123`
- Access: Full system control

### **Company Admin**
- Email: `company@demo.youshallpass.com`
- Password: `company123`
- Access: Company-specific management

## 🎯 Next Steps

1. **Email Integration**: Add real email notifications
2. **Advanced Reporting**: Enhanced analytics and reporting
3. **Mobile App**: Native mobile application
4. **API Documentation**: Swagger/OpenAPI documentation
5. **Payment Integration**: Subscription management
6. **Advanced Security**: 2FA, audit logs
7. **Scalability**: Database optimization, caching

## 🔮 Future Enhancements

- QR code scanning
- Real-time notifications
- Advanced analytics
- Mobile app
- Multi-language support
- Cloud storage integration

## 📞 Support

For questions or issues, please refer to the codebase or create an issue in the repository.

---

**Built with ❤️ for professional event management** # Updated for PostgreSQL deployment
# Deploying commit 2946207: Wed Jun 25 16:48:36 CEST 2025
# Test deployment: Wed Jun 25 17:19:35 CEST 2025
