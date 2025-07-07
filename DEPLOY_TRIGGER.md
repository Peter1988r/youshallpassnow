# Deployment Trigger

## Version 4.0.1 - Mobile QR Scanner Optimization 📱

### Mobile Scanner Fixes:
- **🎯 Enhanced QR Detection**: Dynamic scan area sizing (70% of viewport) for better mobile detection
- **📱 iOS Safari Optimized**: Multiple fallback configurations for iPhone/iPad compatibility  
- **🔧 Higher Sensitivity**: Increased FPS to 20 and continuous autofocus for sharp QR reading
- **📋 Better Error Guidance**: iOS-specific instructions and alternative options
- **🎨 Mobile-Responsive UI**: Improved scanner area sizing and video display optimization

### Technical Improvements:
- Dynamic QR box sizing based on screen dimensions  
- Enhanced camera constraints with continuous focus mode
- UseBarCodeDetectorIfSupported for native browser QR detection
- Three-tier fallback system: advanced → simple → basic configuration
- Improved mobile CSS with object-fit and responsive sizing

---

## Version 4.0.0 - Complete QR Code Validation System 🎯

### Major Features Added:
- **📱 QR Code Generation**: Real QR codes with encrypted validation data in badge PDFs
- **🔐 Field Validation App**: Mobile-optimized QR scanner at `/field-validation`
- **🎯 Digital Signatures**: HMAC-SHA256 signatures prevent badge counterfeiting
- **⏰ Expiration Control**: QR codes expire 48 hours after event end
- **📊 Audit Trail**: Complete scan logging with validation results
- **🎨 Template Integration**: QR codes as draggable/resizable fields in badge editor

### QR Code Security Features:
- **Encrypted Payload**: Badge number, crew info, company, access zones, expiration
- **Digital Signatures**: Cryptographic validation prevents tampering
- **Real-time Validation**: Database verification of crew member status
- **Access Zone Verification**: QR codes respect event-specific access permissions
- **Comprehensive Logging**: Every scan attempt logged with IP, timestamp, and results

### Field Validation App:
- **Mobile Scanner**: Camera-based QR code scanning optimized for field use
- **Manual Entry**: Fallback option for problematic QR codes
- **Real-time Results**: Instant validation with detailed crew member information
- **Scan History**: Recent validations with status indicators
- **Audit Logs**: Complete scan history with filtering by event
- **Secure Access**: Field admin authentication (`fieldadmin@youshallpass.me`)

### Database Enhancements:
- **QR Code Storage**: `qr_code_data`, `qr_signature`, `qr_generated_at` columns
- **Scan Logging**: New `qr_scan_logs` table for audit trail
- **Field Admin User**: Dedicated role for field validation access
- **Migration Safe**: All changes backward compatible

### Files Added/Modified:
- `public/field-validation/` - Complete mobile validation app
- `services/pdfGenerator.js` - Real QR code generation with encryption
- `database/schema.js` - QR code tables and field admin user
- `index.js` - QR validation API endpoints and authentication
- `package.json` - Added qrcode dependency

### Technical Implementation:
- **QR Code Library**: html5-qrcode for camera scanning
- **Crypto Security**: Node.js crypto module for HMAC signatures
- **Mobile Responsive**: Optimized for field use on mobile devices
- **Error Handling**: Graceful fallbacks for camera access issues
- **Performance**: Efficient QR generation and validation processes

### Validation Status:
✅ QR codes generate with real validation data  
✅ Field validation app fully functional on mobile  
✅ Digital signatures prevent counterfeiting  
✅ Expiration dates properly enforced  
✅ Complete audit trail operational  
✅ Template editor QR field integration complete  
✅ Database migrations successful  
✅ Security testing completed  

### Previous Versions:
- **Version 3.0.6**: Template system comprehensive fixes (zones popup, image persistence, font settings, PDF generation)
- **Version 3.0.5**: Company admin dashboard dark theme fix
- **Version 3.0.4**: Fixed logo path issue and confirmed text removal
- **Version 3.0.3**: Updated logo to YSPlogoV2.png and removed YouShallPass text
- **Version 3.0.2**: Sign-in page dark theme transformation
- **Version 3.0.1**: Landing page dark mode fixes
- **Version 3.0.0**: Complete dark mode overhaul
- **Version 2.2.0**: Badge system fixes and font styling

---

*This file triggers automatic deployment to Vercel when pushed to main branch.* 