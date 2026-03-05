export const testConfig = {
  baseURL: 'http://localhost:5173',
  timeout: 30000,
  navigationTimeout: 60000,
};

export const testUser = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'test123456',
};

export const selectors = {
  loginPage: {
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    loginButton: 'button[type="submit"]',
    registerLink: 'a[href="/register"]',
    errorMessage: '.bg-red-100, .dark\\:bg-red-900\\/30',
    themeButton: 'button[title*="切换"]',
  },
  registerPage: {
    nameInput: 'input[name="name"]',
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    registerButton: 'button[type="submit"]',
    loginLink: 'a[href="/login"]',
    errorMessage: '.bg-red-100, .dark\\:bg-red-900\\/30',
    themeButton: 'button[title*="切换"]',
  },
  dashboard: {
    title: /dashboard/i,
    searchInput: 'input[placeholder*="搜索"]',
    newGraphButton: 'button:has-text("新建图谱")',
    aiGenerateButton: 'button:has-text("AI 生成")',
    graphCards: '[class*="group relative rounded-2xl"]',
    themeButton: 'button[title*="切换"]',
    emptyState: 'text=开始您的知识之旅',
    graphTitleInput: 'input[placeholder*="例如"]',
    graphDescriptionInput: 'textarea[placeholder*="描述"]',
    confirmCreateButton: 'button:has-text("立即创建")',
    cancelButton: 'button:has-text("取消")',
  },
};

export async function login(page: any, email: string, password: string) {
  await page.goto('/');
  await page.fill(selectors.loginPage.emailInput, email);
  await page.fill(selectors.loginPage.passwordInput, password);
  await page.click(selectors.loginPage.loginButton);
  await page.waitForURL(/\/dashboard/);
}

export async function createGraphViaAPI(page: any, title: string, description?: string) {
  const token = await page.evaluate(() => {
    return localStorage.getItem('sb-auth-token') || sessionStorage.getItem('sb-auth-token');
  });
  
  const response = await page.request.post('http://localhost:5173/api/graphs', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      title,
      description: description || '',
    },
  });
  
  if (!response.ok()) {
    const text = await response.text();
    if (text.includes('CSRF token missing')) {
      throw new Error('CSRF token required, using UI instead');
    }
    throw new Error(`Failed to create graph: ${text}`);
  }
  
  const data = await response.json();
  return data.id;
}

export async function createGraphViaSupabase(page: any, title: string, description?: string) {
  const supabaseUrl = 'http://127.0.0.1:54321';
  const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
  
  const userId = await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.id;
  });
  
  const response = await page.request.post(`${supabaseUrl}/rest/v1/knowledge_graphs`, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    data: {
      title,
      description: description || '',
      user_id: userId,
    },
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to create graph via Supabase: ${await response.text()}`);
  }
  
  const data = await response.json();
  return data[0].id;
}

export async function createNodeViaAPI(page: any, graphId: string, title: string, content?: string, level?: string) {
  const supabaseUrl = 'http://127.0.0.1:54321';
  const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
  
  const userId = await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.id;
  });
  
  const response = await page.request.post(`${supabaseUrl}/rest/v1/knowledge_points`, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    data: {
      title,
      content: content || '',
      owner_id: userId,
      visibility: 'private',
    },
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to create knowledge point via Supabase: ${await response.text()}`);
  }
  
  const kpData = await response.json();
  const kpId = kpData[0].id;
  
  const graphNodeResponse = await page.request.post(`${supabaseUrl}/rest/v1/graph_nodes`, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    data: {
      graph_id: graphId,
      knowledge_point_id: kpId,
      level: level || 'normal',
      x_position: 400,
      y_position: 300,
      is_accepted: true,
    },
  });
  
  if (!graphNodeResponse.ok()) {
    throw new Error(`Failed to create graph node via Supabase: ${await graphNodeResponse.text()}`);
  }
  
  const graphNodeData = await graphNodeResponse.json();
  return graphNodeData[0].knowledge_point_id;
}

export async function getNodesViaAPI(page: any, graphId: string) {
  const supabaseUrl = 'http://127.0.0.1:54321';
  const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

  const response = await page.request.get(`${supabaseUrl}/rest/v1/graph_nodes?graph_id=eq.${graphId}&select=*,knowledge_points(id,title,content)`, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to get nodes via Supabase: ${await response.text()}`);
  }

  return await response.json();
}

export async function waitForElement(page: any, selector: string, timeout: number = testConfig.timeout) {
  await page.waitForSelector(selector, { timeout });
}
