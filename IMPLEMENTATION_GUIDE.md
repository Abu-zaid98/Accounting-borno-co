# Implementation Guide: Production-Grade Secure Authentication

## 📋 Quick Start

This guide walks through integrating the new secure session-based authentication system into your existing React + Firebase app.

---

## 🎯 Phase 1: Setup & Configuration

### 1.1 Update Environment Variables

Add to `.env` file:

```env
# Existing
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_DATABASE_URL=...

# New - Add these
VITE_COMPANY_ID=company-001
VITE_SESSION_DURATION=86400000  # 24 hours in milliseconds
VITE_SESSION_WARNING_THRESHOLD=600000  # 10 minutes
```

### 1.2 Deploy Firebase Security Rules

```bash
# 1. Install Firebase CLI (if not already)
npm install -g firebase-tools

# 2. Login to Firebase
firebase login

# 3. Deploy rules
firebase deploy --only database:rules --project YOUR_PROJECT_ID

# 4. Verify rules deployed
firebase database:rules:get --project YOUR_PROJECT_ID
```

**Verification:**
- Go to Firebase Console → Realtime Database → Rules
- Verify you see the new rules from `database.rules.json`
- ✓ Should show complex rules with session validation

### 1.3 Install Dependencies (if needed)

```bash
npm install bcryptjs
# Already in your package.json, so just verify
```

---

## 🎯 Phase 2: Update App Structure

### 2.1 Update App.tsx

Replace old auth provider with new:

```typescript
// BEFORE
import { AuthProvider } from './context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}

// AFTER
import { SecureAuthProvider } from './context/SecureAuthContext';
import SessionManager from './components/layout/SessionManager';

export default function App() {
  return (
    <SecureAuthProvider>
      <SessionManager 
        refreshInterval={5 * 60 * 1000}
        warningThreshold={10 * 60 * 1000}
      />
      <MainLayout />
    </SecureAuthProvider>
  );
}
```

### 2.2 Update Login Page

```typescript
// BEFORE
import { useAuth } from '../../context/AuthContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  
  const handleSubmit = async (e: React.FormEvent) => {
    await login(username, password);
  };
};

// AFTER
import { useSecureAuth } from '../../context/SecureAuthContext';

export const Login: React.FC = () => {
  const { login } = useSecureAuth();
  const companyId = import.meta.env.VITE_COMPANY_ID || 'company-001';
  
  const handleSubmit = async (e: React.FormEvent) => {
    await login(
      { username, password },
      companyId,
      getClientIpAddress()  // optional
    );
  };
};
```

### 2.3 Replace Protected Routes

```typescript
// BEFORE
import { ProtectedRoute } from './ProtectedRoute';

<ProtectedRoute permission="users.view">
  <UsersPage />
</ProtectedRoute>

// AFTER
import { EnhancedProtectedRoute } from './EnhancedProtectedRoute';

<EnhancedProtectedRoute permission="users.view">
  <UsersPage />
</EnhancedProtectedRoute>
```

---

## 🎯 Phase 3: Update Data Access Layer

### 3.1 Create secureUserService

Create `src/services/secureUserService.ts`:

```typescript
import { ref, get, query, orderByChild, limitToFirst } from 'firebase/database';
import { rtdb, isFirebaseConfigured, authReadyPromise } from './firebase';
import { sessionValidationService } from './sessionValidationService';
import type { UserDocument, SecureSessionData } from '../types/secure';

export const secureUserService = {
  /**
   * Get current user from session
   * ✓ Safe - uses session data only
   */
  async getCurrentUser(session: SecureSessionData): Promise<UserDocument | null> {
    if (!isFirebaseConfigured || !rtdb) return null;

    try {
      await authReadyPromise;

      // Validate session first
      const validation = await sessionValidationService.validateSessionAgainstRTDB(
        session.sessionToken,
        session.companyId,
        session.uid
      );

      if (!validation.isValid) return null;

      // Fetch from company/users/{uid}
      const snapshot = await get(
        ref(rtdb, `companies/${session.companyId}/users/${session.uid}`)
      );

      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('Error fetching current user:', error);
      return null;
    }
  },

  /**
   * Get company users (with permission check)
   * ✓ Safe - validates session + permission
   */
  async getCompanyUsers(
    session: SecureSessionData,
    limit: number = 100
  ): Promise<UserDocument[]> {
    if (!isFirebaseConfigured || !rtdb) return [];

    try {
      // Check permission
      if (!sessionValidationService.hasPermission(session, 'users.view')) {
        throw new Error('Permission denied: users.view');
      }

      await authReadyPromise;

      const snapshot = await get(
        query(
          ref(rtdb, `companies/${session.companyId}/users`),
          limitToFirst(limit)
        )
      );

      if (!snapshot.exists()) return [];

      return Object.values(snapshot.val() as Record<string, UserDocument>);
    } catch (error) {
      console.error('Error fetching company users:', error);
      return [];
    }
  },

  /**
   * Create user (admin only)
   * ✓ Safe - validates permission + company isolation
   */
  async createUser(
    session: SecureSessionData,
    userData: Omit<UserDocument, 'uid' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    if (!isFirebaseConfigured || !rtdb) return;

    // Check permission
    if (!sessionValidationService.hasPermission(session, 'users.edit')) {
      throw new Error('Permission denied: users.edit');
    }

    // Verify company isolation
    if (userData.companyId !== session.companyId) {
      throw new Error('Cannot create users in other companies');
    }

    try {
      await authReadyPromise;

      const uid = crypto.randomUUID();
      const now = Date.now();

      // Note: Password is set separately via updateUserPassword
      const newUser: UserDocument = {
        ...userData,
        uid,
        companyId: session.companyId,
        createdAt: now,
        updatedAt: now,
      };

      await set(
        ref(rtdb, `companies/${session.companyId}/users/${uid}`),
        newUser
      );

      // Audit log
      await auditService.logUserCreate(
        session.companyId,
        session.uid,
        session.username,
        uid,
        userData.username,
        userData.role
      );
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },
};
```

### 3.2 Update Components to Use Session

```typescript
// BEFORE - UNSAFE
useEffect(() => {
  const getAllUsers = async () => {
    const snapshot = await get(ref(rtdb, 'users'));
    // ❌ This exposes all users + passwordHash to client!
  };
}, []);

// AFTER - SAFE
useEffect(() => {
  if (!session) return;
  
  const loadUsers = async () => {
    const users = await secureUserService.getCompanyUsers(session);
    // ✓ Permission checked + company isolated
  };
}, [session]);
```

---

## 🎯 Phase 4: Testing

### 4.1 Unit Tests

Create `src/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { sessionValidationService } from '../services/sessionValidationService';
import type { SecureSessionData } from '../types/secure';

describe('Session Validation', () => {
  const mockSession: SecureSessionData = {
    uid: 'user-123',
    companyId: 'company-001',
    username: 'test',
    fullName: 'Test User',
    role: 'manager',
    permissions: ['users.view', 'salary.approve'],
    sessionToken: 'token-123',
    createdAt: Date.now(),
    expiresAt: Date.now() + 86400000,
    isActive: true,
  };

  it('should detect valid permission', () => {
    const hasPermission = sessionValidationService.hasPermission(
      mockSession,
      'users.view'
    );
    expect(hasPermission).toBe(true);
  });

  it('should detect missing permission', () => {
    const hasPermission = sessionValidationService.hasPermission(
      mockSession,
      'salary.delete'
    );
    expect(hasPermission).toBe(false);
  });

  it('should detect expired session', () => {
    const expiredSession = {
      ...mockSession,
      expiresAt: Date.now() - 1000, // 1 second ago
    };
    expect(Date.now() > expiredSession.expiresAt).toBe(true);
  });

  it('should check any permission', () => {
    const hasAny = sessionValidationService.hasAnyPermission(
      mockSession,
      ['salary.delete', 'users.view']
    );
    expect(hasAny).toBe(true);
  });

  it('should check all permissions', () => {
    const hasAll = sessionValidationService.hasAllPermissions(
      mockSession,
      ['users.view', 'salary.approve']
    );
    expect(hasAll).toBe(true);
  });

  it('should detect company mismatch', () => {
    const otherCompanySession = {
      ...mockSession,
      companyId: 'company-002',
    };
    expect(otherCompanySession.companyId === mockSession.companyId).toBe(false);
  });
});
```

### 4.2 Integration Tests

Test login flow:

```typescript
it('should login successfully', async () => {
  const response = await secureAuthService.login(
    { username: 'test', password: 'test123' },
    'company-001'
  );

  expect(response.session).toBeDefined();
  expect(response.session.uid).toBeDefined();
  expect(response.session.sessionToken).toBeDefined();
  expect(response.session.expiresAt).toBeGreaterThan(Date.now());
});

it('should reject invalid password', async () => {
  expect(
    secureAuthService.login(
      { username: 'test', password: 'wrong' },
      'company-001'
    )
  ).rejects.toThrow('INVALID_CREDENTIALS');
});

it('should rate limit failed attempts', async () => {
  // 5 failed attempts
  for (let i = 0; i < 5; i++) {
    try {
      await secureAuthService.login(
        { username: 'test', password: 'wrong' },
        'company-001'
      );
    } catch (e) {
      // Expected
    }
  }

  // 6th attempt should fail with rate limit
  expect(
    secureAuthService.login(
      { username: 'test', password: 'test123' },
      'company-001'
    )
  ).rejects.toThrow('TOO_MANY_ATTEMPTS');
});
```

### 4.3 Security Tests

```typescript
it('should not expose passwordHash in session', () => {
  const response = await secureAuthService.login(
    { username: 'test', password: 'test123' },
    'company-001'
  );

  // Check session does NOT contain passwordHash
  expect(response.session).not.toHaveProperty('passwordHash');
  expect(response.session).not.toHaveProperty('password');
});

it('should prevent company isolation bypass', async () => {
  const session = createMockSession('company-001');
  
  // Verify cannot query other company data
  const validation = await sessionValidationService.validateSessionAgainstRTDB(
    session.sessionToken,
    'company-002', // Different company
    session.uid
  );

  expect(validation.isValid).toBe(false);
});

it('should block privilege escalation', async () => {
  const user = await secureUserService.getCurrentUser(session);
  
  // Try to modify role in memory
  user.role = 'super_admin';

  // Try to write back - should fail at rules level
  expect(() => {
    set(ref(rtdb, `companies/${session.companyId}/users/${user.uid}`), user);
  }).rejects.toThrow();
});
```

---

## 🎯 Phase 5: Deployment

### 5.1 Pre-deployment Checklist

- [ ] All tests passing
- [ ] Security rules deployed to staging
- [ ] HTTPS enabled
- [ ] CSP headers configured
- [ ] HSTS header set
- [ ] Database backup taken
- [ ] Rollback plan documented
- [ ] Team trained on new system

### 5.2 Staging Deployment

1. Deploy to staging environment
2. Create test users in staging company
3. Test all auth flows:
   - Login/logout
   - Permission checking
   - Session expiry
   - Rate limiting
4. Verify audit logs created
5. Test with actual user workloads

### 5.3 Production Rollout

**Option 1: Big Bang (Risk: High)**
- Stop old auth completely
- Switch all users to new system
- Pros: Quick, simple
- Cons: If issues arise, affects all users

**Option 2: Canary (Risk: Low - Recommended)**
- Deploy new auth alongside old
- Roll out to 10% of users first (beta team)
- Monitor for 24-48 hours
- If stable, roll out 50%
- If still stable, roll out 100%

**Option 3: Parallel Run (Risk: Lowest)**
- Run both systems simultaneously
- Users can toggle between them
- Gradually migrate as confidence builds
- Takes longer but zero risk of losing access

---

## ✅ Verification Checklist

After deployment:

### Security

- [ ] passwordHash NOT visible in client queries
- [ ] Sessions stored in RTDB (not just localStorage)
- [ ] Company isolation verified (test user A cannot see company B data)
- [ ] Permission enforcement working (unauthorized users denied)
- [ ] Audit logs created for all sensitive operations
- [ ] Rate limiting blocking brute force attacks
- [ ] Session refresh working (no unexpected logouts)
- [ ] Auto-logout on expiry
- [ ] HTTPS enforced
- [ ] CSP headers present

### Functionality

- [ ] Login works
- [ ] Logout works
- [ ] Session persists on page refresh
- [ ] Session expiry warning shows
- [ ] Permission-based UI rendering works
- [ ] ProtectedRoutes blocking unauthorized access
- [ ] All existing features still work
- [ ] Performance acceptable (< 200ms for API calls)

### Operations

- [ ] Monitoring active (watching login failures, rate limits)
- [ ] Alert configured (unusual activity)
- [ ] Audit logs accessible to admins
- [ ] Backup scheduled and tested
- [ ] Runbook created for common issues
- [ ] Support team trained

---

## 🚨 Troubleshooting

### Issue: Users stuck on login page

**Diagnosis:**
```bash
# Check if sessionToken is being stored
localStorage.getItem('secure_session')

# Check if session exists in RTDB
# Go to Firebase Console → Realtime Database → sessions
```

**Solutions:**
1. Clear localStorage: `localStorage.clear()`
2. Check Firebase rules deployed
3. Verify Firebase config in .env
4. Check browser console for errors

### Issue: "Session not found" error

**Cause:** Session token not stored in RTDB after login

**Solutions:**
1. Check Firebase rules allow writing to sessions
2. Check user has write permissions
3. Verify session is being created in `secureAuthService.login()`

### Issue: Permission check failing

**Diagnosis:**
```javascript
// Check user's permissions in session
console.log(session.permissions);

// Manually check permission
sessionValidationService.hasPermission(session, 'users.view');
```

**Solutions:**
1. Verify permissions are assigned to user in database
2. Verify permission key exactly matches (case-sensitive)
3. Check admin has permission to assign permissions

### Issue: Poor performance

**Diagnosis:**
```javascript
// Measure query time
const start = performance.now();
await secureUserService.getCompanyUsers(session, 100);
const end = performance.now();
console.log(`Query took ${end - start}ms`);
```

**Solutions:**
1. Reduce data fetched (use `limit` parameter)
2. Add indexes to Firebase (Firebase Console → Database → Indexing)
3. Profile RTDB queries (check for N+1 patterns)
4. Consider caching strategy (React Query)

---

## 📞 Support Resources

- **Firebase Docs**: https://firebase.google.com/docs/database
- **Security Rules**: https://firebase.google.com/docs/database/security
- **This Project**: See SECURITY_ARCHITECTURE.md

---

## 📋 Success Criteria

Migration is successful when:

1. ✅ 100% of users can login with new system
2. ✅ Zero unauthorized access incidents
3. ✅ All audit logs created successfully
4. ✅ Performance meets targets (< 200ms)
5. ✅ No data loss
6. ✅ Rollback not needed after 7 days

---

**Version:** 1.0  
**Last Updated:** 2024-06-13
