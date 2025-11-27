import { MockAuthService } from './MockAuthService';
import type { IAuthService } from './IAuthService';

/**
 * Current auth service implementation
 * 
 * This is the single export point for the auth service.
 * To switch implementations (e.g., to Descope), simply change this export:
 * 
 * import { DescopeAuthService } from './DescopeAuthService';
 * export const authService: IAuthService = new DescopeAuthService();
 */
export const authService: IAuthService = new MockAuthService();
