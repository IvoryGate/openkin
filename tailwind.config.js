/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./ui/**/*.{js,ts,jsx,tsx}",
    "./ui/index.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Design System: Digital Study - 自然土色调配色
        primary: {
          DEFAULT: '#5E5E5E', // 深炭色 - 高对比度文本和主按钮
          hover: '#4A4A4A',
        },
        secondary: {
          DEFAULT: '#605F59', // 次要中性色 - 元数据和次要图标
        },
        surface: {
          DEFAULT: '#FBF9F4', // 主背景 - 优质未漂白纸色
          'container-low': '#F5F4ED', // 次要表面 - 侧边栏或次要内容区
          'container-high': '#E8E9E0', // 高亮表面 - 激活状态或提升卡片
          'container-lowest': '#FFFFFF', // 交互卡片 - 放置在 Layer1 上
        },
        'on-primary': '#F9F7F7', // 主色上的文本
        'on-surface': '#31332C', // 表面文本
        'outline-variant': 'rgba(49, 51, 44, 0.15)', // 幽灵边框 - 15% 不透明度
      },
      fontFamily: {
        // 衬线字体 - 展示和标题，传递学者气质
        notoSerif: ['"Noto Serif"', 'serif'],
        // 无衬线字体 - 功能性元素和聊天内容，高可读性
        manrope: ['"Manrope"', 'sans-serif'],
        // 代码字体
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        // Display & Headlines (Noto Serif)
        'display-lg': '3.5rem',
        'headline-md': '1.75rem',
        // Body & Labels (Manrope)
        'body-lg': '1rem',
        'label-md': '0.75rem',
      },
      borderRadius: {
        'sm': '0.25rem', // 最小圆角
        'md': '0.75rem', // 主按钮
        'lg': '1rem', // 主容器
        'xl': '1.5rem', // 输入框胶囊
      },
      boxShadow: {
        // 幽灵阴影 - 柔和光晕而非硬朗阴影
        'ghost': '0 40px 40px -10px rgba(49, 51, 44, 0.04)',
      },
      spacing: {
        '16': '4rem', // 宽边距 - 阅读节奏
        '20': '5rem',
      },
      backdropBlur: {
        'glass': '20px', // 毛玻璃效果
      },
    },
  },
  plugins: [],
}
