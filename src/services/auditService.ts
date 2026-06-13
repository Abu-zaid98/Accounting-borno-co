/**
 * AUDIT LOGGING SERVICE
 * 
 * Handles:
 * - Logging all sensitive operations
 * - Creating audit trail for compliance
 * - Tracking unauthorized attempts
 * 
 * For ERP/accounting systems: CRITICAL for compliance
 */

import { ref, set } from 'firebase/database';
import { rtdb, isFirebaseConfigured, authReadyPromise } from './firebase';
import type { AuditLogEntry } from '../types/secure';

export const auditService = {
  /**
   * LOG EVENT
   * Records audit trail entry
   */
  async logEvent(event: Omit<AuditLogEntry, 'id'>): Promise<void> {
    if (!isFirebaseConfigured || !rtdb) {
      console.warn('Audit logging unavailable - Firebase not configured');
      return;
    }

    try {
      await authReadyPromise;

      const logId = crypto.randomUUID();
      const logEntry: AuditLogEntry = {
        id: logId,
        ...event
      };

      await set(
        ref(rtdb, `auditLogs/${event.companyId}/${logId}`),
        logEntry
      );

      console.debug(`[AUDIT] ${event.action} - ${event.status}`, event);
    } catch (error) {
      console.error('Error writing audit log:', error);
      // Do not throw - audit logging should not break app
    }
  },

  /**
   * LOG LOGIN
   */
  async logLogin(companyId: string, userId: string, username: string, success: boolean, ipAddress?: string): Promise<void> {
    await this.logEvent({
      companyId,
      userId,
      username,
      action: 'login',
      resource: 'authentication',
      status: success ? 'success' : 'failed',
      timestamp: Date.now(),
      ipAddress,
      metadata: {
        success,
        loginTime: new Date().toISOString()
      }
    });
  },

  /**
   * LOG LOGOUT
   */
  async logLogout(companyId: string, userId: string, username: string, ipAddress?: string): Promise<void> {
    await this.logEvent({
      companyId,
      userId,
      username,
      action: 'logout',
      resource: 'authentication',
      status: 'success',
      timestamp: Date.now(),
      ipAddress,
      metadata: {
        logoutTime: new Date().toISOString()
      }
    });
  },

  /**
   * LOG USER CREATE
   */
  async logUserCreate(
    companyId: string,
    actorUid: string,
    actorUsername: string,
    newUserId: string,
    newUsername: string,
    role: string
  ): Promise<void> {
    await this.logEvent({
      companyId,
      userId: actorUid,
      username: actorUsername,
      action: 'user.create',
      resource: 'users',
      resourceId: newUserId,
      status: 'success',
      timestamp: Date.now(),
      metadata: {
        createdUser: newUsername,
        role,
        timestamp: new Date().toISOString()
      }
    });
  },

  /**
   * LOG USER UPDATE
   */
  async logUserUpdate(
    companyId: string,
    actorUid: string,
    actorUsername: string,
    targetUserId: string,
    targetUsername: string,
    changes: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      companyId,
      userId: actorUid,
      username: actorUsername,
      action: 'user.update',
      resource: 'users',
      resourceId: targetUserId,
      status: 'success',
      timestamp: Date.now(),
      changes: {
        after: changes
      },
      metadata: {
        targetUser: targetUsername,
        changedFields: Object.keys(changes),
        timestamp: new Date().toISOString()
      }
    });
  },

  /**
   * LOG SALARY ACTION
   */
  async logSalaryAction(
    companyId: string,
    actorUid: string,
    actorUsername: string,
    action: 'salary.view' | 'salary.approve' | 'salary.pay',
    salaryId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      companyId,
      userId: actorUid,
      username: actorUsername,
      action,
      resource: 'salaries',
      resourceId: salaryId,
      status: 'success',
      timestamp: Date.now(),
      metadata: {
        salaryId,
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  },

  /**
   * LOG ATTENDANCE ACTION
   */
  async logAttendanceAction(
    companyId: string,
    actorUid: string,
    actorUsername: string,
    action: 'attendance.mark' | 'attendance.delete',
    attendanceId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      companyId,
      userId: actorUid,
      username: actorUsername,
      action,
      resource: 'attendance',
      resourceId: attendanceId,
      status: 'success',
      timestamp: Date.now(),
      metadata: {
        attendanceId,
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  },

  /**
   * LOG UNAUTHORIZED ATTEMPT
   */
  async logUnauthorizedAttempt(
    companyId: string,
    userId: string,
    username: string,
    action: string,
    resource: string,
    reason: string,
    ipAddress?: string
  ): Promise<void> {
    await this.logEvent({
      companyId,
      userId,
      username,
      action: 'unauthorized_attempt',
      resource,
      status: 'failed',
      timestamp: Date.now(),
      ipAddress,
      metadata: {
        attemptedAction: action,
        reason,
        timestamp: new Date().toISOString()
      }
    });
  },

  /**
   * LOG PERMISSION CHANGE
   */
  async logPermissionChange(
    companyId: string,
    actorUid: string,
    actorUsername: string,
    targetUserId: string,
    targetUsername: string,
    oldPermissions: string[],
    newPermissions: string[]
  ): Promise<void> {
    await this.logEvent({
      companyId,
      userId: actorUid,
      username: actorUsername,
      action: 'permission.change',
      resource: 'permissions',
      resourceId: targetUserId,
      status: 'success',
      timestamp: Date.now(),
      changes: {
        before: { permissions: oldPermissions },
        after: { permissions: newPermissions }
      },
      metadata: {
        targetUser: targetUsername,
        permissionsAdded: newPermissions.filter(p => !oldPermissions.includes(p)),
        permissionsRemoved: oldPermissions.filter(p => !newPermissions.includes(p)),
        timestamp: new Date().toISOString()
      }
    });
  },

  /**
   * LOG ROLE CHANGE
   */
  async logRoleChange(
    companyId: string,
    actorUid: string,
    actorUsername: string,
    targetUserId: string,
    targetUsername: string,
    oldRole: string,
    newRole: string
  ): Promise<void> {
    await this.logEvent({
      companyId,
      userId: actorUid,
      username: actorUsername,
      action: 'role.change',
      resource: 'users',
      resourceId: targetUserId,
      status: 'success',
      timestamp: Date.now(),
      changes: {
        before: { role: oldRole },
        after: { role: newRole }
      },
      metadata: {
        targetUser: targetUsername,
        oldRole,
        newRole,
        timestamp: new Date().toISOString()
      }
    });
  }
};
