/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", // public/index.html 파일
    "./src/**/*.{js,ts,jsx,tsx}", // src 폴더 내의 모든 JS, TS, JSX, TSX 파일
  ],
  theme: {
    extend: {
      // (선택사항) 이전에 제공된 MoodMap 컴포넌트의 float 애니메이션을 사용하려면 여기에 추가하세요.
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translate(-50%, -50%) translateY(-3px)' },
          '50%': { transform: 'translate(-50%, -50%) translateY(3px)' },
        }
      },
      animation: {
        float: 'float 3s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
