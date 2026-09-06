const crypto = require("crypto");

const secret = crypto.randomBytes(32).toString("hex");
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const make = (role) => {
  const h = b64u({ alg: "HS256", typ: "JWT" });
  const p = b64u({
    iss: "supabase-demo",
    role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10,
  });
  const s = crypto.createHmac("sha256", secret).update(h + "." + p).digest("base64url");
  return `${h}.${p}.${s}`;
};

console.log(`JWT_SECRET=${secret}`);
console.log(`ANON_KEY=${make("anon")}`);
console.log(`SERVICE_ROLE_KEY=${make("service_role")}`);
