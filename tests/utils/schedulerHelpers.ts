import { Page, APIRequestContext } from '@playwright/test';
import { SchedulerPage } from '../pages/SchedulerPage';

export interface TestTask {
  id: string;
  title: string;
  description?: string;
  queue_level: number;
  estimated_duration?: number;
  priority?: number;
  tags?: string[];
}

const API_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';

export async function login(
  page: Page,
  email: string = process.env.TEST_USER_EMAIL || 'test@example.com',
  password: string = process.env.TEST_USER_PASSWORD || 'test123456'
): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  const passwordInput = page.locator('input[type="password"], input[name="password"]');
  const submitButton = page.locator('button[type="submit"]');
  
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await submitButton.click();
  
  await page.waitForURL('/', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

export async function createTestTask(
  request: APIRequestContext,
  authToken: string,
  task: Partial<TestTask>
): Promise<TestTask> {
  const response = await request.post(`${API_URL}/rest/v1/scheduled_tasks`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'apikey': process.env.VITE_SUPABASE_ANON_KEY || '',
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    data: {
      title: task.title || `测试任务 ${Date.now()}`,
      description: task.description || '这是一个测试任务',
      queue_level: task.queue_level ?? 2,
      estimated_duration: task.estimated_duration ?? 30,
      priority: task.priority ?? 1,
      tags: task.tags || [],
      status: 'pending',
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create task: ${response.status()} ${await response.text()}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data[0] : data;
}

export async function deleteTestTask(
  request: APIRequestContext,
  authToken: string,
  taskId: string
): Promise<void> {
  await request.delete(`${API_URL}/rest/v1/scheduled_tasks?id=eq.${taskId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'apikey': process.env.VITE_SUPABASE_ANON_KEY || '',
    },
  });
}

export async function deleteAllTestTasks(
  request: APIRequestContext,
  authToken: string,
  titlePrefix: string = '测试任务'
): Promise<void> {
  await request.delete(`${API_URL}/rest/v1/scheduled_tasks?title=like.${titlePrefix}*`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'apikey': process.env.VITE_SUPABASE_ANON_KEY || '',
    },
  });
}

export async function getTasksInQueue(
  request: APIRequestContext,
  authToken: string,
  queueLevel: number
): Promise<TestTask[]> {
  const response = await request.get(
    `${API_URL}/rest/v1/scheduled_tasks?queue_level=eq.${queueLevel}&select=*&order=position.asc`,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'apikey': process.env.VITE_SUPABASE_ANON_KEY || '',
      },
    }
  );

  if (!response.ok()) {
    return [];
  }

  return response.json();
}

export async function getTaskById(
  request: APIRequestContext,
  authToken: string,
  taskId: string
): Promise<TestTask | null> {
  const response = await request.get(
    `${API_URL}/rest/v1/scheduled_tasks?id=eq.${taskId}&select=*`,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'apikey': process.env.VITE_SUPABASE_ANON_KEY || '',
      },
    }
  );

  if (!response.ok()) {
    return null;
  }

  const data = await response.json();
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function verifyTaskInQueue(
  schedulerPage: SchedulerPage,
  taskTitle: string,
  queueLevel: number
): Promise<boolean> {
  try {
    await schedulerPage.assertTaskInQueue(taskTitle, queueLevel);
    return true;
  } catch {
    return false;
  }
}

export async function verifyTaskOrder(
  schedulerPage: SchedulerPage,
  queueLevel: number,
  expectedOrder: string[]
): Promise<boolean> {
  const actualOrder = await schedulerPage.getTaskOrderInQueue(queueLevel);
  return JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);
}

export async function getAuthToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const authCookie = cookies.find(c => c.name.includes('auth') || c.name.includes('token'));
  
  if (authCookie) {
    return authCookie.value;
  }
  
  const localStorage = await page.evaluate(() => {
    const items: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) {
        items[key] = window.localStorage.getItem(key) || '';
      }
    }
    return items;
  });
  
  for (const key of Object.keys(localStorage)) {
    if (key.includes('token') || key.includes('auth')) {
      try {
        const data = JSON.parse(localStorage[key]);
        return data.access_token || data.token || '';
      } catch {
        return localStorage[key];
      }
    }
  }
  
  return '';
}

export async function createMultipleTestTasks(
  request: APIRequestContext,
  authToken: string,
  count: number,
  queueLevel: number = 2
): Promise<TestTask[]> {
  const tasks: TestTask[] = [];
  
  for (let i = 0; i < count; i++) {
    const task = await createTestTask(request, authToken, {
      title: `测试任务 ${Date.now()}-${i}`,
      queue_level: queueLevel,
      estimated_duration: 30 + i * 10,
    });
    tasks.push(task);
  }
  
  return tasks;
}

export async function cleanupTestTasks(
  request: APIRequestContext,
  authToken: string,
  taskIds: string[]
): Promise<void> {
  for (const taskId of taskIds) {
    try {
      await deleteTestTask(request, authToken, taskId);
    } catch {
      // Ignore errors during cleanup
    }
  }
}

export function generateUniqueTaskTitle(): string {
  return `测试任务 ${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
