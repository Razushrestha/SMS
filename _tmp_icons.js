const https = require("https");
https
  .get("https://eskooly.com/bb/dashboard.php", (res) => {
    let d = "";
    res.on("data", (c) => (d += c));
    res.on("end", () => {
      const links = [...d.matchAll(/href="([^"]*fontawesome[^"]*)"/g)].map((m) => m[1]);
      console.log("css", links);
      const icons = [...d.matchAll(/class="([^"]*fa-[^"]*)"/g)].slice(0, 50).map((m) => m[1]);
      console.log(icons.join("\n"));
    });
  })
  .on("error", (e) => console.log(e));
