import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TEST_USER = {
  email: 'test@example.com',
  password: 'test123456',
  name: '测试用户',
};

type GraphNode = { title: string; content: string; level: 'root' | 'core' | 'sub' | 'leaf'; x: number; y: number };
type GraphEdge = { source: string; target: string; type?: string };
type GraphData = {
  title: string;
  description: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

const JAVASCRIPT_GRAPH: GraphData = {
  title: 'JavaScript 基础知识',
  description: 'JavaScript 语言的核心概念和基础知识，包括变量、函数、对象、数组等重要概念',
  nodes: [
    { title: 'JavaScript', content: 'JavaScript 是一种高级的、解释型的编程语言，是 Web 开发的核心技术之一。它支持面向对象、函数式和事件驱动的编程范式，可以运行在浏览器和 Node.js 环境中。', level: 'root' as const, x: 400, y: 50 },
    { title: '变量与数据类型', content: 'JavaScript 中的变量声明方式包括 var、let 和 const。基本数据类型有：string、number、boolean、null、undefined、symbol 和 bigint。', level: 'core' as const, x: 150, y: 180 },
    { title: '函数', content: '函数是 JavaScript 中的一等公民，可以作为参数传递、作为返回值、赋值给变量。支持函数声明、函数表达式、箭头函数等多种定义方式。', level: 'core' as const, x: 400, y: 180 },
    { title: '对象', content: '对象是 JavaScript 中最复杂的数据类型，是键值对的集合。支持对象字面量、构造函数、Object.create() 等创建方式。', level: 'core' as const, x: 650, y: 180 },
    { title: '异步编程', content: 'JavaScript 的异步编程模型包括回调函数、Promise、async/await。事件循环（Event Loop）是理解异步执行的关键。', level: 'core' as const, x: 900, y: 180 },
    { title: 'let 和 const', content: 'let 声明可变变量，const 声明常量。两者都有块级作用域，不存在变量提升。', level: 'sub' as const, x: 50, y: 320 },
    { title: 'var 关键字', content: 'var 是 ES5 的变量声明方式，存在变量提升和函数作用域。', level: 'sub' as const, x: 150, y: 320 },
    { title: '数据类型转换', content: 'JavaScript 支持显式转换（Number()、String()、Boolean()）和隐式转换。', level: 'sub' as const, x: 250, y: 320 },
    { title: '箭头函数', content: 'ES6 引入的简洁函数语法，没有自己的 this、arguments、super。', level: 'sub' as const, x: 350, y: 320 },
    { title: '闭包', content: '闭包是指函数能够访问其词法作用域外的变量。常用于数据私有化、函数工厂等场景。', level: 'sub' as const, x: 450, y: 320 },
    { title: '原型链', content: 'JavaScript 使用原型继承机制。每个对象都有 __proto__ 属性指向其原型对象。', level: 'sub' as const, x: 600, y: 320 },
    { title: 'ES6 Class', content: 'class 是 ES6 引入的语法糖，本质上仍是原型继承。', level: 'sub' as const, x: 700, y: 320 },
    { title: 'Promise', content: 'Promise 是异步编程的解决方案，代表一个异步操作的最终结果。有三种状态：pending、fulfilled、rejected。', level: 'sub' as const, x: 850, y: 320 },
    { title: 'async/await', content: 'async/await 是 Promise 的语法糖，让异步代码看起来像同步代码。', level: 'sub' as const, x: 950, y: 320 },
    { title: 'Promise.all()', content: 'Promise.all() 接收一个 Promise 数组，当所有 Promise 都 resolve 时才 resolve。', level: 'leaf' as const, x: 850, y: 450 },
    { title: 'Promise.race()', content: 'Promise.race() 返回最先完成的 Promise 结果。', level: 'leaf' as const, x: 950, y: 450 },
  ],
  edges: [
    { source: 'JavaScript', target: '变量与数据类型' },
    { source: 'JavaScript', target: '函数' },
    { source: 'JavaScript', target: '对象' },
    { source: 'JavaScript', target: '异步编程' },
    { source: '变量与数据类型', target: 'let 和 const' },
    { source: '变量与数据类型', target: 'var 关键字' },
    { source: '变量与数据类型', target: '数据类型转换' },
    { source: '函数', target: '箭头函数' },
    { source: '函数', target: '闭包' },
    { source: '对象', target: '原型链' },
    { source: '对象', target: 'ES6 Class' },
    { source: '异步编程', target: 'Promise' },
    { source: '异步编程', target: 'async/await' },
    { source: 'Promise', target: 'Promise.all()' },
    { source: 'Promise', target: 'Promise.race()' },
    { source: '箭头函数', target: '闭包', type: 'related' },
    { source: 'Promise', target: 'async/await', type: 'related' },
  ],
};

const REACT_GRAPH: GraphData = {
  title: 'React 开发指南',
  description: 'React 框架的核心概念、组件设计、状态管理等知识点',
  nodes: [
    { title: 'React', content: 'React 是一个用于构建用户界面的 JavaScript 库，由 Facebook 开发维护。采用声明式编程、组件化思想和虚拟 DOM 技术。', level: 'root' as const, x: 400, y: 50 },
    { title: '组件', content: '组件是 React 的核心概念，分为函数组件和类组件。组件可以接收 props 并返回 JSX 描述 UI。', level: 'core' as const, x: 200, y: 180 },
    { title: '状态管理', content: 'React 提供多种状态管理方案：useState、useReducer、Context API，以及第三方库如 Redux、Zustand。', level: 'core' as const, x: 400, y: 180 },
    { title: 'Hooks', content: 'Hooks 是 React 16.8 引入的新特性，允许在函数组件中使用状态和其他 React 特性。', level: 'core' as const, x: 600, y: 180 },
    { title: '生命周期', content: '类组件有完整的生命周期方法：挂载、更新、卸载。函数组件使用 useEffect 模拟生命周期。', level: 'core' as const, x: 800, y: 180 },
    { title: '函数组件', content: '函数组件是简单的 JavaScript 函数，接收 props 返回 JSX。推荐使用函数组件和 Hooks。', level: 'sub' as const, x: 100, y: 320 },
    { title: '类组件', content: '类组件继承 React.Component，有 state 和生命周期方法。新项目建议使用函数组件。', level: 'sub' as const, x: 250, y: 320 },
    { title: 'Props', content: 'Props 是组件的输入参数，从父组件传递给子组件，是只读的。', level: 'sub' as const, x: 350, y: 320 },
    { title: 'useState', content: 'useState 是最基础的 Hook，用于在函数组件中添加状态。返回状态值和更新函数。', level: 'sub' as const, x: 450, y: 320 },
    { title: 'useEffect', content: 'useEffect 用于处理副作用，如数据获取、订阅、DOM 操作等。可以模拟类组件的生命周期。', level: 'sub' as const, x: 550, y: 320 },
    { title: 'useContext', content: 'useContext 用于消费 Context，避免 props drilling 问题。', level: 'sub' as const, x: 650, y: 320 },
    { title: 'useCallback', content: 'useCallback 返回一个记忆化的回调函数，用于优化性能，避免不必要的重新渲染。', level: 'sub' as const, x: 750, y: 320 },
    { title: 'useMemo', content: 'useMemo 返回一个记忆化的值，用于缓存计算结果，优化性能。', level: 'leaf' as const, x: 550, y: 450 },
    { title: '自定义 Hook', content: '自定义 Hook 是复用状态逻辑的方式，以 use 开头的函数。', level: 'leaf' as const, x: 650, y: 450 },
  ],
  edges: [
    { source: 'React', target: '组件' },
    { source: 'React', target: '状态管理' },
    { source: 'React', target: 'Hooks' },
    { source: 'React', target: '生命周期' },
    { source: '组件', target: '函数组件' },
    { source: '组件', target: '类组件' },
    { source: '组件', target: 'Props' },
    { source: '状态管理', target: 'useState' },
    { source: 'Hooks', target: 'useState' },
    { source: 'Hooks', target: 'useEffect' },
    { source: 'Hooks', target: 'useContext' },
    { source: 'Hooks', target: 'useCallback' },
    { source: '生命周期', target: 'useEffect', type: 'related' },
    { source: 'useCallback', target: 'useMemo', type: 'related' },
    { source: 'Hooks', target: '自定义 Hook' },
  ],
};

const PYTHON_GRAPH: GraphData = {
  title: 'Python 数据分析',
  description: '使用 Python 进行数据分析的完整知识体系，包括 NumPy、Pandas、Matplotlib 等',
  nodes: [
    { title: 'Python 数据分析', content: 'Python 是数据分析领域最流行的编程语言，拥有丰富的数据处理和可视化库。', level: 'root' as const, x: 400, y: 50 },
    { title: 'NumPy', content: 'NumPy 是 Python 科学计算的基础库，提供多维数组对象和数学运算函数。', level: 'core' as const, x: 200, y: 180 },
    { title: 'Pandas', content: 'Pandas 是数据分析的核心库，提供 DataFrame 和 Series 数据结构，支持数据清洗、转换、分析。', level: 'core' as const, x: 400, y: 180 },
    { title: 'Matplotlib', content: 'Matplotlib 是 Python 最基础的绑图库，支持各种静态、动态、交互式图表。', level: 'core' as const, x: 600, y: 180 },
    { title: '数据清洗', content: '数据清洗是数据分析的重要步骤，包括处理缺失值、重复值、异常值等。', level: 'core' as const, x: 800, y: 180 },
    { title: 'ndarray', content: 'ndarray 是 NumPy 的核心数据结构，N 维数组，支持向量化运算。', level: 'sub' as const, x: 100, y: 320 },
    { title: '数组运算', content: 'NumPy 支持广播机制、向量化运算、矩阵运算等高效数值计算。', level: 'sub' as const, x: 250, y: 320 },
    { title: 'DataFrame', content: 'DataFrame 是 Pandas 的核心数据结构，二维表格，类似 SQL 表或 Excel。', level: 'sub' as const, x: 350, y: 320 },
    { title: 'Series', content: 'Series 是一维标签数组，可以存储任意数据类型。', level: 'sub' as const, x: 450, y: 320 },
    { title: '数据聚合', content: 'Pandas 提供 groupby、pivot_table 等数据聚合功能。', level: 'sub' as const, x: 550, y: 320 },
    { title: '折线图', content: '折线图用于展示数据随时间变化的趋势。', level: 'sub' as const, x: 650, y: 320 },
    { title: '柱状图', content: '柱状图用于比较不同类别的数据大小。', level: 'sub' as const, x: 750, y: 320 },
    { title: '散点图', content: '散点图用于展示两个变量之间的关系。', level: 'leaf' as const, x: 650, y: 450 },
    { title: '缺失值处理', content: '处理缺失值的方法包括删除、填充、插值等。', level: 'leaf' as const, x: 750, y: 450 },
  ],
  edges: [
    { source: 'Python 数据分析', target: 'NumPy' },
    { source: 'Python 数据分析', target: 'Pandas' },
    { source: 'Python 数据分析', target: 'Matplotlib' },
    { source: 'Python 数据分析', target: '数据清洗' },
    { source: 'NumPy', target: 'ndarray' },
    { source: 'NumPy', target: '数组运算' },
    { source: 'Pandas', target: 'DataFrame' },
    { source: 'Pandas', target: 'Series' },
    { source: 'Pandas', target: '数据聚合' },
    { source: 'Matplotlib', target: '折线图' },
    { source: 'Matplotlib', target: '柱状图' },
    { source: 'Matplotlib', target: '散点图' },
    { source: '数据清洗', target: '缺失值处理' },
    { source: 'DataFrame', target: 'ndarray', type: 'related' },
  ],
};

const EMPTY_GRAPH: GraphData = {
  title: '空测试图谱',
  description: '用于测试空图谱边界条件',
  nodes: [],
  edges: [],
};

const SINGLE_NODE_GRAPH: GraphData = {
  title: '单节点测试图谱',
  description: '用于测试单节点图谱边界条件',
  nodes: [
    { title: '唯一的节点', content: '这是单节点图谱中唯一的节点，用于测试边界条件。', level: 'root' as const, x: 400, y: 200 },
  ],
  edges: [],
};

const PERFORMANCE_GRAPH: GraphData = {
  title: '性能测试图谱',
  description: '包含大量节点的图谱，用于测试性能边界条件',
  nodes: (() => {
    const nodes: GraphNode[] = [];
    nodes.push({ title: '性能测试根节点', content: '这是性能测试图谱的根节点，用于测试大量数据渲染性能。', level: 'root', x: 500, y: 50 });
    
    for (let i = 1; i <= 10; i++) {
      nodes.push({ 
        title: `核心概念 ${i}`, 
        content: `这是第 ${i} 个核心概念节点，包含重要的知识点内容。`, 
        level: 'core', 
        x: 100 + (i - 1) * 90, 
        y: 150 
      });
    }
    
    for (let i = 1; i <= 20; i++) {
      nodes.push({ 
        title: `子节点 ${i}`, 
        content: `这是第 ${i} 个子节点，属于某个核心概念的延伸内容。`, 
        level: 'sub', 
        x: 50 + ((i - 1) % 10) * 100, 
        y: 280 + Math.floor((i - 1) / 10) * 80 
      });
    }
    
    for (let i = 1; i <= 20; i++) {
      nodes.push({ 
        title: `叶子节点 ${i}`, 
        content: `这是第 ${i} 个叶子节点，是最细粒度的知识点。`, 
        level: 'leaf', 
        x: 50 + ((i - 1) % 10) * 100, 
        y: 420 + Math.floor((i - 1) / 10) * 80 
      });
    }
    
    return nodes;
  })(),
  edges: (() => {
    const edges: GraphEdge[] = [];
    
    for (let i = 1; i <= 10; i++) {
      edges.push({ source: '性能测试根节点', target: `核心概念 ${i}` });
    }
    
    for (let i = 1; i <= 10; i++) {
      edges.push({ source: `核心概念 ${i}`, target: `子节点 ${i}` });
      edges.push({ source: `核心概念 ${i}`, target: `子节点 ${i + 10}` });
    }
    
    for (let i = 1; i <= 20; i++) {
      edges.push({ source: `子节点 ${i}`, target: `叶子节点 ${i}` });
    }
    
    return edges;
  })(),
};

const CYCLIC_GRAPH: GraphData = {
  title: '循环依赖测试图谱',
  description: '包含循环依赖边的图谱，用于测试循环检测',
  nodes: [
    { title: '节点A', content: '循环依赖测试节点A', level: 'root' as const, x: 300, y: 150 },
    { title: '节点B', content: '循环依赖测试节点B', level: 'core' as const, x: 500, y: 150 },
    { title: '节点C', content: '循环依赖测试节点C', level: 'core' as const, x: 400, y: 280 },
  ],
  edges: [
    { source: '节点A', target: '节点B' },
    { source: '节点B', target: '节点C' },
    { source: '节点C', target: '节点A' },
  ],
};

const LONG_CONTENT_GRAPH: GraphData = {
  title: '超长内容测试图谱',
  description: '包含超长标题和内容的图谱',
  nodes: [
    { 
      title: '这是一个非常长的知识点标题用于测试标题长度限制以及UI显示效果当标题超过一百个字符时应该如何处理是否需要截断或者换行显示', 
      content: '这是一个非常长的知识点标题用于测试标题长度限制以及UI显示效果当标题超过一百个字符时应该如何处理是否需要截断或者换行显示这是一个非常长的知识点标题用于测试标题长度限制以及UI显示效果当标题超过一百个字符时应该如何处理是否需要截断或者换行显示', 
      level: 'root' as const, 
      x: 400, 
      y: 150 
    },
    { 
      title: '超长内容节点', 
      content: '这是一个包含超长内容的知识点。'.repeat(60) + '\n\n' + '这是第二段超长内容，用于测试内容显示和存储。'.repeat(30) + '\n\n' + '这是第三段内容，包含了更多的文字来测试边界条件。'.repeat(20), 
      level: 'core' as const, 
      x: 400, 
      y: 280 
    },
  ],
  edges: [
    { source: '这是一个非常长的知识点标题用于测试标题长度限制以及UI显示效果当标题超过一百个字符时应该如何处理是否需要截断或者换行显示', target: '超长内容节点' },
  ],
};

const MACHINE_LEARNING_GRAPH: GraphData = {
  title: '机器学习基础',
  description: '机器学习的核心概念和方法，包括监督学习、无监督学习、深度学习等重要内容',
  nodes: [
    { title: '机器学习', content: '机器学习是人工智能的一个分支，它使计算机系统能够从数据中学习并改进，而无需进行明确的编程。主要包括监督学习、无监督学习和强化学习三大类。', level: 'root' as const, x: 500, y: 50 },
    { title: '监督学习', content: '监督学习使用标记数据训练模型，每个训练样本都有对应的标签。常见算法包括线性回归、逻辑回归、决策树、支持向量机等。', level: 'core' as const, x: 200, y: 180 },
    { title: '无监督学习', content: '无监督学习使用未标记数据发现数据中的模式。主要任务包括聚类、降维和关联规则学习。', level: 'core' as const, x: 500, y: 180 },
    { title: '深度学习', content: '深度学习是机器学习的子领域，使用多层神经网络处理复杂模式。广泛应用于图像识别、自然语言处理等领域。', level: 'core' as const, x: 800, y: 180 },
    { title: '线性回归', content: '线性回归是最基础的监督学习算法，用于预测连续值。通过拟合数据点找到最佳直线（或超平面）。', level: 'sub' as const, x: 50, y: 320 },
    { title: '逻辑回归', content: '逻辑回归用于二分类问题，输出概率值。使用 sigmoid 函数将线性组合映射到 0-1 之间。', level: 'sub' as const, x: 150, y: 320 },
    { title: '决策树', content: '决策树通过树状结构进行决策，每个内部节点表示一个特征判断，叶子节点表示预测结果。', level: 'sub' as const, x: 250, y: 320 },
    { title: '支持向量机', content: 'SVM 寻找最优超平面来分隔不同类别的数据点，通过核函数可以处理非线性问题。', level: 'sub' as const, x: 350, y: 320 },
    { title: 'K-Means聚类', content: 'K-Means 是最常用的聚类算法，将数据分成 K 个簇，每个簇的中心是该簇所有点的均值。', level: 'sub' as const, x: 450, y: 320 },
    { title: '主成分分析', content: 'PCA 是常用的降维技术，通过正交变换将高维数据投影到低维空间，保留最大方差。', level: 'sub' as const, x: 550, y: 320 },
    { title: '神经网络', content: '神经网络由输入层、隐藏层和输出层组成，通过反向传播算法调整权重进行学习。', level: 'sub' as const, x: 700, y: 320 },
    { title: '卷积神经网络', content: 'CNN 专门用于处理网格状数据，如图像。核心组件包括卷积层、池化层和全连接层。', level: 'sub' as const, x: 800, y: 320 },
    { title: '循环神经网络', content: 'RNN 适用于序列数据，具有记忆能力。LSTM 和 GRU 是解决长期依赖问题的变体。', level: 'sub' as const, x: 900, y: 320 },
    { title: 'Transformer', content: 'Transformer 使用自注意力机制处理序列数据，是 BERT、GPT 等模型的基础架构。', level: 'leaf' as const, x: 800, y: 450 },
    { title: '随机森林', content: '随机森林是集成学习方法，通过组合多个决策树提高预测准确性和稳定性。', level: 'leaf' as const, x: 250, y: 450 },
  ],
  edges: [
    { source: '机器学习', target: '监督学习' },
    { source: '机器学习', target: '无监督学习' },
    { source: '机器学习', target: '深度学习' },
    { source: '监督学习', target: '线性回归' },
    { source: '监督学习', target: '逻辑回归' },
    { source: '监督学习', target: '决策树' },
    { source: '监督学习', target: '支持向量机' },
    { source: '无监督学习', target: 'K-Means聚类' },
    { source: '无监督学习', target: '主成分分析' },
    { source: '深度学习', target: '神经网络' },
    { source: '深度学习', target: '卷积神经网络' },
    { source: '深度学习', target: '循环神经网络' },
    { source: '神经网络', target: '卷积神经网络', type: 'related' },
    { source: '神经网络', target: '循环神经网络', type: 'related' },
    { source: '循环神经网络', target: 'Transformer' },
    { source: '决策树', target: '随机森林' },
  ],
};

const ENGLISH_LEARNING_GRAPH: GraphData = {
  title: '英语学习',
  description: '英语学习的完整知识体系，涵盖语法、词汇、听力、口语等核心技能',
  nodes: [
    { title: '英语学习', content: '英语学习是一个综合性的过程，包括听、说、读、写四个方面。需要系统学习语法、积累词汇、练习听说读写技能。', level: 'root' as const, x: 500, y: 50 },
    { title: '语法', content: '英语语法是语言的规则体系，包括词法（单词变化）和句法（句子结构）。掌握语法是正确表达的基础。', level: 'core' as const, x: 200, y: 180 },
    { title: '词汇', content: '词汇是语言的基本单位。英语词汇量庞大，需要通过词根词缀、语境记忆等方法系统积累。', level: 'core' as const, x: 500, y: 180 },
    { title: '听力', content: '听力是语言输入的重要途径。通过精听和泛听相结合，逐步提高理解能力和语感。', level: 'core' as const, x: 800, y: 180 },
    { title: '口语', content: '口语是语言输出的核心技能。需要大量练习发音、语调、流利度和表达能力。', level: 'core' as const, x: 1000, y: 180 },
    { title: '时态', content: '英语有12种基本时态，包括现在、过去、将来及其进行、完成、完成进行形式。', level: 'sub' as const, x: 50, y: 320 },
    { title: '从句', content: '从句包括名词性从句、定语从句和状语从句，是构建复杂句子的关键。', level: 'sub' as const, x: 150, y: 320 },
    { title: '虚拟语气', content: '虚拟语气表达假设、愿望等非真实情况，有特定的动词形式规则。', level: 'sub' as const, x: 250, y: 320 },
    { title: '词根词缀', content: '词根词缀是记忆单词的有效方法。常见前缀如 un-、re-，后缀如 -tion、-able。', level: 'sub' as const, x: 400, y: 320 },
    { title: '高频词汇', content: '高频词汇是日常交流中最常用的单词，掌握3000个高频词可覆盖90%日常内容。', level: 'sub' as const, x: 500, y: 320 },
    { title: '学术词汇', content: '学术词汇用于学术写作和讨论，如 analyze、hypothesis、methodology 等。', level: 'sub' as const, x: 600, y: 320 },
    { title: '精听训练', content: '精听是逐字逐句听写，关注细节，适合提高听力准确度。', level: 'sub' as const, x: 750, y: 320 },
    { title: '泛听训练', content: '泛听是大量接触听力材料，关注整体理解，适合培养语感。', level: 'sub' as const, x: 850, y: 320 },
    { title: '发音技巧', content: '发音技巧包括连读、弱读、重音、语调等，是流利口语的关键。', level: 'sub' as const, x: 950, y: 320 },
    { title: '口语表达', content: '口语表达需要积累常用句型、习语和会话策略，提高交流能力。', level: 'leaf' as const, x: 1050, y: 320 },
    { title: '现在完成时', content: '现在完成时表示过去发生的动作对现在造成的影响，结构为 have/has + 过去分词。', level: 'leaf' as const, x: 50, y: 450 },
  ],
  edges: [
    { source: '英语学习', target: '语法' },
    { source: '英语学习', target: '词汇' },
    { source: '英语学习', target: '听力' },
    { source: '英语学习', target: '口语' },
    { source: '语法', target: '时态' },
    { source: '语法', target: '从句' },
    { source: '语法', target: '虚拟语气' },
    { source: '词汇', target: '词根词缀' },
    { source: '词汇', target: '高频词汇' },
    { source: '词汇', target: '学术词汇' },
    { source: '听力', target: '精听训练' },
    { source: '听力', target: '泛听训练' },
    { source: '口语', target: '发音技巧' },
    { source: '口语', target: '口语表达' },
    { source: '时态', target: '现在完成时' },
    { source: '精听训练', target: '泛听训练', type: 'related' },
  ],
};

const MATH_FOUNDATION_GRAPH: GraphData = {
  title: '数学基础',
  description: '数学基础知识体系，包括代数、几何、微积分等核心数学领域',
  nodes: [
    { title: '数学基础', content: '数学是研究数量、结构、变化和空间的学科。数学基础包括代数、几何、分析等分支，是理工科学习的重要工具。', level: 'root' as const, x: 500, y: 50 },
    { title: '代数', content: '代数研究数学符号和运算规则，包括方程、函数、矩阵等。是解决数学问题的基础工具。', level: 'core' as const, x: 200, y: 180 },
    { title: '几何', content: '几何研究空间形状、大小和位置关系。包括平面几何、立体几何和解析几何。', level: 'core' as const, x: 500, y: 180 },
    { title: '微积分', content: '微积分研究变化率和累积量，是现代数学的基础。包括微分学和积分学两大部分。', level: 'core' as const, x: 800, y: 180 },
    { title: '方程', content: '方程是含有未知数的等式。包括一元方程、方程组、不等式等，是代数的核心内容。', level: 'sub' as const, x: 50, y: 320 },
    { title: '函数', content: '函数描述变量之间的对应关系。常见函数类型有线性函数、二次函数、指数函数等。', level: 'sub' as const, x: 150, y: 320 },
    { title: '矩阵', content: '矩阵是按行列排列的数表，广泛应用于线性代数、计算机图形学等领域。', level: 'sub' as const, x: 250, y: 320 },
    { title: '平面几何', content: '平面几何研究二维平面上的图形，如三角形、圆、多边形等。', level: 'sub' as const, x: 400, y: 320 },
    { title: '立体几何', content: '立体几何研究三维空间中的图形，如棱柱、圆锥、球体等。', level: 'sub' as const, x: 500, y: 320 },
    { title: '解析几何', content: '解析几何用代数方法研究几何问题，将图形与方程对应起来。', level: 'sub' as const, x: 600, y: 320 },
    { title: '导数', content: '导数描述函数在某点的变化率，是微分学的核心概念。', level: 'sub' as const, x: 750, y: 320 },
    { title: '积分', content: '积分计算曲线下的面积，是积分学的核心概念。定积分和不定积分是两种基本形式。', level: 'sub' as const, x: 850, y: 320 },
    { title: '微分方程', content: '微分方程是含有导数的方程，广泛应用于物理、工程等领域建模。', level: 'leaf' as const, x: 850, y: 450 },
    { title: '三角函数', content: '三角函数描述角度与边长的关系，包括正弦、余弦、正切等函数。', level: 'leaf' as const, x: 350, y: 450 },
  ],
  edges: [
    { source: '数学基础', target: '代数' },
    { source: '数学基础', target: '几何' },
    { source: '数学基础', target: '微积分' },
    { source: '代数', target: '方程' },
    { source: '代数', target: '函数' },
    { source: '代数', target: '矩阵' },
    { source: '几何', target: '平面几何' },
    { source: '几何', target: '立体几何' },
    { source: '几何', target: '解析几何' },
    { source: '微积分', target: '导数' },
    { source: '微积分', target: '积分' },
    { source: '导数', target: '微分方程' },
    { source: '函数', target: '三角函数' },
    { source: '导数', target: '积分', type: 'related' },
  ],
};

const LINEAR_CHAIN_GRAPH: GraphData = {
  title: '线性链式图谱',
  description: '节点按顺序连接形成链状结构，用于测试线性遍历和顺序依赖',
  nodes: [
    { title: '步骤1-需求分析', content: '需求分析是软件开发的第一步，明确用户需求和系统功能。', level: 'root' as const, x: 100, y: 200 },
    { title: '步骤2-系统设计', content: '系统设计根据需求制定架构方案，包括技术选型和模块划分。', level: 'core' as const, x: 250, y: 200 },
    { title: '步骤3-编码实现', content: '编码实现是将设计转化为可执行代码的过程。', level: 'core' as const, x: 400, y: 200 },
    { title: '步骤4-单元测试', content: '单元测试验证每个模块的功能正确性。', level: 'core' as const, x: 550, y: 200 },
    { title: '步骤5-集成测试', content: '集成测试验证模块之间的协作是否正常。', level: 'core' as const, x: 700, y: 200 },
    { title: '步骤6-系统测试', content: '系统测试验证整个系统是否满足需求规格。', level: 'core' as const, x: 850, y: 200 },
    { title: '步骤7-部署上线', content: '部署上线将系统发布到生产环境供用户使用。', level: 'core' as const, x: 1000, y: 200 },
    { title: '步骤8-运维监控', content: '运维监控系统运行状态，及时发现和处理问题。', level: 'leaf' as const, x: 1150, y: 200 },
  ],
  edges: [
    { source: '步骤1-需求分析', target: '步骤2-系统设计' },
    { source: '步骤2-系统设计', target: '步骤3-编码实现' },
    { source: '步骤3-编码实现', target: '步骤4-单元测试' },
    { source: '步骤4-单元测试', target: '步骤5-集成测试' },
    { source: '步骤5-集成测试', target: '步骤6-系统测试' },
    { source: '步骤6-系统测试', target: '步骤7-部署上线' },
    { source: '步骤7-部署上线', target: '步骤8-运维监控' },
  ],
};

const DEEP_TREE_GRAPH: GraphData = {
  title: '深层树形图谱',
  description: '多层树形结构，深度至少4层，用于测试层级遍历和树形渲染',
  nodes: [
    { title: '根节点', content: '这是深层树形图谱的根节点，深度为第1层。', level: 'root' as const, x: 500, y: 30 },
    { title: '一级节点A', content: '一级节点A，深度为第2层。', level: 'core' as const, x: 250, y: 120 },
    { title: '一级节点B', content: '一级节点B，深度为第2层。', level: 'core' as const, x: 500, y: 120 },
    { title: '一级节点C', content: '一级节点C，深度为第2层。', level: 'core' as const, x: 750, y: 120 },
    { title: '二级节点A1', content: '二级节点A1，深度为第3层。', level: 'sub' as const, x: 150, y: 210 },
    { title: '二级节点A2', content: '二级节点A2，深度为第3层。', level: 'sub' as const, x: 300, y: 210 },
    { title: '二级节点B1', content: '二级节点B1，深度为第3层。', level: 'sub' as const, x: 450, y: 210 },
    { title: '二级节点B2', content: '二级节点B2，深度为第3层。', level: 'sub' as const, x: 550, y: 210 },
    { title: '二级节点C1', content: '二级节点C1，深度为第3层。', level: 'sub' as const, x: 700, y: 210 },
    { title: '二级节点C2', content: '二级节点C2，深度为第3层。', level: 'sub' as const, x: 850, y: 210 },
    { title: '三级节点A1a', content: '三级节点A1a，深度为第4层。', level: 'leaf' as const, x: 100, y: 300 },
    { title: '三级节点A1b', content: '三级节点A1b，深度为第4层。', level: 'leaf' as const, x: 180, y: 300 },
    { title: '三级节点A2a', content: '三级节点A2a，深度为第4层。', level: 'leaf' as const, x: 260, y: 300 },
    { title: '三级节点B1a', content: '三级节点B1a，深度为第4层。', level: 'leaf' as const, x: 420, y: 300 },
    { title: '三级节点B2a', content: '三级节点B2a，深度为第4层。', level: 'leaf' as const, x: 520, y: 300 },
    { title: '三级节点C1a', content: '三级节点C1a，深度为第4层。', level: 'leaf' as const, x: 670, y: 300 },
    { title: '三级节点C2a', content: '三级节点C2a，深度为第4层。', level: 'leaf' as const, x: 820, y: 300 },
    { title: '三级节点C2b', content: '三级节点C2b，深度为第4层。', level: 'leaf' as const, x: 900, y: 300 },
    { title: '四级节点A1a1', content: '四级节点A1a1，深度为第5层。', level: 'leaf' as const, x: 70, y: 390 },
    { title: '四级节点A1a2', content: '四级节点A1a2，深度为第5层。', level: 'leaf' as const, x: 130, y: 390 },
    { title: '四级节点C2b1', content: '四级节点C2b1，深度为第5层。', level: 'leaf' as const, x: 870, y: 390 },
    { title: '四级节点C2b2', content: '四级节点C2b2，深度为第5层。', level: 'leaf' as const, x: 930, y: 390 },
  ],
  edges: [
    { source: '根节点', target: '一级节点A' },
    { source: '根节点', target: '一级节点B' },
    { source: '根节点', target: '一级节点C' },
    { source: '一级节点A', target: '二级节点A1' },
    { source: '一级节点A', target: '二级节点A2' },
    { source: '一级节点B', target: '二级节点B1' },
    { source: '一级节点B', target: '二级节点B2' },
    { source: '一级节点C', target: '二级节点C1' },
    { source: '一级节点C', target: '二级节点C2' },
    { source: '二级节点A1', target: '三级节点A1a' },
    { source: '二级节点A1', target: '三级节点A1b' },
    { source: '二级节点A2', target: '三级节点A2a' },
    { source: '二级节点B1', target: '三级节点B1a' },
    { source: '二级节点B2', target: '三级节点B2a' },
    { source: '二级节点C1', target: '三级节点C1a' },
    { source: '二级节点C2', target: '三级节点C2a' },
    { source: '二级节点C2', target: '三级节点C2b' },
    { source: '三级节点A1a', target: '四级节点A1a1' },
    { source: '三级节点A1a', target: '四级节点A1a2' },
    { source: '三级节点C2b', target: '四级节点C2b1' },
    { source: '三级节点C2b', target: '四级节点C2b2' },
  ],
};

const BOUNDARY_STUDY_CARDS = [
  { nodeTitle: '唯一的节点', question: '未学习卡片测试：这是未学习过的卡片问题？', answer: '这是未学习卡片的答案。', explanation: '此卡片 review_count = 0，用于测试未学习状态。', cardType: 'qa', difficulty: 2, reviewCount: 0, masteryLevel: 0 },
  { nodeTitle: 'let 和 const', question: '已掌握卡片测试：let 和 const 的主要区别是什么？', answer: 'let 声明可变变量，const 声明常量，两者都是块级作用域。', explanation: '此卡片 mastery_level >= 5, review_count >= 10，用于测试已掌握状态。', cardType: 'qa', difficulty: 2, reviewCount: 12, masteryLevel: 6 },
  { nodeTitle: 'var 关键字', question: '高难度卡片测试：var 关键字的变量提升机制是如何工作的？请详细解释。', answer: 'var 声明的变量会被提升到函数作用域顶部，但赋值不会提升。这意味着变量在声明前就可以访问，值为 undefined。', explanation: '此卡片 difficulty = 5，用于测试高难度卡片。', cardType: 'qa', difficulty: 5, reviewCount: 3, masteryLevel: 1 },
  { nodeTitle: '数据类型转换', question: '选择题测试：以下哪个方法可以将字符串转换为数字？', answer: 'Number()', explanation: 'Number()、parseInt()、parseFloat() 都可以转换，但 Number() 是最直接的。', cardType: 'choice', difficulty: 1, reviewCount: 2, masteryLevel: 2 },
  { nodeTitle: '箭头函数', question: '判断题测试：箭头函数有自己的 this 绑定。', answer: 'false', explanation: '箭头函数没有自己的 this，它会捕获定义时所在上下文的 this 值。', cardType: 'true_false', difficulty: 2, reviewCount: 4, masteryLevel: 3 },
  { nodeTitle: '闭包', question: '填空题测试：闭包是指函数能够访问其 ___ 作用域中的变量。', answer: '词法', explanation: '闭包让函数可以访问定义时的词法作用域，即使在作用域外执行。', cardType: 'fill_in_the_blank', difficulty: 3, reviewCount: 5, masteryLevel: 3 },
];

const STUDY_CARDS = [
  { nodeTitle: '函数', question: '什么是 JavaScript 中的闭包？请举例说明它的应用场景。', answer: '闭包是指函数能够访问其词法作用域外的变量，即使该函数在其原始作用域之外执行。', explanation: '闭包的核心概念是函数和其词法环境的组合。常见应用包括：数据私有化、函数工厂、模块模式。', cardType: 'qa', difficulty: 3 },
  { nodeTitle: 'Promise', question: 'Promise 有哪几种状态？状态之间如何转换？', answer: 'Promise 有三种状态：pending（进行中）、fulfilled（已成功）、rejected（已失败）。', explanation: '状态转换规则：pending 可以变为 fulfilled 或 rejected，状态一旦改变就不可逆。', cardType: 'qa', difficulty: 2 },
  { nodeTitle: 'let 和 const', question: '以下哪个关键字声明的变量具有块级作用域？', answer: 'let', explanation: 'let 和 const 都是 ES6 引入的块级作用域变量声明方式。', cardType: 'choice', difficulty: 1 },
  { nodeTitle: 'ES6 Class', question: 'ES6 的 class 本质上是 JavaScript 原型继承的语法糖。', answer: 'true', explanation: 'class 语法并没有引入新的面向对象继承模型，它仍然是基于原型的继承。', cardType: 'true_false', difficulty: 2 },
  { nodeTitle: 'async/await', question: 'async 函数返回一个 ___ 对象，await 只能在 ___ 函数内部使用。', answer: 'Promise, async', explanation: 'async 函数总是返回一个 Promise 对象。', cardType: 'fill_in_the_blank', difficulty: 2 },
  { nodeTitle: 'useState', question: 'useState Hook 返回什么？', answer: 'useState 返回一个数组：当前状态值和更新状态的函数。', explanation: '可以通过数组解构获取：const [state, setState] = useState(initialValue)。', cardType: 'qa', difficulty: 1 },
  { nodeTitle: 'useEffect', question: 'useEffect 的第二个参数有什么作用？', answer: '第二个参数是依赖数组，控制 effect 的执行时机。空数组表示只在挂载时执行一次。', explanation: '不传第二个参数则每次渲染都执行，传入依赖项则只在依赖变化时执行。', cardType: 'qa', difficulty: 2 },
  { nodeTitle: 'DataFrame', question: 'Pandas DataFrame 和 NumPy ndarray 的主要区别是什么？', answer: 'DataFrame 支持异构数据类型和标签索引，ndarray 只支持同构数据类型和数值索引。', explanation: 'DataFrame 更适合处理表格数据，ndarray 更适合数值计算。', cardType: 'qa', difficulty: 2 },
  { nodeTitle: 'NumPy', question: 'NumPy 的广播机制是什么？', answer: '广播机制允许不同形状的数组进行算术运算，自动扩展较小的数组。', explanation: '广播规则：从右向左比较维度，维度相等或其中一个为1时可以广播。', cardType: 'qa', difficulty: 3 },
];

const ML_STUDY_CARDS = [
  { nodeTitle: '监督学习', question: '监督学习和无监督学习的主要区别是什么？', answer: '监督学习使用标记数据训练，无监督学习使用未标记数据发现模式。', explanation: '监督学习需要人工标注的标签，适合分类和回归任务；无监督学习适合聚类和降维。', cardType: 'qa', difficulty: 2 },
  { nodeTitle: '线性回归', question: '线性回归的目标是什么？', answer: '找到最佳拟合直线（或超平面），使预测值与实际值的误差最小。', explanation: '通常使用最小二乘法求解，目标是最小化均方误差（MSE）。', cardType: 'qa', difficulty: 1 },
  { nodeTitle: '决策树', question: '决策树选择分裂特征的标准有哪些？', answer: '信息增益、信息增益率、基尼系数。', explanation: 'ID3 使用信息增益，C4.5 使用信息增益率，CART 使用基尼系数。', cardType: 'choice', difficulty: 3 },
  { nodeTitle: '神经网络', question: '神经网络的反向传播算法的作用是什么？', answer: '反向传播用于计算损失函数对各层权重的梯度，从而更新权重。', explanation: '通过链式法则从输出层向输入层逐层计算梯度，是训练神经网络的核心算法。', cardType: 'qa', difficulty: 3 },
  { nodeTitle: '卷积神经网络', question: 'CNN 中的池化层有什么作用？', answer: '池化层用于降维、减少计算量、提取主要特征、增加平移不变性。', explanation: '常见的池化方式有最大池化和平均池化。', cardType: 'qa', difficulty: 2 },
  { nodeTitle: 'K-Means聚类', question: 'K-Means 算法的 K 值如何确定？', answer: '可以使用肘部法则、轮廓系数、Gap Statistic 等方法确定。', explanation: '肘部法则通过观察误差平方和随 K 值变化的拐点来确定最佳 K 值。', cardType: 'qa', difficulty: 3 },
  { nodeTitle: 'Transformer', question: 'Transformer 的自注意力机制计算公式是什么？', answer: 'Attention(Q,K,V) = softmax(QK^T/√d_k)V', explanation: 'Q、K、V 分别代表查询、键、值矩阵，d_k 是键的维度，用于缩放。', cardType: 'fill_in_the_blank', difficulty: 5 },
  { nodeTitle: '随机森林', question: '随机森林比单一决策树更优的原因是什么？', answer: '随机森林通过集成多个决策树，减少过拟合，提高泛化能力。', explanation: '每棵树使用不同的数据子集和特征子集，增加了模型的多样性。', cardType: 'qa', difficulty: 2 },
  { nodeTitle: '主成分分析', question: 'PCA 降维后保留了数据的什么信息？', answer: 'PCA 保留了数据中方差最大的方向，即数据变化最显著的特征。', explanation: '第一主成分保留最大方差，第二主成分保留次大方差，以此类推。', cardType: 'qa', difficulty: 3 },
  { nodeTitle: '支持向量机', question: 'SVM 的核函数有什么作用？', answer: '核函数将低维非线性可分数据映射到高维空间，使其线性可分。', explanation: '常用核函数包括线性核、多项式核、RBF 核（高斯核）。', cardType: 'qa', difficulty: 4 },
];

const ENGLISH_STUDY_CARDS = [
  { nodeTitle: '时态', question: '英语共有多少种基本时态？', answer: '12种基本时态。', explanation: '包括现在、过去、将来、过去将来四个时间，各有一般、进行、完成、完成进行四种形式。', cardType: 'qa', difficulty: 1 },
  { nodeTitle: '现在完成时', question: '现在完成时的结构是什么？', answer: 'have/has + 过去分词', explanation: '主语是第三人称单数用 has，其他用 have。', cardType: 'fill_in_the_blank', difficulty: 1 },
  { nodeTitle: '从句', question: '定语从句中，which 和 that 的主要区别是什么？', answer: 'which 用于非限制性定语从句，that 用于限制性定语从句。', explanation: '在非限制性定语从句中只能用 which，不能用 that。', cardType: 'qa', difficulty: 3 },
  { nodeTitle: '虚拟语气', question: 'If I ___ (be) you, I would accept the offer. 填入正确形式。', answer: 'were', explanation: '虚拟语气中，be 动词在所有人称中都用 were。', cardType: 'fill_in_the_blank', difficulty: 2 },
  { nodeTitle: '词根词缀', question: '前缀 un- 通常表示什么含义？', answer: '否定、相反、取消。', explanation: '如 unhappy（不快乐）、undo（撤销）、unfair（不公平）。', cardType: 'qa', difficulty: 1 },
  { nodeTitle: '高频词汇', question: '掌握多少个高频词汇可以覆盖90%的日常英语内容？', answer: '约3000个', explanation: '这些词汇是日常交流中最常用的核心词汇。', cardType: 'choice', difficulty: 1 },
  { nodeTitle: '精听训练', question: '精听训练的主要目的是什么？', answer: '提高听力准确度，关注语音细节。', explanation: '精听强调逐字逐句听写，适合提高对语音细节的敏感度。', cardType: 'qa', difficulty: 2 },
  { nodeTitle: '发音技巧', question: '英语中的连读规则有哪些？', answer: '辅音+元音连读、元音+元音连读、r/re+元音连读。', explanation: '连读使口语更流利自然，是地道口语的重要特征。', cardType: 'qa', difficulty: 3 },
];

const MATH_STUDY_CARDS = [
  { nodeTitle: '方程', question: '一元二次方程 ax² + bx + c = 0 的求根公式是什么？', answer: 'x = (-b ± √(b²-4ac)) / 2a', explanation: '判别式 Δ = b²-4ac 决定根的性质：Δ>0 两不等实根，Δ=0 两相等实根，Δ<0 两共轭复根。', cardType: 'qa', difficulty: 2 },
  { nodeTitle: '函数', question: '函数的三要素是什么？', answer: '定义域、值域、对应法则。', explanation: '函数描述了定义域到值域的映射关系。', cardType: 'qa', difficulty: 1 },
  { nodeTitle: '导数', question: '函数 f(x) = x² 的导数是什么？', answer: 'f\'(x) = 2x', explanation: '根据幂函数求导法则，(x^n)\' = nx^(n-1)。', cardType: 'qa', difficulty: 2 },
  { nodeTitle: '积分', question: '∫2x dx 等于什么？', answer: 'x² + C（C为常数）', explanation: '不定积分的结果需要加上积分常数 C。', cardType: 'fill_in_the_blank', difficulty: 2 },
  { nodeTitle: '矩阵', question: '矩阵乘法满足交换律吗？', answer: '不满足', explanation: '矩阵乘法一般不满足交换律，AB ≠ BA。', cardType: 'true_false', difficulty: 2 },
  { nodeTitle: '三角函数', question: 'sin²θ + cos²θ 等于什么？', answer: '1', explanation: '这是最基本的三角恒等式。', cardType: 'qa', difficulty: 1 },
  { nodeTitle: '微分方程', question: '一阶线性微分方程的标准形式是什么？', answer: 'dy/dx + P(x)y = Q(x)', explanation: '可以使用积分因子法求解，积分因子为 e^∫P(x)dx。', cardType: 'qa', difficulty: 4 },
  { nodeTitle: '平面几何', question: '三角形的内角和是多少度？', answer: '180度', explanation: '这是平面几何的基本定理之一。', cardType: 'qa', difficulty: 1 },
];

const CHAIN_STUDY_CARDS = [
  { nodeTitle: '步骤1-需求分析', question: '需求分析阶段的主要产出是什么？', answer: '需求规格说明书（SRS）', explanation: '需求规格说明书详细描述系统的功能需求和非功能需求。', cardType: 'qa', difficulty: 1 },
  { nodeTitle: '步骤2-系统设计', question: '系统设计包括哪两个层次？', answer: '概要设计和详细设计', explanation: '概要设计确定系统架构，详细设计确定模块实现细节。', cardType: 'qa', difficulty: 2 },
  { nodeTitle: '步骤3-编码实现', question: '编码阶段应该遵循什么原则？', answer: '代码规范、可读性、可维护性', explanation: '良好的编码习惯包括命名规范、注释、代码复用等。', cardType: 'qa', difficulty: 1 },
  { nodeTitle: '步骤4-单元测试', question: '单元测试的目的是什么？', answer: '验证每个模块的功能正确性', explanation: '单元测试是最小粒度的测试，通常由开发人员编写。', cardType: 'qa', difficulty: 1 },
  { nodeTitle: '步骤5-集成测试', question: '集成测试和单元测试的区别是什么？', answer: '单元测试测试单个模块，集成测试测试模块间的协作', explanation: '集成测试关注模块接口和数据传递是否正确。', cardType: 'qa', difficulty: 2 },
  { nodeTitle: '步骤6-系统测试', question: '系统测试包括哪些类型？', answer: '功能测试、性能测试、安全测试、兼容性测试等', explanation: '系统测试是端到端的测试，验证整个系统是否满足需求。', cardType: 'choice', difficulty: 2 },
  { nodeTitle: '步骤7-部署上线', question: '部署上线前需要进行什么检查？', answer: '代码审查、测试通过、文档完善、回滚方案准备', explanation: '确保系统稳定性和可恢复性是上线前的重要准备工作。', cardType: 'qa', difficulty: 2 },
  { nodeTitle: '步骤8-运维监控', question: '运维监控的主要指标有哪些？', answer: 'CPU使用率、内存使用率、响应时间、错误率等', explanation: '监控指标帮助及时发现系统异常和性能瓶颈。', cardType: 'qa', difficulty: 2 },
];

async function createTestUser() {
  console.log('🔧 Creating test user...');
  
  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find((u: { email: string }) => u.email === TEST_USER.email);
  
  if (existingUser) {
    console.log('✅ Test user already exists:', existingUser.id);
    return existingUser;
  }
  
  const { data, error } = await supabase.auth.admin.createUser({
    email: TEST_USER.email,
    password: TEST_USER.password,
    email_confirm: true,
    user_metadata: {
      name: TEST_USER.name,
    },
  });
  
  if (error) {
    console.error('❌ Error creating user:', error);
    throw error;
  }
  
  console.log('✅ Test user created:', data.user.id);
  return data.user;
}

async function updateUserProfile(userId: string) {
  console.log('🔧 Updating user profile...');
  
  const { error } = await supabase
    .from('users')
    .update({
      plan: 'premium',
      xp: 2500,
      level: 8,
      settings: { theme: 'dark', language: 'zh-CN', notifications: true },
    })
    .eq('id', userId);
  
  if (error) {
    console.error('❌ Error updating profile:', error);
    throw error;
  }
  
  console.log('✅ User profile updated');
}

async function createKnowledgeGraphWithData(userId: string, graphData: GraphData) {
  console.log(`🔧 Creating graph "${graphData.title}"...`);
  
  const { data: existing } = await supabase
    .from('knowledge_graphs')
    .select('id')
    .eq('user_id', userId)
    .eq('title', graphData.title)
    .single();
  
  if (existing) {
    console.log(`  ⏭️  Graph "${graphData.title}" already exists`);
    
    const { data: existingKnowledgePoints } = await supabase
      .from('graph_nodes')
      .select('knowledge_point_id, knowledge_points(title)')
      .eq('graph_id', existing.id);
    
    const nodeMap: Record<string, string> = {};
    for (const gn of existingKnowledgePoints || []) {
      const kp = gn.knowledge_points as unknown as { title: string }[] | null;
      if (kp && kp.length > 0) {
        nodeMap[kp[0].title] = gn.knowledge_point_id;
      }
    }
    
    return { graphId: existing.id, nodeMap };
  }
  
  const { data: graph, error: graphError } = await supabase
    .from('knowledge_graphs')
    .insert({
      user_id: userId,
      title: graphData.title,
      description: graphData.description,
      is_public: true,
      is_favorite: graphData.title === 'JavaScript 基础知识',
      settings: { layout: 'force-directed', theme: 'default' },
    })
    .select('id')
    .single();
  
  if (graphError || !graph) {
    console.error(`  ❌ Error creating graph:`, graphError);
    return null;
  }
  
  console.log(`  ✅ Graph "${graphData.title}" created`);
  
  const knowledgePointMap: Record<string, string> = {};
  
  for (const node of graphData.nodes) {
    const { data, error } = await supabase
      .from('knowledge_points')
      .insert({
        title: node.title,
        content: node.content,
        owner_id: userId,
        visibility: 'private',
      })
      .select('id')
      .single();
    
    if (error) {
      console.error(`  ❌ Error creating knowledge point "${node.title}":`, error);
      continue;
    }
    
    knowledgePointMap[node.title] = data.id;
    
    await supabase
      .from('graph_nodes')
      .insert({
        graph_id: graph.id,
        knowledge_point_id: data.id,
        level: node.level,
        x_position: node.x,
        y_position: node.y,
        is_accepted: true,
      });
  }
  
  for (const edge of graphData.edges) {
    const sourceKPId = knowledgePointMap[edge.source];
    const targetKPId = knowledgePointMap[edge.target];
    
    if (!sourceKPId || !targetKPId) continue;
    
    await supabase
      .from('edges')
      .insert({
        graph_id: graph.id,
        source_knowledge_point_id: sourceKPId,
        target_knowledge_point_id: targetKPId,
        relationship_type: edge.type || 'contains',
        weight: edge.type === 'related' ? 2 : 1,
      });
  }
  
  console.log(`  ✅ Nodes and edges created for "${graphData.title}"`);
  
  return { graphId: graph.id, nodeMap: knowledgePointMap };
}

async function createStudyCardsForGraph(userId: string, graphId: string, nodeMap: Record<string, string>, graphTitle: string) {
  console.log(`🔧 Creating study cards for "${graphTitle}"...`);
  
  const relevantCards = STUDY_CARDS.filter(card => {
    const nodeTitle = card.nodeTitle;
    return nodeMap[nodeTitle];
  });
  
  for (const card of relevantCards) {
    const knowledgePointId = nodeMap[card.nodeTitle];
    if (!knowledgePointId) continue;
    
    const { error } = await supabase
      .from('study_cards')
      .insert({
        knowledge_point_id: knowledgePointId,
        user_id: userId,
        graph_id: graphId,
        source_graph_id: graphId,
        question: card.question,
        answer: card.answer,
        explanation: card.explanation,
        card_type: card.cardType,
        difficulty: card.difficulty,
        review_count: Math.floor(Math.random() * 5),
      });
    
    if (!error) {
      console.log(`  ✅ Study card for "${card.nodeTitle}" created`);
    }
  }
}

async function createBoundaryStudyCards(userId: string, allNodeMaps: Record<string, Record<string, string>>) {
  console.log('🔧 Creating boundary study cards...');
  
  for (const card of BOUNDARY_STUDY_CARDS) {
    let knowledgePointId: string | undefined;
    let graphId: string | undefined;
    
    for (const [graphTitle, nodeMap] of Object.entries(allNodeMaps)) {
      if (nodeMap[card.nodeTitle]) {
        knowledgePointId = nodeMap[card.nodeTitle];
        graphId = nodeMap.__graphId;
        break;
      }
    }
    
    if (!knowledgePointId || !graphId) {
      console.log(`  ⏭️  Skipping card for "${card.nodeTitle}" - node not found`);
      continue;
    }
    
    const { error } = await supabase
      .from('study_cards')
      .insert({
        knowledge_point_id: knowledgePointId,
        user_id: userId,
        graph_id: graphId,
        source_graph_id: graphId,
        question: card.question,
        answer: card.answer,
        explanation: card.explanation,
        card_type: card.cardType,
        difficulty: card.difficulty,
        review_count: card.reviewCount,
        mastery_level: card.masteryLevel,
      });
    
    if (!error) {
      console.log(`  ✅ Boundary study card for "${card.nodeTitle}" created (review_count=${card.reviewCount}, mastery_level=${card.masteryLevel})`);
    }
  }
}

async function createStudyProgress(userId: string, graphId: string, totalNodes: number) {
  const masteredNodes = Math.floor(totalNodes * 0.4);
  
  await supabase
    .from('study_progress')
    .upsert({
      user_id: userId,
      graph_id: graphId,
      total_nodes: totalNodes,
      mastered_nodes: masteredNodes,
      progress_percentage: (masteredNodes / totalNodes) * 100,
      study_streak: Math.floor(Math.random() * 7) + 1,
    }, { onConflict: 'user_id,graph_id' });
}

async function createIsolatedNodes(userId: string, graphId: string) {
  console.log('🔧 Creating isolated nodes...');
  
  const isolatedNodes = [
    { title: '孤立节点1', content: '这是一个没有连接边的孤立节点，用于测试边界条件。', level: 'sub' as const, x: 50, y: 500 },
    { title: '孤立节点2', content: '这是另一个没有连接边的孤立节点。', level: 'leaf' as const, x: 200, y: 500 },
    { title: '孤立节点3', content: '第三个孤立节点，用于测试孤立节点的显示和处理。', level: 'leaf' as const, x: 350, y: 500 },
  ];
  
  for (const node of isolatedNodes) {
    const { data, error } = await supabase
      .from('knowledge_points')
      .insert({
        title: node.title,
        content: node.content,
        owner_id: userId,
        visibility: 'private',
      })
      .select('id')
      .single();
    
    if (error) {
      console.error(`  ❌ Error creating isolated node "${node.title}":`, error);
      continue;
    }
    
    await supabase
      .from('graph_nodes')
      .insert({
        graph_id: graphId,
        knowledge_point_id: data.id,
        level: node.level,
        x_position: node.x,
        y_position: node.y,
        is_accepted: true,
      });
    
    console.log(`  ✅ Isolated node "${node.title}" created`);
  }
}

async function createScheduledTasks(userId: string) {
  console.log('🔧 Creating scheduled tasks...');
  
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  
  const tasks = [
    { title: '完成 JavaScript 异步编程学习', queueLevel: 0, position: 0, status: 'pending', estimatedDuration: 45, tags: ['学习', 'JavaScript'], priority: 'high' },
    { title: '复习 React Hooks', queueLevel: 0, position: 1, status: 'pending', estimatedDuration: 30, tags: ['学习', 'React'], priority: 'medium' },
    { title: '完成项目文档', queueLevel: 1, position: 0, status: 'pending', estimatedDuration: 60, tags: ['工作', '文档'], priority: 'high' },
    { title: '代码审查', queueLevel: 1, position: 1, status: 'in_progress', estimatedDuration: 30, tags: ['工作', '代码'], priority: 'medium' },
    { title: '学习 Pandas 数据处理', queueLevel: 1, position: 2, status: 'pending', estimatedDuration: 40, tags: ['学习', 'Python'], priority: 'low' },
    { title: '整理学习笔记', queueLevel: 2, position: 0, status: 'pending', estimatedDuration: 20, tags: ['学习', '笔记'], priority: 'low' },
    { title: '阅读技术文章', queueLevel: 2, position: 1, status: 'pending', estimatedDuration: 15, tags: ['学习', '阅读'], priority: 'low' },
    { title: '更新知识图谱', queueLevel: 2, position: 2, status: 'pending', estimatedDuration: 25, tags: ['学习', '知识管理'], priority: 'medium' },
    { title: '[边界测试] 过期任务-一周前创建', queueLevel: 0, position: 2, status: 'pending', estimatedDuration: 30, tags: ['测试', '过期'], createdAt: oneWeekAgo, priority: 'high' },
    { title: '[边界测试] 已完成任务1', queueLevel: 0, position: 3, status: 'completed', estimatedDuration: 45, tags: ['测试', '已完成'], priority: 'medium' },
    { title: '[边界测试] 已完成任务2', queueLevel: 1, position: 3, status: 'completed', estimatedDuration: 30, tags: ['测试', '已完成'], priority: 'low' },
    { title: '[边界测试] 已完成任务3', queueLevel: 2, position: 3, status: 'completed', estimatedDuration: 20, tags: ['测试', '已完成'], priority: 'low' },
    { title: '学习机器学习基础', queueLevel: 0, position: 4, status: 'pending', estimatedDuration: 90, tags: ['学习', '机器学习', 'AI'], priority: 'high' },
    { title: '完成英语听力练习', queueLevel: 0, position: 5, status: 'pending', estimatedDuration: 30, tags: ['学习', '英语', '听力'], priority: 'medium' },
    { title: '复习数学微积分', queueLevel: 1, position: 4, status: 'pending', estimatedDuration: 60, tags: ['学习', '数学'], priority: 'medium' },
    { title: '准备周报', queueLevel: 1, position: 5, status: 'pending', estimatedDuration: 20, tags: ['工作', '报告'], priority: 'high' },
    { title: '参加团队会议', queueLevel: 0, position: 6, status: 'pending', estimatedDuration: 60, tags: ['工作', '会议'], priority: 'high' },
    { title: '学习 TypeScript 高级特性', queueLevel: 1, position: 6, status: 'pending', estimatedDuration: 45, tags: ['学习', 'TypeScript'], priority: 'medium' },
    { title: '优化代码性能', queueLevel: 1, position: 7, status: 'pending', estimatedDuration: 120, tags: ['工作', '性能优化'], priority: 'high' },
    { title: '学习 Docker 容器化', queueLevel: 2, position: 4, status: 'pending', estimatedDuration: 60, tags: ['学习', 'DevOps', 'Docker'], priority: 'low' },
    { title: '整理项目依赖', queueLevel: 2, position: 5, status: 'pending', estimatedDuration: 30, tags: ['工作', '维护'], priority: 'low' },
    { title: '学习 GraphQL API', queueLevel: 2, position: 6, status: 'pending', estimatedDuration: 45, tags: ['学习', 'API', 'GraphQL'], priority: 'medium' },
    { title: '[边界测试] 高优先级紧急任务', queueLevel: 0, position: 7, status: 'pending', estimatedDuration: 15, tags: ['测试', '紧急'], priority: 'high', createdAt: twoDaysAgo },
    { title: '[边界测试] 长时间任务', queueLevel: 1, position: 8, status: 'pending', estimatedDuration: 180, tags: ['测试', '长时间'], priority: 'medium' },
    { title: '[边界测试] 短时间任务', queueLevel: 2, position: 7, status: 'pending', estimatedDuration: 5, tags: ['测试', '短时间'], priority: 'low' },
  ];
  
  const q2Tasks = [
    { title: 'Q2任务1-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务2-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务3-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务4-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务5-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务6-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务7-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务8-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务9-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务10-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务11-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务12-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
  ];
  
  let q2Position = 8;
  for (const q2Task of q2Tasks) {
    tasks.push({ ...q2Task, position: q2Position++ });
  }
  
  for (const task of tasks) {
    const insertData: Record<string, unknown> = {
      user_id: userId,
      title: task.title,
      queue_level: task.queueLevel,
      position: task.position,
      status: task.status,
      estimated_duration: task.estimatedDuration,
      tags: task.tags,
      priority: task.priority || 'medium',
    };
    
    if (task.createdAt) {
      insertData.created_at = task.createdAt;
    }
    
    const { error } = await supabase
      .from('user_tasks')
      .insert(insertData);
    
    if (!error) {
      console.log(`  ✅ Task "${task.title}" created (Q${task.queueLevel}, ${task.priority || 'medium'})`);
    }
  }
}

async function createTaskExecutions(userId: string) {
  console.log('🔧 Creating task execution history...');
  
  const executions = [
    { startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), duration: 1800, status: 'completed', queueLevel: 0 },
    { startedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), duration: 2700, status: 'completed', queueLevel: 1 },
    { startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), duration: 1500, status: 'completed', queueLevel: 0 },
    { startedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), duration: 900, status: 'interrupted', queueLevel: 1 },
    { startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), duration: 3600, status: 'completed', queueLevel: 0 },
  ];
  
  const { data: tasks } = await supabase
    .from('user_tasks')
    .select('id')
    .eq('user_id', userId)
    .limit(5);
  
  if (!tasks || tasks.length === 0) return;
  
  for (let i = 0; i < executions.length && i < tasks.length; i++) {
    const exec = executions[i];
    const endedAt = new Date(exec.startedAt.getTime() + exec.duration * 1000);
    
    await supabase
      .from('task_executions')
      .insert({
        task_id: tasks[i].id,
        user_id: userId,
        started_at: exec.startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        duration: exec.duration,
        status: exec.status,
        queue_level: exec.queueLevel,
      });
    
    console.log(`  ✅ Task execution created (${exec.status})`);
  }
}

async function createFocusSessions(userId: string) {
  console.log('🔧 Creating focus sessions...');
  
  const sessions = [
    { start: '30 minutes', duration: 25, mode: 'focus', pomodoroCount: 1 },
    { start: '2 hours', duration: 50, mode: 'focus', pomodoroCount: 2 },
    { start: '1 day', duration: 30, mode: 'focus', pomodoroCount: 1 },
    { start: '2 days', duration: 45, mode: 'focus', pomodoroCount: 2 },
    { start: '3 days', duration: 25, mode: 'focus', pomodoroCount: 1 },
    { start: '1 week', duration: 60, mode: 'focus', pomodoroCount: 3 },
  ];
  
  for (const session of sessions) {
    const startTime = new Date(Date.now() - parseTimeOffset(session.start));
    const endTime = new Date(startTime.getTime() + session.duration * 60 * 1000);
    
    const { error } = await supabase
      .from('focus_sessions')
      .insert({
        user_id: userId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration: session.duration * 60,
        mode: session.mode,
        completed: true,
        pomodoro_count: session.pomodoroCount,
      });
    
    if (!error) {
      console.log(`  ✅ Focus session created (${session.start} ago, ${session.duration}min)`);
    }
  }
}

async function createDailyTasks(userId: string) {
  console.log('🔧 Creating daily tasks...');
  
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const tasks = [
    { date: today, type: 'study_cards', status: 'completed', progress: 5, target: 5, xp: 50 },
    { date: today, type: 'focus_time', status: 'in_progress', progress: 20, target: 30, xp: 30 },
    { date: yesterday, type: 'study_cards', status: 'completed', progress: 5, target: 5, xp: 50 },
    { date: yesterday, type: 'focus_time', status: 'completed', progress: 30, target: 30, xp: 30 },
    { date: twoDaysAgo, type: 'study_cards', status: 'completed', progress: 4, target: 5, xp: 40 },
    { date: twoDaysAgo, type: 'focus_time', status: 'completed', progress: 25, target: 30, xp: 25 },
  ];
  
  for (const task of tasks) {
    await supabase
      .from('daily_tasks')
      .upsert({
        user_id: userId,
        task_date: task.date,
        task_type: task.type,
        status: task.status,
        progress: task.progress,
        target: task.target,
        xp_reward: task.xp,
        completed_at: task.status === 'completed' ? new Date().toISOString() : null,
      }, { onConflict: 'user_id,task_date,task_type' });
    
    console.log(`  ✅ Task "${task.type}" for ${task.date} created`);
  }
}

async function createPeriodicTasksAndPass(userId: string) {
  console.log('🔧 Creating periodic tasks and pass progress...');
  
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];
  
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = monthStart.toISOString().split('T')[0];
  
  const periodicTasks = [
    { periodType: 'weekly', periodStart: weekStartStr, taskType: 'focus', target: 7, progress: 5, xpReward: 100 },
    { periodType: 'weekly', periodStart: weekStartStr, taskType: 'study', target: 5, progress: 3, xpReward: 80 },
    { periodType: 'monthly', periodStart: monthStartStr, taskType: 'focus', target: 30, progress: 15, xpReward: 300 },
    { periodType: 'monthly', periodStart: monthStartStr, taskType: 'study', target: 20, progress: 10, xpReward: 200 },
  ];
  
  for (const task of periodicTasks) {
    await supabase
      .from('periodic_tasks')
      .insert({
        user_id: userId,
        period_type: task.periodType,
        period_start: task.periodStart,
        period_end: task.periodType === 'weekly' 
          ? new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).toISOString().split('T')[0],
        task_type: task.taskType,
        target: task.target,
        progress: task.progress,
        status: task.progress >= task.target ? 'completed' : 'pending',
        xp_reward: task.xpReward,
      });
    
    console.log(`  ✅ Periodic task ${task.periodType}/${task.taskType} created`);
  }
  
  await supabase
    .from('periodic_passes')
    .insert({
      user_id: userId,
      period_type: 'weekly',
      period_start: weekStartStr,
      period_end: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      total_points: 80,
      current_level: 3,
    });
  
  await supabase
    .from('periodic_passes')
    .insert({
      user_id: userId,
      period_type: 'monthly',
      period_start: monthStartStr,
      period_end: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).toISOString().split('T')[0],
      total_points: 250,
      current_level: 5,
    });
  
  console.log('  ✅ Periodic passes created');
}

async function unlockAchievements(userId: string) {
  console.log('🔧 Unlocking achievements...');
  
  const achievementCodes = [
    'streak_3', 'streak_7',
    'focus_10', 'focus_60',
    'mastery_1', 'mastery_10',
    'creation_graph_1', 'creation_graph_5',
    'creation_node_10', 'creation_node_100',
    'first_focus', 'pomodoro_10',
    'tasks_10', 'daily_streak_7',
  ];
  
  const { data: achievements } = await supabase
    .from('achievements')
    .select('id, code')
    .in('code', achievementCodes);
  
  if (!achievements || achievements.length === 0) {
    console.log('  ⏭️  No achievements found');
    return;
  }
  
  for (const achievement of achievements) {
    const daysAgo = Math.floor(Math.random() * 14) + 1;
    const unlockedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    
    await supabase
      .from('user_achievements')
      .upsert({
        user_id: userId,
        achievement_id: achievement.id,
        unlocked_at: unlockedAt.toISOString(),
        progress: 100,
      }, { onConflict: 'user_id,achievement_id' });
    
    console.log(`  ✅ Achievement "${achievement.code}" unlocked`);
  }
}

async function createUserFocusStats(userId: string) {
  console.log('🔧 Creating user focus stats...');
  
  await supabase
    .from('user_focus_stats')
    .upsert({
      user_id: userId,
      total_focus_seconds: 36000,
      total_sessions: 25,
      total_pomodoros: 45,
      total_tasks_completed: 30,
      current_streak: 7,
      longest_streak: 14,
      weekly_streak: 2,
      monthly_streak: 1,
      daily_task_streak: 5,
      last_daily_completion: new Date().toISOString().split('T')[0],
      last_focus_date: new Date().toISOString().split('T')[0],
    }, { onConflict: 'user_id' });
  
  console.log('  ✅ User focus stats created');
}

function parseTimeOffset(offset: string): number {
  const match = offset.match(/^(\d+)\s*(minute|hour|day|week|month)s?$/i);
  if (!match) return 0;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'minute': return value * 60 * 1000;
    case 'hour': return value * 60 * 60 * 1000;
    case 'day': return value * 24 * 60 * 60 * 1000;
    case 'week': return value * 7 * 24 * 60 * 60 * 1000;
    case 'month': return value * 30 * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

async function main() {
  console.log('🚀 Starting test data seed...\n');
  
  try {
    const user = await createTestUser();
    await updateUserProfile(user.id);
    
    const jsResult = await createKnowledgeGraphWithData(user.id, JAVASCRIPT_GRAPH);
    const reactResult = await createKnowledgeGraphWithData(user.id, REACT_GRAPH);
    const pythonResult = await createKnowledgeGraphWithData(user.id, PYTHON_GRAPH);
    
    const emptyResult = await createKnowledgeGraphWithData(user.id, EMPTY_GRAPH);
    const singleNodeResult = await createKnowledgeGraphWithData(user.id, SINGLE_NODE_GRAPH);
    const performanceResult = await createKnowledgeGraphWithData(user.id, PERFORMANCE_GRAPH);
    const cyclicResult = await createKnowledgeGraphWithData(user.id, CYCLIC_GRAPH);
    const longContentResult = await createKnowledgeGraphWithData(user.id, LONG_CONTENT_GRAPH);
    
    if (jsResult) {
      await createStudyCardsForGraph(user.id, jsResult.graphId, jsResult.nodeMap, 'JavaScript 基础知识');
      await createStudyProgress(user.id, jsResult.graphId, JAVASCRIPT_GRAPH.nodes.length);
      await createIsolatedNodes(user.id, jsResult.graphId);
    }
    if (reactResult) {
      await createStudyCardsForGraph(user.id, reactResult.graphId, reactResult.nodeMap, 'React 开发指南');
      await createStudyProgress(user.id, reactResult.graphId, REACT_GRAPH.nodes.length);
    }
    if (pythonResult) {
      await createStudyCardsForGraph(user.id, pythonResult.graphId, pythonResult.nodeMap, 'Python 数据分析');
      await createStudyProgress(user.id, pythonResult.graphId, PYTHON_GRAPH.nodes.length);
    }
    if (singleNodeResult) {
      await createStudyProgress(user.id, singleNodeResult.graphId, SINGLE_NODE_GRAPH.nodes.length);
    }
    if (performanceResult) {
      await createStudyProgress(user.id, performanceResult.graphId, PERFORMANCE_GRAPH.nodes.length);
    }
    
    const allNodeMaps: Record<string, Record<string, string>> = {};
    if (jsResult) {
      jsResult.nodeMap.__graphId = jsResult.graphId;
      allNodeMaps['JavaScript'] = jsResult.nodeMap;
    }
    if (reactResult) {
      reactResult.nodeMap.__graphId = reactResult.graphId;
      allNodeMaps['React'] = reactResult.nodeMap;
    }
    if (singleNodeResult) {
      singleNodeResult.nodeMap.__graphId = singleNodeResult.graphId;
      allNodeMaps['SingleNode'] = singleNodeResult.nodeMap;
    }
    
    await createBoundaryStudyCards(user.id, allNodeMaps);
    
    await createScheduledTasks(user.id);
    await createTaskExecutions(user.id);
    await createFocusSessions(user.id);
    await createDailyTasks(user.id);
    await createPeriodicTasksAndPass(user.id);
    await unlockAchievements(user.id);
    await createUserFocusStats(user.id);
    
    console.log('\n✅ Test data seed completed!');
    console.log('\n📋 Test Account Info:');
    console.log(`   Email: ${TEST_USER.email}`);
    console.log(`   Password: ${TEST_USER.password}`);
    console.log(`   User ID: ${user.id}`);
    
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  }
}

main();
