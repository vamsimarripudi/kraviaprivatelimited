import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* Browser layout checks run without any corporate login, employee data or
   backend requests. They test the real module CSS at phone/tablet/desktop sizes. */
const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const officeThemes = read("Frontend/app/office/office-experience-4.css")
  + read("Frontend/app/office/office-design-system.css");
const presenceCss = read("Frontend/components/office-presence-control.module.css");
const integrityCss = read("Frontend/app/office/office-surface-integrity.css");
const contrastCss = read("Frontend/app/office/office-mobile-contrast.css");
const recruitmentCss = read("Frontend/components/office-recruitment-workspace.module.css");
const workCss = read("Frontend/components/office-work-hub.module.css");

const tokens = (theme) => theme === "dark"
  ? "--office-ui-surface:#111319;--office-ui-surface-alt:#1b1e27;--office-ui-control:#171a22;--office-ui-ink:#f7f8fb;--office-ui-muted:#c2c6d0;--office-ui-soft:#a7aebc;--office-ui-line:#353945;--office-ui-accent:#4f8fff;--office-ui-danger:#ff6574;color-scheme:dark;"
  : "--office-ui-surface:#fff;--office-ui-surface-alt:#f2f4f8;--office-ui-control:#fff;--office-ui-ink:#171b25;--office-ui-muted:#5c6574;--office-ui-soft:#778195;--office-ui-line:#d9dfe9;--office-ui-accent:#1559ce;--office-ui-danger:#cc293b;color-scheme:light;";

const shell = (theme, style, body) => [
  "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>",
  "<style>html,body{margin:0;padding:0;}",
  style,
  "</style></head><body><div class='kravia-office'><main class='office-v2 office-v4 office-modern' data-ui-theme='",
  theme,
  "' style='",
  tokens(theme),
  "'><section class='office-main'>",
  body,
  "</section></main></div></body></html>",
].join("");

const luminance = (rgb) => {
  const parts = rgb.match(/[\d.]+/g).slice(0, 3).map(Number);
  const linear = parts.map(v => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
};
const ratio = (first, second) => {
  const x = luminance(first), y = luminance(second);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
};

test("native workforce modal stays centered and usable beyond sticky header on every screen size", async ({ page }) => {
  const body = [
    "<header style='position:sticky;top:0;overflow:hidden;transform:translateZ(0);height:56px'>",
    "<button id='presence-trigger' class='summary'>Work status</button>",
    "</header>",
    "<dialog id='presence-dialog' class='panel' data-office-presence-dialog='true' aria-modal='true'>",
    "<div class='heading'><h2>Workforce status</h2><details class='actionsMenu'>",
    "<summary>Actions</summary><div class='actionsContent'><div class='menuGroup'>",
    "<button>Check in</button><button>Start break</button><button>Check out</button>",
    "<button>OOO</button></div></div></details></div>",
    "<div class='statusSummary'><div><span>Availability</span><strong>Available</strong></div>",
    "<div><span>Attendance</span><strong>Not checked in</strong></div></div>",
    "<div class='attendance'><strong>Six-hour weekday target</strong></div>",
    ...Array.from({ length: 48 }, (_, index) => "<p class='note'>Review attendance note " + index + "</p>"),
    "</dialog>",
  ].join("");

  for (const theme of ["light", "dark"]) {
    for (const viewport of [
      { width: 320, height: 568 }, { width: 390, height: 844 },
      { width: 844, height: 390 }, { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.setContent(shell(theme, officeThemes + presenceCss + integrityCss, body));
      await page.locator("#presence-trigger").focus();
      await page.evaluate(() => document.getElementById("presence-dialog").showModal());
      const geometry = await page.locator("#presence-dialog").evaluate(el => {
        const r = el.getBoundingClientRect();
        return {
          top: r.top, left: r.left, right: r.right, bottom: r.bottom,
          cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2,
          vw: window.innerWidth, vh: window.innerHeight,
          modal: el.matches(":modal"), fixed: getComputedStyle(el).position,
          scrollable: el.scrollHeight > el.clientHeight,
          pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        };
      });
      const colors = await page.locator("#presence-dialog").evaluate(el => ({
        background: getComputedStyle(el).backgroundColor,
        foreground: getComputedStyle(el).color,
      }));
      expect(ratio(colors.foreground, colors.background), JSON.stringify({theme,viewport,colors})).toBeGreaterThanOrEqual(4.5);
      expect(geometry.modal, JSON.stringify({theme,viewport,geometry})).toBe(true);
      expect(geometry.fixed).toBe("fixed");
      expect(geometry.cx, JSON.stringify({theme,viewport})).toBeGreaterThan(geometry.vw / 2 - 5);
      expect(geometry.cx).toBeLessThan(geometry.vw / 2 + 5);
      expect(geometry.cy).toBeGreaterThan(geometry.vh / 2 - 12);
      expect(geometry.cy).toBeLessThan(geometry.vh / 2 + 12);
      expect(geometry.left).toBeGreaterThanOrEqual(-1);
      expect(geometry.top).toBeGreaterThanOrEqual(-1);
      expect(geometry.right).toBeLessThanOrEqual(geometry.vw + 1);
      expect(geometry.bottom).toBeLessThanOrEqual(geometry.vh + 1);
      expect(geometry.scrollable).toBe(true);
      expect(geometry.pageOverflow).toBe(false);
      await page.locator(".actionsMenu > summary").click();
      await expect(page.getByRole("button", { name: "OOO" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator("#presence-dialog")).toBeHidden();
    }
  }
});

test("legacy office cards and candidate form retain readable contrast in both themes", async ({ page }) => {
  const style = recruitmentCss + workCss + contrastCss + integrityCss;
  const body = [
    "<div class='hub office-work-hub_hub__fixture' data-office-work-hub='true'><div class='metrics office-work-hub_metrics__fixture' data-office-work-metrics='true'>",
    "<article id='metric'><span id='metric-label'>My approvals</span><strong>2</strong></article></div></div>",
    "<article class='card office-crm_card__fixture' id='company-card'>",
    "<h3 id='card-label'>Company data</h3><p>Current approved records</p></article>",
    "<form class='dialog office-recruitment_dialog__fixture' role='dialog' aria-modal='true'",
    " data-office-recruitment-dialog='true' id='recruitment-form'>",
    "<h3>Add candidate</h3><label id='candidate-label'>Full name<input id='candidate-input'",
    " value='Example only' /></label><select id='candidate-requisition'>",
    "<option>Requisition</option></select></form>",
  ].join("");

  for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(shell(theme, officeThemes + style, body));
    const values = await page.evaluate(() => {
      const info = (selector) => {
        const node = document.querySelector(selector);
        const computed = getComputedStyle(node);
        return { color: computed.color, background: computed.backgroundColor,
          rect: node.getBoundingClientRect().toJSON() };
      };
      return {
        metric: info("#metric"), metricLabel: info("#metric-label"),
        card: info("#company-card"), cardLabel: info("#card-label"),
        form: info("#recruitment-form"), label: info("#candidate-label"),
        input: info("#candidate-input"),
        formWidth: document.querySelector("#recruitment-form").getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    for (const [element, foreground, surface] of [
      ["metric label", values.metricLabel.color, values.metric.background],
      ["card heading", values.cardLabel.color, values.card.background],
      ["candidate field label", values.label.color, values.form.background],
      ["candidate input", values.input.color, values.input.background],
    ]) {
      expect(ratio(foreground, surface), JSON.stringify({theme,element,foreground,surface})).toBeGreaterThanOrEqual(4.5);
    }
    expect(values.formWidth).toBeLessThanOrEqual(390);
    expect(values.overflow).toBe(false);
  }
});
