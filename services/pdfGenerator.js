const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const https = require('https');

// Initialize Supabase only if credentials are available
let supabase = null;
try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
    }
} catch (error) {
    console.warn('Supabase initialization failed:', error.message);
}

class PDFGenerator {
    constructor() {
        this.outputDir = path.join(__dirname, '../public/badges');
        this.templatesDir = path.join(__dirname, '../public/badge-templates');
        this.ensureOutputDirectory();
        // Don't create templates directory in serverless environment
        // this.ensureTemplatesDirectory();
    }

    ensureOutputDirectory() {
        try {
            if (!fs.existsSync(this.outputDir)) {
                fs.mkdirSync(this.outputDir, { recursive: true });
            }
        } catch (error) {
            // In serverless environments, we can't create directories
            // This is fine since we're generating PDFs in memory
            console.warn('Cannot create output directory in serverless environment:', error.message);
        }
    }

    ensureTemplatesDirectory() {
        try {
            if (!fs.existsSync(this.templatesDir)) {
                fs.mkdirSync(this.templatesDir, { recursive: true });
            }
        } catch (error) {
            // In serverless environments, we can't create directories
            console.warn('Cannot create templates directory in serverless environment:', error.message);
        }
    }

    generateBadge(crewMember, event) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: [400, 250], // Badge size
                    margins: 10
                });

                const filename = `badge_${crewMember.badge_number}_${Date.now()}.pdf`;
                const filepath = path.join(this.outputDir, filename);
                const stream = fs.createWriteStream(filepath);

                doc.pipe(stream);

                // White background
                doc.rect(0, 0, 400, 250).fill('#FFFFFF');

                // Border
                doc.rect(5, 5, 390, 240)
                   .lineWidth(2)
                   .stroke('#333333');

                // Header with company name
                doc.fontSize(18)
                   .font('Helvetica-Bold')
                   .fill('#333333')
                   .text('YOU SHALL PASS', 20, 20, { align: 'center' });

                // Company name (you can customize this)
                doc.fontSize(10)
                   .font('Helvetica')
                   .fill('#666666')
                   .text('Event Accreditation System', 20, 40, { align: 'center' });

                // Event name
                doc.fontSize(12)
                   .font('Helvetica-Bold')
                   .fill('#333333')
                   .text(event.name, 20, 60, { align: 'center' });

                // Divider line
                doc.moveTo(20, 80)
                   .lineTo(380, 80)
                   .stroke('#CCCCCC');

                // Photo placeholder (left side)
                const photoSize = 60;
                const photoX = 30;
                const photoY = 100;
                
                // Check if crew member has a photo
                if (crewMember.photo_path && fs.existsSync(crewMember.photo_path)) {
                    // Add actual photo (you'll need to implement image handling)
                    // For now, we'll use a placeholder
                    doc.circle(photoX + photoSize/2, photoY + photoSize/2, photoSize/2)
                       .fill('#F3F4F6');
                    
                    doc.fontSize(8)
                       .font('Helvetica')
                       .fill('#9CA3AF')
                       .text('PHOTO', photoX + photoSize/2, photoY + photoSize/2 - 5, { align: 'center' });
                } else {
                    // Photo background circle
                    doc.circle(photoX + photoSize/2, photoY + photoSize/2, photoSize/2)
                       .fill('#F3F4F6');
                    
                    // Photo placeholder text
                    doc.fontSize(8)
                       .font('Helvetica')
                       .fill('#9CA3AF')
                       .text('PHOTO', photoX + photoSize/2, photoY + photoSize/2 - 5, { align: 'center' });
                }

                // Crew member details (right side of photo)
                const detailsX = photoX + photoSize + 20;
                const detailsY = photoY;

                // Name
                doc.fontSize(14)
                   .font('Helvetica-Bold')
                   .fill('#333333')
                   .text(`${crewMember.first_name} ${crewMember.last_name}`, detailsX, detailsY);

                // Role
                doc.fontSize(11)
                   .font('Helvetica')
                   .fill('#666666')
                   .text(`Role: ${crewMember.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`, detailsX, detailsY + 20);

                // Badge number
                doc.fontSize(11)
                   .font('Helvetica-Bold')
                   .fill('#333333')
                   .text(`Badge: ${crewMember.badge_number}`, detailsX, detailsY + 35);

                // Access level
                doc.fontSize(9)
                   .font('Helvetica')
                   .fill('#666666')
                   .text(crewMember.access_level, detailsX, detailsY + 50, { width: 200 });

                // Event details (bottom section)
                const bottomY = 180;
                
                doc.fontSize(9)
                   .font('Helvetica')
                   .fill('#666666')
                   .text(`Event: ${event.location}`, 20, bottomY);

                const startDate = new Date(event.start_date).toLocaleDateString();
                const endDate = new Date(event.end_date).toLocaleDateString();
                doc.text(`Dates: ${startDate} - ${endDate}`, 20, bottomY + 15);

                // Footer
                doc.fontSize(8)
                   .font('Helvetica')
                   .fill('#999999')
                   .text('This badge must be worn at all times during the event', 20, 220, { align: 'center' });

                doc.end();

                stream.on('finish', () => {
                    resolve({
                        filename,
                        filepath,
                        url: `/badges/${filename}`
                    });
                });

                stream.on('error', reject);

            } catch (error) {
                reject(error);
            }
        });
    }

    async generateCrewList(crewMembers, event) {
        // Generate PDF in memory
        return new Promise(async (resolve, reject) => {
            try {
                const { Readable } = require('stream');
                const doc = new PDFDocument({ size: 'A4', margins: 50 });
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', async () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    const filename = `crew_list_${event.id}_${Date.now()}.pdf`;

                    if (!supabase) {
                        return reject(new Error('Supabase not configured for crew list generation'));
                    }

                    // Upload to Supabase Storage
                    const { data, error } = await supabase.storage
                        .from(process.env.SUPABASE_CREWLIST_BUCKET)
                        .upload(filename, pdfBuffer, {
                            contentType: 'application/pdf',
                            upsert: true
                        });
                    if (error) return reject(error);

                    // Generate signed URL
                    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                        .from(process.env.SUPABASE_CREWLIST_BUCKET)
                        .createSignedUrl(filename, 60 * 60); // 1 hour
                    if (signedUrlError) return reject(signedUrlError);

                    resolve({
                        url: signedUrlData.signedUrl,
                        filename
                    });
                });

                // Header
                doc.fontSize(24)
                   .font('Helvetica-Bold')
                   .fill('#333333')
                   .text('CREW ACCREDITATION LIST', 0, 50, { align: 'center' });

                // Company name
                doc.fontSize(14)
                   .font('Helvetica')
                   .fill('#666666')
                   .text('YouShallPass Event Accreditation System', 0, 80, { align: 'center' });

                // Event details
                doc.fontSize(16)
                   .font('Helvetica-Bold')
                   .fill('#666666')
                   .text(event.name, 0, 110, { align: 'center' });

                doc.fontSize(12)
                   .font('Helvetica')
                   .fill('#666666')
                   .text(`${event.location} | ${new Date(event.start_date).toLocaleDateString()} - ${new Date(event.end_date).toLocaleDateString()}`, 0, 135, { align: 'center' });

                // Table header
                const startY = 170;
                const colWidths = [80, 120, 100, 80, 100];
                const headers = ['Badge #', 'Name', 'Role', 'Access Level', 'Status'];

                doc.fontSize(10)
                   .font('Helvetica-Bold')
                   .fill('#333333');
                let x = 50;
                headers.forEach((header, i) => {
                    doc.text(header, x, startY);
                    x += colWidths[i];
                });

                // Table content
                doc.fontSize(9)
                   .font('Helvetica')
                   .fill('#666666');

                crewMembers.forEach((member, index) => {
                    const y = startY + 25 + (index * 20);
                    if (y > 700) { doc.addPage(); return; }
                    x = 50;
                    doc.text(member.badge_number, x, y); x += colWidths[0];
                    doc.text(`${member.first_name} ${member.last_name}`, x, y); x += colWidths[1];
                    doc.text(member.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), x, y); x += colWidths[2];
                    doc.text(member.access_level, x, y); x += colWidths[3];
                    doc.text(member.status, x, y);
                });

                // Footer
                doc.fontSize(8)
                   .font('Helvetica')
                   .fill('#999999')
                   .text(`Generated on ${new Date().toLocaleString()} by YouShallPass`, 0, 750, { align: 'center' });

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    // Generate badge using custom template if available, otherwise use default
    async generateCustomBadge(crewMember, event) {
        try {
            // For now, always use default A5 badge to ensure system stability
            // Custom template functionality will be activated after testing
            console.log('Using default A5 badge for crew member:', crewMember.id);
            return await this.generateA5Badge(crewMember);
        } catch (error) {
            console.error('Badge generation error:', error.message);
            // Fallback to default badge if custom fails
            return await this.generateA5Badge(crewMember);
        }
    }

    // Generate badge from custom Adobe Illustrator template
    async generateFromCustomTemplate(crewMember, event) {
        return new Promise((resolve, reject) => {
            try {
                // A5 size: 420 x 595 points (148.5 x 210 mm)
                const doc = new PDFDocument({
                    size: [420, 595], // A5 portrait
                    margins: 0 // No margins for custom template
                });

                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    resolve(pdfBuffer);
                });

                // Load custom template background if available
                this.loadCustomTemplate(doc, event, crewMember)
                    .then(() => {
                        doc.end();
                    })
                    .catch((error) => {
                        console.error('Error loading custom template:', error);
                        // If template loading fails, create a basic badge with custom styling
                        this.createBasicCustomBadge(doc, crewMember, event);
                        doc.end();
                    });

            } catch (error) {
                reject(error);
            }
        });
    }

    // Load and apply custom template with field mapping
    async loadCustomTemplate(doc, event, crewMember) {
        // For now, we'll create a custom-styled badge based on the example
        // In a full implementation, you would parse the AI file or use a converted template
        
        // Parse field mapping from event configuration
        const fieldMapping = event.custom_badge_field_mapping || this.getDefaultFieldMapping();
        
        // Create custom badge based on the example design
        await this.createWorldPoolChampionshipBadge(doc, crewMember, event, fieldMapping);
    }

    // Create a badge styled like the World Pool Championship example
    async createWorldPoolChampionshipBadge(doc, crewMember, event, fieldMapping) {
        // Background with green gradient effect
        doc.rect(0, 0, 420, 595)
           .fillColor('#1B5E20') // Dark green base
           .fill();

        // Add sparkle/star pattern (simplified)
        this.addStarPattern(doc);

        // Event title section
        doc.fontSize(24)
           .font('Helvetica-Bold')
           .fillColor('#FFD700') // Gold color
           .text(event.name.toUpperCase() || 'EVENT NAME', 40, 50, { 
               align: 'center', 
               width: 340 
           });

        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor('#FFFFFF')
           .text('CHAMPIONSHIP', 40, 85, { 
               align: 'center', 
               width: 340 
           });

        // Location
        doc.fontSize(14)
           .font('Helvetica')
           .fillColor('#FFFFFF')
           .text(event.location?.toUpperCase() || 'EVENT LOCATION', 40, 110, { 
               align: 'center', 
               width: 340 
           });

        // Photo section
        const photoSize = 120;
        const photoX = 150;
        const photoY = 160;
        
        // Photo background
        doc.rect(photoX, photoY, photoSize, photoSize)
           .fillColor('#FFFFFF')
           .fill();

        // Load crew photo if available
        if (crewMember.photo_path) {
            try {
                await this.loadCrewPhotoForCustomTemplate(doc, crewMember.photo_path, photoX + 10, photoY + 10, photoSize - 20);
            } catch (error) {
                console.warn('Failed to load crew photo for custom template:', error.message);
                // Photo placeholder
                doc.fontSize(10)
                   .font('Helvetica')
                   .fillColor('#999999')
                   .text('PHOTO', photoX + photoSize/2 - 15, photoY + photoSize/2 - 5);
            }
        } else {
            // Photo placeholder
            doc.fontSize(10)
               .font('Helvetica')
               .fillColor('#999999')
               .text('PHOTO', photoX + photoSize/2 - 15, photoY + photoSize/2 - 5);
        }

        // Crew member name
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .fillColor('#FFFFFF')
           .text(`${crewMember.first_name} ${crewMember.last_name}`.toUpperCase(), 40, 300, { 
               align: 'center', 
               width: 340 
           });

        // Company name
        if (crewMember.company_name) {
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .fillColor('#FFD700')
               .text(crewMember.company_name.toUpperCase(), 40, 330, { 
                   align: 'center', 
                   width: 340 
               });
        }

        // Role/Title
        doc.fontSize(14)
           .font('Helvetica')
           .fillColor('#FFFFFF')
           .text(crewMember.role?.replace(/_/g, ' ').toUpperCase() || 'CREW MEMBER', 40, 355, { 
               align: 'center', 
               width: 340 
           });

        // Diamond pattern border (simplified)
        this.addDiamondPattern(doc);

        // Access zones section
        if (event.custom_badge_field_mapping?.show_access_zones) {
            this.addAccessZonesSection(doc, crewMember);
        }

        // QR Code section (placeholder)
        this.addQRCodeSection(doc, crewMember);

        // Footer branding
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#FFFFFF')
           .text('Powered by YouShallPass', 40, 570, { 
               align: 'center', 
               width: 340 
           });
    }

    // Add decorative star pattern
    addStarPattern(doc) {
        // Add simplified sparkle effects
        const stars = [
            { x: 60, y: 40, size: 2 },
            { x: 350, y: 35, size: 1.5 },
            { x: 80, y: 120, size: 1 },
            { x: 320, y: 115, size: 2 },
            { x: 50, y: 200, size: 1.5 },
            { x: 370, y: 180, size: 1 },
            { x: 90, y: 400, size: 2 },
            { x: 340, y: 420, size: 1.5 }
        ];

        stars.forEach(star => {
            doc.circle(star.x, star.y, star.size)
               .fillColor('#FFD700')
               .fill();
        });
    }

    // Add diamond pattern border
    addDiamondPattern(doc) {
        // Simplified diamond border at bottom using rectangles
        const diamondY = 450;
        const diamondSize = 15;
        const diamondCount = 10;
        const startX = (420 - (diamondCount * diamondSize * 2)) / 2;

        for (let i = 0; i < diamondCount; i++) {
            const x = startX + (i * diamondSize * 2);
            
            // Create diamond-like shape using rotated rectangles
            doc.save();
            doc.translate(x + diamondSize, diamondY + diamondSize/2);
            doc.rotate(45 * Math.PI / 180); // 45 degrees
            doc.rect(-diamondSize/2, -diamondSize/2, diamondSize, diamondSize)
               .fillColor('#FFFFFF')
               .fill();
            doc.restore();
        }
    }

    // Add access zones section
    addAccessZonesSection(doc, crewMember) {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor('#FFD700')
           .text('ACCESS ZONES:', 40, 380);

        // Sample access zones based on access level
        const accessZones = this.getAccessZonesForLevel(crewMember.access_level);
        
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#FFFFFF');
           
        accessZones.forEach((zone, index) => {
            doc.text(`Zone ${index + 1}: ${zone}`, 40, 400 + (index * 15));
        });
    }

    // Add QR code section (placeholder)
    addQRCodeSection(doc, crewMember) {
        // QR code placeholder
        doc.rect(350, 480, 60, 60)
           .fillColor('#FFFFFF')
           .fill();
           
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#000000')
           .text('QR CODE', 365, 505);
           
        doc.fontSize(6)
           .font('Helvetica')
           .fillColor('#666666')
           .text(`Badge: ${crewMember.badge_number}`, 350, 545, { width: 60, align: 'center' });
    }

    // Get access zones based on access level
    getAccessZonesForLevel(accessLevel) {
        const zones = {
            'VIP': ['VIP Lounge', 'Field of Play', 'Media Center', 'All Areas'],
            'MEDIA': ['Media Center', 'Press Areas', 'Photo Zones'],
            'CREW': ['Technical Areas', 'Backstage', 'Service Areas'],
            'RESTRICTED': ['General Areas', 'Spectator Zones'],
            'ALL_ACCESS': ['All Areas', 'VIP Lounge', 'Technical', 'Media']
        };
        
        return zones[accessLevel] || ['General Access'];
    }

    // Load crew photo for custom template
    async loadCrewPhotoForCustomTemplate(doc, photoPath, x, y, size) {
        if (photoPath.startsWith('http')) {
            // Handle Supabase URL
            return new Promise((resolve, reject) => {
                https.get(photoPath, (response) => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`HTTP ${response.statusCode}`));
                        return;
                    }

                    const chunks = [];
                    response.on('data', chunk => chunks.push(chunk));
                    response.on('end', () => {
                        try {
                            const imageBuffer = Buffer.concat(chunks);
                            doc.image(imageBuffer, x, y, { 
                                fit: [size, size], 
                                align: 'center', 
                                valign: 'center' 
                            });
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    });
                }).on('error', reject);
            });
        } else if (fs.existsSync(photoPath)) {
            // Handle local file
            doc.image(photoPath, x, y, { 
                fit: [size, size], 
                align: 'center', 
                valign: 'center' 
            });
        } else {
            throw new Error('Photo not found');
        }
    }

    // Create basic custom badge when template loading fails
    createBasicCustomBadge(doc, crewMember, event) {
        // Fallback to enhanced A5 badge with custom styling
        // This is essentially the A5 badge but with custom colors/styling
        this.createWorldPoolChampionshipBadge(doc, crewMember, event, {});
    }

    // Get default field mapping for custom badges
    getDefaultFieldMapping() {
        return {
            show_photo: true,
            show_name: true,
            show_role: true,
            show_company: true,
            show_badge_number: true,
            show_access_level: true,
            show_event_details: true,
            show_access_zones: false,
            show_qr_code: true,
            background_color: '#1B5E20',
            text_color: '#FFFFFF',
            accent_color: '#FFD700'
        };
    }

    generateA5Badge(crewMember) {
        return new Promise(async (resolve, reject) => {
            try {
                // A5 size: 420 x 595 points (148.5 x 210 mm)
                const doc = new PDFDocument({
                    size: [420, 595], // A5 portrait
                    margins: 20
                });

                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    resolve(pdfBuffer);
                });

                // Card background with rounded corners effect
                doc.roundedRect(20, 20, 380, 555, 15)
                   .lineWidth(2)
                   .strokeColor('#E5E7EB')
                   .fillColor('#FFFFFF')
                   .fillAndStroke();

                // Header section with gradient-like effect
                doc.rect(20, 20, 380, 80)
                   .fillColor('#F8FAFC')
                   .fill();

                // Company logo area (placeholder)
                doc.circle(60, 60, 25)
                   .fillColor('#4F46E5')
                   .fill();

                doc.fontSize(12)
                   .font('Helvetica-Bold')
                   .fillColor('#FFFFFF')
                   .text('YSP', 50, 55);

                // Main title
                doc.fontSize(24)
                   .font('Helvetica-Bold')
                   .fillColor('#1F2937')
                   .text('EVENT ACCREDITATION', 100, 45);

                doc.fontSize(12)
                   .font('Helvetica')
                   .fillColor('#6B7280')
                   .text('YouShallPass Security System', 100, 70);

                // Photo section
                const photoSize = 120;
                const photoX = 50;
                const photoY = 130;

                // Photo border
                doc.roundedRect(photoX - 5, photoY - 5, photoSize + 10, photoSize + 10, 8)
                   .lineWidth(3)
                   .strokeColor('#E5E7EB')
                   .stroke();

                // Photo handling
                if (crewMember.photo_path) {
                    try {
                        // Try to load the image from Supabase URL
                        const https = require('https');
                        const imagePromise = new Promise((resolve, reject) => {
                            https.get(crewMember.photo_path, (response) => {
                                if (response.statusCode === 200) {
                                    const chunks = [];
                                    response.on('data', (chunk) => chunks.push(chunk));
                                    response.on('end', () => {
                                        const buffer = Buffer.concat(chunks);
                                        resolve(buffer);
                                    });
                                } else {
                                    reject(new Error('Failed to fetch image'));
                                }
                            }).on('error', reject);
                        });
                        
                        const imageBuffer = await imagePromise;
                        
                        // Add the actual photo
                        doc.image(imageBuffer, photoX, photoY, {
                            width: photoSize,
                            height: photoSize,
                            fit: [photoSize, photoSize],
                            align: 'center',
                            valign: 'center'
                        });
                        
                        // Add border around photo
                        doc.roundedRect(photoX, photoY, photoSize, photoSize, 5)
                           .lineWidth(2)
                           .strokeColor('#E5E7EB')
                           .stroke();
                           
                    } catch (error) {
                        console.warn('Failed to load crew photo:', error.message);
                        // Fallback to placeholder
                        doc.roundedRect(photoX, photoY, photoSize, photoSize, 5)
                           .fillColor('#F3F4F6')
                           .fill();
                        
                        doc.fontSize(9)
                           .font('Helvetica')
                           .fillColor('#9CA3AF')
                           .text('PHOTO\nNOT LOADED', photoX + photoSize/2 - 25, photoY + photoSize/2 - 10);
                    }
                } else {
                    // No photo provided
                    doc.roundedRect(photoX, photoY, photoSize, photoSize, 5)
                       .fillColor('#F9FAFB')
                       .fill();
                    
                    doc.fontSize(10)
                       .font('Helvetica')
                       .fillColor('#D1D5DB')
                       .text('NO PHOTO', photoX + photoSize/2 - 25, photoY + photoSize/2 - 5);
                }

                // Crew member details section
                const detailsX = 200;
                const detailsY = 130;

                // Name (large)
                doc.fontSize(22)
                   .font('Helvetica-Bold')
                   .fillColor('#111827')
                   .text(`${crewMember.first_name}`, detailsX, detailsY);

                doc.fontSize(22)
                   .font('Helvetica-Bold')
                   .fillColor('#111827')
                   .text(`${crewMember.last_name}`, detailsX, detailsY + 30);

                // Role
                doc.fontSize(14)
                   .font('Helvetica-Bold')
                   .fillColor('#4F46E5')
                   .text(crewMember.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), detailsX, detailsY + 70);

                // Company
                if (crewMember.company_name) {
                    doc.fontSize(12)
                       .font('Helvetica')
                       .fillColor('#6B7280')
                       .text(crewMember.company_name, detailsX, detailsY + 95);
                }

                // Badge details section
                const badgeY = 280;
                
                // Badge number (prominent)
                doc.fontSize(18)
                   .font('Helvetica-Bold')
                   .fillColor('#DC2626')
                   .text(`BADGE #${crewMember.badge_number}`, 50, badgeY);

                // Access level with background (moved down to avoid overlap)
                doc.roundedRect(50, badgeY + 35, 130, 25, 5)
                   .fillColor('#FEF3C7')
                   .fill();

                doc.fontSize(11)
                   .font('Helvetica-Bold')
                   .fillColor('#92400E')
                   .text(`${crewMember.access_level} ACCESS`, 60, badgeY + 42);

                // Event information section
                const eventY = 360;
                
                doc.fontSize(16)
                   .font('Helvetica-Bold')
                   .fillColor('#374151')
                   .text('EVENT DETAILS', 50, eventY);

                // Event name
                doc.fontSize(14)
                   .font('Helvetica-Bold')
                   .fillColor('#1F2937')
                   .text(crewMember.event_name, 50, eventY + 30);

                // Location
                if (crewMember.event_location) {
                    doc.fontSize(12)
                       .font('Helvetica')
                       .fillColor('#6B7280')
                       .text(`Location: ${crewMember.event_location}`, 50, eventY + 55);
                }

                // Dates
                if (crewMember.event_start_date) {
                    const startDate = new Date(crewMember.event_start_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                    const endDate = crewMember.event_end_date ? 
                        new Date(crewMember.event_end_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        }) : startDate;
                    
                    const dateText = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
                    
                    doc.fontSize(12)
                       .font('Helvetica')
                       .fillColor('#6B7280')
                       .text(`Dates: ${dateText}`, 50, eventY + 75);
                }

                // Status section
                const statusY = 470;
                
                // Status with colored background
                let statusColor = '#10B981'; // Green for approved
                let statusBg = '#D1FAE5';
                if (crewMember.status === 'pending_approval') {
                    statusColor = '#F59E0B';
                    statusBg = '#FEF3C7';
                } else if (crewMember.status === 'rejected') {
                    statusColor = '#EF4444';
                    statusBg = '#FEE2E2';
                }

                doc.roundedRect(50, statusY - 5, 100, 25, 5)
                   .fillColor(statusBg)
                   .fill();

                doc.fontSize(11)
                   .font('Helvetica-Bold')
                   .fillColor(statusColor)
                   .text(crewMember.status.toUpperCase(), 55, statusY + 2);

                // Approved date
                if (crewMember.approved_at) {
                    const approvedDate = new Date(crewMember.approved_at).toLocaleDateString();
                    doc.fontSize(10)
                       .font('Helvetica')
                       .fillColor('#6B7280')
                       .text(`Approved: ${approvedDate}`, 170, statusY + 2);
                }

                // Footer section
                const footerY = 530;
                
                // Security notice
                doc.fontSize(10)
                   .font('Helvetica-Bold')
                   .fillColor('#991B1B')
                   .text('WARNING: THIS BADGE MUST BE VISIBLE AT ALL TIMES', 50, footerY, { align: 'center', width: 320 });

                doc.fontSize(8)
                   .font('Helvetica')
                   .fillColor('#6B7280')
                   .text('Present this badge at all security checkpoints and event entrances', 50, footerY + 20, { align: 'center', width: 320 });

                // Generated timestamp
                doc.fontSize(7)
                   .font('Helvetica')
                   .fillColor('#9CA3AF')
                   .text(`Generated: ${new Date().toLocaleString()}`, 50, footerY + 40, { align: 'center', width: 320 });

                doc.end();

            } catch (error) {
                reject(error);
            }
        });
    }

    generateCrewListDirect(crewMembers, event, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                console.log('Starting PDF generation for crew list:', {
                    eventName: event.name,
                    crewCount: crewMembers.length,
                    hasEvent: !!event,
                    isCompanyFiltered: options.isCompanyFiltered,
                    companyName: options.companyName
                });
                // Generate PDF in memory without Supabase
                const doc = new PDFDocument({ size: 'A4', margins: 50 });
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    resolve(pdfBuffer);
                });

                // Header
                doc.fontSize(24)
                   .font('Helvetica-Bold')
                   .fillColor('#333333')
                   .text('CREW ACCREDITATION LIST', 0, 50, { align: 'center' });

                // Company/System name
                doc.fontSize(14)
                   .font('Helvetica')
                   .fillColor('#666666')
                   .text('YouShallPass Event Accreditation System', 0, 80, { align: 'center' });

                // Show company name if filtered
                if (options.isCompanyFiltered && options.companyName) {
                    doc.fontSize(12)
                       .font('Helvetica-Bold')
                       .fillColor('#4F46E5')
                       .text(options.companyName, 0, 100, { align: 'center' });
                }

                // Event details
                const eventNameY = options.isCompanyFiltered ? 125 : 110;
                doc.fontSize(18)
                   .font('Helvetica-Bold')
                   .fillColor('#333333')
                   .text(event.name, 0, eventNameY, { align: 'center' });

                // Event location and dates
                let eventDetailsText = '';
                if (event.location) {
                    eventDetailsText += event.location;
                }
                if (event.start_date) {
                    const startDate = new Date(event.start_date).toLocaleDateString();
                    const endDate = event.end_date ? new Date(event.end_date).toLocaleDateString() : startDate;
                    const dateText = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
                    eventDetailsText += eventDetailsText ? ` | ${dateText}` : dateText;
                }

                if (eventDetailsText) {
                    const eventDetailsY = options.isCompanyFiltered ? 150 : 135;
                    doc.fontSize(12)
                       .font('Helvetica')
                       .fillColor('#666666')
                       .text(eventDetailsText, 0, eventDetailsY, { align: 'center' });
                }

                // Statistics
                const totalCrew = crewMembers.length;
                const approvedCrew = crewMembers.filter(m => m.status === 'approved').length;
                const pendingCrew = crewMembers.filter(m => m.status === 'pending_approval').length;
                const rejectedCrew = crewMembers.filter(m => m.status === 'rejected').length;

                const statisticsY = options.isCompanyFiltered ? 175 : 160;
                doc.fontSize(11)
                   .font('Helvetica')
                   .fillColor('#666666')
                   .text(`Total: ${totalCrew} | Approved: ${approvedCrew} | Pending: ${pendingCrew} | Rejected: ${rejectedCrew}`, 0, statisticsY, { align: 'center' });

                // Table header
                const startY = options.isCompanyFiltered ? 215 : 200;
                const colWidths = [70, 120, 100, 80, 80, 80];
                const headers = ['Badge #', 'Name', 'Role', 'Access Level', 'Status', 'Company'];

                doc.fontSize(10)
                   .font('Helvetica-Bold')
                   .fillColor('#333333');

                let x = 50;
                headers.forEach((header, i) => {
                    doc.text(header, x, startY);
                    x += colWidths[i];
                });

                // Underline header
                doc.moveTo(50, startY + 15)
                   .lineTo(530, startY + 15)
                   .strokeColor('#CCCCCC')
                   .stroke();

                // Table content
                doc.fontSize(9)
                   .font('Helvetica')
                   .fillColor('#333333');

                let currentY = startY + 25;
                crewMembers.forEach((member, index) => {
                    // Check if we need a new page
                    if (currentY > 720) {
                        doc.addPage();
                        currentY = 80;
                        
                        // Repeat header on new page
                        doc.fontSize(10)
                           .font('Helvetica-Bold')
                           .fillColor('#333333');
                        x = 50;
                        headers.forEach((header, i) => {
                            doc.text(header, x, currentY);
                            x += colWidths[i];
                        });
                        doc.moveTo(50, currentY + 15)
                           .lineTo(530, currentY + 15)
                           .strokeColor('#CCCCCC')
                           .stroke();
                        currentY += 25;
                        
                        doc.fontSize(9)
                           .font('Helvetica')
                           .fillColor('#333333');
                    }

                    x = 50;
                    
                    // Badge number
                    doc.text(member.badge_number || 'N/A', x, currentY);
                    x += colWidths[0];
                    
                    // Name
                    doc.text(`${member.first_name} ${member.last_name}`, x, currentY);
                    x += colWidths[1];
                    
                    // Role
                    const roleName = member.role ? member.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A';
                    doc.text(roleName, x, currentY);
                    x += colWidths[2];
                    
                    // Access level
                    doc.text(member.access_level || 'RESTRICTED', x, currentY);
                    x += colWidths[3];
                    
                    // Status with color
                    let statusColor = '#333333';
                    if (member.status === 'approved') statusColor = '#059669';
                    else if (member.status === 'rejected') statusColor = '#DC2626';
                    else if (member.status === 'pending_approval') statusColor = '#D97706';
                    
                    doc.fillColor(statusColor)
                       .text(member.status ? member.status.toUpperCase() : 'PENDING', x, currentY);
                    x += colWidths[4];
                    
                    // Company
                    doc.fillColor('#333333')
                       .text(member.company_name || 'N/A', x, currentY);

                    currentY += 18;
                });

                // Footer
                const footerY = currentY > 700 ? (doc.addPage(), 100) : currentY + 30;
                
                doc.fontSize(8)
                   .font('Helvetica')
                   .fillColor('#999999')
                   .text(`Generated on ${new Date().toLocaleString()} by YouShallPass`, 0, footerY, { align: 'center' });

                console.log('PDF generation completed successfully');
                doc.end();
            } catch (error) {
                console.error('Error in generateCrewListDirect:', error);
                reject(error);
            }
        });
    }
}

module.exports = new PDFGenerator(); 