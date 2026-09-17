export interface User {
  id: string;
  name: string;
  email: string;
  role: 'OWNER';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: User;
}

export interface LogoutResponse {
  message: string;
}
