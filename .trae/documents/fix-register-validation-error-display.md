# 注册输入验证错误提示优化计划

## 问题分析

### 当前问题
用户在注册时，如果输入验证失败（如密码不符合要求），页面只显示一个笼统的错误提示"输入验证失败"，没有显示具体哪个字段验证失败以及失败原因。

### 问题根源

1. **后端已正确返回详细错误信息**：
   - `api/middleware/validate.ts` 验证失败时返回：
   ```json
   {
     "success": false,
     "code": "VALIDATION_ERROR",
     "error": "输入验证失败",
     "details": [
       { "field": "password", "message": "密码需要包含大写字母" },
       { "field": "password", "message": "密码需要包含数字" }
     ]
   }
   ```

2. **前端错误处理已保存详细信息**：
   - `src/utils/errors.ts` 中 `ValidationError` 类有 `details` 属性存储字段级错误

3. **注册页面未使用详细信息**：
   - `src/pages/Register.tsx` 只显示 `err.message`（即"输入验证失败"）
   - 没有检查和显示 `details` 数组

### 验证规则（后端 `api/schemas/index.ts`）
- **邮箱**：必须是合法邮箱格式
- **密码**：
  - 至少 8 位
  - 需要包含大写字母
  - 需要包含小写字母
  - 需要包含数字
- **姓名**：不能为空

## 解决方案

修改 `src/pages/Register.tsx`，当捕获到验证错误时，显示详细的字段错误信息。

### 实现步骤

1. **导入 `isValidationError` 函数**：从 `src/utils/errors` 导入用于判断错误类型

2. **修改错误处理逻辑**：
   - 检查错误是否为 `ValidationError`
   - 如果是，提取 `details` 数组并格式化显示
   - 如果不是，显示原有错误消息

3. **优化错误显示 UI**：
   - 将单个错误提示改为支持显示多条错误
   - 每条错误显示字段名和具体原因

### 代码修改

**文件**：`src/pages/Register.tsx`

```tsx
// 新增导入
import { isValidationError } from '../utils/errors';

// 修改错误状态类型
const [errors, setErrors] = useState<string[]>([]);

// 修改 handleSubmit 中的错误处理
catch (err: any) {
  if (isValidationError(err)) {
    const detailMessages = err.details?.map(d => `${d.field}: ${d.message}`) || [err.message];
    setErrors(detailMessages);
  } else {
    setErrors([err.message]);
  }
}

// 修改错误显示 UI
{errors.length > 0 && (
  <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-2 mb-4 rounded">
    {errors.map((msg, index) => (
      <div key={index}>{msg}</div>
    ))}
  </div>
)}
```

## 预期效果

修改后，当用户输入不符合要求的密码时，会看到类似以下的错误提示：

```
password: 密码需要包含大写字母
password: 密码需要包含数字
```

而不是笼统的"输入验证失败"。
