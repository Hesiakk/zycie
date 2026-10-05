import express from "express";
import Stripe from "stripe";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "kontakt@twojadomena.pl";
const products = JSON.parse(fs.readFileSync(path.join(__dirname, "data/products.json"), "utf8"));
const ordersFile = path.join(__dirname, "data/orders.json");
if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, "[]");

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

app.use(express.static(path.join(__dirname, "public")));
app.use("/covers", express.static(path.join(__dirname, "public/covers")));

app.get("/api/products", (_, res) => {
  res.json(products.map(({file, ...p}) => p));
});

function signDownload(orderId, productId, exp) {
  const secret = process.env.STRIPE_SECRET_KEY || "development-secret";
  return crypto.createHmac("sha256", secret).update(`${orderId}:${productId}:${exp}`).digest("hex");
}

app.post("/api/create-checkout-session", express.json(), async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({error: "Stripe nie jest jeszcze skonfigurowany. Uzupełnij STRIPE_SECRET_KEY w pliku .env."});
    const ids = [...new Set(req.body.ids || [])];
    const hasBundle = ids.includes("pakiet-start");
    const individualIds = ids.filter(id => id !== "pakiet-start");
    const bundleIds = ["od-nowa", "bez-wymowek", "twoje-tempo"];
    const normalizedIds = hasBundle ? bundleIds : [...new Set(individualIds)];
    const selected = products.filter(p => normalizedIds.includes(p.id) && p.kind !== "bundle");
    if (!selected.length) return res.status(400).json({error:"Koszyk jest pusty."});

    const lineItems = hasBundle
      ? [{price_data:{currency:"pln",product_data:{name:"Pakiet „Żyj po swojemu”",description:"3 e-booki PDF: Od nowa, Bez wymówek i Twoje tempo."},unit_amount:7900},quantity:1}]
      : selected.map(p => ({
          price_data: {currency: p.currency.toLowerCase(), product_data: {name: p.title, description: p.short}, unit_amount: Math.round(p.price * 100)},
          quantity: 1
        }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_creation: "always",
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      locale: "pl",
      success_url: `${PUBLIC_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_URL}/cancel.html`,
      metadata: {product_ids: normalizedIds.join(","), bundle: hasBundle ? "pakiet-start" : ""}
    });
    res.json({url: session.url});
  } catch (e) {
    console.error(e);
    res.status(500).json({error:"Nie udało się utworzyć sesji płatności."});
  }
});

app.post("/api/stripe/webhook", express.raw({type:"application/json"}), async (req,res) => {
  if (!stripe) return res.sendStatus(503);
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const ids = (session.metadata?.product_ids || "").split(",").filter(Boolean);
    const orders = JSON.parse(fs.readFileSync(ordersFile, "utf8"));
    if (!orders.some(o => o.sessionId === session.id)) {
      orders.push({
        sessionId: session.id,
        email: session.customer_details?.email || null,
        productIds: ids,
        paidAt: new Date().toISOString()
      });
      fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
    }
  }
  res.json({received:true});
});

app.use(express.json());

app.get("/api/order/:sessionId", async (req,res) => {
  try {
    if (!stripe) return res.status(503).json({error:"Stripe nie jest skonfigurowany."});
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    if (session.payment_status !== "paid") return res.json({downloads:[]});
    const orders = JSON.parse(fs.readFileSync(ordersFile, "utf8"));
    let order = orders.find(o => o.sessionId === session.id);
    if (!order) {
      const ids = (session.metadata?.product_ids || "").split(",").filter(Boolean);
      order = {sessionId:session.id, email:session.customer_details?.email || null, productIds:ids, paidAt:new Date().toISOString()};
      orders.push(order);
      fs.writeFileSync(ordersFile, JSON.stringify(orders,null,2));
    }
    const exp = Math.floor(Date.now()/1000) + 86400;
    const downloads = products.filter(p => order.productIds.includes(p.id)).map(p => ({
      title:p.title,
      url:`/api/download/${encodeURIComponent(order.sessionId)}/${encodeURIComponent(p.id)}?exp=${exp}&sig=${signDownload(order.sessionId,p.id,exp)}`
    }));
    res.json({downloads, email:order.email});
  } catch(e) {
    res.status(404).json({error:"Nie znaleziono zamówienia."});
  }
});

app.get("/api/download/:orderId/:productId", async (req,res) => {
  try {
    if (!stripe) return res.sendStatus(503);
    const {orderId,productId} = req.params;
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig || "");
    if (!exp || exp < Math.floor(Date.now()/1000) || sig !== signDownload(orderId,productId,exp)) return res.status(403).send("Link wygasł lub jest nieprawidłowy.");
    const session = await stripe.checkout.sessions.retrieve(orderId);
    if (session.payment_status !== "paid") return res.status(403).send("Płatność nie została potwierdzona.");
    const ids = (session.metadata?.product_ids || "").split(",");
    if (!ids.includes(productId)) return res.status(403).send("Brak dostępu.");
    const product = products.find(p => p.id === productId);
    if (!product) return res.sendStatus(404);
    const filePath = path.join(__dirname, "ebooks", product.file);
    if (!fs.existsSync(filePath)) return res.status(404).send("Plik e-booka nie został jeszcze dodany przez administratora.");
    res.download(filePath, product.file);
  } catch {
    res.status(403).send("Nie można pobrać pliku.");
  }
});

app.get("/api/config", (_,res)=>res.json({contactEmail:CONTACT_EMAIL}));

app.listen(PORT, () => console.log(`Życie na Twoich warunkach: ${PUBLIC_URL}`));
