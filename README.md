# Sayonika - DDLC Mod Store

Sayonika is a comprehensive mod store and community platform for Doki Doki Literature Club (DDLC) mods. Built with Node.js, Express, and SQLite, it provides a modern web interface for discovering, downloading, and sharing DDLC modifications.

## Features

### 🎮 Mod Management
- **Browse & Search**: Discover mods by category, popularity, or search terms
- **Download System**: Secure mod downloads with tracking
- **Version Control**: Support for multiple mod versions
- **Categories**: Organized mod categories (Full Mods, Gameplay, Visual, Audio, etc.)

### 👥 User System
- **User Registration & Authentication**: JWT-based secure authentication
- **User Profiles**: Customizable profiles with avatars and bios
- **Mod Uploads**: Easy mod submission system for creators
- **Admin Panel**: Administrative tools for mod approval and management

### 🎨 Modern Interface
- **Responsive Design**: Mobile-friendly interface built with SASS
- **Dark/Light Theme**: Toggle between themes with persistent preference
- **DDLC-Inspired Design**: Color scheme and styling inspired by the game
- **Accessibility**: Built with accessibility best practices

### 🔧 Technical Features
- **REST API**: Comprehensive API for mod data and user management
- **SQLite Database**: Lightweight, file-based database
- **File Upload**: Secure mod file handling with validation
- **Rate Limiting**: Protection against abuse
- **Security**: Helmet.js, CORS, input validation

## Installation

### Prerequisites
- Node.js 16.0.0 or higher
- npm or yarn package manager

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sayonika
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize Database**
   ```bash
   npm run init-db
   ```

5. **Run Database Migrations** (for existing databases)
   ```bash
   npm run migrate
   ```

6. **Build CSS**
   ```bash
   npm run build-css-prod
   ```

7. **Start the server**
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

The server will start on the configured BASE_URL (default: `http://localhost:3000` or your configured PORT).

## Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run build-css` - Watch and compile SASS files
- `npm run build-css-prod` - Build CSS for production
- `npm run init-db` - Initialize database with schema
- `npm test` - Run tests

### Project Structure
```
sayonika/
├── database/           # Database files and utilities
│   ├── database.js    # Database connection and methods
│   ├── schema.sql     # Database schema
│   └── init.js        # Database initialization
├── middleware/         # Express middleware
│   └── auth.js        # Authentication middleware
├── routes/            # Express routes
│   ├── api.js         # API endpoints
│   ├── auth.js        # Authentication routes
│   └── web.js         # Web page routes
├── src/scss/          # SASS source files
│   ├── components/    # Component styles
│   ├── pages/         # Page-specific styles
│   └── main.scss      # Main stylesheet
├── views/             # EJS templates
│   ├── partials/      # Reusable template parts
│   └── *.ejs          # Page templates
├── public/            # Static assets
│   ├── css/           # Compiled CSS
│   ├── js/            # Client-side JavaScript
│   └── images/        # Images and icons
├── uploads/           # User-uploaded files
└── server.js          # Main server file
```

## Documentation

For comprehensive documentation including API reference, installation guides, and examples, visit:

**📚 [Complete Documentation](https://sayonika.reconvial.dev/docs)**

### Quick API Reference
- **Authentication**: `/api/auth/*` - User registration, login, and profile management
- **Mods**: `/api/mods/*` - Mod browsing, upload, and download
- **Admin**: `/api/admin/*` - Administrative functions and mod review
- **Categories**: `/api/categories` - Mod categories and tags

For detailed endpoint documentation with examples, see the [API Reference](https://sayonika.reconvial.dev/docs/api) section.

## Database Schema

The application uses SQLite with the following main tables:
- `users` - User accounts and profiles (includes `is_admin` field)
- `mods` - Mod information and metadata
- `categories` - Mod categories
- `mod_versions` - Version history for mods
- `reviews` - User reviews and ratings
- `downloads` - Download tracking
- `favorites` - User favorites
- `mod_reviews` - Admin review decisions and reasons
- `migrations` - Database migration tracking

## Admin System

Sayonika includes a comprehensive admin system for managing mod submissions and users.

### Admin Features

- **Mod Review System**: All uploaded mods require admin approval before publication
- **Admin Dashboard**: Comprehensive overview with statistics and pending mod reviews
- **Bulk Actions**: Approve or reject multiple mods at once
- **Review History**: Track all admin decisions with reasons and timestamps
- **Download Access**: Admins can download mods for review before approval

### Admin Access

1. **First User Admin**: The first user to register on the website automatically becomes an admin
   - This applies to both regular registration and OAuth registration (GitHub/Discord)
   - The first user receives a special welcome message indicating their admin status
   - All subsequent users are regular users by default

2. **Making Additional Admins**: Update the database directly for additional admin users
   ```sql
   UPDATE users SET is_admin = 1 WHERE username = 'your_username';
   ```

3. **Admin Panel Access**: Available at `/admin` for admin users
   - Admin panel button appears in navigation dropdown
   - Admin panel button appears on user profile page

### Mod Review Workflow

1. User uploads a mod → Mod is created with `is_published = FALSE`
2. Admin reviews mod in admin panel
3. Admin can:
   - **Approve**: Mod becomes published and visible to users
   - **Reject**: Mod remains unpublished, author is notified with reason
   - **Download**: Review the mod files before making a decision

## Database Migrations

Sayonika includes a robust migration system for managing database schema changes.

### Migration Commands

```bash
# Run pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Create new migration
npm run migrate:create migration_name

# Show current schema version
npm run migrate:version

# Rollback specific migration
npm run migrate:rollback filename.sql
```

### Creating Migrations

```bash
# Create a new migration
npm run migrate:create add_user_preferences

# The system creates: database/migrations/YYYY-MM-DDTHH-MM-SS_add_user_preferences.sql
```

### Migration Best Practices

- Always use `IF NOT EXISTS` for CREATE statements
- Make migrations idempotent (safe to run multiple times)
- Test on a database copy before production
- Include descriptive comments in migration files

For detailed migration documentation, see `database/README.md`.

## Configuration

Key environment variables:
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - JWT signing secret
- `DATABASE_PATH` - SQLite database file path
- `ALLOWED_ORIGINS` - CORS allowed origins

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevents abuse and spam
- **Input Validation**: Server-side validation using express-validator
- **File Upload Security**: File type and size validation
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet.js**: Security headers and protections

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This project is not affiliated with Team Salvato or the official Doki Doki Literature Club game. Doki Doki Literature Club is a trademark of Team Salvato.

## Support

For support, please open an issue on GitHub or contact the development team.

---

Built with ❤️ for the DDLC modding community
