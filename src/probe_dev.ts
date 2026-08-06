import h from "./index.html";
Bun.serve({ port: 3997, development: false, routes: { "/*": h } });
console.log("up 3997");
