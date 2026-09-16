(function(){
  const SEED = window.KRAVIA_SEED;
  const KEY = "kravia.office.v1.state";
  const AUDIT_KEY = "kravia.office.v1.audit";
  const RUN_KEY = "kravia.office.v1.runs";

  function clone(x){ return JSON.parse(JSON.stringify(x)); }
  function now(){ return new Date().toISOString(); }
  function uid(prefix){ return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`; }
  function load(){
    const stored = localStorage.getItem(KEY);
    if(stored){ try{return JSON.parse(stored);}catch(e){} }
    const state={customers:[],products:clone(SEED.products),plans:[],invoices:[],payments:[],receipts:[],assets:[],notes:[],settings:{supplierStateCode:SEED.company.stateCode,invoicePrefix:"KPL",defaultGstRate:18}};
    localStorage.setItem(KEY,JSON.stringify(state));
    return state;
  }
  let state=load();
  function save(){ localStorage.setItem(KEY,JSON.stringify(state)); }

  function audit(event, entity, entityId, detail, severity="INFO"){
    const arr=JSON.parse(localStorage.getItem(AUDIT_KEY)||"[]");
    arr.push({id:uid("AUD"),at:now(),event,entity,entityId,detail,severity,actor:"Local Office Owner session"});
    localStorage.setItem(AUDIT_KEY,JSON.stringify(arr.slice(-1000)));
  }
  function getAudit(){ return JSON.parse(localStorage.getItem(AUDIT_KEY)||"[]").reverse(); }
  function run(workflow,status,steps,source){
    const arr=JSON.parse(localStorage.getItem(RUN_KEY)||"[]");
    arr.push({id:uid("RUN"),workflow,status,steps,source,at:now(),durationMs:Math.floor(200+Math.random()*900)});
    localStorage.setItem(RUN_KEY,JSON.stringify(arr.slice(-300)));
  }
  function getRuns(){ return JSON.parse(localStorage.getItem(RUN_KEY)||"[]").reverse(); }

  function financialYear(d=new Date()){
    const y=d.getFullYear(); const m=d.getMonth()+1;
    const start=m>=4?y:y-1; const end=(start+1)%100;
    return `${String(start).slice(-2)}${String(end).padStart(2,"0")}`;
  }
  function nextInvoiceNo(productCode="KR"){
    const fy=financialYear();
    const prefix=(productCode||"KR").toUpperCase().slice(0,2);
    const count=state.invoices.filter(x=>x.invoiceNo && x.invoiceNo.startsWith(`${prefix}/${fy}/`)).length+1;
    return `${prefix}/${fy}/${String(count).padStart(6,"0")}`;
  }
  function money(v){ return Number(v||0).toFixed(2); }
  function addCustomer(input){
    const customer={id:uid("CUS"),legalName:input.legalName.trim(),displayName:(input.displayName||input.legalName).trim(),gstin:(input.gstin||"").trim().toUpperCase(),state:input.state.trim(),stateCode:(input.stateCode||"").trim(),country:input.country||"India",email:(input.email||"").trim(),phone:(input.phone||"").trim(),billingAddress:(input.billingAddress||"").trim(),createdAt:now(),status:"ACTIVE"};
    if(!customer.legalName) throw new Error("Customer legal name is required");
    if(customer.gstin && !/^[0-9A-Z]{15}$/.test(customer.gstin)) throw new Error("GSTIN must contain 15 alphanumeric characters or be left blank");
    state.customers.push(customer); save(); audit("customer.created","customer",customer.id,customer.legalName); return customer;
  }
  function addProduct(input){
    const code=input.code.trim().toUpperCase(); if(!/^[A-Z0-9]{2,5}$/.test(code)) throw new Error("Product code must be 2–5 letters/numbers");
    if(state.products.some(p=>p.code===code)) throw new Error("Product code already exists");
    const product={id:uid("PROD"),code,name:input.name.trim(),category:input.category.trim(),status:"ACTIVE_CONFIG",legalEntity:SEED.company.id,countries:[input.country||"IN"],commercialOwner:SEED.company.legalName,billingMode:"CENTRAL_ENGINE"};
    product.code=code;
    state.products.push(product); save(); audit("product.created","product",product.id,`${product.code} · ${product.name}`); return product;
  }
  function createInvoice(input){
    const customer=state.customers.find(x=>x.id===input.customerId); if(!customer) throw new Error("Select a customer");
    const product=state.products.find(x=>x.id===input.productId); if(!product) throw new Error("Select a product");
    const taxable=Number(input.taxableValue); if(!(taxable>0)) throw new Error("Taxable value must be greater than zero");
    const discount=Math.max(0,Number(input.discount||0)); const net=Math.max(0,taxable-discount);
    const rate=Number(input.gstRate ?? state.settings.defaultGstRate); const tax=net*rate/100;
    const sameState=String(customer.stateCode||"")===String(state.settings.supplierStateCode||"") && customer.stateCode;
    const cgst=sameState?tax/2:0, sgst=sameState?tax/2:0, igst=sameState?0:tax;
    const total=net+tax;
    const invoice={
      id:uid("INV"),invoiceNo:nextInvoiceNo(product.code),status:"ISSUED",issuedAt:now(),dueDate:input.dueDate||"",description:input.description.trim()||`${product.name} services`,sac:(input.sac||"").trim(),qty:Number(input.qty||1),rate:taxable/Number(input.qty||1),taxableValue:taxable,discount,netTaxable:net,gstRate:rate,cgst,sgst,igst,total,balance:total,paid:0,currency:"INR",
      customerId:customer.id,productId:product.id,
      snapshot:{company:{legalName:SEED.company.legalName,cin:SEED.company.cin,registeredOffice:SEED.company.registeredOffice,stateCode:state.settings.supplierStateCode},customer:clone(customer),product:clone(product)},
      source:"KRAVIA Office local billing engine",notes:(input.notes||"").trim()
    };
    state.invoices.push(invoice); save();
    audit("invoice.issued","invoice",invoice.id,`${invoice.invoiceNo} · ₹${money(invoice.total)}`,"FINANCIAL");
    run("WF-PAY-001","SUCCESS",[
      {name:"Validate billing command",status:"SUCCESS"},{name:"Allocate invoice sequence",status:"SUCCESS"},{name:"Snapshot customer and product",status:"SUCCESS"},{name:"Calculate GST",status:"SUCCESS"},{name:"Issue immutable invoice",status:"SUCCESS"},{name:"Queue payment reconciliation",status:"PENDING_SOURCE"}
    ],invoice.id);
    run("WF-GST-001","SUCCESS",[
      {name:"Read invoice snapshot",status:"SUCCESS"},{name:"Classify intra/inter-state supply",status:"SUCCESS"},{name:"Post invoice to local sales register",status:"SUCCESS"},{name:"Await CA-reviewed period close",status:"PENDING_REVIEW"}
    ],invoice.id);
    return invoice;
  }
  function recordPayment(input){
    const inv=state.invoices.find(x=>x.id===input.invoiceId); if(!inv) throw new Error("Invoice not found");
    const amount=Number(input.amount); if(!(amount>0)) throw new Error("Payment amount must be greater than zero");
    if(amount>inv.balance+0.01) throw new Error("Payment exceeds current invoice balance");
    const payment={id:uid("PAY"),invoiceId:inv.id,amount,method:input.method||"Bank Transfer",reference:(input.reference||"").trim(),receivedAt:input.receivedAt||new Date().toISOString().slice(0,10),status:"SUCCESS",createdAt:now()};
    state.payments.push(payment); inv.paid=Number((inv.paid+amount).toFixed(2)); inv.balance=Number(Math.max(0,inv.total-inv.paid).toFixed(2)); inv.status=inv.balance<=0.01?"PAID":"PARTIALLY_PAID";
    const receipt={id:uid("RCT"),receiptNo:`RCPT/${financialYear()}/${String(state.receipts.length+1).padStart(6,"0")}`,invoiceId:inv.id,paymentId:payment.id,amount,issuedAt:now(),customerId:inv.customerId};
    state.receipts.push(receipt); save();
    audit("payment.recorded","payment",payment.id,`${inv.invoiceNo} · ₹${money(amount)} · ${payment.method}`,"FINANCIAL");
    audit("receipt.issued","receipt",receipt.id,receipt.receiptNo,"FINANCIAL");
    run("WF-PAY-001","PARTIAL_SUCCESS",[
      {name:"Validate payment",status:"SUCCESS"},{name:"Match invoice",status:"SUCCESS"},{name:"Update receivable",status:"SUCCESS"},{name:"Issue receipt",status:"SUCCESS"},{name:"Bank/settlement reconciliation",status:"SOURCE_NOT_CONNECTED"}
    ],payment.id);
    return {payment,receipt,invoice:inv};
  }
  function addAsset(input){
    const asset={id:uid("AST"),name:input.name.trim(),category:input.category.trim(),serial:(input.serial||"").trim(),assignedTo:(input.assignedTo||"").trim(),location:(input.location||"").trim(),status:"ACTIVE",createdAt:now()};
    if(!asset.name) throw new Error("Asset name is required"); state.assets.push(asset); save(); audit("asset.created","asset",asset.id,asset.name); return asset;
  }
  function getTaxSummary(){
    return state.invoices.reduce((a,x)=>{a.taxable+=x.netTaxable;a.cgst+=x.cgst;a.sgst+=x.sgst;a.igst+=x.igst;a.total+=x.total;return a;},{taxable:0,cgst:0,sgst:0,igst:0,total:0});
  }
  function getReceivables(){ return state.invoices.reduce((s,x)=>s+Number(x.balance||0),0); }
  function getIssuedRevenue(){ return state.invoices.reduce((s,x)=>s+Number(x.netTaxable||0),0); }
  function htmlInvoice(inv){
    const c=inv.snapshot.customer,p=inv.snapshot.product,co=inv.snapshot.company;
    return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#18202b;margin:36px;font-size:12px}h1{font-size:25px;margin:0}h2{font-size:13px;margin:0 0 8px;color:#245e75}.top{display:flex;justify-content:space-between;border-bottom:2px solid #153e4f;padding-bottom:18px}.muted{color:#6b7280}.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin:22px 0}.box{border:1px solid #d8e0e7;padding:14px}.items{width:100%;border-collapse:collapse;margin:20px 0}.items th{background:#153e4f;color:#fff;text-align:left;padding:9px}.items td{padding:10px;border-bottom:1px solid #e1e7ec}.right{text-align:right}.summary{margin-left:auto;width:330px;border-collapse:collapse}.summary td{padding:6px;border-bottom:1px solid #e5e7eb}.strong{font-weight:700}.total{font-size:15px;background:#f3f7fa}.foot{margin-top:40px;font-size:10px;color:#6b7280}@media print{body{margin:18mm}}</style></head><body><div class="top"><div><h1>KRAVIA PRIVATE LIMITED</h1><div class="muted">${co.cin}<br>${co.registeredOffice}</div></div><div class="right"><h1>TAX INVOICE</h1><b>${inv.invoiceNo}</b><br>${new Date(inv.issuedAt).toLocaleDateString('en-IN')}<br>Status: ${inv.status}</div></div><div class="grid"><div class="box"><h2>BILL TO</h2><b>${c.legalName}</b><br>${c.billingAddress||''}<br>${c.gstin?`GSTIN ${c.gstin}<br>`:''}${c.state||''} ${c.stateCode?`(${c.stateCode})`:''}</div><div class="box"><h2>INVOICE DETAILS</h2>Product: ${p.name}<br>Place of Supply: ${c.state||'—'}<br>GST rate: ${inv.gstRate}%<br>Due date: ${inv.dueDate||'—'}</div></div><table class="items"><thead><tr><th>Description</th><th>SAC</th><th>Qty</th><th class="right">Taxable</th></tr></thead><tbody><tr><td>${inv.description}</td><td>${inv.sac||'—'}</td><td>${inv.qty}</td><td class="right">₹${money(inv.netTaxable)}</td></tr></tbody></table><table class="summary"><tr><td>Taxable value</td><td class="right">₹${money(inv.netTaxable)}</td></tr>${inv.cgst?`<tr><td>CGST</td><td class="right">₹${money(inv.cgst)}</td></tr><tr><td>SGST</td><td class="right">₹${money(inv.sgst)}</td></tr>`:`<tr><td>IGST</td><td class="right">₹${money(inv.igst)}</td></tr>`}<tr class="total"><td class="strong">TOTAL</td><td class="right strong">₹${money(inv.total)}</td></tr><tr><td>Paid</td><td class="right">₹${money(inv.paid)}</td></tr><tr><td class="strong">Balance due</td><td class="right strong">₹${money(inv.balance)}</td></tr></table><div class="foot">Generated from an immutable billing snapshot in KRAVIA Office local foundation. Before production use, GST registration, invoice sequence, SAC, tax rules, bank details and authorised signatory must be verified and production controls enabled.</div></body></html>`;
  }
  function htmlReceipt(receipt){
    const inv=state.invoices.find(x=>x.id===receipt.invoiceId), pay=state.payments.find(x=>x.id===receipt.paymentId), c=inv?.snapshot.customer;
    return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#18202b;margin:42px}h1{font-size:26px}.muted{color:#6b7280}.box{border:1px solid #d8e0e7;padding:18px;margin:22px 0}.amount{font-size:32px;font-weight:700}.row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #eee}</style></head><body><h1>KRAVIA PRIVATE LIMITED</h1><div class="muted">PAYMENT RECEIPT · ${receipt.receiptNo}</div><div class="box"><div class="muted">Received from</div><h2>${c?.legalName||'Customer'}</h2><div class="amount">₹${money(receipt.amount)}</div><div class="row"><span>Invoice</span><b>${inv?.invoiceNo||''}</b></div><div class="row"><span>Payment method</span><b>${pay?.method||''}</b></div><div class="row"><span>Reference</span><b>${pay?.reference||'—'}</b></div><div class="row"><span>Payment date</span><b>${pay?.receivedAt||''}</b></div></div><p class="muted">This receipt acknowledges payment against the referenced invoice and does not replace the original tax invoice.</p></body></html>`;
  }
  function resetLocal(){ state=load(); }
  window.KRAVIA_ENGINE={getState:()=>state,save,audit,getAudit,run,getRuns,addCustomer,addProduct,createInvoice,recordPayment,addAsset,getTaxSummary,getReceivables,getIssuedRevenue,htmlInvoice,htmlReceipt,money,financialYear,uid};
  if(getAudit().length===0){
    audit("office.foundation.initialized","system",SEED.company.id,"KRAVIA Office v1 local enterprise foundation initialized from controlled sources");
  }
})();
