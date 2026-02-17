import { request } from './client';

export const authApi = {
  register: (data: { email: string; password: string; name?: string }) => 
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  
  login: (data: { email: string; password: string }) => 
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  
  logout: () => 
    request('/auth/logout', { method: 'POST' }),
  
  getUser: () => 
    request('/auth/user'),
  
  updateProfile: (data: { name?: string; avatar_url?: string; settings?: Record<string, unknown> }) => 
    request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
};
