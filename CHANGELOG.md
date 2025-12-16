# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup
- Added `.gitignore`
- Added `CHANGELOG.md`
- Added `LICENSE` (Apache 2.0)

### Fixed
- **Dashboard UI**: Resolved layout issues on reload by replacing Tailwind CSS with inline styles and global CSS classes.
- **Authentication**: Fixed Logout functionality to ensure immediate redirect to login page.
- **Signing**:
    - Fixed "Failed to queue signing" error by implementing automatic certificate issuance when saving a signature.
    - Resolved 404 error on API root by adding a welcome message.
    - Improved error messages for signing failures to guide users (e.g., "No active certificate found").
- **Shared Access**:
    - Allow shared users (Client B) to sign and download documents they do not own.
    - Fixed "Unauthorized" error during file download by including the JWT token in the request header.
- **Documentation**: Corrected duplicated content in `README.md` to ensure clean and accurate instructions.
