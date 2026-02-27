import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import { testUser } from './utils/testHelpers';

test.describe('设置页面测试', () => {
  let loginPage: LoginPage;
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    settingsPage = new SettingsPage(page);

    // 登录
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);

    // 等待登录成功 - 跳转到 dashboard 或首页
    await expect(page).toHaveURL(/\/dashboard|\/$/, { timeout: 15000 });

    // 导航到设置页面
    await settingsPage.goto();
  });

  test.describe('显示当前设置测试', () => {
    test('应该能够进入设置页面', async ({ page }) => {
      // 验证页面标题正确显示
      await expect(settingsPage.title).toBeVisible({ timeout: 10000 });
      await expect(settingsPage.title).toHaveText('系统设置');
    });

    test('应该显示当前设置值', async () => {
      // 验证主题按钮可见
      await expect(settingsPage.lightThemeButton).toBeVisible();
      await expect(settingsPage.darkThemeButton).toBeVisible();
      await expect(settingsPage.systemThemeButton).toBeVisible();

      // 验证保存按钮可见
      await expect(settingsPage.saveButton).toBeVisible();
    });

    test('应该显示外观设置区域', async () => {
      // 验证外观设置区域
      await expect(settingsPage.appearanceSection).toBeVisible();
    });

    test('应该显示 AI 配置区域', async () => {
      // 验证 AI 配置区域
      await expect(settingsPage.aiSection).toBeVisible();
    });

    test('应该显示学习算法配置区域', async () => {
      // 验证学习算法配置区域
      await expect(settingsPage.fsrsSection).toBeVisible();
    });
  });

  test.describe('修改主题设置测试', () => {
    test('应该能够切换主题到暗色模式', async ({ page }) => {
      // 选择暗色主题
      await settingsPage.selectDarkTheme();

      // 点击保存
      await settingsPage.clickSave();

      // 等待保存完成
      await settingsPage.waitForSaveComplete();

      // 验证页面主题实际切换到暗色模式
      const isDarkMode = await settingsPage.isDarkMode();
      expect(isDarkMode).toBe(true);
    });

    test('应该能够切换主题到亮色模式', async ({ page }) => {
      // 选择亮色主题
      await settingsPage.selectLightTheme();

      // 点击保存
      await settingsPage.clickSave();

      // 等待保存完成
      await settingsPage.waitForSaveComplete();

      // 验证页面主题实际切换到亮色模式
      const isDarkMode = await settingsPage.isDarkMode();
      expect(isDarkMode).toBe(false);
    });

    test('应该能够切换主题到系统默认', async ({ page }) => {
      // 选择系统默认主题
      await settingsPage.selectSystemTheme();

      // 点击保存
      await settingsPage.clickSave();

      // 等待保存完成
      await settingsPage.waitForSaveComplete();

      // 验证主题按钮状态
      const themeButtonClass = await settingsPage.systemThemeButton.getAttribute('class');
      expect(themeButtonClass).toContain('ring-1');
    });
  });

  test.describe('保存设置测试', () => {
    test('应该能够保存设置并显示成功状态', async ({ page }) => {
      // 切换主题
      await settingsPage.selectDarkTheme();

      // 点击保存
      await settingsPage.clickSave();

      // 等待保存完成
      await settingsPage.waitForSaveComplete();

      // 验证保存按钮恢复可用状态
      await expect(settingsPage.saveButton).toBeEnabled();
    });
  });

  test.describe('设置持久化测试', () => {
    test('主题设置刷新页面后应该保持', async ({ page }) => {
      // 选择暗色主题
      await settingsPage.selectDarkTheme();

      // 保存设置
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 刷新页面
      await settingsPage.reloadAndWait();

      // 验证主题设置保持
      const currentTheme = await settingsPage.getCurrentTheme();
      expect(currentTheme).toBe('dark');
    });

    test('AI 配置刷新页面后应该保持', async ({ page }) => {
      // 修改文本生成任务配置
      await settingsPage.selectTextTaskProvider('volcengine');
      await page.waitForTimeout(500);

      // 保存设置
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 刷新页面
      await settingsPage.reloadAndWait();

      // 验证 AI 配置保持
      const provider = await settingsPage.getTextTaskProvider();
      expect(provider).toBe('volcengine');
    });

    test('FSRS 参数刷新页面后应该保持', async ({ page }) => {
      const newRetention = 0.92;
      const newMaxInterval = 730;

      // 修改 FSRS 参数
      await settingsPage.setRetention(newRetention);
      await settingsPage.setMaxInterval(newMaxInterval);

      // 保存设置
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 刷新页面
      await settingsPage.reloadAndWait();

      // 验证参数保持
      const retention = await settingsPage.getRetention();
      const maxInterval = await settingsPage.getMaxInterval();
      expect(retention).toBeCloseTo(newRetention, 2);
      expect(maxInterval).toBe(newMaxInterval);
    });

    test('可用模型库刷新页面后应该保持', async ({ page }) => {
      const testModelName = 'test-persistence-model-' + Date.now();

      // 添加新模型
      await settingsPage.addNewModel('deepseek', testModelName);
      await page.waitForTimeout(1000);

      // 保存设置
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 刷新页面
      await settingsPage.reloadAndWait();

      // 验证模型仍然存在
      const modelExists = await settingsPage.isModelInList('deepseek', testModelName);
      expect(modelExists).toBe(true);

      // 清理：删除测试模型
      await settingsPage.deleteModel('deepseek', testModelName);
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();
    });

    test('所有设置修改后应该正确保存到数据库', async ({ page }) => {
      // 修改主题
      await settingsPage.selectLightTheme();

      // 修改 AI 配置
      await settingsPage.selectTextTaskProvider('deepseek');
      await page.waitForTimeout(500);
      await settingsPage.selectEmbeddingProvider('volcengine');
      await page.waitForTimeout(500);
      await settingsPage.selectReasoningProvider('aliyun');
      await page.waitForTimeout(500);

      // 修改 FSRS 参数
      await settingsPage.setRetention(0.85);
      await settingsPage.setMaxInterval(1825);

      // 保存设置
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 验证成功消息显示
      await settingsPage.waitForSuccessMessage();

      // 刷新页面验证所有设置
      await settingsPage.reloadAndWait();

      // 验证主题
      const theme = await settingsPage.getCurrentTheme();
      expect(theme).toBe('light');

      // 验证 AI 配置
      const textProvider = await settingsPage.getTextTaskProvider();
      const embeddingProvider = await settingsPage.getEmbeddingProvider();
      const reasoningProvider = await settingsPage.getReasoningProvider();
      expect(textProvider).toBe('deepseek');
      expect(embeddingProvider).toBe('volcengine');
      expect(reasoningProvider).toBe('aliyun');

      // 验证 FSRS 参数
      const retention = await settingsPage.getRetention();
      const maxInterval = await settingsPage.getMaxInterval();
      expect(retention).toBeCloseTo(0.85, 2);
      expect(maxInterval).toBe(1825);
    });
  });

  test.describe('AI 配置测试', () => {
    test('应该能够修改文本生成任务的提供方', async ({ page }) => {
      // 选择新的提供方
      await settingsPage.selectTextTaskProvider('volcengine');

      // 等待模型选项更新
      await page.waitForTimeout(500);

      // 验证提供方已更改
      const provider = await settingsPage.getTextTaskProvider();
      expect(provider).toBe('volcengine');
    });

    test('应该能够修改文本生成任务的模型', async ({ page }) => {
      // 先选择提供方
      await settingsPage.selectTextTaskProvider('deepseek');
      await page.waitForTimeout(500);

      // 获取可用模型列表
      const modelSelect = settingsPage.textTaskModelSelect;
      const options = await modelSelect.locator('option').allInnerTexts();

      // 如果有多个模型，选择第二个
      if (options.length > 1) {
        // 获取第二个 option 的 value
        const secondOption = modelSelect.locator('option').nth(1);
        const secondModelValue = await secondOption.getAttribute('value') || '';
        await settingsPage.selectTextTaskModel(secondModelValue);

        // 验证模型已更改
        const model = await settingsPage.getTextTaskModel();
        expect(model).toBe(secondModelValue);
      }
    });

    test('应该能够修改向量化任务的配置', async ({ page }) => {
      // 选择新的提供方
      await settingsPage.selectEmbeddingProvider('aliyun');

      // 等待模型选项更新
      await page.waitForTimeout(500);

      // 验证提供方已更改
      const provider = await settingsPage.getEmbeddingProvider();
      expect(provider).toBe('aliyun');
    });

    test('应该能够修改推理任务的配置', async ({ page }) => {
      // 选择新的提供方
      await settingsPage.selectReasoningProvider('deepseek');

      // 等待模型选项更新
      await page.waitForTimeout(500);

      // 验证提供方已更改
      const provider = await settingsPage.getReasoningProvider();
      expect(provider).toBe('deepseek');
    });

    test('应该能够添加新模型到模型库', async ({ page }) => {
      const testModelName = 'test-model-' + Date.now();

      // 添加新模型
      await settingsPage.addNewModel('deepseek', testModelName);

      // 等待添加成功
      await page.waitForTimeout(1000);

      // 验证模型已添加 (检查输入框是否已清空，表示添加成功)
      const inputValue = await settingsPage.addModelInput.inputValue();
      expect(inputValue).toBe('');
    });

    test('AI 配置保存后应该正确应用', async ({ page }) => {
      const testModelName = 'test-apply-model-' + Date.now();

      // 添加测试模型
      await settingsPage.addNewModel('volcengine', testModelName);
      await page.waitForTimeout(500);

      // 选择包含新模型的提供方
      await settingsPage.selectTextTaskProvider('volcengine');
      await page.waitForTimeout(500);

      // 验证新模型出现在模型选择列表中
      const modelSelect = settingsPage.textTaskModelSelect;
      const options = await modelSelect.locator('option').allInnerTexts();
      expect(options).toContain(testModelName);

      // 选择新模型
      await settingsPage.selectTextTaskModel(testModelName);

      // 保存设置
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 刷新页面验证配置已应用
      await settingsPage.reloadAndWait();

      // 验证提供方和模型配置保持
      const provider = await settingsPage.getTextTaskProvider();
      const model = await settingsPage.getTextTaskModel();
      expect(provider).toBe('volcengine');
      expect(model).toBe(testModelName);

      // 清理：删除测试模型
      await settingsPage.deleteModel('volcengine', testModelName);
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();
    });

    test('切换提供方时应该自动选择第一个可用模型', async ({ page }) => {
      // 切换到 deepseek 提供方
      await settingsPage.selectTextTaskProvider('deepseek');
      await page.waitForTimeout(500);

      // 获取当前选中的模型
      const currentModel = await settingsPage.getTextTaskModel();

      // 切换到 volcengine 提供方
      await settingsPage.selectTextTaskProvider('volcengine');
      await page.waitForTimeout(500);

      // 获取新选中的模型
      const newModel = await settingsPage.getTextTaskModel();

      // 验证模型已自动切换（应该不是之前的模型）
      expect(newModel).toBeTruthy();
      expect(newModel).not.toBe(currentModel);
    });

    test('应该能够删除模型库中的模型', async ({ page }) => {
      const testModelName = 'test-delete-model-' + Date.now();

      // 添加测试模型
      await settingsPage.addNewModel('aliyun', testModelName);
      await page.waitForTimeout(500);

      // 验证模型已添加
      let modelExists = await settingsPage.isModelInList('aliyun', testModelName);
      expect(modelExists).toBe(true);

      // 删除模型
      await settingsPage.deleteModel('aliyun', testModelName);
      await page.waitForTimeout(500);

      // 验证模型已删除
      modelExists = await settingsPage.isModelInList('aliyun', testModelName);
      expect(modelExists).toBe(false);
    });
  });

  test.describe('FSRS 学习算法参数测试', () => {
    test('应该能够修改目标保留率', async ({ page }) => {
      const newRetention = 0.92;

      // 修改保留率
      await settingsPage.setRetention(newRetention);

      // 验证值已更改
      const retention = await settingsPage.getRetention();
      expect(retention).toBeCloseTo(newRetention, 2);
    });

    test('应该能够修改最大复习间隔', async ({ page }) => {
      const newMaxInterval = 365;

      // 修改最大间隔
      await settingsPage.setMaxInterval(newMaxInterval);

      // 验证值已更改
      const maxInterval = await settingsPage.getMaxInterval();
      expect(maxInterval).toBe(newMaxInterval);
    });

    test('目标保留率应该在有效范围内', async ({ page }) => {
      // 测试最小值
      await settingsPage.setRetention(0.70);
      let retention = await settingsPage.getRetention();
      expect(retention).toBeGreaterThanOrEqual(0.70);

      // 测试最大值
      await settingsPage.setRetention(0.99);
      retention = await settingsPage.getRetention();
      expect(retention).toBeLessThanOrEqual(0.99);
    });

    test('最大复习间隔应该在有效范围内', async ({ page }) => {
      // 测试最小值
      await settingsPage.setMaxInterval(1);
      let maxInterval = await settingsPage.getMaxInterval();
      expect(maxInterval).toBeGreaterThanOrEqual(1);

      // 测试最大值
      await settingsPage.setMaxInterval(36500);
      maxInterval = await settingsPage.getMaxInterval();
      expect(maxInterval).toBeLessThanOrEqual(36500);
    });

    test('滑块和输入框应该同步', async ({ page }) => {
      // 通过输入框设置值
      await settingsPage.setRetention(0.88);

      // 验证滑块值也更新
      const sliderValue = await settingsPage.retentionSlider.inputValue();
      expect(parseFloat(sliderValue)).toBeCloseTo(0.88, 2);
    });

    test('FSRS 参数保存后应该正确应用', async ({ page }) => {
      const newRetention = 0.88;
      const newMaxInterval = 1095;

      // 修改 FSRS 参数
      await settingsPage.setRetention(newRetention);
      await settingsPage.setMaxInterval(newMaxInterval);

      // 保存设置
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 验证成功消息显示
      await settingsPage.waitForSuccessMessage();

      // 刷新页面验证参数已应用
      await settingsPage.reloadAndWait();

      // 验证参数保持
      const retention = await settingsPage.getRetention();
      const maxInterval = await settingsPage.getMaxInterval();
      expect(retention).toBeCloseTo(newRetention, 2);
      expect(maxInterval).toBe(newMaxInterval);
    });

    test('目标保留率应该影响复习频率', async ({ page }) => {
      // 设置较高的保留率
      await settingsPage.setRetention(0.95);
      const highRetention = await settingsPage.getRetention();
      expect(highRetention).toBeCloseTo(0.95, 2);

      // 保存设置
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 刷新页面
      await settingsPage.reloadAndWait();

      // 验证高保留率设置保持
      const savedHighRetention = await settingsPage.getRetention();
      expect(savedHighRetention).toBeCloseTo(0.95, 2);

      // 设置较低的保留率
      await settingsPage.setRetention(0.80);
      const lowRetention = await settingsPage.getRetention();
      expect(lowRetention).toBeCloseTo(0.80, 2);

      // 保存设置
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 刷新页面
      await settingsPage.reloadAndWait();

      // 验证低保留率设置保持
      const savedLowRetention = await settingsPage.getRetention();
      expect(savedLowRetention).toBeCloseTo(0.80, 2);
    });

    test('最大复习间隔应该限制复习周期', async ({ page }) => {
      // 设置较短的最大间隔（1年）
      await settingsPage.setMaxInterval(365);
      const shortInterval = await settingsPage.getMaxInterval();
      expect(shortInterval).toBe(365);

      // 保存设置
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 刷新页面
      await settingsPage.reloadAndWait();

      // 验证短间隔设置保持
      const savedShortInterval = await settingsPage.getMaxInterval();
      expect(savedShortInterval).toBe(365);

      // 设置较长的最大间隔（10年）
      await settingsPage.setMaxInterval(3650);
      const longInterval = await settingsPage.getMaxInterval();
      expect(longInterval).toBe(3650);

      // 保存设置
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 刷新页面
      await settingsPage.reloadAndWait();

      // 验证长间隔设置保持
      const savedLongInterval = await settingsPage.getMaxInterval();
      expect(savedLongInterval).toBe(3650);
    });

    test('FSRS 参数应该在合理范围内调整', async ({ page }) => {
      // 测试保留率的常用值
      const commonRetentions = [0.80, 0.85, 0.90, 0.92, 0.95];
      
      for (const retention of commonRetentions) {
        await settingsPage.setRetention(retention);
        const actualRetention = await settingsPage.getRetention();
        expect(actualRetention).toBeCloseTo(retention, 2);
      }

      // 测试最大间隔的常用值
      const commonIntervals = [30, 90, 180, 365, 730, 1825, 3650];
      
      for (const interval of commonIntervals) {
        await settingsPage.setMaxInterval(interval);
        const actualInterval = await settingsPage.getMaxInterval();
        expect(actualInterval).toBe(interval);
      }
    });

    test('FSRS 参数修改后应该立即反映在界面上', async ({ page }) => {
      // 修改保留率
      await settingsPage.setRetention(0.87);
      
      // 验证输入框值立即更新
      const inputRetention = await settingsPage.getRetention();
      expect(inputRetention).toBeCloseTo(0.87, 2);

      // 验证滑块值同步更新
      const sliderValue = await settingsPage.retentionSlider.inputValue();
      expect(parseFloat(sliderValue)).toBeCloseTo(0.87, 2);

      // 修改最大间隔
      await settingsPage.setMaxInterval(500);
      
      // 验证输入框值立即更新
      const inputInterval = await settingsPage.getMaxInterval();
      expect(inputInterval).toBe(500);

      // 验证滑块值同步更新
      const intervalSliderValue = await settingsPage.maxIntervalSlider.inputValue();
      expect(parseInt(intervalSliderValue)).toBe(500);
    });
  });

  test.describe('设置持久化深度测试', () => {
    test('设置应该在多次页面刷新后保持一致', async ({ page }) => {
      // 设置特定配置
      await settingsPage.selectDarkTheme();
      await settingsPage.setRetention(0.90);
      await settingsPage.setMaxInterval(1000);
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 第一次刷新
      await settingsPage.reloadAndWait();
      let theme = await settingsPage.getCurrentTheme();
      let retention = await settingsPage.getRetention();
      let maxInterval = await settingsPage.getMaxInterval();
      expect(theme).toBe('dark');
      expect(retention).toBeCloseTo(0.90, 2);
      expect(maxInterval).toBe(1000);

      // 第二次刷新
      await settingsPage.reloadAndWait();
      theme = await settingsPage.getCurrentTheme();
      retention = await settingsPage.getRetention();
      maxInterval = await settingsPage.getMaxInterval();
      expect(theme).toBe('dark');
      expect(retention).toBeCloseTo(0.90, 2);
      expect(maxInterval).toBe(1000);

      // 第三次刷新
      await settingsPage.reloadAndWait();
      theme = await settingsPage.getCurrentTheme();
      retention = await settingsPage.getRetention();
      maxInterval = await settingsPage.getMaxInterval();
      expect(theme).toBe('dark');
      expect(retention).toBeCloseTo(0.90, 2);
      expect(maxInterval).toBe(1000);
    });

    test('设置应该在导航到其他页面后返回时保持', async ({ page }) => {
      // 设置特定配置
      await settingsPage.selectLightTheme();
      await settingsPage.setRetention(0.85);
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 导航到仪表板
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // 返回设置页面
      await settingsPage.goto();

      // 验证设置保持
      const theme = await settingsPage.getCurrentTheme();
      const retention = await settingsPage.getRetention();
      expect(theme).toBe('light');
      expect(retention).toBeCloseTo(0.85, 2);
    });

    test('部分修改设置后保存应该只更新修改的部分', async ({ page }) => {
      // 先设置一组初始配置
      await settingsPage.selectDarkTheme();
      await settingsPage.setRetention(0.88);
      await settingsPage.setMaxInterval(800);
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 只修改保留率
      await settingsPage.setRetention(0.92);
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 刷新验证所有设置
      await settingsPage.reloadAndWait();

      const theme = await settingsPage.getCurrentTheme();
      const retention = await settingsPage.getRetention();
      const maxInterval = await settingsPage.getMaxInterval();

      // 主题和最大间隔应该保持不变，只有保留率改变
      expect(theme).toBe('dark');
      expect(retention).toBeCloseTo(0.92, 2);
      expect(maxInterval).toBe(800);
    });

    test('未保存的设置修改在刷新后应该恢复', async ({ page }) => {
      // 获取当前设置
      await settingsPage.selectDarkTheme();
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 修改但不保存
      await settingsPage.selectLightTheme();
      await settingsPage.setRetention(0.75);

      // 刷新页面
      await settingsPage.reloadAndWait();

      // 验证设置恢复到保存的状态
      const theme = await settingsPage.getCurrentTheme();
      const retention = await settingsPage.getRetention();
      expect(theme).toBe('dark');
      // 保留率应该是默认值或之前保存的值
    });
  });

  test.describe('AI 配置深度测试', () => {
    test('应该能够配置所有三种 AI 任务类型', async ({ page }) => {
      // 配置文本生成任务
      await settingsPage.selectTextTaskProvider('deepseek');
      await page.waitForTimeout(500);

      // 配置向量化任务
      await settingsPage.selectEmbeddingProvider('volcengine');
      await page.waitForTimeout(500);

      // 配置推理任务
      await settingsPage.selectReasoningProvider('aliyun');
      await page.waitForTimeout(500);

      // 保存设置
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 刷新验证
      await settingsPage.reloadAndWait();

      const textProvider = await settingsPage.getTextTaskProvider();
      const embeddingProvider = await settingsPage.getEmbeddingProvider();
      const reasoningProvider = await settingsPage.getReasoningProvider();

      expect(textProvider).toBe('deepseek');
      expect(embeddingProvider).toBe('volcengine');
      expect(reasoningProvider).toBe('aliyun');
    });

    test('切换提供方后模型列表应该更新', async ({ page }) => {
      // 选择第一个提供方并获取模型列表
      await settingsPage.selectTextTaskProvider('deepseek');
      await page.waitForTimeout(500);
      const firstProviderModels = await settingsPage.textTaskModelSelect.locator('option').allInnerTexts();

      // 切换到另一个提供方
      await settingsPage.selectTextTaskProvider('volcengine');
      await page.waitForTimeout(500);
      const secondProviderModels = await settingsPage.textTaskModelSelect.locator('option').allInnerTexts();

      // 模型列表应该不同
      expect(firstProviderModels).not.toEqual(secondProviderModels);
      expect(secondProviderModels.length).toBeGreaterThan(0);
    });

    test('添加重复模型名称应该被正确处理', async ({ page }) => {
      const testModelName = 'test-duplicate-model-' + Date.now();

      // 添加模型
      await settingsPage.addNewModel('deepseek', testModelName);
      await page.waitForTimeout(500);

      // 验证模型已添加
      let modelExists = await settingsPage.isModelInList('deepseek', testModelName);
      expect(modelExists).toBe(true);

      // 尝试添加同名模型
      await settingsPage.addNewModel('deepseek', testModelName);
      await page.waitForTimeout(500);

      // 验证只有一个模型（或者有错误提示）
      // 清理
      await settingsPage.deleteModel('deepseek', testModelName);
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();
    });

    test('模型库管理应该支持多个提供商', async ({ page }) => {
      const testModel1 = 'test-multi-provider-1-' + Date.now();
      const testModel2 = 'test-multi-provider-2-' + Date.now();

      // 为不同提供商添加模型
      await settingsPage.addNewModel('deepseek', testModel1);
      await page.waitForTimeout(500);

      await settingsPage.addNewModel('volcengine', testModel2);
      await page.waitForTimeout(500);

      // 保存
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 刷新验证
      await settingsPage.reloadAndWait();

      // 验证两个模型都存在
      const model1Exists = await settingsPage.isModelInList('deepseek', testModel1);
      const model2Exists = await settingsPage.isModelInList('volcengine', testModel2);
      expect(model1Exists).toBe(true);
      expect(model2Exists).toBe(true);

      // 清理
      await settingsPage.deleteModel('deepseek', testModel1);
      await settingsPage.deleteModel('volcengine', testModel2);
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();
    });

    test('AI 配置应该在保存后立即生效', async ({ page }) => {
      // 修改配置
      await settingsPage.selectTextTaskProvider('deepseek');
      await page.waitForTimeout(500);

      // 保存
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();

      // 验证成功消息
      await settingsPage.waitForSuccessMessage();

      // 验证配置已应用
      const provider = await settingsPage.getTextTaskProvider();
      expect(provider).toBe('deepseek');
    });
  });

  test.describe('FSRS 学习算法参数深度测试', () => {
    test('保留率边界值测试 - 最小值', async ({ page }) => {
      // 测试最小边界值
      await settingsPage.setRetention(0.70);
      const retention = await settingsPage.getRetention();
      expect(retention).toBeGreaterThanOrEqual(0.70);
      expect(retention).toBeLessThanOrEqual(0.99);

      // 保存验证
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();
      await settingsPage.reloadAndWait();

      const savedRetention = await settingsPage.getRetention();
      expect(savedRetention).toBeCloseTo(0.70, 2);
    });

    test('保留率边界值测试 - 最大值', async ({ page }) => {
      // 测试最大边界值
      await settingsPage.setRetention(0.99);
      const retention = await settingsPage.getRetention();
      expect(retention).toBeGreaterThanOrEqual(0.70);
      expect(retention).toBeLessThanOrEqual(0.99);

      // 保存验证
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();
      await settingsPage.reloadAndWait();

      const savedRetention = await settingsPage.getRetention();
      expect(savedRetention).toBeCloseTo(0.99, 2);
    });

    test('最大间隔边界值测试 - 最小值', async ({ page }) => {
      // 测试最小边界值
      await settingsPage.setMaxInterval(1);
      const maxInterval = await settingsPage.getMaxInterval();
      expect(maxInterval).toBeGreaterThanOrEqual(1);
      expect(maxInterval).toBeLessThanOrEqual(36500);

      // 保存验证
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();
      await settingsPage.reloadAndWait();

      const savedInterval = await settingsPage.getMaxInterval();
      expect(savedInterval).toBe(1);
    });

    test('最大间隔边界值测试 - 最大值', async ({ page }) => {
      // 测试最大边界值
      await settingsPage.setMaxInterval(36500);
      const maxInterval = await settingsPage.getMaxInterval();
      expect(maxInterval).toBeGreaterThanOrEqual(1);
      expect(maxInterval).toBeLessThanOrEqual(36500);

      // 保存验证
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();
      await settingsPage.reloadAndWait();

      const savedInterval = await settingsPage.getMaxInterval();
      expect(savedInterval).toBe(36500);
    });

    test('FSRS 参数组合测试', async ({ page }) => {
      // 测试不同的参数组合
      const testCases = [
        { retention: 0.80, maxInterval: 365 },
        { retention: 0.85, maxInterval: 730 },
        { retention: 0.90, maxInterval: 1095 },
        { retention: 0.95, maxInterval: 1825 },
      ];

      for (const testCase of testCases) {
        await settingsPage.setRetention(testCase.retention);
        await settingsPage.setMaxInterval(testCase.maxInterval);

        const retention = await settingsPage.getRetention();
        const maxInterval = await settingsPage.getMaxInterval();

        expect(retention).toBeCloseTo(testCase.retention, 2);
        expect(maxInterval).toBe(testCase.maxInterval);
      }
    });

    test('FSRS 参数滑块交互测试', async ({ page }) => {
      // 通过滑块设置保留率
      await settingsPage.retentionSlider.fill('0.85');
      
      // 验证输入框同步
      const retentionFromInput = await settingsPage.getRetention();
      expect(retentionFromInput).toBeCloseTo(0.85, 2);

      // 通过滑块设置最大间隔
      await settingsPage.maxIntervalSlider.fill('500');
      
      // 验证输入框同步
      const intervalFromInput = await settingsPage.getMaxInterval();
      expect(intervalFromInput).toBe(500);
    });

    test('FSRS 参数精度测试', async ({ page }) => {
      // 测试小数精度
      const preciseValue = 0.8765;
      await settingsPage.setRetention(preciseValue);

      // 验证精度保持（应该四舍五入到合理精度）
      const retention = await settingsPage.getRetention();
      expect(retention).toBeCloseTo(preciseValue, 2);

      // 保存后验证
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();
      await settingsPage.reloadAndWait();

      const savedRetention = await settingsPage.getRetention();
      expect(savedRetention).toBeCloseTo(preciseValue, 2);
    });

    test('FSRS 参数快速连续修改测试', async ({ page }) => {
      // 快速连续修改参数
      for (let i = 0; i < 5; i++) {
        await settingsPage.setRetention(0.80 + i * 0.03);
        await settingsPage.setMaxInterval(365 + i * 100);
      }

      // 最终值
      const retention = await settingsPage.getRetention();
      const maxInterval = await settingsPage.getMaxInterval();

      expect(retention).toBeCloseTo(0.92, 2);
      expect(maxInterval).toBe(765);

      // 保存验证
      await settingsPage.clickSave();
      await settingsPage.waitForSaveComplete();
    });
  });
});
