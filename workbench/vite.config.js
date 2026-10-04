// Modified for CowTech GEO: Tailwind v3 production CSS; upstream LICENSE and NOTICE retained.
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from 'tailwindcss';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
    ],
    css: { postcss: { plugins: [tailwindcss()] } },
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
