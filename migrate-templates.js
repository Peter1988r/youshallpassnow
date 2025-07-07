const { query, run } = require('./database/schema');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function migrateTemplates() {
    console.log('🔄 Starting badge template migration...');
    
    try {
        // Get all events with old-format badge templates
        const eventsWithTemplates = await query(`
            SELECT id, name, custom_badge_template_path, custom_badge_field_mapping, badge_template_name, use_custom_badge
            FROM events 
            WHERE custom_badge_template_path IS NOT NULL 
            AND custom_badge_template_path != ''
            AND badge_template_image_path IS NULL
        `);
        
        console.log(`📊 Found ${eventsWithTemplates.length} events with templates to migrate`);
        
        if (eventsWithTemplates.length === 0) {
            console.log('✅ No templates need migration');
            return;
        }
        
        let migratedCount = 0;
        let errorCount = 0;
        
        for (const event of eventsWithTemplates) {
            try {
                console.log(`\n🔄 Migrating template for event: "${event.name}" (ID: ${event.id})`);
                
                // Convert base64 template to file
                let newImagePath = null;
                if (event.custom_badge_template_path && event.custom_badge_template_path.startsWith('data:')) {
                    newImagePath = await convertBase64ToFile(event.custom_badge_template_path, event.id);
                    console.log(`  📁 Template image saved as: ${newImagePath}`);
                }
                
                // Convert field mapping to field layout
                let newFieldLayout = {};
                if (event.custom_badge_field_mapping && event.custom_badge_field_mapping.field_positions) {
                    newFieldLayout = convertFieldMappingToLayout(event.custom_badge_field_mapping);
                    console.log(`  🎯 Converted ${Object.keys(newFieldLayout).length} positioned fields`);
                }
                
                // Update database with new format
                await run(`
                    UPDATE events 
                    SET 
                        badge_template_image_path = $1,
                        badge_field_layout = $2,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $3
                `, [newImagePath, JSON.stringify(newFieldLayout), event.id]);
                
                migratedCount++;
                console.log(`  ✅ Migration completed for event "${event.name}"`);
                
            } catch (error) {
                errorCount++;
                console.error(`  ❌ Error migrating event "${event.name}":`, error.message);
            }
        }
        
        console.log(`\n🎉 Migration completed!`);
        console.log(`✅ Successfully migrated: ${migratedCount} templates`);
        console.log(`❌ Errors: ${errorCount} templates`);
        
        if (migratedCount > 0) {
            console.log('\n📝 Next steps:');
            console.log('1. Test the templates work correctly');
            console.log('2. Once satisfied, you can remove the old columns:');
            console.log('   - custom_badge_template_path');
            console.log('   - custom_badge_field_mapping');
        }
        
    } catch (error) {
        console.error('💥 Migration failed:', error);
        throw error;
    }
}

async function convertBase64ToFile(base64DataUrl, eventId) {
    try {
        // Parse the data URL
        const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
            throw new Error('Invalid base64 data URL format');
        }
        
        const mimeType = matches[1];
        const base64Data = matches[2];
        
        // Determine file extension
        const extension = mimeType.includes('png') ? '.png' : '.jpg';
        
        // Generate unique filename
        const uniqueId = uuidv4();
        const filename = `event-${eventId}-${uniqueId}${extension}`;
        const filePath = path.join('public/uploads/templates/', filename);
        
        // Convert base64 to buffer and save
        const buffer = Buffer.from(base64Data, 'base64');
        await fs.writeFile(filePath, buffer);
        
        // Return web-accessible path
        return `/uploads/templates/${filename}`;
        
    } catch (error) {
        console.error('Error converting base64 to file:', error);
        throw error;
    }
}

function convertFieldMappingToLayout(fieldMapping) {
    try {
        // Extract just the field positions from the old complex structure
        const fieldPositions = fieldMapping.field_positions || {};
        
        // The new format is cleaner - just return the positioned fields
        // Each field should have: x, y, width, height, relativeX, relativeY, styling (optional)
        const newLayout = {};
        
        for (const [fieldType, position] of Object.entries(fieldPositions)) {
            newLayout[fieldType] = {
                x: position.x || 0,
                y: position.y || 0,
                width: position.width || 80,
                height: position.height || 35,
                relativeX: position.relativeX || 0,
                relativeY: position.relativeY || 0,
                // Preserve styling if it exists
                ...(position.styling && { styling: position.styling })
            };
        }
        
        return newLayout;
        
    } catch (error) {
        console.error('Error converting field mapping to layout:', error);
        return {};
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateTemplates()
        .then(() => {
            console.log('✅ Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateTemplates, convertBase64ToFile, convertFieldMappingToLayout }; 