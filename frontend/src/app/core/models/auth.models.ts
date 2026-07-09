export type Role = 'FOUNDER' | 'DIRECTOR' | 'VIEWER';

export interface UserSession {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface UserAccount extends UserSession {
  enabled: boolean;
}

export interface AuthResponse {
  token: string;
  user: UserSession;
}
