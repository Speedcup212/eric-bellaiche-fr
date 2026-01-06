import type { Plugin } from 'vite';

export function inlineCriticalCss(): Plugin {
  return {
    name: 'vite-plugin-inline-critical-css',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle }) {
        if (!bundle) return html;

        let cssContent = '';
        let cssFileName = '';

        for (const [fileName, output] of Object.entries(bundle)) {
          if (fileName.endsWith('.css') && 'source' in output) {
            cssContent = output.source as string;
            cssFileName = fileName;
            break;
          }
        }

        if (!cssContent) return html;

        const inlineStyle = `    <style>${cssContent}</style>\n`;

        html = html.replace(
          new RegExp(`<link[^>]*href="[^"]*${cssFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'g'),
          ''
        );

        html = html.replace(
          '<title>',
          `${inlineStyle}    <title>`
        );

        return html;
      },
    },
  };
}
