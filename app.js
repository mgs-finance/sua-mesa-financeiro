/* Controle Financeiro — Sua Mesa
   Dados salvos em localStorage. Sem backend — tudo roda no navegador. */
(function(){
"use strict";

var STORAGE_KEY = "suaMesaFinanceiro_v1";
var DESPESA_CATS = ["Eventos","Uber","Motoboy","Costureira","Marketing","Embalagem","Taxas de Plataforma","Outras"];
var CAT_COLORS = { "Eventos":"#2a78d6","Uber":"#eb6834","Motoboy":"#1baf7a","Costureira":"#eda100",
  "Marketing":"#e87ba4","Embalagem":"#008300","Taxas de Plataforma":"#6250d6","Outras":"#e34948" };
var C = { blue:"#2a78d6", orange:"#eb6834", aqua:"#1baf7a", yellow:"#eda100", magenta:"#e87ba4",
  green:"#008300", violet:"#6250d6", red:"#e34948", grid:"#e1e0d9", muted:"#898781",
  secondary:"#52514e", primary:"#0b0b0b", good:"#0ca30c", critical:"#d03b3b" };

var state = null;
var charts = {};

/* ---------- storage ---------- */
function defaultState(){
  return { produtos:[], vendas:[], compras:[], despesas:[], config:{ saldoInicial:0 } };
}
function load(){
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    var parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed);
  }catch(e){ return defaultState(); }
}
function save(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){ toast("Não foi possível salvar: armazenamento indisponível."); }
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }

/* ---------- utils ---------- */
function formatBRL(n){
  n = Number(n)||0;
  return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}
function formatDateBR(iso){
  if(!iso) return "—";
  var p = iso.split("-"); if(p.length<3) return iso;
  return p[2]+"/"+p[1]+"/"+p[0];
}
function todayISO(){ return new Date().toISOString().slice(0,10); }
function currentMonthStr(){ return new Date().toISOString().slice(0,7); }
function monthRange(monthStr){
  var y = Number(monthStr.slice(0,4)), m = Number(monthStr.slice(5,7));
  var from = monthStr+"-01";
  var lastDay = new Date(y, m, 0).getDate();
  var to = monthStr+"-"+String(lastDay).padStart(2,"0");
  return [from,to];
}
function addMonths(monthStr, delta){
  var y = Number(monthStr.slice(0,4)), m = Number(monthStr.slice(5,7));
  var d = new Date(y, m-1+delta, 1);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
}
function monthLabel(monthStr){
  var meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  var m = Number(monthStr.slice(5,7));
  return meses[m-1]+"/"+monthStr.slice(2,4);
}
function inRange(dateStr, from, to){ return dateStr>=from && dateStr<=to; }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function toast(msg){
  var el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.classList.remove("show"); }, 2600);
}
function confirmAction(title, text, onOk){
  var modal = document.getElementById("confirmModal");
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmText").textContent = text;
  modal.classList.add("open");
  var okBtn = document.getElementById("confirmOk");
  var cancelBtn = document.getElementById("confirmCancel");
  function close(){ modal.classList.remove("open"); okBtn.onclick=null; cancelBtn.onclick=null; }
  okBtn.onclick = function(){ close(); onOk(); };
  cancelBtn.onclick = close;
}

/* ---------- derived lookups ---------- */
function produtoById(id){ return state.produtos.find(function(p){ return p.id===id; }); }

/* ---------- navigation ---------- */
function initNav(){
  var btns = document.querySelectorAll("#navTabs button");
  btns.forEach(function(b){
    b.addEventListener("click", function(){
      btns.forEach(function(x){ x.classList.remove("active"); });
      b.classList.add("active");
      document.querySelectorAll(".view").forEach(function(v){ v.classList.remove("active"); });
      document.querySelector('.view[data-view="'+b.dataset.view+'"]').classList.add("active");
      document.getElementById("sidebar").classList.remove("open");
      if(b.dataset.view==="dashboard") renderDashboard();
      if(b.dataset.view==="dre") renderDre();
      if(b.dataset.view==="caixa") renderCaixa();
    });
  });
  document.getElementById("menuToggle").addEventListener("click", function(){
    document.getElementById("sidebar").classList.toggle("open");
  });
}

/* ================= PRODUTOS ================= */
function renderProdutoSelects(){
  ["vendaProduto","compraProduto"].forEach(function(id){
    var sel = document.getElementById(id);
    var keepFirst = id==="compraProduto";
    var current = sel.value;
    sel.innerHTML = keepFirst ? '<option value="">— não vincular —</option>' : "";
    state.produtos.forEach(function(p){
      var opt = document.createElement("option");
      opt.value = p.id; opt.textContent = p.nome+" ("+p.categoria+")";
      sel.appendChild(opt);
    });
    if(current) sel.value = current;
  });
}

function renderProdutos(){
  var tbl = document.getElementById("tblProdutos");
  if(!state.produtos.length){
    tbl.innerHTML = '<tbody><tr><td class="empty">Nenhum produto cadastrado ainda. Clique em "+ Novo produto".</td></tr></tbody>';
    return;
  }
  var rows = state.produtos.map(function(p){
    var margem = p.precoVenda>0 ? ((p.precoVenda-p.custoUnit)/p.precoVenda*100) : 0;
    var estoquePill = "";
    if(p.estoque<=0) estoquePill = '<span class="pill crit">Sem estoque</span>';
    else if(p.estoque<=p.estoqueMinimo) estoquePill = '<span class="pill warn">Estoque baixo</span>';
    else estoquePill = '<span class="pill good">OK</span>';
    return "<tr>"+
      "<td>"+esc(p.nome)+"</td>"+
      "<td>"+esc(p.categoria)+"</td>"+
      '<td class="num">'+formatBRL(p.custoUnit)+"</td>"+
      '<td class="num">'+formatBRL(p.precoVenda)+"</td>"+
      '<td class="num">'+margem.toFixed(1)+"%</td>"+
      '<td class="num">'+p.estoque+" "+estoquePill+"</td>"+
      '<td><div class="row-actions">'+
        '<button class="icon-btn" data-edit-produto="'+p.id+'" title="Editar">✎</button>'+
        '<button class="icon-btn" data-del-produto="'+p.id+'" title="Excluir">🗑</button>'+
      "</div></td></tr>";
  }).join("");
  tbl.innerHTML = "<thead><tr><th>Nome</th><th>Categoria</th><th>Custo</th><th>Preço</th><th>Margem</th><th>Estoque</th><th></th></tr></thead><tbody>"+rows+"</tbody>";
}

function showProdutoForm(p){
  document.getElementById("formProdutoCard").style.display = "block";
  document.getElementById("produtoId").value = p ? p.id : "";
  document.getElementById("produtoNome").value = p ? p.nome : "";
  document.getElementById("produtoCategoria").value = p ? p.categoria : "Jogo Americano";
  document.getElementById("produtoCusto").value = p ? p.custoUnit : "";
  document.getElementById("produtoPreco").value = p ? p.precoVenda : "";
  document.getElementById("produtoEstoque").value = p ? p.estoque : 0;
  document.getElementById("produtoEstoqueMin").value = p ? p.estoqueMinimo : 3;
}
function hideProdutoForm(){ document.getElementById("formProdutoCard").style.display = "none"; }

function initProdutos(){
  document.getElementById("btnNovoProduto").addEventListener("click", function(){ showProdutoForm(null); });
  document.getElementById("btnCancelarProduto").addEventListener("click", hideProdutoForm);
  document.getElementById("formProduto").addEventListener("submit", function(e){
    e.preventDefault();
    var id = document.getElementById("produtoId").value;
    var data = {
      nome: document.getElementById("produtoNome").value.trim(),
      categoria: document.getElementById("produtoCategoria").value,
      custoUnit: Number(document.getElementById("produtoCusto").value)||0,
      precoVenda: Number(document.getElementById("produtoPreco").value)||0,
      estoque: Number(document.getElementById("produtoEstoque").value)||0,
      estoqueMinimo: Number(document.getElementById("produtoEstoqueMin").value)||0
    };
    if(!data.nome){ toast("Informe o nome do produto."); return; }
    if(id){
      var p = produtoById(id);
      Object.assign(p, data);
      toast("Produto atualizado.");
    }else{
      data.id = uid();
      state.produtos.push(data);
      toast("Produto cadastrado.");
    }
    save(); hideProdutoForm(); renderProdutos(); renderProdutoSelects(); renderDashboard();
  });
  document.getElementById("tblProdutos").addEventListener("click", function(e){
    var editId = e.target.getAttribute("data-edit-produto");
    var delId = e.target.getAttribute("data-del-produto");
    if(editId) showProdutoForm(produtoById(editId));
    if(delId){
      confirmAction("Excluir produto", "Esta ação não pode ser desfeita. Vendas e compras já registradas não serão afetadas.", function(){
        state.produtos = state.produtos.filter(function(p){ return p.id!==delId; });
        save(); renderProdutos(); renderProdutoSelects(); renderDashboard();
        toast("Produto excluído.");
      });
    }
  });
}

/* ================= VENDAS ================= */
function renderVendas(){
  var tbl = document.getElementById("tblVendas");
  if(!state.vendas.length){
    tbl.innerHTML = '<tbody><tr><td class="empty">Nenhuma venda registrada ainda.</td></tr></tbody>';
    return;
  }
  var sorted = state.vendas.slice().sort(function(a,b){ return b.data.localeCompare(a.data); });
  var rows = sorted.map(function(v){
    var p = produtoById(v.produtoId);
    var total = v.qtd*v.precoUnit - v.desconto - v.taxa;
    return "<tr>"+
      "<td>"+formatDateBR(v.data)+"</td>"+
      "<td>"+esc(p?p.nome:"(produto excluído)")+"</td>"+
      '<td class="num">'+v.qtd+"</td>"+
      '<td class="num">'+formatBRL(v.precoUnit)+"</td>"+
      "<td><span class=\"pill\">"+esc(v.canal)+"</span></td>"+
      '<td class="num">'+formatBRL(total)+"</td>"+
      '<td><div class="row-actions">'+
        '<button class="icon-btn" data-edit-venda="'+v.id+'" title="Editar">✎</button>'+
        '<button class="icon-btn" data-del-venda="'+v.id+'" title="Excluir">🗑</button>'+
      "</div></td></tr>";
  }).join("");
  tbl.innerHTML = "<thead><tr><th>Data</th><th>Produto</th><th>Qtd</th><th>Preço</th><th>Canal</th><th>Total</th><th></th></tr></thead><tbody>"+rows+"</tbody>";
}

/* estoque ainda disponível para esta venda (soma de volta a qtd antiga se estiver editando o mesmo produto) */
function estoqueDisponivelParaVenda(produtoId){
  var p = produtoById(produtoId);
  if(!p) return 0;
  var disp = p.estoque;
  var editId = document.getElementById("vendaId").value;
  if(editId){
    var old = state.vendas.find(function(x){ return x.id===editId; });
    if(old && old.produtoId===produtoId) disp += old.qtd;
  }
  return disp;
}

function renderVendaAtalhos(){
  var wrap = document.getElementById("vendaAtalhos");
  if(!state.produtos.length){ wrap.innerHTML = '<span class="hint">Nenhum produto cadastrado.</span>'; return; }
  /* produtos mais vendidos primeiro (histórico), depois os demais */
  var qtdPorProduto = {};
  state.vendas.forEach(function(v){ qtdPorProduto[v.produtoId] = (qtdPorProduto[v.produtoId]||0)+v.qtd; });
  var produtosOrdenados = state.produtos.slice().sort(function(a,b){
    return (qtdPorProduto[b.id]||0) - (qtdPorProduto[a.id]||0);
  });
  wrap.innerHTML = produtosOrdenados.map(function(p){
    var semEstoque = p.estoque<=0;
    return '<button type="button" class="btn sm" data-atalho-produto="'+p.id+'"'+
      (semEstoque?' style="opacity:.55;"':'')+' title="'+(semEstoque?"Sem estoque":p.estoque+" un. disponíveis")+'">'+esc(p.nome)+"</button>";
  }).join("");
}

function updateVendaLivePreview(){
  var produtoId = document.getElementById("vendaProduto").value;
  var qtd = Number(document.getElementById("vendaQtd").value)||0;
  var preco = Number(document.getElementById("vendaPreco").value)||0;
  var desconto = Number(document.getElementById("vendaDesconto").value)||0;
  var taxa = Number(document.getElementById("vendaTaxa").value)||0;
  var hintEl = document.getElementById("vendaEstoqueHint");
  if(produtoId){
    var disp = estoqueDisponivelParaVenda(produtoId);
    var faltando = qtd>disp;
    hintEl.innerHTML = faltando
      ? '<span style="color:var(--critical);font-weight:650;">Estoque insuficiente — disponível: '+disp+' un.</span>'
      : "Estoque disponível: "+disp+" un.";
  }else{
    hintEl.textContent = "";
  }
  var total = (qtd*preco) - desconto - taxa;
  document.getElementById("vendaTotalPreview").textContent = formatBRL(total);
  document.getElementById("vendaTotalPreview").style.color = total<0 ? "var(--critical)" : "var(--text-primary)";
}

function selecionarProdutoNaVenda(produtoId){
  var p = produtoById(produtoId);
  if(!p) return;
  document.getElementById("vendaProduto").value = produtoId;
  if(!document.getElementById("vendaId").value) document.getElementById("vendaPreco").value = p.precoVenda;
  document.getElementById("vendaQtd").focus();
  document.getElementById("vendaQtd").select();
  updateVendaLivePreview();
}

function showVendaForm(v){
  renderProdutoSelects();
  renderVendaAtalhos();
  document.getElementById("formVendaCard").style.display = "block";
  document.getElementById("vendaId").value = v ? v.id : "";
  document.getElementById("vendaData").value = v ? v.data : (document.getElementById("vendaData").value || todayISO());
  document.getElementById("vendaProduto").value = v ? v.produtoId : (state.produtos[0]?state.produtos[0].id:"");
  document.getElementById("vendaQtd").value = v ? v.qtd : 1;
  document.getElementById("vendaPreco").value = v ? v.precoUnit : (produtoById(document.getElementById("vendaProduto").value)?produtoById(document.getElementById("vendaProduto").value).precoVenda:"");
  document.getElementById("vendaDesconto").value = v ? v.desconto : 0;
  document.getElementById("vendaTaxa").value = v ? v.taxa : 0;
  document.getElementById("vendaCanal").value = v ? v.canal : (document.getElementById("vendaCanal").value || "Site");
  updateVendaLivePreview();
  document.getElementById("vendaQtd").focus();
}
function hideVendaForm(){ document.getElementById("formVendaCard").style.display = "none"; }

/* reseta só os campos de item após salvar, mantendo data/canal, para lançar a próxima venda rápido */
function resetVendaFormParaProxima(){
  document.getElementById("vendaId").value = "";
  document.getElementById("vendaQtd").value = 1;
  document.getElementById("vendaDesconto").value = 0;
  document.getElementById("vendaTaxa").value = 0;
  renderVendaAtalhos();
  updateVendaLivePreview();
  document.getElementById("vendaQtd").focus();
  document.getElementById("vendaQtd").select();
}

function initVendas(){
  document.getElementById("btnNovaVenda").addEventListener("click", function(){
    if(!state.produtos.length){ toast("Cadastre um produto antes de registrar vendas."); return; }
    showVendaForm(null);
  });
  document.getElementById("btnCancelarVenda").addEventListener("click", hideVendaForm);
  document.getElementById("vendaAtalhos").addEventListener("click", function(e){
    var id = e.target.getAttribute("data-atalho-produto");
    if(id) selecionarProdutoNaVenda(id);
  });
  document.getElementById("vendaProduto").addEventListener("change", function(){
    if(!document.getElementById("vendaId").value){
      var p = produtoById(this.value);
      if(p) document.getElementById("vendaPreco").value = p.precoVenda;
    }
    updateVendaLivePreview();
  });
  ["vendaQtd","vendaPreco","vendaDesconto","vendaTaxa"].forEach(function(id){
    document.getElementById(id).addEventListener("input", updateVendaLivePreview);
  });
  document.getElementById("formVenda").addEventListener("submit", function(e){
    e.preventDefault();
    var id = document.getElementById("vendaId").value;
    var produtoId = document.getElementById("vendaProduto").value;
    var p = produtoById(produtoId);
    if(!p){ toast("Selecione um produto válido."); return; }
    var qtd = Number(document.getElementById("vendaQtd").value)||0;
    if(qtd<=0){ toast("Informe uma quantidade válida."); return; }

    var disponivel = estoqueDisponivelParaVenda(produtoId);
    if(qtd>disponivel){
      toast("Estoque insuficiente: disponível "+disponivel+" un. de "+p.nome+".");
      return;
    }

    if(id){
      var old = state.vendas.find(function(x){ return x.id===id; });
      var oldP = produtoById(old.produtoId);
      if(oldP) oldP.estoque += old.qtd; // devolve estoque antigo
      Object.assign(old, {
        data: document.getElementById("vendaData").value,
        produtoId: produtoId,
        qtd: qtd,
        precoUnit: Number(document.getElementById("vendaPreco").value)||0,
        desconto: Number(document.getElementById("vendaDesconto").value)||0,
        taxa: Number(document.getElementById("vendaTaxa").value)||0,
        canal: document.getElementById("vendaCanal").value,
        custoUnitSnapshot: p.custoUnit
      });
      p.estoque -= qtd;
      toast("Venda atualizada.");
      save(); hideVendaForm(); renderVendas(); renderProdutos(); renderDashboard();
    }else{
      state.vendas.push({
        id: uid(),
        data: document.getElementById("vendaData").value,
        produtoId: produtoId,
        qtd: qtd,
        precoUnit: Number(document.getElementById("vendaPreco").value)||0,
        desconto: Number(document.getElementById("vendaDesconto").value)||0,
        taxa: Number(document.getElementById("vendaTaxa").value)||0,
        canal: document.getElementById("vendaCanal").value,
        custoUnitSnapshot: p.custoUnit
      });
      p.estoque -= qtd;
      toast("Venda registrada. Pronto para a próxima.");
      save(); renderVendas(); renderProdutos(); renderDashboard();
      resetVendaFormParaProxima(); // mantém o formulário aberto para lançar em sequência
    }
  });
  document.getElementById("tblVendas").addEventListener("click", function(e){
    var editId = e.target.getAttribute("data-edit-venda");
    var delId = e.target.getAttribute("data-del-venda");
    if(editId) showVendaForm(state.vendas.find(function(v){ return v.id===editId; }));
    if(delId){
      confirmAction("Excluir venda", "O estoque do produto será devolvido. Esta ação não pode ser desfeita.", function(){
        var v = state.vendas.find(function(x){ return x.id===delId; });
        var p = produtoById(v.produtoId);
        if(p) p.estoque += v.qtd;
        state.vendas = state.vendas.filter(function(x){ return x.id!==delId; });
        save(); renderVendas(); renderProdutos(); renderDashboard();
        toast("Venda excluída.");
      });
    }
  });
}

/* ================= COMPRAS ================= */
function renderCompras(){
  var tbl = document.getElementById("tblCompras");
  if(!state.compras.length){
    tbl.innerHTML = '<tbody><tr><td class="empty">Nenhuma compra registrada ainda.</td></tr></tbody>';
    return;
  }
  var sorted = state.compras.slice().sort(function(a,b){ return b.data.localeCompare(a.data); });
  var catLabel = {revenda:"Mercadoria p/ revenda", materiaprima:"Matéria-prima", embalagem:"Embalagem"};
  var rows = sorted.map(function(c){
    var p = produtoById(c.produtoId);
    var total = c.qtd*c.custoUnit;
    return "<tr>"+
      "<td>"+formatDateBR(c.data)+"</td>"+
      "<td><span class=\"pill\">"+esc(catLabel[c.categoria]||c.categoria)+"</span></td>"+
      "<td>"+esc(p?p.nome:"—")+"</td>"+
      "<td>"+esc(c.fornecedor||"—")+"</td>"+
      '<td class="num">'+c.qtd+"</td>"+
      '<td class="num">'+formatBRL(c.custoUnit)+"</td>"+
      '<td class="num">'+formatBRL(total)+"</td>"+
      '<td><div class="row-actions">'+
        '<button class="icon-btn" data-edit-compra="'+c.id+'" title="Editar">✎</button>'+
        '<button class="icon-btn" data-del-compra="'+c.id+'" title="Excluir">🗑</button>'+
      "</div></td></tr>";
  }).join("");
  tbl.innerHTML = "<thead><tr><th>Data</th><th>Categoria</th><th>Produto</th><th>Fornecedor</th><th>Qtd</th><th>Custo</th><th>Total</th><th></th></tr></thead><tbody>"+rows+"</tbody>";
}

function showCompraForm(c){
  renderProdutoSelects();
  document.getElementById("formCompraCard").style.display = "block";
  document.getElementById("compraId").value = c ? c.id : "";
  document.getElementById("compraData").value = c ? c.data : todayISO();
  document.getElementById("compraCategoria").value = c ? c.categoria : "revenda";
  document.getElementById("compraProduto").value = c ? (c.produtoId||"") : "";
  document.getElementById("compraFornecedor").value = c ? (c.fornecedor||"") : "";
  document.getElementById("compraQtd").value = c ? c.qtd : 1;
  document.getElementById("compraCusto").value = c ? c.custoUnit : "";
}
function hideCompraForm(){ document.getElementById("formCompraCard").style.display = "none"; }

/* aplica a compra ao estoque e custo médio ponderado do produto vinculado */
function aplicarCompraNoEstoque(produtoId, qtd, custoUnit){
  var p = produtoById(produtoId);
  if(!p) return;
  var estoqueAntigo = p.estoque;
  var custoAntigo = p.custoUnit;
  var novoEstoque = estoqueAntigo + qtd;
  var novoCusto = novoEstoque>0 ? ((estoqueAntigo*custoAntigo)+(qtd*custoUnit))/novoEstoque : custoUnit;
  p.estoque = novoEstoque;
  p.custoUnit = Number(novoCusto.toFixed(4));
}
function revertCompraNoEstoque(produtoId, qtd){
  var p = produtoById(produtoId);
  if(!p) return;
  p.estoque = Math.max(0, p.estoque - qtd); // custo médio não é recalculado ao reverter (aproximação)
}

function initCompras(){
  document.getElementById("btnNovaCompra").addEventListener("click", function(){ showCompraForm(null); });
  document.getElementById("btnCancelarCompra").addEventListener("click", hideCompraForm);
  document.getElementById("formCompra").addEventListener("submit", function(e){
    e.preventDefault();
    var id = document.getElementById("compraId").value;
    var produtoId = document.getElementById("compraProduto").value || null;
    var qtd = Number(document.getElementById("compraQtd").value)||0;
    var custoUnit = Number(document.getElementById("compraCusto").value)||0;
    var categoria = document.getElementById("compraCategoria").value;

    if(id){
      var old = state.compras.find(function(x){ return x.id===id; });
      if(old.produtoId) revertCompraNoEstoque(old.produtoId, old.qtd);
      Object.assign(old, {
        data: document.getElementById("compraData").value,
        categoria: categoria, produtoId: produtoId,
        fornecedor: document.getElementById("compraFornecedor").value.trim(),
        qtd: qtd, custoUnit: custoUnit
      });
      if(produtoId) aplicarCompraNoEstoque(produtoId, qtd, custoUnit);
      toast("Compra atualizada.");
    }else{
      state.compras.push({
        id: uid(), data: document.getElementById("compraData").value,
        categoria: categoria, produtoId: produtoId,
        fornecedor: document.getElementById("compraFornecedor").value.trim(),
        qtd: qtd, custoUnit: custoUnit
      });
      if(produtoId) aplicarCompraNoEstoque(produtoId, qtd, custoUnit);
      toast("Compra registrada.");
    }
    save(); hideCompraForm(); renderCompras(); renderProdutos(); renderDashboard();
  });
  document.getElementById("tblCompras").addEventListener("click", function(e){
    var editId = e.target.getAttribute("data-edit-compra");
    var delId = e.target.getAttribute("data-del-compra");
    if(editId) showCompraForm(state.compras.find(function(c){ return c.id===editId; }));
    if(delId){
      confirmAction("Excluir compra", "O estoque vinculado será ajustado. Esta ação não pode ser desfeita.", function(){
        var c = state.compras.find(function(x){ return x.id===delId; });
        if(c.produtoId) revertCompraNoEstoque(c.produtoId, c.qtd);
        state.compras = state.compras.filter(function(x){ return x.id!==delId; });
        save(); renderCompras(); renderProdutos(); renderDashboard();
        toast("Compra excluída.");
      });
    }
  });
}

/* ================= DESPESAS ================= */
function renderDespesas(){
  var tbl = document.getElementById("tblDespesas");
  if(!state.despesas.length){
    tbl.innerHTML = '<tbody><tr><td class="empty">Nenhuma despesa registrada ainda.</td></tr></tbody>';
    return;
  }
  var sorted = state.despesas.slice().sort(function(a,b){ return b.data.localeCompare(a.data); });
  var rows = sorted.map(function(d){
    return "<tr>"+
      "<td>"+formatDateBR(d.data)+"</td>"+
      '<td><span class="pill" style="background:'+CAT_COLORS[d.categoria]+"22;color:"+CAT_COLORS[d.categoria]+'">'+esc(d.categoria)+"</span></td>"+
      "<td>"+esc(d.descricao)+(d.recorrente?' <span class="pill">recorrente</span>':"")+"</td>"+
      "<td>"+esc(d.formaPagamento)+"</td>"+
      '<td class="num">'+formatBRL(d.valor)+"</td>"+
      '<td><div class="row-actions">'+
        '<button class="icon-btn" data-edit-despesa="'+d.id+'" title="Editar">✎</button>'+
        '<button class="icon-btn" data-del-despesa="'+d.id+'" title="Excluir">🗑</button>'+
      "</div></td></tr>";
  }).join("");
  tbl.innerHTML = "<thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Pagamento</th><th>Valor</th><th></th></tr></thead><tbody>"+rows+"</tbody>";
}

function showDespesaForm(d){
  document.getElementById("formDespesaCard").style.display = "block";
  document.getElementById("despesaId").value = d ? d.id : "";
  document.getElementById("despesaData").value = d ? d.data : todayISO();
  document.getElementById("despesaCategoria").value = d ? d.categoria : "Eventos";
  document.getElementById("despesaDescricao").value = d ? d.descricao : "";
  document.getElementById("despesaValor").value = d ? d.valor : "";
  document.getElementById("despesaPagamento").value = d ? d.formaPagamento : "Pix";
  document.getElementById("despesaRecorrente").checked = d ? !!d.recorrente : false;
}
function hideDespesaForm(){ document.getElementById("formDespesaCard").style.display = "none"; }

function initDespesas(){
  document.getElementById("btnNovaDespesa").addEventListener("click", function(){ showDespesaForm(null); });
  document.getElementById("btnCancelarDespesa").addEventListener("click", hideDespesaForm);
  document.getElementById("formDespesa").addEventListener("submit", function(e){
    e.preventDefault();
    var id = document.getElementById("despesaId").value;
    var data = {
      data: document.getElementById("despesaData").value,
      categoria: document.getElementById("despesaCategoria").value,
      descricao: document.getElementById("despesaDescricao").value.trim(),
      valor: Number(document.getElementById("despesaValor").value)||0,
      formaPagamento: document.getElementById("despesaPagamento").value,
      recorrente: document.getElementById("despesaRecorrente").checked
    };
    if(!data.descricao){ toast("Descreva a despesa."); return; }
    if(id){
      Object.assign(state.despesas.find(function(x){ return x.id===id; }), data);
      toast("Despesa atualizada.");
    }else{
      data.id = uid();
      state.despesas.push(data);
      toast("Despesa registrada.");
    }
    save(); hideDespesaForm(); renderDespesas(); renderDashboard();
  });
  document.getElementById("tblDespesas").addEventListener("click", function(e){
    var editId = e.target.getAttribute("data-edit-despesa");
    var delId = e.target.getAttribute("data-del-despesa");
    if(editId) showDespesaForm(state.despesas.find(function(d){ return d.id===editId; }));
    if(delId){
      confirmAction("Excluir despesa", "Esta ação não pode ser desfeita.", function(){
        state.despesas = state.despesas.filter(function(x){ return x.id!==delId; });
        save(); renderDespesas(); renderDashboard();
        toast("Despesa excluída.");
      });
    }
  });
}

/* ================= CÁLCULOS DE PERÍODO ================= */
function calcPeriodo(from, to){
  var vendasP = state.vendas.filter(function(v){ return inRange(v.data, from, to); });
  var despesasP = state.despesas.filter(function(d){ return inRange(d.data, from, to); });
  var receitaBruta = 0, descontos = 0, taxas = 0, cmv = 0;
  vendasP.forEach(function(v){
    receitaBruta += v.qtd*v.precoUnit;
    descontos += v.desconto||0;
    taxas += v.taxa||0;
    cmv += v.qtd*(v.custoUnitSnapshot||0);
  });
  var receitaLiquida = receitaBruta - descontos - taxas;
  var lucroBruto = receitaLiquida - cmv;
  var despesasPorCategoria = {};
  DESPESA_CATS.forEach(function(c){ despesasPorCategoria[c]=0; });
  var totalDespesasOp = 0;
  despesasP.forEach(function(d){
    despesasPorCategoria[d.categoria] = (despesasPorCategoria[d.categoria]||0) + d.valor;
    totalDespesasOp += d.valor;
  });
  var lucroLiquido = lucroBruto - totalDespesasOp;
  var margem = receitaLiquida>0 ? (lucroLiquido/receitaLiquida*100) : 0;
  return { receitaBruta, descontos, taxas, receitaLiquida, cmv, lucroBruto,
    despesasPorCategoria, totalDespesasOp, lucroLiquido, margem, vendasP, despesasP };
}

/* ================= DASHBOARD ================= */
function destroyChart(key){ if(charts[key]){ charts[key].destroy(); delete charts[key]; } }

function renderDashboard(){
  var monthInput = document.getElementById("dashMonth");
  if(!monthInput.value) monthInput.value = currentMonthStr();
  var month = monthInput.value;
  var range = monthRange(month);
  var cur = calcPeriodo(range[0], range[1]);
  var prevMonth = addMonths(month, -1);
  var prevRange = monthRange(prevMonth);
  var prev = calcPeriodo(prevRange[0], prevRange[1]);

  document.getElementById("dashSub").textContent = "Resumo de "+monthLabel(month).replace(/^(\w)/,function(c){return c.toUpperCase();})+" · atualizado agora";

  function delta(curV, prevV){
    if(prevV===0 && curV===0) return {cls:"flat", txt:"sem variação"};
    if(prevV===0) return {cls:"up", txt:"novo no período"};
    var pct = ((curV-prevV)/Math.abs(prevV))*100;
    if(Math.abs(pct)<0.5) return {cls:"flat", txt:"estável vs. mês anterior"};
    return {cls: pct>0?"up":"down", txt:(pct>0?"+":"")+pct.toFixed(1)+"% vs. mês anterior"};
  }
  var dReceita = delta(cur.receitaLiquida, prev.receitaLiquida);
  var custosTotais = cur.cmv + cur.totalDespesasOp;
  var custosTotaisPrev = prev.cmv + prev.totalDespesasOp;
  var dCustos = delta(custosTotais, custosTotaisPrev);
  var dLucro = delta(cur.lucroLiquido, prev.lucroLiquido);

  var tiles = [
    {lbl:"Receita líquida", val:formatBRL(cur.receitaLiquida), d:dReceita},
    {lbl:"Custos + despesas", val:formatBRL(custosTotais), d:dCustos},
    {lbl:"Lucro líquido", val:formatBRL(cur.lucroLiquido), d:dLucro},
    {lbl:"Margem líquida", val:cur.margem.toFixed(1)+"%", d:null}
  ];
  document.getElementById("statTiles").innerHTML = tiles.map(function(t){
    return '<div class="card stat"><div class="lbl">'+t.lbl+'</div><div class="val">'+t.val+'</div>'+
      (t.d ? '<div class="delta '+t.d.cls+'">'+t.d.txt+'</div>' : '<div class="delta flat">&nbsp;</div>')+'</div>';
  }).join("");

  /* evolução 6 meses */
  var months = []; for(var i=5;i>=0;i--) months.push(addMonths(month,-i));
  var evReceita=[], evCustos=[], evLucro=[];
  months.forEach(function(m){
    var r = monthRange(m); var c = calcPeriodo(r[0], r[1]);
    evReceita.push(Number(c.receitaLiquida.toFixed(2)));
    evCustos.push(Number((c.cmv+c.totalDespesasOp).toFixed(2)));
    evLucro.push(Number(c.lucroLiquido.toFixed(2)));
  });
  destroyChart("evolucao");
  charts.evolucao = new Chart(document.getElementById("chartEvolucao"), {
    type:"bar",
    data:{ labels: months.map(monthLabel),
      datasets:[
        {label:"Receita líquida", data:evReceita, backgroundColor:C.blue, borderRadius:4, maxBarThickness:26},
        {label:"Custos + despesas", data:evCustos, backgroundColor:C.red, borderRadius:4, maxBarThickness:26},
        {label:"Lucro líquido", data:evLucro, backgroundColor:C.green, borderRadius:4, maxBarThickness:26}
      ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:"bottom", labels:{ boxWidth:10, boxHeight:10, font:{size:11.5}, color:C.secondary } },
        tooltip:{ callbacks:{ label:function(ctx){ return ctx.dataset.label+": "+formatBRL(ctx.parsed.y); } } } },
      scales:{ x:{ grid:{display:false}, ticks:{color:C.muted,font:{size:11.5}} },
        y:{ grid:{color:C.grid}, ticks:{color:C.muted,font:{size:11}, callback:function(v){ return "R$ "+v; } } } }
    }
  });

  /* despesas por categoria (mês selecionado) */
  document.getElementById("despCatCap").textContent = monthLabel(month)+" — total "+formatBRL(cur.totalDespesasOp);
  var catLabels = DESPESA_CATS.filter(function(c){ return cur.despesasPorCategoria[c]>0; });
  var catValues = catLabels.map(function(c){ return cur.despesasPorCategoria[c]; });
  destroyChart("despCat");
  var despWrap = document.getElementById("chartDespCat").parentElement;
  if(!catLabels.length){
    charts.despCat = null;
    document.getElementById("chartDespCat").style.display="none";
    if(!despWrap.querySelector(".empty")) despWrap.insertAdjacentHTML("beforeend", '<div class="empty">Nenhuma despesa neste mês.</div>');
  }else{
    document.getElementById("chartDespCat").style.display="block";
    var emptyMsg = despWrap.querySelector(".empty"); if(emptyMsg) emptyMsg.remove();
    charts.despCat = new Chart(document.getElementById("chartDespCat"), {
      type:"doughnut",
      data:{ labels:catLabels, datasets:[{ data:catValues, backgroundColor:catLabels.map(function(c){return CAT_COLORS[c];}), borderWidth:2, borderColor:"#fcfcfb" }]},
      options:{ responsive:true, maintainAspectRatio:false, cutout:"62%",
        plugins:{ legend:{ position:"bottom", labels:{ boxWidth:10, boxHeight:10, font:{size:11}, color:C.secondary } },
          tooltip:{ callbacks:{ label:function(ctx){ return ctx.label+": "+formatBRL(ctx.parsed); } } } } }
    });
  }

  /* top produtos vendidos no mês */
  var qtdPorProduto = {};
  cur.vendasP.forEach(function(v){ qtdPorProduto[v.produtoId] = (qtdPorProduto[v.produtoId]||0)+v.qtd; });
  var topEntries = Object.keys(qtdPorProduto).map(function(id){
    var p = produtoById(id);
    return { nome: p?p.nome:"(excluído)", qtd: qtdPorProduto[id] };
  }).sort(function(a,b){ return b.qtd-a.qtd; }).slice(0,6);
  destroyChart("topProdutos");
  var topWrap = document.getElementById("chartTopProdutos").parentElement;
  if(!topEntries.length){
    document.getElementById("chartTopProdutos").style.display="none";
    if(!topWrap.querySelector(".empty")) topWrap.insertAdjacentHTML("beforeend", '<div class="empty">Nenhuma venda neste mês.</div>');
  }else{
    document.getElementById("chartTopProdutos").style.display="block";
    var em = topWrap.querySelector(".empty"); if(em) em.remove();
    charts.topProdutos = new Chart(document.getElementById("chartTopProdutos"), {
      type:"bar",
      data:{ labels: topEntries.map(function(t){return t.nome;}), datasets:[{ data: topEntries.map(function(t){return t.qtd;}), backgroundColor:C.blue, borderRadius:4, maxBarThickness:20 }]},
      options:{ indexAxis:"y", responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:function(ctx){ return ctx.parsed.x+" un."; } } } },
        scales:{ x:{ grid:{color:C.grid}, ticks:{color:C.muted,font:{size:11}, precision:0} },
          y:{ grid:{display:false}, ticks:{color:C.secondary,font:{size:11.5}} } } }
    });
  }

  /* alertas de estoque */
  var alertas = state.produtos.filter(function(p){ return p.estoque<=p.estoqueMinimo; })
    .sort(function(a,b){ return a.estoque-b.estoque; });
  var alertasEl = document.getElementById("estoqueAlertas");
  if(!alertas.length){ alertasEl.innerHTML = '<div class="empty">Nenhum alerta — estoques em dia.</div>'; }
  else{
    alertasEl.innerHTML = alertas.map(function(p){
      var pill = p.estoque<=0 ? '<span class="pill crit">Sem estoque</span>' : '<span class="pill warn">Estoque baixo</span>';
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--grid);">'+
        '<span>'+esc(p.nome)+'</span><span style="display:flex;gap:8px;align-items:center;">'+p.estoque+' un. '+pill+'</span></div>';
    }).join("");
  }
}

/* ================= DRE ================= */
function renderDre(){
  var de = document.getElementById("dreDe"), ate = document.getElementById("dreAte");
  if(!de.value || !ate.value){
    var r = monthRange(currentMonthStr());
    de.value = r[0]; ate.value = r[1];
  }
  var c = calcPeriodo(de.value, ate.value);
  var rows = [];
  rows.push(['<tr class="section"><td>Receita Operacional Bruta</td><td class="num">'+formatBRL(c.receitaBruta)+"</td></tr>"]);
  rows.push(['<tr class="sub"><td>(-) Descontos concedidos</td><td class="num">'+formatBRL(-c.descontos)+"</td></tr>"]);
  rows.push(['<tr class="sub"><td>(-) Taxas de plataforma / marketplace</td><td class="num">'+formatBRL(-c.taxas)+"</td></tr>"]);
  rows.push(['<tr class="total"><td>= Receita Operacional Líquida</td><td class="num">'+formatBRL(c.receitaLiquida)+"</td></tr>"]);
  rows.push(['<tr class="indent"><td>(-) CMV — Custo da Mercadoria Vendida</td><td class="num">'+formatBRL(-c.cmv)+"</td></tr>"]);
  rows.push(['<tr class="total"><td>= Lucro Bruto</td><td class="num">'+formatBRL(c.lucroBruto)+"</td></tr>"]);
  rows.push(['<tr class="section"><td>(-) Despesas Operacionais</td><td class="num">'+formatBRL(-c.totalDespesasOp)+"</td></tr>"]);
  DESPESA_CATS.forEach(function(cat){
    var v = c.despesasPorCategoria[cat]||0;
    if(v>0) rows.push(['<tr class="sub"><td>'+cat+"</td><td class=\"num\">"+formatBRL(-v)+"</td></tr>"]);
  });
  var lucroColor = c.lucroLiquido>=0 ? "var(--good)" : "var(--critical)";
  rows.push(['<tr class="total"><td>= Lucro Líquido</td><td class="num" style="color:'+lucroColor+'">'+formatBRL(c.lucroLiquido)+"</td></tr>"]);
  rows.push(['<tr class="sub"><td>Margem líquida sobre receita</td><td class="num">'+c.margem.toFixed(1)+"%</td></tr>"]);
  document.getElementById("tblDre").innerHTML = "<tbody>"+rows.map(function(r){return r[0];}).join("")+"</tbody>";
}

function initDre(){
  document.getElementById("dreDe").addEventListener("change", renderDre);
  document.getElementById("dreAte").addEventListener("change", renderDre);
  document.getElementById("btnDreMesAtual").addEventListener("click", function(){
    var r = monthRange(currentMonthStr());
    document.getElementById("dreDe").value = r[0]; document.getElementById("dreAte").value = r[1];
    renderDre();
  });
  document.getElementById("btnDreUltimos3").addEventListener("click", function(){
    var r0 = monthRange(addMonths(currentMonthStr(),-2));
    var r1 = monthRange(currentMonthStr());
    document.getElementById("dreDe").value = r0[0]; document.getElementById("dreAte").value = r1[1];
    renderDre();
  });
  document.getElementById("btnDreAno").addEventListener("click", function(){
    var y = currentMonthStr().slice(0,4);
    document.getElementById("dreDe").value = y+"-01-01"; document.getElementById("dreAte").value = y+"-12-31";
    renderDre();
  });
}

/* ================= FLUXO DE CAIXA ================= */
function renderCaixa(){
  var de = document.getElementById("caixaDe"), ate = document.getElementById("caixaAte");
  if(!de.value){ de.value = monthRange(currentMonthStr())[0]; }
  if(!ate.value){ ate.value = todayISO(); }
  var saldoInput = document.getElementById("caixaSaldoInicial");
  if(!saldoInput._init){ saldoInput.value = state.config.saldoInicial||0; saldoInput._init = true; }

  var movs = [];
  state.vendas.forEach(function(v){
    if(!inRange(v.data, de.value, ate.value)) return;
    var p = produtoById(v.produtoId);
    movs.push({ data:v.data, desc:"Venda — "+(p?p.nome:"produto")+" x"+v.qtd+" ("+v.canal+")", valor: v.qtd*v.precoUnit - v.desconto - v.taxa });
  });
  state.compras.forEach(function(c){
    if(!inRange(c.data, de.value, ate.value)) return;
    var p = produtoById(c.produtoId);
    movs.push({ data:c.data, desc:"Compra — "+(p?p.nome:c.categoria), valor: -(c.qtd*c.custoUnit) });
  });
  state.despesas.forEach(function(d){
    if(!inRange(d.data, de.value, ate.value)) return;
    movs.push({ data:d.data, desc:d.categoria+" — "+d.descricao, valor: -d.valor });
  });
  movs.sort(function(a,b){ return a.data.localeCompare(b.data); });

  var saldo = Number(saldoInput.value)||0;
  var rows = [];
  rows.push('<tr><td>'+formatDateBR(de.value)+'</td><td>Saldo inicial</td><td class="num">—</td><td class="num mono">'+formatBRL(saldo)+"</td></tr>");
  movs.forEach(function(m){
    saldo += m.valor;
    var cls = m.valor>=0 ? 'style="color:var(--good)"' : 'style="color:var(--critical)"';
    rows.push("<tr><td>"+formatDateBR(m.data)+"</td><td>"+esc(m.desc)+'</td><td class="num mono" '+cls+">"+formatBRL(m.valor)+'</td><td class="num mono">'+formatBRL(saldo)+"</td></tr>");
  });
  document.getElementById("tblCaixa").innerHTML = "<thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Saldo</th></tr></thead><tbody>"+rows.join("")+"</tbody>";
}

function initCaixa(){
  ["caixaDe","caixaAte"].forEach(function(id){ document.getElementById(id).addEventListener("change", renderCaixa); });
  document.getElementById("caixaSaldoInicial").addEventListener("change", function(){
    state.config.saldoInicial = Number(this.value)||0; save(); renderCaixa();
  });
}

/* ================= BACKUP ================= */
function downloadFile(filename, content, mime){
  var blob = new Blob([content], {type:mime});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
function toCsv(rows, headers){
  var lines = [headers.join(";")];
  rows.forEach(function(r){ lines.push(headers.map(function(h){ var v=r[h]==null?"":String(r[h]); return '"'+v.replace(/"/g,'""')+'"'; }).join(";")); });
  return lines.join("\r\n");
}

function initBackup(){
  document.getElementById("btnExportJson").addEventListener("click", function(){
    downloadFile("sua-mesa-financeiro-backup-"+todayISO()+".json", JSON.stringify(state,null,2), "application/json");
    toast("Backup exportado.");
  });
  document.getElementById("btnExportVendasCsv").addEventListener("click", function(){
    var rows = state.vendas.map(function(v){
      var p = produtoById(v.produtoId);
      return { data:v.data, produto:p?p.nome:"", qtd:v.qtd, preco:v.precoUnit, desconto:v.desconto, taxa:v.taxa, canal:v.canal, total:(v.qtd*v.precoUnit-v.desconto-v.taxa).toFixed(2) };
    });
    downloadFile("vendas-"+todayISO()+".csv", toCsv(rows, ["data","produto","qtd","preco","desconto","taxa","canal","total"]), "text/csv");
    toast("CSV de vendas exportado.");
  });
  document.getElementById("btnExportDespesasCsv").addEventListener("click", function(){
    var rows = state.despesas.map(function(d){ return { data:d.data, categoria:d.categoria, descricao:d.descricao, valor:d.valor.toFixed(2), pagamento:d.formaPagamento, recorrente:d.recorrente?"sim":"não" }; });
    downloadFile("despesas-"+todayISO()+".csv", toCsv(rows, ["data","categoria","descricao","valor","pagamento","recorrente"]), "text/csv");
    toast("CSV de despesas exportado.");
  });
  document.getElementById("fileImport").addEventListener("change", function(e){
    var file = e.target.files[0]; if(!file) return;
    var reader = new FileReader();
    reader.onload = function(ev){
      try{
        var parsed = JSON.parse(ev.target.result);
        confirmAction("Importar backup", "Isso substituirá todos os dados atuais pelos dados do arquivo. Continuar?", function(){
          state = Object.assign(defaultState(), parsed);
          save(); renderAll();
          toast("Backup importado com sucesso.");
        });
      }catch(err){ toast("Arquivo inválido."); }
      e.target.value = "";
    };
    reader.readAsText(file);
  });
  document.getElementById("btnCarregarExemplo").addEventListener("click", function(){
    confirmAction("Carregar dados de exemplo", "Isso substituirá todos os dados atuais por um exemplo de demonstração. Continuar?", function(){
      state = exemploData();
      save(); renderAll();
      toast("Dados de exemplo carregados.");
    });
  });
  document.getElementById("btnLimparTudo").addEventListener("click", function(){
    confirmAction("Limpar todos os dados", "Esta ação é irreversível e apagará produtos, vendas, compras e despesas.", function(){
      state = defaultState();
      save(); renderAll();
      toast("Dados apagados.");
    });
  });
}

function exemploData(){
  var s = defaultState();
  var hoje = new Date();
  function iso(y,m,d){ return y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0"); }
  var y = hoje.getFullYear(), m = hoje.getMonth()+1;
  var pJogoAmericano = { id:uid(), nome:"Jogo Americano Clássico", categoria:"Jogo Americano", custoUnit:22, precoVenda:59.9, estoque:40, estoqueMinimo:10 };
  var pGuardanapo = { id:uid(), nome:"Guardanapo Ponto Ajour", categoria:"Guardanapo", custoUnit:7, precoVenda:19.9, estoque:60, estoqueMinimo:15 };
  var pPorta = { id:uid(), nome:"Porta-guardanapo Orquídea", categoria:"Porta-guardanapo", custoUnit:9, precoVenda:24.9, estoque:8, estoqueMinimo:10 };
  var pToalha = { id:uid(), nome:"Toalha Toscana", categoria:"Toalha de Mesa", custoUnit:78, precoVenda:199, estoque:5, estoqueMinimo:5 };
  s.produtos = [pJogoAmericano, pGuardanapo, pPorta, pToalha];
  s.vendas = [
    { id:uid(), data:iso(y,m,3), produtoId:pJogoAmericano.id, qtd:4, precoUnit:59.9, desconto:0, taxa:5, canal:"Instagram", custoUnitSnapshot:22 },
    { id:uid(), data:iso(y,m,5), produtoId:pGuardanapo.id, qtd:10, precoUnit:19.9, desconto:10, taxa:0, canal:"Site", custoUnitSnapshot:7 },
    { id:uid(), data:iso(y,m,9), produtoId:pToalha.id, qtd:1, precoUnit:199, desconto:0, taxa:0, canal:"Feira/Evento", custoUnitSnapshot:78 },
    { id:uid(), data:iso(y,m,12), produtoId:pPorta.id, qtd:12, precoUnit:24.9, desconto:0, taxa:12, canal:"Marketplace", custoUnitSnapshot:9 },
    { id:uid(), data:iso(y,m,18), produtoId:pJogoAmericano.id, qtd:2, precoUnit:59.9, desconto:0, taxa:0, canal:"WhatsApp", custoUnitSnapshot:22 }
  ];
  s.compras = [
    { id:uid(), data:iso(y,m,1), categoria:"revenda", produtoId:pJogoAmericano.id, fornecedor:"Fornecedor Têxtil SP", qtd:20, custoUnit:22 },
    { id:uid(), data:iso(y,m,2), categoria:"embalagem", produtoId:null, fornecedor:"Papelaria Central", qtd:100, custoUnit:0.9 }
  ];
  s.despesas = [
    { id:uid(), data:iso(y,m,4), categoria:"Eventos", descricao:"Taxa de participação — Feira de Artesanato Jardins", valor:180, formaPagamento:"Pix", recorrente:false },
    { id:uid(), data:iso(y,m,6), categoria:"Motoboy", descricao:"Entrega expressa — pedido site", valor:22, formaPagamento:"Pix", recorrente:false },
    { id:uid(), data:iso(y,m,7), categoria:"Uber", descricao:"Deslocamento até a feira", valor:38, formaPagamento:"Cartão", recorrente:false },
    { id:uid(), data:iso(y,m,10), categoria:"Costureira", descricao:"Ajuste de bainha — lote toalhas", valor:65, formaPagamento:"Dinheiro", recorrente:false },
    { id:uid(), data:iso(y,m,15), categoria:"Marketing", descricao:"Impulsionamento Instagram", valor:50, formaPagamento:"Cartão", recorrente:true },
    { id:uid(), data:iso(y,m,20), categoria:"Embalagem", descricao:"Sacolas personalizadas", valor:34, formaPagamento:"Pix", recorrente:false }
  ];
  return s;
}

/* ================= INIT ================= */
function renderAll(){
  renderProdutoSelects();
  renderProdutos(); renderVendas(); renderCompras(); renderDespesas();
  renderDashboard(); renderDre(); renderCaixa();
}

document.addEventListener("DOMContentLoaded", function(){
  state = load();
  initNav(); initProdutos(); initVendas(); initCompras(); initDespesas(); initDre(); initCaixa(); initBackup();
  document.getElementById("dashMonth").addEventListener("change", renderDashboard);
  renderAll();
  if(!state.produtos.length && !state.vendas.length){
    toast("Bem-vindo! Carregue dados de exemplo na aba Backup, ou cadastre seu primeiro produto.");
  }
});

})();
