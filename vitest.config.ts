import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        css: true,
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        exclude: ['**/node_modules/**', '**/e2e/**'],
        coverage: {
            exclude: [
                'convex/**',
                'postcss.config.cjs',
                'tailwind.config.js',
                'eslint.config.js',
                'vite.config.ts',
                'vitest.config.ts',
                '**/*.d.ts',
                'src/test/**',
            ],
        },
    },
});
