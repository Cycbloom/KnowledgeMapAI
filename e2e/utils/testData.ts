export const testUsers = {
  owner: {
    email: 'test@example.com',
    password: 'test123456',
  },
  collaborator: {
    email: 'collaborator@example.com',
    password: 'test123456',
  },
};

export function generateUniqueGraphName() {
  return `测试图谱_${Date.now()}`;
}
