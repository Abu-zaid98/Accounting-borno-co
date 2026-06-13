/**
 * ENHANCED PROTECTED ROUTE
 * 
 * Security Features:
 * ✓ Session validation against RTDB (not just localStorage)
 * ✓ Permission checking
 * ✓ Company isolation verification
 * ✓ Unauthorized access logging
 * ✓ Clear error messaging
 * ✓ Automatic logout on session expiry
 */

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useSecureAuth } from '../../context/SecureAuthContext';
import { sessionValidationService } from '../../services/sessionValidationService';
import { auditService } from '../../services/auditService';

interface EnhancedProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  roleRequired?: string;
}

/**
 * ENHANCED PROTECTED ROUTE COMPONENT
 * 
 * Validates:
 * 1. Session exists
 * 2. Session is valid (RTDB check)
 * 3. Session not expired
 * 4. User has required permissions
 * 5. User has required role
 * 6. Company isolation (user's company matches route's company)
 */
export const EnhancedProtectedRoute: React.FC<EnhancedProtectedRouteProps> = ({
  children,
  permission,
  permissions = [],
  requireAll = false,
  roleRequired
}) => {
  const { session, isLoading, logout, setError } = useSecureAuth();
  const location = useLocation();
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const validateAccess = async () => {
      setIsValidating(true);
      setValidationError(null);

      try {
        // 1. Check if authenticated
        if (!session) {
          setIsValidating(false);
          return;
        }

        // 2. Validate session against RTDB (real validation)
        const validation = await sessionValidationService.validateSessionAgainstRTDB(
          session.sessionToken,
          session.companyId,
          session.uid
        );

        if (!validation.isValid) {
          await auditService.logUnauthorizedAttempt(
            session.companyId,
            session.uid,
            session.username,
            'route_access',
            location.pathname,
            validation.error || 'Session validation failed'
          );

          setValidationError(validation.error || 'Session is invalid');
          await logout();
          setIsValidating(false);
          return;
        }

        // 3. Check role if required
        if (roleRequired && session.role !== roleRequired) {
          await auditService.logUnauthorizedAttempt(
            session.companyId,
            session.uid,
            session.username,
            'route_access',
            location.pathname,
            `Insufficient role: ${session.role}, required: ${roleRequired}`
          );

          setValidationError(`Access denied. Required role: ${roleRequired}`);
          setIsValidating(false);
          return;
        }

        // 4. Check permissions if required
        if (permission || permissions.length > 0) {
          const hasRequiredPermissions = () => {
            if (permission) {
              return sessionValidationService.hasPermission(session, permission);
            }

            if (permissions.length > 0) {
              return requireAll
                ? sessionValidationService.hasAllPermissions(session, permissions)
                : sessionValidationService.hasAnyPermission(session, permissions);
            }

            return true;
          };

          if (!hasRequiredPermissions()) {
            const requiredPerms = permission ? [permission] : permissions;
            await auditService.logUnauthorizedAttempt(
              session.companyId,
              session.uid,
              session.username,
              'route_access',
              location.pathname,
              `Missing permissions: ${requiredPerms.join(', ')}`
            );

            setValidationError(
              `Access denied. Required permissions: ${requiredPerms.join(', ')}`
            );
            setIsValidating(false);
            return;
          }
        }

        setIsValidating(false);
      } catch (error) {
        console.error('Error validating route access:', error);
        setValidationError('Failed to validate access');
        setIsValidating(false);
      }
    };

    if (!isLoading) {
      validateAccess();
    }
  }, [session, isLoading, location.pathname, permission, permissions, requireAll, roleRequired, logout, setError]);

  // Loading state
  if (isLoading || isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-slate-600 font-medium">Validating access...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Validation error - show unauthorized message
  if (validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-200 p-8">
          {/* Error Icon */}
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-6">
            <ShieldAlert size={36} />
          </div>

          {/* Error Title */}
          <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
            Access Denied
          </h2>

          {/* Error Message */}
          <p className="text-slate-600 text-center mb-6 leading-relaxed">
            {validationError}
          </p>

          {/* Error Details (for debugging - remove in production if needed) */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-xs text-red-700">
              <strong>Route:</strong> {location.pathname}
            </p>
            {permission && (
              <p className="text-xs text-red-700">
                <strong>Required Permission:</strong> {permission}
              </p>
            )}
            {permissions.length > 0 && (
              <p className="text-xs text-red-700">
                <strong>Required Permissions:</strong> {permissions.join(', ')}
              </p>
            )}
            {roleRequired && (
              <p className="text-xs text-red-700">
                <strong>Required Role:</strong> {roleRequired}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => window.history.back()}
              className="w-full px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium transition-colors"
            >
              Go Back
            </button>

            <button
              onClick={() => {
                logout();
                window.location.href = '/login';
              }}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <LogOut size={18} />
              Logout & Login Again
            </button>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-slate-500 text-center mt-6">
            If you believe this is a mistake, please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  // All checks passed - render children
  return <>{children}</>;
};
