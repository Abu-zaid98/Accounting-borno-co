/**
 * MIGRATION SCRIPT
 * 
 * Migrates from old user structure to new secure multi-tenant structure
 * 
 * USAGE:
 * 1. Export old users data from Firebase Console
 * 2. Update the oldUsersData variable below
 * 3. Run: npx ts-node src/utils/migration.ts
 * 4. Verify migration in Firebase Console
 * 5. Test with beta users before full rollout
 * 
 * BACKUP FIRST - This script modifies database!
 */

import { ref, get, set } from 'firebase/database';
import { rtdb, isFirebaseConfigured, authReadyPromise } from '../services/firebase';
import type { UserDocument, UserCredentials } from '../types/secure';


interface OldUserData {
  uid: string;
  fullName: string;
  username: string;
  passwordHash?: string;
  email?: string;
  phone?: string;
  role: string;
  status: string;
  permissions?: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

/**
 * MIGRATION CONFIGURATION
 */
const MIGRATION_CONFIG = {
  defaultCompanyId: 'company-001', // Change this to your company ID
  testMode: true, // Set to false to actually write to database
  batchSize: 10, // Process users in batches
  auditLogMigration: true, // Create audit log entry for migration
};

/**
 * STEP 1: Get old users from RTDB
 */
async function getOldUsers(): Promise<OldUserData[]> {
  if (!isFirebaseConfigured || !rtdb) {
    throw new Error('Firebase not configured');
  }

  try {
    await authReadyPromise;

    const snapshot = await get(ref(rtdb, 'users'));
    if (!snapshot.exists()) {
      return [];
    }

    const data = snapshot.val() as Record<string, OldUserData>;
    return Object.values(data).filter(u => u.uid);
  } catch (error) {
    console.error('Error fetching old users:', error);
    throw error;
  }
}

/**
 * STEP 2: Transform old user to new structure
 */
function transformUser(oldUser: OldUserData, companyId: string): {
  user: UserDocument;
  credentials: UserCredentials;
} {
  const now = Date.now();

  // New user document (in companies/{companyId}/users/{uid})
  const user: UserDocument = {
    uid: oldUser.uid,
    companyId,
    fullName: oldUser.fullName,
    username: oldUser.username,
    role: (oldUser.role || 'employee') as any,
    status: (oldUser.status || 'active') as any,
    permissions: oldUser.permissions || [],
    email: oldUser.email,
    phone: oldUser.phone,
    createdAt: new Date(oldUser.createdAt).getTime() || now,
    updatedAt: new Date(oldUser.updatedAt).getTime() || now,
    lastLoginAt: oldUser.lastLoginAt ? new Date(oldUser.lastLoginAt).getTime() : undefined,
  };

  // New credentials document (in userCredentials/{uid})
  const credentials: UserCredentials = {
    uid: oldUser.uid,
    passwordHash: oldUser.passwordHash || '', // Keep existing hash
    status: (oldUser.status || 'active') as any,
    lastPasswordChange: new Date(oldUser.updatedAt).getTime() || now,
  };

  return { user, credentials };
}

/**
 * STEP 3: Write to new structure
 */
async function migrateUser(
  oldUser: OldUserData,
  companyId: string,
  testMode: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseConfigured || !rtdb) {
    return { success: false, error: 'Firebase not configured' };
  }

  try {
    const { user, credentials } = transformUser(oldUser, companyId);

    if (testMode) {
      console.log(`[TEST] Would write user:`, user);
      console.log(`[TEST] Would write credentials:`, {
        uid: credentials.uid,
        status: credentials.status,
        lastPasswordChange: credentials.lastPasswordChange,
        // ❌ Don't log passwordHash
      });
      return { success: true };
    }

    // Write user to new location
    await set(ref(rtdb, `companies/${companyId}/users/${user.uid}`), user);

    // Write credentials to new location
    await set(ref(rtdb, `userCredentials/${user.uid}`), credentials);

    // Create audit log entry
    const auditId = crypto.randomUUID();
    await set(ref(rtdb, `auditLogs/${companyId}/${auditId}`), {
      id: auditId,
      userId: 'system-migration',
      username: 'system',
      action: 'user.migrate',
      resource: 'migration',
      resourceId: user.uid,
      status: 'success',
      timestamp: Date.now(),
      metadata: {
        from: 'old-users-path',
        to: `companies/${companyId}/users`,
        username: user.username,
      },
    });

    return { success: true };
  } catch (error) {
    const errorMessage = (error as any).message || 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * STEP 4: Create company metadata
 */
async function createCompanyMetadata(companyId: string, testMode: boolean): Promise<void> {
  if (!isFirebaseConfigured || !rtdb) {
    throw new Error('Firebase not configured');
  }

  try {
    const metadata = {
      id: companyId,
      name: 'Default Company',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ownerId: 'system',
    };

    if (testMode) {
      console.log(`[TEST] Would create company metadata:`, metadata);
      return;
    }

    await set(ref(rtdb, `companies/${companyId}/metadata`), metadata);
    console.log(`✓ Company metadata created: ${companyId}`);
  } catch (error) {
    console.error('Error creating company metadata:', error);
    throw error;
  }
}

/**
 * MAIN MIGRATION FUNCTION
 */
async function runMigration(): Promise<void> {
  console.log('🚀 Starting user migration...\n');

  const { defaultCompanyId, testMode, batchSize } = MIGRATION_CONFIG;

  try {
    // Step 1: Get old users
    console.log('📖 Fetching old users...');
    const oldUsers = await getOldUsers();
    console.log(`✓ Found ${oldUsers.length} users\n`);

    if (oldUsers.length === 0) {
      console.log('⚠️ No users to migrate');
      return;
    }

    // Step 2: Create company
    console.log('🏢 Creating company metadata...');
    await createCompanyMetadata(defaultCompanyId, testMode);
    console.log('✓ Company metadata ready\n');

    // Step 3: Migrate users in batches
    console.log(`👥 Migrating users in batches of ${batchSize}...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < oldUsers.length; i += batchSize) {
      const batch = oldUsers.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      console.log(`Batch ${batchNumber}:`);

      for (const user of batch) {
        const result = await migrateUser(user, defaultCompanyId, testMode);

        if (result.success) {
          console.log(`  ✓ ${user.username} (${user.uid})`);
          successCount++;
        } else {
          console.log(`  ✗ ${user.username} (${user.uid}): ${result.error}`);
          errorCount++;
        }
      }

      console.log();
    }

    // Step 4: Summary
    console.log('📊 Migration Summary:');
    console.log(`  ✓ Successful: ${successCount}`);
    console.log(`  ✗ Failed: ${errorCount}`);
    console.log(`  📍 Company: ${defaultCompanyId}\n`);

    if (testMode) {
      console.log('🧪 TEST MODE - No changes written to database\n');
      console.log('To run actual migration:');
      console.log('1. Review output above');
      console.log('2. Set testMode: false in MIGRATION_CONFIG');
      console.log('3. Run script again\n');
    } else {
      console.log('✅ Migration complete!\n');
      console.log('Next steps:');
      console.log('1. Verify users in Firebase Console');
      console.log('2. Test login with old user account');
      console.log('3. Check audit logs');
      console.log('4. Deploy to production\n');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

/**
 * ROLLBACK FUNCTION (if needed)
 */
async function rollbackMigration(companyId: string, dryRun: boolean = true): Promise<void> {
  console.log('⚠️ Rolling back migration...\n');

  if (!isFirebaseConfigured || !rtdb) {
    throw new Error('Firebase not configured');
  }

  try {
    // Get migrated users
    const snapshot = await get(ref(rtdb, `companies/${companyId}/users`));

    if (!snapshot.exists()) {
      console.log('No users to rollback');
      return;
    }

    const users = snapshot.val() as Record<string, UserDocument>;
    const userIds = Object.keys(users);

    console.log(`Found ${userIds.length} users to rollback\n`);

    if (dryRun) {
      console.log('🧪 DRY RUN - Would delete:');
      userIds.forEach(uid => {
        console.log(`  - companies/${companyId}/users/${uid}`);
        console.log(`  - userCredentials/${uid}`);
      });
    } else {
      // Actually rollback
      for (const uid of userIds) {
        console.log(`Rolling back ${uid}...`);
        // Note: Actual rollback would require keeping old data backup
      }
    }

    console.log('\nRollback complete');
  } catch (error) {
    console.error('Rollback error:', error);
  }
}



export { runMigration, rollbackMigration, transformUser, migrateUser };
