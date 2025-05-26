# Sayonika - DDLC Mod Store

Sayonika is a comprehensive mod store and community platform for Doki Doki Literature Club (DDLC) mods. Built with Node.js, Express, and SQLite, it provides a modern web interface for discovering, downloading, and sharing DDLC modifications.

## Features

### 🎮 Mod Management
- **Browse & Search**: Discover mods by category, popularity, or search terms
- **Download System**: Secure mod downloads with tracking
- **Version Control**: Support for multiple mod versions
- **Categories**: Organized mod categories (Full Mods, Gameplay, Visual, Audio, etc.)
- **Mod Review System**: Admin approval workflow for quality control

### 👥 User System
- **User Registration & Authentication**: Secure authentication with persistent sessions
- **OAuth Integration**: GitHub authentication with account linking
- **User Profiles**: Customizable profiles with avatars and bios
- **Mod Uploads**: Easy mod submission system with wizard interface
- **Admin Panel**: Comprehensive administrative tools and user management
- **Owner System**: First user becomes "Owner" with elevated privileges

### 🎨 Modern Interface
- **Responsive Design**: Mobile-friendly interface built with SASS
- **Dark/Light Theme**: Toggle between themes with persistent preference
- **DDLC-Inspired Design**: Color scheme and styling inspired by the game
- **Accessibility**: Built with accessibility best practices
- **Maintenance Mode**: Configurable maintenance mode with admin bypass

### 🔧 Technical Features
- **REST API**: Comprehensive API for mod data and user management
- **SQLite Database**: Lightweight, file-based database with migrations
- **File Upload**: Secure mod file handling with validation
- **Rate Limiting**: Protection against abuse with configurable limits
- **Security**: Helmet.js, CORS, input validation, and secure headers
- **Cloudflare Ready**: Configured for reverse proxy and CDN setups

## Installation

### Prerequisites
- Node.js 16.0.0 or higher
- npm package manager
- Git (for cloning the repository)

### Quick Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Dynamicaaa/Sayonika.git
   cd Sayonika
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration (see Configuration section below)
   ```

4. **Initialize Database**
   ```bash
   npm run init-db
   ```

5. **Build CSS**
   ```bash
   npm run build-css-prod
   ```

6. **Start the server**
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

The server will start on the configured port (default: `http://localhost:3000`). The first user to register will automatically become the Owner with full administrative privileges.

## Configuration

Key environment variables (see `.env.example` for complete list):

### Basic Configuration
- `PORT` - Server port (default: 3000)
- `SESSION_SECRET` - Session encryption secret
- `WEBSITE_URL` - Your domain URL (e.g., https://your-domain.com)
- `NODE_ENV` - Environment (development/production)

### Database
- `DATABASE_PATH` - SQLite database file path
- `SESSIONS_DATABASE_PATH` - Sessions database file path

### OAuth Authentication
- `GITHUB_CLIENT_ID` - GitHub OAuth client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth client secret

### Security & Performance
- `JWT_SECRET` - JWT signing secret for API authentication
- `RATE_LIMIT_WINDOW` - Rate limiting window in milliseconds
- `RATE_LIMIT_MAX` - Maximum requests per window
- `TRUST_PROXY_HOPS` - Number of proxy hops to trust (for Cloudflare)

### Email (Optional)
- `SMTP_HOST` - SMTP server hostname
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password

## Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run build-css` - Watch and compile SASS files
- `npm run build-css-prod` - Build CSS for production
- `npm run init-db` - Initialize database with schema
- `npm run migrate` - Run database migrations
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

1. **First User Owner**: The first user to register automatically becomes the "Owner" with full privileges
   - This applies to both regular registration and OAuth registration (GitHub)
   - The first user receives a special welcome message and displays as "Owner" in their profile
   - All subsequent users are regular users by default

2. **Making Additional Admins**: Update the database directly for additional admin users
   ```sql
   UPDATE users SET is_admin = 1 WHERE username = 'your_username';
   ```

3. **Admin Panel Access**: Available at `/admin` for admin users and owners
   - Admin panel button appears in navigation dropdown
   - Admin panel button appears on user profile page
   - Owners have additional privileges over regular admins

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

## Maintenance Mode

Sayonika includes a configurable maintenance mode feature:

### Features
- **Admin Toggle**: Enable/disable maintenance mode from the admin panel
- **Admin Bypass**: Administrators can access the site normally during maintenance
- **Mod Browsing**: Users can still browse mods during maintenance
- **Custom Messages**: Configure custom maintenance messages
- **API Support**: Maintenance mode affects both web and API endpoints

### Usage
1. Access the admin panel at `/admin`
2. Navigate to the maintenance mode section
3. Toggle maintenance mode on/off
4. Optionally set a custom maintenance message

During maintenance mode:
- Most site functionality is disabled for regular users
- Mod browsing remains available at `/browse`
- Admins can access all features normally
- API endpoints return appropriate maintenance status codes

## Security Features

- **JWT Authentication**: Secure token-based authentication with configurable expiration
- **Persistent Sessions**: Remember me functionality with secure cookie storage
- **OAuth Integration**: Secure GitHub authentication with account linking
- **Rate Limiting**: Configurable protection against abuse and spam
- **Input Validation**: Comprehensive server-side validation using express-validator
- **File Upload Security**: File type, size, and content validation
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet.js**: Security headers and protections
- **Proxy Support**: Secure configuration for Cloudflare and reverse proxies

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

For support and issue reporting, please create a new issue at:
**[GitHub Issues](https://github.com/Dynamicaaa/Sayonika/issues/new)**

You can also use the contact form on your Sayonika instance at `/contact` which will send consolidated emails to all administrators.

---

Built with ❤️ for the DDLC modding community
