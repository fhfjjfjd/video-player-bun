import h from "./index.html";
const html = (h as { index: string }).index;
console.log("len:", html.length, "| hasCSP:", html.includes("Content-Security-Policy"), "| hasBunClient:", html.includes("data-bun-dev-server-script"));
Bun.serve({ port: 3999, routes: { "/": () => new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }) } });
console.log("listening on 3999");
