# Publishing Queue SDK to npm

This guide explains how to publish the `queue-sdk` package to npm.

## Prerequisites

1. **npm account**: Create an account at [npmjs.com](https://www.npmjs.com/signup)
2. **Login to npm**: Authenticate with npm from your terminal
3. **Package name availability**: Check if `queue-sdk` is available (or use a scoped name like `@yourusername/queue-sdk`)

## Pre-Publishing Checklist

### 1. Update package.json

Ensure your `package.json` includes:
- ✅ `name`: Package name (must be unique on npm)
- ✅ `version`: Semantic version (e.g., `0.1.0`)
- ✅ `description`: Clear description
- ✅ `license`: License type (MIT, ISC, etc.)
- ✅ `keywords`: Searchable keywords
- ✅ `files`: Array of files/folders to include (currently `["dist"]`)
- ✅ `main`: Entry point (currently `dist/index.js`)
- ✅ `types`: TypeScript definitions (currently `dist/index.d.ts`)
- ✅ `exports`: Modern module exports
- ✅ `peerDependencies`: Dependencies that users must install

### 2. Check Package Name Availability

```bash
# Check if name is available
npm search queue-sdk

# Or try to view it (will fail if not published)
npm view queue-sdk
```

**Note**: If `queue-sdk` is taken, consider:
- Using a scoped package: `@yourusername/queue-sdk`
- Adding a prefix/suffix: `@yourcompany/queue-sdk` or `queue-sdk-v2`

### 3. Build the Package

```bash
cd packages/sdk
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### 4. Verify Build Output

Ensure the `dist/` folder contains:
- ✅ `index.js` - Main entry point
- ✅ `index.d.ts` - TypeScript definitions
- ✅ All other compiled `.js` and `.d.ts` files
- ✅ `react/` folder with React components if applicable

```bash
ls -la dist/
```

### 5. Test the Build Locally (Optional but Recommended)

```bash
# Create a test directory
mkdir /tmp/test-queue-sdk
cd /tmp/test-queue-sdk

# Initialize npm project
npm init -y

# Install your SDK from local path
npm install /home/tw-hp/Documents/my-new-queue-app/packages/sdk

# Test importing
node -e "import('queue-sdk').then(sdk => console.log('SDK loaded:', Object.keys(sdk)))"
```

## Publishing Steps

### Step 1: Login to npm

```bash
npm login
```

Enter your:
- Username
- Password
- Email address
- OTP (if 2FA is enabled)

Verify login:
```bash
npm whoami
```

### Step 2: Check What Will Be Published

```bash
cd packages/sdk
npm pack --dry-run
```

This shows what files will be included in the published package. Should only include:
- `dist/` folder
- `package.json`
- `README.md`
- `LICENSE` (if you have one)

### Step 3: Version Management

Update version before publishing:

**Patch version** (bug fixes):
```bash
npm version patch
# Changes 0.1.0 → 0.1.1
```

**Minor version** (new features, backward compatible):
```bash
npm version minor
# Changes 0.1.0 → 0.2.0
```

**Major version** (breaking changes):
```bash
npm version major
# Changes 0.1.0 → 1.0.0
```

**Or manually edit** `package.json`:
```json
{
  "version": "0.1.0"
}
```

### Step 4: Build Again (After Version Update)

```bash
npm run build
```

### Step 5: Publish to npm

**For public package**:
```bash
npm publish
```

**For scoped package** (e.g., `@yourusername/queue-sdk`):
```bash
npm publish --access public
```

**For private package** (requires npm paid plan):
```bash
npm publish --access restricted
```

### Step 6: Verify Publication

```bash
# View published package
npm view queue-sdk

# View package details
npm view queue-sdk versions
npm view queue-sdk dist-tags
```

Visit: `https://www.npmjs.com/package/queue-sdk`

## Post-Publishing

### 1. Install and Test

```bash
# In a fresh directory
npm init -y
npm install queue-sdk

# Test it
node -e "import('queue-sdk').then(sdk => console.log('Success!', Object.keys(sdk)))"
```

### 2. Tag Releases (Optional)

```bash
# Tag in git (if using version command)
git push --follow-tags
```

### 3. Update Documentation

- Update README if needed
- Add installation instructions
- Update changelog

## Using Scoped Packages (Recommended)

If you want to use a scoped package name (e.g., `@yourusername/queue-sdk`):

### 1. Update package.json

```json
{
  "name": "@yourusername/queue-sdk",
  ...
}
```

### 2. Publish with public access

```bash
npm publish --access public
```

### 3. Install as scoped package

```bash
npm install @yourusername/queue-sdk
```

Benefits:
- Namespace protection (your username/organization)
- Less likely to have naming conflicts
- Professional appearance

## Updating Published Packages

### 1. Make Changes

Update your code, then:

### 2. Update Version

```bash
npm version patch  # or minor, or major
```

This:
- Updates `package.json` version
- Creates a git tag (if in git repo)
- Creates a git commit (if in git repo)

### 3. Build

```bash
npm run build
```

### 4. Publish

```bash
npm publish
```

## Unpublishing (Only for emergencies!)

**⚠️ Warning**: Only unpublish within 72 hours of publishing. After that, use deprecation.

### Deprecate (Recommended)

```bash
npm deprecate queue-sdk@0.1.0 "This version has issues. Use 0.1.1 instead."
```

### Unpublish (Emergency only)

```bash
# Unpublish specific version
npm unpublish queue-sdk@0.1.0

# Unpublish entire package (must be within 72 hours)
npm unpublish queue-sdk --force
```

## Troubleshooting

### Error: Package name already taken

**Solution**: Use a scoped package name:
```json
{
  "name": "@yourusername/queue-sdk"
}
```

### Error: You must verify your email

**Solution**: 
1. Check your email for verification link
2. Or: `npm verify-email`

### Error: You do not have permission

**Solution**: 
1. Check if you're logged in: `npm whoami`
2. Check if package name belongs to someone else
3. Use a scoped package if needed

### Error: Invalid package.json

**Solution**: Validate your package.json:
```bash
npm pack --dry-run
```

### Build files not included

**Solution**: Ensure `dist/` is listed in `files` array:
```json
{
  "files": ["dist"]
}
```

## Automation Scripts (Optional)

Add to `package.json`:

```json
{
  "scripts": {
    "prepublishOnly": "npm run build && npm run lint",
    "preversion": "npm run lint",
    "version": "npm run build && git add -A dist",
    "postversion": "git push && git push --tags"
  }
}
```

This automatically:
- Builds before publishing
- Lints before versioning
- Commits build files on version update
- Pushes tags after versioning

## Best Practices

1. **Semantic Versioning**: Follow semver (major.minor.patch)
2. **Test Before Publish**: Always test the built package locally
3. **Keep `dist/` Clean**: Only include necessary files
4. **Documentation**: Keep README updated
5. **Changelog**: Document changes between versions
6. **CI/CD**: Consider automating publishing via GitHub Actions
7. **2FA**: Enable 2FA on your npm account for security

## Quick Reference Commands

```bash
# Login
npm login

# Check current user
npm whoami

# Preview what will be published
npm pack --dry-run

# Update version (patch/minor/major)
npm version patch

# Build
npm run build

# Publish
npm publish

# View published package
npm view queue-sdk

# Test installation
npm install queue-sdk
```


