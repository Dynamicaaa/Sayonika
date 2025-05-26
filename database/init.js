const Database = require('./database');

async function initializeDatabase() {
    const db = new Database();
    
    try {
        await db.initialize();
        console.log('Database initialization completed successfully!');
        
        // Create a default admin user for testing
        const bcrypt = require('bcryptjs');
        const adminPassword = await bcrypt.hash('admin123', 10);
        
        try {
            await db.createUser({
                username: 'admin',
                email: 'admin@sayonika.moe',
                password_hash: adminPassword,
                display_name: 'Administrator'
            });
            
            // Make the user an admin
            await db.run('UPDATE users SET is_admin = 1, is_verified = 1 WHERE username = ?', ['admin']);
            console.log('Default admin user created (username: admin, password: admin123)');
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                console.log('Admin user already exists, skipping creation');
            } else {
                console.error('Error creating admin user:', error.message);
            }
        }
        
    } catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

if (require.main === module) {
    initializeDatabase();
}

module.exports = initializeDatabase;
