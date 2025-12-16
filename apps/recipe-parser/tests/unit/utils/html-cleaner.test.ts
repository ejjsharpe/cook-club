import { describe, it, expect } from "vitest";

import { cleanHtml, extractText } from "../../../src/utils/html-cleaner";

describe("cleanHtml", () => {
  describe("noise removal", () => {
    it("removes script tags", () => {
      const html = `
        <html>
          <body>
            <p>Recipe content</p>
            <script>console.log('evil');</script>
          </body>
        </html>
      `;
      const result = cleanHtml(html);
      expect(result).toContain("Recipe content");
      expect(result).not.toContain("console.log");
      expect(result).not.toContain("evil");
    });

    it("removes style tags", () => {
      const html = `
        <html>
          <body>
            <p>Recipe content</p>
            <style>.recipe { color: red; }</style>
          </body>
        </html>
      `;
      const result = cleanHtml(html);
      expect(result).toContain("Recipe content");
      expect(result).not.toContain("color: red");
    });

    it("removes navigation elements", () => {
      const html = `
        <html>
          <body>
            <nav>Home | About | Contact</nav>
            <p>Recipe content</p>
          </body>
        </html>
      `;
      const result = cleanHtml(html);
      expect(result).toContain("Recipe content");
      expect(result).not.toContain("Home | About | Contact");
    });

    it("removes header and footer", () => {
      const html = `
        <html>
          <body>
            <header>Site Header</header>
            <p>Recipe content</p>
            <footer>Copyright 2024</footer>
          </body>
        </html>
      `;
      const result = cleanHtml(html);
      expect(result).toContain("Recipe content");
      expect(result).not.toContain("Site Header");
      expect(result).not.toContain("Copyright 2024");
    });

    it("removes elements with ads class", () => {
      const html = `
        <html>
          <body>
            <div class="ads">Buy our stuff!</div>
            <p>Recipe content</p>
          </body>
        </html>
      `;
      const result = cleanHtml(html);
      expect(result).toContain("Recipe content");
      expect(result).not.toContain("Buy our stuff");
    });

    it("removes elements with advertisement in class", () => {
      const html = `
        <html>
          <body>
            <div class="advertisement-banner">Sponsored</div>
            <p>Recipe content</p>
          </body>
        </html>
      `;
      const result = cleanHtml(html);
      expect(result).toContain("Recipe content");
      expect(result).not.toContain("Sponsored");
    });

    it("removes comments section", () => {
      const html = `
        <html>
          <body>
            <p>Recipe content</p>
            <div class="comments">User said: Great recipe!</div>
          </body>
        </html>
      `;
      const result = cleanHtml(html);
      expect(result).toContain("Recipe content");
      expect(result).not.toContain("User said");
    });
  });

  describe("main content extraction", () => {
    it("prefers article tag content", () => {
      const html = `
        <html>
          <body>
            <div>Sidebar stuff</div>
            <article>Main recipe content here</article>
          </body>
        </html>
      `;
      const result = cleanHtml(html);
      expect(result).toContain("Main recipe content here");
    });

    it("prefers main tag content", () => {
      const html = `
        <html>
          <body>
            <aside>Sidebar</aside>
            <main>Main recipe content</main>
          </body>
        </html>
      `;
      const result = cleanHtml(html);
      expect(result).toContain("Main recipe content");
    });

    it("falls back to body if no main content area", () => {
      const html = `
        <html>
          <body>
            <div>Body content</div>
          </body>
        </html>
      `;
      const result = cleanHtml(html);
      expect(result).toContain("Body content");
    });
  });

  describe("whitespace handling", () => {
    it("collapses multiple whitespaces", () => {
      const html = `
        <html>
          <body>
            <p>Word1     Word2</p>
          </body>
        </html>
      `;
      const result = cleanHtml(html);
      expect(result).not.toContain("     ");
      expect(result).toContain("Word1 Word2");
    });

    it("trims leading and trailing whitespace", () => {
      const html = `
        <html>
          <body>
            <p>  Content  </p>
          </body>
        </html>
      `;
      const result = cleanHtml(html);
      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
    });
  });

  describe("length limiting", () => {
    it("truncates very long content to 15000 characters", () => {
      const longContent = "A".repeat(20000);
      const html = `<html><body><p>${longContent}</p></body></html>`;
      const result = cleanHtml(html);
      expect(result.length).toBeLessThanOrEqual(15000);
    });
  });
});

describe("extractText", () => {
  it("extracts all text without aggressive cleaning", () => {
    const html = `
      <html>
        <body>
          <nav>Navigation</nav>
          <p>Main content</p>
          <footer>Footer</footer>
        </body>
      </html>
    `;
    const result = extractText(html);
    expect(result).toContain("Navigation");
    expect(result).toContain("Main content");
    expect(result).toContain("Footer");
  });

  it("still removes script and style tags", () => {
    const html = `
      <html>
        <body>
          <script>alert('bad');</script>
          <style>.x { color: red; }</style>
          <p>Content</p>
        </body>
      </html>
    `;
    const result = extractText(html);
    expect(result).toContain("Content");
    expect(result).not.toContain("alert");
    expect(result).not.toContain("color");
  });
});
