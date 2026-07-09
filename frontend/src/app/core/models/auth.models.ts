export type Role = 'FOUNDER' | 'DIRECTOR' | 'VIEWER';

export interface UserSession {
  id: string;
  email: string;
  displayName: string;
  roles: Role[];
}

export interface AuthResponse {
  token: string;
  user: UserSession;
}
