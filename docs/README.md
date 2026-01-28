# SubTrack Pro Documentation

This folder contains all project documentation organized by category.

## Quick Links

- [Publishing Checklist](./PUBLISHING_CHECKLIST.md) - Steps to publish to App Store
- [Deployment Guide](./deployment/DEPLOYMENT_GUIDE_2025.md) - General deployment instructions

## Folder Structure

```
docs/
├── PUBLISHING_CHECKLIST.md    # App Store submission steps
├── README.md                  # This file
│
├── app-store/                 # App Store specific guides
│   ├── APP_STORE_SUBMISSION_GUIDE.md
│   ├── STORE_LISTING_TEMPLATES.md
│   └── ...
│
├── deployment/                # Deployment & build guides
│   ├── DEPLOYMENT_GUIDE_2025.md
│   ├── BUILD-GUIDE.md
│   └── ...
│
├── integration/               # Third-party integrations
│   ├── STRIPE_INTEGRATION_GUIDE.md
│   ├── GITHUB-SECRETS-SETUP.md
│   └── ...
│
├── architecture/              # System design & features
│   ├── AI_ASSISTANT_IMPLEMENTATION.md
│   ├── VIRTUAL_CARD_IMPLEMENTATION.md
│   └── ...
│
├── troubleshooting/           # Debug & fix guides
│   ├── AUTH-DIAGNOSIS.md
│   ├── DEBUG-SUMMARY.md
│   └── ...
│
└── archive/                   # Completed/historical docs
    ├── CLEANUP-SUMMARY.md
    └── ...
```

## Scripts

Located in `/scripts/`:

| Script | Purpose |
|--------|---------|
| `toggle-demo-mode.sh` | Enable/disable demo authentication mode |

### Usage Examples

```bash
# Check demo mode status
./scripts/toggle-demo-mode.sh status

# Disable for production
./scripts/toggle-demo-mode.sh disable

# Enable for development
./scripts/toggle-demo-mode.sh enable
```

## Key Configuration Files

| File | Purpose |
|------|---------|
| `app.json` | Expo app configuration |
| `eas.json` | EAS build & submit settings |
| `replit.md` | Project overview for AI assistants |

## Getting Help

- Check relevant docs folder for your issue
- Review troubleshooting guides
- Consult the main README.md in project root
