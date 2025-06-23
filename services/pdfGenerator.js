const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { ACCESS_LEVEL_DESCRIPTIONS } = require('../config/accessMatrix');

class PDFGenerator {
    constructor() {
        this.outputDir = path.join(__dirname, '../public/badges');
        this.ensureOutputDirectory();
    }

    ensureOutputDirectory() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
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
                const accessDescription = ACCESS_LEVEL_DESCRIPTIONS[crewMember.access_level];
                doc.fontSize(9)
                   .font('Helvetica')
                   .fill('#666666')
                   .text(accessDescription, detailsX, detailsY + 50, { width: 200 });

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

    generateCrewList(crewMembers, event) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margins: 50
                });

                const filename = `crew_list_${event.id}_${Date.now()}.pdf`;
                const filepath = path.join(this.outputDir, filename);
                const stream = fs.createWriteStream(filepath);

                doc.pipe(stream);

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
                    
                    if (y > 700) { // New page if needed
                        doc.addPage();
                        return;
                    }

                    x = 50;
                    doc.text(member.badge_number, x, y);
                    x += colWidths[0];
                    
                    doc.text(`${member.first_name} ${member.last_name}`, x, y);
                    x += colWidths[1];
                    
                    doc.text(member.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), x, y);
                    x += colWidths[2];
                    
                    doc.text(member.access_level, x, y);
                    x += colWidths[3];
                    
                    doc.text(member.status, x, y);
                });

                // Footer
                doc.fontSize(8)
                   .font('Helvetica')
                   .fill('#999999')
                   .text(`Generated on ${new Date().toLocaleString()} by YouShallPass`, 0, 750, { align: 'center' });

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
}

module.exports = new PDFGenerator(); 