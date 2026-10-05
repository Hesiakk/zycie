let products = [];
let cart = JSON.parse(localStorage.getItem("zycieCart") || "[]");
let activeFilter = "Wszystkie";
const $ = (s) => document.querySelector(s);
const money = (n) => `${Number(n).toFixed(2).replace(".", ",")} zł`;
const save = () => localStorage.setItem("zycieCart", JSON.stringify(cart));
const getProduct = id => products.find(p => p.id === id);

async function init(){
  const res = await fetch("/api/products");
  products = await res.json();
  renderFilters(); renderProducts(); renderCart();
  $("#bundleAdd").onclick = () => { addToCart("pakiet-start"); };
}

function renderFilters(){
  const categories=["Wszystkie",...new Set(products.filter(p=>p.kind!=="bundle").map(p=>p.category))];
  $("#filters").innerHTML=categories.map(c=>`<button class="filter ${c===activeFilter?'active':''}" data-filter="${c}">${c}</button>`).join("");
  document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;renderFilters();renderProducts();});
  $("#clearFilter").onclick=()=>{activeFilter="Wszystkie";renderFilters();renderProducts();};
}

function renderProducts(){
  const list=products.filter(p=>p.kind!=="bundle" && (activeFilter==="Wszystkie" || p.category===activeFilter));
  $("#products").innerHTML=list.map(p=>`
    <article class="product">
      <div class="cover-wrap"><img src="/covers/${p.cover}" alt="Okładka: ${p.title}"><span class="badge">${p.badge}</span><button class="preview" data-preview="${p.id}">Szczegóły</button></div>
      <div class="product-info"><div class="product-category">${p.category} • ${p.pages} STRON • ${p.format}</div><h3>${p.title}</h3><p>${p.short}</p>
        <ul class="benefits">${p.benefits.map(x=>`<li>${x}</li>`).join("")}</ul>
        <div class="product-foot"><div><strong>${money(p.price)}</strong><span class="digital">produkt cyfrowy</span></div><button class="add" data-id="${p.id}">Dodaj do koszyka <span>+</span></button></div>
      </div>
    </article>`).join("");
  document.querySelectorAll(".add").forEach(b=>b.onclick=()=>addToCart(b.dataset.id));
  document.querySelectorAll(".preview").forEach(b=>b.onclick=()=>openProduct(b.dataset.preview));
}

function addToCart(id){
  if(id==="pakiet-start") cart=["pakiet-start"];
  else { cart=cart.filter(x=>x!=="pakiet-start"); if(!cart.includes(id)) cart.push(id); }
  save(); renderCart(); openCart();
}
function removeFromCart(id){cart=cart.filter(x=>x!==id);save();renderCart();}

function renderCart(){
  const selected=cart.map(getProduct).filter(Boolean);
  $("#cartCount").textContent=selected.length;
  if(!selected.length){$("#cartItems").innerHTML=`<div class="empty">Koszyk jest pusty.<br>Wybierz e-book, który chcesz mieć przy sobie.</div>`;$("#cartUpsell").innerHTML="";$("#cartTotal").textContent=money(0);return;}
  $("#cartItems").innerHTML=selected.map(p=>`<div class="cart-item"><div class="cart-item-main"><img src="/covers/${p.cover}" alt=""><div><strong>${p.title}</strong><span>${p.kind==='bundle'?'3 e-booki w pakiecie':p.category}</span></div></div><div class="cart-item-side"><strong>${money(p.price)}</strong><button data-remove="${p.id}">Usuń</button></div></div>`).join("");
  $("#cartTotal").textContent=money(selected.reduce((a,p)=>a+p.price,0));
  document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>removeFromCart(b.dataset.remove));
  if(!cart.includes("pakiet-start")) $("#cartUpsell").innerHTML=`<div class="upsell"><div><span>💡 LEPSZA WARTOŚĆ</span><strong>Weź cały pakiet i zapłać 79 zł</strong><small>Zamiast 102 zł za 3 osobne e-booki.</small></div><button id="upsellAdd">Dodaj</button></div>`; else $("#cartUpsell").innerHTML="";
  const u=$("#upsellAdd"); if(u)u.onclick=()=>addToCart("pakiet-start");
}

function openCart(){$("#cart").classList.add("open");$("#overlay").classList.add("show");$("#cart").setAttribute("aria-hidden","false");}
function closeCart(){$("#cart").classList.remove("open");$("#overlay").classList.remove("show");$("#cart").setAttribute("aria-hidden","true");}
$("#cartOpen").onclick=openCart;$("#cartClose").onclick=closeCart;$("#overlay").onclick=closeCart;

function openProduct(id){const p=getProduct(id);if(!p)return;$("#modalContent").innerHTML=`<div class="modal-grid"><img src="/covers/${p.cover}" alt="Okładka: ${p.title}"><div><p class="eyebrow">${p.category}</p><h2>${p.title}</h2><p class="modal-desc">${p.description}</p><ul class="modal-benefits">${p.benefits.map(x=>`<li>${x}</li>`).join("")}</ul><div class="modal-price"><strong>${money(p.price)}</strong><span>${p.pages} stron • PDF</span></div><button class="btn btn-primary" id="modalAdd">Dodaj do koszyka <span>+</span></button></div></div>`;$("#productModal").classList.add("show");$("#productModal").setAttribute("aria-hidden","false");$("#modalAdd").onclick=()=>{closeProduct();addToCart(id)};}
function closeProduct(){$("#productModal").classList.remove("show");$("#productModal").setAttribute("aria-hidden","true");}
$("#modalClose").onclick=closeProduct;$("#productModal").onclick=e=>{if(e.target.id==="productModal")closeProduct()};

document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeCart();closeProduct();}});

$("#checkout").onclick=async()=>{if(!cart.length)return;const button=$("#checkout");button.disabled=true;button.innerHTML="Przygotowuję płatność…";try{const res=await fetch("/api/create-checkout-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:cart})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Nie udało się rozpocząć płatności.");window.location.href=data.url;}catch(e){alert(e.message);button.disabled=false;button.innerHTML="Przejdź do bezpiecznej płatności <span>→</span>";}};
init().catch(()=>{$("#products").innerHTML='<p class="shop-error">Nie udało się wczytać sklepu. Spróbuj odświeżyć stronę.</p>';});
