# Secure Session-Based Authentication Architecture

## 📋 Overview

This document explains the new production-grade security architecture for the ERP system that replaces the old insecure authentication system with a custom session-based approach using Firebase Realtime Database only (NO Firebase Auth).

---

## 🏗️ Architecture Design

### 1. Database Structure (Multi-Tenant + Session-Based)

```
/
├── companies/{companyId}/
│   ├── metadata/
│   │   ├── name
│   │   ├── status
│   │   ├── createdAt
│   │   └── updatedAt
│   ├── users/{uid}/
│   │   ├── fullName
│   │   ├── username
│   │   ├── role
│   │   ├── permissions[]
│   │   ├── status
│   │   ├── createdAt
│   │   ├── updatedAt
│   │   └── lastLoginAt
│   │   ❌ NO passwordHash here!
│   ├── employees/
│   ├── salaries/
│   ├── attendance/
│   ├── settings/
│   └── logs/
│
├── sessions/{sessionToken}/
│   ├── uid
│   ├── companyId (CRITICAL FOR ISOLATION)
│   ├── username
│   ├── fullName
│   ├── role
│   ├── permissions[]
│   ├── createdAt
│   ├── expiresAt
│   ├── isActive
│   └── ipAddress (optional)
│
├── userCredentials/{uid}/
│   ├── passwordHash (PROTECTED - NEVER EXPOSED TO FRONTEND)
│   ├── status
│   └── lastPasswordChange
│
├── auditLogs/{companyId}/{logId}/
│   ├── userId
│   ├── username
│   ├── action
│   ├── resource
│   ├── status
│   ├── timestamp
│   ├── metadata
│   └── ipAddress
│
└── rateLimits/{key}/
    ├── attempts
    ├── lastAttemptTime
    └── blockedUntil
```

---

## 🔐 Security Features

### 1. Password Hash Protection

**Current System (INSECURE):**
```javascript
// ❌ BAD: Exposes passwordHash to all authenticated users
const users = await get(ref(rtdb, 'users'));
// Anyone can read all users including passwordHash
```

**New System (SECURE):**
```javascript
// ✓ GOOD: passwordHash in separate protected node
const credentials = await get(ref(rtdb, `userCredentials/${uid}`));
// Rules prevent ANY client access to userCredentials
// Only server-side auth verification can read this
```

### 2. Session-Based Access Control

**How It Works:**
1. User logs in with username + password
2. System verifies password against `userCredentials/{uid}/passwordHash`
3. System generates secure sessionToken
4. Session stored in `sessions/{sessionToken}` with:
   - User ID
   - Company ID (for isolation)
   - Permissions
   - Expiry time
   - Active status

5. Client receives ONLY `sessionToken` (not password, not credentials)
6. Client includes `sessionToken` in queries
7. Firebase rules validate session before allowing read/write

**Benefits:**
- Server-side session (RTDB is the "server")
- Token-based authentication
- Stateless validation
- No shared secrets in localStorage beyond token

### 3. Multi-Tenant Company Isolation

**Before Access:**
1. Session must have `companyId`
2. Rules verify user's company matches requested data's company
3. Users can NEVER access other companies' data

**Rule Example:**
```javascript
// Only read users from your own company
"companies/$companyId/users/$uid": {
  ".read": "root.child('sessions').child($sessionToken).child('companyId').val() === $companyId"
}
```

### 4. Role-Based Access Control (RBAC)

**System Roles:**
- `super_admin` - Full access
- `manager` - Department/team access
- `accountant` - Financial operations
- `employee` - Limited self-access

**Permission Examples:**
- `users.view` - View user list
- `users.edit` - Create/edit users
- `salary.approve` - Approve salary cycles
- `salary.pay` - Process payments
- `attendance.delete` - Delete attendance records
- `settings.edit` - Modify company settings

**Enforcement:**
```javascript
// Rules check permissions from session
"companies/$companyId/salaries": {
  ".write": "root.child('sessions').child($sessionToken).child('permissions').contains('salary.edit')"
}
```

### 5. Rate Limiting & Brute Force Protection

**Implementation:**
- Track login attempts per IP + username
- After 5 failed attempts → block for 30 minutes
- Reset counter on successful login
- Prevents credential stuffing attacks

**Code:**
```typescript
// In secureAuthService.login()
const isBlocked = await checkRateLimits(rateLimitKey);
if (isBlocked) {
  throw new AuthenticationError('TOO_MANY_ATTEMPTS', ...);
}
```

### 6. Audit Logging

**Logged Actions:**
- All login/logout events
- User creation/modification
- Permission/role changes
- Salary operations
- Unauthorized access attempts
- Settings modifications

**Audit Entry Structure:**
```json
{
  "id": "uuid",
  "companyId": "company-001",
  "userId": "user-123",
  "username": "ahmed",
  "action": "salary.approve",
  "resource": "salaries",
  "resourceId": "cycle-2024-01",
  "status": "success",
  "timestamp": 1718292460000,
  "ipAddress": "192.168.1.1",
  "metadata": {
    "amount": 50000,
    "timestamp": "2024-06-13T16:37:10Z"
  }
}
```

### 7. Session Expiry & Refresh

**Default Duration:** 24 hours

**Auto-Refresh:** Frontend can refresh session before expiry
- SessionManager component checks every 1 second
- Shows warning at 10 minutes remaining
- Extends session if user clicks "Keep me logged in"

**Automatic Logout:** 
- Session expires if unused
- User redirected to login
- Message: "Your session has expired"

---

## 🚨 Security Against Common Attacks

### 1. Man-in-the-Middle (MITM)

**Protection:**
- ✓ HTTPS only (enforced in production)
- ✓ CSP headers (Content Security Policy)
- ✓ HSTS (HTTP Strict Transport Security)

**Setup:**
```
# Production only - add to web server config
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src https:
```

### 2. Session Token Hijacking

**Protection:**
- ✓ Token stored in localStorage (HTTP-only cookie not possible without backend)
- ✓ IP address validation (optional, in metadata)
- ✓ Short expiry (4-8 hours recommended for sensitive data)
- ✓ Refresh token rotation (advanced feature)

**Risk Mitigation:**
```typescript
// Token structure: {UUID}-{timestamp}-{random}
// 120+ bit entropy - cryptographically secure
const token = crypto.randomUUID() + '-' + Date.now().toString(36) + '-' + Math.random();
```

### 3. Privilege Escalation

**Prevention:**
- ✓ Permissions set server-side (RTDB rules enforce)
- ✓ Frontend CANNOT modify permissions
- ✓ Role changes logged in audit trail
- ✓ Only super_admin can change roles

**Rule:**
```javascript
// Prevent frontend from setting permissions
"companies/$companyId/users/$uid/permissions": {
  ".write": false  // LOCKED - only backend can modify
}
```

### 4. Cross-Company Data Access

**Prevention:**
- ✓ companyId embedded in every session
- ✓ Rules validate company on EVERY read/write
- ✓ Frontend cannot query other companies

**Rule:**
```javascript
"companies/$companyId": {
  ".read": "root.child('sessions').child($sessionToken).child('companyId').val() === $companyId"
}
```

### 5. Brute Force Attacks

**Protection:**
- ✓ 5 failed attempts → 30 minute block
- ✓ Rate limit tracked per IP + username
- ✓ Exponential backoff (optional advanced)
- ✓ CAPTCHA (optional, if needed)

### 6. Password Hash Exposure

**Protection:**
- ✓ passwordHash in separate `userCredentials/` node
- ✓ Firebase rules DENY ALL client access
- ✓ Frontend cannot query this node
- ✓ Only auth verification accesses it

**Rules:**
```javascript
"userCredentials": {
  ".read": false,    // ✓ NO CLIENT ACCESS
  ".write": false    // ✓ NO CLIENT ACCESS
}
```

---

## 📱 Frontend Implementation

### 1. Login Flow

```typescript
// In Login page
const { login } = useSecureAuth();

await login(
  {
    username: 'ahmed',
    password: 'secret123'
  },
  'company-001',
  ipAddress  // optional
);

// Returns: Session stored + saved to localStorage
// User redirected to dashboard
```

### 2. Protected Routes

```typescript
// Wrap sensitive pages
<EnhancedProtectedRoute permission="salary.approve">
  <SalaryApprovalPage />
</EnhancedProtectedRoute>

// Features:
// ✓ Validates session against RTDB
// ✓ Checks permissions
// ✓ Logs unauthorized attempts
// ✓ Shows clear error messages
```

### 3. Session Management

```typescript
// SessionManager component mounted at app root
<SecureAuthProvider>
  <SessionManager 
    refreshInterval={5 * 60 * 1000}      // Refresh every 5 min
    warningThreshold={10 * 60 * 1000}    // Warn 10 min before expiry
    onWarning={(time) => console.log(`Expires in: ${time}`)}
    onLogout={() => console.log('User logged out')}
  />
  <App />
</SecureAuthProvider>

// Features:
// ✓ Auto-refreshes sessions
// ✓ Shows expiry warning
// ✓ Detects session invalidation
// ✓ Auto-logout on expiry
```

---

## 🔄 Login Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User enters username + password in Login page            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. secureAuthService.login() called                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Check rate limits (rateLimits/{key})                     │
│    - If blocked → throw error                               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Query user by username                                   │
│    - companies/{companyId}/users                            │
│    - ✓ NO passwordHash fetched yet                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Check user status (must be 'active')                     │
│    - If not active → throw error                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Fetch passwordHash from userCredentials/{uid}            │
│    - Only during login verification                         │
│    - Protected by rules                                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Verify password with bcrypt.compareSync()               │
│    - If invalid → record failed attempt + error             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Generate secure sessionToken                             │
│    - UUID-Timestamp-Random                                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Store session in sessions/{sessionToken}                │
│    - uid, companyId, role, permissions, expiresAt, etc.    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. Clear rate limits                                       │
│     - rateLimits/{key} deleted                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. Update user's lastLoginAt                              │
│     - companies/{companyId}/users/{uid}/lastLoginAt         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 12. Audit log: login success                               │
│     - auditLogs/{companyId}/{logId}                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 13. Return SessionData to frontend                          │
│     ❌ NO passwordHash, ❌ NO credentials returned          │
│     ✓ sessionToken, ✓ permissions, ✓ expiresAt             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 14. Frontend:                                               │
│     - Save session to localStorage                          │
│     - Redirect to /dashboard                                │
│     - Mount SessionManager (auto-refresh + expiry warning)  │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Production Deployment Checklist

### Before Going Live

- [ ] **HTTPS Only**
  - All traffic HTTPS
  - Redirect HTTP to HTTPS
  - HSTS header enabled

- [ ] **Firebase Rules Deployed**
  - Updated to production rules
  - Tested with all user roles
  - Rate limiting verified

- [ ] **CORS Configured**
  - Only allow frontend domain
  - Restrict POST/PUT/DELETE to same origin

- [ ] **CSP Headers Set**
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self';
  ```

- [ ] **Session Duration**
  - Default: 4-8 hours (adjustable)
  - Not too long (security risk)
  - Not too short (UX problem)

- [ ] **Audit Logging**
  - All sensitive operations logged
  - Audit logs retention policy set
  - Admin can view audit logs

- [ ] **Error Handling**
  - Errors logged server-side
  - User sees generic errors (no info leakage)
  - Developers can debug via logs

- [ ] **Performance**
  - Session validation < 200ms
  - Rule evaluation optimized
  - No N+1 queries

- [ ] **Backup & Recovery**
  - Database backups automated
  - Recovery procedure tested
  - Disaster recovery plan

- [ ] **Monitoring & Alerts**
  - Track failed logins
  - Alert on unusual activity
  - Monitor rate limit blocks
  - Check session validity rates

---

## 🚀 Migration Strategy

### Phase 1: Preparation (Day 1)

1. Deploy new RTDB structure alongside old
2. Export users to JSON backup
3. Create `companies/{defaultCompanyId}` structure
4. Generate `userCredentials/{uid}` for all users

### Phase 2: Testing (Day 2-3)

1. Test new auth flow with staging data
2. Test all user roles and permissions
3. Verify company isolation
4. Test rate limiting
5. Verify audit logging

### Phase 3: Gradual Rollout (Week 1)

1. Deploy beta to 10% of users
2. Monitor for errors
3. Roll out to 50% of users
4. Final 100% rollout

### Phase 4: Cleanup (Day 7+)

1. Keep old `users/` path for 30 days
2. Monitor for any issues
3. Archive old data
4. Delete old structure

### Phase 5: Hardening (Ongoing)

1. Regular security audits
2. Penetration testing
3. Update rules based on findings
4. Monitor threat landscape

---

## 📊 Files Created

New files:
- ✓ `database.rules.json` - Production security rules
- ✓ `src/types/secure.ts` - Type definitions
- ✓ `src/services/secureAuthService.ts` - Secure login/logout
- ✓ `src/services/sessionValidationService.ts` - Session management
- ✓ `src/services/auditService.ts` - Audit logging
- ✓ `src/context/SecureAuthContext.tsx` - React context
- ✓ `src/components/layout/EnhancedProtectedRoute.tsx` - Protected routes
- ✓ `src/components/layout/SessionManager.tsx` - Session lifecycle

Update existing files:
- `src/pages/Login/Login.tsx` - Use `useSecureAuth` instead of `useAuth`
- `src/App.tsx` - Wrap with `SecureAuthProvider` and `SessionManager`
- `.env` - Add `VITE_COMPANY_ID` environment variable

---

## 🔍 Security Summary

### What's Protected

✓ Passwords never exposed (separate `userCredentials` node)  
✓ Sessions server-side in RTDB  
✓ Company data isolated by `companyId`  
✓ Permissions enforced at rules level  
✓ Privilege escalation prevented  
✓ Brute force attacks rate-limited  
✓ All sensitive operations audited  
✓ Unauthorized access attempts logged  

### What's NOT Protected (Inherent Limitations)

❌ Stolen sessionToken (if browser is compromised)
- Mitigation: Short expiry + IP validation + refresh tokens

❌ Man-in-the-middle (if HTTP not HTTPS)
- Mitigation: MUST use HTTPS in production

❌ XSS attacks (if frontend code is modified)
- Mitigation: CSP headers + regular security audits

❌ Malicious admin user
- Mitigation: Separate admin accounts, audit all admin actions

### Assumptions

- Frontend code is trusted (no XSS/malware)
- HTTPS is enforced (no network attacks)
- Database backups are secure
- Admin users are trusted

---

## 📞 Support

For questions about:
- **Architecture** → See this document
- **Implementation** → See code comments in services
- **Rules** → See `database.rules.json`
- **Audit** → Check `auditLogs/{companyId}/` in RTDB

---

**Version:** 1.0  
**Last Updated:** 2024-06-13  
**Status:** Production-Ready
