import h from "./index.html";
Bun.serve({
  port: 3998,
  development: { hmr: true, console: true },
  routes: {
    "/*": () => new Response(h as unknown as BodyInit, { headers: { "Content-Type": "text/html", "X-Test": "wrapped" } }),
  },
});
console.log("up 3998");
