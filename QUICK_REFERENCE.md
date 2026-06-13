# Quick Reference: Session-Based Authentication System

## 📍 File Locations

### Core Files
```
src/
├── types/
│   └── secure.ts                          # Type definitions
├── services/
│   ├── secureAuthService.ts              # Login/logout/session
│   ├── sessionValidationService.ts       # Session validation
│   ├── auditService.ts                   # Audit logging
│   └── firebase.ts                       # (existing, still used)
├── context/
│   └── SecureAuthContext.tsx             # React context (NEW)
├── components/
│   └── layout/
│       ├── EnhancedProtectedRoute.tsx    # (NEW, replace old)
│       └── SessionManager.tsx            # (NEW)
├── pages/
│   └── Login/
│       └── Login.tsx                     # (UPDATE to use new auth)
├── utils/
│   └── migration.ts                      # Data migration
└── App.tsx                               # (UPDATE: add providers)

database.rules.json                       # Firebase rules (NEW)
SECURITY_ARCHITECTURE.md                  # Full docs
IMPLEMENTATION_GUIDE.md                   # Step-by-step guide
SECURITY_SUMMARY.md                       # Overview
```

---

## 🔑 Key Functions

### Login
```typescript
import { useSecureAuth } from './context/SecureAuthContext';

const { login } = useSecureAuth();

await login(
  { username: 'ahmed', password: '***' },
  'company-001',
  ipAddress
);
```

### Check Permission
```typescript
const { hasPermission, hasAnyPermission } = useSecureAuth();

if (hasPermission('salary.approve')) {
  // Show salary approval button
}

if (hasAnyPermission(['salary.view', 'salary.edit'])) {
  // Show salary page
}
```

### Protect Route
```typescript
import { EnhancedProtectedRoute } from './components/layout/EnhancedProtectedRoute';

<EnhancedProtectedRoute permission="users.edit">
  <UsersPage />
</EnhancedProtectedRoute>
```

### Validate Session
```typescript
import { sessionValidationService } from './services/sessionValidationService';

const result = await sessionValidationService.validateSessionAgainstRTDB(
  session.sessionToken,
  session.companyId,
  session.uid
);

if (result.isValid) {
  // Session is good
}
```

### Logout
```typescript
const { logout } = useSecureAuth();
await logout();
```

---

## 🛡️ Security Rules Summary

```json
{
  "sessions/*": {
    ".read": "session is active and not expired",
    ".write": "internal only (no client write)"
  },
  
  "userCredentials/*": {
    ".read": false,
    ".write": false
  },
  
  "companies/$companyId/users": {
    ".read": "session.companyId === $companyId",
    ".write": "requires admin + permission"
  },
  
  "companies/$companyId/salaries": {
    ".read": "requires salary.view permission",
    ".write": "requires salary.edit permission"
  }
}
```

---

## 🔄 Data Flow

### Login Flow
```
User Input
    ↓
secureAuthService.login()
    ├─ Check rate limits
    ├─ Fetch user from companies/{cid}/users
    ├─ Verify password against userCredentials/{uid}
    ├─ Generate sessionToken
    ├─ Store session in sessions/{token}
    ├─ Record audit log
    └─ Return SessionData (NO password)
    ↓
sessionValidationService.saveSession()
    ├─ Save to localStorage
    └─ (Real validation is via RTDB)
    ↓
User redirected to Dashboard
    ↓
SessionManager mounts
    ├─ Auto-refresh every 5 min
    ├─ Show warning at 10 min before expiry
    └─ Auto-logout on expiry
```

### Data Access Flow
```
Component requests data
    ↓
secureUserService.getCompanyUsers(session)
    ├─ Check: session.companyId
    ├─ Check: hasPermission('users.view')
    ├─ Query: companies/{companyId}/users
    │ (Rules validate session before returning)
    └─ Return filtered data
    ↓
Component renders data
```

---

## ⚠️ Common Mistakes

### ❌ Wrong
```typescript
// Fetching all users with passwords
const users = await get(ref(rtdb, 'users'));
// ❌ OLD WAY - Exposes passwordHash
```

### ✅ Right
```typescript
// Fetch users safely
const users = await secureUserService.getCompanyUsers(session);
// ✓ NEW WAY - Validates company + permission
```

---

### ❌ Wrong
```typescript
// Not checking permission
const comp = await get(ref(rtdb, `companies/${companyId}/salaries`));
// ❌ Client-side check only - bypassable
```

### ✅ Right
```typescript
// Protected route with server-side validation
<EnhancedProtectedRoute permission="salary.view">
  <SalaryPage />
</EnhancedProtectedRoute>
// ✓ Rules validate at DB level
```

---

### ❌ Wrong
```typescript
// Storing passwords
localStorage.setItem('password', password);
// ❌ NEVER do this
```

### ✅ Right
```typescript
// Store only session token
sessionValidationService.saveSession(session);
// ✓ Token is auto-validated against RTDB
```

---

## 📊 Roles & Permissions Matrix

| Role | users.view | users.edit | salary.view | salary.approve | salary.pay |
|------|-----------|-----------|------------|----------------|-----------|
| super_admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| manager | ✓ | ✓ | ✓ | ✓ | ✗ |
| accountant | ✓ | ✗ | ✓ | ✗ | ✓ |
| employee | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## 🚨 Emergency Procedures

### User Locked Out
```bash
# 1. Check rate limit in Firebase Console
# rateLimits/{username-or-ip}

# 2. Delete the rate limit entry
# This resets their login attempts

# 3. User can try again immediately
```

### Session Stuck / Not Expiring
```bash
# 1. Check session in Firebase Console
# sessions/{sessionToken}

# 2. Delete the session entry to force logout
# User will be logged out on next page refresh

# 3. User can login again
```

### Audit Log Full / Performance Issues
```bash
# 1. Archive old audit logs
# Move auditLogs/{companyId}/* to backup

# 2. Delete old entries
# auditLogs/{companyId}/{oldLogId}

# 3. Monitor size going forward
```

---

## 🔍 Debugging Tips

### Check Current Session
```javascript
// In browser console
JSON.parse(localStorage.getItem('secure_session'))

// Returns:
{
  "uid": "user-123",
  "companyId": "company-001",
  "permissions": ["users.view", "salary.approve"],
  "expiresAt": 1718378460000,
  "isActive": true
}
```

### Verify Session in RTDB
```bash
# Go to Firebase Console
# Navigate to: sessions/{sessionToken}
# Should see all session data
```

### Check Audit Logs
```bash
# Go to Firebase Console
# Navigate to: auditLogs/{companyId}/
# Should see entries for recent actions
```

### Monitor Rate Limits
```bash
# Go to Firebase Console
# Navigate to: rateLimits/
# Shows any IP/users currently rate-limited
```

### Check Permissions in Session
```javascript
const { session } = useSecureAuth();
console.log(session.permissions);
// ['users.view', 'salary.approve', ...]
```

### Test Permission Check
```javascript
const { hasPermission } = useSecureAuth();
console.log(hasPermission('salary.approve')); // true/false
```

---

## 🔐 Security Checklist

Before going live:

- [ ] HTTPS enabled (check browser shows 🔒)
- [ ] Firebase rules deployed (check Console)
- [ ] CSP headers configured (check network tab)
- [ ] HSTS enabled (check response headers)
- [ ] Test login with wrong password (should fail)
- [ ] Test rate limiting (6 wrong attempts)
- [ ] Test company isolation (try to access other company)
- [ ] Test permission denial (try action without permission)
- [ ] Verify audit logs created (check after each action)
- [ ] Check passwordHash NOT in network calls (search "passwordHash")

---

## 📱 Environment Variables

```env
# Required
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_DATABASE_URL=https://your-rtdb.firebaseio.com
VITE_COMPANY_ID=company-001

# Optional
VITE_SESSION_DURATION=86400000    # 24 hours
VITE_SESSION_WARNING=600000        # 10 minutes before expiry
```

---

## 🧪 Testing Commands

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run security tests
npm run test:security

# Lint code
npm run lint

# Build
npm run build

# Preview production build
npm run preview
```

---

## 🚀 Deployment Commands

```bash
# Deploy Firebase rules
firebase deploy --only database:rules

# Deploy to production
npm run build
# Then deploy `dist/` folder to your host

# Verify rules deployed
firebase database:rules:get
```

---

## 📞 Quick Links

| Document | Purpose |
|----------|---------|
| SECURITY_ARCHITECTURE.md | Complete architecture explanation |
| IMPLEMENTATION_GUIDE.md | Step-by-step implementation |
| SECURITY_SUMMARY.md | Executive overview |
| database.rules.json | Firebase security rules |
| src/types/secure.ts | TypeScript type definitions |

---

## ⏱️ Timeline Reference

| Task | Time |
|------|------|
| Setup environment | 30 min |
| Deploy rules | 15 min |
| Update App.tsx | 15 min |
| Update Login page | 15 min |
| Update routes | 30 min |
| Test locally | 1-2 hours |
| Deploy to staging | 30 min |
| Staging testing | 1 day |
| Production rollout | 1-2 hours |
| Monitoring | 7 days |

**Total: 1-2 weeks** (depends on testing rigor)

---

## 🎓 Key Concepts

**Session Token:** Unique identifier for user's login session  
**Company ID:** Multi-tenant isolation key  
**Permission:** Specific authorization (e.g., "salary.approve")  
**Role:** Set of permissions (e.g., "manager")  
**Audit Log:** Record of sensitive operations  
**Rate Limit:** Protection against brute force attacks  

---

**Last Updated:** 2024-06-13  
**Version:** 1.0  
**Status:** Ready to Implement
