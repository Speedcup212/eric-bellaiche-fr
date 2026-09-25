import type { Plugin } from 'vite';

export function inlineCriticalCss(): Plugin {
  return {
    name: 'vite-plugin-inline-critical-css',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle }) {
        if (!bundle) return html;

        const stylesheetPattern = /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+\.css)["'][^>]*>/gi;
        const links = Array.from(html.matchAll(stylesheetPattern));
        if (!links.length) return html;

        let inlineCss = '';
        let nextHtml = html;

        for (const match of links) {
          const href = match[1];
          const fileName = href.replace(/^\//, '');
          const output = bundle[fileName];
          if (!output || !('source' in output)) continue;

          inlineCss += String(output.source);
          nextHtml = nextHtml.replace(match[0], '');
        }

        if (!inlineCss) return html;

        return nextHtml.replace(
          '<title>',
          `    <style data-entry-css>${inlineCss}</style>\n    <title>`
        );
      },
    },
  };
}
